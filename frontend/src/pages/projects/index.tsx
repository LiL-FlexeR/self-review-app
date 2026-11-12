import { useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { ConnectionsView } from '@self-review/contracts';
import { auth } from '@app/auth/session';
import { read } from '@app/lib/api';
import { AppShell } from '@app/components/templates/AppShell';
import { Status } from '@app/components/ui/Status';
import { Catalog } from '@app/pages/projects/components/Catalog';

export function ProjectsPage() {
	const identity = useSyncExternalStore(auth.subscribe, auth.snapshot);
	const connections = useQuery({
		queryKey: [identity?.user.id, 'connections'],
		enabled: !!identity,
		queryFn: ({ signal }) => read('/connections', ConnectionsView, signal),
	});
	return (
		<AppShell
			title="Projects"
			description="Browse the projects accessible to your source connection."
		>
			{connections.isPending && <Status>Loading sources…</Status>}
			{connections.error && <Status>{connections.error.message}</Status>}
			{connections.data?.items.length === 0 && (
				<p>
					No sources yet.{' '}
					<Link className="underline" to="/connections">
						Add a source
					</Link>
					.
				</p>
			)}
			<div className="space-y-6">
				{identity &&
					connections.data?.items.map((connection) => (
						<Catalog
							key={`${connection.id}/${connection.verifiedAt}`}
							connectionId={connection.id}
							userId={identity.user.id}
							name={connection.displayName}
							provider={connection.provider}
						/>
					))}
			</div>
		</AppShell>
	);
}
