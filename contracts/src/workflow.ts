import { z as zod } from 'zod';

const Id = zod.uuid();
const DateOnly = zod.iso.date();
const Period = zod
	.strictObject({ mode: zod.literal('period'), startDate: DateOnly, endDate: DateOnly })
	.refine((period) => period.startDate <= period.endDate);
export const SyncCommand = zod.strictObject({
	selection: zod.union([
		Period,
		zod.strictObject({
			mode: zod.literal('tasks'),
			baseSyncRunId: Id,
			taskIds: zod.array(Id).min(1),
		}),
	]),
	generateReview: zod.boolean().default(false),
	idempotencyKey: Id,
});
export const ReviewCommand = zod.strictObject({
	syncRunId: Id,
	allowPartial: zod.boolean().default(false),
	idempotencyKey: Id,
});
export const FixtureCommand = zod.strictObject({ provider: zod.literal('fixture') });
export const Claim = zod.strictObject({
	kind: zod.enum(['task_description', 'reported_result', 'reported_measurement']),
	text: zod.string().min(1).max(400),
	evidence: zod
		.array(
			zod.strictObject({
				sourceId: zod.string().min(1),
				quote: zod.string().min(1).max(240),
			}),
		)
		.min(1)
		.max(2),
});
export const ReportDraft = zod
	.strictObject({
		schemaVersion: zod.literal('1.0'),
		groups: zod
			.array(
				zod.strictObject({ title: zod.string().max(100), claims: zod.array(Claim).max(8) }),
			)
			.max(4),
		limitations: zod.array(zod.string().max(300)).max(8),
		explanation: zod.string().max(400),
	})
	.refine((draft) => draft.groups.reduce((count, group) => count + group.claims.length, 0) <= 8);
export const Source = zod.object({
	id: zod.string(),
	taskSnapshotId: Id,
	kind: zod.enum(['metadata', 'description', 'comment']),
	textExcerpt: zod.string(),
	url: zod.string().nullable(),
	createdAt: zod.string().nullable(),
	updatedAt: zod.string().nullable(),
	retrievedAt: zod.string(),
	truncated: zod.boolean(),
	state: zod.string(),
});
export const ConnectionView = zod.object({
	id: Id,
	provider: zod.string(),
	mode: zod.string(),
	modelMode: zod.string(),
	displayName: zod.string(),
	sourceUserId: zod.string(),
	sourceUserName: zod.string(),
	status: zod.string(),
	verifiedAt: zod.string(),
});
export const ProjectView = zod.object({
	id: Id,
	connectionId: Id,
	externalId: zod.string(),
	name: zod.string(),
	resourceType: zod.string(),
	breadcrumb: zod.array(zod.string()),
});
export const JobView = zod.object({
	runId: Id,
	type: zod.enum(['sync', 'review']),
	state: zod.enum(['queued', 'running', 'succeeded', 'partial', 'failed']),
	stage: zod.string(),
	version: zod.number(),
	counts: zod.record(zod.string(), zod.number()),
	discoveryComplete: zod.boolean(),
	importComplete: zod.boolean(),
	analysisComplete: zod.boolean(),
	resultRef: zod.string().nullable(),
	errorCode: zod.string().nullable(),
	warningsCount: zod.number(),
	autoReview: zod.string().nullable(),
	reviewRunId: Id.nullable(),
	currentReviewReportId: Id.nullable(),
	selection: zod.unknown(),
	usage: zod.unknown(),
});
export const AcceptedJob = zod.object({ runId: Id, state: zod.string(), eventsUrl: zod.string() });
export const TaskView = zod.object({
	id: Id,
	syncRunId: Id,
	externalId: zod.string(),
	identifier: zod.string(),
	title: zod.string(),
	description: zod.string(),
	state: zod.string(),
	assignees: zod.array(zod.string()),
	sourceCreatedAt: zod.string(),
	retrievedAt: zod.string(),
	safeUrl: zod.string().nullable(),
	detailStatus: zod.string(),
	refreshStatus: zod.string(),
	commentReadState: zod.string(),
	commentsTruncated: zod.boolean(),
});
export const TaskDetail = TaskView.extend({
	comments: zod.array(zod.object({ id: Id, body: zod.string(), retrievedAt: zod.string() })),
	sources: zod.array(Source),
	findings: zod.array(Claim),
});
export const ReviewView = zod.object({
	id: Id,
	reviewRunId: Id,
	sourceSyncRunId: Id,
	subjectSourceUserId: zod.string(),
	draft: ReportDraft,
	markdown: zod.string(),
	sources: zod.array(Source),
	usage: zod.unknown(),
	state: zod.string(),
	selection: zod.unknown(),
	coverage: zod.object({
		discoveryComplete: zod.boolean(),
		importComplete: zod.boolean(),
		analysisComplete: zod.boolean(),
		targetTasks: zod.number(),
	}),
	createdAt: zod.string(),
	traceUrl: zod.string(),
});
export const ProjectDetail = ProjectView.extend({
	connection: ConnectionView,
	runs: zod.array(JobView),
	latestSuccessfulSync: JobView.nullable(),
});
export function pageOf<TItem>(item: zod.ZodType<TItem>) {
	return zod.object({ items: zod.array(item), nextCursor: zod.string().nullable() });
}
export type TSyncCommand = zod.infer<typeof SyncCommand>;
export type TReviewCommand = zod.infer<typeof ReviewCommand>;
export type TJobView = zod.infer<typeof JobView>;
export type TClaim = zod.infer<typeof Claim>;
export type TReportDraft = zod.infer<typeof ReportDraft>;
export type TSource = zod.infer<typeof Source>;
