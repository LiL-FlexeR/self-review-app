import { useSyncExternalStore } from 'react';
import { auth } from '@app/auth/session';
import { AppShell } from '@app/components/templates/AppShell';
import { ConnectionsWorkspace } from '@app/pages/connections/components/ConnectionsWorkspace';

export function ConnectionsPage() {
	const identity = useSyncExternalStore(auth.subscribe, auth.snapshot);
	return (
		<AppShell
			contentWidth="connections"
			title="Connections"
			description="Connect your work to build an evidence-based self-review."
		>
			{identity && (
				<ConnectionsWorkspace
					key={`${identity.user.id}:${identity.sid}`}
					userId={identity.user.id}
					mode={identity.mode}
				/>
			)}
		</AppShell>
	);
}
