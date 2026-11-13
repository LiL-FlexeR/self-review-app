import { expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import type { TJobView } from '@self-review/contracts';
import { formatPeriod } from '@app/pages/project/snapshot-period';
import { MAX_PERIOD_LOOKUPS, resolveSnapshotPeriod } from '@app/api/hooks/projects/snapshot-period';

const period = { mode: 'period', startDate: '2026-10-01', endDate: '2026-10-31' } as const;
function snapshot(index: number, selection: unknown = period): TJobView {
	return {
		runId: `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`,
		type: 'sync',
		state: 'succeeded',
		stage: 'finished',
		version: 1,
		counts: {},
		discoveryComplete: true,
		importComplete: true,
		analysisComplete: true,
		resultRef: null,
		errorCode: null,
		warningsCount: 0,
		autoReview: null,
		reviewRunId: null,
		currentReviewReportId: null,
		selection,
		usage: {},
	};
}
function refresh(index: number, base: number) {
	return snapshot(index, {
		mode: 'tasks',
		baseSyncRunId: snapshot(base).runId,
		taskIds: [snapshot(99).runId],
	});
}

it('formats saved inclusive date ranges in UTC, including leap days and year boundaries', async () => {
	const load = vi.fn();
	expect(await resolveSnapshotPeriod(snapshot(1), load)).toEqual(period);
	expect(load).not.toHaveBeenCalled();
	expect(formatPeriod(period)).toMatch(/Oct 1.+31, 2026 · UTC/);
	expect(formatPeriod({ mode: 'period', startDate: '2024-02-29', endDate: '2024-02-29' })).toBe(
		'Feb 29, 2024 · UTC',
	);
	expect(
		formatPeriod({ mode: 'period', startDate: '2025-12-31', endDate: '2026-01-01' }),
	).toMatch(/Dec 31, 2025.+Jan 1, 2026 · UTC/);
});

it('inherits a period through owned base reads without changing the selected snapshot', async () => {
	const current = refresh(3, 2);
	const load = vi.fn(async (runId: string) =>
		runId === snapshot(2).runId ? refresh(2, 1) : snapshot(1),
	);
	expect(await resolveSnapshotPeriod(current, load)).toEqual(period);
	expect(load.mock.calls.map(([runId]) => runId)).toEqual([snapshot(2).runId, snapshot(1).runId]);
	expect(current.selection).toEqual(refresh(3, 2).selection);
});

it.each([
	{},
	{ mode: 'period', startDate: '2026-02-30', endDate: '2026-03-01' },
	{ ...period, endDate: '2026-09-30' },
	{ ...period, extra: true },
	{ mode: 'tasks', baseSyncRunId: 'invalid', taskIds: [] },
])('rejects malformed or invalid saved selections: %j', async (selection) => {
	const load = vi.fn();
	await expect(resolveSnapshotPeriod(snapshot(1, selection), load)).rejects.toThrow(
		'invalid saved selection',
	);
	expect(load).not.toHaveBeenCalled();
});

it('rejects cycles and bounds base reads independently of task count', async () => {
	const cycle = vi.fn(async () => refresh(2, 1));
	await expect(resolveSnapshotPeriod(refresh(1, 2), cycle)).rejects.toThrow('cyclic');
	expect(cycle).toHaveBeenCalledTimes(1);
	const load = vi.fn(async (runId: string) => {
		const index = Number(runId.slice(-12));
		return refresh(index, index + 1);
	});
	await expect(resolveSnapshotPeriod(refresh(1, 2), load)).rejects.toThrow('lookup limit');
	expect(load.mock.calls.length).toBeLessThanOrEqual(MAX_PERIOD_LOOKUPS);
});

it('keeps inaccessible, wrong-scope, failed and non-sync bases unavailable', async () => {
	await expect(
		resolveSnapshotPeriod(refresh(2, 1), async () => {
			throw new Error('Resource not found.');
		}),
	).rejects.toThrow('Resource not found.');
	for (const base of [
		snapshot(3),
		{ ...snapshot(1), state: 'failed' as const },
		{ ...snapshot(1), type: 'review' as const },
	]) {
		await expect(resolveSnapshotPeriod(refresh(2, 1), async () => base)).rejects.toThrow(
			'invalid',
		);
	}
});

it('disregards a late base response after cancellation and never replaces another snapshot cache', async () => {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	const oldKey = ['synthetic-user', 'project', 'project-a', 'period', snapshot(2).runId];
	const newKey = ['synthetic-user', 'project', 'project-a', 'period', snapshot(3).runId];
	let release!: (job: TJobView) => void;
	const pending = client.fetchQuery({
		queryKey: oldKey,
		queryFn: ({ signal }) =>
			resolveSnapshotPeriod(
				refresh(2, 1),
				() =>
					new Promise((resolve) => {
						release = resolve;
					}),
				signal,
			),
	});
	const rejected = expect(pending).rejects.toThrow();
	await client.cancelQueries({ queryKey: oldKey });
	client.setQueryData(newKey, { ...period, startDate: '2026-10-10' });
	release(snapshot(1));
	await rejected;
	await Promise.resolve();
	expect(client.getQueryData(oldKey)).toBeUndefined();
	expect(client.getQueryData(newKey)).toEqual({ ...period, startDate: '2026-10-10' });
	client.clear();
});
