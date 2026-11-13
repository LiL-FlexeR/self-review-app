import { afterEach, expect, it, vi } from 'vitest';
import { read } from '@app/lib/api';
import { readProjectSnapshot, snapshotForDisplay } from './snapshot-reader';
import type { TJobView } from '@self-review/contracts';
import { ClientError } from '@app/auth/coordinator';

vi.mock('@app/lib/api', () => ({ read: vi.fn() }));
const snapshotId = '11111111-1111-4111-8111-111111111111';
const snapshot = { runId: snapshotId, type: 'sync' };
afterEach(() => {
	vi.resetAllMocks();
});

it('requires the project-scoped saved task read before exposing job metadata', async () => {
	vi.mocked(read)
		.mockResolvedValueOnce(snapshot)
		.mockResolvedValueOnce({ items: [], nextCursor: null });
	expect(await readProjectSnapshot('owned-project', snapshotId)).toEqual(snapshot);
	expect(vi.mocked(read).mock.calls.map(([path]) => path)).toEqual([
		`/jobs/${snapshotId}`,
		`/projects/owned-project/tasks?syncRunId=${snapshotId}&cursor=0`,
	]);
});

it('keeps an owned snapshot from a different project unavailable without fallback', async () => {
	vi.mocked(read)
		.mockResolvedValueOnce(snapshot)
		.mockRejectedValueOnce(new Error('Resource not found.'));
	await expect(readProjectSnapshot('other-project', snapshotId)).rejects.toThrow(
		'Resource not found.',
	);
	expect(read).toHaveBeenCalledTimes(2);
});

it.each([
	{ ...snapshot, type: 'review' },
	{ ...snapshot, runId: 'wrong-run' },
])('rejects a wrong-type or mismatched job before reading task context', async (response) => {
	vi.mocked(read).mockResolvedValueOnce(response);
	await expect(readProjectSnapshot('owned-project', snapshotId)).rejects.toThrow(
		'requested synchronization snapshot',
	);
	expect(read).toHaveBeenCalledTimes(1);
});

it('disregards a late project-scope response after navigation cancels the read', async () => {
	const controller = new AbortController();
	let release!: (value: unknown) => void;
	vi.mocked(read)
		.mockResolvedValueOnce(snapshot)
		.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					release = resolve;
				}),
		);
	const pending = readProjectSnapshot('owned-project', snapshotId, controller.signal);
	await Promise.resolve();
	controller.abort();
	release({ items: [], nextCursor: null });
	await expect(pending).rejects.toThrow();
	expect(vi.mocked(read).mock.calls.every(([, , signal]) => signal === controller.signal)).toBe(
		true,
	);
});

const cachedSnapshot: TJobView = {
	runId: snapshotId,
	type: 'sync',
	state: 'succeeded',
	stage: 'finished',
	version: 1,
	counts: { saved: 6 },
	discoveryComplete: true,
	importComplete: true,
	analysisComplete: true,
	resultRef: null,
	errorCode: null,
	warningsCount: 0,
	autoReview: null,
	reviewRunId: null,
	currentReviewReportId: null,
	selection: {},
	usage: {},
};

it('retains only previously scoped snapshot data during retryable transport failures', () => {
	expect(snapshotForDisplay(cachedSnapshot, null)).toBe(cachedSnapshot);
	for (const status of [0, 503]) {
		const error = new ClientError(
			status,
			'NETWORK_UNAVAILABLE',
			'Connection unavailable.',
			true,
		);
		expect(snapshotForDisplay(cachedSnapshot, error)).toBe(cachedSnapshot);
		expect(snapshotForDisplay(undefined, error)).toBeUndefined();
	}
});

it('clears saved context on inaccessible, changed-session or invalid responses without substitution', () => {
	for (const error of [
		...[401, 403, 404].map(
			(status) => new ClientError(status, 'RESOURCE_NOT_FOUND', 'Resource not found.', true),
		),
		new ClientError(0, 'CONTEXT_CHANGED', 'Session changed.'),
		new Error('Invalid response.'),
	]) {
		expect(snapshotForDisplay(cachedSnapshot, error)).toBeUndefined();
	}
	expect(snapshotForDisplay({ ...cachedSnapshot, type: 'review' }, null)).toBeUndefined();
});
