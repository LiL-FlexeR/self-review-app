import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createTestApp } from './support/create-test-app.js';
import type { IRuntime } from './support/create-test-app.js';
import { config } from '@app/shared/config/config.schema';
import type { TConfig } from '@app/shared/config/config.schema';
import { ModelClient } from '@app/modules/agent/services/model-client.service';
import { LinearTransport } from '@app/modules/providers/adapters/linear/services/linear-transport.service';
import { QueueService } from '@app/modules/jobs/services/queue.service';
import { MailService } from '@app/shared/mail/mail.service';
import { ProviderError } from '@app/errors/provider.error';
import { JobView, ReviewView } from '@self-review/contracts';

const configuration = config();
const token = 'lin_api_synthetic_test_only';
const period = { mode: 'period', startDate: '2026-10-01', endDate: '2026-10-31' };
const projectId = 'synthetic-project';
const pageInfo = { hasNextPage: false, endCursor: null };
const calls: { query: string; variables: Record<string, unknown> }[] = [];
let runtime: IRuntime;
let jar: string[] = [];
let csrf = '';
let connectionId: string;
let localProjectId: string;
let syncId: string;
let moved = false;
let failPage = false;
let empty = false;
let oversized = false;
let changed = false;

const issues = Array.from({ length: 23 }, (_value, index) => ({
	id: `linear-${index}`,
	identifier: `SYN-${index}`,
	title: `Synthetic task ${index}`,
	description: index === 1 ? null : `Planned synthetic work ${index}.`,
	createdAt:
		index === 21
			? '2026-09-30T23:59:59Z'
			: index === 22
				? '2026-11-01T00:00:00Z'
				: '2026-10-01T00:00:00Z',
	updatedAt: '2026-10-02T00:00:00Z',
	url: `https://linear.app/synthetic/issue/SYN-${index}`,
	state: { type: ['completed', 'started', 'canceled'][index % 3] },
	assignee: index === 2 ? null : { id: index % 2 ? 'other-user' : 'linear-owner' },
	project: { id: projectId },
}));

function cookies(response: { headers: Record<string, unknown> }) {
	return ((response.headers['set-cookie'] as string[]) ?? []).map(
		(value) => value.split(';')[0]!,
	);
}
const get = (path: string, cookie = jar) =>
	request(runtime.app.getHttpServer())
		.get('/api' + path)
		.set('Cookie', cookie);
const post = (path: string, body: object) =>
	request(runtime.app.getHttpServer())
		.post('/api' + path)
		.set('Origin', configuration.APP_ORIGIN)
		.set('Cookie', jar)
		.set('X-CSRF-Token', csrf)
		.send(body);
const put = (id: string, replacementToken: string) =>
	request(runtime.app.getHttpServer())
		.put(`/api/connections/${id}`)
		.set('Origin', configuration.APP_ORIGIN)
		.set('Cookie', jar)
		.set('X-CSRF-Token', csrf)
		.send({ credentials: { token: replacementToken } });
const remove = (id: string) =>
	request(runtime.app.getHttpServer())
		.delete(`/api/connections/${id}`)
		.set('Origin', configuration.APP_ORIGIN)
		.set('Cookie', jar)
		.set('X-CSRF-Token', csrf)
		.send({ confirm: true });

async function login() {
	let code: string | undefined;
	const send = vi
		.spyOn(runtime.app.get(MailService), 'send')
		.mockImplementation(async (_email, sent) => {
			code = sent;
		});
	const signup = await post('/auth/signup', {
		email: randomUUID() + '@example.test',
		password: 'synthetic-password-123',
	});
	const previous = jar;
	jar = cookies(signup);
	const verified = await post('/auth/verify-otp', { challengeId: signup.body.challengeId, code });
	expect(verified.status).toBe(201);
	jar = previous;
	send.mockRestore();
	return { jar: cookies(verified), csrf: verified.body.csrfToken as string };
}

async function terminal(id: string) {
	for (let iteration = 0; iteration < 300; iteration++) {
		const job = JobView.parse((await get(`/jobs/${id}`)).body);
		if (!['queued', 'running'].includes(job.state)) {
			return job;
		}
		await new Promise((resolve) => setTimeout(resolve, 30));
	}
	throw new Error('Synthetic Linear job did not finish');
}

