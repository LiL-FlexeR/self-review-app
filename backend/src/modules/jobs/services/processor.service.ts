import { Inject, Injectable } from '@nestjs/common';
import type { OnModuleInit, OnApplicationShutdown } from '@nestjs/common';
import { Worker } from 'bullmq';
import { z as zod } from 'zod';
import { SyncCommand } from '@self-review/contracts';
import type { TSyncCommand } from '@self-review/contracts';
import { aggregateUsage } from '@app/modules/agent/agent.usage';
import { excerpt, json } from '@app/modules/agent/agent.utils';
import { Analysis, LIMITS } from '@app/modules/agent/agent.schemas';
import type { TAnalysis } from '@app/modules/agent/agent.schemas';
import { inRunningRun } from '@app/modules/jobs/running-transaction';
import type {
	IImportCoverage,
	ITaskRefresh,
	ISyncPublication,
} from '@app/modules/jobs/jobs.interfaces';
import { DatabaseService } from '@app/shared/database/database.service';
import { ConfigService } from '@app/shared/config/config.service';
import { FixtureService } from '@app/modules/providers/fixture.service';
import type { IProviderTask } from '@app/modules/providers/fixture.service';
import { AgentService } from '@app/modules/agent/services/agent.service';
import { QueueService } from './queue.service.js';
import { ReviewService } from './review.service.js';
import type { JobRun, TaskSnapshot, CommentSnapshot, Prisma } from '@app/generated/prisma/client';
import { AppLogger, withLogContext } from '@app/shared/logging/logger';

const logger = new AppLogger('ProcessorService');

type TTaskWithComments = TaskSnapshot & { comments: CommentSnapshot[] };

@Injectable()
export class ProcessorService implements OnModuleInit, OnApplicationShutdown {
	private worker?: Worker;
	constructor(
		@Inject(DatabaseService) private readonly database: DatabaseService,
		@Inject(ConfigService) private readonly configuration: ConfigService,
		@Inject(FixtureService) private readonly provider: FixtureService,
		@Inject(AgentService) private readonly agent: AgentService,
		@Inject(QueueService) private readonly queue: QueueService,
		@Inject(ReviewService) private readonly review: ReviewService,
	) {}

	onModuleInit() {
		this.worker = new Worker(
			'workflow',
			async (job) => {
				const { runId } = zod.strictObject({ runId: zod.uuid() }).parse(job.data);
				await this.execute(runId);
			},
			{
				connection: {
					url: this.configuration.get('REDIS_URL'),
					maxRetriesPerRequest: null,
				},
				prefix: this.configuration.get('REDIS_PREFIX') + 'jobs',
				concurrency: 1,
				maxStalledCount: 0,
			},
		);
		this.worker.on('error', (error) => logger.error('worker_queue_error', { error }));
		this.worker.on('failed', (job, error) =>
			logger.error('worker_job_failed', { error, runId: job?.data?.runId }),
		);
	}

	async onApplicationShutdown() {
		await this.worker?.close();
	}

	async execute(runId: string) {
		return withLogContext({ runId }, () => this.executeRun(runId));
	}

	private async executeRun(runId: string) {
		if (!(await this.claimRun(runId))) {
			return;
		}
		const timer = this.startHeartbeat(runId);
		try {
			const run = await this.database.client.jobRun.findUniqueOrThrow({
				where: { id: runId },
			});
			if (run.type === 'review') {
				await this.review.execute(runId);
			} else {
				await this.sync(run);
			}
		} catch (error) {
			logger.error('run_execution_failed', { error });
			await this.failRun(runId, error);
		} finally {
			clearInterval(timer);
			await this.logTerminalRun(runId);
		}
	}

	private async claimRun(runId: string): Promise<boolean> {
		const claim = await this.database.client.jobRun.updateMany({
			where: { id: runId, state: 'queued' },
			data: {
				state: 'running',
				stage: 'listing',
				startedAt: new Date(),
				heartbeatAt: new Date(),
				unitDeadlineAt: new Date(Date.now() + LIMITS.unitMs),
				version: { increment: 1 },
			},
		});

		return claim.count > 0;
	}

	private startHeartbeat(runId: string): ReturnType<typeof setInterval> {
		return setInterval(() => {
			void this.updateHeartbeat(runId);
		}, 5000);
	}

	private async updateHeartbeat(runId: string): Promise<void> {
		try {
			await this.database.client.jobRun.updateMany({
				where: { id: runId, state: 'running' },
				data: { heartbeatAt: new Date() },
			});
		} catch (error) {
			logger.error('heartbeat_failed', { error, runId });
			// Recovery detects the lost heartbeat when storage becomes available again.
		}
	}

