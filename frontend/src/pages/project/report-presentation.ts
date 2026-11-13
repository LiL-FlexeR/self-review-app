import type { z as zod } from 'zod';
import type { ReviewView, TClaim, TReportDraft } from '@self-review/contracts';

export type TSavedReview = zod.infer<typeof ReviewView>;
export type TEvidencePair = TClaim['evidence'][number];
export interface IReportCitation extends TEvidencePair {
	number: number;
}

export const CLAIM_LABELS = {
	task_description: 'Task description',
	reported_result: 'Reported result',
	reported_measurement: 'Measurement from a source',
};

export function evidenceKey(pair: TEvidencePair) {
	return JSON.stringify([pair.sourceId, pair.quote]);
}

export function reportCitations(draft: TReportDraft): Map<string, IReportCitation> {
	const citations = new Map<string, IReportCitation>();
	for (const group of draft.groups) {
		for (const claim of group.claims) {
			for (const pair of claim.evidence) {
				const key = evidenceKey(pair);
				if (!citations.has(key)) {
					citations.set(key, { ...pair, number: citations.size + 1 });
				}
			}
		}
	}
	return citations;
}
