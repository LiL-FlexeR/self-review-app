import { beforeAll, afterAll, it, expect } from 'vitest';
import request from 'supertest';
import OpenAI from 'openai';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { format, resolveConfig } from 'prettier';
import { createTestApp } from './support/create-test-app.js';
import type { IRuntime } from './support/create-test-app.js';
import { config } from '@app/shared/config/config.schema';
import { FixtureService } from '@app/modules/providers/adapters/fixture/fixture.service';
import { ProcessorService } from '@app/modules/jobs/services/processor.service';
import { QueueService } from '@app/modules/jobs/services/queue.service';
import { ModelClient } from '@app/modules/agent/services/model-client.service';
import { reductionInput } from '@app/modules/agent/utils/reduction-model-draft';
import { ReviewView, JobView } from '@self-review/contracts';
const configuration = config();
let runtime: IRuntime;
const codes = new Map<string, string>();
let jar: string[];
let csrf: string;
let projects: { id: string; externalId: string }[];
const cookies = (response: { headers: Record<string, unknown> }) =>
	((response.headers['set-cookie'] as string[]) ?? []).map((value) => value.split(';')[0]!);
const get = (path: string) =>
	request(runtime.app.getHttpServer())
		.get('/api' + path)
		.set('Cookie', jar);
const post = (path: string, body: object) =>
	request(runtime.app.getHttpServer())
		.post('/api' + path)
		.set('Origin', configuration.APP_ORIGIN)
		.set('Cookie', jar ?? [])
		.set('X-CSRF-Token', csrf ?? '')
		.send(body);
