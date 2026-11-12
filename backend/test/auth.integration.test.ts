import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
import { AppLogger } from '@app/shared/logging/logger';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createTestApp, type IRuntime } from './support/create-test-app.js';
import { config } from '@app/shared/config/config.schema';
import { database } from '@app/shared/database/database';
import { CryptoService } from '@app/modules/auth/services/crypto.service';

const configuration = config();

const codes = new Map<string, string>();

let runtime: IRuntime;

let clock = new Date();

let staticDir: string;

const password = 'synthetic-password-123';

const origin = configuration.APP_ORIGIN;

const cookies = (response: { headers: Record<string, unknown> }) =>
	((response.headers['set-cookie'] as string[]) ?? [])
		.map((cookieValue) => cookieValue.split(';')[0]!)
		.filter((cookieValue) => !cookieValue.endsWith('='));

const cookie = (response: { headers: Record<string, unknown> }, name: string) =>
	cookies(response).find((cookieValue) => cookieValue.startsWith(name + '='))!;

const post = (url: string, body: object, jar: string[] = []) =>
	request(runtime.app.getHttpServer())
		.post('/api/auth/' + url)
		.set('Origin', origin)
		.set('Cookie', jar)
		.send(body);

async function pending() {
	const email = randomUUID() + '@example.test';
	const signupResponse = await post('signup', { email, password });

	expect(signupResponse.status).toBe(201);

	return {
		email,
		response: signupResponse,
		pre: [cookie(signupResponse, 'sr_preauth')],
		code: codes.get(email)!,
	};
}

async function signed() {
	const pendingChallenge = await pending();
	const verificationResponse = await post(
		'verify-otp',
		{ challengeId: pendingChallenge.response.body.challengeId, code: pendingChallenge.code },
		pendingChallenge.pre,
	);

	expect(verificationResponse.status).toBe(201);

	return {
		...pendingChallenge,
		verificationResponse,
		jar: cookies(verificationResponse),
		csrf: verificationResponse.body.csrfToken as string,
		sid: verificationResponse.body.sid as string,
	};
}

const refresh = (session: { jar: string[]; csrf: string }) =>
	post('refresh', {}, session.jar).set('X-CSRF-Token', session.csrf);

const logout = (session: { jar: string[]; csrf: string }) =>
	post('logout', {}, session.jar).set('X-CSRF-Token', session.csrf);

beforeAll(async () => {
	if (
		!configuration.DATABASE_URL.endsWith('/self_review_test') ||
		!configuration.REDIS_URL.endsWith('/15') ||
		configuration.REDIS_PREFIX !== 's01-test:'
	) {
		throw Error('Tests require isolated storage');
	}

	staticDir = await mkdtemp(path.join(tmpdir(), 's01-spa-'));
	await writeFile(
		path.join(staticDir, 'index.html'),
		'<!doctype html><html>synthetic SPA routing fixture</html>',
	);
	runtime = await createTestApp({
		config: configuration,
		staticDir,
		mail: {
			verify: async () => undefined,
			async send(email, code) {
				codes.set(email, code);
			},
		},
		now: () => clock,
	});
});

beforeEach(async () => {
	clock = new Date();

	const keys = await runtime.redis.keys(configuration.REDIS_PREFIX + '*');

	if (keys.length) {
		await runtime.redis.del(...keys);
	}

	await runtime.db.user.deleteMany();
	codes.clear();
});

afterAll(async () => {
	await runtime?.close();
	if (staticDir) {
		await rm(staticDir, { recursive: true, force: true });
	}
});

