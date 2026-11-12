import { Inject, Injectable } from '@nestjs/common';
import type { OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ConfigService } from '@app/shared/config/config.service';
import { AppLogger } from '@app/shared/logging/logger';

const logger = new AppLogger('RedisService');

@Injectable()
export class RedisService implements OnModuleInit, OnApplicationShutdown {
	readonly client: Redis;

	constructor(@Inject(ConfigService) configuration: ConfigService) {
		this.client = new Redis(configuration.get('REDIS_URL'), {
			maxRetriesPerRequest: 1,
			enableOfflineQueue: false,
			lazyConnect: true,
			connectTimeout: 3000,
		});
		this.client.on('error', (error) => {
			logger.error('redis_connection_failed', { error });
		});
	}

	async onModuleInit() {
		if (this.client.status === 'wait') {
			await this.client.connect();
		}
	}

	onApplicationShutdown() {
		this.client.disconnect();
	}
}
