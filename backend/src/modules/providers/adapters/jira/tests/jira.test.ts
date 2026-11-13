import { afterEach, expect, it, vi } from 'vitest';
import { JiraService } from '@app/modules/providers/adapters/jira/jira.service';
import { adfText, jiraOrigin } from '@app/modules/providers/adapters/jira/adf';
import { RestTransport } from '@app/modules/providers/services/rest-transport.service';
import { ProviderError } from '@app/errors/provider.error';

const credentials = {
	email: 'synthetic@example.test',
	token: 'synthetic-token',
	cloudId: '11111111-1111-4111-8111-111111111111',
};
const doc = {
	type: 'doc',
	version: 1,
	content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Planned synthetic work.' }] }],
};
const project = { id: '100', key: 'SYN', name: 'Synthetic' };
const issue = {
	id: '1001',
	key: 'SYN-1',
	fields: {
		project,
		summary: 'Synthetic issue',
		description: doc,
		status: { name: 'Done', statusCategory: { key: 'done' } },
		assignee: null,
		created: '2026-10-01T05:30:00.000+0530',
		updated: '2026-10-02T00:00:00Z',
	},
};
afterEach(() => vi.restoreAllMocks());

it('extracts ADF paragraphs, lists, line breaks, code, mentions and tables as inert text', () => {
	expect(
		adfText({
			type: 'doc',
			version: 1,
			content: [
				{ type: 'heading', content: [{ type: 'text', text: 'Heading' }] },
				{
					type: 'bulletList',
					content: [
						{
							type: 'listItem',
							content: [
								{
									type: 'paragraph',
									content: [
										{
											type: 'text',
											text: '<script>literal</script>',
											marks: [
												{
													type: 'link',
													attrs: { href: 'https://attacker.example' },
												},
											],
										},
										{ type: 'hardBreak' },
										{ type: 'mention', attrs: { text: '@Anna' } },
									],
								},
							],
						},
					],
				},
				{ type: 'codeBlock', content: [{ type: 'text', text: 'code()' }] },
				{ type: 'inlineCard', attrs: { url: 'https://attacker.example/private' } },
			],
		}),
	).toBe('Heading\n<script>literal</script>\n@Anna\n\ncode()\n[embedded content omitted]');
	expect(adfText(null)).toBe('');
	expect(() => adfText('unvalidated rich text')).toThrow();
	expect(() => adfText({ type: 'doc', version: 1, content: [{ type: 'text' }] })).toThrow();
});

it.each([
	'http://safe.atlassian.net',
	'https://attacker.example',
	'https://safe.atlassian.net.attacker.example',
	'https://user:secret@safe.atlassian.net',
	'https://safe.atlassian.net:8443',
	'https://safe.atlassian.net/path',
	'https://safe.atlassian.net?query=true',
	'https://atlassian.net',
])('rejects unsupported browser origin %s', (url) => {
	expect(jiraOrigin(url)).toBeNull();
});

it('uses API-confirmed accountId and tolerates unavailable/unsupported origin discovery without guessing a URL', async () => {
	const transport = new RestTransport();
	const send = vi
		.spyOn(transport, 'send')
		.mockResolvedValueOnce({ accountId: 'api-owner', displayName: 'Anna' })
		.mockRejectedValueOnce(new ProviderError('PROVIDER_CREDENTIALS_INVALID'));
	const service = new JiraService(transport);
	expect(await service.identity(credentials)).toEqual({
		sourceUserId: 'api-owner',
		sourceUserName: 'Anna',
		sourceScopeId: credentials.cloudId,
		sourceBaseUrl: null,
	});
	send.mockResolvedValueOnce({
		accountId: 'api-owner',
		displayName: 'Anna',
	}).mockResolvedValueOnce({ baseUrl: 'https://safe.atlassian.net/' });
	expect((await service.identity(credentials)).sourceBaseUrl).toBe('https://safe.atlassian.net');
});

it('paginates project search without following the supplied nextPage URL', async () => {
	const transport = new RestTransport();
	const send = vi
		.spyOn(transport, 'send')
		.mockResolvedValueOnce({
			values: [project],
			startAt: 0,
			isLast: false,
			nextPage: 'https://attacker.example',
		})
		.mockResolvedValueOnce({ values: [{ ...project, id: '101' }], startAt: 1, isLast: true });
	const service = new JiraService(transport);
	const first = await service.projects(credentials, null, 'https://safe.atlassian.net');
	expect(first.nextCursor).toBe('1');
	expect(
		(await service.projects(credentials, first.nextCursor, 'https://safe.atlassian.net'))
			.nextCursor,
	).toBeNull();
	expect(send.mock.calls.every((call) => call[2] === '/project/search')).toBe(true);
	send.mockResolvedValueOnce({ values: [], startAt: 2, isLast: false });
	await expect(service.projects(credentials, '2', null)).rejects.toMatchObject({
		code: 'PAGINATION_LOOP',
	});
});

