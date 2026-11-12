import { z as zod } from 'zod';
import { Claim, ReportDraft } from '@self-review/contracts';

// A single bounded array lets Structured Outputs enforce the total claim limit.
// Fixed title slots and a bounded index also enforce the group count in the wire schema.
export const ReviewModelDraft = zod.strictObject({
	schemaVersion: zod.literal('1.0'),
	groupTitles: zod.array(zod.string().max(100)).length(4),
	claims: zod.array(Claim.extend({ groupIndex: zod.number().int().min(0).max(3) })).max(8),
	limitations: zod.array(zod.string().max(300)).max(8),
	explanation: zod.string().max(400),
});

export function parseReviewModelDraft(value: unknown) {
	const draft = ReviewModelDraft.parse(value);
	const claims = draft.claims.map(({ groupIndex, ...claim }) => {
		void groupIndex;
		return claim;
	});
	const groups = draft.groupTitles.flatMap((title, groupIndex) => {
		const groupedClaims = claims.filter(
			(_claim, index) => draft.claims[index]!.groupIndex === groupIndex,
		);
		return groupedClaims.length ? [{ title, claims: groupedClaims }] : [];
	});
	return {
		report: ReportDraft.parse({
			schemaVersion: draft.schemaVersion,
			groups,
			limitations: draft.limitations,
			explanation: draft.explanation,
		}),
		claims,
	};
}
