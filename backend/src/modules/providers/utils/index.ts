import { z as zod } from 'zod';
import { ProviderError } from '@app/errors/provider.error';
import { LIMITS } from '@app/modules/agent/agent.schemas';
import { excerpt } from '@app/utils/excerpt';

export function validateProvider<TResult>(schema: zod.ZodType<TResult>, value: unknown): TResult {
	const result = schema.safeParse(value);
	if (!result.success) {
		throw new ProviderError('PROVIDER_RESPONSE_INVALID');
	}
	return result.data;
}

export function sourceText(value: string) {
	return value.replace(/\r\n/g, '\n').replace(/\0/g, '');
}

export function metadata(value: string) {
	const normalized = sourceText(value);
	if (Buffer.byteLength(normalized) > LIMITS.sourceFieldBytes) {
		throw new ProviderError('PROVIDER_FIELD_LIMIT');
	}
	return normalized;
}

export function taskFields(identifier: string, title: string, state: string) {
	return {
		identifier: excerpt(sourceText(identifier), LIMITS.sourceFieldBytes),
		title: excerpt(sourceText(title), LIMITS.sourceFieldBytes),
		state: excerpt(sourceText(state), LIMITS.sourceFieldBytes),
		hasTruncatedFields: [identifier, title, state].some(
			(value) => Buffer.byteLength(value) > LIMITS.sourceFieldBytes,
		),
	};
}

export function parseCursor<TResult>(schema: zod.ZodType<TResult>, cursor: string): TResult {
	try {
		return validateProvider(schema, JSON.parse(cursor));
	} catch {
		throw new ProviderError('PAGINATION_LOOP');
	}
}

export function numericOffset(cursor: string | null) {
	return cursor === null
		? 0
		: validateProvider(
				zod.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
				cursor,
			);
}
