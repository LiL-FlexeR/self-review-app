import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createTestApp } from './support/create-test-app.js';
import type { IRuntime } from './support/create-test-app.js';
import { config } from '@app/shared/config/config.schema';
import type { TConfig } from '@app/shared/config/config.schema';
import { ModelClient } from '@app/modules/agent/services/model-client.service';
import { RestTransport } from '@app/modules/providers/services/rest-transport.service';
import { LinearTransport } from '@app/modules/providers/adapters/linear/services/linear-transport.service';
import { MailService } from '@app/shared/mail/mail.service';
import { ProviderError } from '@app/errors/provider.error';
import { JobView, ReviewView } from '@self-review/contracts';
import type { TTrackerCredentials } from '@self-review/contracts';

const configuration = config();
const cloudId = '11111111-1111-4111-8111-111111111111';
const period = { mode: 'period', startDate: '2026-10-01', endDate: '2026-10-31' };
const adf = (text: string) => ({
	type: 'doc',
	version: 1,
	content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

for (const provider of ['clickup', 'jira'] as const) {
	describe(`${provider} HTTP/worker workflow with synthetic tracker/model boundaries`, () => {
		let runtime: IRuntime;
		let jar: string[] = [];
		let csrf = '';
		let connectionId = '';
		let projectId = '';
		let syncId = '';
		let moved = false;
		let failPage = false;
		const calls: { provider: string; path: string; query: Record<string, string> }[] = [];
		const owner = provider === 'clickup' ? '42' : 'api-owner';
		const credentials = (token = 'synthetic-test-token'): TTrackerCredentials =>
			provider === 'jira'
				? { email: 'different-from-app@example.test', token, cloudId }
				: { token };
		const tasks = Array.from({ length: 24 }, (_value, index) => {
			const created =
				index === 21
					? '2026-09-30T23:59:59.999Z'
					: index === 22
						? '2026-11-01T00:00:00Z'
						: index === 23
							? '2026-10-31T23:59:59-0300'
							: '2026-10-01T05:30:00+0530';
			const assignees =
				index === 2
					? []
					: index % 2 === 0
						? [owner, ...(provider === 'clickup' ? ['43'] : [])]
						: ['other'];
			return { id: String(1000 + index), created, assignees, index };
		});
		function sourceTask(index: number) {
			const task = tasks[index]!;
			const description = `Planned synthetic work ${index}.`;
			if (provider === 'clickup') {
				return {
					id: task.id,
					name: `Synthetic task ${index}`,
					text_content: description,
					status: {
						status: ['Closed', 'In progress', 'Canceled'][index % 3],
						type: ['closed', 'custom', 'open'][index % 3],
					},
					assignees: task.assignees.map((id) => ({ id })),
					date_created: String(Date.parse(task.created)),
					date_updated: '1790899200000',
					list: { id: index === 0 || moved ? '999' : '100' },
					locations: moved ? [] : [{ id: '100' }],
				};
			}
			return {
				id: task.id,
				key: `SYN-${index}`,
				fields: {
					project: { id: moved ? '999' : '100' },
					summary: `Synthetic issue ${index}`,
					description: adf(description),
					status: {
						name: ['Done', 'In progress', 'Canceled'][index % 3],
						statusCategory: { key: ['done', 'indeterminate', 'new'][index % 3] },
					},
					assignee: task.assignees[0] ? { accountId: task.assignees[0] } : null,
					created: task.created,
					updated: '2026-10-02T00:00:00Z',
				},
			};
		}
		const cookies = (response: { headers: Record<string, unknown> }) =>
			((response.headers['set-cookie'] as string[]) ?? []).map(
				(value) => value.split(';')[0]!,
			);
		const get = (path: string) =>
			request(runtime.app.getHttpServer())
				.get('/api' + path)
				.set('Cookie', jar);
		const post = (path: string, body: object) =>
			request(runtime.app.getHttpServer())
				.post('/api' + path)
				.set('Origin', configuration.APP_ORIGIN)
				.set('Cookie', jar)
				.set('X-CSRF-Token', csrf)
				.send(body);
		const replace = (replacement: TTrackerCredentials) =>
			request(runtime.app.getHttpServer())
				.put(`/api/connections/${connectionId}`)
				.set('Origin', configuration.APP_ORIGIN)
				.set('Cookie', jar)
				.set('X-CSRF-Token', csrf)
				.send({ credentials: replacement });
		async function login() {
			let code = '';
			const send = vi
				.spyOn(runtime.app.get(MailService), 'send')
				.mockImplementation(async (_email, sent) => {
					code = sent;
				});
			const signup = await post('/auth/signup', {
				email: randomUUID() + '@example.test',
				password: 'synthetic-password-123',
			});
			jar = cookies(signup);
			const verified = await post('/auth/verify-otp', {
				challengeId: signup.body.challengeId,
				code,
			});
			expect(verified.status).toBe(201);
			jar = cookies(verified);
			csrf = verified.body.csrfToken;
			send.mockRestore();
		}
		async function terminal(id: string) {
			for (let iteration = 0; iteration < 400; iteration++) {
				const job = JobView.parse((await get(`/jobs/${id}`)).body);
				if (!['queued', 'running'].includes(job.state)) {
					return job;
				}
				await new Promise((resolve) => setTimeout(resolve, 25));
			}
			throw new Error('Synthetic source job did not finish');
		}
		beforeAll(async () => {
			if (
				!configuration.DATABASE_URL.endsWith('/self_review_test') ||
				!configuration.REDIS_URL.endsWith('/15')
			) {
				throw new Error('Isolated test storage required');
			}
			runtime = await createTestApp({
				config: { ...configuration, APP_MODE: 'live' },
				worker: true,
				mail: { send: async () => undefined, verify: async () => undefined },
			});
			await runtime.db.user.deleteMany();
			const offline = { ...configuration, APP_MODE: 'offline' as const };
			const scripted = new ModelClient({
				values: offline,
				get<TKey extends keyof TConfig>(key: TKey): TConfig[TKey] {
					return offline[key];
				},
			});
			vi.spyOn(runtime.app.get(ModelClient), 'validateConfiguration').mockImplementation(
				() => undefined,
			);
			vi.spyOn(runtime.app.get(ModelClient), 'respond').mockImplementation((input) =>
				scripted.respond(input),
			);
			vi.spyOn(runtime.app.get(LinearTransport), 'send').mockImplementation(
				async (_token, query) => {
					if (query.includes('SelfReviewIdentity')) {
						return {
							viewer: { id: 'linear-owner', name: 'Synthetic' },
							organization: { id: 'workspace', name: 'Synthetic' },
						};
					}
					throw new ProviderError('PROVIDER_RATE_LIMITED', true);
				},
			);
			vi.spyOn(runtime.app.get(RestTransport), 'send').mockImplementation(
				async (selectedProvider, secret, path, query = {}) => {
					calls.push({ provider: selectedProvider, path, query });
					if (secret.token === 'invalid') {
						throw new ProviderError('PROVIDER_CREDENTIALS_INVALID');
					}
					if (path === '/user') {
						return {
							user: {
								id: secret.token === 'other-account' ? 99 : 42,
								username: 'Synthetic owner',
							},
						};
					}
					if (path === '/myself') {
						return {
							accountId: secret.token === 'other-account' ? 'other-account' : owner,
							displayName: 'Synthetic owner',
						};
					}
					if (path === '/serverInfo') {
						return { baseUrl: 'https://unsupported.example.test' };
					}
					if (path === '/team') {
						return { teams: [{ id: '1', name: 'Workspace' }] };
					}
					if (path === '/team/1/space') {
						return { spaces: [{ id: '2', name: 'Space' }] };
					}
					if (path === '/space/2/folder') {
						return {
							folders: [
								{ id: '3', name: 'Folder' },
								{ id: '4', name: 'Folder' },
							],
						};
					}
					if (path === '/space/2/list') {
						return { lists: [] };
					}
					if (path === '/folder/3/list' || path === '/folder/4/list') {
						return {
							lists: [
								{
									id: path === '/folder/4/list' ? '101' : '100',
									name: 'Same resource name',
								},
							],
						};
					}
					if (path === '/project/search') {
						const offset = Number(query.startAt ?? 0);
						return {
							values: [
								{
									id: offset ? '101' : '100',
									key: 'SYN',
									name: 'Same resource name',
								},
							],
							startAt: offset,
							isLast: offset > 0,
						};
					}
					if (path === '/list/100' || path === '/project/100') {
						return { id: '100', key: 'SYN', name: 'Synthetic' };
					}
					if (path === '/list/100/task' || path === '/search/jql') {
						const page = Number(query.page ?? query.nextPageToken ?? 0);
						if (failPage && page > 0) {
							throw new ProviderError('PROVIDER_RATE_LIMITED', true);
						}
						const items = tasks
							.slice(page * 10, page * 10 + 10)
							.map((task) => sourceTask(task.index));
						return selectedProvider === 'clickup'
							? { tasks: items, last_page: page === 2 }
							: {
									issues: items,
									isLast: page === 2,
									...(page < 2 ? { nextPageToken: String(page + 1) } : {}),
								};
					}
					if (/^\/(task|issue)\/\d+$/.test(path)) {
						return sourceTask(Number(path.split('/').at(-1)) - 1000);
					}
					if (path.endsWith('/comment')) {
						return { comments: [], startAt: 0, total: 0 };
					}
					throw new Error('Unexpected synthetic provider request');
				},
			);
			await login();
		});
		afterAll(async () => {
			vi.restoreAllMocks();
			await runtime?.close();
		});

		it('verifies the owner before encrypted storage, enforces slots and rejects malformed/invalid credentials', async () => {
			const invalid = await post('/connections', {
				provider,
				displayName: 'Invalid',
				credentials: credentials('invalid'),
			});
			expect(invalid.status).toBe(502);
			expect(invalid.body.error.code).toBe('PROVIDER_CREDENTIALS_INVALID');
			expect(await runtime.db.connection.count()).toBe(0);
			const created = await post('/connections', {
				provider,
				displayName: `Synthetic ${provider}`,
				credentials: credentials(),
			});
			expect(created.status).toBe(201);
			connectionId = created.body.id;
			expect(created.body.sourceUserId).toBe(owner);
			expect(JSON.stringify(created.body)).not.toMatch(
				/synthetic-test-token|different-from-app|encryptedCredentials/,
			);
			if (provider === 'jira') {
				expect(created.body.warnings.join(' ')).toContain('no verified');
			}
			const saved = await runtime.db.connection.findUniqueOrThrow({
				where: { id: connectionId },
			});
			expect(saved.encryptedCredentials).not.toContain('synthetic-test-token');
			expect(saved.sourceScopeId).toBe(provider === 'jira' ? cloudId : null);
			expect(
				(
					await post('/connections', {
						provider,
						displayName: 'Duplicate',
						credentials: credentials(),
					})
				).status,
			).toBe(409);
			if (provider === 'jira') {
				expect((await replace({ token: 'synthetic' })).status).toBe(400);
			}
		});

		it('keeps successful labeled catalogs available alongside a failed connection and reaches the final page', async () => {
			await post('/connections', {
				provider: 'linear',
				displayName: 'Synthetic unavailable Linear',
				credentials: { token: 'synthetic-linear' },
			});
			const connections = (await get('/connections')).body;
			expect(connections.items.map((item: { provider: string }) => item.provider)).toContain(
				provider,
			);
			const linear = connections.items.find(
				(item: { provider: string }) => item.provider === 'linear',
			);
			expect((await get(`/connections/${linear.id}/projects`)).body.error.code).toBe(
				'PROVIDER_RATE_LIMITED',
			);
			const first = await get(`/connections/${connectionId}/projects`);
			expect(first.status).toBe(200);
			projectId = first.body.items[0].id;
			expect(first.body.items[0].resourceType).toBe(
				provider === 'clickup' ? 'list' : 'project',
			);
			const second = await get(
				`/connections/${connectionId}/projects?cursor=${encodeURIComponent(first.body.nextCursor)}`,
			);
			expect(second.body.items[0].externalId).toBe('101');
			if (provider === 'clickup') {
				expect(second.body.items[0].breadcrumb).toEqual(['Workspace', 'Space', 'Folder']);
				expect(
					(
						await get(
							`/connections/${connectionId}/projects?cursor=${encodeURIComponent(second.body.nextCursor)}`,
						)
					).body.nextCursor,
				).toBeNull();
			} else {
				expect(second.body.nextCursor).toBeNull();
			}
		});

		it('allows same-identity rotation and rejects account/site changes without changing stored credentials', async () => {
			expect((await replace(credentials('replacement-token'))).status).toBe(200);
			const before = await runtime.db.connection.findUniqueOrThrow({
				where: { id: connectionId },
			});
			expect((await replace(credentials('other-account'))).body.error.code).toBe(
				'CONNECTION_IDENTITY_MISMATCH',
			);
			if (provider === 'jira') {
				expect(
					(
						await replace({
							...credentials(),
							email: 'different-from-app@example.test',
							cloudId: '22222222-2222-4222-8222-222222222222',
						})
					).body.error.code,
				).toBe('CONNECTION_IDENTITY_MISMATCH');
			}
			expect(
				(await runtime.db.connection.findUniqueOrThrow({ where: { id: connectionId } }))
					.encryptedCredentials,
			).toBe(before.encryptedCredentials);
		});

		it('saves all UTC-qualified pages, batches every task and generates automatic/manual reviews only for the API owner', async () => {
			calls.length = 0;
			const accepted = await post(`/projects/${projectId}/syncs`, {
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
			expect(sync.discoveryComplete && sync.importComplete && sync.analysisComplete).toBe(
				true,
			);
			const review = await terminal(sync.reviewRunId!);
			expect(review.state).toBe('succeeded');
			const saved = await runtime.db.taskSnapshot.findMany({
				where: { syncRunId: syncId },
				orderBy: { externalId: 'asc' },
			});
			expect(saved).toHaveLength(21);
			expect(new Set(saved.map((task) => task.state)).size).toBe(3);
			expect(saved[0]?.assignees).toEqual(provider === 'clickup' ? [owner, '43'] : [owner]);
			expect(
				saved.every((task) => task.description.startsWith('Planned synthetic work')),
			).toBe(true);
			expect(
				saved.every((task) =>
					provider === 'jira'
						? task.safeUrl === null
						: task.safeUrl?.startsWith('https://app.clickup.com/t/'),
				),
			).toBe(true);
			expect(
				await runtime.db.analysisBatch.count({
					where: { runId: syncId, level: 0, state: 'succeeded' },
				}),
			).toBe(3);
			const source = await runtime.db.jobRun.findUniqueOrThrow({ where: { id: syncId } });
			const report = ReviewView.parse(
				(await get(`/reviews/${source.currentReviewReportId}`)).body,
			);
			expect(report.subjectSourceUserId).toBe(owner);
			expect(report.coverage.targetTasks).toBe(10);
			expect(
				report.sources.every((item) =>
					saved.some((task) => task.id === item.taskSnapshotId),
				),
			).toBe(true);
			expect(
				calls.filter(
					(call) => call.path === '/list/100/task' || call.path === '/search/jql',
				),
			).toHaveLength(provider === 'clickup' ? 6 : 3);
			const before = calls.length;
			const manual = await post(`/projects/${projectId}/reviews`, {
				syncRunId: syncId,
				idempotencyKey: randomUUID(),
			});
			expect((await terminal(manual.body.runId)).state).toBe('succeeded');
			expect(calls).toHaveLength(before);
			expect(JSON.stringify((await get(`/jobs/${syncId}/trace`)).body)).not.toMatch(
				/replacement-token|synthetic-test-token|different-from-app/,
			);
		});

		it('refreshes only the selected external task, preserves copies and retains a stale snapshot when scope changes', async () => {
			const base = await runtime.db.taskSnapshot.findMany({
				where: { syncRunId: syncId },
				orderBy: { externalId: 'asc' },
			});
			calls.length = 0;
			const accepted = await post(`/projects/${projectId}/syncs`, {
				selection: { mode: 'tasks', baseSyncRunId: syncId, taskIds: [base[0]!.id] },
				idempotencyKey: randomUUID(),
			});
			expect((await terminal(accepted.body.runId)).state).toBe('succeeded');
			expect(
				calls
					.filter((call) => /^\/(task|issue)\/\d+$/.test(call.path))
					.map((call) => call.path),
			).toEqual([`/${provider === 'clickup' ? 'task' : 'issue'}/1000`]);
			expect(
				calls.some((call) => call.path === '/search/jql' || call.path.endsWith('/task')),
			).toBe(false);
			const copied = await runtime.db.taskSnapshot.findFirstOrThrow({
				where: { syncRunId: accepted.body.runId, externalId: base[1]!.externalId },
			});
			expect(copied.retrievedAt).toEqual(base[1]!.retrievedAt);
			expect(copied.copiedFromSnapshotId).toBe(base[1]!.id);
			moved = true;
			const changed = await post(`/projects/${projectId}/syncs`, {
				selection: { mode: 'tasks', baseSyncRunId: syncId, taskIds: [base[0]!.id] },
				generateReview: true,
				idempotencyKey: randomUUID(),
			});
			const partial = await terminal(changed.body.runId);
			moved = false;
			expect(partial.state).toBe('partial');
			expect(partial.reviewRunId).toBeNull();
			expect(
				(
					await runtime.db.taskSnapshot.findFirstOrThrow({
						where: { syncRunId: changed.body.runId, externalId: '1000' },
					})
				).refreshStatus,
			).toBe('stale');
			expect(
				await runtime.db.taskSnapshot.findUniqueOrThrow({ where: { id: base[0]!.id } }),
			).toEqual(base[0]);
		});

		it('does not treat a rate-limited later page as complete or start automatic review', async () => {
			failPage = true;
			const accepted = await post(`/projects/${projectId}/syncs`, {
				selection: period,
				generateReview: true,
				idempotencyKey: randomUUID(),
			});
			const interrupted = await terminal(accepted.body.runId);
			failPage = false;
			expect(interrupted.state).not.toBe('succeeded');
			expect(interrupted.discoveryComplete).toBe(false);
			expect(interrupted.importComplete).toBe(false);
			expect(interrupted.errorCode).toBe('PROVIDER_RATE_LIMITED');
			expect(interrupted.reviewRunId).toBeNull();
			expect(
				await runtime.db.taskSnapshot.count({ where: { syncRunId: accepted.body.runId } }),
			).toBe(10);
		});

		it('denies a second app owner before catalog/credential/task/SSE/trace reads', async () => {
			const ownerJar = jar;
			const ownerCsrf = csrf;
			await login();
			const before = calls.length;
			for (const path of [
				`/connections/${connectionId}/projects`,
				`/projects/${projectId}`,
				`/jobs/${syncId}`,
				`/jobs/${syncId}/events`,
				`/jobs/${syncId}/trace`,
			]) {
				expect((await get(path)).status).toBe(404);
			}
			expect((await replace(credentials())).status).toBe(404);
			expect(calls).toHaveLength(before);
			jar = ownerJar;
			csrf = ownerCsrf;
		});
	});
}
