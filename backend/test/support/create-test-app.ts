import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ExpressAdapter } from '@nestjs/platform-express';
import type { Redis } from 'ioredis';
import { configureHttpApplication } from '@app/app';
import { JobsModule } from '@app/modules/jobs/jobs.module';
import { ProcessorService } from '@app/modules/jobs/services/processor.service';
import { AppModule } from '@app/modules/app.module';
import { AuthService } from '@app/modules/auth/services/auth.service';
import type { TConfig } from '@app/shared/config/config.schema';
import { ConfigService } from '@app/shared/config/config.service';
import type { TDatabase } from '@app/shared/database/database';
import { DatabaseService } from '@app/shared/database/database.service';
import { RedisService } from '@app/shared/redis/redis.service';
import type { IMail } from '@app/shared/mail/mail';
import { MailService } from '@app/shared/mail/mail.service';
import { ClockService } from '@app/shared/clock/clock.service';

export interface IRuntime {
	app: INestApplication;
	auth: AuthService;
	db: TDatabase;
	redis: Redis;
	close(): Promise<void>;
}

interface ITestAppOptions {
	config?: TConfig;
	worker?: boolean;
	db?: TDatabase;
	redis?: Redis;
	mail?: IMail;
	now?: () => Date;
	staticDir?: string;
}

export async function createTestApp(options: ITestAppOptions = {}): Promise<IRuntime> {
	const builder = Test.createTestingModule({
		imports: [AppModule, ...(options.worker ? [JobsModule] : [])],
		providers: options.worker ? [ProcessorService] : [],
	});
	const configuration = options.config;

	if (configuration) {
		builder.overrideProvider(ConfigService).useValue({
			values: configuration,
			get<TKey extends keyof TConfig>(key: TKey): TConfig[TKey] {
				return configuration[key];
			},
		} satisfies ConfigService);
	}

	// Borrowed clients have no owner lifecycle hooks in this application context.
	// Closing a failure-case app must not disconnect the main fixture's storage.
	if (options.db) {
		builder.overrideProvider(DatabaseService).useValue({ client: options.db });
	}

	if (options.redis) {
		builder.overrideProvider(RedisService).useValue({ client: options.redis });
	}

	if (options.mail) {
		builder.overrideProvider(MailService).useValue(options.mail);
	}

	if (options.now) {
		builder.overrideProvider(ClockService).useValue({ now: options.now });
	}

	const module = await builder.compile();
	const app = module.createNestApplication(new ExpressAdapter(), { logger: false });

	try {
		configureHttpApplication(app, options.staticDir);
		await app.init();

		return {
			app,
			auth: app.get(AuthService),
			db: app.get(DatabaseService).client,
			redis: app.get(RedisService).client,
			close: () => app.close(),
		};
	} catch (error) {
		await app.close();
		throw error;
	}
}
