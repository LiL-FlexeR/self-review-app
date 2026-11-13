import { Inject, Injectable } from '@nestjs/common';
import type { OnModuleInit, OnApplicationShutdown } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ConfigService } from '@app/shared/config/config.service';
import { DatabaseService } from '@app/shared/database/database.service';
import { AppLogger } from '@app/shared/logging/logger';
import { json } from '@app/utils/json';
import { aggregateUsage } from '@app/modules/agent/utils/usage';
import { z as zod } from 'zod';

const logger = new AppLogger('QueueService');

@Injectable()
export class QueueService implements OnModuleInit, OnApplicationShutdown {
	readonly queue: Queue;
	private timer?: ReturnType<typeof setInterval>;
	constructor(
		@Inject(ConfigService) private readonly configuration: ConfigService,
		@Inject(DatabaseService) private readonly database: DatabaseService,
	) {
		this.queue = new Queue('workflow', {
			connection: { url: configuration.get('REDIS_URL'), maxRetriesPerRequest: 1 },
			prefix: configuration.get('REDIS_PREFIX') + 'jobs',
			defaultJobOptions: { attempts: 1, removeOnComplete: 1000, removeOnFail: 1000 },
		});
		this.queue.on('error', (error) => logger.error('queue_connection_failed', { error }));
	}

	async enqueue(runId: string) {
		try {
			await this.queue.add('execute', { runId }, { jobId: runId });
		} catch (error) {
			logger.error('enqueue_failed', { error, runId });
			// An uncertain enqueue retains the durable command for reconciliation.
			await this.database.client.jobRun.updateMany({
				where: { id: runId, state: 'queued' },
				data: { error: { code: 'ENQUEUE_PENDING' }, version: { increment: 1 } },
			});
		}
	}

	async reconcile() {
		const db = this.database.client;
		const queued = await db.jobRun.findMany({
			where: { state: 'queued', createdAt: { lt: new Date(Date.now() - 30000) } },
			select: { id: true },
		});
		for (const run of queued) {
			await this.enqueue(run.id);
		}
		const interrupted = await db.jobRun.findMany({
			where: {
				state: 'running',
				OR: [
					{ heartbeatAt: { lt: new Date(Date.now() - 45000) } },
					{ unitDeadlineAt: { lt: new Date() } },
				],
			},
			select: { id: true, type: true },
		});
		for (const run of interrupted) {
			const recovered = await db.$transaction(async (transaction) => {
				// The run lock also fences late source/model writes using inRunningRun.
				const rows = await transaction.$queryRaw<
					{
						unit_deadline_at: Date | null;
						coverage: unknown;
						generate_review: boolean;
						import_complete: boolean;
					}[]
				>`SELECT unit_deadline_at, coverage, generate_review, import_complete FROM job_runs WHERE id=${run.id}::uuid FOR UPDATE`;
				const current = rows[0];
				const code =
					current?.unit_deadline_at && current.unit_deadline_at < new Date()
						? 'UNIT_TIMEOUT'
						: 'RUN_INTERRUPTED';
				const saved = await transaction.taskSnapshot.count({
					where: { syncRunId: run.id },
				});
				const incompleteReads = await transaction.taskSnapshot.count({
					where: {
						syncRunId: run.id,
						OR: [
							{ detailStatus: { in: ['pending', 'unavailable', 'truncated'] } },
							{ refreshStatus: 'stale' },
							{ commentReadState: { in: ['failed', 'truncated'] } },
						],
					},
				});
				const changed = await transaction.jobRun.updateMany({
					where: {
						id: run.id,
						state: 'running',
						OR: [
							{ heartbeatAt: { lt: new Date(Date.now() - 45000) } },
							{ unitDeadlineAt: { lt: new Date() } },
						],
					},
					data: {
						state: run.type === 'sync' && saved ? 'partial' : 'failed',
						stage: 'finished',
						finishedAt: new Date(),
						error: { code },
						analysisComplete: false,
						importComplete: Boolean(current?.import_complete) && incompleteReads === 0,
						coverage: json({
							...zod
								.record(zod.string(), zod.unknown())
								.parse(current?.coverage ?? {}),
							...(current?.generate_review
								? { autoReview: 'skipped: sync interrupted' }
								: {}),
						}),
						version: { increment: 1 },
					},
				});
				if (!changed.count) {
					return false;
				}
				await transaction.modelAttempt.updateMany({
					where: { runId: run.id, status: 'submitted' },
					data: { status: 'interrupted', usageUnknown: true },
				});
				const attempts = await transaction.modelAttempt.findMany({
					where: { runId: run.id },
				});
				await transaction.jobRun.update({
					where: { id: run.id },
					data: {
						usage: json(aggregateUsage(this.configuration.get('APP_MODE'), attempts)),
					},
				});
				const batches = await transaction.analysisBatch.findMany({
					where: { runId: run.id, state: { in: ['pending', 'running'] } },
					select: { id: true, trace: true },
				});
				for (const batch of batches) {
					await transaction.analysisBatch.update({
						where: { id: batch.id },
						data: {
							state: 'failed',
							trace: json([
								...(Array.isArray(batch.trace) ? batch.trace.slice(0, 99) : []),
								{
									event: 'unit_interrupted',
									timestamp: new Date().toISOString(),
									errorCode: code,
								},
							]),
						},
					});
				}
				return { code, state: run.type === 'sync' && saved ? 'partial' : 'failed' };
			});
			if (recovered) {
				logger.warn('run_interrupted', {
					runId: run.id,
					reason: recovered.code,
					state: recovered.state,
				});
			}
		}
	}

	async onModuleInit() {
		await this.reconcileSafely();
		this.timer = setInterval(() => {
			void this.reconcileSafely();
		}, 30000);
		this.timer.unref();
	}

	private async reconcileSafely(): Promise<void> {
		try {
			await this.reconcile();
		} catch (error) {
			// Readiness and endpoint errors report unavailable storage; recovery retries later.
			logger.error('queue_reconciliation_failed', { error });
		}
	}

	async onApplicationShutdown() {
		clearInterval(this.timer);
		await this.queue.close();
	}
}
