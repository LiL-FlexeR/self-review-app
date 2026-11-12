import { expect, it } from 'vitest';
import { zodTextFormat } from 'openai/helpers/zod';
import { ReportDraft } from '@self-review/contracts';
import type { TClaim, TSource } from '@self-review/contracts';
import {
	analysisReductionSchema,
	parseReductionModelDraft,
	reductionEvidence,
	reductionInput,
	reviewReductionSchema,
} from '@app/modules/agent/utils/reduction-model-draft';
import { validateEvidence } from '@app/modules/agent/utils';

const source: TSource = {
	id: 'synthetic-source',
	taskSnapshotId: '00000000-0000-4000-8000-000000000001',
	kind: 'description',
	textExcerpt: 'План: первый\nвторой. Another quote.',
	url: null,
	createdAt: null,
	updatedAt: null,
	retrievedAt: '2026-11-12T00:00:00.000Z',
	truncated: false,
	state: 'started',
};
const children: TClaim[] = [
	{
		kind: 'task_description',
		text: 'Synthetic plan',
		evidence: [{ sourceId: source.id, quote: 'План: первый\r\nвторой.' }],
	},
	{
		kind: 'task_description',
		text: 'Another plan',
		evidence: [{ sourceId: source.id, quote: 'Another quote.' }],
	},
];
const shared = { schemaVersion: '1.0', limitations: [], explanation: 'Synthetic reduction.' };
const selected = { kind: 'task_description', text: 'Combined plan', evidenceRefs: [1, 0] };

it('indexes distinct source/quote pairs deterministically and deduplicates identical pairs', () => {
	const input = reductionInput([...children, children[0]!], [source]);
	expect(reductionEvidence([...children, children[0]!])).toEqual(
		children.flatMap((claim) => claim.evidence),
	);
	expect(input.childClaims.map((claim) => claim.evidenceRefs)).toEqual([[0], [1], [0]]);
	expect(input.evidenceRegistry).toEqual(
		children.map((claim, reference) => ({
			reference,
			...claim.evidence[0],
			kind: 'description',
			state: 'started',
		})),
	);
	expect(JSON.stringify(input.childClaims)).not.toContain('sourceId');
});

it('bounds evidence reference indexes directly in the strict SDK schemas', () => {
	for (const [schema, field] of [
		[analysisReductionSchema(2), 'findings'],
		[reviewReductionSchema(2), 'claims'],
	] as const) {
		expect(zodTextFormat(schema, 'SyntheticReduction').schema).toMatchObject({
			additionalProperties: false,
			properties: {
				[field]: {
					maxItems: 8,
					items: {
						additionalProperties: false,
						properties: {
							evidenceRefs: {
								minItems: 1,
								maxItems: 2,
								items: { type: 'integer', minimum: 0, maximum: 1 },
							},
						},
					},
				},
			},
		});
	}
});

it('copies exact canonical evidence into analysis and grouped review without leaking references', () => {
	const analysis = parseReductionModelDraft({ ...shared, findings: [selected] }, children, false);
	const review = parseReductionModelDraft(
		{ ...shared, groupTitles: ['Area', '', '', ''], claims: [{ ...selected, groupIndex: 0 }] },
		children,
		true,
	);
	const expected = {
		kind: selected.kind,
		text: selected.text,
		evidence: [children[1]!.evidence[0], children[0]!.evidence[0]],
	};
	expect(analysis.claims).toEqual([expected]);
	expect(review.claims).toEqual([expected]);
	expect(ReportDraft.parse(review.output).groups[0]!.claims).toEqual([expected]);
	expect(Buffer.from(review.claims[0]!.evidence[1]!.quote)).toEqual(
		Buffer.from(children[0]!.evidence[0]!.quote),
	);
	expect(JSON.stringify(review.output)).not.toMatch(/evidenceRefs|groupIndex|groupTitles/);
	validateEvidence(analysis.output, [source], children);
	validateEvidence(review.output, [source], children);
});

it('rejects unknown/noninteger references, missing evidence, rewritten quotes and nine claims', () => {
	for (const evidenceRefs of [[-1], [2], [0.5], [], [0, 1, 0]]) {
		expect(() =>
			parseReductionModelDraft(
				{ ...shared, findings: [{ ...selected, evidenceRefs }] },
				children,
				false,
			),
		).toThrow();
	}
	expect(() =>
		parseReductionModelDraft(
			{
				...shared,
				findings: [{ ...selected, evidence: [{ sourceId: source.id, quote: 'first' }] }],
			},
			children,
			false,
		),
	).toThrow();
	expect(() =>
		parseReductionModelDraft(
			{ ...shared, findings: Array.from({ length: 9 }, () => selected) },
			children,
			false,
		),
	).toThrow();
	expect(() => analysisReductionSchema(0)).toThrow('INVALID_MODEL_OUTPUT');
});

it('still rejects unsupported result classifications after resolving valid references', () => {
	const parsed = parseReductionModelDraft(
		{ ...shared, findings: [{ ...selected, kind: 'reported_result' }] },
		children,
		false,
	);
	expect(() => validateEvidence(parsed.output, [source], children)).toThrow(
		'INVALID_MODEL_OUTPUT',
	);
});
