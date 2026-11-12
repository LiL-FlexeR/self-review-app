import type { LoggerService } from '@nestjs/common';
import { AppLogger } from './logger.js';

const logger = new AppLogger('Nest');

// Nest messages can contain raw provider/DI errors. Only the safe error summary
// crosses this adapter; detailed operation context comes from application logs.
function errorFrom(message: unknown, parameters: unknown[]) {
	return message instanceof Error
		? message
		: parameters.find((parameter) => parameter instanceof Error);
}

export const nestLogger: LoggerService = {
	log(message: unknown, ...parameters: unknown[]) {
		logger.debug('nest_log', { error: errorFrom(message, parameters) });
	},
	error(message: unknown, ...parameters: unknown[]) {
		logger.error('nest_error', { error: errorFrom(message, parameters) });
	},
	warn(message: unknown, ...parameters: unknown[]) {
		logger.warn('nest_warning', { error: errorFrom(message, parameters) });
	},
	debug(message: unknown, ...parameters: unknown[]) {
		logger.debug('nest_debug', { error: errorFrom(message, parameters) });
	},
	verbose(message: unknown, ...parameters: unknown[]) {
		logger.debug('nest_verbose', { error: errorFrom(message, parameters) });
	},
	fatal(message: unknown, ...parameters: unknown[]) {
		logger.error('nest_fatal', { error: errorFrom(message, parameters) });
	},
};
