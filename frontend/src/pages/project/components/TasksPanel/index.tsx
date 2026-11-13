import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { TProjectWorkspace } from '@app/pages/project/use-project-workspace';
import { canRetainSavedRead } from '@app/lib/api';
import { focusTaskWorkspace } from '@app/pages/project/task-presentation';
import { TaskTable } from '@app/pages/project/components/TaskTable';
import { SelectionToolbar } from '@app/pages/project/components/SelectionToolbar';
import { Button } from '@app/components/ui/Button';
import { EmptyState } from '@app/components/templates/EmptyState';
import { ErrorState } from '@app/components/templates/ErrorState';
import { LoadingState } from '@app/components/templates/LoadingState';

export function TasksPanel({ workspace }: { workspace: TProjectWorkspace }) {
	const {
		snapshot,
		tasks,
		selected,
		setSelected,
		cursor,
		setCursor,
		setDetail,
		busy,
		setSelectedAuto,
		setRefreshOpen,
		project,
	} = workspace;
	if (!snapshot && workspace.snapshotId && !workspace.selectedSnapshot.error) {
		return (
			<LoadingState reserveSpace>Loading the selected snapshot’s saved tasks…</LoadingState>
		);
	}
	if (!snapshot && workspace.snapshotId) {
		return (
			<EmptyState title="Selected snapshot unavailable">
				Choose another saved snapshot explicitly, or use the read recovery in the project
				context above.
			</EmptyState>
		);
	}
	if (!snapshot) {
		return (
			<EmptyState
				title="No snapshot selected"
				action={
					<Button variant="outline" onClick={() => workspace.setTab('overview')}>
						Go to Overview
					</Button>
				}
			>
				Choose a saved snapshot, or synchronize a period to collect task evidence.
			</EmptyState>
		);
	}
	const savedTasks = canRetainSavedRead(tasks.error) ? tasks.data : undefined;
	const items = savedTasks?.items ?? [];
	const pageStart = Number(cursor) + 1;
	const nextCursor = savedTasks?.nextCursor;
	const connection = project.data?.connection;
	const owner = connection
		? { id: connection.sourceUserId, name: connection.sourceUserName }
		: undefined;
	return (
		<section className="min-w-0 space-y-4" aria-labelledby="tasks-title">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="space-y-1">
					<h2 id="tasks-title" className="text-section">
						Tasks in this snapshot
					</h2>
					<p className="text-sm text-muted-foreground">
						All saved assignees and statuses. Refresh only the tasks you choose.
					</p>
				</div>
				<span className="text-metadata text-muted-foreground">
					{snapshot.counts.saved === undefined
						? 'Saved task evidence'
						: `${snapshot.counts.saved} tasks saved`}
				</span>
			</div>
			<SelectionToolbar
				count={selected.length}
				busy={busy}
				onClear={() => {
					focusTaskWorkspace();
					setSelected([]);
				}}
				onRefresh={() => {
					workspace.mutation.reset();
					setSelectedAuto(false);
					setRefreshOpen(true);
				}}
			/>
			{tasks.error && (
				<ErrorState
					error={tasks.error}
					title="Saved tasks unavailable"
					onRetry={() => void tasks.refetch()}
					retryLabel="Retry saved tasks"
					isRetrying={tasks.isFetching}
				>
					{savedTasks
						? 'Previously loaded tasks on this page remain available.'
						: 'You can inspect other saved snapshots from the selector.'}
				</ErrorState>
			)}
			{tasks.isPending && !tasks.error && (
				<LoadingState reserveSpace>Loading saved tasks…</LoadingState>
			)}
			{savedTasks && items.length === 0 && !tasks.error && (
				<EmptyState title="No tasks on this page">
					{cursor === '0'
						? 'No tasks were saved for this creation-date period. Check the selected period and source coverage in Overview.'
						: 'There are no saved tasks at this position. Return to the previous page.'}
				</EmptyState>
			)}
			{items.length > 0 && (
				<>
					<TaskTable
						tasks={items}
						selected={selected}
						owner={owner}
						onSelect={(taskId, checked) =>
							setSelected((previous) =>
								checked
									? [...new Set([...previous, taskId])]
									: previous.filter((selectedId) => selectedId !== taskId),
							)
						}
						onOpen={setDetail}
					/>
					<p id="task-table-help" className="text-metadata text-muted-foreground">
						Fresh, copied and stale describe retrieval provenance. Original retrieval
						dates are retained. Scroll the table horizontally for all columns.
					</p>
				</>
			)}
			{savedTasks && (
				<div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
					<p className="text-metadata text-muted-foreground" role="status">
						{items.length
							? `Showing ${pageStart}–${Number(cursor) + items.length}`
							: '0 tasks on this page'}
						{tasks.isFetching ? ' · updating saved data…' : ''}
					</p>
					<nav className="flex gap-2" aria-label="Saved task pages">
						<Button
							variant="outline"
							size="sm"
							disabled={cursor === '0' || tasks.isFetching}
							onClick={() => setCursor(String(Math.max(0, Number(cursor) - 20)))}
						>
							<ArrowLeft aria-hidden="true" />
							Previous
						</Button>
						<Button
							variant="outline"
							size="sm"
							disabled={!nextCursor || tasks.isFetching}
							onClick={() => {
								if (nextCursor) {
									setCursor(nextCursor);
								}
							}}
						>
							Next
							<ArrowRight aria-hidden="true" />
						</Button>
					</nav>
				</div>
			)}
		</section>
	);
}
