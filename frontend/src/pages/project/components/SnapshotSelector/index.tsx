import type { TProjectWorkspace } from '@app/pages/project/use-project-workspace';
import { snapshotLabel } from '@app/pages/project/snapshot-period';
import { Button } from '@app/components/ui/Button';
import { Label } from '@app/components/ui/Label';

export function SnapshotSelector({ workspace }: { workspace: TProjectWorkspace }) {
	const { syncs, snapshot, snapshotId, project, history, selectSnapshot } = workspace;
	const available = new Map(syncs.map((run) => [run.runId, run]));
	if (project.data?.latestSuccessfulSync) {
		available.set(project.data.latestSuccessfulSync.runId, project.data.latestSuccessfulSync);
	}
	if (snapshot) {
		available.set(snapshot.runId, snapshot);
	}
	return (
		<div className="min-w-0 space-y-2">
			<Label htmlFor="snapshot">Snapshot</Label>
			<select
				id="snapshot"
				className="h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-base md:h-10 md:text-sm"
				value={snapshotId ?? ''}
				onChange={(event) => selectSnapshot(event.target.value)}
				disabled={!available.size && !snapshotId}
			>
				{!snapshotId && <option value="">No saved snapshot</option>}
				{snapshotId && !available.has(snapshotId) && (
					<option value={snapshotId}>
						Requested snapshot · {snapshotId.slice(0, 8)}
					</option>
				)}
				{[...available.values()].map((run) => (
					<option key={run.runId} value={run.runId}>
						{snapshotLabel(run)}
						{run.runId === project.data?.latestSuccessfulSync?.runId
							? ' · latest successful'
							: ''}
					</option>
				))}
			</select>
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-metadata text-muted-foreground">
				{history.isPending && <span>Loading history…</span>}
				{history.error && <span role="alert">{history.error.message}</span>}
				{(history.hasNextPage || history.error) && (
					<Button
						size="sm"
						variant="ghost"
						disabled={history.isFetching}
						onClick={() => {
							void (history.hasNextPage
								? history.fetchNextPage()
								: history.refetch());
						}}
					>
						{history.error ? 'Retry history' : 'Load more snapshots'}
					</Button>
				)}
			</div>
		</div>
	);
}
