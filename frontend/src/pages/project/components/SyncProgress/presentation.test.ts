import { expect, it } from 'vitest';
import type { TJobView } from '@self-review/contracts';
import { jobCounters, jobHeading } from './presentation';

const job: TJobView = {
	runId: '11111111-1111-4111-8111-111111111111',
	type: 'sync',
	state: 'running',
	stage: 'reducing',
	version: 4,
	counts: { saved: 137, targetTasks: 137, read: 130, batches: 14, batchesCompleted: 16 },
	discoveryComplete: true,
	importComplete: true,
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

it('separates imported tasks from review eligibility and omits incompatible batch fractions', () => {
	expect(jobCounters(job)).toEqual(['137 tasks saved', '130 task detail records processed']);
	expect(jobCounters({ ...job, type: 'review', counts: { targetTasks: 10 } })).toEqual([
		'10 review-eligible tasks',
	]);
	expect(jobCounters({ ...job, type: 'review', counts: {} })).toEqual([]);
});

it('uses actual stage and terminal state without inventing saving or completion', () => {
	expect(jobHeading(job)).toBe('Synchronization · Combining validated findings');
	expect(jobHeading({ ...job, stage: 'unknown' })).toBe('Synchronization · Processing');
	expect(jobHeading({ ...job, state: 'partial', stage: 'finished' })).toBe(
		'Synchronization partially complete',
	);
	expect(jobHeading({ ...job, type: 'review', state: 'queued' })).toBe('Self-review queued');
});
