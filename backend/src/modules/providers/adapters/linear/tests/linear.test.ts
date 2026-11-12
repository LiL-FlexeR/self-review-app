import { afterEach, expect, it, vi } from 'vitest';
import { LinearTransport } from '@app/modules/providers/adapters/linear/services/linear-transport.service';
import { LinearService } from '@app/modules/providers/adapters/linear/services/linear.service';
import { LINEAR_QUERIES } from '@app/modules/providers/adapters/linear/linear.queries';
import { LIMITS } from '@app/modules/agent/agent.schemas';

const token = 'synthetic-linear-key';
const issue = {
	id: 'issue-1',
	identifier: 'SYN-1',
	title: 'Synthetic task',
	description: null,
	createdAt: '2026-10-01T00:00:00Z',
	updatedAt: '2026-10-02T00:00:00Z',
	url: 'https://linear.app/synthetic/issue/SYN-1',
	state: { type: 'canceled' },
	assignee: null,
	project: { id: 'project-1' },
};
const pageInfo = { hasNextPage: false, endCursor: null };

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

it('uses only the fixed endpoint and raw personal-key header, with query variables', async () => {
	const fetcher = vi.fn().mockResolvedValue(
		new Response(
			JSON.stringify({
				data: {
					viewer: { id: 'owner', name: 'Anna' },
					organization: { id: 'workspace', name: 'Synthetic' },
				},
			}),
		),
	);
	vi.stubGlobal('fetch', fetcher);
	await new LinearService(new LinearTransport()).identity(token);
	expect(fetcher).toHaveBeenCalledWith(
		'https://api.linear.app/graphql',
		expect.objectContaining({
			method: 'POST',
			redirect: 'error',
			headers: { Authorization: token, 'Content-Type': 'application/json' },
			body: JSON.stringify({ query: LINEAR_QUERIES.identity, variables: {} }),
		}),
	);
});

it.each([
	['UNAUTHENTICATED', 'PROVIDER_CREDENTIALS_INVALID'],
	['FORBIDDEN', 'PROVIDER_CREDENTIALS_INVALID'],
	['RATELIMITED', 'PROVIDER_RATE_LIMITED'],
	['GRAPHQL_VALIDATION_FAILED', 'PROVIDER_RESPONSE_INVALID'],
])('rejects GraphQL HTTP 200 errors, including partial data: %s', async (code, expected) => {
	const fetcher = vi.fn().mockImplementation(
		async () =>
			new Response(
				JSON.stringify({
					data: { viewer: {} },
					errors: [
						{ message: 'private payload must be discarded', extensions: { code } },
					],
				}),
			),
	);
	vi.stubGlobal('fetch', fetcher);
	await expect(
		new LinearTransport().send(token, LINEAR_QUERIES.identity, {}),
	).rejects.toMatchObject({ code: expected });
	expect(fetcher).toHaveBeenCalledTimes(1);
});

it('retries a temporary HTTP failure once and never retries invalid keys', async () => {
	const fetcher = vi
		.fn()
		.mockResolvedValueOnce(new Response('', { status: 503 }))
		.mockResolvedValueOnce(new Response('{"data":{"ok":true}}'));
	vi.stubGlobal('fetch', fetcher);
	expect(await new LinearTransport().send(token, '', {})).toEqual({ ok: true });
	expect(fetcher).toHaveBeenCalledTimes(2);
	fetcher.mockReset().mockImplementation(async () => new Response('', { status: 401 }));
	await expect(new LinearTransport().send(token, '', {})).rejects.toMatchObject({
		code: 'PROVIDER_CREDENTIALS_INVALID',
	});
	expect(fetcher).toHaveBeenCalledTimes(1);
});

it('bounds timeout retries to two requests', async () => {
	vi.useFakeTimers();
	const fetcher = vi
		.fn()
		.mockImplementation(
			(_url, options: RequestInit) =>
				new Promise((_resolve, reject) =>
					options.signal?.addEventListener('abort', () => reject(new Error('timeout'))),
				),
		);
	vi.stubGlobal('fetch', fetcher);
	const pending = expect(new LinearTransport().send(token, '', {})).rejects.toMatchObject({
		code: 'PROVIDER_UNAVAILABLE',
	});
	await vi.advanceTimersByTimeAsync(LIMITS.providerRequestMs * 2);
	await pending;
	expect(fetcher).toHaveBeenCalledTimes(2);
});

it('stops reading a response above the byte limit before parsing it', async () => {
	const cancel = vi.fn();
	vi.stubGlobal(
		'fetch',
		vi.fn().mockResolvedValue(
			new Response(
				new ReadableStream({
					start(controller) {
						controller.enqueue(new Uint8Array(LIMITS.providerResponseBytes + 1));
					},
					cancel,
				}),
			),
		),
	);
	await expect(new LinearTransport().send(token, '', {})).rejects.toMatchObject({
		code: 'PROVIDER_RESPONSE_LIMIT',
	});
	expect(cancel).toHaveBeenCalledOnce();
});

