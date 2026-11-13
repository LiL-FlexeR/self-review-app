import { useSyncExternalStore } from 'react';
import { useParams } from 'react-router';
import { auth } from '@app/auth/session';
import { canRetainSavedRead } from '@app/lib/api';
import { AppShell } from '@app/components/templates/AppShell';
import { Status } from '@app/components/ui/Status';
import { ProjectHeader } from '@app/pages/project/components/ProjectHeader';
import { WorkspaceTabs } from '@app/pages/project/components/WorkspaceTabs';
import { WorkspacePanels } from '@app/pages/project/components/WorkspacePanels';
import { SyncProgress } from '@app/pages/project/components/SyncProgress';
import { useProjectWorkspace } from './use-project-workspace';
import { ErrorState } from '@app/components/templates/ErrorState';
import { LoadingState } from '@app/components/templates/LoadingState';

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
	const savedProject = canRetainSavedRead(project.error) ? project.data : undefined;
	const hasResult = job.data && ['succeeded', 'partial'].includes(job.data.state);
	const resultReport = canRetainSavedRead(workspace.completedReport.error)
		? workspace.completedReport.data
		: undefined;
	const canViewResult =
		hasResult &&
		(job.data?.type === 'sync' || (!!resultReport && resultReport.id === job.data?.resultRef));
	const viewResult = () => {
		if (!job.data || !canViewResult) {
			return;
		}
		if (job.data.type === 'review' && !resultReport) {
			return;
		}
		const resultSnapshotId =
			job.data.type === 'sync' ? job.data.runId : resultReport?.sourceSyncRunId;
		if (!resultSnapshotId) {
			return;
		}
		workspace.selectSnapshot(resultSnapshotId);
		workspace.setTab(job.data.type === 'sync' ? 'tasks' : 'review');
	};
	return (
		<AppShell
			contentWidth="workspace"
			title={savedProject?.name ?? 'Project'}
			description="Saved evidence and a traceable self-review for your verified tracker identity."
		>
			{project.isPending && <LoadingState reserveSpace>Loading owned project…</LoadingState>}
			{project.error && (
				<ErrorState
					error={project.error}
					title="Project unavailable"
					onRetry={() => void project.refetch()}
					retryLabel="Retry saved project"
					isRetrying={project.isFetching}
				/>
			)}
			{savedProject && (
				<div className="min-w-0 space-y-6">
					<ProjectHeader workspace={workspace} />
					{runId && (
						<SyncProgress
							job={job.data}
							connection={stream.connection}
							message={stream.status}
							onReconnect={stream.reconnect}
							error={job.error?.message}
							onViewResult={canViewResult ? viewResult : undefined}
						/>
					)}
					{snapshot?.state === 'partial' && (
						<Status variant="warning" announce={false}>
							Partial snapshot: required coverage is incomplete. Discovery:{' '}
							{snapshot.discoveryComplete ? 'complete' : 'incomplete'}; import:{' '}
							{snapshot.importComplete ? 'complete' : 'incomplete'}; analysis:{' '}
							{snapshot.analysisComplete ? 'complete' : 'incomplete'}.
						</Status>
					)}
					{snapshot?.state === 'failed' && (
						<Status variant="error" announce={false}>
							This snapshot failed
							{snapshot.errorCode ? `: ${snapshot.errorCode}` : '.'} Previous
							snapshots remain available in the selector.
						</Status>
					)}
					{snapshot?.autoReview && (
						<p className="text-sm text-muted-foreground">
							Selected snapshot · automatic self-review:{' '}
							{automaticReviewId
								? (automaticReview.data?.state ?? 'loading saved outcome…')
								: snapshot.autoReview}
							{automaticReview.data?.errorCode &&
								` · ${automaticReview.data.errorCode}`}
							{automaticReview.error && ` · ${automaticReview.error.message}`}
						</p>
					)}
					{mutation.error && !workspace.refreshOpen && (
						<Status variant="error">{mutation.error.message}</Status>
					)}
					{mutation.isPending && !workspace.refreshOpen && (
						<p role="status" className="text-sm text-muted-foreground">
							Submitting command… Conflicting starts are disabled until its saved
							outcome is known.
						</p>
					)}
					{workspace.completedReport.error && hasResult && (
						<ErrorState
							error={workspace.completedReport.error}
							title="Result navigation unavailable"
							onRetry={() => void workspace.completedReport.refetch()}
							retryLabel="Retry saved result"
							isRetrying={workspace.completedReport.isFetching}
						>
							The execution outcome is saved. Other snapshots and reports remain
							available.
						</ErrorState>
					)}
					<WorkspaceTabs workspace={workspace} />
				</div>
			)}
			{savedProject && <WorkspacePanels workspace={workspace} />}
		</AppShell>
	);
}
