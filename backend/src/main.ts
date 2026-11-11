import { createApp } from './app.js';
import { ConfigService } from '@app/shared/config/config.service';

try {
	const app = await createApp();
	app.enableShutdownHooks();

	try {
		await app.listen(app.get(ConfigService).get('PORT'), '0.0.0.0');
	} catch (error) {
		await app.close();
		throw error;
	}

	console.info('Self Review API ready');
} catch {
	console.error('Self Review API startup failed. Check configuration and dependencies.');
	process.exitCode = 1;
}
