import { describe, expect, it } from 'vitest';
import { ReportDraft } from '@self-review/contracts';
import { evidenceKey, reportCitations } from './report-presentation';

describe('saved report citations', () => {
	it('numbers exact source and quotation pairs across work areas', () => {
		const first = { sourceId: 'issue:42:description', quote: 'First saved quotation.' };
		const second = {
			sourceId: first.sourceId,
			quote: 'Another quotation from the same source.',
		};
		const third = { sourceId: 'issue:43:description', quote: first.quote };
		const draft = ReportDraft.parse({
			schemaVersion: '1.0',
			groups: [
				{
					title: 'Platform',
					claims: [
						{
							kind: 'task_description',
							text: 'Saved work.',
							evidence: [first, second],
						},
					],
				},
				{
					title: 'Reliability',
					claims: [
						{
							kind: 'reported_result',
							text: 'Reported result.',
							evidence: [first, third],
						},
					],
				},
			],
			limitations: ['Individual contribution is not confirmed.'],
			explanation: 'Synthetic saved evidence.',
		});
		const citations = reportCitations(draft);
		expect([...citations.values()]).toEqual([
			{ ...first, number: 1 },
			{ ...second, number: 2 },
			{ ...third, number: 3 },
		]);
		expect(citations.get(evidenceKey(first))?.number).toBe(1);
	});

	it('does not merge quotations by whitespace or ambiguous source delimiters', () => {
		const pairs = [
			{ sourceId: 'issue:1', quote: 'metric:result' },
			{ sourceId: 'issue:1:metric', quote: 'result' },
			{ sourceId: 'issue:1', quote: ' metric:result ' },
		];
		expect(new Set(pairs.map(evidenceKey)).size).toBe(3);
	});

	it('preserves a valid empty document without inventing evidence', () => {
		const draft = ReportDraft.parse({
			schemaVersion: '1.0',
			groups: [],
			limitations: ['No qualifying subject tasks.'],
			explanation: 'There are no supported claims in the saved source.',
		});
		expect(reportCitations(draft).size).toBe(0);
		expect(draft.limitations).toEqual(['No qualifying subject tasks.']);
	});
});