beforeAll(async () => {
	if (
		!configuration.DATABASE_URL.endsWith('/self_review_test') ||
		!configuration.REDIS_URL.endsWith('/15')
	) {
		throw new Error('Isolated storage required');
	}
	runtime = await createTestApp({
		config: { ...configuration, APP_MODE: 'live' },
		worker: true,
		mail: { send: async () => undefined, verify: async () => undefined },
	});
	await runtime.db.user.deleteMany();
	const offlineValues = { ...configuration, APP_MODE: 'offline' as const };
	const scripted = new ModelClient({
		values: offlineValues,
		get<TKey extends keyof TConfig>(key: TKey): TConfig[TKey] {
			return offlineValues[key];
		},
	});
	vi.spyOn(runtime.app.get(ModelClient), 'validateConfiguration').mockImplementation(
		() => undefined,
	);
	vi.spyOn(runtime.app.get(ModelClient), 'respond').mockImplementation((input) =>
		scripted.respond(input),
	);
	vi.spyOn(runtime.app.get(LinearTransport), 'send').mockImplementation(
		async (key, query, input) => {
			const variables = input as Record<string, unknown>;
			calls.push({ query, variables });
			if (key === 'invalid') {
				throw new ProviderError('PROVIDER_CREDENTIALS_INVALID');
			}
			if (query.includes('SelfReviewIdentity')) {
				return {
					viewer: {
						id: key === 'other-key' ? 'other-user' : 'linear-owner',
						name: 'Synthetic Anna',
					},
					organization: {
						id: key === 'other-workspace' ? 'other-workspace' : 'workspace',
						name: 'Synthetic workspace',
					},
				};
			}
			if (query.includes('SelfReviewProjects')) {
				const isNext = variables.after === 'catalog-next';
				return {
					organization: { name: 'Synthetic workspace' },
					projects: {
						nodes: [
							{
								id: isNext ? 'second-project' : projectId,
								name: 'Synthetic project',
							},
						],
						pageInfo: isNext
							? pageInfo
							: { hasNextPage: true, endCursor: 'catalog-next' },
					},
				};
			}
			if (query.includes('SelfReviewProject(')) {
				return { project: { id: variables.id, name: 'Synthetic project' } };
			}
			if (query.includes('SelfReviewIssues')) {
				if (failPage && variables.after) {
					throw new ProviderError('PROVIDER_RESPONSE_LIMIT');
				}
				const offset = variables.after ? 12 : 0;
				return {
					project: {
						id: projectId,
						issues: {
							nodes: empty ? [] : issues.slice(offset, offset + 12),
							pageInfo:
								!empty && !variables.after
									? { hasNextPage: true, endCursor: 'issues-next' }
									: pageInfo,
						},
					},
				};
			}
			if (query.includes('SelfReviewIssue(')) {
				const issue = issues.find((item) => item.id === variables.id);
				return {
					issue: issue
						? {
								...issue,
								description:
									oversized && issue.id === 'linear-0'
										? 'x'.repeat(65537)
										: issue.description,
								updatedAt: changed ? '2026-10-03T00:00:00Z' : issue.updatedAt,
								project: { id: moved ? 'moved-project' : projectId },
							}
						: null,
				};
			}
			throw new Error('Unexpected external operation');
		},
	);
	const identity = await login();
	jar = identity.jar;
	csrf = identity.csrf;
}, 30000);

afterAll(async () => {
	vi.restoreAllMocks();
	await runtime?.close();
});

it('verifies keys before storage, enforces live slots and keeps credentials write-only', async () => {
	const invalid = await post('/connections', {
		provider: 'linear',
		displayName: 'Invalid',
		credentials: { token: 'invalid' },
	});
	expect(invalid.status).toBe(502);
	expect(invalid.body.error.code).toBe('PROVIDER_CREDENTIALS_INVALID');
	expect(await runtime.db.connection.count()).toBe(0);
	expect((await post('/connections', { provider: 'fixture' })).status).toBe(400);
	const body = { provider: 'linear', displayName: 'Synthetic Linear', credentials: { token } };
	const created = await post('/connections', body);
	expect(created.status).toBe(201);
	connectionId = created.body.id;
	const saved = await runtime.db.connection.findUniqueOrThrow({ where: { id: connectionId } });
	expect(saved.encryptedCredentials).not.toContain(token);
	expect(saved.sourceUserId).toBe('linear-owner');
	expect(saved.sourceScopeId).toBe('workspace');
	expect(JSON.stringify(created.body)).not.toMatch(
		/encryptedCredentials|lin_api_|credentialVersion/,
	);
	expect((await post('/connections', body)).status).toBe(409);
	expect((await get('/connections')).body.availableProviders).toEqual(['linear']);
});

