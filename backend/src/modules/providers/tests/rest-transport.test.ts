import { afterEach, expect, it, vi } from 'vitest';
import { RestTransport } from '@app/modules/providers/services/rest-transport.service';
import { LIMITS } from '@app/modules/agent/agent.schemas';

const credentials = {
	email: 'synthetic@example.test',
	token: 'synthetic-token',
	cloudId: '11111111-1111-4111-8111-111111111111',
};

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

it('routes scoped Jira credentials only through the fixed gateway and ClickUp through its fixed API', async () => {
	const fetcher = vi.fn().mockImplementation(async () => Response.json({ ok: true }));
	vi.stubGlobal('fetch', fetcher);
	const transport = new RestTransport();
	await transport.send('jira', credentials, '/myself');
	await transport.send('clickup', { token: credentials.token }, '/user');
	const [jiraUrl, jiraOptions] = fetcher.mock.calls[0]! as [URL, RequestInit];
	expect(jiraUrl.href).toBe(
		`https://api.atlassian.com/ex/jira/${credentials.cloudId}/rest/api/3/myself`,
	);
	expect(jiraOptions).toMatchObject({
		redirect: 'error',
		headers: {
			Authorization: `Basic ${Buffer.from(`${credentials.email}:${credentials.token}`).toString('base64')}`,
		},
	});
	expect((fetcher.mock.calls[1]![0] as URL).href).toBe('https://api.clickup.com/api/v2/user');
	await expect(transport.send('jira', credentials, '//attacker.example')).rejects.toMatchObject({
		code: 'PROVIDER_SCOPE_CHANGED',
	});
	expect(fetcher).toHaveBeenCalledTimes(2);
});

it.each([
	[401, 'PROVIDER_CREDENTIALS_INVALID'],
	[403, 'PROVIDER_CREDENTIALS_INVALID'],
	[404, 'PROVIDER_SCOPE_CHANGED'],
	[429, 'PROVIDER_RATE_LIMITED'],
])('keeps HTTP %s explicit without retrying or exposing response text', async (status, code) => {
	const fetcher = vi
		.fn()
		.mockImplementation(
			async () => new Response('private provider body', { status: Number(status) }),
		);
	vi.stubGlobal('fetch', fetcher);
	await expect(
		new RestTransport().send('clickup', { token: 'synthetic' }, '/user'),
	).rejects.toMatchObject({ code, message: code });
	expect(fetcher).toHaveBeenCalledOnce();
});

it('retries transient errors once, rejects malformed JSON and bounds streamed response bytes', async () => {
	const fetcher = vi
		.fn()
		.mockResolvedValueOnce(new Response('', { status: 503 }))
		.mockResolvedValueOnce(Response.json({ ok: true }));
	vi.stubGlobal('fetch', fetcher);
	const transport = new RestTransport();
	expect(await transport.send('clickup', { token: 'synthetic' }, '/user')).toEqual({ ok: true });
	expect(fetcher).toHaveBeenCalledTimes(2);
	fetcher.mockResolvedValueOnce(new Response('invalid'));
	await expect(transport.send('clickup', { token: 'synthetic' }, '/user')).rejects.toMatchObject({
		code: 'PROVIDER_RESPONSE_INVALID',
	});
	const cancel = vi.fn();
	fetcher.mockResolvedValueOnce(
		new Response(
			new ReadableStream({
				start(controller) {
					controller.enqueue(new Uint8Array(LIMITS.providerResponseBytes + 1));
				},
				cancel,
			}),
		),
	);
	await expect(transport.send('clickup', { token: 'synthetic' }, '/user')).rejects.toMatchObject({
		code: 'PROVIDER_RESPONSE_LIMIT',
	});
	expect(cancel).toHaveBeenCalledOnce();
});

it('bounds stalled response retries with the provider deadline', async () => {
	vi.useFakeTimers();
	const fetcher = vi
		.fn()
		.mockImplementation(
			(_url, options: RequestInit) =>
				new Promise((_resolve, reject) =>
					options.signal?.addEventListener('abort', () => reject(new Error('timeout'))),
				),
		);
	vi.stubGlobal('fetch', fetcher);
	const pending = expect(
		new RestTransport().send('clickup', { token: 'synthetic' }, '/user'),
	).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
	await vi.advanceTimersByTimeAsync(LIMITS.providerRequestMs * 2);
	await pending;
	expect(fetcher).toHaveBeenCalledTimes(2);
});
