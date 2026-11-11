import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';
import { CryptoService } from '@app/modules/auth/services/crypto.service';
import { config } from '@app/shared/config/config.schema';
import type { TConfig } from '@app/shared/config/config.schema';
import type { ConfigService } from '@app/shared/config/config.service';

const secret = 'unit-test-jwt-key-with-at-least-32-bytes';
const userId = randomUUID();
const sessionId = randomUUID();
const now = new Date('2026-11-11T12:00:00Z');

function createCryptoService(jwtSecret = secret, currentTime = now): CryptoService {
	const values = config({
		APP_ORIGIN: 'http://localhost:3000',
		DATABASE_URL: 'postgresql://synthetic',
		REDIS_URL: 'redis://localhost:6379',
		AUTH_SECRET: 'unit-test-auth-key-with-at-least-32-bytes',
		JWT_SECRET: jwtSecret,
		TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 42).toString('base64'),
	});
	const configuration: ConfigService = {
		values,
		get<TKey extends keyof TConfig>(key: TKey): TConfig[TKey] {
			return values[key];
		},
	};

	return new CryptoService(configuration, { now: () => currentTime });
}

describe('JWT boundary', () => {
	it('bounds access by 15 minutes and absolute session deadline', async () => {
		const cryptoService = createCryptoService();
		const accessToken = await cryptoService.signAccessToken(
			userId,
			sessionId,
			new Date(now.getTime() + 100000),
		);

		expect(accessToken.expiresAt.getTime()).toBe(now.getTime() + 100000);
		expect((await cryptoService.verifyAccessToken(accessToken.token)).sid).toBe(sessionId);
		await expect(
			createCryptoService(secret, new Date(now.getTime() + 100001)).verifyAccessToken(
				accessToken.token,
			),
		).rejects.toMatchObject({ response: { code: 'ACCESS_EXPIRED' } });
	});

	it('distinguishes missing, invalid and expired access', async () => {
		const cryptoService = createCryptoService();

		await expect(cryptoService.verifyAccessToken(undefined)).rejects.toMatchObject({
			response: { code: 'ACCESS_MISSING' },
		});

		const accessToken = await cryptoService.signAccessToken(
			userId,
			sessionId,
			new Date(now.getTime() + 86400000),
		);

		expect(accessToken.expiresAt.getTime() - now.getTime()).toBe(900000);
		await expect(
			createCryptoService('wrong-unit-test-jwt-key-with-at-least-32-bytes').verifyAccessToken(
				accessToken.token,
			),
		).rejects.toMatchObject({ response: { code: 'ACCESS_INVALID' } });
	});

	it.each(['issuer', 'audience', 'algorithm', 'otp', 'subject', 'sid', 'expiry'])(
		'rejects invalid %s',
		async (field) => {
			const payload = {
				sid: field === 'sid' ? 'not-a-uuid' : sessionId,
				amr: field === 'otp' ? ['pwd'] : ['pwd', 'otp'],
			};
			let jwt = new SignJWT(payload)
				.setProtectedHeader({ alg: field === 'algorithm' ? 'HS384' : 'HS256' })
				.setSubject(field === 'subject' ? '' : userId)
				.setIssuer(field === 'issuer' ? 'other' : 'self-review-app')
				.setAudience(field === 'audience' ? 'other' : 'self-review-api')
				.setIssuedAt(now.getTime() / 1000);

			if (field !== 'expiry') {
				jwt = jwt.setExpirationTime(now.getTime() / 1000 + 900);
			}

			const token = await jwt.sign(new TextEncoder().encode(secret));

			await expect(createCryptoService().verifyAccessToken(token)).rejects.toMatchObject({
				response: { code: 'ACCESS_INVALID' },
			});
		},
	);
});

it('purpose separates and binds CSRF to the session', () => {
	const cryptoService = createCryptoService();
	const csrfToken = cryptoService.createCsrfToken(sessionId);

	expect(() => cryptoService.verifyCsrfToken(sessionId, csrfToken)).not.toThrow();
	expect(() => cryptoService.verifyCsrfToken(randomUUID(), csrfToken)).toThrow();
	expect(() => cryptoService.verifyCsrfToken(sessionId, undefined)).toThrow();
	expect(cryptoService.createHmac('otp', 'a', 'bc')).not.toBe(
		cryptoService.createHmac('otp', 'ab', 'c'),
	);
	expect(cryptoService.createHmac('otp', sessionId, 'x')).not.toBe(
		cryptoService.createHmac('csrf', sessionId, 'x'),
	);
});