describe('HTTP password and OTP', () => {
	it('correlates safe error logs, response headers and public request IDs', async () => {
		const log = vi.spyOn(AppLogger.prototype, 'warn');
		try {
			const responses = await Promise.all(
				Array.from({ length: 2 }, () =>
					request(runtime.app.getHttpServer())
						.get('/api/auth/me')
						.set('X-Request-Id', 'untrusted-client-value'),
				),
			);
			for (const response of responses) {
				expect(response.status).toBe(401);
				expect(response.body.requestId).toBe(response.headers['x-request-id']);
				expect(log).toHaveBeenCalledWith(
					'http_request_rejected',
					expect.objectContaining({
						requestId: response.body.requestId,
						status: 401,
						method: 'GET',
					}),
				);
			}
			expect(responses[0]!.body.requestId).not.toBe(responses[1]!.body.requestId);
			expect(responses[0]!.body.requestId).not.toBe('untrusted-client-value');
		} finally {
			log.mockRestore();
		}
	});
	it('does not create a user or tokens before OTP; strict input, Origin and browser binding', async () => {
		expect(
			(
				await post('signup', {
					email: 'valid@example.test',
					password,
					extra: true,
				})
			).status,
		).toBe(400);
		expect(
			(
				await request(runtime.app.getHttpServer())
					.post('/api/auth/signup')
					.send({ email: 'valid@example.test', password })
			).status,
		).toBe(403);

		const pendingChallenge = await pending();

		expect(await runtime.db.user.count()).toBe(0);
		expect(cookies(pendingChallenge.response)).toHaveLength(1);
		expect(pendingChallenge.response.body.code).toBeUndefined();
		expect(
			(
				await request(runtime.app.getHttpServer())
					.get('/api/auth/me')
					.set('Cookie', pendingChallenge.pre)
			).body.error.code,
		).toBe('ACCESS_MISSING');
		expect(
			(
				await post('verify-otp', {
					challengeId: pendingChallenge.response.body.challengeId,
					code: pendingChallenge.code,
				})
			).status,
		).toBe(401);

		const verificationResponse = await post(
			'verify-otp',
			{
				challengeId: pendingChallenge.response.body.challengeId,
				code: pendingChallenge.code,
			},
			pendingChallenge.pre,
		);

		expect(verificationResponse.status).toBe(201);
		expect(await runtime.db.user.count()).toBe(1);
		expect(verificationResponse.body.accessToken).toBeUndefined();
		expect(verificationResponse.body.refreshToken).toBeUndefined();

		const raw = verificationResponse.headers['set-cookie'] as unknown as string[];

		expect(raw.find((cookieValue) => cookieValue.startsWith('sr_access='))).toMatch(
			/Path=\/api;.*HttpOnly; SameSite=Lax/,
		);
		expect(raw.find((cookieValue) => cookieValue.startsWith('sr_refresh='))).toMatch(
			/Path=\/api\/auth;.*HttpOnly; SameSite=Lax/,
		);

		const me = await request(runtime.app.getHttpServer())
			.get('/api/auth/me')
			.set('Cookie', cookies(verificationResponse));

		expect(me.body.user.email).toBe(pendingChallenge.email);
		expect(
			(
				await post(
					'verify-otp',
					{
						challengeId: pendingChallenge.response.body.challengeId,
						code: pendingChallenge.code,
					},
					pendingChallenge.pre,
				)
			).status,
		).toBe(401);

		const row = await runtime.db.user.findUniqueOrThrow({
			where: { email: pendingChallenge.email },
		});

		expect(row.passwordHash).toMatch(/^\$argon2id\$/);
	});
	it('atomically consumes OTP under competing verifications', async () => {
		const pendingChallenge = await pending();
		const all = await Promise.all(
			Array.from({ length: 6 }, () =>
				post(
					'verify-otp',
					{
						challengeId: pendingChallenge.response.body.challengeId,
						code: pendingChallenge.code,
					},
					pendingChallenge.pre,
				),
			),
		);

		expect(all.filter((response) => response.status === 201)).toHaveLength(1);
		expect(await runtime.db.authSession.count()).toBe(1);
		expect(await runtime.db.refreshToken.count()).toBe(1);
	});
	it('expires challenges and enforces five attempts', async () => {
		const pendingChallenge = await pending();

		for (let attempt = 0; attempt < 5; attempt++) {
			const response = await post(
				'verify-otp',
				{
					challengeId: pendingChallenge.response.body.challengeId,
					code: pendingChallenge.code === '000000' ? '000001' : '000000',
				},
				pendingChallenge.pre,
			);

			expect(response.status).toBe(401);
		}
		expect(
			(
				await post(
					'verify-otp',
					{
						challengeId: pendingChallenge.response.body.challengeId,
						code: pendingChallenge.code,
					},
					pendingChallenge.pre,
				)
			).body.error.code,
		).toBe('OTP_ATTEMPTS');

		const key = runtime.auth.challenges.key(pendingChallenge.response.body.challengeId);

		expect(await runtime.redis.ttl(key)).toBeGreaterThan(590);
		await runtime.redis.pexpire(key, 1);
		await new Promise((resolve) => setTimeout(resolve, 5));
		expect(
			(
				await post(
					'verify-otp',
					{
						challengeId: pendingChallenge.response.body.challengeId,
						code: pendingChallenge.code,
					},
					pendingChallenge.pre,
				)
			).body.error.code,
		).toBe('OTP_EXPIRED');
		expect(await runtime.db.authSession.count()).toBe(0);
	});
	it('resend invalidates old OTP, preserves binding and enforces cooldown / send quotas', async () => {
		const pendingChallenge = await pending();

		expect(
			(
				await post(
					'resend-otp',
					{ challengeId: pendingChallenge.response.body.challengeId },
					pendingChallenge.pre,
				)
			).status,
		).toBe(429);
		await runtime.redis.del(
			configuration.REDIS_PREFIX +
				'send:cool:' +
				runtime.app.get(CryptoService).hashSha256(pendingChallenge.email),
		);

		const next = await post(
			'resend-otp',
			{ challengeId: pendingChallenge.response.body.challengeId },
			pendingChallenge.pre,
		);

		expect(next.status).toBe(201);

		const code = codes.get(pendingChallenge.email)!;

		if (code !== pendingChallenge.code) {
			expect(
				(
					await post(
						'verify-otp',
						{
							challengeId: pendingChallenge.response.body.challengeId,
							code: pendingChallenge.code,
						},
						pendingChallenge.pre,
					)
				).status,
			).toBe(401);
		}

		expect(
			(
				await post(
					'verify-otp',
					{ challengeId: pendingChallenge.response.body.challengeId, code },
					pendingChallenge.pre,
				)
			).status,
		).toBe(201);
		await runtime.redis.set(
			configuration.REDIS_PREFIX +
				'send:email:' +
				runtime.app.get(CryptoService).hashSha256('limited@example.test'),
			'5',
			'EX',
			900,
		);
		expect((await post('signup', { email: 'limited@example.test', password })).status).toBe(
			429,
		);
		await runtime.redis.set(
			configuration.REDIS_PREFIX +
				'send:ip:' +
				runtime.app.get(CryptoService).hashSha256('::ffff:127.0.0.1'),
			'20',
			'EX',
			900,
		); // reserve() covers both IPv4/IPv6 transport forms below
		await expect(
			runtime.auth.challenges.sends('other@example.test', '::ffff:127.0.0.1'),
		).rejects.toMatchObject({ response: { code: 'RATE_LIMITED' } });
	});
	it('login requires password and another OTP; generic errors and failed password limit', async () => {
		const session = await signed();
		const invalid = await post('login', {
			email: session.email,
			password: 'incorrect-password',
		});

		expect(invalid.body.error.code).toBe('CREDENTIALS_INVALID');

		const unknown = await post('login', {
			email: 'missing@example.test',
			password: 'incorrect-password',
		});

		expect(unknown.body.error.message).toBe(invalid.body.error.message);
		await runtime.redis.del(
			configuration.REDIS_PREFIX +
				'send:cool:' +
				runtime.app.get(CryptoService).hashSha256(session.email),
		);

		const loginResponse = await post('login', { email: session.email, password });

		expect(loginResponse.status).toBe(201);
		expect(cookies(loginResponse)).toHaveLength(1);
		expect(await runtime.db.authSession.count()).toBe(1);
		await runtime.redis.set(
			configuration.REDIS_PREFIX +
				'pwd:email:' +
				runtime.app.get(CryptoService).hashSha256(session.email),
			'10',
			'EX',
			900,
		);
		expect((await post('login', { email: session.email, password })).status).toBe(429);
	});
	it('checks SMTP readiness without sending mail and recovers after an outage', async () => {
		let smtpAvailable = true;
		let sentMessages = 0;
		const readiness = await createTestApp({
			config: configuration,
			db: runtime.db,
			redis: runtime.redis,
			mail: {
				async verify() {
					if (!smtpAvailable) {
						throw Error('private SMTP connection details');
					}
				},
				async send() {
					sentMessages++;
				},
			},
		});
		const server = readiness.app.getHttpServer();

		try {
			expect((await request(server).get('/api/health/ready')).status).toBe(200);

			smtpAvailable = false;
			const unavailable = await request(server).get('/api/health/ready');

			expect(unavailable.status).toBe(503);
			expect(unavailable.body).toEqual({ status: 'unavailable' });
			expect((await request(server).get('/api/health')).status).toBe(200);

			smtpAvailable = true;
			expect((await request(server).get('/api/health/ready')).status).toBe(200);
			expect(sentMessages).toBe(0);
		} finally {
			await readiness.close();
		}
	});

	it('invalidates a rejected SMTP challenge and grants no tokens', async () => {
		const failing = await createTestApp({
			config: configuration,
			db: runtime.db,
			redis: runtime.redis,
			mail: {
				verify: async () => undefined,
				async send() {
					throw Error('private SMTP data');
				},
			},
		});

		try {
			const response = await request(failing.app.getHttpServer())
				.post('/api/auth/signup')
				.set('Origin', origin)
				.send({ email: 'mailfail@example.test', password });

			expect(response.status).toBe(502);
			expect(response.headers['set-cookie']).toBeUndefined();
			expect(JSON.stringify(response.body)).not.toContain('private');
			expect(await runtime.redis.keys(configuration.REDIS_PREFIX + 'otp:*')).toHaveLength(0);
		} finally {
			await failing.app.close();
		}
	});
});