it('uses enhanced JQL continuation with broad timezone bounds and retains precise timestamps for UTC validation', async () => {
	const transport = new RestTransport();
	const send = vi
		.spyOn(transport, 'send')
		.mockResolvedValueOnce(project)
		.mockResolvedValueOnce({ issues: [issue], isLast: false, nextPageToken: 'next' })
		.mockResolvedValueOnce({
			issues: [
				{
					...issue,
					id: '1002',
					fields: { ...issue.fields, assignee: { accountId: 'another' } },
				},
			],
			isLast: true,
		});
	const provider = await new JiraService(transport).open(
		credentials,
		'100',
		'https://safe.atlassian.net',
	);
	const first = await provider.list(
		'100',
		null,
		new Date('2026-10-01T00:00:00Z'),
		new Date('2026-11-01T00:00:00Z'),
	);
	expect(first.items[0]).toMatchObject({
		createdAt: new Date('2026-10-01T00:00:00Z'),
		description: 'Planned synthetic work.',
		assignees: [],
		safeUrl: 'https://safe.atlassian.net/browse/SYN-1',
	});
	expect(
		(
			await provider.list(
				'100',
				first.nextCursor,
				new Date('2026-10-01T00:00:00Z'),
				new Date('2026-11-01T00:00:00Z'),
			)
		).items[0]?.assignees,
	).toEqual(['another']);
	expect(send.mock.calls[1]?.[2]).toBe('/search/jql');
	expect(send.mock.calls[1]?.[3]?.jql).toBe(
		'project = 100 AND created >= "2026-09-29" AND created < "2026-11-03" ORDER BY id ASC',
	);
	expect(send.mock.calls[2]?.[3]?.nextPageToken).toBe('next');
});

it('rejects incomplete/repeated continuation, moved details and invalid descriptions', async () => {
	const transport = new RestTransport();
	const send = vi
		.spyOn(transport, 'send')
		.mockResolvedValueOnce(project)
		.mockResolvedValueOnce({ issues: [issue], isLast: false })
		.mockResolvedValueOnce({ issues: [issue], isLast: false, nextPageToken: 'same' })
		.mockResolvedValueOnce({ ...issue, fields: { ...issue.fields, project: { id: '200' } } })
		.mockResolvedValueOnce({ ...issue, fields: { ...issue.fields, description: 'not ADF' } });
	const provider = await new JiraService(transport).open(credentials, '100', null);
	for (const cursor of [null, 'same']) {
		await expect(
			provider.list('100', cursor, new Date('2026-10-01'), new Date('2026-11-01')),
		).rejects.toMatchObject({ code: 'PAGINATION_LOOP' });
	}
	await expect(provider.details('100', '1001')).rejects.toMatchObject({
		code: 'PROVIDER_SCOPE_CHANGED',
	});
	await expect(provider.details('100', '1001')).rejects.toMatchObject({
		code: 'PROVIDER_RESPONSE_INVALID',
	});
	expect(send).toHaveBeenCalledTimes(5);
});

it('preserves internal citations with no origin and probes six newest ADF comments with honest omissions', async () => {
	const transport = new RestTransport();
	const send = vi
		.spyOn(transport, 'send')
		.mockResolvedValueOnce(project)
		.mockResolvedValueOnce(issue)
		.mockResolvedValueOnce(issue)
		.mockResolvedValueOnce({
			startAt: 0,
			total: 30,
			comments: Array.from({ length: 6 }, (_value, index) => ({
				id: String(index),
				body: doc,
				created: '2026-10-01T00:00:00Z',
			})),
		});
	const provider = await new JiraService(transport).open(credentials, '100', null);
	expect((await provider.details('100', '1001')).safeUrl).toBeNull();
	const result = await provider.comments('100', '1001');
	expect(result.items).toHaveLength(5);
	expect(result.items[0]?.body).toBe('Planned synthetic work.');
	expect(result.hasMore).toBe(true);
	expect(provider.warnings?.join(' ')).toContain('no verified');
	expect(send.mock.calls.at(-1)?.[3]).toEqual({ maxResults: '6', orderBy: '-created' });
});
