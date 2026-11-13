import type { TJobView } from '@self-review/contracts';
import { CircleCheck, CircleDashed } from 'lucide-react';
import { jobHeading, jobCounters } from '@app/pages/project/components/SyncProgress/presentation';
import { SavedIdentifier } from '@app/pages/project/components/SavedIdentifier';
import { TraceView } from '@app/pages/project/components/TraceView';
import { ProcessingUnits } from '@app/pages/project/components/ProcessingUnits';
import { Status } from '@app/components/ui/Status';

export function RunDetails({ run, userId }: { run: TJobView; userId: string }) {
	const coverage = [
		{ label: 'Source discovery', complete: run.discoveryComplete },
		{ label: 'Task import', complete: run.importComplete },
		{
			label: run.type === 'review' ? 'Review analysis' : 'Task analysis',
			complete: run.analysisComplete,
		},
	];
	return (
		<div className="min-w-0 space-y-4">
			<div className="space-y-1">
				<p className="font-medium">{jobHeading(run)}</p>
				<p className="text-ui text-muted-foreground">{jobCounters(run).join(' · ')}</p>
			</div>
			{run.type === 'review' && (
				<p className="text-metadata text-muted-foreground">
					Discovery and import coverage are inherited from this review’s source snapshot.
				</p>
			)}
			<dl className="flex flex-wrap gap-x-8 gap-y-4 border-y py-4 text-ui">
				{coverage.map((item) => {
					const Icon = item.complete ? CircleCheck : CircleDashed;
					return (
						<div key={item.label} className="space-y-2">
							<dt className="text-muted-foreground">{item.label}</dt>
							<dd className="flex items-center gap-2">
								<Icon className="size-4" aria-hidden="true" />
								{item.complete ? 'Complete' : 'Incomplete'}
							</dd>
						</div>
					);
				})}
			</dl>
			{run.errorCode && (
				<Status variant="error" announce={false}>
					Saved failure: {run.errorCode}. Reading details does not retry execution.
					Starting again is an explicit new operation and may incur model usage.
				</Status>
			)}
			{!!run.warnings?.length && (
				<Status variant="warning" announce={false}>
					<p className="font-medium">Saved limitations</p>
					<ul className="list-disc space-y-2 pl-4">
						{[...new Set(run.warnings)].map((warning) => (
							<li key={warning}>{warning}</li>
						))}
					</ul>
				</Status>
			)}
			{run.warningsCount > (run.warnings?.length ?? 0) && (
				<p className="text-metadata text-muted-foreground">
					{run.warningsCount} warnings recorded. Not all warning text is available in this
					response.
				</p>
			)}
			<details className="text-metadata">
				<summary className="w-fit cursor-pointer font-medium">
					Identifiers and saved selection
				</summary>
				<dl className="mt-4 space-y-3">
					<SavedIdentifier label="Run" value={run.runId} />
					{run.resultRef && (
						<SavedIdentifier label="Saved result" value={run.resultRef} />
					)}
				</dl>
				<p className="mt-3 text-muted-foreground">Saved stage: {run.stage}</p>
				<pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-identifier wrap-anywhere">
					{JSON.stringify(run.selection, null, 2)}
				</pre>
			</details>
			<ProcessingUnits runId={run.runId} userId={userId} />
			<TraceView runId={run.runId} userId={userId} />
		</div>
	);
}