	private async failRun(runId: string, error: unknown): Promise<void> {
		const db = this.database.client;
		const saved = await db.taskSnapshot.count({ where: { syncRunId: runId } });
		const current = await db.jobRun.findUniqueOrThrow({ where: { id: runId } });
		const attempts = await db.modelAttempt.findMany({ where: { runId } });
		const code = this.getFailureCode(error);
		const state =
			current.type === 'sync' && saved && code !== 'INSUFFICIENT_DATA' ? 'partial' : 'failed';

		await db.jobRun.updateMany({
			where: { id: runId, state: 'running' },
			data: {
				state,
				stage: 'finished',
				finishedAt: new Date(),
				error: { code },
				usage: json(aggregateUsage(this.configuration.get('APP_MODE'), attempts)),
				coverage: json({
					...zod.record(zod.string(), zod.unknown()).parse(current.coverage),
					...(current.generateReview ? { autoReview: 'skipped: sync incomplete' } : {}),
				}),
				version: { increment: 1 },
			},
		});
	}

	private getFailureCode(error: unknown): string {
		const safeCodes = [
			'INVALID_MODEL_OUTPUT',
			'GUARDRAIL_VIOLATION',
			'BUDGET_EXHAUSTED',
			'UNIT_TIMEOUT',
			'RUN_INTERRUPTED',
			'MODEL_REFUSAL',
			'MODEL_CONFIGURATION',
			'PAGINATION_LOOP',
			'INSUFFICIENT_DATA',
			'PROVIDER_READ_FAILED',
		];

		return error instanceof Error && safeCodes.includes(error.message)
			? error.message
			: 'EXECUTION_FAILED';
	}

	private async logTerminalRun(runId: string): Promise<void> {
		const terminal = await this.database.client.jobRun.findUnique({
			where: { id: runId },
			select: { id: true, type: true, state: true, stage: true, error: true, usage: true },
		});
		logger.info('run_terminal', { runId, state: terminal?.state, stage: terminal?.stage });
	}

	private async beginUnit(runId: string, stage: string): Promise<void> {
		const result = await this.database.client.jobRun.updateMany({
			where: { id: runId, state: 'running' },
			data: {
				stage,
				unitDeadlineAt: new Date(Date.now() + LIMITS.unitMs),
				version: { increment: 1 },
			},
		});
		if (!result.count) {
			logger.error('operation_rejected', { reason: 'RUN_INTERRUPTED' });
			throw new Error('RUN_INTERRUPTED');
		}
	}

	private async sync(run: JobRun): Promise<void> {
		const project = await this.database.client.sourceProject.findUniqueOrThrow({
			where: { id: run.projectId },
		});
		const { selection } = SyncCommand.parse({
			selection: run.selection,
			idempotencyKey: run.idempotencyKey,
		});
		const coverage =
			selection.mode === 'period'
				? await this.importPeriodTasks(run.id, project.externalId, selection)
				: await this.importSelectedTasks(run.id, project.externalId, selection);
		const importComplete = await this.saveImportCoverage(run.id, coverage);
		const analysis = Analysis.parse(await this.agent.run(run.id, run.id, false));

		await this.completeSync(run, analysis, coverage.discoveryComplete, importComplete);
	}

	private async importPeriodTasks(
		runId: string,
		externalProjectId: string,
		selection: Extract<TSyncCommand['selection'], { mode: 'period' }>,
	): Promise<IImportCoverage> {
		await this.discoverPeriodTasks(runId, externalProjectId, selection);
		const refreshFailed = await this.readTaskDetails(runId, externalProjectId);

		return { discoveryComplete: true, refreshFailed };
	}

	private async discoverPeriodTasks(
		runId: string,
		externalProjectId: string,
		selection: Extract<TSyncCommand['selection'], { mode: 'period' }>,
	): Promise<void> {
		let cursor: number | null = 0;
		const seen = new Set<number>();
		const start = new Date(selection.startDate + 'T00:00:00Z');
		const end = new Date(new Date(selection.endDate + 'T00:00:00Z').getTime() + 86400000);

		while (cursor !== null) {
			await this.beginUnit(runId, 'listing');
			if (seen.has(cursor)) {
				logger.error('operation_rejected', { reason: 'PAGINATION_LOOP' });
				throw new Error('PAGINATION_LOOP');
			}
			seen.add(cursor);
			const page = await this.provider.list(externalProjectId, cursor);
			for (const item of page.items) {
				if (item.createdAt < start || item.createdAt >= end) {
					continue;
				}
				await this.saveDiscoveredTask(runId, item);
			}
			cursor = page.nextCursor;
		}
		await this.database.client.jobRun.updateMany({
			where: { id: runId, state: 'running' },
			data: { coverage: { discoveryComplete: true }, version: { increment: 1 } },
		});
	}

