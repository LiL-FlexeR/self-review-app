import { useQuery } from '@tanstack/react-query';
import { TaskView, pageOf } from '@self-review/contracts';
import { read } from '@app/lib/api';

export function useProjectTasks(
	id: string,
	snapshotId: string | undefined,
	cursor: string,
	userId: string | undefined,
	enabled: boolean,
) {
	return useQuery({
		queryKey: [userId, 'project', id, 'tasks', snapshotId, cursor],
		enabled,
		queryFn: ({ signal }) =>
			read(
				`/projects/${id}/tasks?syncRunId=${snapshotId}&cursor=${cursor}`,
				pageOf(TaskView),
				signal,
			),
	});
}