it('paginates accessible projects through the end and preserves local IDs', async () => {
	const first = await get(`/connections/${connectionId}/projects`);
	expect(first.body.nextCursor).toBe('catalog-next');
	localProjectId = first.body.items[0].id;
	const last = await get(`/connections/${connectionId}/projects?cursor=catalog-next`);
	expect(last.body.nextCursor).toBeNull();
	expect(last.body.items[0].externalId).toBe('second-project');
	expect((await get(`/connections/${connectionId}/projects`)).body.items[0].id).toBe(
		localProjectId,
	);
});

it('permits same-user rotation and rejects another user/workspace without changing the saved key', async () => {
	expect((await put(connectionId, 'replacement-key')).status).toBe(200);
	const before = await runtime.db.connection.findUniqueOrThrow({ where: { id: connectionId } });
	expect(before.credentialVersion).toBe(2);
	for (const replacement of ['other-key', 'other-workspace', 'invalid']) {
		const response = await put(connectionId, replacement);
		expect(response.body.error.code).toBe(
			replacement === 'invalid'
				? 'PROVIDER_CREDENTIALS_INVALID'
				: 'CONNECTION_IDENTITY_MISMATCH',
		);
	}
	expect(
		(await runtime.db.connection.findUniqueOrThrow({ where: { id: connectionId } }))
			.encryptedCredentials,
	).toBe(before.encryptedCredentials);
});

it('imports every UTC-qualified status/assignee across pages and reviews the saved owner subset only', async () => {
	calls.length = 0;
	const accepted = await post(`/projects/${localProjectId}/syncs`, {
		selection: period,
		generateReview: true,
		idempotencyKey: randomUUID(),
	});
	expect(accepted.status).toBe(202);
	syncId = accepted.body.runId;
	const sync = await terminal(syncId);
	expect(sync.errorCode).toBeNull();
	expect(sync.state).toBe('succeeded');
	expect(sync.counts.saved).toBe(21);
	const review = await terminal(sync.reviewRunId!);
	expect(review.state).toBe('succeeded');
	const tasks = await runtime.db.taskSnapshot.findMany({ where: { syncRunId: syncId } });
	expect(new Set(tasks.map((task) => task.state))).toEqual(
		new Set(['completed', 'started', 'canceled']),
	);
	expect(tasks.some((task) => (task.assignees as string[]).length === 0)).toBe(true);
	expect(
		tasks.every(
			(task) => task.sourceUpdatedAt && task.safeUrl?.startsWith('https://linear.app/'),
		),
	).toBe(true);
	const sourceRun = await runtime.db.jobRun.findUniqueOrThrow({ where: { id: syncId } });
	const report = ReviewView.parse(
		(await get(`/reviews/${sourceRun.currentReviewReportId}`)).body,
	);
	expect(report.subjectSourceUserId).toBe('linear-owner');
	expect(report.coverage.targetTasks).toBe(10);
	expect(calls.filter((call) => call.query.includes('SelfReviewIssues'))).toHaveLength(2);
	expect(calls.filter((call) => call.query.includes('SelfReviewIssue('))).toHaveLength(21);
	const before = calls.length;
	const manual = await post(`/projects/${localProjectId}/reviews`, {
		syncRunId: syncId,
		idempotencyKey: randomUUID(),
	});
	expect((await terminal(manual.body.runId)).state).toBe('succeeded');
	expect(calls).toHaveLength(before);
	const trace = await get(`/jobs/${syncId}/trace`);
	expect(JSON.stringify(trace.body)).not.toMatch(/lin_api_|replacement-key|encryptedCredentials/);
});

it('refreshes only selected external IDs, keeps moved tasks stale and preserves the base', async () => {
	const base = await runtime.db.taskSnapshot.findMany({
		where: { syncRunId: syncId },
		orderBy: { externalId: 'asc' },
	});
	calls.length = 0;
	const accepted = await post(`/projects/${localProjectId}/syncs`, {
		selection: { mode: 'tasks', baseSyncRunId: syncId, taskIds: [base[0]!.id] },
		idempotencyKey: randomUUID(),
	});
	expect((await terminal(accepted.body.runId)).state).toBe('succeeded');
	expect(
		calls
			.filter((call) => call.query.includes('SelfReviewIssue('))
			.map((call) => call.variables.id),
	).toEqual([base[0]!.externalId]);
	expect(calls.some((call) => call.query.includes('SelfReviewIssues'))).toBe(false);
	const copied = await runtime.db.taskSnapshot.findFirstOrThrow({
		where: { syncRunId: accepted.body.runId, externalId: base[1]!.externalId },
	});
	expect(copied.retrievedAt).toEqual(base[1]!.retrievedAt);
	expect(copied.copiedFromSnapshotId).toBe(base[1]!.id);
	moved = true;
	const failedRefresh = await post(`/projects/${localProjectId}/syncs`, {
		selection: { mode: 'tasks', baseSyncRunId: syncId, taskIds: [base[0]!.id] },
		generateReview: true,
		idempotencyKey: randomUUID(),
	});
	const partial = await terminal(failedRefresh.body.runId);
	moved = false;
	expect(partial.state).toBe('partial');
	expect(partial.reviewRunId).toBeNull();
	expect(
		(
			await runtime.db.taskSnapshot.findFirstOrThrow({
				where: { syncRunId: failedRefresh.body.runId, externalId: base[0]!.externalId },
			})
		).refreshStatus,
	).toBe('stale');
	expect(await runtime.db.taskSnapshot.findUniqueOrThrow({ where: { id: base[0]!.id } })).toEqual(
		base[0],
	);
});

