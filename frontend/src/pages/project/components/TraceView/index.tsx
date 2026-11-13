import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { z as zod } from 'zod';
import { pageOf } from '@self-review/contracts';
import { read, canRetainSavedRead } from '@app/lib/api';
import { Button } from '@app/components/ui/Button';
import { Status } from '@app/components/ui/Status';
import { EmptyState } from '@app/components/templates/EmptyState';
import { ErrorState } from '@app/components/templates/ErrorState';
import { LoadingState } from '@app/components/templates/LoadingState';
import { SavedIdentifier } from '@app/pages/project/components/SavedIdentifier';
import { formatTaskDate } from '@app/pages/project/task-presentation';
import { presentTraceEvent } from './presentation';

const TraceUnit = zod.object({
	batchId: zod.string(),
	level: zod.number(),
	events: zod.array(zod.unknown()),
});

export function TraceView({ runId, userId }: { runId: string; userId: string }) {
	const [open, setOpen] = useState(false);
	const trace = useInfiniteQuery({
		queryKey: [userId, 'trace', runId],
		enabled: open,
		retry: false,
		initialPageParam: '0',
		queryFn: ({ signal, pageParam }) =>
			read(
				`/jobs/${runId}/trace?cursor=${encodeURIComponent(pageParam)}`,
				pageOf(TraceUnit),
				signal,
			),
		getNextPageParam: (lastPage, _pages, _lastParam, pageParams) =>
			lastPage.nextCursor && !pageParams.includes(lastPage.nextCursor)
				? lastPage.nextCursor
				: undefined,
	});
	const savedPages = canRetainSavedRead(trace.error) ? trace.data : undefined;
	const units = [
		...new Map(
			savedPages?.pages.flatMap((page) => page.items).map((unit) => [unit.batchId, unit]),
		).values(),
	];
	const lastCursor = savedPages?.pages.at(-1)?.nextCursor;
	const hasLoop = !!lastCursor && !!savedPages?.pageParams.includes(lastCursor);
	const retry = () => {
		void (trace.isFetchNextPageError ? trace.fetchNextPage() : trace.refetch());
	};
	return (
		<details
			className="min-w-0 border-t py-4 text-metadata"
			onToggle={(event) => setOpen(event.currentTarget.open)}
		>
			<summary className="cursor-pointer font-medium">Safe execution trace</summary>
			<div className="mt-4 min-w-0 space-y-4">
				<p className="max-w-prose text-muted-foreground">
					Saved model and source-read events, grouped by processing unit and reduction
					level. Reading or refreshing this trace does not start another execution.
				</p>
				<dl>
					<SavedIdentifier label="Execution run" value={runId} />
				</dl>
				{open && trace.isPending && !trace.error && (
					<LoadingState reserveSpace>Loading saved trace…</LoadingState>
				)}
				{trace.error && (
					<ErrorState
						error={trace.error}
						title="Trace unavailable"
						onRetry={retry}
						retryLabel="Retry saved trace"
						isRetrying={trace.isFetching}
					>
						{savedPages
							? 'Already loaded events remain available below.'
							: 'Other saved results remain available in the workspace.'}
					</ErrorState>
				)}
				{savedPages && !units.length && !trace.error && (
					<EmptyState title="No saved processing events">
						This run has no recorded model units. Empty selections may complete without
						a model request.
					</EmptyState>
				)}
				<div className="divide-y">
					{units.map((unit, unitIndex) => (
						<section key={unit.batchId} className="min-w-0 space-y-4 py-6 first:pt-0">
							<h3 className="font-medium">
								Unit {unitIndex + 1} ·{' '}
								{unit.level === 0
									? 'Task evidence'
									: `Reduction level ${unit.level}`}
							</h3>
							{!unit.events.length && (
								<p className="text-muted-foreground">
									No events saved for this unit yet.
								</p>
							)}
							<ol className="space-y-4 border-l pl-4">
								{unit.events.map((event, eventIndex) => {
									const presentation = presentTraceEvent(event);
									return (
										<li
											key={eventIndex}
											className="min-w-0 space-y-1 wrap-anywhere"
										>
											<p>{presentation.title}</p>
											{presentation.timestamp && (
												<time
													dateTime={presentation.timestamp}
													className="block text-muted-foreground"
												>
													{formatTaskDate(presentation.timestamp, true)}
												</time>
											)}
											{presentation.facts.length > 0 && (
												<p className="text-muted-foreground">
													{presentation.facts.join(' · ')}
												</p>
											)}
											<details className="pt-1 text-muted-foreground">
												<summary className="w-fit cursor-pointer">
													Safe event fields
												</summary>
												<pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-identifier wrap-anywhere">
													{JSON.stringify(event, null, 2)}
												</pre>
											</details>
										</li>
									);
								})}
							</ol>
							<details className="text-muted-foreground">
								<summary className="w-fit cursor-pointer">Unit identifier</summary>
								<dl className="mt-2">
									<SavedIdentifier label="Processing unit" value={unit.batchId} />
								</dl>
							</details>
						</section>
					))}
				</div>
				{hasLoop && (
					<Status variant="warning">
						Trace pagination did not advance. Later units may be unavailable; refresh
						the saved trace to try again.
					</Status>
				)}
				{savedPages && (
					<div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
						<p className="text-muted-foreground">
							{units.length} units loaded
							{!trace.hasNextPage && !hasLoop && !trace.error
								? ' · all available units loaded'
								: ''}
						</p>
						<div className="flex flex-wrap gap-2">
							<Button
								variant="ghost"
								disabled={trace.isFetching}
								aria-busy={trace.isRefetching}
								onClick={() => void trace.refetch()}
							>
								Refresh saved trace
							</Button>
							{trace.hasNextPage && !trace.isFetchNextPageError && (
								<Button
									variant="outline"
									disabled={trace.isFetching}
									aria-busy={trace.isFetchingNextPage}
									onClick={() => void trace.fetchNextPage()}
								>
									{trace.isFetchingNextPage
										? 'Loading more units…'
										: 'Load more units'}
								</Button>
							)}
						</div>
					</div>
				)}
			</div>
		</details>
	);
}
