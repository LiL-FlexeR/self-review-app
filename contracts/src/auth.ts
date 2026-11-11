import { z as zod } from 'zod';

export const Credentials = zod.strictObject({
	email: zod.string().trim().toLowerCase().pipe(zod.email().max(254)),
	password: zod.string().min(12).max(128),
});

export const VerifyOtp = zod.strictObject({
	challengeId: zod.uuid(),
	code: zod.string().regex(/^\d{6}$/),
});

export const ResendOtp = zod.strictObject({ challengeId: zod.uuid() });

export const EmptyBody = zod.strictObject({});

export const Challenge = zod.strictObject({
	challengeId: zod.uuid(),
	maskedEmail: zod.string(),
	expiresAt: zod.iso.datetime(),
	resendAt: zod.iso.datetime(),
	mailDelivery: zod.enum(['local', 'external']),
});

export const Identity = zod.strictObject({
	user: zod.strictObject({ id: zod.uuid(), email: zod.email() }),
	sid: zod.uuid(),
	accessExpiresAt: zod.iso.datetime(),
	sessionExpiresAt: zod.iso.datetime(),
	csrfToken: zod.string(),
	mode: zod.enum(['offline', 'demo', 'live']),
});

export const Csrf = zod.strictObject({
	csrfToken: zod.string(),
	userId: zod.uuid(),
	sid: zod.uuid(),
});

export type TIdentity = zod.infer<typeof Identity>;

export type TChallenge = zod.infer<typeof Challenge>;
