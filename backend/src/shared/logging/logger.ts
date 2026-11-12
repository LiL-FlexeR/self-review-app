import { AsyncLocalStorage } from 'node:async_hooks';
import { once } from 'node:events';
import winston from 'winston';
import type { ILogContext, ILogFields } from './logging.interfaces.js';
import { safeLogFields } from './logging.utils.js';

const contexts = new AsyncLocalStorage<ILogContext>();
let service: 'api' | 'worker' | 'backend' = 'backend';

export function createLogWriter(
	options: Pick<winston.LoggerOptions, 'transports' | 'silent'> = {},
) {
	const level = ['error', 'warn', 'info', 'debug'].includes(process.env.LOG_LEVEL ?? '')
		? process.env.LOG_LEVEL
		: 'info';
	return winston.createLogger({
		level,
		format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
		transports: [new winston.transports.Console({ stderrLevels: ['error'] })],
		...options,
	});
}

const output = createLogWriter({ silent: process.env.NODE_ENV === 'test' });

export class AppLogger {
	constructor(
		private readonly context: string,
		private readonly writer = output,
	) {}

	info(event: string, fields: ILogFields = {}) {
		this.write('info', event, fields);
	}

	warn(event: string, fields: ILogFields = {}) {
		this.write('warn', event, fields);
	}

	error(event: string, fields: ILogFields = {}) {
		this.write('error', event, fields);
	}

	debug(event: string, fields: ILogFields = {}) {
		this.write('debug', event, fields);
	}

	private write(level: string, event: string, fields: ILogFields) {
		this.writer.log(level, /^[a-z][a-z0-9_]{0,79}$/.test(event) ? event : 'application_event', {
			...safeLogFields({ ...contexts.getStore(), ...fields }),
			service,
			context: this.context,
		});
	}
}

export function setLogService(value: 'api' | 'worker') {
	service = value;
}

export function withLogContext<TResult>(context: ILogContext, operation: () => TResult): TResult {
	return contexts.run({ ...contexts.getStore(), ...context }, operation);
}

export function getLogContext(): Readonly<ILogContext> | undefined {
	return contexts.getStore();
}

export async function flushLogs(): Promise<void> {
	const finished = once(output, 'finish');
	output.end();
	await finished;
}