describe('transactional refresh and logout', () => {
	it('requires Origin/CSRF, bootstraps without access and rotates after commit', async () => {
		const session = await signed();
		const refreshOnly = [cookie(session.verificationResponse, 'sr_refresh')];

		expect((await post('refresh', {}, refreshOnly)).status).toBe(403);

		const csrfResponse = await request(runtime.app.getHttpServer())
			.get('/api/auth/csrf')
			.set('Cookie', refreshOnly);

		expect(csrfResponse.status).toBe(200);

		const response = await refresh({ jar: refreshOnly, csrf: csrfResponse.body.csrfToken });

		expect(response.status).toBe(201);
		expect(response.body.sid).toBe(session.sid);

		const rows = await runtime.db.refreshToken.findMany({
			where: { sessionId: session.sid },
		});

		expect(rows).toHaveLength(2);

		const old = rows.find((token) => token.consumedAt)!;

		expect(old.replacedById).toBe(rows.find((token) => !token.consumedAt)!.id);
		expect(rows.every((token) => token.tokenHash.length === 64)).toBe(true);
	});
	it('competing refreshes create one successor and reuse revokes the family', async () => {
		const session = await signed();
		const all = await Promise.all([refresh(session), refresh(session)]);

		expect(all.map((response) => response.status).sort()).toEqual([201, 401]);
		expect(
			(await runtime.db.authSession.findUniqueOrThrow({ where: { id: session.sid } }))
				.revokedAt,
		).not.toBeNull();
		expect(await runtime.db.refreshToken.count()).toBe(2);

		const success = all.find((response) => response.status === 201)!;

		expect(
			(await refresh({ jar: cookies(success), csrf: success.body.csrfToken })).status,
		).toBe(401);
	});
	it('detects consumed-token replay and retains its hash and successor', async () => {
		const session = await signed();

		await refresh(session);

		const replay = await refresh(session);

		expect(replay.body.error.code).toBe('REFRESH_REUSED');
		expect(await runtime.db.refreshToken.count()).toBe(2);
		expect(
			(
				await runtime.db.refreshToken.findFirstOrThrow({
					where: { consumedAt: { not: null } },
				})
			).replacedById,
		).not.toBeNull();
	});
	it('refresh versus logout cannot resurrect a revoked session', async () => {
		const session = await signed();
		const [refreshResponse, logoutResponse] = await Promise.all([
			refresh(session),
			logout(session),
		]);

		expect(logoutResponse.status).toBe(201);
		expect([201, 401]).toContain(refreshResponse.status);
		expect(
			(await runtime.db.authSession.findUniqueOrThrow({ where: { id: session.sid } }))
				.revokedAt,
		).not.toBeNull();
		if (refreshResponse.status === 201) {
			expect(
				(
					await refresh({
						jar: cookies(refreshResponse),
						csrf: refreshResponse.body.csrfToken,
					})
				).status,
			).toBe(401);
		}
	});
	it('does not slide the absolute deadline, and expiry uses a controlled clock', async () => {
		const session = await signed();
		const deadline = session.verificationResponse.body.sessionExpiresAt;

		clock = new Date(clock.getTime() + 6 * 86400000);

		const response = await refresh(session);

		expect(response.status).toBe(201);
		expect(response.body.sessionExpiresAt).toBe(deadline);
		clock = new Date(Date.parse(deadline));
		expect(
			(await refresh({ jar: cookies(response), csrf: response.body.csrfToken })).body.error
				.code,
		).toBe('REFRESH_EXPIRED');
	});
	it('logout works with expired access; copied JWT has the documented window', async () => {
		const session = await signed();
		const out = await logout({
			jar: [cookie(session.verificationResponse, 'sr_refresh')],
			csrf: session.csrf,
		});

		expect(out.status).toBe(201);
		expect((await refresh(session)).status).toBe(401);
		expect(
			(
				await request(runtime.app.getHttpServer())
					.get('/api/auth/me')
					.set('Cookie', [cookie(session.verificationResponse, 'sr_access')])
			).status,
		).toBe(200);
		expect((await post('logout', {})).status).toBe(201);
	});
	it('Postgres failure neither issues cookies nor reports successful logout', async () => {
		const session = await signed();
		const bad = database('postgresql://self_review:local_dev@127.0.0.1:55433/self_review_test');
		const broken = await createTestApp({
			config: configuration,
			db: bad,
			redis: runtime.redis,
		});

		try {
			for (const path of ['refresh', 'logout']) {
				const response = await request(broken.app.getHttpServer())
					.post('/api/auth/' + path)
					.set('Origin', origin)
					.set('Cookie', session.jar)
					.set('X-CSRF-Token', session.csrf)
					.send({});

				expect(response.status).toBe(503);
				expect(response.headers['set-cookie']).toBeUndefined();
			}
			expect(
				(await runtime.db.authSession.findUniqueOrThrow({ where: { id: session.sid } }))
					.revokedAt,
			).toBeNull();
			expect(await runtime.db.refreshToken.count()).toBe(1);
		} finally {
			await broken.app.close();
			await bad.$disconnect();
		}
	});
	it('Redis outage blocks OTP/rate checks while JWT access still works', async () => {
		const session = await signed();

		runtime.redis.disconnect();

		try {
			expect((await post('login', { email: session.email, password })).status).toBe(503);
			expect(
				(
					await post('verify-otp', { challengeId: randomUUID(), code: '123456' }, [
						'sr_preauth=fake',
					])
				).status,
			).toBe(503);
			expect(
				(
					await request(runtime.app.getHttpServer())
						.get('/api/auth/me')
						.set('Cookie', session.jar)
				).status,
			).toBe(200);
		} finally {
			await runtime.redis.connect();
		}
	});
});

