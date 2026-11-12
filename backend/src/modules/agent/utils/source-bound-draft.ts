import { z as zod } from 'zod';
import { Claim } from '@self-review/contracts';
import { Analysis } from '@app/modules/agent/agent.schemas';
import { ReviewModelDraft } from './review-model-draft.js';

function sourceBoundClaim(sourceIds: string[]) {
	if (!sourceIds.length) {
		// Research starts before tools expose any Sources; mandatory tool stages still gate acceptance.
		return Claim;
	}
	const evidence = Claim.shape.evidence.element.extend({
		sourceId: zod.enum([...new Set(sourceIds)]),
	});
	return Claim.extend({ evidence: zod.array(evidence).min(1).max(2) });
}

export function analysisSourceSchema(sourceIds: string[]) {
	return Analysis.extend({ findings: zod.array(sourceBoundClaim(sourceIds)).max(8) });
}

export function reviewSourceSchema(sourceIds: string[]) {
	const claim = ReviewModelDraft.shape.claims.element.extend({
		evidence: sourceBoundClaim(sourceIds).shape.evidence,
	});
	return ReviewModelDraft.extend({ claims: zod.array(claim).max(8) });
}
