import { useSyncExternalStore, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { z as zod } from 'zod';
import { ConnectionView, ProjectView, pageOf } from '@self-review/contracts';
import { auth } from '@app/auth/session';
import { read } from '@app/lib/api';
import { AppShell } from '@app/components/templates/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '@app/components/ui/Card';
import { Status } from '@app/components/ui/Status';
import { Button } from '@app/components/ui/Button';

function Catalog({
	connectionId,
	userId,
	name,
}: {
	connectionId: string;
	userId: string;
	name: string;
}) {
	const [cursor, setCursor] = useState('0');
	const catalog = useQuery({
		queryKey: [userId, 'catalog', connectionId, cursor],
		queryFn: ({ signal }) =>
			read(
				`/connections/${connectionId}/projects?cursor=${cursor}`,
				pageOf(ProjectView),
				signal,
			),
	});
	return (
		<Card>
			<CardHeader>
				<CardTitle>{name}</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{catalog.isPending && <Status>Loading project catalog…</Status>}
				{catalog.error && <Status>{catalog.error.message}</Status>}
				{catalog.data?.items.map((project) => (
					<div key={project.id} className="rounded-xl border p-4">
						<Link className="underline" to={`/projects/${project.id}`}>
							{project.name}
						</Link>
						<p className="text-sm text-muted-foreground">
							Synthetic source · {project.resourceType} ·{' '}
							{project.breadcrumb.join(' / ')}
						</p>
					</div>
				))}
				{catalog.data?.items.length === 0 && <p>No accessible projects.</p>}
				<div className="flex gap-2">
					{cursor !== '0' && (
						<Button variant="outline" onClick={() => setCursor('0')}>
							First page
						</Button>
					)}
					{catalog.data?.nextCursor && (
						<Button
							variant="outline"
							onClick={() => setCursor(catalog.data!.nextCursor!)}
						>
							Next projects
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

export function ProjectsPage() {
	const identity = useSyncExternalStore(auth.subscribe, auth.snapshot);
	const connections = useQuery({
		queryKey: [identity?.user.id, 'connections'],
		enabled: !!identity,
		queryFn: ({ signal }) =>
			read('/connections', zod.object({ items: zod.array(ConnectionView) }), signal),
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
						Add a demo source
					</Link>
					.
				</p>
			)}
			<div className="space-y-6">
				{identity &&
					connections.data?.items.map((connection) => (
						<Catalog
							key={connection.id}
							connectionId={connection.id}
							userId={identity.user.id}
							name={connection.displayName}
						/>
					))}
			</div>
		</AppShell>
	);
}
