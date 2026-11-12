import 'reflect-metadata';
import { rmSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from '@app/modules/worker.module';
import { WORKER_READY_FILE } from '@app/modules/worker/worker-readiness.service';
import { AppLogger, flushLogs, setLogService } from '@app/shared/logging/logger';
import { nestLogger } from '@app/shared/logging/nest-logger';

setLogService('worker');
const logger = new AppLogger('WorkerBootstrap');

rmSync(WORKER_READY_FILE, { force: true });

try {
	const app = await NestFactory.createApplicationContext(WorkerModule, {
		logger: nestLogger,
		abortOnError: false,
	});
	app.enableShutdownHooks();
} catch (error) {
	logger.error('worker_startup_failed', { error });
	await flushLogs();
	process.exit(1);
}
