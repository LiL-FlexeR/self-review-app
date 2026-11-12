import { z as zod } from 'zod';

const Schema = zod.object({
	APP_ORIGIN: zod.url(),
	OPENAI_API_KEY: zod.string().min(1).optional(),
	OPENAI_MODEL: zod.literal('gpt-5.4-mini-2026-03-17').default('gpt-5.4-mini-2026-03-17'),
	APP_MODE: zod.enum(['offline', 'demo', 'live']).default('offline'),
	DATABASE_URL: zod.string().min(1),
	REDIS_URL: zod.url(),
	AUTH_SECRET: zod.string().min(32),
	JWT_SECRET: zod.string().min(32),
	TOKEN_ENCRYPTION_KEY: zod.string(),
	SMTP_HOST: zod.string().default('localhost'),
	SMTP_PORT: zod.coerce.number().int().default(1025),
	SMTP_SECURE: zod.enum(['true', 'false']).default('false'),
	SMTP_USER: zod.string().optional(),
	SMTP_PASSWORD: zod.string().optional(),
	SMTP_FROM: zod.string().default('Self Review <no-reply@self-review.local>'),
	MAIL_DELIVERY: zod.enum(['local', 'external']).default('local'),
	PORT: zod.coerce.number().int().default(3000),
	REDIS_PREFIX: zod
		.string()
		.regex(/^[a-zA-Z0-9:_-]+$/)
		.default('self-review:'),
});

export type TConfig = zod.infer<typeof Schema>;

export function config(env: NodeJS.ProcessEnv = process.env): TConfig {
	const parsed = Schema.safeParse(env);

	if (!parsed.success) {
		throw new Error(
			'Invalid runtime configuration: ' +
				parsed.error.issues.map((issue) => issue.path.join('.')).join(', '),
		);
	}

	const configuration = parsed.data;
	const origin = new URL(configuration.APP_ORIGIN);

	if (
		origin.origin !== configuration.APP_ORIGIN ||
		(!['https:'].includes(origin.protocol) &&
			!(
				origin.protocol === 'http:' &&
				['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)
			))
	) {
		throw new Error('APP_ORIGIN must be an HTTPS origin or a loopback HTTP origin');
	}

	const key = Buffer.from(configuration.TOKEN_ENCRYPTION_KEY, 'base64');

	if (
		key.length !== 32 ||
		key.toString('base64') !== configuration.TOKEN_ENCRYPTION_KEY ||
		new Set([
			configuration.AUTH_SECRET,
			configuration.JWT_SECRET,
			configuration.TOKEN_ENCRYPTION_KEY,
		]).size !== 3 ||
		key.equals(Buffer.from(configuration.AUTH_SECRET)) ||
		key.equals(Buffer.from(configuration.JWT_SECRET))
	) {
		throw new Error('Independent authentication/encryption secrets are required');
	}

	return configuration;
}
