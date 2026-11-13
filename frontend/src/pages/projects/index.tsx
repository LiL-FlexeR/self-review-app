import { useSyncExternalStore } from 'react';
import { Link } from 'react-router';
import { useConnections } from '@app/api/hooks/connections/use-connections';
import { auth } from '@app/auth/session';
import { AppShell } from '@app/components/templates/AppShell';
import { EmptyState } from '@app/components/templates/EmptyState';
import { ErrorState } from '@app/components/templates/ErrorState';
import { LoadingState } from '@app/components/templates/LoadingState';
import { Button } from '@app/components/ui/Button';
import { ProjectsWorkspace } from '@app/pages/projects/components/ProjectsWorkspace';

export function ProjectsPage() {
	const identity = useSyncExternalStore(auth.subscribe, auth.snapshot);
	const connections = useConnections(identity?.user.id);
	return (
		<AppShell
			contentWidth="projects"
			title="Projects"
			description="Find a project across your connected sources and open its saved workspace."
			actions={
				<Button variant="outline" asChild>
					<Link to="/connections">Manage connections</Link>
				</Button>
			}
		>
			{connections.isPending && <LoadingState reserveSpace>Loading sources…</LoadingState>}
			{connections.error && (
				<ErrorState
					error={connections.error}
					title="Connections unavailable"
					onRetry={() => void connections.refetch()}
					retryLabel="Retry connections"
					isRetrying={connections.isFetching}
				/>
			)}
			{connections.data?.items.length === 0 && !connections.error && (
				<EmptyState
					title="Connect a source to find projects"
					action={
						<Button asChild>
							<Link to="/connections">Add a source</Link>
						</Button>
					}
				>
					Your accessible projects will appear here after you add a source connection.
				</EmptyState>
			)}
			{identity && connections.data && connections.data.items.length > 0 && (
				<ProjectsWorkspace
					key={`${identity.user.id}/${identity.sid}`}
					userId={identity.user.id}
					connections={connections.data.items}
				/>
			)}
		</AppShell>
	);
}
