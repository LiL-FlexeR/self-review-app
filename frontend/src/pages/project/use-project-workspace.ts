import { useRef, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import {
	AcceptedJob,
	ProjectDetail,
	TaskView,
	pageOf,
	JobView,
	ReviewView,
} from '@self-review/contracts';
import { queryClient } from '@app/auth/session';
import { read, command } from '@app/lib/api';
import { useJobStream } from '@app/hooks/use-job-stream';
import { resolveSnapshotPeriod } from './snapshot-period';
import { readProjectSnapshot, snapshotForDisplay } from './snapshot-reader';

interface ISnapshotScope {
	snapshotId: string | undefined;
	selected: string[];
	cursor: string;
	detailId: string | undefined;
	allowPartial: boolean;
	refreshOpen: boolean;
	selectedAuto: boolean;
}

function createSnapshotScope(snapshotId: string | undefined): ISnapshotScope {
	return {
		snapshotId,
		selected: [],
		cursor: '0',
		detailId: undefined,
		allowPartial: false,
		refreshOpen: false,
		selectedAuto: false,
	};
}

export function useProjectWorkspace(id: string, userId: string | undefined) {
	const hasIdentity = !!userId;
	const key = [userId, 'project', id];
	const [search, setSearch] = useSearchParams();
	const [startDate, setStart] = useState('2026-10-01');
	const [endDate, setEnd] = useState('2026-10-31');
	const [generateReview, setGenerate] = useState(false);
	const [tab, setTab] = useState('overview');
	const [syncOpen, setSyncOpen] = useState(false);
	const [scope, setScope] = useState(() => createSnapshotScope(undefined));

	const [acceptedId, setAcceptedId] = useState<string>();
	const pendingCommand = useRef<{ fingerprint: string; key: string } | null>(null);
	const project = useQuery({
		queryKey: key,
		enabled: hasIdentity,
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
		enabled: hasIdentity,
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
		queryKey: [...key, 'snapshot', snapshotId],
		enabled: !!snapshotId && hasIdentity,
		queryFn: ({ signal }) => readProjectSnapshot(id, snapshotId!, signal),
	});
	const snapshot = snapshotForDisplay(selectedSnapshot.data, selectedSnapshot.error);
	if (scope.snapshotId !== snapshotId) {
		setScope(createSnapshotScope(snapshotId));
	}
	const { selected, cursor, detailId, allowPartial, refreshOpen, selectedAuto } = scope;
	const updateScope = (update: Partial<ISnapshotScope>) =>
		setScope((previous) => ({ ...previous, ...update }));
	const setSelected = (update: string[] | ((previous: string[]) => string[])) =>
		setScope((previous) => ({
			...previous,
			selected: typeof update === 'function' ? update(previous.selected) : update,
		}));
	const setCursor = (cursor: string) => updateScope({ cursor });
	const setDetail = (detailId: string | undefined) => updateScope({ detailId });
	const setAllowPartial = (allowPartial: boolean) => updateScope({ allowPartial });
	const setRefreshOpen = (refreshOpen: boolean) => updateScope({ refreshOpen });
	const setSelectedAuto = (selectedAuto: boolean) => updateScope({ selectedAuto });
	const period = useQuery({
		queryKey: [...key, 'period', snapshotId],
		enabled: !!snapshot && hasIdentity,
		retry: false,
		queryFn: ({ signal }) => {
			if (!snapshot) {
				throw new Error('Load an accessible snapshot before resolving its period.');
			}
			return resolveSnapshotPeriod(
				snapshot,
				(baseId, baseSignal) => read(`/jobs/${baseId}`, JobView, baseSignal),
				signal,
			);
		},
	});
	const selectSnapshot = (nextId: string) => {
		setSearch((previous) => {
			const next = new URLSearchParams(previous);
			next.set('snapshot', nextId);
			return next;
		});
	};
	const automaticReviewId = snapshot?.reviewRunId;
	const automaticReview = useQuery({
		queryKey: [userId, 'job', automaticReviewId],
		enabled: !!automaticReviewId && hasIdentity,
		queryFn: ({ signal }) => read(`/jobs/${automaticReviewId}`, JobView, signal),
	});

	const reportId = snapshot?.currentReviewReportId;
	const report = useQuery({
		queryKey: [userId, 'report', reportId],
		enabled: !!reportId && hasIdentity,
		queryFn: ({ signal }) => read(`/reviews/${reportId}`, ReviewView, signal),
	});

	const tasks = useQuery({
		queryKey: [...key, 'tasks', snapshotId, cursor],
		enabled: !!snapshot && hasIdentity,
		queryFn: ({ signal }) =>
			read(
				`/projects/${id}/tasks?syncRunId=${snapshotId}&cursor=${cursor}`,
				pageOf(TaskView),
				signal,
			),
	});
	const mutation = useMutation({
		retry: false,
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
	const busy =
		mutation.isPending ||
		!!active ||
		(!!acceptedId && job.isPending) ||
		(!!job.data && ['queued', 'running'].includes(job.data.state));
	const startSync = () =>
		mutation.mutate({
			action: 'syncs',
			body: { selection: { mode: 'period', startDate, endDate }, generateReview },
		});
	return {
		id,
		userId,
		project,
		active,
		runId,
		job,
		stream,
		history,
		syncs,
		snapshotId,
		selectedSnapshot,
		snapshot,
		automaticReviewId,
		automaticReview,
		report,
		tasks,
		mutation,
		busy,
		startSync,
		startDate,
		setStart,
		endDate,
		setEnd,
		generateReview,
		setGenerate,
		selected,
		setSelected,
		cursor,
		setCursor,
		detailId,
		setDetail,
		allowPartial,
		setAllowPartial,
		refreshOpen,
		setRefreshOpen,
		selectedAuto,
		setSelectedAuto,
		period,
		selectSnapshot,
		tab,
		setTab,
		syncOpen,
		setSyncOpen,
	};
}

export type TProjectWorkspace = ReturnType<typeof useProjectWorkspace>;
