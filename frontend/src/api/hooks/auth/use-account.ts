import { useQuery } from '@tanstack/react-query';
import type { TIdentity } from '@self-review/contracts';
import { auth } from '@app/auth/session';

export function useAccount(identity: TIdentity | null) {
	return useQuery({
		queryKey: ['account', identity?.user.id, identity?.sid],
		enabled: !!identity,
		queryFn: ({ signal }) => auth.request('/auth/me', { signal }),
	});
}
