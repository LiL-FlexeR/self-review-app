import { HTTP_ERROR_CODE, HTTP_ERROR_MESSAGE } from '@self-review/contracts';
import { BadRequestException } from '@nestjs/common';
import type { z as zod } from 'zod';

function parse<TResult>(schema: zod.ZodType<TResult>, value: unknown): TResult {
	const parsedResult = schema.safeParse(value);

	if (!parsedResult.success) {
		throw new BadRequestException({
			code: HTTP_ERROR_CODE.INPUT_INVALID,
			message: HTTP_ERROR_MESSAGE.INPUT_INVALID,
			retryable: false,
		});
	}

	return parsedResult.data;
}

export { parse };
