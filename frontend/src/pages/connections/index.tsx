import { useSyncExternalStore } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { z as zod } from 'zod';
import { ConnectionView } from '@self-review/contracts';
import { auth, queryClient } from '@app/auth/session';
import { read, command } from '@app/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@app/components/ui/Card';
import { Button } from '@app/components/ui/Button';
import { Status } from '@app/components/ui/Status';
import { AppShell } from '@app/components/templates/AppShell';

export function ConnectionsPage() {
	const identity = useSyncExternalStore(auth.subscribe, auth.snapshot);
	const key = [identity?.user.id, 'connections'];
	const connections = useQuery({
		queryKey: key,
		enabled: !!identity,
		queryFn: ({ signal }) =>
			read('/connections', zod.object({ items: zod.array(ConnectionView) }), signal),
	});
	const add = useMutation({
		mutationFn: () => command('/connections', { provider: 'fixture' }, ConnectionView),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
	});
	return (
		<AppShell
			title="Connections"
			description="Connect your work to build an evidence-based self-review."
		>
			{connections.isPending && <Status>Loading connections…</Status>}
			{connections.error && <Status>{connections.error.message}</Status>}
			<Card>
				<CardHeader>
					<CardTitle>Demo source</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<p>
						Synthetic tracker data owned by your account. Offline uses a scripted model;
						demo uses live OpenAI.
					</p>
					{!connections.data?.items.length && (
						<Button disabled={add.isPending} onClick={() => add.mutate()}>
							Add demo source
						</Button>
					)}
					{add.error && <Status>{add.error.message}</Status>}
					{connections.data?.items.map((connection) => (
						<div key={connection.id} className="space-y-2 rounded-xl border p-4">
							<h2>{connection.displayName}</h2>
							<p className="text-sm text-muted-foreground">
								{connection.provider} · {connection.mode} data ·{' '}
								{connection.modelMode} model · {connection.status}
							</p>
							<p>
								Tracker token owner: {connection.sourceUserName} (
								{connection.sourceUserId})
							</p>
							<p className="text-sm">
								Verified {new Date(connection.verifiedAt).toLocaleString()}
							</p>
							<Link className="underline" to="/projects">
								Browse projects
							</Link>
						</div>
					))}
				</CardContent>
			</Card>
		</AppShell>
	);
}
