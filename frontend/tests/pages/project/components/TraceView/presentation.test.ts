import { describe, expect, it } from 'vitest';
import { presentTraceEvent } from '@app/pages/project/components/TraceView/presentation';

describe('safe trace presentation', () => {
	it('uses only exposed timing and keeps zero-count outcomes visible', () => {
		expect(
			presentTraceEvent({
				event: 'tool_completed',
				tool: 'get_issue_comments',
				timestamp: '2026-11-13T10:00:00Z',
				durationMs: 0,
				sourceCount: 0,
				claimCount: 0,
			}),
		).toEqual({
			title: 'Source read completed',
			facts: ['Read task comments', '0 ms', '0 exposed sources', '0 claims'],
			timestamp: '2026-11-13T10:00:00Z',
		});
	});

	it.each([null, { event: 'unit_completed', timestamp: 'invalid' }, { event: 42 }])(
		'keeps unsupported payloads secondary without inventing a successful outcome',
		(value) => {
			expect(presentTraceEvent(value)).toEqual({
				title: 'Saved event · details available',
				facts: [],
				timestamp: undefined,
			});
		},
	);

	it('does not infer execution time or summarize unknown event fields', () => {
		expect(presentTraceEvent({ event: 'future_safe_event', savedCount: 14 })).toEqual({
			title: 'Saved event · details available',
			facts: [],
			timestamp: undefined,
		});
	});
});
