import { useId, useState } from 'react';
import { Download } from 'lucide-react';
import { SyncCommand } from '@self-review/contracts';
import type { IReportCitation, TSavedReview } from '@app/pages/project/report-presentation';
import type { TPeriodSelection } from '@app/api/hooks/projects/snapshot-period';
import type { ITaskOwner } from '@app/pages/project/task-presentation';
import { formatPeriod } from '@app/pages/project/snapshot-period';
import { formatTaskDate } from '@app/pages/project/task-presentation';
import { ReviewDocument } from '@app/pages/project/components/ReviewDocument';
import { EvidencePanel } from '@app/pages/project/components/EvidencePanel';
import { SavedIdentifier } from '@app/pages/project/components/SavedIdentifier';
import { ReviewUsage } from '@app/pages/project/components/ReviewUsage';
import { TraceView } from '@app/pages/project/components/TraceView';
import { Button } from '@app/components/ui/Button';
import { Status } from '@app/components/ui/Status';

interface IReportViewProps {
	saved: TSavedReview;
	userId: string;
	projectName: string;
	owner?: ITaskOwner;
	period?: TPeriodSelection;
	snapshotContext: string;
	savedTaskCount?: number;
}

export function ReportView({
	saved,
	userId,
	projectName,
	owner,
	period,
	snapshotContext,
	savedTaskCount,
}: IReportViewProps) {
	const prefix = useId();
	const [evidence, setEvidence] = useState<{
		citation: IReportCitation;
		opener: HTMLButtonElement;
	}>();
	const [evidenceOpen, setEvidenceOpen] = useState(false);
	const selection = SyncCommand.shape.selection.safeParse(saved.selection);
	const savedPeriod =
		selection.success && selection.data.mode === 'period' ? selection.data : period;
	const subject =
		owner?.id === saved.subjectSourceUserId ? owner.name : saved.subjectSourceUserId;
	const isPartial =
		saved.state === 'partial' ||
		!saved.coverage.discoveryComplete ||
		!saved.coverage.importComplete ||
		!saved.coverage.analysisComplete;
	const download = (format: 'json' | 'md') => {
		const url = URL.createObjectURL(
			new Blob([format === 'json' ? JSON.stringify(saved, null, 2) : saved.markdown], {
				type:
					format === 'json'
						? 'application/json;charset=utf-8'
						: 'text/markdown;charset=utf-8',
			}),
		);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = `self-review-${saved.id}.${format}`;
		anchor.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	};

	return (
		<article className="min-w-0 space-y-8" aria-labelledby={`${prefix}-title`}>
			{isPartial && (
				<Status variant="warning">
					Partial source coverage. Discovery:{' '}
					{saved.coverage.discoveryComplete ? 'complete' : 'incomplete'}; import:{' '}
					{saved.coverage.importComplete ? 'complete' : 'incomplete'}; review analysis:{' '}
					{saved.coverage.analysisComplete ? 'complete' : 'incomplete'}.
				</Status>
			)}
			<header className="space-y-4 border-b pb-6">
				<div className="space-y-2">
					<p className="text-metadata text-muted-foreground">
						Saved draft · {snapshotContext}
					</p>
					<h2 id={`${prefix}-title`} className="text-page-small md:text-page">
						Self-review
					</h2>
					<p className="text-report wrap-anywhere">{projectName}</p>
				</div>
				<dl className="grid gap-x-6 gap-y-4 text-metadata sm:grid-cols-2">
					<div>
						<dt className="text-muted-foreground">Review subject</dt>
						<dd className="mt-1 wrap-anywhere">{subject}</dd>
					</div>
					<div>
						<dt className="text-muted-foreground">Creation-date period</dt>
						<dd className="mt-1">
							{savedPeriod
								? formatPeriod(savedPeriod)
								: 'Saved UTC period unavailable'}
						</dd>
					</div>
					<div>
						<dt className="text-muted-foreground">Generated</dt>
						<dd className="mt-1">{formatTaskDate(saved.createdAt, true)}</dd>
					</div>
					<div>
						<dt className="text-muted-foreground">Subject coverage</dt>
						<dd className="mt-1">
							{saved.coverage.targetTasks} qualifying tasks ·{' '}
							{saved.coverage.analysisComplete
								? 'Review analysis complete'
								: 'Review analysis incomplete'}
						</dd>
					</div>
				</dl>
				{selection.success && selection.data.mode === 'tasks' && (
					<p className="text-metadata text-muted-foreground">
						Selected-task refresh · inherited creation-date period. Evidence may retain
						earlier retrieval dates.
					</p>
				)}
				<div
					className="flex flex-wrap gap-2"
					role="group"
					aria-label="Download saved report"
				>
					<Button variant="outline" size="sm" onClick={() => download('md')}>
						<Download aria-hidden="true" />
						Download Markdown
					</Button>
					<Button variant="outline" size="sm" onClick={() => download('json')}>
						<Download aria-hidden="true" />
						Download JSON
					</Button>
				</div>
			</header>
			<ReviewDocument
				saved={saved}
				savedTaskCount={savedTaskCount}
				onEvidence={(citation, opener) => {
					setEvidence({ citation, opener });
					setEvidenceOpen(true);
				}}
			/>
			<footer>
				<details className="border-t py-4 text-metadata">
					<summary className="cursor-pointer font-medium">Report provenance</summary>
					<p className="mt-4 text-muted-foreground">
						This draft uses saved evidence from the source snapshot below. Tracker
						assignment alone does not establish individual contribution.
					</p>
					<dl className="mt-4 space-y-3">
						<SavedIdentifier label="Source snapshot" value={saved.sourceSyncRunId} />
						<SavedIdentifier label="Report" value={saved.id} />
						<SavedIdentifier label="Review execution" value={saved.reviewRunId} />
						<SavedIdentifier
							label="Saved review subject"
							value={saved.subjectSourceUserId}
						/>
					</dl>
				</details>
				<ReviewUsage usage={saved.usage} />
				<TraceView runId={saved.reviewRunId} userId={userId} />
			</footer>
			<EvidencePanel
				saved={saved}
				citation={evidence?.citation}
				open={evidenceOpen}
				opener={evidence?.opener ?? null}
				onClose={() => setEvidenceOpen(false)}
			/>
		</article>
	);
}
