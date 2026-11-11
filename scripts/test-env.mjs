// Fixed isolated database + Redis DB/prefix. Never inherit user data endpoints.
export const testEnv = {
	...process.env,
	NODE_ENV: 'test',
	DATABASE_URL: 'postgresql://self_review:local_dev@localhost:55432/self_review_test',
	REDIS_URL: 'redis://localhost:56379/15',
	REDIS_PREFIX: 's01-test:',
	APP_ORIGIN: 'http://localhost:3000',
	AUTH_SECRET: 'test-auth-secret-32-bytes-minimum-synthetic',
	JWT_SECRET: 'test-jwt-secret-32-bytes-minimum-synthetic',
	TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 42).toString('base64'),
};
