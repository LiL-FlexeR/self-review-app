import type { z as zod } from 'zod';
import type { ConnectionView, ProjectView } from '@self-review/contracts';

export type TConnection = zod.infer<typeof ConnectionView>;
export type TProject = zod.infer<typeof ProjectView>;
export type TProviderFilter = 'all' | 'linear' | 'clickup' | 'jira';
export type TProjectRow = { project: TProject; connection: TConnection };
export type TCatalogSnapshot = {
	projects: TProject[];
	isPending: boolean;
	isFetching: boolean;
	hasNextPage: boolean;
	hasLoop: boolean;
	error: Error | null;
};
