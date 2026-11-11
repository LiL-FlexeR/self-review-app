import type { TIdentity } from '@self-review/contracts';
import {
	ApiError,
	Csrf,
	Identity,
	HTTP_ERROR_CODE,
	HTTP_ERROR_MESSAGE,
} from '@self-review/contracts';

export class ClientError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		message: string,
		readonly retryable = false,
	) {
		super(message);
	}
}

export type TLock = <TResult>(work: () => Promise<TResult>) => Promise<TResult>;

export const browserLock: TLock = async (work) => {
	if (!navigator.locks) {
		throw new ClientError(
			0,
			'BROWSER_UNSUPPORTED',
			'Use a browser with Web Locks on localhost or HTTPS.',
		);
	}

	const abort = new AbortController();
	const timer = setTimeout(() => abort.abort(), 8000);

	try {
		return await navigator.locks.request(
			'self-review-auth',
			{ signal: abort.signal },
			async () => {
				clearTimeout(timer);

				return work();
			},
		);
	} catch (error) {
		if (abort.signal.aborted) {
			throw new ClientError(
				0,
				'AUTH_LOCK_TIMEOUT',
				'Another tab is changing the session. Please retry.',
				true,
			);
		}

		throw error;
	} finally {
		clearTimeout(timer);
	}
};

const same = (previousIdentity: TIdentity | null, nextIdentity: TIdentity | null) =>
	previousIdentity?.user.id === nextIdentity?.user.id &&
	previousIdentity?.sid === nextIdentity?.sid;

const recoverable = (error: unknown) =>
	error instanceof ClientError &&
	error.status === 401 &&
	[HTTP_ERROR_CODE.ACCESS_MISSING, HTTP_ERROR_CODE.ACCESS_EXPIRED].some(
		(code) => code === error.code,
	);

export class Coordinator {
	identity: TIdentity | null = null;
	private epoch = 0;
	private controller = new AbortController();
	private listeners = new Set<() => void>();

	constructor(
		readonly transport: typeof fetch,
		readonly lock: TLock,
		readonly clear: () => void,
		readonly broadcast: () => void = () => {},
	) {}

	subscribe = (fn: () => void) => {
		this.listeners.add(fn);

		return () => {
			this.listeners.delete(fn);
		};
	};
	snapshot = () => this.identity;

	private set(next: TIdentity | null, force = false) {
		if (force || !same(this.identity, next)) {
			this.epoch++;
			this.controller.abort();
			this.controller = new AbortController();
			this.clear();
		}

		this.identity = next;
		for (const listener of this.listeners) {
			listener();
		}
	}

	invalidate() {
		this.set(null, true);
	}

	async raw(path: string, init: RequestInit = {}, signal?: AbortSignal): Promise<unknown> {
		const timeout = AbortSignal.timeout(15000);
		let response: Response;
		const transport = this.transport;

		try {
			response = await transport('/api' + path, {
				...init,
				credentials: 'same-origin',
				signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
				headers: {
					...(init.body ? { 'Content-Type': 'application/json' } : {}),
					...init.headers,
				},
			});
		} catch {
			if (signal?.aborted) {
				throw new ClientError(0, 'CONTEXT_CHANGED', 'Session changed.');
			}

			throw new ClientError(
				0,
				'NETWORK_UNAVAILABLE',
				'Connection unavailable. Please retry.',
				true,
			);
		}

		const body: unknown = await response.json();

		if (!response.ok) {
			const parsedError = ApiError.safeParse(body);

			throw new ClientError(
				response.status,
				parsedError.success ? parsedError.data.error.code : 'REQUEST_FAILED',
				parsedError.success ? parsedError.data.error.message : 'Request failed.',
				parsedError.success && parsedError.data.error.retryable,
			);
		}

		return body;
	}

	private assert(expected: TIdentity | null, version: number) {
		if (version !== this.epoch || !same(expected, this.identity)) {
			throw new ClientError(0, 'CONTEXT_CHANGED', 'Session changed. Please retry.');
		}
	}

