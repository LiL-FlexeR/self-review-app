import { useInfiniteQuery } from '@tanstack/react-query';
import { z as zod } from 'zod';
import { pageOf } from '@self-review/contracts';
import { read } from '@app/lib/api';

const ProcessingUnit = zod.object({
	id: zod.string(),
	phase: zod.string(),
	level: zod.number(),
	ordinal: zod.number(),
	state: zod.string(),
});

export function useJobBatches(runId: string, userId: string, enabled: boolean) {
	return useInfiniteQuery({
		queryKey: [userId, 'batches', runId],
		enabled,
		retry: false,
		initialPageParam: '0',
		queryFn: ({ signal, pageParam }) =>
			read(
				`/jobs/${runId}/batches?cursor=${encodeURIComponent(pageParam)}`,
				pageOf(ProcessingUnit),
				signal,
			),
		getNextPageParam: (page, _pages, _param, pageParams) =>
			page.nextCursor && !pageParams.includes(page.nextCursor) ? page.nextCursor : undefined,
	});
}
