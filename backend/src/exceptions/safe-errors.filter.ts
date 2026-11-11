import { Catch, HttpException, HttpStatus } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { ApiError, HTTP_ERROR_CODE, HTTP_ERROR_MESSAGE } from '@self-review/contracts';
import type { TApiError } from '@self-review/contracts';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';

@Catch()
export class SafeErrorsFilter implements ExceptionFilter {
	catch(error: unknown, host: ArgumentsHost) {
		const res = host.switchToHttp().getResponse<Response>();
		let status = HttpStatus.SERVICE_UNAVAILABLE;
		let publicError: TApiError['error'] = {
			code: HTTP_ERROR_CODE.INFRASTRUCTURE_UNAVAILABLE,
			message: HTTP_ERROR_MESSAGE.INFRASTRUCTURE_UNAVAILABLE,
			retryable: true,
		};

		if (error instanceof HttpException) {
			status = error.getStatus();

			// Only intentionally structured public payloads are exposed. Raw Nest,
			// validation, provider, and database error bodies must not pass through.
			const parsedResponse = ApiError.shape.error.safeParse(error.getResponse());

			publicError = parsedResponse.success
				? parsedResponse.data
				: {
						code: HTTP_ERROR_CODE.HTTP_ERROR,
						message: HTTP_ERROR_MESSAGE.HTTP_ERROR,
						retryable: false,
					};
		}

		res.status(status).json({
			error: publicError,
			requestId: randomUUID(),
		});
	}
}
