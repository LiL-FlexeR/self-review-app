import type { TProjectWorkspace } from '@app/pages/project/use-project-workspace';
import { snapshotLabel } from '@app/pages/project/snapshot-period';
import { TraceView } from '@app/pages/project/components/TraceView';
import { Button } from '@app/components/ui/Button';
import { Status } from '@app/components/ui/Status';

export function ActivityPanel({ workspace }: { workspace: TProjectWorkspace }) {
	const { syncs, snapshot, snapshotId, selectSnapshot, history, project, userId } = workspace;
	return (
		<div className="space-y-8">
			<section className="space-y-4">
				<h2 className="text-section">Snapshot history</h2>
				<p className="text-sm text-muted-foreground">
					All synchronization attempts are available through pagination. Run timestamps
					are not exposed by this view.
				</p>
				{history.error && <Status variant="error">{history.error.message}</Status>}
				{history.isPending && <Status variant="loading">Loading snapshot history…</Status>}
				{history.data && !syncs.length && (
					<p className="text-sm">No synchronization attempts yet.</p>
				)}
				<ul className="divide-y">
					{syncs.map((run) => (
						<li
							key={run.runId}
							className="flex flex-wrap items-center justify-between gap-3 py-3"
						>
							<span className="text-sm wrap-anywhere">
								{snapshotLabel(run)}
								{run.runId === snapshotId ? ' · selected' : ''}
							</span>
							<Button
								variant="ghost"
								disabled={run.runId === snapshotId}
								onClick={() => selectSnapshot(run.runId)}
							>
								Inspect snapshot
							</Button>
						</li>
					))}
				</ul>
				{history.hasNextPage && (
					<Button
						variant="outline"
						disabled={history.isFetchingNextPage}
						onClick={() => {
							void history.fetchNextPage();
						}}
					>
						Load more snapshots
					</Button>
				)}
			</section>
			<section className="space-y-3 border-t pt-6">
				<h2 className="text-component">Recent runs</h2>
				<p className="text-sm text-muted-foreground">
					Up to 20 recent synchronization and review runs. This is not complete report
					history.
				</p>
				<ul className="divide-y">
					{project.data?.runs.map((run) => (
						<li key={run.runId} className="py-3 text-sm wrap-anywhere">
							{run.type === 'sync' ? 'Synchronization' : 'Self-review'} · {run.state}
							<span className="ml-2 font-mono text-metadata text-muted-foreground">
								{run.runId}
							</span>
						</li>
					))}
				</ul>
			</section>
			{snapshot && (
				<section className="space-y-3 border-t pt-6">
					<h2 className="text-component">Selected snapshot details</h2>
					<p className="text-sm">
						Discovery: {snapshot.discoveryComplete ? 'complete' : 'incomplete'} ·
						Import: {snapshot.importComplete ? 'complete' : 'incomplete'} · Analysis:{' '}
						{snapshot.analysisComplete ? 'complete' : 'incomplete'}
					</p>
					{snapshot.warnings?.map((warning) => (
						<Status key={warning} variant="warning">
							{warning}
						</Status>
					))}
					<details className="text-metadata">
						<summary className="cursor-pointer">
							Saved identifiers and selection
						</summary>
						<pre className="mt-3 max-w-full overflow-auto">
							{JSON.stringify(
								{
									snapshotId,
									selection: snapshot.selection,
									errorCode: snapshot.errorCode,
								},
								null,
								2,
							)}
						</pre>
					</details>
				</section>
			)}
			{snapshot && userId && (
				<TraceView key={snapshot.runId} runId={snapshot.runId} userId={userId} />
			)}
		</div>
	);
}
