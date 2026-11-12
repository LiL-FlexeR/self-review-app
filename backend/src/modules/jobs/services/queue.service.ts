import { Inject, Injectable } from '@nestjs/common';
import type { OnModuleInit, OnApplicationShutdown } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ConfigService } from '@app/shared/config/config.service';
import { DatabaseService } from '@app/shared/database/database.service';
import { AppLogger } from '@app/shared/logging/logger';
import { json } from '@app/utils/json';

const logger = new AppLogger('QueueService');

@Injectable()
export class QueueService implements OnModuleInit, OnApplicationShutdown {
	readonly queue: Queue;
	private timer?: ReturnType<typeof setInterval>;
	constructor(
		@Inject(ConfigService) configuration: ConfigService,
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
			const saved = await db.taskSnapshot.count({ where: { syncRunId: run.id } });
			const recovered = await db.$transaction(async (transaction) => {
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
						error: { code: 'RUN_INTERRUPTED' },
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
									errorCode: 'RUN_INTERRUPTED',
								},
							]),
						},
					});
				}
				return true;
			});
			if (recovered) {
				logger.warn('run_interrupted', {
					runId: run.id,
					reason: 'RUN_INTERRUPTED',
					state: run.type === 'sync' && saved ? 'partial' : 'failed',
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
