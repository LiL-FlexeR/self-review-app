import { useEffect, useId, useRef, useState } from 'react';
import { ExternalLink, FileText, ArrowUpRight } from 'lucide-react';
import type { TSavedTask, ITaskOwner } from '@app/pages/project/task-presentation';
import { formatTaskDate } from '@app/pages/project/task-presentation';
import { TaskEvidenceView } from '@app/pages/project/components/TaskEvidenceView';
import { TaskFreshness } from '@app/pages/project/components/TaskFreshness';
import { TaskAssignees } from '@app/pages/project/components/TaskAssignees';
import { SheetHeader, SheetTitle, SheetDescription } from '@app/components/ui/Sheet';
import { Button } from '@app/components/ui/Button';
import { Status } from '@app/components/ui/Status';

interface ITaskDetailViewProps {
	task: TSavedTask;
	owner?: ITaskOwner;
	readError?: string;
}
interface IEvidenceSelection {
	sourceId: string;
	quote?: string;
	controlId: string;
}
const CLAIM_LABELS = {
	task_description: 'Task description',
	reported_result: 'Reported result',
	reported_measurement: 'Measurement from a source',
};
const EMPTY_DESCRIPTION: Record<string, string> = {
	available: 'No description in the saved source.',
	pending: 'Task details were not read before this snapshot was saved.',
	unavailable: 'The description was unavailable during this synchronization.',
	truncated: 'No description text was retained in this limited source.',
};