	private async saveDiscoveredTask(runId: string, item: IProviderTask): Promise<void> {
		await inRunningRun(this.database.client, runId, (transaction) =>
			transaction.taskSnapshot.upsert({
				where: { syncRunId_externalId: { syncRunId: runId, externalId: item.externalId } },
				create: {
					syncRunId: runId,
					externalId: item.externalId,
					identifier: item.identifier,
					title: item.title,
					description: '',
					state: item.state,
					assignees: item.assignees,
					sourceCreatedAt: item.createdAt,
					retrievedAt: new Date(),
					detailStatus: 'pending',
					refreshStatus: 'fresh',
				},
				update: {},
			}),
		);
	}

	private async readTaskDetails(runId: string, externalProjectId: string): Promise<boolean> {
		let cursor: string | undefined;
		let refreshFailed = false;

		while (true) {
			const tasks = await this.database.client.taskSnapshot.findMany({
				where: { syncRunId: runId, ...(cursor ? { id: { gt: cursor } } : {}) },
				orderBy: { id: 'asc' },
				take: LIMITS.batch,
			});
			if (!tasks.length) {
				break;
			}
			cursor = tasks.at(-1)!.id;
			await this.beginUnit(runId, 'reading');
			for (const task of tasks) {
				const succeeded = await this.readTaskDetail(runId, externalProjectId, task);
				if (!succeeded) {
					refreshFailed = true;
				}
			}
		}

		return refreshFailed;
	}

	private async readTaskDetail(
		runId: string,
		externalProjectId: string,
		task: TaskSnapshot,
	): Promise<boolean> {
		const db = this.database.client;
		try {
			const details = await this.provider.details(externalProjectId, task.externalId);
			await inRunningRun(db, runId, (transaction) =>
				transaction.taskSnapshot.update({
					where: { id: task.id },
					data: {
						description: excerpt(details.description, 65536),
						detailStatus:
							Buffer.byteLength(details.description) > 65536
								? 'truncated'
								: 'available',
						retrievedAt: new Date(),
					},
				}),
			);
			return true;
		} catch (error) {
			logger.error('task_detail_failed', { error, runId, taskId: task.id });
			await inRunningRun(db, runId, (transaction) =>
				transaction.taskSnapshot.update({
					where: { id: task.id },
					data: { detailStatus: 'unavailable' },
				}),
			);
			return false;
		}
	}

	private async importSelectedTasks(
		runId: string,
		externalProjectId: string,
		selection: Extract<TSyncCommand['selection'], { mode: 'tasks' }>,
	): Promise<IImportCoverage> {
		const db = this.database.client;
		const base = await db.jobRun.findUniqueOrThrow({ where: { id: selection.baseSyncRunId } });
		const discoveryComplete =
			zod.object({ discoveryComplete: zod.boolean().optional() }).parse(base.coverage)
				.discoveryComplete ?? false;
		let cursor: string | undefined;
		let refreshFailed = false;

		while (true) {
			const tasks = await db.taskSnapshot.findMany({
				where: { syncRunId: base.id, ...(cursor ? { id: { gt: cursor } } : {}) },
				orderBy: { id: 'asc' },
				take: LIMITS.batch,
				include: { comments: true },
			});
			if (!tasks.length) {
				break;
			}
			cursor = tasks.at(-1)!.id;
			await this.beginUnit(runId, 'reading');
			for (const task of tasks) {
				const refresh = await this.readSelectedTask(
					externalProjectId,
					task,
					selection.taskIds.includes(task.id),
				);
				await this.copyTaskSnapshot(runId, task, refresh);
				if (refresh.refreshFailed) {
					refreshFailed = true;
				}
			}
		}

		return { discoveryComplete, refreshFailed };
	}

	private async readSelectedTask(
		externalProjectId: string,
		task: TaskSnapshot,
		shouldRefresh: boolean,
	): Promise<ITaskRefresh> {
		if (!shouldRefresh) {
			return {
				refreshStatus: task.refreshStatus === 'stale' ? 'stale' : 'copied',
				refreshFailed: false,
			};
		}
		try {
			const details = await this.provider.details(externalProjectId, task.externalId);
			return { refreshStatus: 'fresh', details, refreshFailed: false };
		} catch (error) {
			logger.error('selected_task_refresh_failed', { error, taskId: task.id });
			return { refreshStatus: 'stale', refreshFailed: true };
		}
	}

	private async copyTaskSnapshot(
		runId: string,
		task: TTaskWithComments,
		refresh: ITaskRefresh,
	): Promise<void> {
		const { id, comments, syncRunId: previousRunId, ...data } = task;
		void previousRunId;
		const details = refresh.details;

		await inRunningRun(this.database.client, runId, async (transaction) => {
			const copy = await transaction.taskSnapshot.create({
				data: {
					...data,
					assignees: json(data.assignees),
					syncRunId: runId,
					copiedFromSnapshotId: id,
					refreshStatus: refresh.refreshStatus,
					...(details
						? {
								title: details.title,
								description: excerpt(details.description, 65536),
								state: details.state,
								assignees: details.assignees,
								retrievedAt: new Date(),
								detailStatus:
									Buffer.byteLength(details.description) > 65536
										? 'truncated'
										: 'available',
								commentReadState: 'not_read',
								commentReadAt: null,
								commentsTruncated: false,
								commentErrorCode: null,
							}
						: {}),
				},
			});
			if (!details) {
				await this.copyTaskComments(transaction, copy.id, comments);
			}
		});
	}