	private async recoverHeld(expected: TIdentity | null, version: number): Promise<TIdentity> {
		this.assert(expected, version);

		let next: TIdentity;

		try {
			next = Identity.parse(await this.raw('/auth/me'));
		} catch (error) {
			if (!recoverable(error)) {
				if (error instanceof ClientError && error.status === 401) {
					this.set(null);
				}

				throw error;
			}

			try {
				const csrfIdentity = Csrf.parse(await this.raw('/auth/csrf'));

				this.assert(expected, version);
				if (
					expected &&
					(csrfIdentity.userId !== expected.user.id || csrfIdentity.sid !== expected.sid)
				) {
					this.set(null, true);
					throw new ClientError(0, 'CONTEXT_CHANGED', 'Session changed.');
				}

				await this.raw('/auth/refresh', {
					method: 'POST',
					body: '{}',
					headers: { 'X-CSRF-Token': csrfIdentity.csrfToken },
				});
				next = Identity.parse(await this.raw('/auth/me'));
			} catch (error) {
				if (error instanceof ClientError && error.status === 401) {
					this.set(null);
					if (expected) {
						this.broadcast();
					}
				}

				throw error;
			}
		}
		this.assert(expected, version);

		if (expected && !same(expected, next)) {
			this.set(null, true);
			throw new ClientError(0, 'CONTEXT_CHANGED', 'Session changed.');
		}

		this.set(next);

		return next;
	}

	async initialize() {
		const expected = this.identity;
		const version = this.epoch;

		try {
			return await this.lock(() => this.recoverHeld(expected, version));
		} catch (error) {
			if (error instanceof ClientError && error.status === 401) {
				return null;
			}

			throw error;
		}
	}

	async verify(challengeId: string, code: string) {
		return this.lock(async () => {
			const next = Identity.parse(
				await this.raw('/auth/verify-otp', {
					method: 'POST',
					body: JSON.stringify({ challengeId, code }),
				}),
			);

			this.set(next, true);
			this.broadcast();

			return next;
		});
	}

	async logout() {
		const expected = this.identity;
		const version = this.epoch;

		return this.lock(async () => {
			this.assert(expected, version);

			const csrfResult = Csrf.safeParse(
				await this.raw('/auth/csrf').catch((error) => {
					if (error instanceof ClientError && error.status === 401) {
						return null;
					}

					throw error;
				}),
			);

			this.assert(expected, version);
			if (
				csrfResult.success &&
				(!expected ||
					csrfResult.data.userId !== expected.user.id ||
					csrfResult.data.sid !== expected.sid)
			) {
				this.set(null, true);
				throw new ClientError(0, 'CONTEXT_CHANGED', 'Session changed.');
			}

			const token = csrfResult.success ? csrfResult.data.csrfToken : expected?.csrfToken;

			await this.raw('/auth/logout', {
				method: 'POST',
				body: '{}',
				headers: token ? { 'X-CSRF-Token': token } : {},
			});

			this.set(null, true);
			this.broadcast();
		});
	}

	async request(path: string, init: RequestInit = {}): Promise<unknown> {
		const expected = this.identity;
		const version = this.epoch;

		if (!expected) {
			throw new ClientError(
				401,
				HTTP_ERROR_CODE.ACCESS_MISSING,
				HTTP_ERROR_MESSAGE.ACCESS_MISSING,
			);
		}

		const mutate = !!init.method && !['GET', 'HEAD'].includes(init.method);

		const send = () =>
			this.raw(
				path,
				{
					...init,
					headers: {
						...init.headers,
						...(mutate ? { 'X-CSRF-Token': this.identity!.csrfToken } : {}),
					},
				},
				init.signal
					? AbortSignal.any([init.signal, this.controller.signal])
					: this.controller.signal,
			);

		if (mutate) {
			return this.lock(async () => {
				await this.recoverHeld(expected, version);
				this.assert(expected, version);

				let result: unknown;

				try {
					result = await send();
				} catch (error) {
					if (!recoverable(error)) {
						throw error;
					}

					await this.recoverHeld(expected, version);
					this.assert(expected, version);
					result = await send();
				}
				this.assert(expected, version);

				return result;
			});
		}

		let result: unknown;

		try {
			result = await send();
		} catch (error) {
			if (!recoverable(error)) {
				throw error;
			}

			await this.lock(() => this.recoverHeld(expected, version));
			this.assert(expected, version);
			result = await send();
		}
		this.assert(expected, version);

		return result;
	}
}
