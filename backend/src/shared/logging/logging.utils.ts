import { HttpException } from '@nestjs/common';
import { ApiError } from '@self-review/contracts';
import { z as zod } from 'zod';
import type { ILogFields } from './logging.interfaces.js';
import { validationLogDetails } from './logging-diagnostics.js';

const ERROR_MESSAGES = new Set([
	'INVALID_MODEL_OUTPUT',
	'GUARDRAIL_VIOLATION',
	'BUDGET_EXHAUSTED',
	'UNIT_TIMEOUT',
	'RUN_INTERRUPTED',
	'MODEL_REFUSAL',
	'MODEL_CONFIGURATION',
	'PAGINATION_LOOP',
	'INSUFFICIENT_DATA',
	'PROVIDER_READ_FAILED',
	'SMTP rejected',
	'Unexpected OTP verification result',
	'Conditional consumption failed',
	'APP_ORIGIN must be an HTTPS origin or a loopback HTTP origin',
	'Independent authentication/encryption secrets are required',
]);

const ERROR_CODES = new Set([
	'ECONNREFUSED',
	'ECONNRESET',
	'ETIMEDOUT',
	'ENOTFOUND',
	'EAI_AGAIN',
	'EDNS',
	'EAUTH',
	'ESOCKET',
	'ETLS',
	'ECONNECTION',
	'EENVELOPE',
	'ERR_JWT_EXPIRED',
	'ERR_JWT_INVALID',
	'ERR_JWS_INVALID',
	'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
	'ERR_JWT_CLAIM_VALIDATION_FAILED',
	'invalid_api_key',
	'insufficient_quota',
	'model_not_found',
	'rate_limit_exceeded',
	'23505',
	'23503',
	'23514',
	'40001',
	'40P01',
	'42P01',
	'08006',
	'57P01',
]);

const LABELS = {
	reason: new Set([
		...ERROR_MESSAGES,
		'INVALID_APP_ORIGIN',
		'INVALID_AUTH_SECRETS',
		'ACCESS_CLAIMS_INVALID',
		'REFRESH_CONSUMPTION_FAILED',
		'OTP_VERIFICATION_UNEXPECTED',
		'SMTP_REJECTED',
		'EMPTY_QUOTE',
		'EMPTY_SOURCE',
		'SOURCE_NOT_EXPOSED',
		'QUOTE_NOT_FOUND',
		'REDUCER_EVIDENCE_NOT_IN_CHILD',
		'TASK_STATE_NOT_RESULT',
		'METADATA_ONLY_RESULT',
		'MEASUREMENT_WITHOUT_DIGITS',
		'SCHEMA_INVALID',
		'JSON_INVALID',
		'RESULT_VALIDATION_FAILED',
	]),
	method: new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
	stage: new Set([
		'queued',
		'listing',
		'reading',
		'analyzing',
		'reducing',
		'reviewing',
		'finished',
	]),
	state: new Set(['queued', 'running', 'succeeded', 'partial', 'failed']),
	tool: new Set(['list_issues', 'get_issue_details', 'get_issue_comments']),
};

const SCHEMA_FIELDS = new Set([
	'schemaVersion',
	'findings',
	'groups',
	'claims',
	'title',
	'kind',
	'text',
	'evidence',
	'sourceId',
	'quote',
	'limitations',
	'explanation',
	'issueId',
	'issueIds',
	'runId',
	'taskIds',
	'selection',
	'mode',
	'startDate',
	'endDate',
	'baseSyncRunId',
	'syncRunId',
	'generateReview',
	'allowPartial',
	'idempotencyKey',
	'email',
	'password',
	'challengeId',
	'code',
	'provider',
	'APP_ORIGIN',
	'OPENAI_API_KEY',
	'OPENAI_MODEL',
	'APP_MODE',
	'DATABASE_URL',
	'REDIS_URL',
	'AUTH_SECRET',
	'JWT_SECRET',
	'TOKEN_ENCRYPTION_KEY',
	'SMTP_HOST',
	'SMTP_PORT',
	'SMTP_SECURE',
	'SMTP_USER',
	'SMTP_PASSWORD',
	'SMTP_FROM',
	'MAIL_DELIVERY',
	'PORT',
	'REDIS_PREFIX',
	'LOG_LEVEL',
]);

