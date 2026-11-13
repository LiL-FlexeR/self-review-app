import type { TProjectWorkspace } from '@app/pages/project/use-project-workspace';
import { canRetainSavedRead } from '@app/lib/api';
import { ReviewAction } from '@app/pages/project/components/ReviewAction';
import { ReportView } from '@app/pages/project/components/ReportView';
import { Button } from '@app/components/ui/Button';
import { Status } from '@app/components/ui/Status';
import { EmptyState } from '@app/components/templates/EmptyState';
import { ErrorState } from '@app/components/templates/ErrorState';
import { LoadingState } from '@app/components/templates/LoadingState';

export function ReviewPanel({ workspace }: { workspace: TProjectWorkspace }) {
	const { snapshot, snapshotId, userId, setTab, report, project, period, busy } = workspace;
	if (!snapshot && snapshotId && !workspace.selectedSnapshot.error) {
		return (
			<LoadingState reserveSpace>
				Loading the selected snapshot’s report context…
			</LoadingState>
		);
	}
	if (!snapshot && snapshotId) {
		return (
			<EmptyState title="Selected snapshot unavailable">
				Choose another saved snapshot explicitly, or use the read recovery in the project
				context above.
			</EmptyState>
		);
	}
	if (!snapshot) {
		return (
			<div className="mx-auto w-full max-w-(--content-width-reading)">
				<EmptyState
					title="Collect evidence for your self-review"
					action={
						<Button variant="outline" onClick={() => setTab('overview')}>
							Go to Overview
						</Button>
					}
				>
					Synchronize a period to collect evidence, or choose an accessible saved
					snapshot.
				</EmptyState>
			</div>
		);
	}
	const hasReport = !!snapshot.currentReviewReportId;
	const canRetain = canRetainSavedRead(report.error);
	const saved = hasReport && canRetain ? report.data : undefined;
	const matchesSnapshot =
		saved?.sourceSyncRunId === snapshotId && saved?.id === snapshot.currentReviewReportId;
	const connection = project.data?.connection;
	let snapshotContext = 'Selected snapshot';
	if (snapshot.state === 'partial') {
		snapshotContext = 'Selected partial snapshot';
	} else if (snapshot.runId === project.data?.latestSuccessfulSync?.runId) {
		snapshotContext = 'Latest successful snapshot';
	} else if (project.data?.latestSuccessfulSync) {
		snapshotContext = 'Historical snapshot';
	}

	return (
		<div className="mx-auto w-full min-w-0 max-w-(--content-width-reading) space-y-8">
			{busy && (
				<Status variant="loading">
					{hasReport
						? 'Background work is in progress. The saved draft and its downloads remain available until a new report is published.'
						: 'Background work is in progress. A published draft will appear here when it is available.'}
				</Status>
			)}
			{hasReport && report.isPending && (
				<LoadingState reserveSpace>Loading saved report…</LoadingState>
			)}
			{hasReport && report.error && (
				<ErrorState
					error={report.error}
					title="Saved report unavailable"
					onRetry={() => void report.refetch()}
					retryLabel="Retry saved report"
					isRetrying={report.isFetching}
				>
					{saved
						? 'Showing the previously loaded saved report.'
						: 'Choose another saved snapshot to inspect its report.'}
				</ErrorState>
			)}
			{saved && !matchesSnapshot && (
				<Status variant="error">
					This report does not belong to the selected snapshot. Choose its source snapshot
					to inspect the saved report.
				</Status>
			)}
			{saved && matchesSnapshot && userId && (
				<ReportView
					key={saved.id}
					saved={saved}
					userId={userId}
					projectName={project.data?.name ?? 'Project'}
					owner={
						connection
							? { id: connection.sourceUserId, name: connection.sourceUserName }
							: undefined
					}
					period={period.data}
					snapshotContext={snapshotContext}
					savedTaskCount={snapshot.counts.saved}
				/>
			)}
			{!hasReport && (
				<section className="space-y-4 py-6">
					<h2 className="text-section">
						{snapshot.state === 'failed'
							? 'Source snapshot failed'
							: 'No self-review for this snapshot'}
					</h2>
					<p className="text-report text-muted-foreground">
						{snapshot.state === 'failed'
							? 'This snapshot cannot be reviewed. Inspect its saved outcome or choose another snapshot.'
							: 'Create a draft from saved evidence for the verified tracker owner. Reports from other snapshots remain available through the snapshot selector.'}
					</p>
					{snapshot.counts.saved === 0 && (
						<p className="text-report">
							No tasks were saved for this creation-date period. Inspect the period
							and source coverage in Overview.
						</p>
					)}
					<ReviewAction workspace={workspace} acknowledge />
					<Button variant="ghost" onClick={() => setTab('tasks')}>
						Inspect saved tasks
					</Button>
				</section>
			)}
			{hasReport && (
				<details className="border-t pt-6">
					<summary className="w-fit cursor-pointer text-metadata font-medium">
						Generate a new draft
					</summary>
					<div className="mt-4">
						<ReviewAction workspace={workspace} acknowledge />
					</div>
				</details>
			)}
		</div>
	);
}
