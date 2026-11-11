import { Inject, Injectable } from '@nestjs/common';
import type { OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@app/shared/config/config.service';
import { database } from './database.js';
import type { TDatabase } from './database.js';

@Injectable()
export class DatabaseService implements OnModuleInit, OnApplicationShutdown {
	readonly client: TDatabase;

	constructor(@Inject(ConfigService) configuration: ConfigService) {
		this.client = database(configuration.get('DATABASE_URL'));
	}

	async onModuleInit() {
		await this.client.$connect();
	}

	async onApplicationShutdown() {
		await this.client.$disconnect();
	}
}
