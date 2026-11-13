import { useInfiniteQuery } from '@tanstack/react-query';
import { z as zod } from 'zod';
import { pageOf } from '@self-review/contracts';
import { read } from '@app/lib/api';

const TraceUnit = zod.object({
	batchId: zod.string(),
	level: zod.number(),
	events: zod.array(zod.unknown()),
});

export function useJobTrace(runId: string, userId: string, enabled: boolean) {
	return useInfiniteQuery({
		queryKey: [userId, 'trace', runId],
		enabled,
		retry: false,
		initialPageParam: '0',
		queryFn: ({ signal, pageParam }) =>
			read(
				`/jobs/${runId}/trace?cursor=${encodeURIComponent(pageParam)}`,
				pageOf(TraceUnit),
				signal,
			),
		getNextPageParam: (lastPage, _pages, _lastParam, pageParams) =>
			lastPage.nextCursor && !pageParams.includes(lastPage.nextCursor)
				? lastPage.nextCursor
				: undefined,
	});
}
