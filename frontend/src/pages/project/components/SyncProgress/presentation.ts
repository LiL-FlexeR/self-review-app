import type { TJobView } from '@self-review/contracts';

const STAGES: Record<string, string> = {
	listing: 'Discovering tasks',
	reading: 'Reading task details',
	analyzing: 'Analyzing saved evidence',
	reducing: 'Combining validated findings',
};

export function jobHeading(job: TJobView) {
	const kind = job.type === 'sync' ? 'Synchronization' : 'Self-review';
	if (job.state === 'queued') {
		return `${kind} queued`;
	}
	if (job.state === 'running') {
		return `${kind} · ${STAGES[job.stage] ?? 'Processing'}`;
	}
	const outcomes = { succeeded: 'complete', partial: 'partially complete', failed: 'failed' };
	return `${kind} ${outcomes[job.state]}`;
}

export function jobCounters(job: TJobView) {
	if (job.type === 'review') {
		return job.counts.targetTasks === undefined
			? []
			: [`${job.counts.targetTasks} review-eligible tasks`];
	}
	return [
		...(job.counts.saved === undefined ? [] : [`${job.counts.saved} tasks saved`]),
		...(job.counts.read === undefined
			? []
			: [`${job.counts.read} task detail records processed`]),
	];
}