async function terminal(runId: string) {
	for (let iteration = 0; iteration < 200; iteration++) {
		const response = await get(`/jobs/${runId}`);
		expect(response.status).toBe(200);
		const state = JobView.parse(response.body);
		if (!['queued', 'running'].includes(state.state)) {
			return state;
		}
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
	throw new Error('Workflow did not terminate');
}
const period = { mode: 'period', startDate: '2026-10-01', endDate: '2026-10-31' };
let sampleId: string;
let sampleReportId: string;
let largeSampleId: string;
beforeAll(async () => {
	if (
		!configuration.DATABASE_URL.endsWith('/self_review_test') ||
		!configuration.REDIS_URL.endsWith('/15')
	) {
		throw new Error('Isolated storage required');
	}
	runtime = await createTestApp({
		config: { ...configuration, APP_MODE: 'offline' },
		worker: true,
		mail: {
			verify: async () => undefined,
			async send(email, code) {
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
	const connection = await post('/connections', { provider: 'fixture' });
	expect(connection.status).toBe(201);
	expect(JSON.stringify(connection.body)).not.toContain('encryptedCredentials');
	const catalog = await get(`/connections/${connection.body.id}/projects`);
	projects = catalog.body.items;
}, 30000);
afterAll(async () => {
	await runtime?.close();
});

it('runs authenticated sync, tools, automatic review, persisted SSE and exports', async () => {
	const project = projects.find((item) => item.externalId === 'demo-platform')!;
	const body = { selection: period, generateReview: true, idempotencyKey: randomUUID() };
	const accepted = await post(`/projects/${project.id}/syncs`, body);
	expect(accepted.status).toBe(202);
	sampleId = accepted.body.runId;
	const sync = await terminal(sampleId);
	expect(sync.errorCode).toBeNull();
	expect(sync.state).toBe('succeeded');
	expect(sync.counts.saved).toBe(6);
	expect(sync.reviewRunId).not.toBeNull();
	const review = await terminal(sync.reviewRunId!);
	expect(review.state).toBe('succeeded');
	const source = await runtime.db.jobRun.findUniqueOrThrow({ where: { id: sampleId } });
	sampleReportId = source.currentReviewReportId!;
	const report = ReviewView.parse((await get(`/reviews/${sampleReportId}`)).body);
	expect(review.resultRef).toBe(report.id);
	expect((await get(`/reviews/${review.resultRef}`)).status).toBe(200);
	expect(report.subjectSourceUserId).toBe('demo-anna');
	expect(report.markdown).toContain('1200');
	expect(report.sources.every((source) => source.id.startsWith('sync:' + sampleId + ':'))).toBe(
		true,
	);
	const reviewLeaves = await runtime.db.analysisBatch.findMany({
		where: { runId: sync.reviewRunId!, level: 0 },
	});
	expect(reviewLeaves.flatMap((batch) => batch.inputIds as string[])).toHaveLength(5);
	const trace = await get(`/jobs/${sampleId}/trace`);
	expect(JSON.stringify(trace.body)).toContain('get_issue_comments');
	expect(JSON.stringify(trace.body)).not.toContain('encrypted_content');
	const attempts = await runtime.db.modelAttempt.count({ where: { runId: sampleId } });
	const replay = await post(`/projects/${project.id}/syncs`, body);
	expect(replay.body.runId).toBe(sampleId);
	await runtime.app.get(ProcessorService).execute(sampleId);
	expect(await runtime.db.modelAttempt.count({ where: { runId: sampleId } })).toBe(attempts);
	expect(
		await runtime.db.jobRun.count({
			where: { sourceSyncRunId: sampleId, trigger: 'automatic' },
		}),
	).toBe(1);
	const conflict = await post(`/projects/${project.id}/syncs`, {
		...body,
		generateReview: false,
	});
	expect(conflict.status).toBe(409);
	const crossProject = await post(
		`/projects/${projects.find((item) => item.externalId === 'demo-137')!.id}/syncs`,
		body,
	);
	expect(crossProject.status).toBe(409);
	const event = await get(`/jobs/${sampleId}/events`);
	expect(event.text).toContain(`id: ${sampleId}/`);
	expect(event.text).toContain('"state":"succeeded"');
	await mkdir('docs/examples', { recursive: true });
	const fixture = runtime.app.get(FixtureService);
	const inputPage = await fixture.list('demo-platform', 0);
	const inputTasks = await Promise.all(
		inputPage.items.map(async (task) => ({
			...task,
			availableComments: await fixture.comments(task.externalId),
		})),
	);
	await writeFile(
		'docs/examples/offline-input.json',
		await format(
			JSON.stringify({
				mode: 'offline',
				project: 'demo-platform',
				selection: period,
				subjectSourceUserId: 'demo-anna',
				tasks: inputTasks,
			}),
			{ ...(await resolveConfig('docs/examples/offline-input.json')), parser: 'json' },
		),
	);
	await writeFile('docs/examples/offline-review.json', JSON.stringify(report, null, '\t') + '\n');
	await writeFile('docs/examples/offline-review.md', report.markdown + '\n');
	await writeFile(
		'docs/examples/offline-trace.json',
		JSON.stringify(trace.body, null, '\t') + '\n',
	);
}, 30000);

it('imports 137 tasks across pages, covers every leaf and reduces the last batch', async () => {
	const project = projects.find((item) => item.externalId === 'demo-137')!;
	const accepted = await post(`/projects/${project.id}/syncs`, {
		selection: period,
		generateReview: true,
		idempotencyKey: randomUUID(),
	});
	const sync = await terminal(accepted.body.runId);
	expect(sync.state).toBe('succeeded');
	expect(sync.counts.saved).toBe(137);
	largeSampleId = sync.runId;
	const leaves = await runtime.db.analysisBatch.findMany({
		where: { runId: sync.runId, level: 0 },
	});
	expect(leaves).toHaveLength(14);
	expect(new Set(leaves.flatMap((batch) => batch.inputIds as string[])).size).toBe(137);
	const review = await terminal(sync.reviewRunId!);
	expect(review.state).toBe('succeeded');
	const source = await runtime.db.jobRun.findUniqueOrThrow({
		where: { id: sync.runId },
		include: { currentReviewReport: true },
	});
	expect(source.currentReviewReport?.markdown).toContain('137');
	const units = await runtime.db.analysisBatch.findMany({ where: { runId: review.runId } });
	expect(units.filter((batch) => batch.level === 0)).toHaveLength(14);
	expect(units.every((batch) => batch.state === 'succeeded')).toBe(true);
}, 30000);

it('rejects invalid reducer references after one correction and preserves the current report', async () => {
	const project = projects.find((item) => item.externalId === 'demo-137')!;
	const before = await runtime.db.jobRun.findUniqueOrThrow({ where: { id: largeSampleId } });
	const model = runtime.app.get(ModelClient);
	const original = model.respond.bind(model);
	let reducerCalls = 0;
	model.respond = async (input) => {
		if (!input.childClaims) {
			return original(input);
		}
		reducerCalls++;
		const first = input.history[0];
		expect(first).toHaveProperty('role', 'user');
		if (!first || !('content' in first) || typeof first.content !== 'string') {
			throw new Error('Missing reducer input');
		}
		const supplied = JSON.parse(first.content);
		expect(supplied.childClaims).toEqual(
			reductionInput(input.childClaims, input.sources).childClaims,
		);
		expect(supplied.evidenceRegistry).toEqual(
			reductionInput(input.childClaims, input.sources).evidenceRegistry,
		);
		return {
			output: [],
			responseId: null,
			usage: null,
			text: JSON.stringify({
				schemaVersion: '1.0',
				groupTitles: ['Area', '', '', ''],
				claims: [
					{
						kind: 'task_description',
						text: 'Synthetic plan',
						groupIndex: 0,
						evidenceRefs: [99999],
					},
				],
				limitations: [],
				explanation: 'Invalid synthetic selection.',
			}),
		};
	};
	try {
		const accepted = await post(`/projects/${project.id}/reviews`, {
			syncRunId: largeSampleId,
			idempotencyKey: randomUUID(),
		});
		const review = await terminal(accepted.body.runId);
		expect(review.state).toBe('failed');
		expect(review.errorCode).toBe('INVALID_MODEL_OUTPUT');
		expect(reducerCalls).toBe(2);
		const after = await runtime.db.jobRun.findUniqueOrThrow({ where: { id: largeSampleId } });
		expect(after.currentReviewReportId).toBe(before.currentReviewReportId);
		const failed = await runtime.db.analysisBatch.findFirstOrThrow({
			where: { runId: review.runId, state: 'failed' },
		});
		expect(JSON.stringify(failed.trace)).toContain('evidenceRefs');
		expect(await runtime.db.reviewReport.count({ where: { reviewRunId: review.runId } })).toBe(
			0,
		);
	} finally {
		model.respond = original;
	}
}, 30000);

it('merges validated empty sync/review children with full coverage and no reducer model requests', async () => {
	const project = projects.find((item) => item.externalId === 'demo-137')!;
	const model = runtime.app.get(ModelClient);
	const original = model.respond.bind(model);
	let reducerCalls = 0;
	let reviewCalls = 0;
	model.respond = async (input) => {
		if (input.childClaims) {
			reducerCalls++;
			throw new Error('Empty children must not trigger a model request');
		}
		if (input.forcedTool) {
			return original(input);
		}
		if (input.report) {
			reviewCalls++;
		}
		return {
			output: [],
			responseId: null,
			usage: null,
			text: JSON.stringify({
				schemaVersion: '1.0',
				...(input.report
					? { groupTitles: ['', '', '', ''], claims: [] }
					: { findings: [] }),
				limitations: ['Synthetic evidence does not establish an outcome.'],
				explanation: 'No supported claims.',
			}),
		};
	};
	try {
		const accepted = await post(`/projects/${project.id}/syncs`, {
			selection: period,
			generateReview: true,
			idempotencyKey: randomUUID(),
		});
		const sync = await terminal(accepted.body.runId);
		expect(sync.state).toBe('succeeded');
		expect(sync.counts.saved).toBe(137);
		const review = await terminal(sync.reviewRunId!);
		expect(review.state).toBe('succeeded');
		expect(reducerCalls).toBe(0);
		expect(reviewCalls).toBe(14);
		for (const runId of [sync.runId, review.runId]) {
			const batches = await runtime.db.analysisBatch.findMany({ where: { runId } });
			expect(batches).toHaveLength(19);
			expect(batches.every((batch) => batch.state === 'succeeded')).toBe(true);
			expect(
				new Set(
					batches
						.filter((batch) => batch.level === 0)
						.flatMap((batch) => batch.inputIds as string[]),
				).size,
			).toBe(137);
			expect(
				batches
					.filter((batch) => batch.level > 0)
					.every((batch) => JSON.stringify(batch.trace).includes('empty_reduction')),
			).toBe(true);
		}
		const source = await runtime.db.jobRun.findUniqueOrThrow({
			where: { id: sync.runId },
			include: { currentReviewReport: true },
		});
		expect(source.currentReviewReport).not.toBeNull();
		expect(
			ReviewView.parse((await get(`/reviews/${source.currentReviewReportId}`)).body).draft
				.groups,
		).toEqual([]);
	} finally {
		model.respond = original;
	}
}, 30000);

it('refreshes only selected source IDs and copies immutable provenance', async () => {
	const project = projects.find((item) => item.externalId === 'demo-platform')!;
	const base = await runtime.db.taskSnapshot.findMany({
		where: { syncRunId: sampleId },
		orderBy: { externalId: 'asc' },
	});
	const fixture = runtime.app.get(FixtureService);
	fixture.reads.length = 0;
	const accepted = await post(`/projects/${project.id}/syncs`, {
		selection: { mode: 'tasks', baseSyncRunId: sampleId, taskIds: [base[0]!.id] },
		idempotencyKey: randomUUID(),
	});
	const sync = await terminal(accepted.body.runId);
	expect(sync.state).toBe('succeeded');
	expect(sync.counts.saved).toBe(6);
	expect(sync.reviewRunId).toBeNull();
	expect(fixture.reads.every((read) => read.endsWith('DEMO-101'))).toBe(true);
	const copies = await runtime.db.taskSnapshot.findMany({
		where: { syncRunId: sync.runId },
		orderBy: { externalId: 'asc' },
	});
	for (let index = 1; index < base.length; index++) {
		expect(copies[index]!.retrievedAt).toEqual(base[index]!.retrievedAt);
		expect(copies[index]!.copiedFromSnapshotId).toBe(base[index]!.id);
	}
	expect(
		(await runtime.db.jobRun.findUniqueOrThrow({ where: { id: sampleId } }))
			.currentReviewReportId,
	).toBe(sampleReportId);
	const manual = await post(`/projects/${project.id}/reviews`, {
		syncRunId: sampleId,
		idempotencyKey: randomUUID(),
	});
	expect((await terminal(manual.body.runId)).state).toBe('succeeded');
	const updated = await runtime.db.jobRun.findUniqueOrThrow({ where: { id: sampleId } });
	expect(updated.currentReviewReportId).not.toBe(sampleReportId);
	expect(await runtime.db.reviewReport.count({ where: { sourceSyncRunId: sampleId } })).toBe(2);
}, 30000);

it('preserves previous report on invalid regeneration and skips auto-review on partial sync', async () => {
	const project = projects.find((item) => item.externalId === 'demo-platform')!;
	const old = (await runtime.db.jobRun.findUniqueOrThrow({ where: { id: sampleId } }))
		.currentReviewReportId;
	const model = runtime.app.get(ModelClient);
	const original = model.respond.bind(model);
	model.respond = async () => ({
		output: [],
		text: '{"fabricated":true}',
		usage: null,
		responseId: null,
	});
	try {
		const manual = await post(`/projects/${project.id}/reviews`, {
			syncRunId: sampleId,
			idempotencyKey: randomUUID(),
		});
		expect((await terminal(manual.body.runId)).state).toBe('failed');
		expect(
			(await runtime.db.jobRun.findUniqueOrThrow({ where: { id: sampleId } }))
				.currentReviewReportId,
		).toBe(old);
		const sync = await post(`/projects/${project.id}/syncs`, {
			selection: period,
			generateReview: true,
			idempotencyKey: randomUUID(),
		});
		const state = await terminal(sync.body.runId);
		expect(state.state).toBe('partial');
		expect(state.counts.saved).toBe(6);
		expect(state.reviewRunId).toBeNull();
		expect(state.autoReview).toContain('skipped');
	} finally {
		model.respond = original;
	}
});

it('rejects another account across project, task, report, run and SSE boundaries', async () => {
	const firstJar = jar;
	const firstCsrf = csrf;
	const email = randomUUID() + '@example.test';
	const signup = await post('/auth/signup', { email, password: 'synthetic-password-123' });
	jar = cookies(signup);
	const verified = await post('/auth/verify-otp', {
		challengeId: signup.body.challengeId,
		code: codes.get(email),
	});
	jar = cookies(verified);
	csrf = verified.body.csrfToken;
	const task = await runtime.db.taskSnapshot.findFirstOrThrow({ where: { syncRunId: sampleId } });
	for (const path of [
		`/projects/${projects[0]!.id}`,
		`/jobs/${sampleId}`,
		`/jobs/${sampleId}/events`,
		`/tasks/${task.id}`,
		`/reviews/${sampleReportId}`,
	]) {
		expect((await get(path)).status).toBe(404);
	}
	jar = firstJar;
	csrf = firstCsrf;
});

it('keeps the previous report and rolls back terminal publication on SQL failure', async () => {
	const project = projects.find((item) => item.externalId === 'demo-platform')!;
	const old = (await runtime.db.jobRun.findUniqueOrThrow({ where: { id: sampleId } }))
		.currentReviewReportId;
	const count = await runtime.db.reviewReport.count({ where: { sourceSyncRunId: sampleId } });
	await runtime.db.$executeRawUnsafe(
		"CREATE FUNCTION s02_reject_report() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic publication failure'; END $$",
	);
	await runtime.db.$executeRawUnsafe(
		'CREATE TRIGGER s02_reject_report BEFORE INSERT ON review_reports FOR EACH ROW EXECUTE FUNCTION s02_reject_report()',
	);
	try {
		const accepted = await post(`/projects/${project.id}/reviews`, {
			syncRunId: sampleId,
			idempotencyKey: randomUUID(),
		});
		const failed = await terminal(accepted.body.runId);
		expect(failed.state).toBe('failed');
		expect(
			(await runtime.db.jobRun.findUniqueOrThrow({ where: { id: sampleId } }))
				.currentReviewReportId,
		).toBe(old);
		expect(await runtime.db.reviewReport.count({ where: { sourceSyncRunId: sampleId } })).toBe(
			count,
		);
	} finally {
		await runtime.db.$executeRawUnsafe('DROP TRIGGER s02_reject_report ON review_reports');
		await runtime.db.$executeRawUnsafe('DROP FUNCTION s02_reject_report()');
	}
});

it('retains stale selected copies, requires partial acknowledgment and publishes labeled partial review', async () => {
	const project = projects.find((item) => item.externalId === 'demo-platform')!;
	const base = await runtime.db.taskSnapshot.findFirstOrThrow({
		where: { syncRunId: sampleId, externalId: 'DEMO-101' },
	});
	const fixture = runtime.app.get(FixtureService);
	const original = fixture.details.bind(fixture);
	fixture.details = async () => {
		throw new Error('Synthetic unavailable details');
	};
	let partialId: string;
	try {
		const accepted = await post(`/projects/${project.id}/syncs`, {
			selection: { mode: 'tasks', baseSyncRunId: sampleId, taskIds: [base.id] },
			generateReview: true,
			idempotencyKey: randomUUID(),
		});
		const partial = await terminal(accepted.body.runId);
		partialId = partial.runId;
		expect(partial.state).toBe('partial');
		expect(partial.reviewRunId).toBeNull();
		const copy = await runtime.db.taskSnapshot.findFirstOrThrow({
			where: { syncRunId: partialId, externalId: 'DEMO-101' },
		});
		expect(copy.refreshStatus).toBe('stale');
		expect(copy.retrievedAt).toEqual(base.retrievedAt);
		expect(copy.commentReadState).toBe(base.commentReadState);
	} finally {
		fixture.details = original;
	}
	expect(
		(
			await post(`/projects/${project.id}/reviews`, {
				syncRunId: partialId!,
				idempotencyKey: randomUUID(),
			})
		).status,
	).toBe(400);
	const review = await post(`/projects/${project.id}/reviews`, {
		syncRunId: partialId!,
		allowPartial: true,
		idempotencyKey: randomUUID(),
	});
	const outcome = await terminal(review.body.runId);
	expect(outcome.state).toBe('partial');
	const reportResponse = await get(`/reviews/${outcome.resultRef}`);
	expect(reportResponse.status).toBe(200);
	const report = ReviewView.parse(reportResponse.body);
	expect(report.reviewRunId).toBe(outcome.runId);
	expect(report.sourceSyncRunId).toBe(partialId!);
	expect(report.state).toBe('partial');
});

it('completes empty selection without model calls and reads description evidence without comments', async () => {
	const project = projects.find((item) => item.externalId === 'demo-evidence')!;
	const fixture = runtime.app.get(FixtureService);
	fixture.reads.length = 0;
	const accepted = await post(`/projects/${project.id}/syncs`, {
		selection: period,
		idempotencyKey: randomUUID(),
	});
	const state = await terminal(accepted.body.runId);
	expect(state.state).toBe('succeeded');
	expect(fixture.reads.filter((read) => read.startsWith('comments:'))).toHaveLength(0);
	const empty = await post(`/projects/${project.id}/syncs`, {
		selection: { mode: 'period', startDate: '2027-01-01', endDate: '2027-01-31' },
		generateReview: true,
		idempotencyKey: randomUUID(),
	});
	const done = await terminal(empty.body.runId);
	expect(done.state).toBe('succeeded');
	expect(done.counts.saved).toBe(0);
	expect(await runtime.db.modelAttempt.count({ where: { runId: done.runId } })).toBe(0);
	expect((await terminal(done.reviewRunId!)).state).toBe('succeeded');
	expect(await runtime.db.modelAttempt.count({ where: { runId: done.reviewRunId! } })).toBe(0);
});

it('continues after SSE disconnect and exposes the same persisted outcome after API restart', async () => {
	const project = projects.find((item) => item.externalId === 'demo-platform')!;
	const model = runtime.app.get(ModelClient);
	const original = model.respond.bind(model);
	let release: (() => void) | undefined;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	let gated = false;
	model.respond = async (input) => {
		if (!gated) {
			gated = true;
			await gate;
		}
		return original(input);
	};
	await runtime.app.listen(0, '127.0.0.1');
	const address = runtime.app.getHttpServer().address() as { port: number };
	const accepted = await post(`/projects/${project.id}/syncs`, {
		selection: period,
		idempotencyKey: randomUUID(),
	});
	try {
		const response = await fetch(
			`http://127.0.0.1:${address.port}/api/jobs/${accepted.body.runId}/events`,
			{ headers: { Cookie: jar.join('; ') } },
		);
		expect(response.status).toBe(200);
		const reader = response.body!.getReader();
		const first = await reader.read();
		expect(new TextDecoder().decode(first.value)).toContain(accepted.body.runId);
		await reader.cancel();
	} finally {
		release!();
	}
	const finished = await terminal(accepted.body.runId);
	model.respond = original;
	expect(finished.state).toBe('succeeded');
	await runtime.close();
	runtime = await createTestApp({
		config: { ...configuration, APP_MODE: 'offline' },
		worker: true,
		mail: {
			verify: async () => undefined,
			async send(email, code) {
				codes.set(email, code);
			},
		},
	});
	const restored = await get(`/jobs/${accepted.body.runId}`);
	expect(restored.body.state).toBe('succeeded');
	expect(restored.body.version).toBe(finished.version);
	const tasks = await get(`/projects/${project.id}/tasks?syncRunId=${accepted.body.runId}`);
	expect(tasks.body.items).toHaveLength(6);
});

it('reconciles a committed enqueue gap without accepting a second command', async () => {
	const project = projects.find((item) => item.externalId === 'demo-platform')!;
	const queue = runtime.app.get(QueueService);
	const original = queue.enqueue.bind(queue);
	queue.enqueue = async () => {};
	const body = { selection: period, idempotencyKey: randomUUID() };
	let runId: string;
	try {
		const [first, duplicate] = await Promise.all([
			post(`/projects/${project.id}/syncs`, body),
			post(`/projects/${project.id}/syncs`, body),
		]);
		expect(first.status).toBe(202);
		expect(duplicate.body.runId).toBe(first.body.runId);
		runId = first.body.runId;
		expect((await get(`/jobs/${runId}`)).body.state).toBe('queued');
		await runtime.db.jobRun.update({
			where: { id: runId },
			data: { createdAt: new Date(Date.now() - 31000) },
		});
	} finally {
		queue.enqueue = original;
	}
	await queue.reconcile();
	expect((await terminal(runId!)).state).toBe('succeeded');
	expect(await runtime.db.jobRun.count({ where: { idempotencyKey: body.idempotencyKey } })).toBe(
		1,
	);
});

it('rejects out-of-batch tools before provider access and preserves imported tasks', async () => {
	const project = projects.find((item) => item.externalId === 'demo-platform')!;
	const model = runtime.app.get(ModelClient);
	const original = model.respond.bind(model);
	const fixture = runtime.app.get(FixtureService);
	fixture.reads.length = 0;
	model.respond = async (input) =>
		input.forcedTool
			? original(input)
			: {
					output: [
						{
							type: 'function_call',
							name: 'get_issue_comments',
							arguments: '{"issueId":"OTHER-USER-SECRET"}',
							call_id: randomUUID(),
						},
					],
					text: '',
					usage: null,
					responseId: null,
				};
	try {
		const accepted = await post(`/projects/${project.id}/syncs`, {
			selection: period,
			idempotencyKey: randomUUID(),
		});
		const state = await terminal(accepted.body.runId);
		expect(state.state).toBe('partial');
		expect(state.errorCode).toBe('GUARDRAIL_VIOLATION');
		expect(state.counts.saved).toBe(6);
		expect(fixture.reads.some((read) => read.includes('OTHER-USER'))).toBe(false);
	} finally {
		model.respond = original;
	}
});

it('preserves attempt reservation, mandatory tools and replay items through a temporary model failure', async () => {
	const project = projects.find((item) => item.externalId === 'demo-platform')!;
	const model = runtime.app.get(ModelClient);
	const original = model.respond.bind(model);
	const histories: OpenAI.Responses.ResponseInput[] = [];
	const forcedTools: (string | undefined)[] = [];
	const opaqueReasoning = 'synthetic-opaque-unit-replay';
	let pendingAttemptsObserved = 0;
	model.respond = async (input) => {
		histories.push(structuredClone(input.history));
		forcedTools.push(input.forcedTool);
		const reserved = await runtime.db.modelAttempt.findFirst({
			where: { status: 'submitted' },
		});
		expect(reserved).not.toBeNull();
		pendingAttemptsObserved++;
		if (histories.length === 1) {
			throw new OpenAI.APIConnectionError({ message: 'Synthetic connection reset' });
		}
		const response = await original(input);
		if (histories.length === 2) {
			response.output.unshift({
				type: 'reasoning',
				id: 'rs_unit_replay',
				summary: [],
				encrypted_content: opaqueReasoning,
			});
			response.output.push({
				type: 'message',
				id: 'msg_unit_replay',
				role: 'assistant',
				phase: 'commentary',
				status: 'completed',
				content: [],
			});
		}
		return response;
	};
	try {
		const accepted = await post(`/projects/${project.id}/syncs`, {
			selection: period,
			idempotencyKey: randomUUID(),
		});
		const state = await terminal(accepted.body.runId);
		expect(state.state).toBe('succeeded');
		expect(forcedTools.slice(0, 3)).toEqual([
			'list_issues',
			'list_issues',
			'get_issue_details',
		]);
		expect(histories[0]).toEqual(histories[1]);
		const replay = histories[2]!;
		expect(replay).toContainEqual(
			expect.objectContaining({ type: 'reasoning', encrypted_content: opaqueReasoning }),
		);
		expect(replay).toContainEqual(
			expect.objectContaining({ type: 'message', phase: 'commentary' }),
		);
		const call = replay.find((item) => item.type === 'function_call');
		expect(call?.type).toBe('function_call');
		if (call?.type === 'function_call') {
			expect(replay).toContainEqual(
				expect.objectContaining({ type: 'function_call_output', call_id: call.call_id }),
			);
		}
		const attempts = await runtime.db.modelAttempt.findMany({
			where: { runId: state.runId },
			orderBy: { attemptNo: 'asc' },
		});
		expect(attempts).toHaveLength(pendingAttemptsObserved);
		expect(attempts[0]).toMatchObject({ attemptNo: 1, status: 'failed', usageUnknown: true });
		expect(attempts.slice(1).every((attempt) => attempt.status === 'completed')).toBe(true);
		const trace = await get(`/jobs/${state.runId}/trace`);
		expect(JSON.stringify(trace.body)).not.toContain(opaqueReasoning);
		expect(JSON.stringify(state)).not.toContain(opaqueReasoning);
	} finally {
		model.respond = original;
	}
});

it('permits only one incomplete-output correction and retains known usage without publishing review', async () => {
	const project = projects.find((item) => item.externalId === 'demo-platform')!;
	const model = runtime.app.get(ModelClient);
	const original = model.respond.bind(model);
	let corrections = 0;
	model.respond = async (input) => {
		if (input.forcedTool) {
			return original(input);
		}
		corrections++;
		return {
			output: [],
			text: '',
			errorCode: 'INVALID_MODEL_OUTPUT',
			responseId: 'synthetic-incomplete',
			usage: {
				inputTokens: 10,
				outputTokens: 4096,
				cachedInputTokens: 0,
				reasoningTokens: 4096,
			},
		};
	};
	try {
		const accepted = await post(`/projects/${project.id}/syncs`, {
			selection: period,
			generateReview: true,
			idempotencyKey: randomUUID(),
		});
		const state = await terminal(accepted.body.runId);
		expect(state).toMatchObject({
			state: 'partial',
			errorCode: 'INVALID_MODEL_OUTPUT',
			reviewRunId: null,
		});
		expect(corrections).toBe(2);
		const attempts = await runtime.db.modelAttempt.findMany({
			where: { runId: state.runId, providerResponseId: 'synthetic-incomplete' },
		});
		expect(attempts).toHaveLength(2);
		expect(attempts.every((attempt) => !attempt.usageUnknown)).toBe(true);
		expect(attempts[0]!.usage).toMatchObject({
			inputTokens: 10,
			outputTokens: 4096,
			reasoningTokens: 4096,
		});
	} finally {
		model.respond = original;
	}
});

it('counts cached comment calls toward the tool limit while reading the provider once', async () => {
	const project = projects.find((item) => item.externalId === 'demo-platform')!;
	const model = runtime.app.get(ModelClient);
	const original = model.respond.bind(model);
	const fixture = runtime.app.get(FixtureService);
	fixture.reads.length = 0;
	model.respond = async (input) =>
		input.forcedTool
			? original(input)
			: {
					output: [
						{
							type: 'function_call',
							name: 'get_issue_comments',
							arguments: '{"issueId":"DEMO-101"}',
							call_id: randomUUID(),
						},
					],
					text: '',
					usage: null,
					responseId: null,
				};
	try {
		const accepted = await post(`/projects/${project.id}/syncs`, {
			selection: period,
			idempotencyKey: randomUUID(),
		});
		const state = await terminal(accepted.body.runId);
		expect(state).toMatchObject({ state: 'partial', errorCode: 'GUARDRAIL_VIOLATION' });
		expect(fixture.reads.filter((read) => read === 'comments:DEMO-101')).toHaveLength(1);
		expect(await runtime.db.modelAttempt.count({ where: { runId: state.runId } })).toBe(7);
	} finally {
		model.respond = original;
	}
});

it('stops at the unit usage threshold before reserving another model request', async () => {
	const project = projects.find((item) => item.externalId === 'demo-platform')!;
	const model = runtime.app.get(ModelClient);
	const original = model.respond.bind(model);
	let requests = 0;
	model.respond = async (input) => {
		requests++;
		const response = await original(input);
		return {
			...response,
			usage: {
				inputTokens: 39990,
				outputTokens: 10,
				cachedInputTokens: 0,
				reasoningTokens: 0,
			},
		};
	};
	try {
		const accepted = await post(`/projects/${project.id}/syncs`, {
			selection: period,
			idempotencyKey: randomUUID(),
		});
		const state = await terminal(accepted.body.runId);
		expect(state).toMatchObject({ state: 'partial', errorCode: 'BUDGET_EXHAUSTED' });
		expect(requests).toBe(1);
		expect(await runtime.db.modelAttempt.count({ where: { runId: state.runId } })).toBe(1);
	} finally {
		model.respond = original;
	}
});

it('replays equivalent selected-task sets despite order and duplicate IDs', async () => {
	const project = projects.find((item) => item.externalId === 'demo-platform')!;
	const tasks = await runtime.db.taskSnapshot.findMany({
		where: { syncRunId: sampleId },
		orderBy: { externalId: 'asc' },
		take: 2,
		select: { id: true },
	});
	const taskIds = tasks.map((task) => task.id);
	const idempotencyKey = randomUUID();
	const command = {
		selection: { mode: 'tasks', baseSyncRunId: sampleId, taskIds },
		idempotencyKey,
	};
	const [first, replay] = await Promise.all([
		post(`/projects/${project.id}/syncs`, command),
		post(`/projects/${project.id}/syncs`, {
			...command,
			selection: { ...command.selection, taskIds: [taskIds[1]!, taskIds[0]!, taskIds[0]!] },
		}),
	]);
	expect(first.status).toBe(202);
	expect(replay.status).toBe(202);
	expect(replay.body.runId).toBe(first.body.runId);
	expect((await terminal(first.body.runId)).state).toBe('succeeded');
	expect(await runtime.db.jobRun.count({ where: { idempotencyKey } })).toBe(1);
});

it('returns a conflict for concurrent commands sharing a key across projects', async () => {
	const selectedProjects = projects.filter((project) =>
		['demo-platform', 'demo-evidence'].includes(project.externalId),
	);
	const command = { selection: period, idempotencyKey: randomUUID() };
	// Delay both inserts so distinct project locks still exercise the shared key constraint.
	await runtime.db.$executeRawUnsafe(
		'CREATE FUNCTION s02_delay_job_acceptance() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(0.2); RETURN NEW; END $$',
	);
	await runtime.db.$executeRawUnsafe(
		'CREATE TRIGGER s02_delay_job_acceptance BEFORE INSERT ON job_runs FOR EACH ROW EXECUTE FUNCTION s02_delay_job_acceptance()',
	);
	let acceptedRunId: string | undefined;
	try {
		const responses = await Promise.all(
			selectedProjects.map((project) => post(`/projects/${project.id}/syncs`, command)),
		);
		expect(responses.map((response) => response.status).sort()).toEqual([202, 409]);
		const rejected = responses.find((response) => response.status === 409)!;
		expect(rejected.body.error.code).toBe('JOB_CONFLICT');
		acceptedRunId = responses.find((response) => response.status === 202)!.body.runId;
		expect(
			await runtime.db.jobRun.count({ where: { idempotencyKey: command.idempotencyKey } }),
		).toBe(1);
	} finally {
		await runtime.db.$executeRawUnsafe('DROP TRIGGER s02_delay_job_acceptance ON job_runs');
		await runtime.db.$executeRawUnsafe('DROP FUNCTION s02_delay_job_acceptance()');
	}
	expect((await terminal(acceptedRunId!)).state).toBe('succeeded');
});

it('continues reading every discovered task after one detail read fails', async () => {
	const project = projects.find((item) => item.externalId === 'demo-platform')!;
	const fixture = runtime.app.get(FixtureService);
	const original = fixture.details.bind(fixture);
	const attempted: string[] = [];
	fixture.details = async (externalProjectId, externalId) => {
		attempted.push(externalId);
		if (externalId === 'DEMO-102') {
			throw new Error('Synthetic unavailable task');
		}
		return original(externalProjectId, externalId);
	};
	try {
		const accepted = await post(`/projects/${project.id}/syncs`, {
			selection: period,
			generateReview: true,
			idempotencyKey: randomUUID(),
		});
		const state = await terminal(accepted.body.runId);
		expect(state).toMatchObject({
			state: 'partial',
			discoveryComplete: true,
			importComplete: false,
			analysisComplete: true,
			reviewRunId: null,
		});
		expect(new Set(attempted)).toEqual(
			new Set(['DEMO-101', 'DEMO-102', 'DEMO-103', 'DEMO-105', 'DEMO-108', 'DEMO-110']),
		);
		const tasks = await runtime.db.taskSnapshot.findMany({ where: { syncRunId: state.runId } });
		expect(tasks).toHaveLength(6);
		expect(tasks.filter((task) => task.detailStatus === 'available')).toHaveLength(5);
		expect(tasks.find((task) => task.externalId === 'DEMO-102')?.detailStatus).toBe(
			'unavailable',
		);
		expect(state.autoReview).toContain('skipped');
	} finally {
		fixture.details = original;
	}
});

it('fails an all-unavailable import without starting model analysis', async () => {
	const project = projects.find((item) => item.externalId === 'demo-platform')!;
	const fixture = runtime.app.get(FixtureService);
	const original = fixture.details.bind(fixture);
	let attempted = 0;
	fixture.details = async () => {
		attempted++;
		throw new Error('Synthetic detail outage');
	};
	try {
		const accepted = await post(`/projects/${project.id}/syncs`, {
			selection: period,
			generateReview: true,
			idempotencyKey: randomUUID(),
		});
		const state = await terminal(accepted.body.runId);
		expect(state).toMatchObject({
			state: 'failed',
			errorCode: 'INSUFFICIENT_DATA',
			reviewRunId: null,
		});
		expect(attempted).toBe(6);
		expect(await runtime.db.modelAttempt.count({ where: { runId: state.runId } })).toBe(0);
	} finally {
		fixture.details = original;
	}
});

it('rolls back sync publication when automatic-review insertion fails', async () => {
	const project = projects.find((item) => item.externalId === 'demo-platform')!;
	await runtime.db.$executeRawUnsafe(
		"CREATE FUNCTION s02_reject_auto_review() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.type = 'review' AND NEW.trigger = 'automatic' THEN RAISE EXCEPTION 'synthetic automatic review failure'; END IF; RETURN NEW; END $$",
	);
	await runtime.db.$executeRawUnsafe(
		'CREATE TRIGGER s02_reject_auto_review BEFORE INSERT ON job_runs FOR EACH ROW EXECUTE FUNCTION s02_reject_auto_review()',
	);
	try {
		const accepted = await post(`/projects/${project.id}/syncs`, {
			selection: period,
			generateReview: true,
			idempotencyKey: randomUUID(),
		});
		const state = await terminal(accepted.body.runId);
		expect(state).toMatchObject({
			state: 'partial',
			analysisComplete: false,
			reviewRunId: null,
		});
		expect(state.counts.saved).toBe(6);
		expect(
			await runtime.db.syncAnalysis.findUnique({ where: { syncRunId: state.runId } }),
		).toBeNull();
		expect(
			await runtime.db.jobRun.count({
				where: { sourceSyncRunId: state.runId, trigger: 'automatic' },
			}),
		).toBe(0);
	} finally {
		await runtime.db.$executeRawUnsafe('DROP TRIGGER s02_reject_auto_review ON job_runs');
		await runtime.db.$executeRawUnsafe('DROP FUNCTION s02_reject_auto_review()');
	}
});

it('persists a model-started checkpoint while the external request is still pending', async () => {
	const project = projects.find((item) => item.externalId === 'demo-evidence')!;
	const model = runtime.app.get(ModelClient);
	const original = model.respond.bind(model);
	let release: () => void = () => undefined;
	let entered = false;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	model.respond = async (input) => {
		if (!entered) {
			entered = true;
			await gate;
		}
		return original(input);
	};
	try {
		const accepted = await post(`/projects/${project.id}/syncs`, {
			selection: period,
			idempotencyKey: randomUUID(),
		});
		expect(accepted.status).toBe(202);
		for (let iteration = 0; iteration < 100 && !entered; iteration++) {
			await new Promise((resolve) => setTimeout(resolve, 20));
		}
		expect(entered).toBe(true);
		const batch = await runtime.db.analysisBatch.findFirstOrThrow({
			where: { runId: accepted.body.runId },
		});
		expect(batch.state).toBe('running');
		expect(batch.trace).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ event: 'unit_started', phase: 'sync', taskCount: 1 }),
				expect.objectContaining({ event: 'model_started', attempt: 1, unitAttempt: 1 }),
			]),
		);
		expect(JSON.stringify(batch.trace)).not.toContain('model_completed');
		release();
		expect((await terminal(accepted.body.runId)).state).toBe('succeeded');
	} finally {
		release();
		model.respond = original;
	}
});