it('distinguishes empty selection and interrupted provider pagination without an offline fallback', async () => {
	empty = true;
	const accepted = await post(`/projects/${localProjectId}/syncs`, {
		selection: period,
		idempotencyKey: randomUUID(),
	});
	const result = await terminal(accepted.body.runId);
	empty = false;
	expect(result.state).toBe('succeeded');
	expect(result.counts.saved).toBe(0);
	expect(await runtime.db.modelAttempt.count({ where: { runId: accepted.body.runId } })).toBe(0);
	failPage = true;
	const interrupted = await post(`/projects/${localProjectId}/syncs`, {
		selection: period,
		idempotencyKey: randomUUID(),
	});
	const partial = await terminal(interrupted.body.runId);
	failPage = false;
	expect(partial.errorCode).toBe('PROVIDER_RESPONSE_LIMIT');
	expect(partial.discoveryComplete).toBe(false);
	expect(partial.state).not.toBe('succeeded');
});

it('retains truncated tasks with a field-budget failure and warns when source timestamps change', async () => {
	oversized = true;
	const accepted = await post(`/projects/${localProjectId}/syncs`, {
		selection: period,
		generateReview: true,
		idempotencyKey: randomUUID(),
	});
	const partial = await terminal(accepted.body.runId);
	oversized = false;
	expect(partial.state).toBe('partial');
	expect(partial.errorCode).toBe('PROVIDER_FIELD_LIMIT');
	expect(partial.reviewRunId).toBeNull();
	expect(partial.counts.saved).toBe(21);
	const task = await runtime.db.taskSnapshot.findFirstOrThrow({
		where: { syncRunId: accepted.body.runId, externalId: 'linear-0' },
	});
	expect(task.detailStatus).toBe('truncated');
	expect(Buffer.byteLength(task.description)).toBe(65536);
	changed = true;
	const current = await post(`/projects/${localProjectId}/syncs`, {
		selection: period,
		idempotencyKey: randomUUID(),
	});
	const succeeded = await terminal(current.body.runId);
	changed = false;
	expect(succeeded.state).toBe('succeeded');
	expect(succeeded.warningsCount).toBeGreaterThan(0);
	expect(succeeded.warnings?.join(' ')).toContain('source changed during import');
});

it('denies another owner before source reads, including connection writes, job SSE and trace', async () => {
	const ownerJar = jar;
	const ownerCsrf = csrf;
	const other = await login();
	jar = other.jar;
	csrf = other.csrf;
	const before = calls.length;
	for (const path of [
		`/connections/${connectionId}/projects`,
		`/projects/${localProjectId}`,
		`/jobs/${syncId}`,
		`/jobs/${syncId}/events`,
		`/jobs/${syncId}/trace`,
	]) {
		expect((await get(path)).status).toBe(404);
	}
	expect((await put(connectionId, token)).status).toBe(404);
	expect((await remove(connectionId)).status).toBe(404);
	expect(calls).toHaveLength(before);
	jar = ownerJar;
	csrf = ownerCsrf;
});

it('blocks deletion during queued work and cascades completed snapshots/reports after confirmation', async () => {
	const queue = runtime.app.get(QueueService);
	const enqueue = vi.spyOn(queue, 'enqueue').mockResolvedValue(undefined);
	const active = await post(`/projects/${localProjectId}/syncs`, {
		selection: period,
		idempotencyKey: randomUUID(),
	});
	expect((await remove(connectionId)).body.error.code).toBe('CONNECTION_BUSY');
	await runtime.db.jobRun.update({ where: { id: active.body.runId }, data: { state: 'failed' } });
	enqueue.mockRestore();
	expect((await remove(connectionId)).status).toBe(200);
	expect(await runtime.db.connection.count({ where: { id: connectionId } })).toBe(0);
	expect(await runtime.db.jobRun.count({ where: { projectId: localProjectId } })).toBe(0);
});