it('preserves null fields, all statuses and assignees, and broad UTC filter/archive variables', async () => {
	const transport = new LinearTransport();
	const send = vi
		.spyOn(transport, 'send')
		.mockResolvedValueOnce({ project: { id: 'project-1', name: 'Synthetic' } })
		.mockResolvedValueOnce({
			project: {
				id: 'project-1',
				issues: {
					nodes: [
						issue,
						{
							...issue,
							id: 'issue-2',
							state: { type: 'started' },
							assignee: { id: 'other' },
						},
					],
					pageInfo,
				},
			},
		});
	const provider = await new LinearService(transport).open(token, 'project-1');
	const start = new Date('2026-10-01T00:00:00Z');
	const end = new Date('2026-11-01T00:00:00Z');
	const page = await provider.list('project-1', 'opaque-cursor', start, end);
	expect(page.items[0]).toMatchObject({
		description: '',
		state: 'canceled',
		assignees: [],
		safeUrl: issue.url,
	});
	expect(page.items[1]).toMatchObject({ state: 'started', assignees: ['other'] });
	expect(send.mock.calls[1]).toEqual([
		token,
		LINEAR_QUERIES.issues,
		{
			id: 'project-1',
			after: 'opaque-cursor',
			filter: { createdAt: { gte: start.toISOString(), lte: end.toISOString() } },
		},
	]);
	expect(LINEAR_QUERIES.issues).toContain('includeArchived: true');
	expect(LINEAR_QUERIES.issues).not.toMatch(/assignee:|state:/);
});

it('deduplicates catalog IDs, exposes continuation and rejects non-advancing pages', async () => {
	const transport = new LinearTransport();
	const send = vi.spyOn(transport, 'send').mockResolvedValue({
		organization: { name: 'Synthetic workspace' },
		projects: {
			nodes: [
				{ id: 'project-1', name: 'Demo' },
				{ id: 'project-1', name: 'Demo' },
			],
			pageInfo: { hasNextPage: true, endCursor: 'next' },
		},
	});
	const linear = new LinearService(transport);
	expect(await linear.projects(token, null)).toMatchObject({
		items: [{ externalId: 'project-1', breadcrumb: ['Synthetic workspace'] }],
		nextCursor: 'next',
	});
	await expect(linear.projects(token, 'next')).rejects.toMatchObject({ code: 'PAGINATION_LOOP' });
	send.mockResolvedValue({
		organization: { name: 'Synthetic' },
		projects: { nodes: [], pageInfo: { hasNextPage: true, endCursor: 'new' } },
	});
	await expect(linear.projects(token, null)).rejects.toMatchObject({ code: 'PAGINATION_LOOP' });
});

it('rejects malformed responses and oversized metadata with distinct codes', async () => {
	const transport = new LinearTransport();
	vi.spyOn(transport, 'send')
		.mockResolvedValueOnce({ viewer: null })
		.mockResolvedValueOnce({
			organization: { name: 'Synthetic' },
			projects: { nodes: [{ id: 'project-1', name: 'a'.repeat(65537) }], pageInfo },
		});
	const linear = new LinearService(transport);
	await expect(linear.identity(token)).rejects.toMatchObject({
		code: 'PROVIDER_RESPONSE_INVALID',
	});
	await expect(linear.projects(token, null)).rejects.toMatchObject({
		code: 'PROVIDER_FIELD_LIMIT',
	});
});

it('rejects a moved selected task and strips unsafe source links', async () => {
	const transport = new LinearTransport();
	vi.spyOn(transport, 'send')
		.mockResolvedValueOnce({ project: { id: 'project-1', name: 'Demo' } })
		.mockResolvedValueOnce({ issue: { ...issue, project: { id: 'other-project' } } })
		.mockResolvedValueOnce({ issue: { ...issue, url: 'https://attacker.example/issue' } });
	const provider = await new LinearService(transport).open(token, 'project-1');
	await expect(provider.details('project-1', 'issue-1')).rejects.toMatchObject({
		code: 'PROVIDER_SCOPE_CHANGED',
	});
	expect((await provider.details('project-1', 'issue-1')).safeUrl).toBeNull();
});

it('reads a six-record newest-first comment probe without following URLs', async () => {
	const transport = new LinearTransport();
	const send = vi
		.spyOn(transport, 'send')
		.mockResolvedValueOnce({ project: { id: 'project-1', name: 'Demo' } })
		.mockResolvedValueOnce({
			issue: {
				id: 'issue-1',
				project: { id: 'project-1' },
				comments: {
					nodes: [
						{
							id: 'comment-1',
							body: 'Text\r\nwith\u0000 links',
							user: null,
							createdAt: issue.createdAt,
						},
					],
					pageInfo,
				},
			},
		});
	const provider = await new LinearService(transport).open(token, 'project-1');
	expect(await provider.comments('project-1', 'issue-1')).toEqual({
		hasMore: false,
		items: [
			{
				externalId: 'comment-1',
				body: 'Text\nwith links',
				author: null,
				createdAt: new Date(issue.createdAt),
			},
		],
	});
	expect(send.mock.calls[1]?.[1]).toContain('first: 6');
	expect(send.mock.calls[1]?.[1]).toContain('orderBy: createdAt');
});
