import { afterEach, it, expect, vi } from 'vitest';
import { JobSubscription } from './job-subscription';
import { ClientError } from '@app/auth/coordinator';
import type { TJobView } from '@self-review/contracts';
const state: TJobView = {
	runId: '11111111-1111-4111-8111-111111111111',
	type: 'sync',
	state: 'running',
	stage: 'reading',
	version: 1,
	counts: { saved: 1 },
	discoveryComplete: false,
	importComplete: false,
	analysisComplete: false,
	resultRef: null,
	errorCode: null,
	warningsCount: 0,
	autoReview: null,
	reviewRunId: null,
	currentReviewReportId: null,
	selection: {},
	usage: {},
};
afterEach(() => {
	vi.useRealTimers();
});
it('deduplicates versions, closes on terminal state, and never submits a command', async () => {
	let callbacks:
		Parameters<ConstructorParameters<typeof JobSubscription>[0]['connect']>[0] | undefined;
	const close = vi.fn();
	const onState = vi.fn();
	const read = vi.fn(async () => state);
	const subscription = new JobSubscription({
		runId: state.runId,
		read,
		onState,
		onStatus: vi.fn(),
		connect: (listeners) => {
			callbacks = listeners;
			return close;
		},
	});
	await subscription.start();
	callbacks!.message(JSON.stringify(state));
	callbacks!.message(JSON.stringify({ ...state, version: 2, state: 'succeeded' }));
	expect(onState).toHaveBeenCalledTimes(2);
	expect(close).toHaveBeenCalled();
	expect(read).toHaveBeenCalledTimes(1);
	subscription.stop();
});
it('bounds transient recovery to 1/2/4 seconds and stops on inaccessible resources', async () => {
	vi.useFakeTimers();
	const read = vi.fn(async () => {
		throw new Error('network');
	});
	const onStatus = vi.fn();
	const subscription = new JobSubscription({
		runId: state.runId,
		read,
		onState: vi.fn(),
		onStatus,
		connect: vi.fn(),
	});
	await subscription.start();
	for (const delay of [1000, 2000, 4000]) {
		await vi.advanceTimersByTimeAsync(delay);
	}
	expect(read).toHaveBeenCalledTimes(4);
	expect(onStatus).toHaveBeenLastCalledWith(expect.stringContaining('Use Reconnect'));
	subscription.stop();
	const inaccessible = vi.fn(async () => {
		throw new ClientError(404, 'RESOURCE_NOT_FOUND', 'Resource not found.');
	});
	const other = new JobSubscription({
		runId: state.runId,
		read: inaccessible,
		onState: vi.fn(),
		onStatus,
		connect: vi.fn(),
	});
	await other.start();
	await vi.advanceTimersByTimeAsync(10000);
	expect(inaccessible).toHaveBeenCalledTimes(1);
	other.stop();
});
it('ignores late responses and queued reconnects after account change/unmount', async () => {
	let resolveRead: ((value: TJobView) => void) | undefined;
	const onState = vi.fn();
	const connect = vi.fn();
	const subscription = new JobSubscription({
		runId: state.runId,
		read: () =>
			new Promise((resolve) => {
				resolveRead = resolve;
			}),
		onState,
		onStatus: vi.fn(),
		connect,
	});
	const pending = subscription.start();
	subscription.stop();
	resolveRead!(state);
	await pending;
	expect(onState).not.toHaveBeenCalled();
	expect(connect).not.toHaveBeenCalled();
});
