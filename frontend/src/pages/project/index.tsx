import { useSyncExternalStore } from 'react';
import { useParams } from 'react-router';
import { auth } from '@app/auth/session';
import { AppShell } from '@app/components/templates/AppShell';
import { Status } from '@app/components/ui/Status';
import { ProjectHeader } from '@app/pages/project/components/ProjectHeader';
import { WorkspaceTabs } from '@app/pages/project/components/WorkspaceTabs';
import { WorkspacePanels } from '@app/pages/project/components/WorkspacePanels';
import { SyncProgress } from '@app/pages/project/components/SyncProgress';
import { useProjectWorkspace } from './use-project-workspace';

export function ProjectPage() {
	const { id = '' } = useParams();
	const identity = useSyncExternalStore(auth.subscribe, auth.snapshot);
	return (
		<ProjectWorkspace
			key={`${identity?.user.id}:${identity?.sid}:${id}`}
			id={id}
			userId={identity?.user.id}
		/>
	);
}

function ProjectWorkspace({ id, userId }: { id: string; userId?: string }) {
	const workspace = useProjectWorkspace(id, userId);
	const { project, snapshot, job, runId, stream, mutation, automaticReview, automaticReviewId } =
		workspace;
	return (
		<AppShell
			contentWidth="workspace"
			title={project.data?.name ?? 'Project'}
			description="Saved evidence and a traceable self-review for your verified tracker identity."
		>
			{project.isPending && <Status variant="loading">Loading owned project…</Status>}
			{project.error && <Status variant="error">{project.error.message}</Status>}
			{project.data && (
				<div className="min-w-0 space-y-6">
					<ProjectHeader workspace={workspace} />
					{runId && (
						<SyncProgress
							job={job.data}
							connection={stream.connection}
							message={stream.status}
							onReconnect={stream.reconnect}
							error={job.error?.message}
						/>
					)}
					{snapshot?.state === 'partial' && (
						<Status variant="warning">
							Partial snapshot: required coverage is incomplete. Discovery:{' '}
							{snapshot.discoveryComplete ? 'complete' : 'incomplete'}; import:{' '}
							{snapshot.importComplete ? 'complete' : 'incomplete'}; analysis:{' '}
							{snapshot.analysisComplete ? 'complete' : 'incomplete'}.
						</Status>
					)}
					{snapshot?.state === 'failed' && (
						<Status variant="error">
							This snapshot failed
							{snapshot.errorCode ? `: ${snapshot.errorCode}` : '.'} Previous
							snapshots remain available in the selector.
						</Status>
					)}
					{snapshot?.autoReview && (
						<p className="text-sm text-muted-foreground">
							{automaticReviewId
								? 'Tasks saved; automatic self-review: '
								: 'Automatic self-review: '}
							{automaticReviewId
								? (automaticReview.data?.state ?? 'loading saved outcome…')
								: snapshot.autoReview}
							{automaticReview.data?.errorCode &&
								` · ${automaticReview.data.errorCode}`}
							{automaticReview.error && ` · ${automaticReview.error.message}`}
						</p>
					)}
					{mutation.error && <Status variant="error">{mutation.error.message}</Status>}
					{mutation.isPending && (
						<p role="status" className="text-sm text-muted-foreground">
							Submitting command… Conflicting starts are disabled until its saved
							outcome is known.
						</p>
					)}
					<WorkspaceTabs workspace={workspace} />
				</div>
			)}
			<WorkspacePanels workspace={workspace} />
		</AppShell>
	);
}
