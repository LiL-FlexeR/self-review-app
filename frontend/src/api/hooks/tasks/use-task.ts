import { useQuery } from '@tanstack/react-query';
import { TaskDetail } from '@self-review/contracts';
import { read } from '@app/lib/api';

export function useTask(id: string, userId: string) {
	return useQuery({
		queryKey: [userId, 'task', id],
		queryFn: ({ signal }) => read(`/tasks/${id}`, TaskDetail, signal),
	});
}
