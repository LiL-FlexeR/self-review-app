import { JobView, TaskView, pageOf } from '@self-review/contracts';
import { read } from '@app/lib/api';

export async function readProjectSnapshot(
	projectId: string,
	snapshotId: string,
	signal?: AbortSignal,
) {
	const snapshot = await read(`/jobs/${snapshotId}`, JobView, signal);
	signal?.throwIfAborted();
	if (snapshot.runId !== snapshotId || snapshot.type !== 'sync') {
		throw new Error('This run is not the requested synchronization snapshot.');
	}
	// JobView has no projectId. This saved-data endpoint also verifies the project/run pair.
	await read(
		`/projects/${projectId}/tasks?syncRunId=${snapshotId}&cursor=0`,
		pageOf(TaskView),
		signal,
	);
	signal?.throwIfAborted();
	return snapshot;
}
