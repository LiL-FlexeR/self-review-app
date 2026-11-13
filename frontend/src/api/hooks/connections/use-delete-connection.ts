import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutationOptions } from '@tanstack/react-query';
import { auth } from '@app/auth/session';

export function useDeleteConnection<TInput extends { id: string }>(
	userId: string,
	options: Pick<UseMutationOptions<unknown, Error, TInput>, 'onSuccess' | 'onError'> = {},
) {
	const queryClient = useQueryClient();
	return useMutation({
		retry: false,
		mutationFn: (connection: TInput) =>
			auth.request(`/connections/${connection.id}`, {
				method: 'DELETE',
				body: JSON.stringify({ confirm: true }),
			}),
		onSuccess: async (...args) => {
			const connection = args[1];
			queryClient.removeQueries({ queryKey: [userId, 'catalog', connection.id] });
			await queryClient.invalidateQueries({ queryKey: [userId] });
			await options.onSuccess?.(...args);
		},
		onError: options.onError,
	});
}
