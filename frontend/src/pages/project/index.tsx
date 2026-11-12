import { useRef, useState, useSyncExternalStore } from 'react';
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'react-router';
import { AcceptedJob, ProjectDetail, TaskView, pageOf, JobView } from '@self-review/contracts';
import { auth, queryClient } from '@app/auth/session';
import { read, command } from '@app/lib/api';
import { useJobStream } from '@app/hooks/use-job-stream';
import { TraceView } from '@app/pages/project/components/TraceView';
import { AppShell } from '@app/components/templates/AppShell';
import { Card, CardHeader, CardTitle, CardContent } from '@app/components/ui/Card';
import { Button } from '@app/components/ui/Button';
import { Input } from '@app/components/ui/Input';
import { Label } from '@app/components/ui/Label';
import { Status } from '@app/components/ui/Status';
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetDescription,
} from '@app/components/ui/Sheet';
import { TaskDetails } from '@app/pages/project/components/TaskDetails';
import { ReportView } from '@app/pages/project/components/ReportView';

export function ProjectPage() {
	const { id = '' } = useParams();
	const identity = useSyncExternalStore(auth.subscribe, auth.snapshot);
	const userId = identity?.user.id;
	const key = [userId, 'project', id];
	const [search, setSearch] = useSearchParams();
	const [startDate, setStart] = useState('2026-10-01');
	const [endDate, setEnd] = useState('2026-10-31');
	const [generateReview, setGenerate] = useState(false);
	const [allowPartial, setAllowPartial] = useState(false);
	const [selected, setSelected] = useState<string[]>([]);
	const [refreshOpen, setRefreshOpen] = useState(false);
	const [selectedAuto, setSelectedAuto] = useState(false);
	const [cursor, setCursor] = useState('0');
	const [detailId, setDetail] = useState<string>();
	const [acceptedId, setAcceptedId] = useState<string>();
	const pendingCommand = useRef<{ fingerprint: string; key: string } | null>(null);
	const project = useQuery({
		queryKey: key,
		enabled: !!identity,
		queryFn: ({ signal }) => read(`/projects/${id}`, ProjectDetail, signal),
	});
	const active = project.data?.runs.find((run) => ['queued', 'running'].includes(run.state));
	const runId = active?.runId ?? acceptedId;
	const job = useQuery({
		queryKey: [userId, 'job', runId],
		enabled: !!runId,
		queryFn: ({ signal }) => read(`/jobs/${runId}`, JobView, signal),
	});
	const stream = useJobStream(runId, userId, id);
	const history = useInfiniteQuery({
		queryKey: [...key, 'history'],
		enabled: !!identity,
		initialPageParam: '0',
		queryFn: ({ signal, pageParam }) =>
			read(`/projects/${id}/syncs?cursor=${pageParam}`, pageOf(JobView), signal),
		getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
	});
	const syncs = history.data?.pages.flatMap((page) => page.items) ?? [];
	const snapshotId =
		search.get('snapshot') ??
		project.data?.latestSuccessfulSync?.runId ??
		syncs.find((run) => run.state === 'partial')?.runId;
	const selectedSnapshot = useQuery({
		queryKey: [userId, 'job', snapshotId],
		enabled: !!snapshotId && !!identity,
		queryFn: ({ signal }) => read(`/jobs/${snapshotId}`, JobView, signal),
	});
	const snapshot = selectedSnapshot.data ?? syncs.find((run) => run.runId === snapshotId);
	const automaticReviewId = snapshot?.reviewRunId;
	const automaticReview = useQuery({
		queryKey: [userId, 'job', automaticReviewId],
		enabled: !!automaticReviewId && !!identity,
		queryFn: ({ signal }) => read(`/jobs/${automaticReviewId}`, JobView, signal),
	});

	const tasks = useQuery({
		queryKey: [...key, 'tasks', snapshotId, cursor],
		enabled: !!snapshotId && !!identity,
		queryFn: ({ signal }) =>
			read(
				`/projects/${id}/tasks?syncRunId=${snapshotId}&cursor=${cursor}`,
				pageOf(TaskView),
				signal,
			),
	});
	const mutation = useMutation({
		mutationFn: async ({ action, body }: { action: 'syncs' | 'reviews'; body: object }) => {
			const fingerprint = JSON.stringify({ action, body });
			if (pendingCommand.current?.fingerprint !== fingerprint) {
				pendingCommand.current = { fingerprint, key: crypto.randomUUID() };
			}
			return command(
				`/projects/${id}/${action}`,
				{ ...body, idempotencyKey: pendingCommand.current!.key },
				AcceptedJob,
			);
		},
		onSuccess: async (result) => {
			pendingCommand.current = null;
			setAcceptedId(result.runId);
			setRefreshOpen(false);
			setSelected([]);
			await queryClient.invalidateQueries({ queryKey: key });
		},
	});
	const busy = mutation.isPending || !!active;
	const startSync = () =>
		mutation.mutate({
			action: 'syncs',
			body: { selection: { mode: 'period', startDate, endDate }, generateReview },
		});
	return (
		<AppShell
			title={project.data?.name ?? 'Project'}
			description="Synchronize current source snapshots and prepare a traceable self-review."
		>
			{project.isPending && <Status>Loading owned project…</Status>}
			{project.error && <Status>{project.error.message}</Status>}
			{project.data && (
				<div className="space-y-6">
					<p className="text-sm text-muted-foreground">
						{project.data.connection.displayName} ·{' '}
						{project.data.connection.mode === 'fixture'
							? 'synthetic fixture data'
							: 'live tracker data'}{' '}
						· {project.data.connection.modelMode} model
						<br />
						Tracker token owner / review subject:{' '}
						{project.data.connection.sourceUserName} (
						{project.data.connection.sourceUserId})
					</p>
					<Card>
						<CardHeader>
							<CardTitle>Synchronize project</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<p className="text-sm text-muted-foreground">
								All statuses and assignees, selected by task creation dates in UTC.
								Current data is not a historical work log. Sync analysis uses the
								configured model.
							</p>
							<form
								onSubmit={(event) => {
									event.preventDefault();
									startSync();
								}}
								className="space-y-4"
							>
								<div className="grid gap-4 sm:grid-cols-2">
									<div className="space-y-2">
										<Label htmlFor="start">Start date (UTC)</Label>
										<Input
											id="start"
											type="date"
											required
											value={startDate}
											onChange={(event) => setStart(event.target.value)}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="end">End date, inclusive (UTC)</Label>
										<Input
											id="end"
											type="date"
											required
											min={startDate}
											value={endDate}
											onChange={(event) => setEnd(event.target.value)}
										/>
									</div>
								</div>
								<label className="flex items-center gap-3">
									<input
										type="checkbox"
										checked={generateReview}
										onChange={(event) => setGenerate(event.target.checked)}
									/>
									Create self-review after synchronization
								</label>
								<Button disabled={busy}>Synchronize</Button>
							</form>
							{mutation.error && <Status>{mutation.error.message}</Status>}
						</CardContent>
					</Card>
					{runId && (
						<Card>
							<CardContent className="space-y-3 pt-6">
								<Status>{stream.status || 'Checking persisted progress…'}</Status>
								{job.data && (
									<p className="text-sm">
										{job.data.type}: {job.data.state} · {job.data.stage} · saved{' '}
										{job.data.counts.saved} · batches {job.data.counts.batches}
										{job.data.errorCode && <> · {job.data.errorCode}</>}
										{job.data.type === 'sync' && job.data.autoReview && (
											<> · automatic review: {job.data.autoReview}</>
										)}
									</p>
								)}
								<p className="break-all text-xs">Run: {runId}</p>
								{job.data?.warnings?.map((warning) => (
									<Status key={warning}>{warning}</Status>
								))}
								<Button variant="outline" onClick={stream.reconnect}>
									Reconnect
								</Button>
							</CardContent>
						</Card>
					)}
					<Card>
						<CardHeader>
							<CardTitle>Snapshot history</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							{history.isPending && <Status>Loading snapshot history…</Status>}
							{history.error && <Status>{history.error.message}</Status>}
							{history.data && !syncs.length && <p>No saved snapshots yet.</p>}
							<div className="flex flex-col gap-2">
								{syncs.map((run) => (
									<Button
										key={run.runId}
										variant={run.runId === snapshotId ? 'default' : 'outline'}
										onClick={() => {
											setSearch({ snapshot: run.runId });
											setCursor('0');
											setSelected([]);
										}}
									>
										{run.state} · {run.runId.slice(0, 8)}
									</Button>
								))}
							</div>
							{history.hasNextPage && (
								<Button
									variant="outline"
									disabled={history.isFetchingNextPage}
									onClick={() => {
										void history.fetchNextPage();
									}}
								>
									Load more snapshots
								</Button>
							)}
						</CardContent>
					</Card>
					{snapshotId && (
						<Card>
							<CardHeader>
								<CardTitle>Tasks in this snapshot</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<p className="break-all text-xs">
									Snapshot {snapshotId} · {JSON.stringify(snapshot?.selection)}
								</p>
								{snapshot?.state === 'partial' && (
									<Status>
										Partial snapshot: some required data or analysis is
										incomplete.
									</Status>
								)}
								<p className="text-sm">
									Discovery: {String(snapshot?.discoveryComplete)} · Import:{' '}
									{String(snapshot?.importComplete)} · Analysis:{' '}
									{String(snapshot?.analysisComplete)}
								</p>
								{snapshot && (
									<Status>
										Synchronization: {snapshot.state}. Automatic self-review:{' '}
										{automaticReviewId
											? (automaticReview.data?.state ??
												'loading saved outcome…')
											: (snapshot.autoReview ?? 'not requested')}
										{automaticReview.data?.errorCode && (
											<> · {automaticReview.data.errorCode}</>
										)}
										{automaticReview.error && (
											<> · {automaticReview.error.message}</>
										)}
									</Status>
								)}
								{tasks.isPending && <Status>Loading saved tasks…</Status>}
								{tasks.error && <Status>{tasks.error.message}</Status>}
								{tasks.data?.items.length === 0 && (
									<p>No tasks saved in this period.</p>
								)}
								<div
									className="max-w-full overflow-x-auto"
									tabIndex={0}
									role="region"
									aria-label="Snapshot task table"
								>
									<table className="w-full min-w-[620px] text-left text-sm">
										<thead>
											<tr className="border-b">
												<th className="p-2">Select</th>
												<th className="p-2">Task</th>
												<th className="p-2">Status / assignees</th>
												<th className="p-2">Created / freshness</th>
											</tr>
										</thead>
										<tbody>
											{tasks.data?.items.map((task) => (
												<tr key={task.id} className="border-b align-top">
													<td className="p-2">
														<input
															aria-label={`Select ${task.identifier}`}
															type="checkbox"
															checked={selected.includes(task.id)}
															onChange={(event) =>
																setSelected((previous) =>
																	event.target.checked
																		? [...previous, task.id]
																		: previous.filter(
																				(taskId) =>
																					taskId !==
																					task.id,
																			),
																)
															}
														/>
													</td>
													<td className="p-2">
														<button
															type="button"
															className="text-left underline"
															onClick={() => setDetail(task.id)}
														>
															{task.identifier} · {task.title}
														</button>
														{task.safeUrl && (
															<a
																href={task.safeUrl}
																target="_blank"
																rel="noreferrer"
																className="mt-1 block underline"
															>
																Open tracker task
															</a>
														)}
													</td>
													<td className="p-2">
														{task.state}
														<br />
														{task.assignees.join(', ') || 'Unassigned'}
													</td>
													<td className="p-2">
														{task.sourceCreatedAt.slice(0, 10)}
														<br />
														{task.refreshStatus} · {task.detailStatus}
														<br />
														{task.retrievedAt}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
								<div className="flex flex-wrap gap-2">
									{cursor !== '0' && (
										<Button
											variant="outline"
											onClick={() =>
												setCursor(String(Math.max(0, Number(cursor) - 20)))
											}
										>
											Previous tasks
										</Button>
									)}
									{tasks.data?.nextCursor && (
										<Button
											variant="outline"
											onClick={() => setCursor(tasks.data!.nextCursor!)}
										>
											Next tasks
										</Button>
									)}
									<Button
										variant="outline"
										disabled={busy || !selected.length}
										onClick={() => {
											setSelectedAuto(false);
											setRefreshOpen(true);
										}}
									>
										Refresh selected ({selected.length})
									</Button>
								</div>
								{snapshot?.state === 'partial' && (
									<label className="flex items-center gap-3">
										<input
											type="checkbox"
											checked={allowPartial}
											onChange={(event) =>
												setAllowPartial(event.target.checked)
											}
										/>
										I accept incomplete source coverage for this review.
									</label>
								)}
								<Button
									disabled={
										busy ||
										!snapshot ||
										!['succeeded', 'partial'].includes(snapshot.state) ||
										(snapshot.state === 'partial' && !allowPartial)
									}
									onClick={() =>
										mutation.mutate({
											action: 'reviews',
											body: { syncRunId: snapshotId, allowPartial },
										})
									}
								>
									{snapshot?.currentReviewReportId
										? 'Regenerate self-review'
										: 'Create self-review'}
								</Button>
								<p className="text-sm text-muted-foreground">
									Generation creates a new version and may incur model usage. The
									previous valid report stays available if generation fails.
								</p>
							</CardContent>
						</Card>
					)}
					{snapshotId && userId && (
						<TraceView key={snapshotId} runId={snapshotId} userId={userId} />
					)}
					{snapshot?.currentReviewReportId && userId && (
						<ReportView id={snapshot.currentReviewReportId} userId={userId} />
					)}
				</div>
			)}
			<Sheet open={refreshOpen} onOpenChange={setRefreshOpen}>
				<SheetContent>
					<SheetHeader>
						<SheetTitle>Refresh selected tasks</SheetTitle>
						<SheetDescription>
							{selected.length} tasks will be reread. Other tasks retain their
							original retrieval times in a new snapshot. Base: {snapshotId}.
						</SheetDescription>
					</SheetHeader>
					<div className="space-y-4 p-4">
						<label className="flex items-center gap-3">
							<input
								type="checkbox"
								checked={selectedAuto}
								onChange={(event) => setSelectedAuto(event.target.checked)}
							/>
							Create self-review after synchronization
						</label>
						<Button
							disabled={busy}
							onClick={() =>
								mutation.mutate({
									action: 'syncs',
									body: {
										selection: {
											mode: 'tasks',
											baseSyncRunId: snapshotId,
											taskIds: selected,
										},
										generateReview: selectedAuto,
									},
								})
							}
						>
							Confirm refresh
						</Button>
						{mutation.error && <Status>{mutation.error.message}</Status>}
					</div>
				</SheetContent>
			</Sheet>
			<Sheet
				open={!!detailId}
				onOpenChange={(open) => {
					if (!open) {
						setDetail(undefined);
					}
				}}
			>
				<SheetContent className="overflow-y-auto">
					<SheetHeader>
						<SheetTitle>Saved task details</SheetTitle>
						<SheetDescription>
							Snapshot evidence and comments actually read.
						</SheetDescription>
					</SheetHeader>
					{detailId && userId && <TaskDetails id={detailId} userId={userId} />}
				</SheetContent>
			</Sheet>
		</AppShell>
	);
}
