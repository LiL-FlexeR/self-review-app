import { Inject, Injectable } from '@nestjs/common';
import type { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { rmSync, writeFileSync } from 'node:fs';
import { DatabaseService } from '@app/shared/database/database.service';
import { RedisService } from '@app/shared/redis/redis.service';

export const WORKER_READY_FILE = '/tmp/self-review-worker-ready';

@Injectable()
export class WorkerReadinessService implements OnApplicationBootstrap, OnApplicationShutdown {
	private alive?: ReturnType<typeof setInterval>;

	constructor(
		@Inject(DatabaseService) private readonly database: DatabaseService,
		@Inject(RedisService) private readonly redis: RedisService,
	) {}

	async onApplicationBootstrap() {
		await this.database.client.$queryRaw`SELECT 1`;
		await this.redis.client.ping();
		writeFileSync(WORKER_READY_FILE, 'ready');
		this.alive = setInterval(() => {}, 60000);
		console.info('Foundation worker ready; no job processors in S01');
	}

	onApplicationShutdown() {
		if (this.alive) {
			clearInterval(this.alive);
		}
		rmSync(WORKER_READY_FILE, { force: true });
	}
}
