import { Injectable } from '@nestjs/common';
import { z as zod } from 'zod';
import { ProviderError } from '@app/errors/provider.error';
import { LIMITS } from '@app/modules/agent/agent.schemas';

const Envelope = zod.object({
	data: zod.unknown().optional(),
	errors: zod
		.array(
			zod.object({
				extensions: zod
					.object({ code: zod.string().optional(), type: zod.string().optional() })
					.passthrough()
					.optional(),
			}),
		)
		.optional(),
});

@Injectable()
export class LinearTransport {
	async send(token: string, query: string, variables: object): Promise<unknown> {
		for (let attempt = 0; attempt < 2; attempt++) {
			try {
				return await this.request(token, query, variables);
			} catch (error) {
				const failure =
					error instanceof ProviderError
						? error
						: new ProviderError('PROVIDER_UNAVAILABLE', true);
				if (
					!failure.retryable ||
					failure.code === 'PROVIDER_RATE_LIMITED' ||
					attempt === 1
				) {
					throw failure;
				}
			}
		}
		throw new ProviderError('PROVIDER_UNAVAILABLE', true);
	}

	private async request(token: string, query: string, variables: object): Promise<unknown> {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), LIMITS.providerRequestMs);
		try {
			const response = await fetch('https://api.linear.app/graphql', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: token },
				body: JSON.stringify({ query, variables }),
				redirect: 'error',
				signal: controller.signal,
			});
			if (!response.ok) {
				await response.body?.cancel();
				if (response.status === 401 || response.status === 403) {
					throw new ProviderError('PROVIDER_CREDENTIALS_INVALID');
				}
				if (response.status === 429) {
					// Do not retry before an unknown/long rate-limit reset.
					throw new ProviderError('PROVIDER_RATE_LIMITED', true);
				}
				throw new ProviderError('PROVIDER_UNAVAILABLE', response.status >= 500);
			}
			const reader = response.body?.getReader();
			if (!reader) {
				throw new ProviderError('PROVIDER_RESPONSE_INVALID');
			}
			const chunks: Uint8Array[] = [];
			let bytes = 0;
			while (true) {
				const { done, value } = await reader.read();
				if (done) {
					break;
				}
				bytes += value.byteLength;
				if (bytes > LIMITS.providerResponseBytes) {
					await reader.cancel();
					throw new ProviderError('PROVIDER_RESPONSE_LIMIT');
				}
				chunks.push(value);
			}
			let payload: unknown;
			try {
				payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
			} catch {
				throw new ProviderError('PROVIDER_RESPONSE_INVALID');
			}
			const parsed = Envelope.safeParse(payload);
			if (!parsed.success) {
				throw new ProviderError('PROVIDER_RESPONSE_INVALID');
			}
			if (parsed.data.errors?.length) {
				const codes = parsed.data.errors.flatMap((error) => [
					error.extensions?.code,
					error.extensions?.type,
				]);
				if (
					codes.some(
						(code) =>
							code &&
							[
								'UNAUTHENTICATED',
								'AUTHENTICATION_ERROR',
								'FORBIDDEN',
								'AUTHORIZATION_ERROR',
								'authentication error',
								'authorization error',
							].includes(code),
					)
				) {
					throw new ProviderError('PROVIDER_CREDENTIALS_INVALID');
				}
				if (codes.includes('RATELIMITED') || codes.includes('rate limited')) {
					throw new ProviderError('PROVIDER_RATE_LIMITED', true);
				}
				if (codes.includes('INTERNAL_SERVER_ERROR')) {
					throw new ProviderError('PROVIDER_UNAVAILABLE', true);
				}
				throw new ProviderError('PROVIDER_RESPONSE_INVALID');
			}
			return parsed.data.data;
		} finally {
			clearTimeout(timeout);
		}
	}
}
