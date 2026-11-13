import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AcceptedJob } from '@self-review/contracts';
import { command } from '@app/lib/api';

export function useProjectCommand(
	id: string,
	userId: string | undefined,
	onAccepted: (runId: string) => void,
) {
	const queryClient = useQueryClient();
	const pendingCommand = useRef<{ fingerprint: string; key: string } | null>(null);
	return useMutation({
		retry: false,
		mutationFn: async ({ action, body }: { action: 'syncs' | 'reviews'; body: object }) => {
			const fingerprint = JSON.stringify({ action, body });
			if (pendingCommand.current?.fingerprint !== fingerprint) {
				pendingCommand.current = { fingerprint, key: crypto.randomUUID() };
			}
			return command(
				`/projects/${id}/${action}`,
				{ ...body, idempotencyKey: pendingCommand.current!.key },
				AcceptedJob,
			);
		},
		onSuccess: async (result) => {
			pendingCommand.current = null;
			onAccepted(result.runId);
			await queryClient.invalidateQueries({ queryKey: [userId, 'project', id] });
		},
	});
}
