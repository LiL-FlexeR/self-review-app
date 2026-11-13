import { useQuery } from '@tanstack/react-query';
import { JobView } from '@self-review/contracts';
import { read } from '@app/lib/api';

export function useJob(
	runId: string | null | undefined,
	userId: string | undefined,
	enabled = !!runId,
) {
	return useQuery({
		queryKey: [userId, 'job', runId],
		enabled,
		queryFn: ({ signal }) => read(`/jobs/${runId}`, JobView, signal),
	});
}
