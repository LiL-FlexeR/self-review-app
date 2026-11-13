import type { z as zod } from 'zod';
import { auth } from '@app/auth/session';
import { ClientError } from '@app/auth/coordinator';

export function canRetainSavedRead(error: Error | null) {
	return (
		!error ||
		(error instanceof ClientError && error.retryable && ![401, 403, 404].includes(error.status))
	);
}

export async function read<TResult>(
	path: string,
	schema: zod.ZodType<TResult>,
	signal?: AbortSignal,
) {
	return schema.parse(await auth.request(path, { signal }));
}
export async function command<TResult>(path: string, body: object, schema: zod.ZodType<TResult>) {
	return schema.parse(await auth.request(path, { method: 'POST', body: JSON.stringify(body) }));
}
