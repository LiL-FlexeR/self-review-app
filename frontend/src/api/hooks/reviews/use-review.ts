import { useQuery } from '@tanstack/react-query';
import { ReviewView } from '@self-review/contracts';
import { read } from '@app/lib/api';

export function useReview(
	reportId: string | null | undefined,
	userId: string | undefined,
	enabled = !!reportId && !!userId,
) {
	return useQuery({
		queryKey: [userId, 'report', reportId],
		enabled,
		queryFn: ({ signal }) => read(`/reviews/${reportId}`, ReviewView, signal),
	});
}