it('keeps API/asset 404s separate from known SPA deep links', async () => {
	for (const path of ['/api/missing', '/assets/missing.js', '/missing.css']) {
		const response = await request(runtime.app.getHttpServer())
			.get(path)
			.set('Accept', 'text/html');

		expect(response.status).toBe(404);
		expect(response.text).not.toContain('<html');
	}

	const deep = await request(runtime.app.getHttpServer())
		.get('/connections')
		.set('Accept', 'text/html');

	expect(deep.status).toBe(200);
	expect(deep.text).toContain('<html');
});

it('OTP database failure consumes the challenge without issuing an authenticated cookie', async () => {
	const pendingChallenge = await pending();
	const db = database('postgresql://self_review:local_dev@127.0.0.1:55433/self_review_test');
	const broken = await createTestApp({ config: configuration, db, redis: runtime.redis });

	try {
		const response = await request(broken.app.getHttpServer())
			.post('/api/auth/verify-otp')
			.set('Origin', origin)
			.set('Cookie', pendingChallenge.pre)
			.send({
				challengeId: pendingChallenge.response.body.challengeId,
				code: pendingChallenge.code,
			});

		expect(response.status).toBe(503);
		expect(response.headers['set-cookie']).toBeUndefined();
		expect(await runtime.db.authSession.count()).toBe(0);
		expect(
			(
				await post(
					'verify-otp',
					{
						challengeId: pendingChallenge.response.body.challengeId,
						code: pendingChallenge.code,
					},
					pendingChallenge.pre,
				)
			).status,
		).toBe(401);
	} finally {
		await broken.app.close();
		await db.$disconnect();
	}
});

