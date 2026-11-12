import { expect, it } from 'vitest';
import { CredentialsService } from '@app/shared/credentials/credentials.service';
import type { ConfigService } from '@app/shared/config/config.service';
import { config } from '@app/shared/config/config.schema';
import type { TConfig } from '@app/shared/config/config.schema';

const values = config({
	APP_ORIGIN: 'http://localhost:3000',
	DATABASE_URL: 'synthetic',
	REDIS_URL: 'redis://localhost:6379',
	AUTH_SECRET: 'synthetic-auth-secret-with-32-characters',
	JWT_SECRET: 'synthetic-jwt-secret-with-32-characters',
	TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 42).toString('base64'),
});
const configuration: ConfigService = {
	values,
	get<TKey extends keyof TConfig>(key: TKey): TConfig[TKey] {
		return values[key];
	},
};

it('uses fresh nonces and authenticated owner/connection binding', () => {
	const service = new CredentialsService(configuration);
	const credentials = { token: 'synthetic-linear-key' };
	const encrypted = service.encrypt('owner-1', 'connection-1', credentials);
	expect(encrypted).not.toContain(credentials.token);
	expect(service.encrypt('owner-1', 'connection-1', credentials)).not.toBe(encrypted);
	expect(service.decrypt('owner-1', 'connection-1', encrypted)).toEqual(credentials);
	expect(() => service.decrypt('owner-2', 'connection-1', encrypted)).toThrow();
	expect(() => service.decrypt('owner-1', 'connection-2', encrypted)).toThrow();
});

it('rejects tampered ciphertext and unsupported key envelopes', () => {
	const service = new CredentialsService(configuration);
	const encrypted = JSON.parse(
		service.encrypt('owner', 'connection', { token: 'synthetic-key' }),
	) as { ciphertext: string; version: number };
	expect(() =>
		service.decrypt(
			'owner',
			'connection',
			JSON.stringify({ ...encrypted, ciphertext: 'dGFtcGVyZWQ=' }),
		),
	).toThrow();
	expect(() =>
		service.decrypt('owner', 'connection', JSON.stringify({ ...encrypted, version: 2 })),
	).toThrow();
});
