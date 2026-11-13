import { afterEach, expect, it, vi } from 'vitest';
import { ClickUpService } from '@app/modules/providers/adapters/clickup/clickup.service';
import { RestTransport } from '@app/modules/providers/services/rest-transport.service';

const token = 'synthetic-token';
const task = {
	id: 'task-1',
	name: 'Synthetic task',
	description: null,
	status: { status: 'Closed', type: 'closed' },
	assignees: [{ id: 42 }, { id: 43 }],
	date_created: '1790812800000',
	date_updated: '1790899200000',
	list: { id: 'home-list' },
	locations: [{ id: 'selected-list' }],
};
const start = new Date('2026-10-01T00:00:00Z');
const end = new Date('2026-11-01T00:00:00Z');
afterEach(() => vi.restoreAllMocks());

it('verifies the API owner rather than an email or workspace member', async () => {
	const transport = new RestTransport();
	vi.spyOn(transport, 'send').mockResolvedValue({
		user: { id: 42, username: 'Synthetic Anna', email: 'different@example.test' },
	});
	expect(await new ClickUpService(transport).identity(token)).toMatchObject({
		sourceUserId: '42',
		sourceUserName: 'Synthetic Anna',
	});
});

it('traverses active/archived hierarchy, folderless Lists and nested breadcrumbs without merging same names', async () => {
	const transport = new RestTransport();
	const send = vi
		.spyOn(transport, 'send')
		.mockImplementation(async (_provider, _credentials, path, query) => {
			if (path === '/team') {
				return { teams: [{ id: 'workspace', name: 'Workspace' }] };
			}
			if (path.endsWith('/space')) {
				return { spaces: [{ id: 'space', name: 'Space' }] };
			}
			if (path.endsWith('/folder')) {
				return {
					folders: [
						{ id: 'parent', name: 'Parent' },
						{ id: 'child', name: 'Child', parent_folder: 'parent' },
					],
				};
			}
			return {
				lists:
					query?.archived === 'true'
						? [
								{
									id: path.includes('child')
										? 'archived-child'
										: path.includes('parent')
											? 'archived-parent'
											: 'archived-root',
									name: 'Same name',
								},
							]
						: [
								{
									id: path.includes('child')
										? 'child-list'
										: path.includes('parent')
											? 'parent-list'
											: 'root-list',
									name: 'Same name',
								},
							],
			};
		});
	const service = new ClickUpService(transport);
	const first = await service.projects(token, null);
	const second = await service.projects(token, first.nextCursor);
	const third = await service.projects(token, second.nextCursor);
	expect(first.items).toHaveLength(2);
	expect(third.items[0]).toMatchObject({
		externalId: 'child-list',
		resourceType: 'list',
		breadcrumb: ['Workspace', 'Space', 'Parent', 'Child'],
	});
	expect((await service.projects(token, third.nextCursor)).nextCursor).toBeNull();
	expect(send.mock.calls.some((call) => call[3]?.archived === 'true')).toBe(true);
});

it.each([false, true])(
	'skips empty folderless Lists, Spaces and Folders and reports completion honestly (hasLists=%s)',
	async (hasLists) => {
		const transport = new RestTransport();
		vi.spyOn(transport, 'send').mockImplementation(async (_provider, _credentials, path) => {
			if (path === '/team') {
				return { teams: [{ id: 'workspace', name: 'Workspace' }] };
			}
			if (path.endsWith('/space')) {
				return {
					spaces: [
						{ id: 'empty-space', name: 'Empty Space' },
						{ id: 'space', name: 'Space' },
					],
				};
			}
			if (path.endsWith('/folder')) {
				return {
					folders: path.includes('empty-space')
						? []
						: [
								{ id: 'empty-folder', name: 'Empty Folder' },
								{ id: 'folder', name: 'Folder' },
							],
				};
			}
			return {
				lists:
					hasLists && path === '/folder/folder/list'
						? [{ id: 'folder-list', name: 'List in Folder' }]
						: [],
			};
		});
		const service = new ClickUpService(transport);
		const first = await service.projects(token, null);
		if (!hasLists) {
			expect(first).toEqual({ items: [], nextCursor: null });
			return;
		}
		expect(first.items).toEqual([
			{
				externalId: 'folder-list',
				name: 'List in Folder',
				resourceType: 'list',
				breadcrumb: ['Workspace', 'Space', 'Folder'],
			},
		]);
		expect((await service.projects(token, first.nextCursor)).nextCursor).toBeNull();
	},
);

