import 'reflect-metadata';
import { rmSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from '@app/modules/worker.module';
import { WORKER_READY_FILE } from '@app/modules/worker/worker-readiness.service';

rmSync(WORKER_READY_FILE, { force: true });

try {
	const app = await NestFactory.createApplicationContext(WorkerModule, {
		logger: false,
		abortOnError: false,
	});
	app.enableShutdownHooks();
} catch {
	console.error('Workflow worker startup failed. Check configuration and dependencies.');
	process.exit(1);
}
