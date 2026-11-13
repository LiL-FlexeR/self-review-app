export interface IProviderTask {
	externalId: string;
	identifier: string;
	title: string;
	description: string;
	state: string;
	assignees: string[];
	createdAt: Date;
	updatedAt?: Date;
	safeUrl?: string | null;
	hasTruncatedFields?: boolean;
}

export interface IProviderComment {
	externalId: string;
	body: string;
	author: string | null;
	createdAt: Date | null;
}

export interface IProviderComments {
	items: IProviderComment[];
	hasMore: boolean;
}

export interface ITaskProvider {
	warnings?: string[];
	list(
		project: string,
		cursor: string | null,
		start: Date,
		end: Date,
	): Promise<{
		items: IProviderTask[];
		nextCursor: string | null;
	}>;
	details(project: string, externalId: string): Promise<IProviderTask>;
	comments(project: string, externalId: string): Promise<IProviderComments>;
}
