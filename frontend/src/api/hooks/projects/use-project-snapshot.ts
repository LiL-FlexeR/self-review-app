import { useQuery } from '@tanstack/react-query';
import { readProjectSnapshot } from './snapshot-reader';

export function useProjectSnapshot(
	id: string,
	snapshotId: string | undefined,
	userId: string | undefined,
) {
	return useQuery({
		queryKey: [userId, 'project', id, 'snapshot', snapshotId],
		enabled: !!snapshotId && !!userId,
		queryFn: ({ signal }) => readProjectSnapshot(id, snapshotId!, signal),
	});
}