it('database constraints enforce provider/activity slots and same-family successor links', async () => {
	const session = await signed();
	const ownerId = session.verificationResponse.body.user.id;
	const data = {
		ownerId,
		provider: 'linear',
		mode: 'live',
		displayName: 'Synthetic',
		sourceUserId: 'synthetic-user',
		sourceUserName: 'Synthetic',
	};
	const connection = await runtime.db.connection.create({ data });

	await expect(runtime.db.connection.create({ data })).rejects.toMatchObject({
		code: 'P2002',
	});
	await runtime.db.connection.create({ data: { ...data, mode: 'fixture' } });

	const project = await runtime.db.sourceProject.create({
		data: {
			connectionId: connection.id,
			externalId: 'project',
			resourceType: 'project',
			name: 'Synthetic',
		},
	});
	const run = {
		ownerId,
		projectId: project.id,
		type: 'sync',
		selection: {},
		subjectSourceUserId: 'synthetic-user',
		idempotencyKey: randomUUID(),
		requestFingerprint: 'synthetic',
	};
	const first = await runtime.db.jobRun.create({ data: run });

	await expect(
		runtime.db.jobRun.create({ data: { ...run, idempotencyKey: randomUUID() } }),
	).rejects.toMatchObject({ code: 'P2002' });
	await runtime.db.jobRun.update({
		where: { id: first.id },
		data: { state: 'succeeded' },
	});
	await runtime.db.jobRun.create({
		data: {
			...run,
			idempotencyKey: randomUUID(),
			type: 'review',
			sourceSyncRunId: first.id,
		},
	});

	const other = await runtime.db.authSession.create({
		data: {
			userId: ownerId,
			expiresAt: new Date(Date.now() + 600000),
			tokens: {
				create: {
					tokenHash: runtime.app.get(CryptoService).hashSha256(randomUUID()),
					expiresAt: new Date(Date.now() + 600000),
				},
			},
		},
		include: { tokens: true },
	});
	const token = await runtime.db.refreshToken.findFirstOrThrow({
		where: { sessionId: session.sid },
	});

	await expect(
		runtime.db.refreshToken.update({
			where: { id: token.id },
			data: { consumedAt: new Date(), replacedById: other.tokens[0]!.id },
		}),
	).rejects.toMatchObject({ code: 'P2003' });
});