it('persists the exact schema constraint on correction and final review failure', async () => {
	const project = projects.find((item) => item.externalId === 'demo-evidence')!;
	const sync = await post(`/projects/${project.id}/syncs`, {
		selection: period,
		idempotencyKey: randomUUID(),
	});
	expect((await terminal(sync.body.runId)).state).toBe('succeeded');
	const model = runtime.app.get(ModelClient);
	const original = model.respond.bind(model);
	let requests = 0;
	let correction = '';
	model.respond = async (input) => {
		if (!input.report) {
			return original(input);
		}
		requests++;
		if (requests === 2) {
			correction = JSON.stringify(input.history);
		}
		const source = input.sources[0]!;
		const claim = {
			kind: 'task_description',
			text: 'Synthetic plan',
			evidence: [{ sourceId: source.id, quote: source.textExcerpt.slice(0, 40) }],
		};
		return {
			output: [],
			responseId: null,
			usage: null,
			text: JSON.stringify({
				schemaVersion: '1.0',
				groupTitles: ['First', 'Second', '', ''],
				claims: Array.from({ length: 10 }, (_value, index) => ({
					...claim,
					groupIndex: index % 2,
				})),
				limitations: [],
				explanation: 'Synthetic constraint failure',
			}),
		};
	};
	try {
		const accepted = await post(`/projects/${project.id}/reviews`, {
			syncRunId: sync.body.runId,
			idempotencyKey: randomUUID(),
		});
		const failed = await terminal(accepted.body.runId);
		expect(failed).toMatchObject({ state: 'failed', errorCode: 'INVALID_MODEL_OUTPUT' });
		expect(failed.resultRef).toBeNull();
		expect(requests).toBe(2);
		expect(correction).toContain('maximum');
		const batch = await runtime.db.analysisBatch.findFirstOrThrow({
			where: { runId: accepted.body.runId },
		});
		expect(batch.trace).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					event: 'validation_failed',
					error: expect.objectContaining({
						issues: expect.arrayContaining([
							expect.objectContaining({
								code: 'too_big',
								path: 'claims',
								maximum: 8,
							}),
						]),
					}),
				}),
				expect.objectContaining({ event: 'output_correction_requested' }),
			]),
		);
		expect(await runtime.db.reviewReport.count({ where: { reviewRunId: failed.runId } })).toBe(
			0,
		);
	} finally {
		model.respond = original;
	}
});

