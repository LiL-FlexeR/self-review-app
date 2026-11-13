import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useProject } from '@app/api/hooks/projects/use-project';
import { useJob } from '@app/api/hooks/jobs/use-job';
import { useReview } from '@app/api/hooks/reviews/use-review';
import { useProjectSyncs } from '@app/api/hooks/projects/use-project-syncs';
import { useProjectSnapshot } from '@app/api/hooks/projects/use-project-snapshot';
import { useSnapshotPeriod } from '@app/api/hooks/projects/use-snapshot-period';
import { useProjectTasks } from '@app/api/hooks/projects/use-project-tasks';
import { useProjectCommand } from '@app/api/hooks/projects/use-project-command';
import { useJobStream } from '@app/hooks/use-job-stream';
import { snapshotForDisplay } from './snapshot-reader';

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
	const [search, setSearch] = useSearchParams();
	const [startDate, setStart] = useState('2026-10-01');
	const [endDate, setEnd] = useState('2026-10-31');
	const [generateReview, setGenerate] = useState(false);
	const [tab, setTab] = useState('overview');
	const [syncOpen, setSyncOpen] = useState(false);
	const [scope, setScope] = useState(() => createSnapshotScope(undefined));

	const [acceptedId, setAcceptedId] = useState<string>();
	const project = useProject(id, userId);
	const active = project.data?.runs.find((run) => ['queued', 'running'].includes(run.state));
	// Retain an observed automatic child after it leaves the active-run preview.
	if (active && active.runId !== acceptedId) {
		setAcceptedId(active.runId);
	}
	const runId = active?.runId ?? acceptedId;
	const job = useJob(runId, userId);
	const stream = useJobStream(runId, userId, id);
	const resultReportId = job.data?.type === 'review' ? job.data.resultRef : null;
	const completedReport = useReview(
		resultReportId,
		userId,
		hasIdentity && !!resultReportId && ['succeeded', 'partial'].includes(job.data?.state ?? ''),
	);
	const history = useProjectSyncs(id, userId);
	const syncs = history.data?.pages.flatMap((page) => page.items) ?? [];
	const snapshotId =
		search.get('snapshot') ??
		project.data?.latestSuccessfulSync?.runId ??
		syncs.find((run) => run.state === 'partial')?.runId;
	const selectedSnapshot = useProjectSnapshot(id, snapshotId, userId);
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
	const period = useSnapshotPeriod(id, snapshotId, snapshot, userId);
	const selectSnapshot = (nextId: string) => {
		setSearch((previous) => {
			const next = new URLSearchParams(previous);
			next.set('snapshot', nextId);
			return next;
		});
	};
	const automaticReviewId = snapshot?.reviewRunId;
	const automaticReview = useJob(automaticReviewId, userId, !!automaticReviewId && hasIdentity);

	const reportId = snapshot?.currentReviewReportId;
	const report = useReview(reportId, userId);

	const tasks = useProjectTasks(id, snapshotId, cursor, userId, !!snapshot && hasIdentity);
	const mutation = useProjectCommand(id, userId, (runId) => {
		setAcceptedId(runId);
		setRefreshOpen(false);
		setSelected([]);
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
		completedReport,
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
