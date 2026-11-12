import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { PassThrough } from 'node:stream';
import { UnauthorizedException } from '@nestjs/common';
import { HTTP_ERROR_CODE, ReportDraft } from '@self-review/contracts';
import type { TClaim, TSource } from '@self-review/contracts';
import winston from 'winston';
import { z as zod } from 'zod';
import {
	AppLogger,
	createLogWriter,
	getLogContext,
	withLogContext,
} from '@app/shared/logging/logger';
import { safeError, safeLogFields } from '@app/shared/logging/logging.utils';
import { diagnosticText } from '@app/shared/logging/logging-diagnostics';
import { nestLogger } from '@app/shared/logging/nest-logger';

function captureLogs() {
	const stream = new PassThrough();
	let content = '';
	stream.on('data', (chunk: Buffer) => {
		content += chunk.toString();
	});
	const writer = createLogWriter({ transports: [new winston.transports.Stream({ stream })] });
	return {
		logger: new AppLogger('LoggingTest', writer),
		async finish() {
			const finished = once(writer, 'finish');
			writer.end();
			await finished;
			stream.destroy();
			return {
				content,
				records: content
					.trim()
					.split('\n')
					.filter(Boolean)
					.map((line) => zod.record(zod.string(), zod.unknown()).parse(JSON.parse(line))),
			};
		},
	};
}

describe('safe Winston output', () => {
	it('redacts recognizable credentials inside otherwise useful diagnostic text', () => {
		for (const value of [
			'password=synthetic-sensitive-value',
			'{"password":"synthetic-sensitive-value"}',
			'OPENAI_API_KEY=synthetic-sensitive-value',
			'Authorization: Bearer synthetic-sensitive-value',
			'https://synthetic-user:synthetic-sensitive-value@example.test/path',
		]) {
			expect(diagnosticText(value)).not.toContain('synthetic-sensitive-value');
			expect(diagnosticText(value)).toContain('[REDACTED]');
		}
	});
	it('includes requested claim/evidence/source diagnostics and redacts credentials inside them', async () => {
		const secret = 'syntheticModelKeyWithoutStandardPrefix123456';
		vi.stubEnv('OPENAI_API_KEY', secret);
		try {
			const capture = captureLogs();
			const evidence = {
				sourceId: 'sync:synthetic:description:issue',
				quote: `A missing quote with ${secret}`,
			};
			const claim: TClaim = {
				kind: 'reported_result',
				text: 'The task reports a completed rollout.',
				evidence: [evidence],
			};
			const source: TSource = {
				id: evidence.sourceId,
				kind: 'description',
				state: 'completed',
				textExcerpt: `The source only confirms staging. ${secret}`,
				truncated: false,
				taskSnapshotId: randomUUID(),
				url: 'https://synthetic-private.example',
				createdAt: null,
				updatedAt: null,
				retrievedAt: new Date().toISOString(),
			};
			capture.logger.error('evidence_validation_failed', {
				reason: 'QUOTE_NOT_FOUND',
				claim,
				evidence,
				source,
				quoteLength: evidence.quote.length,
			});
			const result = await capture.finish();
			expect(result.records[0]).toMatchObject({
				claim: {
					kind: claim.kind,
					text: claim.text,
					evidence: [
						{ sourceId: evidence.sourceId, quote: 'A missing quote with [REDACTED]' },
					],
				},
				evidence: { sourceId: evidence.sourceId, quote: 'A missing quote with [REDACTED]' },
				source: {
					id: source.id,
					kind: 'description',
					state: 'completed',
					textExcerpt: 'The source only confirms staging. [REDACTED]',
				},
			});
			expect(result.content).not.toContain(secret);
			expect(result.content).not.toContain(source.url);
		} finally {
			vi.unstubAllEnvs();
		}
	});

	it('bounds diagnostic arrays and text without splitting Unicode characters', async () => {
		const capture = captureLogs();
		const evidence = { sourceId: 'synthetic-source', quote: '🙂'.repeat(900) };
		capture.logger.error('evidence_validation_failed', {
			evidence,
			availableSourceIds: Array.from({ length: 50 }, (unused, index) => `source-${index}`),
			childEvidence: Array.from({ length: 20 }, () => evidence),
		});
		const result = await capture.finish();
		expect(result.records[0]).toMatchObject({
			availableSourceIds: expect.any(Array),
			availableSourceIdsTruncated: true,
			evidence: { quote: '🙂'.repeat(512) + '[TRUNCATED]' },
		});
		expect(result.records[0]?.availableSourceIds).toHaveLength(20);
		expect(result.records[0]?.childEvidence).toHaveLength(8);
	});
	it('writes JSON with safe codes and source frames, dropping raw errors and unknown metadata', async () => {
		const capture = captureLogs();
		const secret = 'private-synthetic-password-api-key-and-prompt';
		const error = Object.assign(new Error(secret), {
			code: 'ECONNREFUSED',
			status: 503,
			headers: { authorization: secret },
			body: secret,
			cause: new Error(secret),
		});
		error.stack = `Error: ${secret}\n${secret}\n    at operation (/app/backend/src/main.ts:12:3)`;
		const requestId = randomUUID();
		const fields = {
			error,
			requestId,
			reason: secret,
			method: 'POST',
			password: secret,
			cookie: secret,
			prompt: secret,
		};
		capture.logger.error('operation_failed', fields);
		const result = await capture.finish();

		expect(result.records).toHaveLength(1);
		expect(result.records[0]).toMatchObject({
			level: 'error',
			message: 'operation_failed',
			context: 'LoggingTest',
			requestId,
			method: 'POST',
			error: { code: 'ECONNREFUSED', status: 503, frames: ['backend/src/main.ts:12:3'] },
		});
		expect(result.records[0]?.timestamp).toEqual(expect.any(String));
		expect(result.content).not.toContain(secret);
		expect(result.records[0]).not.toHaveProperty('reason');
		expect(result.records[0]).not.toHaveProperty('password');
	});

	it('keeps request/run/batch context isolated across concurrent asynchronous operations', async () => {
		const capture = captureLogs();
		const contexts = Array.from({ length: 2 }, () => ({
			requestId: randomUUID(),
			runId: randomUUID(),
			batchId: randomUUID(),
		}));
		await Promise.all(
			contexts.map((context) =>
				withLogContext({ requestId: context.requestId }, async () => {
					await new Promise<void>((resolve) => setImmediate(resolve));
					await withLogContext(
						{ runId: context.runId, batchId: context.batchId },
						async () => {
							await new Promise<void>((resolve) => setImmediate(resolve));
							capture.logger.error('unit_failed', { reason: 'QUOTE_NOT_FOUND' });
						},
					);
					expect(getLogContext()).toEqual({ requestId: context.requestId });
				}),
			),
		);
		expect(getLogContext()).toBeUndefined();
		const result = await capture.finish();
		expect(result.records).toHaveLength(2);
		for (const context of contexts) {
			expect(result.records.find((record) => record.runId === context.runId)).toMatchObject(
				context,
			);
		}
	});

	it('records schema codes and known field paths without rejected values or dynamic keys', () => {
		const secret = 'private-synthetic-source-text';
		const schema = zod.object({
			findings: zod.array(zod.object({ quote: zod.enum([secret]) })),
		});
		const parsed = schema.safeParse({ findings: [{ quote: 'rejected' }] });
		expect(parsed.success).toBe(false);
		const details = safeError(parsed.error);
		expect(details).toMatchObject({
			type: 'ZodError',
			issues: [{ code: 'invalid_value', path: 'findings.0.quote' }],
		});
		expect(JSON.stringify(details)).not.toContain(secret);
		const dynamic = zod.record(zod.string(), zod.number()).safeParse({ [secret]: secret });
		expect(JSON.stringify(safeError(dynamic.error))).not.toContain(secret);
	});

	it('keeps public HTTP codes while discarding private response bodies and causes', () => {
		const secret = 'private-synthetic-cookie';
		const error = new UnauthorizedException({
			code: HTTP_ERROR_CODE.ACCESS_INVALID,
			message: secret,
			retryable: false,
		});
		expect(safeError(error)).toEqual({
			type: 'HttpException',
			status: 401,
			code: HTTP_ERROR_CODE.ACCESS_INVALID,
		});
		expect(safeError({ message: secret, body: secret })).toEqual({ type: 'UnknownError' });
	});

	it('does not pass raw Nest messages or stack strings to application logs', () => {
		const log = vi.spyOn(AppLogger.prototype, 'error');
		try {
			nestLogger.error(
				'private-synthetic-sdk-body',
				'private-synthetic-sdk-stack',
				'SdkContext',
			);
			expect(log).toHaveBeenCalledWith('nest_error', { error: undefined });
		} finally {
			log.mockRestore();
		}
	});

	it('honors the configured log level', async () => {
		vi.stubEnv('LOG_LEVEL', 'warn');
		try {
			const capture = captureLogs();
			capture.logger.info('hidden_information');
			capture.logger.error('visible_failure');
			const result = await capture.finish();
			expect(result.records.map((record) => record.message)).toEqual(['visible_failure']);
		} finally {
			vi.unstubAllEnvs();
		}
	});
});

