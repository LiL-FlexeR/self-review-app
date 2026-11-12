import { expect, it } from 'vitest';
import { catalogContinuation } from './pagination';

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
