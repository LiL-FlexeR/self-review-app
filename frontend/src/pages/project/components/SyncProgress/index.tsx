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
	onViewResult?: () => void;
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

export function SyncProgress({
	job,
	connection,
	message,
	onReconnect,
	error,
	onViewResult,
}: ISyncProgressProps) {
	const isActive = !job || ['queued', 'running'].includes(job.state);
	const transport = !isActive && connection !== 'inaccessible' ? 'idle' : connection;
	const hasPendingReview =
		job?.type === 'sync' &&
		job.state === 'succeeded' &&
		['queued', 'running'].includes(job.autoReview ?? '');
	let heading = job ? jobHeading(job) : 'Loading saved job state…';
	if (hasPendingReview) {
		heading = 'Tasks saved; preparing self-review';
	}
	return (
		<section aria-label="Job progress" className="space-y-3 border-b py-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0 space-y-1">
					<p
						role="status"
						aria-live="polite"
						aria-atomic="true"
						className="text-sm font-medium"
					>
						{heading}
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
				{onViewResult && (
					<Button variant="outline" onClick={onViewResult}>
						{job?.type === 'review' ? 'View self-review' : 'View saved tasks'}
					</Button>
				)}
				{isActive && ['exhausted', 'invalid'].includes(connection) && (
					<Button variant="outline" onClick={onReconnect}>
						Reconnect
					</Button>
				)}
			</div>
			<p
				className="text-metadata text-muted-foreground"
				role={isActive ? 'status' : undefined}
			>
				{CONNECTION_LABELS[transport]}
				{connection === 'inaccessible' && message ? ` ${message}` : ''}
			</p>
			{error && <Status variant="error">{error}</Status>}
			{job?.errorCode && (
				<Status variant="error" announce={false}>
					Saved operation outcome: {job.errorCode}. Starting again is a new operation and
					may incur usage.
				</Status>
			)}
			{!!job?.warnings?.length && (
				<Status variant="warning" announce={false}>
					<ul className="list-disc space-y-2 pl-4">
						{[...new Set(job.warnings)].map((warning) => (
							<li key={warning}>{warning}</li>
						))}
					</ul>
				</Status>
			)}
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
