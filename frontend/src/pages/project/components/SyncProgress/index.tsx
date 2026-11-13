import type { TJobView } from '@self-review/contracts';
import type { TJobConnectionState } from '@app/lib/job-subscription';
import { Button } from '@app/components/ui/Button';
import { Status } from '@app/components/ui/Status';
import { jobHeading, jobCounters } from './presentation';

interface ISyncProgressProps {
	job?: TJobView;
	connection: TJobConnectionState;
	message?: string;
	onReconnect: () => void;
	error?: string;
}

const CONNECTION_LABELS: Record<TJobConnectionState, string> = {
	checking: 'Checking saved progress…',
	connected: 'Live updates connected.',
	reconnecting: 'Reconnecting. Updates interrupted; background work may still be running.',
	exhausted: 'Updates interrupted; background work may still be running.',
	inaccessible: 'Progress is unavailable.',
	invalid: 'Invalid progress response. Saved state is retained.',
	idle: 'Saved outcome loaded.',
};

export function SyncProgress({ job, connection, message, onReconnect, error }: ISyncProgressProps) {
	const isActive = !job || ['queued', 'running'].includes(job.state);
	const transport = !isActive && connection !== 'inaccessible' ? 'idle' : connection;
	return (
		<section aria-label="Job progress" className="space-y-3 border-b py-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0 space-y-1">
					<p role="status" aria-live="polite" className="text-sm font-medium">
						{job ? jobHeading(job) : 'Loading saved job state…'}
					</p>
					{job && (
						<p className="text-sm text-muted-foreground">
							{jobCounters(job).join(' · ')}
						</p>
					)}
					{isActive && (
						<p className="text-sm text-muted-foreground">
							You can leave this page. Accepted work continues in the background.
						</p>
					)}
				</div>
				{isActive && ['exhausted', 'invalid'].includes(connection) && (
					<Button variant="outline" onClick={onReconnect}>
						Reconnect
					</Button>
				)}
			</div>
			<p className="text-metadata text-muted-foreground" role="status">
				{CONNECTION_LABELS[transport]}
				{connection === 'inaccessible' && message ? ` ${message}` : ''}
			</p>
			{error && <Status variant="error">{error}</Status>}
			{job?.errorCode && (
				<Status variant="error">
					Saved operation outcome: {job.errorCode}. Starting again is a new operation and
					may incur usage.
				</Status>
			)}
			{job?.warnings?.map((warning) => (
				<Status variant="warning" key={warning}>
					{warning}
				</Status>
			))}
			{job && (
				<details className="text-metadata text-muted-foreground">
					<summary className="w-fit cursor-pointer">Execution details</summary>
					{job.type === 'sync' && (
						<p className="mt-2">
							Processed detail records include retained details in selected refresh;
							this is not a count of new tracker requests.
						</p>
					)}
					<dl className="mt-2 space-y-2 wrap-anywhere">
						<div>
							<dt>Run</dt>
							<dd className="font-mono">{job.runId}</dd>
						</div>
						<div>
							<dt>Saved stage</dt>
							<dd>{job.stage}</dd>
						</div>
						<div>
							<dt>Completed units across all levels</dt>
							<dd>{job.counts.batchesCompleted ?? 'Unavailable'}</dd>
						</div>
						<div>
							<dt>Created leaf batches</dt>
							<dd>{job.counts.batches ?? 'Unavailable'}</dd>
						</div>
					</dl>
				</details>
			)}
		</section>
	);
}
