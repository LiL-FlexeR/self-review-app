import { useId } from 'react';
import type { TProjectWorkspace } from '@app/pages/project/use-project-workspace';
import { Button } from '@app/components/ui/Button';

export function ReviewAction({
	workspace,
	acknowledge = false,
}: {
	workspace: TProjectWorkspace;
	acknowledge?: boolean;
}) {
	const { snapshot, snapshotId, busy, allowPartial, setAllowPartial, mutation } = workspace;
	const helpId = useId();
	if (!snapshot || !['succeeded', 'partial'].includes(snapshot.state)) {
		return null;
	}
	return (
		<div className="space-y-3">
			{acknowledge && snapshot.state === 'partial' && (
				<label className="flex items-start gap-3 text-sm">
					<input
						className="mt-1"
						type="checkbox"
						checked={allowPartial}
						onChange={(event) => setAllowPartial(event.target.checked)}
					/>
					I accept incomplete source coverage for this review.
				</label>
			)}
			<Button
				variant={snapshot.currentReviewReportId ? 'outline' : 'default'}
				disabled={busy || (snapshot.state === 'partial' && (!acknowledge || !allowPartial))}
				aria-describedby={helpId}
				onClick={() =>
					mutation.mutate({
						action: 'reviews',
						body: { syncRunId: snapshotId, allowPartial },
					})
				}
			>
				{snapshot.currentReviewReportId ? 'Regenerate self-review' : 'Create self-review'}
			</Button>
			<p id={helpId} className="text-sm text-muted-foreground">
				Generation creates a new report and may incur model usage. The previous valid report
				stays available if generation fails.
			</p>
		</div>
	);
}