it('logs only bounded agent progress metadata and concrete aggregate schema constraints', () => {
	const secret = 'private-synthetic-prompt-or-key';
	const fields = {
		attempt: 2,
		phase: 'review-reduce',
		batchLevel: 1,
		durationMs: 125,
		requestBytes: 2000,
		sourceCount: 12,
		inputTokens: 100,
		outputTokens: 50,
		usageKnown: true,
		providerStatus: 'incomplete',
		incompleteReason: 'max_output_tokens',
		prompt: secret,
		output: secret,
	};
	expect(safeLogFields(fields)).toMatchObject({
		attempt: 2,
		phase: 'review-reduce',
		batchLevel: 1,
		durationMs: 125,
		requestBytes: 2000,
		sourceCount: 12,
		inputTokens: 100,
		outputTokens: 50,
		usageKnown: true,
		providerStatus: 'incomplete',
		incompleteReason: 'max_output_tokens',
	});
	expect(JSON.stringify(safeLogFields(fields))).not.toContain(secret);
	const claim = {
		kind: 'task_description',
		text: 'Synthetic plan',
		evidence: [{ sourceId: 'synthetic', quote: 'Plan' }],
	};
	const parsed = ReportDraft.safeParse({
		schemaVersion: '1.0',
		groups: [
			{ title: 'First', claims: Array.from({ length: 5 }, () => claim) },
			{ title: 'Second', claims: Array.from({ length: 5 }, () => claim) },
		],
		limitations: [],
		explanation: 'Synthetic test',
	});
	expect(safeError(parsed.error)).toMatchObject({
		type: 'ZodError',
		issues: [
			{ code: 'custom', path: 'groups', constraint: 'total_claims', maximum: 8, actual: 10 },
		],
	});
});
