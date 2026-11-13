import { ArrowLeft, ArrowRight, ListChecks } from 'lucide-react';
import type { TProjectWorkspace } from '@app/pages/project/use-project-workspace';
import { focusTaskWorkspace } from '@app/pages/project/task-presentation';
import { TaskTable } from '@app/pages/project/components/TaskTable';
import { SelectionToolbar } from '@app/pages/project/components/SelectionToolbar';
import { Button } from '@app/components/ui/Button';
import { Status } from '@app/components/ui/Status';

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
	if (!snapshot) {
		return (
			<div className="space-y-3 py-6">
				<h2 className="text-section">No snapshot selected</h2>
				<p className="text-sm text-muted-foreground">
					Choose a saved snapshot, or synchronize a period to collect task evidence.
				</p>
				<Button variant="outline" onClick={() => workspace.setTab('overview')}>
					Go to Overview
				</Button>
			</div>
		);
	}
	const items = tasks.data?.items ?? [];
	const pageStart = Number(cursor) + 1;
	const nextCursor = tasks.data?.nextCursor;
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
				<div className="space-y-3">
					<Status variant="error">{tasks.error.message}</Status>
					<Button
						variant="outline"
						disabled={tasks.isFetching}
						onClick={() => {
							void tasks.refetch();
						}}
					>
						Retry saved tasks
					</Button>
				</div>
			)}
			{tasks.isPending && (
				<p role="status" className="py-8 text-sm text-muted-foreground">
					Loading saved tasks…
				</p>
			)}
			{tasks.data && items.length === 0 && (
				<div className="space-y-3 border-y py-10">
					<ListChecks className="size-6 text-muted-foreground" aria-hidden="true" />
					<h3 className="text-component">No tasks on this page</h3>
					<p className="max-w-prose text-sm text-muted-foreground">
						{cursor === '0'
							? 'No tasks were saved for this creation-date period. Check the selected period and source coverage in Overview.'
							: 'There are no saved tasks at this position. Return to the previous page.'}
					</p>
				</div>
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
			{tasks.data && (
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