it('includes closed/subtasks/TIML and archived pages, deduplicates IDs and retains all assignees', async () => {
	const transport = new RestTransport();
	const send = vi
		.spyOn(transport, 'send')
		.mockImplementation(async (_provider, _credentials, path, query) => {
			if (path === '/list/selected-list') {
				return { id: 'selected-list', name: 'List' };
			}
			if (path.includes('/task/')) {
				return task;
			}
			return { tasks: [task], last_page: query?.page === '1' };
		});
	const provider = await new ClickUpService(transport).open(token, 'selected-list');
	const first = await provider.list('selected-list', null, start, end);
	expect(first.items).toHaveLength(1);
	expect(first.items[0]).toMatchObject({
		externalId: 'task-1',
		assignees: ['42', '43'],
		description: '',
		state: 'Closed (closed)',
	});
	expect(first.nextCursor).toBe('1');
	expect(
		(await provider.list('selected-list', first.nextCursor, start, end)).nextCursor,
	).toBeNull();
	expect(await provider.details('selected-list', 'task-1')).toMatchObject({
		externalId: 'task-1',
	});
	const queries = send.mock.calls
		.filter((call) => call[2].endsWith('/task'))
		.map((call) => call[3]);
	expect(queries).toHaveLength(4);
	for (const query of queries) {
		expect(query).toMatchObject({
			include_closed: 'true',
			subtasks: 'true',
			include_timl: 'true',
			date_created_gt: String(start.getTime() - 1),
		});
	}
});

it('uses fresh TIML locations for selected refresh, denies moved tasks, and caps comments with omission metadata', async () => {
	const transport = new RestTransport();
	const send = vi
		.spyOn(transport, 'send')
		.mockResolvedValueOnce({ id: 'selected-list', name: 'List' })
		.mockResolvedValueOnce(task)
		.mockResolvedValueOnce({ ...task, locations: [] })
		.mockResolvedValueOnce(task)
		.mockResolvedValueOnce({
			comments: Array.from({ length: 6 }, (_value, index) => ({
				id: String(index),
				comment_text: `Comment ${index}\r\ntext`,
				user: null,
				date: '1790812800000',
			})),
		});
	const provider = await new ClickUpService(transport).open(token, 'selected-list');
	expect((await provider.details('selected-list', 'task-1')).assignees).toEqual(['42', '43']);
	await expect(provider.details('selected-list', 'task-1')).rejects.toMatchObject({
		code: 'PROVIDER_SCOPE_CHANGED',
	});
	const comments = await provider.comments('selected-list', 'task-1');
	expect(comments.items).toHaveLength(5);
	expect(comments.hasMore).toBe(true);
	expect(comments.items[0]?.body).toBe('Comment 0\ntext');
	expect(send).toHaveBeenCalledTimes(5);
});

it('fails closed for malformed pages and invalid cursors', async () => {
	const transport = new RestTransport();
	vi.spyOn(transport, 'send')
		.mockResolvedValueOnce({ id: 'selected-list', name: 'List' })
		.mockResolvedValue({ tasks: [task] });
	const service = new ClickUpService(transport);
	const provider = await service.open(token, 'selected-list');
	await expect(provider.list('selected-list', null, start, end)).rejects.toMatchObject({
		code: 'PROVIDER_RESPONSE_INVALID',
	});
	await expect(service.projects(token, '{"workspace":-1}')).rejects.toMatchObject({
		code: 'PAGINATION_LOOP',
	});
});
