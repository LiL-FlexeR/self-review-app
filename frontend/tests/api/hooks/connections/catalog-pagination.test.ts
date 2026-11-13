import { expect, it } from 'vitest';
import { catalogContinuation } from '@app/api/hooks/connections/catalog-pagination';

it('traverses opaque cursors through explicit completion', () => {
	const first = { items: [{ id: 'project-1' }], nextCursor: 'opaque/next' };
	expect(catalogContinuation([first], [null])).toEqual({
		nextCursor: 'opaque/next',
		hasLoop: false,
	});
	expect(
		catalogContinuation(
			[first, { items: [{ id: 'project-2' }], nextCursor: null }],
			[null, 'opaque/next'],
		),
	).toEqual({ nextCursor: undefined, hasLoop: false });
});

it('stops repeated cursors and duplicate-only pages without hiding their incomplete state', () => {
	const first = { items: [{ id: 'project-1' }], nextCursor: 'next' };
	expect(
		catalogContinuation(
			[first, { items: [{ id: 'project-2' }], nextCursor: 'next' }],
			[null, 'next'],
		).hasLoop,
	).toBe(true);
	expect(
		catalogContinuation([first, { ...first, nextCursor: 'another' }], [null, 'next']).hasLoop,
	).toBe(true);
});

it('continues empty hierarchy pages while their cursors advance, then completes explicitly', () => {
	const first = { items: [], nextCursor: 'folder-1' };
	const second = { items: [], nextCursor: 'folder-2' };
	expect(catalogContinuation([first], [null])).toEqual({
		nextCursor: 'folder-1',
		hasLoop: false,
	});
	expect(catalogContinuation([first, second], [null, 'folder-1'])).toEqual({
		nextCursor: 'folder-2',
		hasLoop: false,
	});
	expect(
		catalogContinuation(
			[first, second, { items: [{ id: 'folder-list' }], nextCursor: null }],
			[null, 'folder-1', 'folder-2'],
		),
	).toEqual({ nextCursor: undefined, hasLoop: false });
	expect(
		catalogContinuation([first, { items: [], nextCursor: 'folder-1' }], [null, 'folder-1'])
			.hasLoop,
	).toBe(true);
});
