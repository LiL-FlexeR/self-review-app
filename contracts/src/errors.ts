import { z as zod } from 'zod';

export const HTTP_ERROR_CODE = {
	RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
	JOB_CONFLICT: 'JOB_CONFLICT',
	SNAPSHOT_UNAVAILABLE: 'SNAPSHOT_UNAVAILABLE',
	MODE_UNAVAILABLE: 'MODE_UNAVAILABLE',
	CONNECTION_CONFLICT: 'CONNECTION_CONFLICT',
	CONNECTION_IDENTITY_MISMATCH: 'CONNECTION_IDENTITY_MISMATCH',
	CONNECTION_BUSY: 'CONNECTION_BUSY',
	PROVIDER_CREDENTIALS_INVALID: 'PROVIDER_CREDENTIALS_INVALID',
	PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
	PROVIDER_RATE_LIMITED: 'PROVIDER_RATE_LIMITED',
	PROVIDER_RESPONSE_INVALID: 'PROVIDER_RESPONSE_INVALID',
	PROVIDER_RESPONSE_LIMIT: 'PROVIDER_RESPONSE_LIMIT',
	PROVIDER_FIELD_LIMIT: 'PROVIDER_FIELD_LIMIT',
	PROVIDER_SCOPE_CHANGED: 'PROVIDER_SCOPE_CHANGED',
	PAGINATION_LOOP: 'PAGINATION_LOOP',
	INPUT_INVALID: 'INPUT_INVALID',
	ORIGIN_INVALID: 'ORIGIN_INVALID',
	CSRF_INVALID: 'CSRF_INVALID',
	CREDENTIALS_INVALID: 'CREDENTIALS_INVALID',
	SIGNUP_UNAVAILABLE: 'SIGNUP_UNAVAILABLE',
	ACCESS_MISSING: 'ACCESS_MISSING',
	ACCESS_EXPIRED: 'ACCESS_EXPIRED',
	ACCESS_INVALID: 'ACCESS_INVALID',
	REFRESH_INVALID: 'REFRESH_INVALID',
	REFRESH_EXPIRED: 'REFRESH_EXPIRED',
	REFRESH_REVOKED: 'REFRESH_REVOKED',
	REFRESH_REUSED: 'REFRESH_REUSED',
	OTP_INVALID: 'OTP_INVALID',
	OTP_EXPIRED: 'OTP_EXPIRED',
	OTP_ATTEMPTS: 'OTP_ATTEMPTS',
	OTP_SENDING: 'OTP_SENDING',
	RATE_LIMITED: 'RATE_LIMITED',
	AUTH_BUSY: 'AUTH_BUSY',
	MAIL_DELIVERY_FAILED: 'MAIL_DELIVERY_FAILED',
	HTTP_ERROR: 'HTTP_ERROR',
	INFRASTRUCTURE_UNAVAILABLE: 'INFRASTRUCTURE_UNAVAILABLE',
} as const;

export type THttpErrorCode = (typeof HTTP_ERROR_CODE)[keyof typeof HTTP_ERROR_CODE];

export const HTTP_ERROR_MESSAGE = {
	RESOURCE_NOT_FOUND: 'Resource not found.',
	JOB_CONFLICT:
		'Another operation is active, or the command key was reused with different input.',
	SNAPSHOT_UNAVAILABLE: 'Choose a completed snapshot; partial data requires acknowledgment.',
	MODE_UNAVAILABLE: 'This source is unavailable in the configured mode.',
	CONNECTION_CONFLICT:
		'A live connection for this provider already exists. Replace its key or explicitly delete it to switch accounts.',
	CONNECTION_IDENTITY_MISMATCH:
		'The replacement key must belong to the same tracker user and workspace.',
	CONNECTION_BUSY:
		'A job is active for this connection. Wait for it to finish before deleting local data.',
	PROVIDER_CREDENTIALS_INVALID:
		'The tracker key is invalid, expired, or lacks required read permissions. Replace the key and retry.',
	PROVIDER_UNAVAILABLE: 'The tracker is temporarily unavailable. Please retry.',
	PROVIDER_RATE_LIMITED: 'The tracker rate limit was reached. Please retry later.',
	PROVIDER_RESPONSE_INVALID: 'The tracker returned an unsupported or incomplete response.',
	PROVIDER_RESPONSE_LIMIT:
		'A tracker response exceeded the response byte budget. Coverage is incomplete.',
	PROVIDER_FIELD_LIMIT:
		'A tracker field exceeded the storage byte budget. Coverage is incomplete.',
	PROVIDER_SCOPE_CHANGED:
		'The selected tracker resource is inaccessible or no longer belongs to this project.',
	PAGINATION_LOOP: 'Tracker pagination did not advance. Coverage is incomplete.',
	INPUT_INVALID: 'Check the submitted fields.',
	ORIGIN_INVALID: 'Request origin is not allowed.',
	CSRF_INVALID: 'Please reload and try again.',
	CREDENTIALS_INVALID: 'Email or password is incorrect.',
	SIGNUP_UNAVAILABLE: 'Unable to register this email. Try signing in.',
	SIGNUP_ALREADY_EXISTS: 'Account already exists. Sign in again.',
	ACCESS_MISSING: 'Please sign in.',
	ACCESS_EXPIRED: 'Please sign in again.',
	ACCESS_INVALID: 'Please sign in again.',
	REFRESH_INVALID: 'Please sign in again.',
	REFRESH_EXPIRED: 'Please sign in again.',
	REFRESH_REVOKED: 'Please sign in again.',
	REFRESH_REUSED: 'Please sign in again.',
	OTP_INVALID: 'The code or browser challenge is invalid.',
	OTP_EXPIRED: 'Start sign-in again.',
	OTP_INVALID_OR_EXPIRED: 'Invalid or expired code.',
	OTP_ATTEMPTS: 'Too many incorrect codes. Start again.',
	OTP_SENDING: 'Invalid or expired code.',
	RATE_LIMITED: 'Too many attempts. Please wait before trying again.',
	AUTH_BUSY: 'Please retry shortly.',
	MAIL_DELIVERY_FAILED: 'Email could not be sent. Start again.',
	HTTP_ERROR: 'Request could not be completed',
	INFRASTRUCTURE_UNAVAILABLE: 'Service temporarily unavailable. Please retry.',
} as const satisfies Record<
	THttpErrorCode | 'SIGNUP_ALREADY_EXISTS' | 'OTP_INVALID_OR_EXPIRED',
	string
>;

export const ApiError = zod.object({
	error: zod.strictObject({
		code: zod.string(),
		message: zod.string(),
		retryable: zod.boolean(),
	}),
	requestId: zod.string(),
});

export type TApiError = zod.infer<typeof ApiError>;
