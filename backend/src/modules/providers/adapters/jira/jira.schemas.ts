import { z as zod } from 'zod';

export const JiraId = zod.string().regex(/^\d+$/);
export const JiraProject = zod.object({ id: JiraId, key: zod.string(), name: zod.string() });
const Timestamp = zod.string().refine((value) => Number.isFinite(Date.parse(value)));
export const JiraIssue = zod.object({
	id: JiraId,
	key: zod.string(),
	fields: zod.object({
		project: zod.object({ id: JiraId }),
		summary: zod.string(),
		description: zod.unknown(),
		status: zod.object({
			name: zod.string(),
			statusCategory: zod.object({ key: zod.string() }),
		}),
		assignee: zod.object({ accountId: zod.string().min(1) }).nullable(),
		created: Timestamp,
		updated: Timestamp,
	}),
});
export const JiraComment = zod.object({
	id: JiraId,
	body: zod.unknown(),
	author: zod.object({ displayName: zod.string() }).nullable().optional(),
	created: Timestamp,
});
