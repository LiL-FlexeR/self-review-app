import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ConnectionView } from '@self-review/contracts';
import { auth } from '@app/auth/session';
import { command } from '@app/lib/api';
import type { TConnectionMutationOptions, TSaveConnectionInput } from './types';

export function useSaveConnection<TInput extends TSaveConnectionInput>(
	userId: string,
	options: TConnectionMutationOptions<TInput> = {},
) {
	const queryClient = useQueryClient();
	return useMutation({
		retry: false,
		mutationFn: async (input: TInput) => {
			if (input.connectionId) {
				return ConnectionView.parse(
					await auth.request(`/connections/${input.connectionId}`, {
						method: 'PUT',
						body: JSON.stringify({ credentials: input.credentials }),
					}),
				);
			}
			return command(
				'/connections',
				{
					provider: input.provider,
					displayName: input.displayName,
					credentials: input.credentials,
				},
				ConnectionView,
			);
		},
		onSuccess: async (...args) => {
			await queryClient.invalidateQueries({ queryKey: [userId] });
			await options.onSuccess?.(...args);
		},
		onError: async (...args) => {
			await options.onError?.(...args);
			await queryClient.invalidateQueries({ queryKey: [userId, 'connections'] });
		},
	});
}
