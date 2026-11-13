import { useQuery } from '@tanstack/react-query';
import { TaskDetail } from '@self-review/contracts';
import type { ITaskOwner } from '@app/pages/project/task-presentation';
import { read, canRetainSavedRead } from '@app/lib/api';
import { TaskDetailView } from '@app/pages/project/components/TaskDetailView';
import { SheetHeader, SheetTitle, SheetDescription } from '@app/components/ui/Sheet';
import { ErrorState } from '@app/components/templates/ErrorState';
import { LoadingState } from '@app/components/templates/LoadingState';

export function TaskDetails({
	id,
	userId,
	owner,
}: {
	id: string;
	userId: string;
	owner?: ITaskOwner;
}) {
	const task = useQuery({
		queryKey: [userId, 'task', id],
		queryFn: ({ signal }) => read(`/tasks/${id}`, TaskDetail, signal),
	});
	const canRetain = canRetainSavedRead(task.error);
	if (task.data && canRetain) {
		return (
			<TaskDetailView
				key={task.data.id}
				task={task.data}
				owner={owner}
				readError={task.error ?? undefined}
				onRetry={() => void task.refetch()}
				isRetrying={task.isFetching}
			/>
		);
	}
	return (
		<>
			<SheetHeader className="border-b p-4 pr-14 md:p-6 md:pr-14">
				<SheetTitle className="text-section">
					{task.isPending ? 'Loading saved task' : 'Task unavailable'}
				</SheetTitle>
				<SheetDescription>Saved evidence from the selected snapshot.</SheetDescription>
			</SheetHeader>
			<div className="space-y-4 overflow-y-auto p-4 md:p-6">
				{task.isPending && (
					<LoadingState reserveSpace>
						Loading description, saved comments and evidence…
					</LoadingState>
				)}
				{task.error && (
					<ErrorState
						error={task.error}
						title="Saved task unavailable"
						onRetry={() => void task.refetch()}
						retryLabel="Retry saved task"
						isRetrying={task.isFetching}
					/>
				)}
			</div>
		</>
	);
}
