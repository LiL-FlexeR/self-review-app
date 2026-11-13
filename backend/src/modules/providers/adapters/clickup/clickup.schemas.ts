import { z as zod } from 'zod';

export const ClickUpId = zod
	.union([zod.string().regex(/^[a-zA-Z0-9_-]+$/), zod.number().int().nonnegative()])
	.transform(String);
export const ClickUpResource = zod.object({ id: ClickUpId, name: zod.string() });
export const ClickUpFolder = ClickUpResource.extend({ parent_folder: ClickUpId.nullish() });
export const ClickUpUser = zod.object({ id: ClickUpId, username: zod.string().nullable() });
const Timestamp = zod
	.union([zod.string().regex(/^\d+$/), zod.number()])
	.transform(Number)
	.refine((value) => Number.isFinite(new Date(value).getTime()));
export const ClickUpTask = zod.object({
	id: ClickUpId,
	custom_id: zod.string().nullish(),
	name: zod.string(),
	description: zod.string().nullish(),
	text_content: zod.string().nullish(),
	status: zod.object({ status: zod.string(), type: zod.string() }),
	assignees: zod.array(zod.object({ id: ClickUpId })),
	date_created: Timestamp,
	date_updated: Timestamp,
	list: zod.object({ id: ClickUpId }),
	locations: zod.array(zod.object({ id: ClickUpId })).optional(),
});
export const ClickUpTaskPage = zod.object({
	tasks: zod.array(ClickUpTask),
	last_page: zod.boolean(),
});
export const ClickUpComment = zod.object({
	id: ClickUpId,
	comment_text: zod.string(),
	user: ClickUpUser.nullable(),
	date: Timestamp,
});
export const ClickUpCatalogCursor = zod.strictObject({
	workspace: zod.number().int().nonnegative(),
	space: zod.number().int().nonnegative(),
	container: zod.number().int().nonnegative(),
});
