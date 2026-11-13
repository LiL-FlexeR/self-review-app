import type { TProjectWorkspace } from '@app/pages/project/use-project-workspace';
import { SyncControls } from '@app/pages/project/components/SyncControls';
import { ReviewAction } from '@app/pages/project/components/ReviewAction';
import { Button } from '@app/components/ui/Button';

export function Overview({ workspace }: { workspace: TProjectWorkspace }) {
	const {
		snapshot,
		snapshotId,
		selectedSnapshot,
		syncOpen,
		setSyncOpen,
		busy,
		setTab,
		automaticReview,
		report,
	} = workspace;
	const hasSnapshot = !!snapshotId;
	const hasReport = !!snapshot?.currentReviewReportId;
	const eligible = report.data?.coverage.targetTasks ?? automaticReview.data?.counts.targetTasks;
	let title = 'Collect evidence for your self-review';
	let description = 'Synchronize a creation-date period to save task evidence for this project.';
	if (snapshot) {
		title = 'Evidence is ready';
		description =
			'Review the saved tasks or prepare a self-review for the verified tracker owner.';
	}
	if (snapshot?.state === 'partial') {
		title = 'Inspect incomplete evidence';
		description =
			'Some required discovery, import or analysis is incomplete. Inspect tasks and coverage before choosing whether to review.';
	}
	if (snapshot?.state === 'failed') {
		title = 'This synchronization failed';
		description =
			'Inspect its saved outcome in Activity, choose a previous snapshot, or explicitly synchronize again.';
	}
	if (hasReport) {
		title = 'Your saved self-review is available';
		description = 'Open the report and inspect the saved evidence behind its claims.';
	}
	if (busy) {
		title = 'Work is in progress';
		description =
			'Progress above comes from the saved job. You can inspect saved snapshots and reports while it runs.';
	}
	if (hasSnapshot && !snapshot) {
		title = selectedSnapshot.error
			? 'Requested snapshot unavailable'
			: 'Loading selected evidence';
		description =
			'Choose another snapshot explicitly, or return to its source context. No other snapshot has been substituted.';
	}
	return (
		<div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
			<div className="min-w-0 space-y-8">
				<section className="space-y-4" aria-labelledby="next-action-title">
					<h2 id="next-action-title" className="text-section">
						{title}
					</h2>
					<p className="max-w-prose text-sm text-muted-foreground">{description}</p>
					{hasReport && (
						<Button onClick={() => setTab('review')}>View self-review</Button>
					)}
					{!hasReport && snapshot?.state === 'succeeded' && !busy && (
						<ReviewAction workspace={workspace} />
					)}
					{!hasReport && snapshot?.state === 'partial' && (
						<div className="flex flex-wrap gap-2">
							<Button onClick={() => setTab('tasks')}>Inspect tasks</Button>
							<Button variant="outline" onClick={() => setTab('review')}>
								Review incomplete coverage
							</Button>
						</div>
					)}
					{snapshot?.state === 'failed' && (
						<Button variant="outline" onClick={() => setTab('activity')}>
							Inspect activity
						</Button>
					)}
				</section>
				<section className="space-y-4 border-t pt-6" aria-labelledby="sync-title">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<h2 id="sync-title" className="text-component">
							{hasSnapshot ? 'Update saved evidence' : 'Synchronize project'}
						</h2>
						{hasSnapshot && (
							<Button
								variant="outline"
								aria-expanded={syncOpen}
								aria-controls="sync-configuration"
								onClick={() => setSyncOpen(!syncOpen)}
							>
								{syncOpen ? 'Hide synchronization controls' : 'Synchronize again'}
							</Button>
						)}
					</div>
					{(!hasSnapshot || syncOpen) && (
						<div id="sync-configuration">
							<SyncControls workspace={workspace} />
						</div>
					)}
					{hasSnapshot && !syncOpen && (
						<p className="text-sm text-muted-foreground">
							Run a full period synchronization to discover additional tasks and
							create a new snapshot.
						</p>
					)}
				</section>
			</div>
			<aside
				className="min-w-0 space-y-4 border-t pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6"
				aria-labelledby="evidence-facts-title"
			>
				<h2 id="evidence-facts-title" className="text-component">
					Saved evidence
				</h2>
				{snapshot ? (
					<>
						<dl className="space-y-4 text-sm">
							<div>
								<dt className="text-muted-foreground">Tasks saved</dt>
								<dd className="mt-1 font-medium">
									{snapshot.counts.saved ?? 'Unavailable'}
								</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Review-eligible tasks</dt>
								<dd className="mt-1">
									{eligible ?? 'Available after review starts'}
								</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Coverage</dt>
								<dd className="mt-1 space-y-1">
									<p>
										Discovery:{' '}
										{snapshot.discoveryComplete ? 'complete' : 'incomplete'}
									</p>
									<p>
										Import:{' '}
										{snapshot.importComplete ? 'complete' : 'incomplete'}
									</p>
									<p>
										Analysis:{' '}
										{snapshot.analysisComplete ? 'complete' : 'incomplete'}
									</p>
								</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Report for this snapshot</dt>
								<dd className="mt-1">
									{hasReport ? 'Saved report available' : 'No published report'}
								</dd>
							</div>
						</dl>
						<p className="border-t pt-4 text-metadata text-muted-foreground">
							Task evidence reflects source data at retrieval. Selected refresh can
							mix retrieval times; inspect individual tasks for fresh, copied or stale
							evidence.
						</p>
					</>
				) : (
					<p className="text-sm text-muted-foreground">
						Saved counts and coverage appear when a snapshot is available.
					</p>
				)}
			</aside>
		</div>
	);
}