it('checks the absolute deadline after waiting for the session lock', async () => {
	const session = await signed();
	let release!: () => void;
	let locked!: () => void;
	const acquired = new Promise<void>((resolve) => {
		locked = resolve;
	});
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	const holder = runtime.db.$transaction(async (tx) => {
		await tx.$queryRaw`SELECT id FROM auth_sessions WHERE id=${session.sid}::uuid FOR UPDATE`;
		locked();
		await gate;
	});

	await acquired;

	const response = refresh(session).then((value) => value);
	let waiting = false;

	try {
		for (let attempt = 0; attempt < 200; attempt++) {
			const rows = await runtime.db.$queryRaw<
				{ count: bigint }[]
			>`SELECT count(*) AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%auth_sessions%'`;

			if (Number(rows[0]?.count) > 0) {
				waiting = true;
				break;
			}

			await new Promise((resolve) => setTimeout(resolve, 5));
		}
		clock = new Date(session.verificationResponse.body.sessionExpiresAt);
	} finally {
		release();
	}
	await holder;

	const result = await response;

	expect(waiting).toBe(true);
	expect(result.status).toBe(401);
	expect(result.body.error.code).toBe('REFRESH_EXPIRED');
	expect(await runtime.db.refreshToken.count()).toBe(1);
});

