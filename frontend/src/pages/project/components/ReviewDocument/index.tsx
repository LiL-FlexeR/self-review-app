import { useId } from 'react';
import type { IReportCitation, TSavedReview } from '@app/pages/project/report-presentation';
import { CLAIM_LABELS, evidenceKey, reportCitations } from '@app/pages/project/report-presentation';
import { Button } from '@app/components/ui/Button';

interface IReviewDocumentProps {
	saved: TSavedReview;
	onEvidence: (citation: IReportCitation, opener: HTMLButtonElement) => void;
	savedTaskCount?: number;
}

export function ReviewDocument({ saved, onEvidence, savedTaskCount }: IReviewDocumentProps) {
	const prefix = useId();
	const citations = reportCitations(saved.draft);
	const hasClaims = saved.draft.groups.some((group) => group.claims.length > 0);
	let emptyMessage = 'No supported claims were saved for this review.';
	if (saved.coverage.targetTasks === 0) {
		emptyMessage = 'Saved tasks do not qualify for this verified tracker owner.';
	}
	if (savedTaskCount === 0) {
		emptyMessage = 'No tasks were saved for this creation-date period.';
	}

	return (
		<div className="space-y-8">
			{!hasClaims && (
				<section className="space-y-3" aria-labelledby={`${prefix}-empty`}>
					<h3 id={`${prefix}-empty`} className="text-section">
						No supported claims
					</h3>
					<p className="text-report">{emptyMessage}</p>
					<p className="text-metadata text-muted-foreground">
						Inspect the period, saved assignees and source coverage in Overview or
						Tasks. This saved report remains available to download.
					</p>
				</section>
			)}
			{saved.draft.groups.map((group, groupIndex) => (
				<section
					key={groupIndex}
					className="space-y-6"
					aria-labelledby={`${prefix}-group-${groupIndex}`}
				>
					<h3 id={`${prefix}-group-${groupIndex}`} className="text-section wrap-anywhere">
						{group.title}
					</h3>
					{group.claims.map((claim, claimIndex) => (
						<div key={claimIndex} className="space-y-2">
							<p className="text-metadata text-muted-foreground">
								{CLAIM_LABELS[claim.kind]}
							</p>
							<p className="text-report whitespace-pre-wrap wrap-anywhere">
								{claim.text}
							</p>
							<div
								className="flex flex-wrap items-center gap-1"
								aria-label="Saved evidence"
							>
								<span className="mr-1 text-metadata text-muted-foreground">
									Evidence
								</span>
								{claim.evidence.map((pair, pairIndex) => {
									const citation = citations.get(evidenceKey(pair));
									if (!citation) {
										return null;
									}
									return (
										<Button
											key={pairIndex}
											variant="ghost"
											size="xs"
											aria-label={`Evidence ${citation.number} for ${claim.text}`}
											aria-haspopup="dialog"
											onClick={(event) =>
												onEvidence(citation, event.currentTarget)
											}
										>
											[{citation.number}]
										</Button>
									);
								})}
							</div>
						</div>
					))}
				</section>
			))}
			<section className="space-y-4 border-t pt-6" aria-labelledby={`${prefix}-limitations`}>
				<h3 id={`${prefix}-limitations`} className="text-section">
					Limitations
				</h3>
				{saved.draft.limitations.length > 0 ? (
					<ul className="list-disc space-y-3 pl-5 text-report wrap-anywhere">
						{saved.draft.limitations.map((item, index) => (
							<li key={index}>{item}</li>
						))}
					</ul>
				) : (
					<p className="text-report">
						No additional limitations were recorded in this draft.
					</p>
				)}
			</section>
			<section className="space-y-3" aria-labelledby={`${prefix}-explanation`}>
				<h3 id={`${prefix}-explanation`} className="text-section">
					About this draft
				</h3>
				<p className="text-report whitespace-pre-wrap wrap-anywhere">
					{saved.draft.explanation || 'No explanation was recorded in this draft.'}
				</p>
			</section>
		</div>
	);
}