export function TaskDetailView({ task, owner, readError }: ITaskDetailViewProps) {
	const [evidence, setEvidence] = useState<IEvidenceSelection>();
	const prefix = useId();
	const evidenceHeading = useRef<HTMLHeadingElement>(null);
	const returnControl = useRef<string | undefined>(undefined);
	useEffect(() => {
		if (evidence) {
			evidenceHeading.current?.focus();
		} else if (returnControl.current) {
			document.getElementById(returnControl.current)?.focus({ preventScroll: true });
			returnControl.current = undefined;
		}
	}, [evidence]);
	const openEvidence = (selection: IEvidenceSelection) => {
		returnControl.current = selection.controlId;
		setEvidence(selection);
	};
	const source = evidence
		? task.sources.find(
				(item) => item.id === evidence.sourceId && item.taskSnapshotId === task.id,
			)
		: undefined;
	if (evidence) {
		return (
			<TaskEvidenceView
				source={source}
				quote={evidence.quote}
				headingRef={evidenceHeading}
				onBack={() => setEvidence(undefined)}
			/>
		);
	}
	const hasLimitedComments = task.commentsTruncated || task.commentReadState === 'truncated';
	return (
		<>
			<SheetHeader className="max-h-[40dvh] shrink-0 overflow-y-auto border-b p-4 pr-14 md:p-6 md:pr-14">
				<p className="font-mono text-identifier text-muted-foreground">{task.identifier}</p>
				<SheetTitle className="text-section wrap-anywhere">{task.title}</SheetTitle>
				<SheetDescription>
					Saved task evidence · {formatTaskDate(task.retrievedAt, true)}
				</SheetDescription>
				{task.safeUrl && (
					<Button variant="outline" size="sm" className="mt-2 w-fit" asChild>
						<a href={task.safeUrl} target="_blank" rel="noreferrer">
							<ExternalLink aria-hidden="true" />
							Open in tracker
						</a>
					</Button>
				)}
			</SheetHeader>
			<div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 md:p-6">
				{readError && (
					<Status variant="error">
						{readError} Showing the previously loaded saved task.
					</Status>
				)}
				<div className="flex flex-wrap items-center gap-2">
					<TaskFreshness status={task.refreshStatus} />
					<span className="rounded-chips border px-2 py-0.5 text-metadata wrap-anywhere">
						{task.state || 'Status unavailable'}
					</span>
				</div>
				{task.refreshStatus === 'stale' && (
					<Status variant="warning">
						Refresh failed. Previous saved evidence was retained with its original
						retrieval time.
					</Status>
				)}
				{task.refreshStatus === 'copied' && (
					<p className="text-sm text-muted-foreground">
						Copied from a previous snapshot. Dates below are the original retrieval
						dates.
					</p>
				)}
				{task.detailStatus === 'truncated' && (
					<Status variant="warning">
						Some source content was omitted. The saved description below may be
						incomplete.
					</Status>
				)}
				{['pending', 'unavailable'].includes(task.detailStatus) && (
					<Status variant="warning">{EMPTY_DESCRIPTION[task.detailStatus]}</Status>
				)}
				<section className="space-y-3" aria-labelledby={`${prefix}-description`}>
					<h3 id={`${prefix}-description`} className="text-component">
						Description
					</h3>
					<p className="text-report whitespace-pre-wrap wrap-anywhere">
						{task.description ||
							EMPTY_DESCRIPTION[task.detailStatus] ||
							'Description availability is unknown.'}
					</p>
				</section>
				<section className="space-y-4 border-t pt-6" aria-labelledby={`${prefix}-comments`}>
					<div className="flex items-center gap-2">
						<h3 id={`${prefix}-comments`} className="text-component">
							Comments
						</h3>
						{task.comments.length > 0 && (
							<span className="text-metadata text-muted-foreground">
								{task.comments.length} saved
							</span>
						)}
					</div>
					{task.commentReadState === 'not_read' && (
						<p className="text-sm text-muted-foreground">
							Comments were not read during this synchronization.
						</p>
					)}
					{task.commentReadState === 'failed' && (
						<Status variant="warning">
							Comments unavailable because the read failed. Any retained records below
							do not establish a successful read.
						</Status>
					)}
					{hasLimitedComments && (
						<Status variant="warning">
							Some source content was omitted. Only the saved comments and excerpts
							are shown.
						</Status>
					)}
					{task.commentReadState === 'read' &&
						!hasLimitedComments &&
						!task.comments.length && (
							<p className="text-sm text-muted-foreground">
								No comments returned by the saved read.
							</p>
						)}
					{hasLimitedComments && !task.comments.length && (
						<p className="text-sm text-muted-foreground">
							No comment text was retained in this limited snapshot.
						</p>
					)}
					{!['read', 'not_read', 'failed', 'truncated'].includes(
						task.commentReadState,
					) && (
						<p className="text-sm text-muted-foreground">
							Comment read status is unavailable.
						</p>
					)}
					<div className="space-y-4">
						{task.comments.map((comment, index) => (
							<article key={comment.id} className="space-y-2 border-l-2 pl-4">
								<p className="text-metadata text-muted-foreground">
									Saved comment {index + 1} · retrieved{' '}
									{formatTaskDate(comment.retrievedAt, true)}
								</p>
								<p className="text-report whitespace-pre-wrap wrap-anywhere">
									{comment.body || 'The saved comment contains no text.'}
								</p>
							</article>
						))}
					</div>
				</section>
				<section className="space-y-4 border-t pt-6" aria-labelledby={`${prefix}-findings`}>
					<h3 id={`${prefix}-findings`} className="text-component">
						Findings
					</h3>
					<p className="text-sm text-muted-foreground">
						Validated findings from saved evidence. Assignment alone does not establish
						individual contribution.
					</p>
					{!task.findings.length && (
						<p className="text-sm text-muted-foreground">
							No validated findings saved for this task.
						</p>
					)}
					<div className="divide-y">
						{task.findings.map((claim, claimIndex) => (
							<article key={claimIndex} className="space-y-3 py-4 first:pt-0">
								<p className="text-metadata text-muted-foreground">
									{CLAIM_LABELS[claim.kind]}
								</p>
								<p className="text-report wrap-anywhere">{claim.text}</p>
								<div className="flex flex-wrap gap-2">
									{claim.evidence.map((pair, pairIndex) => {
										const controlId = `${prefix}-finding-${claimIndex}-${pairIndex}`;
										return (
											<Button
												key={pairIndex}
												id={controlId}
												variant="outline"
												size="sm"
												aria-label={`Read saved evidence ${pairIndex + 1} for finding ${claimIndex + 1}`}
												onClick={() => openEvidence({ ...pair, controlId })}
											>
												<FileText aria-hidden="true" />
												Evidence {pairIndex + 1}
											</Button>
										);
									})}
								</div>
							</article>
						))}
					</div>
				</section>
				<section className="space-y-4 border-t pt-6">
					<h3 className="text-component">Source metadata</h3>
					<dl className="grid gap-4 text-sm sm:grid-cols-2">
						<div>
							<dt className="text-muted-foreground">Created</dt>
							<dd className="mt-1">{formatTaskDate(task.sourceCreatedAt, true)}</dd>
						</div>
						<div>
							<dt className="text-muted-foreground">Retrieved</dt>
							<dd className="mt-1">{formatTaskDate(task.retrievedAt, true)}</dd>
						</div>
						<div className="sm:col-span-2">
							<dt className="text-muted-foreground">Saved assignees</dt>
							<dd className="mt-1">
								<TaskAssignees ids={task.assignees} owner={owner} />
							</dd>
						</div>
					</dl>
					{task.sources.length > 0 && (
						<div className="space-y-2">
							<p className="text-metadata text-muted-foreground">
								Saved source registry
							</p>
							{task.sources
								.filter((item) => item.taskSnapshotId === task.id)
								.map((item, index) => {
									const controlId = `${prefix}-registry-${index}`;
									const labels = {
										metadata: 'Task metadata',
										description: 'Description source',
										comment: 'Comment source',
									};
									return (
										<Button
											id={controlId}
											key={item.id}
											variant="ghost"
											size="sm"
											className="flex w-full justify-between"
											onClick={() =>
												openEvidence({ sourceId: item.id, controlId })
											}
										>
											{labels[item.kind]}
											<ArrowUpRight aria-hidden="true" />
										</Button>
									);
								})}
						</div>
					)}
					<details className="text-metadata text-muted-foreground">
						<summary className="w-fit cursor-pointer">Saved identifiers</summary>
						<dl className="mt-3 space-y-3 wrap-anywhere">
							<div>
								<dt>Tracker task</dt>
								<dd className="font-mono">{task.externalId}</dd>
							</div>
							<div>
								<dt>Task snapshot</dt>
								<dd className="font-mono">{task.id}</dd>
							</div>
							<div>
								<dt>Synchronization snapshot</dt>
								<dd className="font-mono">{task.syncRunId}</dd>
							</div>
						</dl>
					</details>
				</section>
			</div>
		</>
	);
}
