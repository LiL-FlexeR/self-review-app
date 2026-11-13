import { useQuery } from '@tanstack/react-query';
import { TaskDetail } from '@self-review/contracts';
import type { ITaskOwner } from '@app/pages/project/task-presentation';
import { read } from '@app/lib/api';
import { ClientError } from '@app/auth/coordinator';
import { TaskDetailView } from '@app/pages/project/components/TaskDetailView';
import { SheetHeader, SheetTitle, SheetDescription } from '@app/components/ui/Sheet';
import { Button } from '@app/components/ui/Button';
import { Status } from '@app/components/ui/Status';

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
	const canRetain =
		!task.error ||
		(task.error instanceof ClientError &&
			task.error.retryable &&
			![401, 403, 404].includes(task.error.status));
	if (task.data && canRetain) {
		return (
			<TaskDetailView
				key={task.data.id}
				task={task.data}
				owner={owner}
				readError={task.error?.message}
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
					<p role="status" className="text-sm text-muted-foreground">
						Loading description, saved comments and evidence…
					</p>
				)}
				{task.error && (
					<>
						<Status variant="error">{task.error.message}</Status>
						<Button
							variant="outline"
							disabled={task.isFetching}
							onClick={() => {
								void task.refetch();
							}}
						>
							Retry saved task
						</Button>
					</>
				)}
			</div>
		</>
	);
}
