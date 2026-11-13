import { useQuery } from '@tanstack/react-query';
import { ConnectionsView } from '@self-review/contracts';
import { read } from '@app/lib/api';

export function useConnections(userId: string | undefined) {
	return useQuery({
		queryKey: [userId, 'connections'],
		enabled: !!userId,
		queryFn: ({ signal }) => read('/connections', ConnectionsView, signal),
	});
}