it('database deduplicates automatic reviews by source while preserving manual regeneration', async () => {
	const session = await signed();
	const ownerId = session.verificationResponse.body.user.id;
	const connection = await runtime.db.connection.create({
		data: {
			ownerId,
			provider: 'linear',
			mode: 'fixture',
			displayName: 'Synthetic trigger fixture',
			sourceUserId: 'synthetic-user',
			sourceUserName: 'Synthetic',
		},
	});
	const project = await runtime.db.sourceProject.create({
		data: {
			connectionId: connection.id,
			externalId: 'trigger-project',
			resourceType: 'project',
			name: 'Synthetic trigger project',
		},
	});
	const run = {
		ownerId,
		projectId: project.id,
		type: 'sync',
		selection: {},
		subjectSourceUserId: 'synthetic-user',
		requestFingerprint: 'synthetic-trigger',
		state: 'succeeded',
	};
	const source = await runtime.db.jobRun.create({
		data: { ...run, idempotencyKey: randomUUID() },
	});
	const review = { ...run, type: 'review', sourceSyncRunId: source.id };

	expect(source.trigger).toBe('manual');

	for (let index = 0; index < 2; index++) {
		const manual = await runtime.db.jobRun.create({
			data: { ...review, idempotencyKey: randomUUID() },
		});

		expect(manual.trigger).toBe('manual');
	}

	await runtime.db.jobRun.create({
		data: { ...review, trigger: 'automatic', state: 'failed', idempotencyKey: randomUUID() },
	});

	// No active run occupies the project slot, and each key is different:
	// this rejection must come from automatic-source uniqueness across history.
	await expect(
		runtime.db.jobRun.create({
			data: { ...review, trigger: 'automatic', idempotencyKey: randomUUID() },
		}),
	).rejects.toMatchObject({ code: 'P2002' });

	const nextSource = await runtime.db.jobRun.create({
		data: { ...run, idempotencyKey: randomUUID() },
	});
	const results = await Promise.allSettled(
		Array.from({ length: 2 }, () =>
			runtime.db.jobRun.create({
				data: {
					...review,
					sourceSyncRunId: nextSource.id,
					trigger: 'automatic',
					idempotencyKey: randomUUID(),
				},
			}),
		),
	);

	expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
	expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);

	for (const result of results) {
		if (result.status === 'rejected') {
			expect(result.reason).toMatchObject({ code: 'P2002' });
		}
	}

	await expect(
		runtime.db.jobRun.create({
			data: { ...review, trigger: 'unsupported', idempotencyKey: randomUUID() },
		}),
	).rejects.toThrow();
	await expect(
		runtime.db.jobRun.create({
			data: { ...run, trigger: 'automatic', idempotencyKey: randomUUID() },
		}),
	).rejects.toThrow();
	await expect(
		runtime.db.jobRun.create({
			data: {
				...review,
				trigger: 'automatic',
				sourceSyncRunId: null,
				idempotencyKey: randomUUID(),
			},
		}),
	).rejects.toThrow();
});
