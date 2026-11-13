import { useState } from 'react';
import { useJob } from '@app/api/hooks/jobs/use-job';
import type { TProjectWorkspace } from '@app/pages/project/use-project-workspace';
import { canRetainSavedRead } from '@app/lib/api';
import { snapshotLabel } from '@app/pages/project/snapshot-period';
import { jobHeading, jobCounters } from '@app/pages/project/components/SyncProgress/presentation';
import { RunDetails } from '@app/pages/project/components/RunDetails';
import { Button } from '@app/components/ui/Button';
import { EmptyState } from '@app/components/templates/EmptyState';
import { ErrorState } from '@app/components/templates/ErrorState';
import { LoadingState } from '@app/components/templates/LoadingState';

export function ActivityPanel({ workspace }: { workspace: TProjectWorkspace }) {
	const { syncs, snapshot, snapshotId, selectSnapshot, history, project, userId } = workspace;
	const [inspected, setInspected] = useState<{ snapshotId?: string; runId?: string }>({
		snapshotId,
	});
	if (inspected.snapshotId !== snapshotId) {
		setInspected({ snapshotId });
	}
	const inspectedId = inspected.runId ?? snapshot?.runId;
	const execution = useJob(inspectedId, userId, !!inspected.runId && !!userId);
	const inspectedRun = inspected.runId ? execution.data : snapshot;
	const recent = project.data?.runs ?? [];
	const retryHistory = () => {
		void (history.isFetchNextPageError ? history.fetchNextPage() : history.refetch());
	};
	return (
		<div className="min-w-0 space-y-8">
			<section aria-labelledby="snapshot-history-heading" className="space-y-4">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h2 id="snapshot-history-heading" className="text-section">
						Snapshot history
					</h2>
					{history.data && (
						<span className="text-metadata text-muted-foreground">
							{syncs.length} loaded
						</span>
					)}
				</div>
				<p className="max-w-prose text-ui text-muted-foreground">
					Saved synchronization attempts, including partial and failed attempts. Execution
					dates are not available from the current history API.
				</p>
				{history.error && (
					<ErrorState
						error={history.error}
						title="Snapshot history unavailable"
						onRetry={retryHistory}
						retryLabel="Retry snapshot history"
						isRetrying={history.isFetching}
					>
						Loaded snapshots remain available.
					</ErrorState>
				)}
				{history.isPending && !history.error && (
					<LoadingState reserveSpace>Loading snapshot history…</LoadingState>
				)}
				{history.data && !syncs.length && !history.error && (
					<EmptyState
						title="No synchronization attempts yet"
						action={
							<Button variant="outline" onClick={() => workspace.setTab('overview')}>
								Go to Overview
							</Button>
						}
					>
						Synchronize a creation-date period to collect your first saved evidence.
					</EmptyState>
				)}
				<ul className="divide-y border-y">
					{syncs.map((run) => (
						<li
							key={run.runId}
							className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-3"
						>
							<div className="min-w-0 space-y-1 text-ui wrap-anywhere">
								<p>{snapshotLabel(run)}</p>
								<p className="text-muted-foreground">
									{jobCounters(run).join(' · ')}
									{run.runId === snapshotId ? ' · Selected snapshot' : ''}
								</p>
							</div>
							<Button
								variant="ghost"
								disabled={run.runId === snapshotId}
								aria-label={`Inspect snapshot ${snapshotLabel(run)}`}
								onClick={() => selectSnapshot(run.runId)}
							>
								{run.runId === snapshotId ? 'Selected' : 'Inspect snapshot'}
							</Button>
						</li>
					))}
				</ul>
				{history.hasNextPage && !history.isFetchNextPageError && (
					<Button
						variant="outline"
						disabled={history.isFetching}
						aria-busy={history.isFetchingNextPage}
						onClick={() => void history.fetchNextPage()}
					>
						{history.isFetchingNextPage ? 'Loading snapshots…' : 'Load more snapshots'}
					</Button>
				)}
			</section>
			<section aria-labelledby="recent-runs-heading" className="space-y-4">
				<h2 id="recent-runs-heading" className="text-section">
					Recent executions
				</h2>
				<p className="max-w-prose text-ui text-muted-foreground">
					Up to 20 recent synchronization and self-review runs. This subset is not a
					complete report history. Inspecting an execution reads saved details and does
					not change the selected snapshot.
				</p>
				{!recent.length && (
					<EmptyState title="No recent executions">
						Accepted synchronization and self-review runs appear here.
					</EmptyState>
				)}
				<ul className="divide-y border-y">
					{recent.map((run) => (
						<li
							key={run.runId}
							className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-3"
						>
							<div className="min-w-0 space-y-1 text-ui wrap-anywhere">
								<p>{jobHeading(run)}</p>
								<p className="text-muted-foreground">
									{jobCounters(run).join(' · ') || 'Saved execution'} · reference{' '}
									{run.runId.slice(0, 8)}
								</p>
							</div>
							<Button
								variant="ghost"
								aria-pressed={run.runId === inspectedId}
								aria-controls="activity-execution-details"
								aria-label={`Inspect ${jobHeading(run)}, reference ${run.runId.slice(0, 8)}`}
								onClick={() => {
									setInspected({ snapshotId, runId: run.runId });
									document.getElementById('execution-details-heading')?.focus();
								}}
							>
								Inspect execution
							</Button>
						</li>
					))}
				</ul>
			</section>
			<section
				id="activity-execution-details"
				aria-labelledby="execution-details-heading"
				className="min-w-0 space-y-4 border-t pt-6"
			>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h2 id="execution-details-heading" tabIndex={-1} className="text-section">
						Execution details
					</h2>
					{inspected.runId && snapshot && (
						<Button
							variant="ghost"
							onClick={() => {
								setInspected({ snapshotId });
								document.getElementById('execution-details-heading')?.focus();
							}}
						>
							Return to selected snapshot
						</Button>
					)}
				</div>
				{inspected.runId && execution.isPending && !execution.error && (
					<LoadingState reserveSpace>Loading saved execution…</LoadingState>
				)}
				{inspected.runId && execution.error && (
					<ErrorState
						error={execution.error}
						title="Execution unavailable"
						onRetry={() => void execution.refetch()}
						retryLabel="Retry saved execution"
						isRetrying={execution.isFetching}
					/>
				)}
				{inspectedRun &&
					userId &&
					(!inspected.runId || canRetainSavedRead(execution.error)) && (
						<RunDetails key={inspectedRun.runId} run={inspectedRun} userId={userId} />
					)}
				{!inspectedId && (
					<EmptyState title="Choose an execution">
						Inspect a recent execution or select a saved snapshot to see coverage,
						processing units and safe events.
					</EmptyState>
				)}
			</section>
		</div>
	);
}
