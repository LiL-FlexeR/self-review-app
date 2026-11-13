import { useRef } from 'react';
import { RotateCw } from 'lucide-react';
import type { TProjectWorkspace } from '@app/pages/project/use-project-workspace';
import { formatPeriod } from '@app/pages/project/snapshot-period';
import { focusTaskWorkspace } from '@app/pages/project/task-presentation';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from '@app/components/ui/Dialog';
import { Button } from '@app/components/ui/Button';
import { Checkbox } from '@app/components/ui/Checkbox';
import { Status } from '@app/components/ui/Status';

export function RefreshTasksDialog({ workspace }: { workspace: TProjectWorkspace }) {
	const {
		refreshOpen,
		setRefreshOpen,
		selected,
		snapshotId,
		snapshot,
		selectedAuto,
		setSelectedAuto,
		busy,
		mutation,
		period,
	} = workspace;
	const cancel = useRef<HTMLButtonElement>(null);
	const opener = useRef<HTMLElement | null>(null);
	const hasBase =
		!!snapshot &&
		snapshot.runId === snapshotId &&
		['succeeded', 'partial'].includes(snapshot.state);
	const canConfirm = hasBase && !!selected.length && !!period.data && !period.error && !busy;
	return (
		<Dialog open={refreshOpen} onOpenChange={setRefreshOpen}>
			<DialogContent
				onOpenAutoFocus={(event) => {
					opener.current =
						document.activeElement instanceof HTMLElement
							? document.activeElement
							: null;
					event.preventDefault();
					cancel.current?.focus();
				}}
				onCloseAutoFocus={(event) => {
					if (!opener.current?.isConnected || opener.current === document.body) {
						event.preventDefault();
						focusTaskWorkspace();
					}
				}}
			>
				<DialogHeader>
					<DialogTitle>
						Refresh {selected.length} selected{' '}
						{selected.length === 1 ? 'task' : 'tasks'}
					</DialogTitle>
					<DialogDescription>
						Reread the selected tasks and create a new saved snapshot.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div className="space-y-1 border-y py-4">
						<p className="text-sm text-muted-foreground">Base period</p>
						<p className="font-medium">
							{period.data && snapshot
								? formatPeriod(period.data)
								: 'Resolving saved period…'}
						</p>
						<p className="text-metadata text-muted-foreground">
							{snapshot
								? `Snapshot ${snapshot.runId.slice(0, 8)} · ${snapshot.state}`
								: 'Snapshot context unavailable'}
						</p>
					</div>
					<p className="text-sm">
						Only the {selected.length} selected{' '}
						{selected.length === 1 ? 'task is' : 'tasks are'} reread. Other tasks are
						copied with their original retrieval times. A failed refresh can retain a
						stale copy.
					</p>
					<p className="text-sm text-muted-foreground">
						The resulting snapshot is reanalyzed and may incur model usage. A
						self-review covers all qualifying tasks in that snapshot, including copied
						tasks.
					</p>
					<label
						htmlFor="refresh-auto-review"
						className="flex cursor-pointer items-start gap-3 py-2 text-sm"
					>
						<Checkbox
							id="refresh-auto-review"
							className="mt-0.5"
							checked={selectedAuto}
							disabled={busy}
							onCheckedChange={(checked) => setSelectedAuto(checked === true)}
						/>
						<span>
							Create self-review after synchronization
							<span className="mt-1 block text-muted-foreground">
								Optional. May incur additional model usage.
							</span>
						</span>
					</label>
					{!hasBase && (
						<Status variant="error">
							Load a succeeded or partial base snapshot before confirming refresh.
						</Status>
					)}
					{period.error && (
						<div className="space-y-2">
							<Status variant="error">{period.error.message}</Status>
							<Button
								variant="outline"
								size="sm"
								disabled={period.isFetching || !snapshot}
								onClick={() => {
									void period.refetch();
								}}
							>
								Retry period
							</Button>
						</div>
					)}
					{mutation.error && <Status variant="error">{mutation.error.message}</Status>}
					{busy && (
						<p role="status" className="text-sm text-muted-foreground">
							{mutation.isPending
								? 'Submitting refresh… Accepted background work continues if you close this dialog.'
								: 'Another job is running. Refresh is available after it finishes.'}
						</p>
					)}
					<details className="text-metadata text-muted-foreground">
						<summary className="w-fit cursor-pointer">Base snapshot identifier</summary>
						<p className="mt-2 font-mono wrap-anywhere">{snapshotId}</p>
					</details>
				</div>
				<DialogFooter>
					<Button
						ref={cancel}
						type="button"
						variant="outline"
						onClick={() => setRefreshOpen(false)}
					>
						{mutation.isPending ? 'Close' : 'Cancel'}
					</Button>
					<Button
						disabled={!canConfirm}
						onClick={() => {
							if (!canConfirm) {
								return;
							}
							mutation.mutate({
								action: 'syncs',
								body: {
									selection: {
										mode: 'tasks',
										baseSyncRunId: snapshotId,
										taskIds: selected,
									},
									generateReview: selectedAuto,
								},
							});
						}}
					>
						<RotateCw aria-hidden="true" />
						{mutation.isPending
							? 'Starting refresh…'
							: `Refresh ${selected.length} ${selected.length === 1 ? 'task' : 'tasks'}`}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
