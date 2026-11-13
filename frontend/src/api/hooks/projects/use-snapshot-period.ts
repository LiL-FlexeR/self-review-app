import { useQuery } from '@tanstack/react-query';
import { JobView } from '@self-review/contracts';
import type { TJobView } from '@self-review/contracts';
import { read } from '@app/lib/api';
import { resolveSnapshotPeriod } from './snapshot-period';

export function useSnapshotPeriod(
	id: string,
	snapshotId: string | undefined,
	snapshot: TJobView | undefined,
	userId: string | undefined,
) {
	return useQuery({
		queryKey: [userId, 'project', id, 'period', snapshotId],
		enabled: !!snapshot && !!userId,
		retry: false,
		queryFn: ({ signal }) => {
			if (!snapshot) {
				throw new Error('Load an accessible snapshot before resolving its period.');
			}
			return resolveSnapshotPeriod(
				snapshot,
				(baseId, baseSignal) => read(`/jobs/${baseId}`, JobView, baseSignal),
				signal,
			);
		},
	});
}
