import { z as zod } from 'zod';

const ExternalId = zod.string().min(1).max(256);
const Timestamp = zod.iso.datetime({ offset: true });
export const LinearProject = zod.object({ id: ExternalId, name: zod.string() });
export const LinearPageInfo = zod.object({
	hasNextPage: zod.boolean(),
	endCursor: zod.string().min(1).max(4096).nullable(),
});
export const LinearIssue = zod.object({
	id: ExternalId,
	identifier: zod.string(),
	title: zod.string(),
	description: zod.string().nullable(),
	createdAt: Timestamp,
	updatedAt: Timestamp,
	url: zod.string(),
	state: zod.object({ type: zod.string() }),
	assignee: zod.object({ id: ExternalId }).nullable(),
	project: zod.object({ id: ExternalId }).nullable(),
});
export const LinearComment = zod.object({
	id: ExternalId,
	body: zod.string(),
	createdAt: Timestamp,
	user: zod.object({ name: zod.string() }).nullable(),
});
export const LinearIdentity = zod.object({
	viewer: zod.object({ id: ExternalId, name: zod.string().min(1) }),
	organization: zod.object({ id: ExternalId, name: zod.string() }),
});
