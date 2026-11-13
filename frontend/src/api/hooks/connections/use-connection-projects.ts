import { useInfiniteQuery } from '@tanstack/react-query';
import { ProjectView, pageOf } from '@self-review/contracts';
import { read } from '@app/lib/api';
import { catalogContinuation } from './catalog-pagination';

export function useConnectionProjects(connectionId: string, userId: string) {
	return useInfiniteQuery({
		queryKey: [userId, 'catalog', connectionId],
		initialPageParam: null as string | null,
		queryFn: ({ signal, pageParam }) =>
			read(
				`/connections/${connectionId}/projects${pageParam === null ? '' : `?cursor=${encodeURIComponent(pageParam)}`}`,
				pageOf(ProjectView),
				signal,
			),
		getNextPageParam: (_lastPage, pages, _lastParam, pageParams) =>
			catalogContinuation(pages, pageParams).nextCursor,
		retry: false,
	});
}
