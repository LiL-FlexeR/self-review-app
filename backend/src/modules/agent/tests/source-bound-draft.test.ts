import { expect, it } from 'vitest';
import { zodTextFormat } from 'openai/helpers/zod';
import {
	analysisSourceSchema,
	reviewSourceSchema,
} from '@app/modules/agent/utils/source-bound-draft';

const sourceIds = [
	'sync:synthetic:issue:opaque-id:metadata',
	'sync:synthetic:issue:opaque-id:description',
];
const claim = {
	kind: 'task_description',
	text: 'Synthetic plan',
	evidence: [{ sourceId: sourceIds[0], quote: 'Planned work' }],
};
const shared = { schemaVersion: '1.0', limitations: [], explanation: 'Synthetic evidence.' };

it('restricts both leaf output schemas to the deduplicated exposed source IDs', () => {
	for (const [schema, field] of [
		[analysisSourceSchema([...sourceIds, sourceIds[0]!]), 'findings'],
		[reviewSourceSchema(sourceIds), 'claims'],
	] as const) {
		expect(zodTextFormat(schema, 'SyntheticSourceBoundDraft').schema).toMatchObject({
			additionalProperties: false,
			properties: {
				[field]: {
					maxItems: 8,
					items: {
						properties: {
							evidence: {
								minItems: 1,
								maxItems: 2,
								items: {
									properties: {
										sourceId: { type: 'string', enum: sourceIds },
									},
								},
							},
						},
					},
				},
			},
		});
	}
});

it('rejects guessed, prior-snapshot and other-unit source IDs without rewriting evidence', () => {
	const schema = analysisSourceSchema(sourceIds);
	expect(schema.parse({ ...shared, findings: [claim] }).findings[0]).toEqual(claim);
	for (const sourceId of [
		'SYN-1',
		'sync:previous:issue:opaque-id:metadata',
		'sync:synthetic:issue:other-id:metadata',
	]) {
		expect(
			schema.safeParse({
				...shared,
				findings: [{ ...claim, evidence: [{ sourceId, quote: 'Planned work' }] }],
			}).success,
		).toBe(false);
	}
	expect(
		reviewSourceSchema(sourceIds).safeParse({
			...shared,
			groupTitles: ['Area', '', '', ''],
			claims: [{ ...claim, groupIndex: 0 }],
		}).success,
	).toBe(true);
});

it('keeps the initial no-source research schema usable before mandatory tool exposure', () => {
	expect(analysisSourceSchema([]).parse({ ...shared, findings: [] }).findings).toEqual([]);
	expect(zodTextFormat(analysisSourceSchema([]), 'InitialResearch').schema).toMatchObject({
		properties: { findings: { maxItems: 8 } },
	});
});
