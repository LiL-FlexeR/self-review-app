import { useQuery } from '@tanstack/react-query';
import { ProjectDetail } from '@self-review/contracts';
import { read } from '@app/lib/api';

export function useProject(id: string, userId: string | undefined) {
	return useQuery({
		queryKey: [userId, 'project', id],
		enabled: !!userId,
		queryFn: ({ signal }) => read(`/projects/${id}`, ProjectDetail, signal),
	});
}