	private async copyTaskComments(
		transaction: Prisma.TransactionClient,
		taskSnapshotId: string,
		comments: CommentSnapshot[],
	): Promise<void> {
		for (const comment of comments) {
			const { id: commentId, taskSnapshotId: previousTaskId, ...data } = comment;
			void commentId;
			void previousTaskId;
			await transaction.commentSnapshot.create({ data: { ...data, taskSnapshotId } });
		}
	}

	private async saveImportCoverage(runId: string, coverage: IImportCoverage): Promise<boolean> {
		const db = this.database.client;
		const missing = await db.taskSnapshot.count({
			where: {
				syncRunId: runId,
				OR: [
					{ detailStatus: { not: 'available' } },
					{ refreshStatus: 'stale' },
					{ commentReadState: 'failed' },
				],
			},
		});
		const available = await db.taskSnapshot.count({
			where: { syncRunId: runId, detailStatus: 'available' },
		});
		if (!available && (await db.taskSnapshot.count({ where: { syncRunId: runId } }))) {
			logger.error('operation_rejected', { reason: 'INSUFFICIENT_DATA' });
			throw new Error('INSUFFICIENT_DATA');
		}
		const importComplete =
			coverage.discoveryComplete && !coverage.refreshFailed && missing === 0;
		await db.jobRun.updateMany({
			where: { id: runId, state: 'running' },
			data: {
				importComplete,
				coverage: { discoveryComplete: coverage.discoveryComplete },
				version: { increment: 1 },
			},
		});

		return importComplete;
	}

	private async completeSync(
		run: JobRun,
		analysis: TAnalysis,
		discoveryComplete: boolean,
		importComplete: boolean,
	): Promise<void> {
		const db = this.database.client;
		const incompleteComments = await db.taskSnapshot.count({
			where: { syncRunId: run.id, commentReadState: { in: ['failed', 'truncated'] } },
		});
		const saved = await db.taskSnapshot.count({ where: { syncRunId: run.id } });
		const attempts = await db.modelAttempt.findMany({ where: { runId: run.id } });
		const childId = await this.publishSync(run, {
			analysis,
			discoveryComplete,
			importComplete: importComplete && incompleteComments === 0,
			saved,
			usage: json(aggregateUsage(this.configuration.get('APP_MODE'), attempts)),
		});
		if (childId) {
			await this.queue.enqueue(childId);
		}
	}

	private async publishSync(run: JobRun, result: ISyncPublication): Promise<string | undefined> {
		let state = 'failed';
		if (result.importComplete) {
			state = 'succeeded';
		} else if (result.saved) {
			state = 'partial';
		}
		let autoReview = 'disabled';
		if (run.generateReview) {
			autoReview = result.importComplete ? 'queued' : 'skipped: sync incomplete';
		}

		return this.database.client.$transaction(async (transaction) => {
			const finalized = await transaction.jobRun.updateMany({
				where: { id: run.id, state: 'running' },
				data: {
					state,
					stage: 'finished',
					finishedAt: new Date(),
					analysisComplete: true,
					coverage: { discoveryComplete: result.discoveryComplete, autoReview },
					usage: result.usage,
					version: { increment: 1 },
				},
			});
			if (!finalized.count) {
				logger.error('operation_rejected', { reason: 'RUN_INTERRUPTED' });
				throw new Error('RUN_INTERRUPTED');
			}
			await transaction.syncAnalysis.create({
				data: {
					syncRunId: run.id,
					findings: json(result.analysis),
					limitations: result.analysis.limitations,
				},
			});
			if (run.generateReview && result.importComplete) {
				return this.createAutomaticReview(transaction, run, result.importComplete);
			}
			return undefined;
		});
	}

	private async createAutomaticReview(
		transaction: Prisma.TransactionClient,
		run: JobRun,
		importComplete: boolean,
	): Promise<string> {
		const child = await transaction.jobRun.create({
			data: {
				ownerId: run.ownerId,
				projectId: run.projectId,
				type: 'review',
				trigger: 'automatic',
				selection: json(run.selection),
				subjectSourceUserId: run.subjectSourceUserId,
				sourceSyncRunId: run.id,
				importComplete,
				idempotencyKey: run.id,
				requestFingerprint: 'automatic:' + run.id,
			},
		});

		return child.id;
	}
}
