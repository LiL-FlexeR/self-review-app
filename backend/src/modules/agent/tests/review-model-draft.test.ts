import { expect, it } from 'vitest';
import { zodTextFormat } from 'openai/helpers/zod';
import { ReportDraft } from '@self-review/contracts';
import {
	ReviewModelDraft,
	parseReviewModelDraft,
} from '@app/modules/agent/utils/review-model-draft';

const claim = {
	kind: 'task_description' as const,
	text: 'Synthetic planned work',
	evidence: [{ sourceId: 'synthetic-source', quote: 'Plan' }],
};
const draft = {
	schemaVersion: '1.0',
	groupTitles: ['Area A', 'Area B', 'Area C', 'Area D'],
	claims: Array.from({ length: 8 }, (_value, index) => ({ ...claim, groupIndex: index % 4 })),
	limitations: [],
	explanation: 'Synthetic report.',
};

it('puts total claim and group bounds directly in the SDK JSON schema', () => {
	expect(zodTextFormat(ReviewModelDraft, 'ReviewModelDraft').schema).toMatchObject({
		type: 'object',
		additionalProperties: false,
		properties: {
			claims: {
				type: 'array',
				maxItems: 8,
				items: { properties: { groupIndex: { type: 'integer', minimum: 0, maximum: 3 } } },
			},
			groupTitles: { type: 'array', minItems: 4, maxItems: 4 },
		},
	});
});

it('constructs the existing public report without dropping claims or changing evidence', () => {
	const parsed = parseReviewModelDraft(draft);
	expect(ReportDraft.parse(parsed.report)).toEqual(parsed.report);
	expect(parsed.report.groups).toHaveLength(4);
	expect(parsed.report.groups.every((group) => group.claims.length === 2)).toBe(true);
	expect(parsed.report.groups.flatMap((group) => group.claims)).toEqual(
		Array.from({ length: 8 }, () => claim),
	);
	expect(parsed.claims).toEqual(Array.from({ length: 8 }, () => claim));
	expect(JSON.stringify(parsed.report)).not.toMatch(/groupIndex|groupTitles/);
});

it('rejects nine claims and invalid title/index shapes instead of silently truncating them', () => {
	expect(() =>
		parseReviewModelDraft({ ...draft, claims: [...draft.claims, draft.claims[0]] }),
	).toThrow();
	expect(() => parseReviewModelDraft({ ...draft, groupTitles: ['Only one title'] })).toThrow();
	for (const groupIndex of [-1, 4, 1.5]) {
		expect(() =>
			parseReviewModelDraft({ ...draft, claims: [{ ...claim, groupIndex }] }),
		).toThrow();
	}
});

it('keeps wire claim order available for evidence correction and omits unused groups', () => {
	const second = { ...claim, text: 'Second synthetic claim', groupIndex: 0 };
	const parsed = parseReviewModelDraft({
		...draft,
		claims: [{ ...claim, groupIndex: 3 }, second],
	});
	expect(parsed.claims.map((item) => item.text)).toEqual([claim.text, second.text]);
	expect(parsed.report.groups.map((group) => group.title)).toEqual(['Area A', 'Area D']);
	expect(parseReviewModelDraft({ ...draft, claims: [] }).report.groups).toEqual([]);
});