export function safeFieldPath(path: PropertyKey[]): string {
	return path
		.slice(0, 10)
		.map((part) => {
			if (typeof part === 'number') {
				return part;
			}
			return SCHEMA_FIELDS.has(String(part)) ? String(part) : '[field]';
		})
		.join('.');
}

export function safeError(error: unknown): Record<string, unknown> {
	if (error instanceof HttpException) {
		const payload = ApiError.shape.error.safeParse(error.getResponse());
		return {
			type: 'HttpException',
			status: error.getStatus(),
			...(payload.success ? { code: payload.data.code } : {}),
		};
	}
	if (!(error instanceof Error)) {
		return { type: 'UnknownError' };
	}
	const result: Record<string, unknown> = { type: 'Error' };
	if (error instanceof SyntaxError) {
		result.type = 'SyntaxError';
	} else if (error instanceof TypeError) {
		result.type = 'TypeError';
	}
	if (error instanceof zod.ZodError) {
		result.type = 'ZodError';
		result.issues = error.issues.slice(0, 12).map((issue) => {
			const details: Record<string, unknown> = {
				code: issue.code,
				path: safeFieldPath(issue.path),
			};
			if (
				'expected' in issue &&
				[
					'string',
					'number',
					'boolean',
					'bigint',
					'symbol',
					'undefined',
					'object',
					'function',
					'map',
					'set',
					'date',
					'file',
					'array',
					'tuple',
					'record',
					'null',
					'never',
				].includes(issue.expected)
			) {
				details.expected = issue.expected;
			}
			if (
				'minimum' in issue &&
				typeof issue.minimum === 'number' &&
				Number.isFinite(issue.minimum)
			) {
				details.minimum = issue.minimum;
			}
			if (
				'maximum' in issue &&
				typeof issue.maximum === 'number' &&
				Number.isFinite(issue.maximum)
			) {
				details.maximum = issue.maximum;
			}
			return details;
		});
	} else if (ERROR_MESSAGES.has(error.message)) {
		result.code = error.message;
	}
	const code = 'code' in error ? error.code : undefined;
	if (typeof code === 'string' && (ERROR_CODES.has(code) || /^P\d{4}$/.test(code))) {
		result.code = code;
	}
	const status = 'status' in error ? error.status : undefined;
	if (typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599) {
		result.status = status;
	}
	const frames = error.stack
		?.split('\n')
		.slice(1)
		.flatMap((line) => {
			const frame =
				/^\s+at .*?(backend\/(?:src|dist)\/[a-zA-Z0-9_./-]+\.[cm]?[jt]s:\d+:\d+)\)?$/.exec(
					line,
				);
			return frame ? [frame[1]] : [];
		})
		.slice(0, 6);
	if (frames?.length) {
		result.frames = frames;
	}
	return result;
}

export function safeLogFields(fields: ILogFields): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const key of ['requestId', 'runId', 'batchId', 'taskId'] as const) {
		const value = fields[key];
		if (
			typeof value === 'string' &&
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
		) {
			result[key] = value;
		}
	}
	for (const key of [
		'attempt',
		'claimIndex',
		'evidenceIndex',
		'count',
		'availableSourceCount',
		'quoteLength',
		'sourceExcerptLength',
		'bytes',
		'port',
		'status',
	] as const) {
		const value = fields[key];
		if (typeof value === 'number' && Number.isFinite(value)) {
			result[key] = value;
		}
	}
	for (const key of ['reason', 'method', 'stage', 'state', 'tool'] as const) {
		const value = fields[key];
		if (typeof value === 'string' && LABELS[key].has(value)) {
			result[key] = value;
		}
	}
	if (fields.fields) {
		result.fields = fields.fields.slice(0, 12).map((field) => safeFieldPath(field.split('.')));
	}
	if (fields.error !== undefined) {
		result.error = safeError(fields.error);
	}
	return { ...result, ...validationLogDetails(fields) };
}
