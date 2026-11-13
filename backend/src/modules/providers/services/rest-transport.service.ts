import { Injectable } from '@nestjs/common';
import type { TTrackerCredentials } from '@self-review/contracts';
import { JiraCredentials, LinearCredentials } from '@self-review/contracts';
import { ProviderError } from '@app/errors/provider.error';
import { LIMITS } from '@app/modules/agent/agent.schemas';

@Injectable()
export class RestTransport {
	async send(
		provider: 'clickup' | 'jira',
		credentials: TTrackerCredentials,
		path: string,
		query: Record<string, string> = {},
	): Promise<unknown> {
		// Only adapter-generated relative paths can reach the fixed provider gateway.
		if (!/^\/[a-zA-Z0-9_/-]+$/.test(path) || path.includes('//')) {
			throw new ProviderError('PROVIDER_SCOPE_CHANGED');
		}
		let base: string;
		let authorization: string;
		if (provider === 'jira') {
			const jira = JiraCredentials.parse(credentials);
			base = `https://api.atlassian.com/ex/jira/${jira.cloudId}/rest/api/3`;
			authorization = `Basic ${Buffer.from(`${jira.email}:${jira.token}`).toString('base64')}`;
		} else {
			base = 'https://api.clickup.com/api/v2';
			authorization = LinearCredentials.parse(credentials).token;
		}
		const url = new URL(base + path);
		url.search = new URLSearchParams(query).toString();
		for (let attempt = 0; attempt < 2; attempt++) {
			try {
				return await this.request(url, authorization);
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

	private async request(url: URL, authorization: string): Promise<unknown> {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), LIMITS.providerRequestMs);
		try {
			const response = await fetch(url, {
				headers: { Accept: 'application/json', Authorization: authorization },
				redirect: 'error',
				signal: controller.signal,
			});
			if (!response.ok) {
				await response.body?.cancel();
				if ([401, 403].includes(response.status)) {
					throw new ProviderError('PROVIDER_CREDENTIALS_INVALID');
				}
				if (response.status === 404) {
					throw new ProviderError('PROVIDER_SCOPE_CHANGED');
				}
				if (response.status === 429) {
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
			try {
				return JSON.parse(Buffer.concat(chunks).toString('utf8'));
			} catch {
				throw new ProviderError('PROVIDER_RESPONSE_INVALID');
			}
		} finally {
			clearTimeout(timeout);
		}
	}
}
