import type { TProjectWorkspace } from '@app/pages/project/use-project-workspace';
import { ReviewAction } from '@app/pages/project/components/ReviewAction';
import { ReportView } from '@app/pages/project/components/ReportView';
import { Button } from '@app/components/ui/Button';

export function ReviewPanel({ workspace }: { workspace: TProjectWorkspace }) {
	const { snapshot, userId, setTab } = workspace;
	if (!snapshot) {
		return (
			<div className="space-y-4">
				<p className="text-sm text-muted-foreground">
					Synchronize a period to collect evidence, or choose an accessible saved
					snapshot.
				</p>
				<Button variant="outline" onClick={() => setTab('overview')}>
					Go to Overview
				</Button>
			</div>
		);
	}
	return (
		<div className="space-y-6">
			<section className="space-y-4">
				<h2 className="text-section">Self-review</h2>
				<ReviewAction workspace={workspace} acknowledge />
				{!snapshot.currentReviewReportId && (
					<p className="text-sm text-muted-foreground">
						No published report for this snapshot. Reports from other snapshots remain
						available through the snapshot selector.
					</p>
				)}
			</section>
			{snapshot.currentReviewReportId && userId && (
				<ReportView
					key={snapshot.currentReviewReportId}
					id={snapshot.currentReviewReportId}
					userId={userId}
				/>
			)}
		</div>
	);
}
