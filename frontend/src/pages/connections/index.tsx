import { useSyncExternalStore } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ConnectionsView, ConnectionView } from '@self-review/contracts';
import { auth, queryClient } from '@app/auth/session';
import { read, command } from '@app/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@app/components/ui/Card';
import { Button } from '@app/components/ui/Button';
import { Status } from '@app/components/ui/Status';
import { AppShell } from '@app/components/templates/AppShell';
import { ProviderForm } from '@app/pages/connections/components/ProviderForm';
import { ConnectionCard } from '@app/pages/connections/components/ConnectionCard';

export function ConnectionsPage() {
	const identity = useSyncExternalStore(auth.subscribe, auth.snapshot);
	const key = [identity?.user.id, 'connections'];
	const connections = useQuery({
		queryKey: key,
		enabled: !!identity,
		queryFn: ({ signal }) => read('/connections', ConnectionsView, signal),
	});
	const add = useMutation({
		mutationFn: () => command('/connections', { provider: 'fixture' }, ConnectionView),
		retry: false,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
	});
	return (
		<AppShell
			contentWidth="connections"
			title="Connections"
			description="Connect your work to build an evidence-based self-review."
		>
			{connections.isPending && <Status variant="loading">Loading connections…</Status>}
			{connections.error && <Status variant="error">{connections.error.message}</Status>}
			<div className="space-y-6">
				{identity &&
					connections.data?.items.map((connection) => (
						<ConnectionCard
							key={connection.id}
							userId={identity.user.id}
							connection={connection}
						/>
					))}
				{identity &&
					(['linear', 'clickup', 'jira'] as const).map(
						(provider) =>
							connections.data?.availableProviders.includes(provider) &&
							!connections.data.items.some(
								(connection) => connection.provider === provider,
							) && (
								<Card key={provider}>
									<CardHeader>
										<CardTitle>
											Connect{' '}
											{provider === 'jira'
												? 'Jira Cloud'
												: provider === 'clickup'
													? 'ClickUp'
													: 'Linear'}
										</CardTitle>
									</CardHeader>
									<CardContent>
										<ProviderForm
											userId={identity.user.id}
											provider={provider}
										/>
									</CardContent>
								</Card>
							),
					)}
				{connections.data?.availableProviders.includes('fixture') &&
					!connections.data.items.some(
						(connection) => connection.provider === 'fixture',
					) && (
						<Card>
							<CardHeader>
								<CardTitle>Demo source</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<p>
									Synthetic tracker data owned by your account. Offline uses a
									scripted model; demo uses live OpenAI.
								</p>
								<Button disabled={add.isPending} onClick={() => add.mutate()}>
									Add demo source
								</Button>
								{add.error && <Status variant="error">{add.error.message}</Status>}
							</CardContent>
						</Card>
					)}
			</div>
		</AppShell>
	);
}
