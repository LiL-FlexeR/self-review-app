import { it, expect, vi } from 'vitest';
import { Coordinator, ClientError, type TLock } from '@app/auth/coordinator';
import type { TIdentity } from '@self-review/contracts';

const one: TIdentity = {
	user: {
		id: '00000000-0000-4000-8000-000000000001',
		email: 'one@example.test',
	},
	sid: '00000000-0000-4000-8000-000000000002',
	accessExpiresAt: '2026-11-11T12:15:00.000Z',
	sessionExpiresAt: '2026-11-18T12:00:00.000Z',
	csrfToken: 'memory-only',
	mode: 'offline',
};

const two: TIdentity = {
	...one,
	user: {
		id: '00000000-0000-4000-8000-000000000003',
		email: 'two@example.test',
	},
	sid: '00000000-0000-4000-8000-000000000004',
};

function mutex(): TLock {
	let tail = Promise.resolve();

	return (work) => {
		const result = tail.then(work);

		tail = result.then(
			() => {},
			() => {},
		);

		return result;
	};
}

function setup() {
	let expired = false;
	let current = one;
	let refreshes = 0;
	let refreshError = 0;
	let dataCalls = 0;
	const calls: { path: string; init: RequestInit }[] = [];
	const clear = vi.fn();
	const response = (body: unknown, status = 200) =>
		new Response(JSON.stringify(body), { status });
	const error = (status: number, code: string) =>
		response(
			{
				error: { code, message: 'safe error', retryable: status === 503 },
				requestId: 'test',
			},
			status,
		);
	const transport = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
		const path = String(input);

		calls.push({ path, init });
		if (path === '/api/auth/csrf') {
			return response({
				userId: current.user.id,
				sid: current.sid,
				csrfToken: 'fresh-csrf',
			});
		}

		if (path === '/api/auth/refresh') {
			refreshes++;
			if (refreshError) {
				return error(refreshError, 'REFRESH_INVALID');
			}

			expired = false;

			return response(current);
		}

		if (path === '/api/auth/logout') {
			return response({ ok: true });
		}

		if (path === '/api/auth/me') {
			return expired ? error(401, 'ACCESS_EXPIRED') : response(current);
		}

		dataCalls++;

		return expired ? error(401, 'ACCESS_EXPIRED') : response({ owner: current.user.id });
	}) as typeof fetch;
	const client = new Coordinator(transport, mutex(), clear);

	return {
		client,
		clear,
		calls,
		transport,
		expire() {
			expired = true;
		},
		switch() {
			current = two;
		},
		rejectRefresh(status: number) {
			refreshError = status;
		},
		get refreshes() {
			return refreshes;
		},
		get dataCalls() {
			return dataCalls;
		},
	};
}

it('coordinates concurrent missing/expired requests and replays at most once', async () => {
	const scenario = setup();

	await scenario.client.initialize();
	scenario.expire();

	const results = await Promise.all([
		scenario.client.request('/data'),
		scenario.client.request('/data'),
	]);

	expect(scenario.refreshes).toBe(1);
	expect(results).toEqual([{ owner: one.user.id }, { owner: one.user.id }]);
	expect(scenario.dataCalls).toBe(4);
});

it('rechecks cookies under the lock when another tab already renewed', async () => {
	const scenario = setup();

	await scenario.client.initialize();
	await scenario.client.request('/data', {
		method: 'POST',
		body: '{"idempotencyKey":"exact","value":1}',
	});
	expect(scenario.refreshes).toBe(0);
	expect(scenario.calls.slice(-2).map((call) => call.path)).toEqual([
		'/api/auth/me',
		'/api/data',
	]);
	expect(scenario.calls.at(-1)!.init.body).toBe('{"idempotencyKey":"exact","value":1}');
});

it('rejects queued mutations for another user/session and clears the cache', async () => {
	const scenario = setup();

	await scenario.client.initialize();
	scenario.switch();
	await expect(
		scenario.client.request('/data', { method: 'POST', body: 'old command' }),
	).rejects.toMatchObject({ code: 'CONTEXT_CHANGED' });
	expect(scenario.dataCalls).toBe(0);
	expect(scenario.client.identity).toBeNull();
	expect(scenario.clear).toHaveBeenCalledTimes(2);
});

