import type { z as zod } from 'zod';
import { auth } from '@app/auth/session';

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
