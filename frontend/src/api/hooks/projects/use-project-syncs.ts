import { useInfiniteQuery } from '@tanstack/react-query';
import { JobView, pageOf } from '@self-review/contracts';
import { read } from '@app/lib/api';

export function useProjectSyncs(id: string, userId: string | undefined) {
	return useInfiniteQuery({
		queryKey: [userId, 'project', id, 'history'],
		enabled: !!userId,
		initialPageParam: '0',
		queryFn: ({ signal, pageParam }) =>
			read(`/projects/${id}/syncs?cursor=${pageParam}`, pageOf(JobView), signal),
		getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
	});
}