it('clears authentication on definitive refresh rejection and never retries refresh', async () => {
	const scenario = setup();

	await scenario.client.initialize();
	scenario.expire();
	scenario.rejectRefresh(401);
	await expect(scenario.client.request('/data')).rejects.toMatchObject({
		status: 401,
	});
	expect(scenario.refreshes).toBe(1);
	expect(scenario.client.identity).toBeNull();
	expect(scenario.dataCalls).toBe(1);
});

it('keeps identity and an explicit retry path on infrastructure failure', async () => {
	const scenario = setup();

	await scenario.client.initialize();
	scenario.expire();
	scenario.rejectRefresh(503);
	await expect(scenario.client.request('/data')).rejects.toMatchObject({
		status: 503,
	});
	expect(scenario.client.identity?.sid).toBe(one.sid);
	expect(scenario.refreshes).toBe(1);
});

it('does not recover arbitrary authentication failures or network errors', async () => {
	const clear = vi.fn();
	const fetcher = vi.fn(
		async () =>
			new Response(
				JSON.stringify({
					error: {
						code: 'ACCESS_INVALID',
						message: 'invalid',
						retryable: false,
					},
					requestId: 'x',
				}),
				{ status: 401 },
			),
	);
	const client = new Coordinator(fetcher, mutex(), clear);

	client.identity = one;
	await expect(client.request('/data')).rejects.toMatchObject({
		code: 'ACCESS_INVALID',
	});
	expect(fetcher).toHaveBeenCalledTimes(1);
});

it('discards late responses after account invalidation', async () => {
	let resolve!: (response: Response) => void;
	const clear = vi.fn();
	const client = new Coordinator(
		(() =>
			new Promise<Response>((resolveResponse) => {
				resolve = resolveResponse;
			})) as typeof fetch,
		mutex(),
		clear,
	);

	client.identity = one;

	const pending = client.request('/data');

	client.invalidate();
	resolve(new Response(JSON.stringify({ owner: one.user.id })));
	await expect(pending).rejects.toBeInstanceOf(ClientError);
	expect(clear).toHaveBeenCalledTimes(1);
});

it('retains exact mutation body across one permitted replay', async () => {
	const scenario = setup();

	await scenario.client.initialize();

	let calls = 0;
	const original = scenario.client.raw.bind(scenario.client);

	vi.spyOn(scenario.client, 'raw').mockImplementation(async (path, init, signal) => {
		if (path === '/data' && calls++ === 0) {
			throw new ClientError(401, 'ACCESS_EXPIRED', 'expired');
		}

		return original(path, init, signal);
	});

	const body = '{"idempotencyKey":"unchanged","selection":{"ids":[1,2]}}';

	await scenario.client.request('/data', { method: 'POST', body });
	expect(scenario.calls.at(-1)?.init.body).toBe(body);
	expect(calls).toBe(2);
});

it('serializes tabs through the same origin lock', async () => {
	const shared = mutex();
	let active = 0;
	let max = 0;

	await Promise.all(
		Array.from({ length: 4 }, () =>
			shared(async () => {
				active++;
				max = Math.max(max, active);
				await Promise.resolve();
				active--;
			}),
		),
	);
	expect(max).toBe(1);
});

it('does not let an old tab log out a newly switched account', async () => {
	const scenario = setup();

	await scenario.client.initialize();
	scenario.switch();
	await expect(scenario.client.logout()).rejects.toMatchObject({
		code: 'CONTEXT_CHANGED',
	});
	expect(scenario.calls.some((call) => call.path === '/api/auth/logout')).toBe(false);
	expect(scenario.client.identity).toBeNull();
});

it('calls the injected browser fetch without changing its receiver', async () => {
	const fetcher = function (this: unknown) {
		expect(this).toBeUndefined();

		return Promise.resolve(new Response(JSON.stringify(one)));
	} as typeof fetch;
	const client = new Coordinator(fetcher, mutex(), () => {});

	expect((await client.initialize())?.sid).toBe(one.sid);
});

it('does not broadcast an account change for an already anonymous bootstrap rejection', async () => {
	const broadcast = vi.fn();
	const fetcher = async () =>
		new Response(
			JSON.stringify({
				error: { code: 'ACCESS_MISSING', message: 'sign in', retryable: false },
				requestId: 'test',
			}),
			{ status: 401 },
		);
	const client = new Coordinator(fetcher, mutex(), () => {}, broadcast);

	expect(await client.initialize()).toBeNull();
	expect(broadcast).not.toHaveBeenCalled();
});
