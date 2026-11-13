import { SyncCommand } from '@self-review/contracts';
import type { TJobView, TSyncCommand } from '@self-review/contracts';

export type TPeriodSelection = Extract<TSyncCommand['selection'], { mode: 'period' }>;

// A read/recovery bound, independent of the number of tasks in a snapshot.
export const MAX_PERIOD_LOOKUPS = 64;

export async function resolveSnapshotPeriod(
	snapshot: TJobView,
	load: (runId: string, signal?: AbortSignal) => Promise<TJobView>,
	signal?: AbortSignal,
): Promise<TPeriodSelection> {
	const visited = new Set<string>();
	let current = snapshot;
	for (let depth = 0; depth < MAX_PERIOD_LOOKUPS; depth++) {
		signal?.throwIfAborted();
		if (current.type !== 'sync' || visited.has(current.runId)) {
			throw new Error('Snapshot period unavailable: invalid or cyclic base snapshot.');
		}
		visited.add(current.runId);
		const selection = SyncCommand.shape.selection.safeParse(current.selection);
		if (!selection.success) {
			throw new Error('Snapshot period unavailable: invalid saved selection.');
		}
		if (selection.data.mode === 'period') {
			return selection.data;
		}
		const baseId = selection.data.baseSyncRunId;
		if (visited.has(baseId)) {
			throw new Error('Snapshot period unavailable: cyclic base snapshot.');
		}
		current = await load(baseId, signal);
		signal?.throwIfAborted();
		if (current.runId !== baseId || !['succeeded', 'partial'].includes(current.state)) {
			throw new Error('Snapshot period unavailable: invalid base snapshot.');
		}
	}
	throw new Error('Snapshot period unavailable: base chain exceeds the lookup limit.');
}

export function formatPeriod(period: TPeriodSelection) {
	const formatter = new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		timeZone: 'UTC',
	});
	return `${formatter.formatRange(new Date(`${period.startDate}T00:00:00Z`), new Date(`${period.endDate}T00:00:00Z`))} · UTC`;
}

export function snapshotLabel(snapshot: TJobView) {
	const selection = SyncCommand.shape.selection.safeParse(snapshot.selection);
	if (!selection.success) {
		return `Saved selection unavailable · ${snapshot.state} · ${snapshot.runId.slice(0, 8)}`;
	}
	const label =
		selection.data.mode === 'period' ? formatPeriod(selection.data) : 'Selected-task refresh';
	return `${label} · ${snapshot.state} · ${snapshot.runId.slice(0, 8)}`;
}
