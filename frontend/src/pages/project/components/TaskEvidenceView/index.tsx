import { ArrowLeft, ExternalLink } from 'lucide-react';
import type { TSource } from '@self-review/contracts';
import type { Ref } from 'react';
import { formatTaskDate } from '@app/pages/project/task-presentation';
import { Button } from '@app/components/ui/Button';
import { SheetHeader, SheetTitle, SheetDescription } from '@app/components/ui/Sheet';
import { Status } from '@app/components/ui/Status';

interface ITaskEvidenceViewProps {
	source?: TSource;
	quote?: string;
	onBack: () => void;
	headingRef: Ref<HTMLHeadingElement>;
}
const SOURCE_LABELS = {
	metadata: 'Task metadata',
	description: 'Description',
	comment: 'Saved comment',
};

export function TaskEvidenceView({ source, quote, onBack, headingRef }: ITaskEvidenceViewProps) {
	return (
		<>
			<SheetHeader className="shrink-0 border-b p-4 pr-14 md:p-6 md:pr-14">
				<Button variant="ghost" size="sm" className="-ml-3 mb-2 w-fit" onClick={onBack}>
					<ArrowLeft aria-hidden="true" />
					Back to task
				</Button>
				<SheetTitle ref={headingRef} tabIndex={-1} className="text-section">
					Saved evidence
				</SheetTitle>
				<SheetDescription>
					{source ? SOURCE_LABELS[source.kind] : 'Unavailable source'} · read from this
					saved snapshot
				</SheetDescription>
			</SheetHeader>
			<div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 md:p-6">
				{quote && (
					<section className="space-y-3">
						<h3 className="text-component">Quoted evidence</h3>
						<blockquote className="border-l-2 border-control-border pl-4 text-report whitespace-pre-wrap wrap-anywhere">
							{quote}
						</blockquote>
					</section>
				)}
				{!source && (
					<Status variant="error">
						The referenced source is unavailable in this task’s saved source registry.
						The quotation remains visible; no external content was fetched.
					</Status>
				)}
				{source && (
					<>
						{source.truncated && (
							<Status variant="warning">
								Some source content was omitted. This is the exact saved excerpt
								used for analysis.
							</Status>
						)}
						<section className="space-y-3">
							<h3 className="text-component">Saved source excerpt</h3>
							<p className="text-report whitespace-pre-wrap wrap-anywhere">
								{source.textExcerpt}
							</p>
						</section>
						<dl className="space-y-4 border-t pt-4 text-sm">
							<div>
								<dt className="text-muted-foreground">Source created</dt>
								<dd className="mt-1">{formatTaskDate(source.createdAt, true)}</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Source updated</dt>
								<dd className="mt-1">{formatTaskDate(source.updatedAt, true)}</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Retrieved</dt>
								<dd className="mt-1">{formatTaskDate(source.retrievedAt, true)}</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Saved source status</dt>
								<dd className="mt-1 wrap-anywhere">{source.state}</dd>
							</div>
						</dl>
						{source.url && (
							<Button variant="outline" asChild>
								<a href={source.url} target="_blank" rel="noreferrer">
									<ExternalLink aria-hidden="true" />
									Open tracker source
								</a>
							</Button>
						)}
						{!source.url && (
							<p className="text-sm text-muted-foreground">
								No verified external link was saved. The evidence above remains
								available.
							</p>
						)}
						<details className="text-metadata text-muted-foreground">
							<summary className="w-fit cursor-pointer">Source identifier</summary>
							<p className="mt-2 font-mono wrap-anywhere">{source.id}</p>
						</details>
					</>
				)}
			</div>
		</>
	);
}