it('finalizes unfinished batch traces when recovering a lost worker heartbeat', async () => {
	const base = await runtime.db.jobRun.findUniqueOrThrow({ where: { id: sampleId } });
	const run = await runtime.db.jobRun.create({
		data: {
			ownerId: base.ownerId,
			projectId: base.projectId,
			type: 'review',
			selection: base.selection!,
			subjectSourceUserId: base.subjectSourceUserId,
			sourceSyncRunId: base.id,
			idempotencyKey: randomUUID(),
			requestFingerprint: 'synthetic-trace-recovery',
			state: 'running',
			heartbeatAt: new Date(),
			unitDeadlineAt: new Date(Date.now() + 300000),
		},
	});
	const batch = await runtime.db.analysisBatch.create({
		data: {
			runId: run.id,
			phase: 'review',
			ordinal: 0,
			inputIds: [],
			state: 'running',
			trace: [{ event: 'model_started', attempt: 1 }],
		},
	});
	await runtime.db.modelAttempt.create({
		data: { runId: run.id, batchId: batch.id, attemptNo: 1, status: 'submitted' },
	});
	await runtime.db.jobRun.update({
		where: { id: run.id },
		data: { heartbeatAt: new Date(Date.now() - 60000) },
	});
	await runtime.app.get(QueueService).reconcile();
	expect((await runtime.db.jobRun.findUniqueOrThrow({ where: { id: run.id } })).state).toBe(
		'failed',
	);
	const recovered = await runtime.db.analysisBatch.findUniqueOrThrow({ where: { id: batch.id } });
	expect(recovered.state).toBe('failed');
	expect(recovered.trace).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ event: 'model_started' }),
			expect.objectContaining({ event: 'unit_interrupted', errorCode: 'RUN_INTERRUPTED' }),
		]),
	);
	expect(
		await runtime.db.modelAttempt.findFirstOrThrow({ where: { runId: run.id } }),
	).toMatchObject({ status: 'interrupted', usageUnknown: true });
});
