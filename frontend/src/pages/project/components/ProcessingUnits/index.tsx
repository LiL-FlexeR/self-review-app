import { useState } from 'react';
import { useJobBatches } from '@app/api/hooks/jobs/use-job-batches';
import { canRetainSavedRead } from '@app/lib/api';
import { Button } from '@app/components/ui/Button';
import { EmptyState } from '@app/components/templates/EmptyState';
import { ErrorState } from '@app/components/templates/ErrorState';
import { LoadingState } from '@app/components/templates/LoadingState';
import { Status } from '@app/components/ui/Status';

export function ProcessingUnits({ runId, userId }: { runId: string; userId: string }) {
	const [open, setOpen] = useState(false);
	const batches = useJobBatches(runId, userId, open);
	const savedPages = canRetainSavedRead(batches.error) ? batches.data : undefined;
	const units = [
		...new Map(
			savedPages?.pages.flatMap((page) => page.items).map((unit) => [unit.id, unit]),
		).values(),
	];
	const lastCursor = savedPages?.pages.at(-1)?.nextCursor;
	const hasLoop = !!lastCursor && !!savedPages?.pageParams.includes(lastCursor);
	return (
		<details
			className="min-w-0 border-t py-4 text-metadata"
			onToggle={(event) => setOpen(event.currentTarget.open)}
		>
			<summary className="cursor-pointer font-medium">Processing units</summary>
			<div className="mt-4 space-y-4">
				<p className="text-muted-foreground">
					Saved task batches and reduction units are listed separately by level. Completed
					units across levels are not a fraction of leaf batches.
				</p>
				{open && batches.isPending && !batches.error && (
					<LoadingState reserveSpace>Loading saved processing units…</LoadingState>
				)}
				{batches.error && (
					<ErrorState
						error={batches.error}
						title="Processing units unavailable"
						retryLabel="Retry saved units"
						isRetrying={batches.isFetching}
						onRetry={() =>
							void (batches.isFetchNextPageError
								? batches.fetchNextPage()
								: batches.refetch())
						}
					>
						{savedPages
							? 'Loaded units remain available.'
							: 'Other saved results remain available in the workspace.'}
					</ErrorState>
				)}
				{savedPages && !units.length && !batches.error && (
					<EmptyState title="No processing units recorded">
						This run may not have needed model processing or may not have reached
						analysis.
					</EmptyState>
				)}
				<ul className="divide-y border-y">
					{units.map((unit) => (
						<li
							key={unit.id}
							className="flex flex-wrap items-center justify-between gap-2 py-3"
						>
							<span>
								{unit.level === 0
									? 'Task evidence'
									: `Reduction level ${unit.level}`}{' '}
								· unit {unit.ordinal + 1}
							</span>
							<span className="text-muted-foreground">{unit.state}</span>
						</li>
					))}
				</ul>
				{hasLoop && (
					<Status variant="warning">
						Pagination did not advance. The loaded units are an incomplete list.
					</Status>
				)}
				{savedPages && (
					<p className="text-muted-foreground">
						{units.length} units loaded
						{!batches.hasNextPage && !hasLoop && !batches.error
							? ' · all available units loaded'
							: ''}
					</p>
				)}
				<div className="flex flex-wrap gap-2">
					{savedPages && (
						<Button
							variant="ghost"
							disabled={batches.isFetching}
							onClick={() => void batches.refetch()}
						>
							Refresh saved units
						</Button>
					)}
					{savedPages && batches.hasNextPage && !batches.isFetchNextPageError && (
						<Button
							variant="outline"
							disabled={batches.isFetching}
							aria-busy={batches.isFetchingNextPage}
							onClick={() => void batches.fetchNextPage()}
						>
							{batches.isFetchingNextPage ? 'Loading units…' : 'Load more units'}
						</Button>
					)}
				</div>
			</div>
		</details>
	);
}
