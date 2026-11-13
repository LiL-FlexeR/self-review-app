import { useState } from 'react';
import { useConnections } from '@app/api/hooks/connections/use-connections';
import { useSaveConnection } from '@app/api/hooks/connections/use-save-connection';
import { useAddDemoConnection } from '@app/api/hooks/connections/use-add-demo-connection';
import { useDeleteConnection } from '@app/api/hooks/connections/use-delete-connection';
import type { TSaveConnectionInput } from '@app/api/hooks/connections/types';
import type { TConnection, TLiveProvider } from './connection-presentation';
import { providerLabel } from './connection-presentation';

export type TConnectionForm = {
	key: string;
	provider: TLiveProvider;
	connectionId?: string;
	displayName?: string;
};

type TSaveConnection = TSaveConnectionInput & {
	formKey: string;
};

type TFeedback = { variant: 'success' | 'error'; message: string };

export function useConnectionsWorkspace(userId: string) {
	const [form, setForm] = useState<TConnectionForm>();
	const [managedId, setManagedId] = useState<string>();
	const [deleting, setDeleting] = useState<TConnection>();
	const [feedback, setFeedback] = useState<TFeedback>();
	const connections = useConnections(userId);
	const save = useSaveConnection<TSaveConnection>(userId, {
		onSuccess: (connection, input) => {
			setFeedback({
				variant: 'success',
				message: input.connectionId
					? `Credentials replaced for ${connection.displayName}. Verified owner: ${connection.sourceUserName}.`
					: `${providerLabel(connection.provider)} connected as ${connection.displayName}. Verified owner: ${connection.sourceUserName}.`,
			});
			setForm((current) => (current?.key === input.formKey ? undefined : current));
		},
		onError: (error) => {
			setFeedback({ variant: 'error', message: error.message });
		},
	});
	const add = useAddDemoConnection(userId, {
		onSuccess: () => {
			setFeedback({
				variant: 'success',
				message: 'Synthetic demo source added. Browse projects to get started.',
			});
		},
		onError: (error) => {
			setFeedback({ variant: 'error', message: error.message });
		},
	});
	const remove = useDeleteConnection<TConnection>(userId, {
		onSuccess: (result, connection) => {
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
