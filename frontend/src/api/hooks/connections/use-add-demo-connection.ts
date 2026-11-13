import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ConnectionView } from '@self-review/contracts';
import { command } from '@app/lib/api';
import type { TConnectionMutationOptions } from './types';

export function useAddDemoConnection(
	userId: string,
	options: TConnectionMutationOptions<void> = {},
) {
	const queryClient = useQueryClient();
	return useMutation({
		retry: false,
		mutationFn: () => command('/connections', { provider: 'fixture' }, ConnectionView),
		onSuccess: async (...args) => {
			await queryClient.invalidateQueries({ queryKey: [userId, 'connections'] });
			await options.onSuccess?.(...args);
		},
		onError: async (...args) => {
			await options.onError?.(...args);
			await queryClient.invalidateQueries({ queryKey: [userId, 'connections'] });
		},
	});
}
