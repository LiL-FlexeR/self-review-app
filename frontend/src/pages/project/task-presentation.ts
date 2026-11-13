import type { z as zod } from 'zod';
import type { TaskView, TaskDetail } from '@self-review/contracts';

export type TTaskListItem = zod.infer<typeof TaskView>;
export type TSavedTask = zod.infer<typeof TaskDetail>;
export interface ITaskOwner {
	id: string;
	name: string;
}
export const TASK_TABLE_ID = 'snapshot-task-table';

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
	month: 'short',
	day: 'numeric',
	year: 'numeric',
	timeZone: 'UTC',
});
const DATE_TIME_FORMAT = new Intl.DateTimeFormat('en-US', {
	month: 'short',
	day: 'numeric',
	year: 'numeric',
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23',
	timeZone: 'UTC',
	timeZoneName: 'short',
});

export function formatTaskDate(value: string | null, includeTime = false) {
	const date = value ? new Date(value) : undefined;
	if (!date || Number.isNaN(date.getTime())) {
		return 'Unavailable';
	}
	return (includeTime ? DATE_TIME_FORMAT : DATE_FORMAT).format(date);
}

export function detailAvailability(status: string) {
	const labels: Record<string, string> = {
		available: 'Description saved',
		pending: 'Details pending',
		unavailable: 'Description unavailable',
		truncated: 'Description limited',
	};
	return labels[status] ?? `Details: ${status}`;
}

export function commentAvailability(
	task: Pick<TTaskListItem, 'commentReadState' | 'commentsTruncated'>,
) {
	const labels: Record<string, string> = {
		not_read: 'Comments not read',
		read: 'Comments read',
		failed: 'Comment read failed',
		truncated: 'Comments limited',
	};
	const label = labels[task.commentReadState] ?? 'Comment status unavailable';
	return task.commentsTruncated && task.commentReadState !== 'truncated'
		? `${label} · limited`
		: label;
}

export function focusTaskWorkspace() {
	const target =
		document.getElementById(TASK_TABLE_ID) ??
		document.querySelector<HTMLElement>('[role="tab"][data-state="active"]') ??
		document.getElementById('content');
	target?.focus({ preventScroll: true });
}
