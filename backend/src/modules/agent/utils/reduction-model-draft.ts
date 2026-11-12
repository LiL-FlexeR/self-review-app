import { z as zod } from 'zod';
import { Claim } from '@self-review/contracts';
import type { TClaim, TSource } from '@self-review/contracts';
import { Analysis } from '@app/modules/agent/agent.schemas';
import { parseReviewModelDraft } from './review-model-draft.js';

export function reductionEvidence(claims: TClaim[]) {
	const pairs = new Map<string, TClaim['evidence'][number]>();
	for (const claim of claims) {
		for (const pair of claim.evidence) {
			pairs.set(JSON.stringify([pair.sourceId, pair.quote]), pair);
		}
	}
	return [...pairs.values()];
}

export function reductionInput(claims: TClaim[], sources: TSource[]) {
	const evidence = reductionEvidence(claims);
	return {
		childClaims: claims.map(({ evidence: pairs, ...claim }) => ({
			...claim,
			evidenceRefs: pairs.map((pair) =>
				evidence.findIndex(
					(candidate) =>
						candidate.sourceId === pair.sourceId && candidate.quote === pair.quote,
				),
			),
		})),
		evidenceRegistry: evidence.map((pair, reference) => {
			const source = sources.find((candidate) => candidate.id === pair.sourceId);
			return { reference, ...pair, kind: source?.kind, state: source?.state };
		}),
	};
}

function reductionClaim(evidenceCount: number) {
	if (!Number.isSafeInteger(evidenceCount) || evidenceCount < 1) {
		throw new Error('INVALID_MODEL_OUTPUT');
	}
	return zod.strictObject({
		kind: Claim.shape.kind,
		text: Claim.shape.text,
		evidenceRefs: zod
			.array(
				zod
					.number()
					.int()
					.min(0)
					.max(evidenceCount - 1),
			)
			.min(1)
			.max(2),
	});
}

export function reviewReductionSchema(evidenceCount: number) {
	return zod.strictObject({
		schemaVersion: zod.literal('1.0'),
		groupTitles: zod.array(zod.string().max(100)).length(4),
		claims: zod
			.array(
				reductionClaim(evidenceCount).extend({
					groupIndex: zod.number().int().min(0).max(3),
				}),
			)
			.max(8),
		limitations: zod.array(zod.string().max(300)).max(8),
		explanation: zod.string().max(400),
	});
}

export function analysisReductionSchema(evidenceCount: number) {
	return zod.strictObject({
		schemaVersion: zod.literal('1.0'),
		findings: zod.array(reductionClaim(evidenceCount)).max(8),
		limitations: zod.array(zod.string().max(300)).max(8),
		explanation: zod.string().max(400),
	});
}

export function parseReductionModelDraft(value: unknown, children: TClaim[], report: boolean) {
	const evidence = reductionEvidence(children);
	if (report) {
		const draft = reviewReductionSchema(evidence.length).parse(value);
		const parsed = parseReviewModelDraft({
			...draft,
			claims: draft.claims.map(({ evidenceRefs, ...claim }) => ({
				...claim,
				evidence: evidenceRefs.map((reference) => evidence[reference]!),
			})),
		});
		return { output: parsed.report, claims: parsed.claims };
	}
	const draft = analysisReductionSchema(evidence.length).parse(value);
	const output = Analysis.parse({
		...draft,
		findings: draft.findings.map(({ evidenceRefs, ...claim }) => ({
			...claim,
			evidence: evidenceRefs.map((reference) => evidence[reference]!),
		})),
	});
	return { output, claims: output.findings };
}
