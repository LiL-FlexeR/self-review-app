import { createApp } from './app.js';
import { ConfigService } from '@app/shared/config/config.service';
import { AppLogger, flushLogs, setLogService } from '@app/shared/logging/logger';

setLogService('api');
const logger = new AppLogger('ApiBootstrap');

try {
	const app = await createApp();
	app.enableShutdownHooks();

	try {
		await app.listen(app.get(ConfigService).get('PORT'), '0.0.0.0');
	} catch (error) {
		logger.error('api_listen_failed', { error });
		await app.close();
		throw error;
	}

	logger.info('api_ready', { port: app.get(ConfigService).get('PORT') });
} catch (error) {
	logger.error('api_startup_failed', { error });
	await flushLogs();
	process.exitCode = 1;
}
