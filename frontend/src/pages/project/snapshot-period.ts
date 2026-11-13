import { SyncCommand } from '@self-review/contracts';
import type { TJobView } from '@self-review/contracts';
import type { TPeriodSelection } from '@app/api/hooks/projects/snapshot-period';

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
