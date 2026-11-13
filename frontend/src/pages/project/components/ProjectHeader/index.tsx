import type { TProjectWorkspace } from '@app/pages/project/use-project-workspace';
import { formatPeriod } from '@app/pages/project/snapshot-period';
import { SnapshotSelector } from '@app/pages/project/components/SnapshotSelector';
import { Status } from '@app/components/ui/Status';
import { Button } from '@app/components/ui/Button';

export function ProjectHeader({ workspace }: { workspace: TProjectWorkspace }) {
	const { project, snapshot, snapshotId, period, selectedSnapshot } = workspace;
	const saved = project.data;
	if (!saved) {
		return null;
	}
	return (
		<section aria-label="Project context" className="space-y-4 border-b pb-6">
			<div className="grid min-w-0 gap-6 @min-[880px]/workspace:grid-cols-[minmax(0,1fr)_minmax(280px,420px)]">
				<div className="min-w-0 space-y-3">
					<p className="text-sm text-muted-foreground wrap-anywhere">
						{saved.connection.provider} · {saved.resourceType} ·{' '}
						{saved.connection.displayName}
						<br />
						{saved.connection.mode === 'fixture'
							? 'Synthetic source'
							: 'Live tracker'}{' '}
						· {saved.connection.modelMode} model
					</p>
					<p className="text-sm wrap-anywhere">
						<span className="text-muted-foreground">Verified review subject</span>
						<br />
						<span className="font-medium">{saved.connection.sourceUserName}</span>
					</p>
					<details className="text-metadata text-muted-foreground">
						<summary className="w-fit cursor-pointer">Source identifiers</summary>
						<dl className="mt-2 space-y-2 wrap-anywhere">
							<div>
								<dt>Resource</dt>
								<dd className="font-mono">{saved.externalId}</dd>
							</div>
							<div>
								<dt>Verified tracker owner</dt>
								<dd className="font-mono">{saved.connection.sourceUserId}</dd>
							</div>
							<div>
								<dt>Location</dt>
								<dd>
									{saved.breadcrumb.join(' / ') || saved.connection.displayName}
								</dd>
							</div>
						</dl>
					</details>
				</div>
				<div className="min-w-0 space-y-2">
					<SnapshotSelector workspace={workspace} />
					{snapshot && period.data && (
						<p className="text-sm font-medium">{formatPeriod(period.data)}</p>
					)}
					{snapshot && period.isPending && (
						<p className="text-sm text-muted-foreground">Resolving saved UTC period…</p>
					)}
					{snapshot && period.error && (
						<>
							<Status variant="error">{period.error.message}</Status>
							<Button
								variant="outline"
								disabled={period.isFetching}
								onClick={() => {
									void period.refetch();
								}}
							>
								Retry period
							</Button>
						</>
					)}
					{snapshotId && selectedSnapshot.isPending && (
						<p className="text-sm text-muted-foreground">Loading requested snapshot…</p>
					)}
					{selectedSnapshot.error && (
						<>
							<Status variant="error">{selectedSnapshot.error.message}</Status>
							<Button
								variant="outline"
								disabled={selectedSnapshot.isFetching}
								onClick={() => {
									void selectedSnapshot.refetch();
								}}
							>
								Retry snapshot
							</Button>
						</>
					)}
					{snapshot && (
						<p className="text-metadata text-muted-foreground">
							{snapshot.runId === saved.latestSuccessfulSync?.runId
								? 'Latest successful snapshot'
								: 'Selected snapshot'}{' '}
							· {snapshot.state}
						</p>
					)}
				</div>
			</div>
			{saved.connection.warnings.map((warning) => (
				<Status key={warning} variant="warning">
					{warning}
				</Status>
			))}
		</section>
	);
}
