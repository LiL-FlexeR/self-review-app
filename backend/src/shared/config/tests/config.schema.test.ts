import { it, expect } from 'vitest';
import { config } from '@app/shared/config/config.schema';

const env = {
	APP_ORIGIN: 'http://localhost:3000',
	DATABASE_URL: 'postgresql://synthetic',
	REDIS_URL: 'redis://localhost:6379',
	AUTH_SECRET: 'synthetic-auth-key-with-at-least-32-bytes',
	JWT_SECRET: 'synthetic-jwt-key-with-at-least-32-bytes',
	TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 42).toString('base64'),
};

it('validates independent secrets and permits HTTP only on a loopback origin', () => {
	expect(config(env).APP_MODE).toBe('offline');
	for (const overrides of [
		{ JWT_SECRET: 'short' },
		{ JWT_SECRET: env.AUTH_SECRET },
		{ TOKEN_ENCRYPTION_KEY: 'not-base64' },
		{ APP_ORIGIN: 'http://example.com' },
		{ APP_ORIGIN: 'http://localhost:3000/path' },
	]) {
		expect(() => config({ ...env, ...overrides })).toThrow();
	}
	expect(config({ ...env, APP_ORIGIN: 'https://example.test' }).APP_ORIGIN).toBe(
		'https://example.test',
	);
});
