import {
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
	BadRequestException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { z as zod } from 'zod';
import { HTTP_ERROR_CODE, HTTP_ERROR_MESSAGE } from '@self-review/contracts';
import type { TSyncCommand, TReviewCommand, TJobView } from '@self-review/contracts';
import type { IJobScope, IJobRequest } from '@app/modules/jobs/jobs.interfaces';
import type { JobRun, Prisma } from '@app/generated/prisma/client';
import { DatabaseService } from '@app/shared/database/database.service';
import { QueueService } from './queue.service.js';
import { json } from '@app/modules/agent/agent.utils';
import { AppLogger } from '@app/shared/logging/logger';

const logger = new AppLogger('JobsService');

@Injectable()
export class JobsService {
	constructor(
		@Inject(DatabaseService) private readonly database: DatabaseService,
		@Inject(QueueService) private readonly queue: QueueService,
	) {}

	async project(ownerId: string, id: string) {
		const project = await this.database.client.sourceProject.findFirst({
			where: { id, connection: { ownerId } },
			include: { connection: true },
		});
		if (!project) {
			throw new NotFoundException({
				code: HTTP_ERROR_CODE.RESOURCE_NOT_FOUND,
				message: HTTP_ERROR_MESSAGE.RESOURCE_NOT_FOUND,
				retryable: false,
			});
		}
		return project;
	}

	async owned(ownerId: string, id: string) {
		const run = await this.database.client.jobRun.findFirst({ where: { id, ownerId } });
		if (!run) {
			throw new NotFoundException({
				code: HTTP_ERROR_CODE.RESOURCE_NOT_FOUND,
				message: HTTP_ERROR_MESSAGE.RESOURCE_NOT_FOUND,
				retryable: false,
			});
		}
		return run;
	}

	async create(
		ownerId: string,
		projectId: string,
		type: 'sync' | 'review',
		command: TSyncCommand | TReviewCommand,
	) {
		const project = await this.project(ownerId, projectId);
		const scope =
			'selection' in command
				? await this.resolveSyncScope(
						ownerId,
						projectId,
						project.connection.sourceUserId,
						command,
					)
				: await this.resolveReviewScope(ownerId, projectId, command);
		const request: IJobRequest = {
			ownerId,
			projectId,
			type,
			...scope,
			generateReview: 'generateReview' in command && command.generateReview,
			idempotencyKey: command.idempotencyKey,
			requestFingerprint: this.createRequestFingerprint(type, projectId, command, scope),
		};
		const run = await this.findOrCreateRun(request);
		if (run.state === 'queued') {
			await this.queue.enqueue(run.id);
		}

		return { runId: run.id, state: run.state, eventsUrl: `/api/jobs/${run.id}/events` };
	}

	async view(run: JobRun): Promise<TJobView> {
		const coverage = zod
			.object({
				discoveryComplete: zod.boolean().optional(),
				autoReview: zod.string().optional(),
			})
			.passthrough()
			.parse(run.coverage);
		const counts = zod.record(zod.string(), zod.number()).parse(run.counts);
		const child = await this.findAutomaticReview(run);
		const error = zod.object({ code: zod.string() }).safeParse(run.error);
		const currentCounts = await this.collectRunCounts(run);

		return {
			runId: run.id,
			type: run.type as 'sync' | 'review',
			state: run.state as TJobView['state'],
			stage: run.stage,
			version: run.version,
			counts: { ...counts, ...currentCounts },
			discoveryComplete: coverage.discoveryComplete ?? false,
			importComplete: run.importComplete,
			analysisComplete: run.analysisComplete,
			resultRef: this.getResultReference(run),
			currentReviewReportId: run.currentReviewReportId,
			errorCode: error.success ? error.data.code : null,
			warningsCount: run.state === 'partial' ? 1 : 0,
			autoReview: child?.state ?? coverage.autoReview ?? null,
			reviewRunId: child?.id ?? null,
			selection: run.selection,
			usage: run.usage,
		};
	}

	private async resolveSyncScope(
		ownerId: string,
		projectId: string,
		sourceUserId: string,
		command: TSyncCommand,
	): Promise<IJobScope> {
		if (command.selection.mode === 'tasks') {
			return this.resolveSelectedTaskScope(ownerId, projectId, command.selection);
		}

		return {
			selection: json(command.selection),
			subjectSourceUserId: sourceUserId,
			importComplete: false,
		};
	}

	private async resolveSelectedTaskScope(
		ownerId: string,
		projectId: string,
		selection: Extract<TSyncCommand['selection'], { mode: 'tasks' }>,
	): Promise<IJobScope> {
		const base = await this.owned(ownerId, selection.baseSyncRunId);
		if (
			base.projectId !== projectId ||
			base.type !== 'sync' ||
			!['succeeded', 'partial'].includes(base.state)
		) {
			throw new NotFoundException({
				code: HTTP_ERROR_CODE.RESOURCE_NOT_FOUND,
				message: HTTP_ERROR_MESSAGE.RESOURCE_NOT_FOUND,
				retryable: false,
			});
		}
		const taskIds = [...new Set(selection.taskIds)].sort();
		const count = await this.database.client.taskSnapshot.count({
			where: { syncRunId: base.id, id: { in: taskIds } },
		});
		if (count !== taskIds.length) {
			throw new NotFoundException({
				code: HTTP_ERROR_CODE.RESOURCE_NOT_FOUND,
				message: HTTP_ERROR_MESSAGE.RESOURCE_NOT_FOUND,
				retryable: false,
			});
		}

		return {
			selection: json({ ...selection, taskIds }),
			baseSyncRunId: base.id,
			subjectSourceUserId: base.subjectSourceUserId,
			importComplete: false,
		};
	}

	private async resolveReviewScope(
		ownerId: string,
		projectId: string,
		command: TReviewCommand,
	): Promise<IJobScope> {
		const source = await this.owned(ownerId, command.syncRunId);
		if (source.projectId !== projectId || source.type !== 'sync') {
			throw new NotFoundException({
				code: HTTP_ERROR_CODE.RESOURCE_NOT_FOUND,
				message: HTTP_ERROR_MESSAGE.RESOURCE_NOT_FOUND,
				retryable: false,
			});
		}
		if (source.state !== 'succeeded' && !(source.state === 'partial' && command.allowPartial)) {
			throw new BadRequestException({
				code: HTTP_ERROR_CODE.SNAPSHOT_UNAVAILABLE,
				message: HTTP_ERROR_MESSAGE.SNAPSHOT_UNAVAILABLE,
				retryable: false,
			});
		}

		return {
			selection: json(source.selection),
			sourceSyncRunId: source.id,
			subjectSourceUserId: source.subjectSourceUserId,
			importComplete: source.importComplete,
		};
	}

	private createRequestFingerprint(
		type: 'sync' | 'review',
		projectId: string,
		command: TSyncCommand | TReviewCommand,
		scope: IJobScope,
	): string {
		const normalized =
			'selection' in command
				? { selection: scope.selection, generateReview: command.generateReview }
				: { syncRunId: scope.sourceSyncRunId, allowPartial: command.allowPartial };

		return createHash('sha256')
			.update(JSON.stringify({ type, projectId, ...normalized }))
			.digest('hex');
	}

	private async findOrCreateRun(request: IJobRequest): Promise<JobRun> {
		try {
			return await this.acceptRun(request);
		} catch (error) {
			logger.error('job_acceptance_failed', { error });
			if (!(error instanceof Error && 'code' in error && error.code === 'P2002')) {
				throw error;
			}
			const existing = await this.findRunByIdempotencyKey(this.database.client, request);
			if (existing?.requestFingerprint === request.requestFingerprint) {
				return existing;
			}

			throw new ConflictException({
				code: HTTP_ERROR_CODE.JOB_CONFLICT,
				message: HTTP_ERROR_MESSAGE.JOB_CONFLICT,
				retryable: false,
			});
		}
	}

	private async acceptRun(request: IJobRequest): Promise<JobRun> {
		return this.database.client.$transaction(async (transaction) => {
			// Keep replay lookup and the activity-slot check under the same project lock.
			await transaction.$queryRaw`SELECT id FROM source_projects WHERE id=${request.projectId}::uuid FOR UPDATE`;
			const existing = await this.findRunByIdempotencyKey(transaction, request);
			if (existing) {
				if (existing.requestFingerprint !== request.requestFingerprint) {
					throw new ConflictException({
						code: HTTP_ERROR_CODE.JOB_CONFLICT,
						message: HTTP_ERROR_MESSAGE.JOB_CONFLICT,
						retryable: false,
					});
				}
				return existing;
			}

			await this.assertProjectIdle(transaction, request);
			return transaction.jobRun.create({ data: request });
		});
	}

	private async findRunByIdempotencyKey(
		storage: Pick<Prisma.TransactionClient, 'jobRun'>,
		request: IJobRequest,
	) {
		return storage.jobRun.findUnique({
			where: {
				ownerId_type_idempotencyKey: {
					ownerId: request.ownerId,
					type: request.type,
					idempotencyKey: request.idempotencyKey,
				},
			},
		});
	}

	private async assertProjectIdle(
		transaction: Prisma.TransactionClient,
		request: IJobRequest,
	): Promise<void> {
		const active = await transaction.jobRun.findFirst({
			where: {
				ownerId: request.ownerId,
				projectId: request.projectId,
				state: { in: ['queued', 'running'] },
			},
		});
		if (active) {
			throw new ConflictException({
				code: HTTP_ERROR_CODE.JOB_CONFLICT,
				message: HTTP_ERROR_MESSAGE.JOB_CONFLICT,
				retryable: false,
			});
		}
	}

	private async findAutomaticReview(run: JobRun) {
		if (run.type !== 'sync' || !run.generateReview) {
			return null;
		}

		return this.database.client.jobRun.findFirst({
			where: { sourceSyncRunId: run.id, trigger: 'automatic', type: 'review' },
			select: { id: true, state: true },
		});
	}

	private async collectRunCounts(run: JobRun): Promise<TJobView['counts']> {
		const db = this.database.client;
		const saved =
			run.type === 'sync' ? await db.taskSnapshot.count({ where: { syncRunId: run.id } }) : 0;
		const read =
			run.type === 'sync'
				? await db.taskSnapshot.count({
						where: { syncRunId: run.id, detailStatus: { not: 'pending' } },
					})
				: 0;
		const target =
			run.type === 'sync'
				? saved
				: await db.taskSnapshot.count({
						where: {
							syncRunId: run.sourceSyncRunId!,
							assignees: { array_contains: [run.subjectSourceUserId] },
						},
					});
		const batches = await db.analysisBatch.count({ where: { runId: run.id, level: 0 } });

		return {
			discovered: saved,
			read,
			saved,
			batches,
			totalBatches: Math.ceil(target / 10),
			targetTasks: target,
		};
	}

	private getResultReference(run: JobRun): string | null {
		if (run.currentReviewReportId !== null) {
			return run.currentReviewReportId;
		}
		if (run.state === 'succeeded' || run.state === 'partial') {
			return run.sourceSyncRunId ?? run.id;
		}

		return null;
	}
}
