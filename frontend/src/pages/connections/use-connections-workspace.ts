import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ConnectionsView, ConnectionView } from '@self-review/contracts';
import type { TTrackerCredentials } from '@self-review/contracts';
import { auth, queryClient } from '@app/auth/session';
import { read, command } from '@app/lib/api';
import type { TConnection, TLiveProvider } from './connection-presentation';
import { providerLabel } from './connection-presentation';

export type TConnectionForm = {
	key: string;
	provider: TLiveProvider;
	connectionId?: string;
	displayName?: string;
};

type TSaveConnection = {
	form: TConnectionForm;
	displayName: string;
	credentials: TTrackerCredentials;
};

type TFeedback = { variant: 'success' | 'error'; message: string };

export function useConnectionsWorkspace(userId: string) {
	const [form, setForm] = useState<TConnectionForm>();
	const [managedId, setManagedId] = useState<string>();
	const [deleting, setDeleting] = useState<TConnection>();
	const [feedback, setFeedback] = useState<TFeedback>();
	const key = [userId, 'connections'];
	const connections = useQuery({
		queryKey: key,
		queryFn: ({ signal }) => read('/connections', ConnectionsView, signal),
	});
	const save = useMutation({
		retry: false,
		mutationFn: async (input: TSaveConnection) => {
			if (input.form.connectionId) {
				return ConnectionView.parse(
					await auth.request(`/connections/${input.form.connectionId}`, {
						method: 'PUT',
						body: JSON.stringify({ credentials: input.credentials }),
					}),
				);
			}
			return command(
				'/connections',
				{
					provider: input.form.provider,
					displayName: input.displayName,
					credentials: input.credentials,
				},
				ConnectionView,
			);
		},
		onSuccess: async (connection, input) => {
			await queryClient.invalidateQueries({ queryKey: [userId] });
			setFeedback({
				variant: 'success',
				message: input.form.connectionId
					? `Credentials replaced for ${connection.displayName}. Verified owner: ${connection.sourceUserName}.`
					: `${providerLabel(connection.provider)} connected as ${connection.displayName}. Verified owner: ${connection.sourceUserName}.`,
			});
			setForm((current) => (current?.key === input.form.key ? undefined : current));
		},
		onError: async (error) => {
			setFeedback({ variant: 'error', message: error.message });
			await queryClient.invalidateQueries({ queryKey: key });
		},
	});
	const add = useMutation({
		mutationFn: () => command('/connections', { provider: 'fixture' }, ConnectionView),
		retry: false,
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: key });
			setFeedback({
				variant: 'success',
				message: 'Synthetic demo source added. Browse projects to get started.',
			});
		},
		onError: async (error) => {
			setFeedback({ variant: 'error', message: error.message });
			await queryClient.invalidateQueries({ queryKey: key });
		},
	});
	const remove = useMutation({
		retry: false,
		mutationFn: (connection: TConnection) =>
			auth.request(`/connections/${connection.id}`, {
				method: 'DELETE',
				body: JSON.stringify({ confirm: true }),
			}),
		onSuccess: async (result, connection) => {
			queryClient.removeQueries({ queryKey: [userId, 'catalog', connection.id] });
			await queryClient.invalidateQueries({ queryKey: [userId] });
			setDeleting(undefined);
			setManagedId((current) => (current === connection.id ? undefined : current));
			setFeedback({
				variant: 'success',
				message: `${connection.displayName} and its local data were deleted.`,
			});
		},
		onError: (error) => setFeedback({ variant: 'error', message: error.message }),
	});
	const busy = save.isPending || add.isPending || remove.isPending;

	function openForm(provider: TLiveProvider, connection?: TConnection) {
		if (busy) {
			return;
		}
		save.reset();
		setFeedback(undefined);
		setForm({
			key: crypto.randomUUID(),
			provider,
			connectionId: connection?.id,
			displayName: connection?.displayName,
		});
	}

	function openDeletion(connection: TConnection) {
		if (busy) {
			return;
		}
		remove.reset();
		setFeedback(undefined);
		setDeleting(connection);
	}

	return {
		connections,
		form,
		setForm,
		managedId,
		setManagedId,
		deleting,
		setDeleting,
		feedback,
		save,
		add,
		remove,
		busy,
		openForm,
		openDeletion,
	};
}

export type TConnectionsWorkspace = ReturnType<typeof useConnectionsWorkspace>;
