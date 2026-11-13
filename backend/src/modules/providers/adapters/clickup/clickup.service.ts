import { Inject, Injectable } from '@nestjs/common';
import { z as zod } from 'zod';
import { ProviderError } from '@app/errors/provider.error';
import { LIMITS } from '@app/modules/agent/agent.schemas';
import { RestTransport } from '@app/modules/providers/services/rest-transport.service';
import {
	metadata,
	numericOffset,
	parseCursor,
	sourceText,
	taskFields,
	validateProvider,
} from '@app/modules/providers/utils';
import type { ITaskProvider, IProviderTask } from '@app/modules/providers/provider.interfaces';
import {
	ClickUpId,
	ClickUpResource,
	ClickUpFolder,
	ClickUpUser,
	ClickUpTask,
	ClickUpTaskPage,
	ClickUpComment,
	ClickUpCatalogCursor,
} from './clickup.schemas.js';

function unique<TResource extends { id: string }>(items: TResource[]) {
	return [...new Map(items.map((item) => [item.id, item])).values()];
}

function normalizeTask(task: zod.infer<typeof ClickUpTask>): IProviderTask {
	return {
		externalId: task.id,
		...taskFields(
			task.custom_id ?? task.id,
			task.name,
			`${task.status.status} (${task.status.type})`,
		),
		description: sourceText(task.text_content ?? task.description ?? ''),
		assignees: [...new Set(task.assignees.map((user) => user.id))],
		createdAt: new Date(task.date_created),
		updatedAt: new Date(task.date_updated),
		safeUrl: `https://app.clickup.com/t/${encodeURIComponent(task.id)}`,
	};
}

@Injectable()
export class ClickUpService {
	constructor(@Inject(RestTransport) private readonly transport: RestTransport) {}

	private async read(token: string, path: string, query: Record<string, string> = {}) {
		return this.transport.send('clickup', { token }, path, query);
	}

	async identity(token: string) {
		const { user } = validateProvider(
			zod.object({ user: ClickUpUser }),
			await this.read(token, '/user'),
		);
		return {
			sourceUserId: user.id,
			sourceUserName: metadata(user.username ?? user.id),
			sourceScopeId: null,
			sourceBaseUrl: null,
		};
	}

	private async resources<TResult extends { id: string }>(
		token: string,
		path: string,
		key: string,
		schema: zod.ZodType<TResult>,
	) {
		const results: TResult[] = [];
		for (const archived of ['false', 'true']) {
			const response = validateProvider(
				zod.record(zod.string(), zod.unknown()),
				await this.read(token, path, { archived }),
			);
			results.push(...validateProvider(zod.array(schema), response[key]));
		}
		return unique(results);
	}

	async projects(token: string, cursor: string | null) {
		const position =
			cursor === null
				? { workspace: 0, space: 0, container: 0 }
				: parseCursor(ClickUpCatalogCursor, cursor);
		const { teams } = validateProvider(
			zod.object({ teams: zod.array(ClickUpResource) }),
			await this.read(token, '/team'),
		);
		while (position.workspace < teams.length) {
			const workspace = teams[position.workspace]!;
			const spaces = await this.resources(
				token,
				`/team/${workspace.id}/space`,
				'spaces',
				ClickUpResource,
			);
			if (position.space >= spaces.length) {
				position.workspace++;
				position.space = 0;
				position.container = 0;
				continue;
			}
			const space = spaces[position.space]!;
			const folders = await this.resources(
				token,
				`/space/${space.id}/folder`,
				'folders',
				ClickUpFolder,
			);
			if (position.container > folders.length) {
				position.space++;
				position.container = 0;
				continue;
			}
			const folder = position.container === 0 ? null : folders[position.container - 1]!;
			const breadcrumb = [metadata(workspace.name), metadata(space.name)];
			if (folder) {
				const ancestors: string[] = [];
				const seen = new Set<string>();
				let current: typeof folder | undefined = folder;
				while (current) {
					if (seen.has(current.id)) {
						throw new ProviderError('PAGINATION_LOOP');
					}
					seen.add(current.id);
					ancestors.unshift(metadata(current.name));
					const parent: string | null | undefined = current.parent_folder;
					current = parent
						? folders.find((candidate) => candidate.id === parent)
						: undefined;
					if (parent && !current) {
						throw new ProviderError('PROVIDER_RESPONSE_INVALID');
					}
				}
				breadcrumb.push(...ancestors);
			}
			const lists = await this.resources(
				token,
				folder ? `/folder/${folder.id}/list` : `/space/${space.id}/list`,
				'lists',
				ClickUpResource,
			);
			position.container++;
			// A Space can have only Folder Lists. Empty containers are traversal progress,
			// not a completed catalog or a page that the user needs to load manually.
			if (lists.length === 0) {
				continue;
			}
			return {
				items: lists.map((list) => ({
					externalId: list.id,
					name: metadata(list.name),
					resourceType: 'list',
					breadcrumb,
				})),
				nextCursor: JSON.stringify(position),
			};
		}
		return { items: [], nextCursor: null };
	}

	async open(token: string, projectId: string): Promise<ITaskProvider> {
		validateProvider(ClickUpId, projectId);
		const list = validateProvider(
			ClickUpResource,
			await this.read(token, `/list/${projectId}`),
		);
		if (list.id !== projectId) {
			throw new ProviderError('PROVIDER_SCOPE_CHANGED');
		}
		const discovered = new Set<string>();
		const details = async (project: string, externalId: string) => {
			if (project !== projectId) {
				throw new ProviderError('PROVIDER_SCOPE_CHANGED');
			}
			validateProvider(ClickUpId, externalId);
			const task = validateProvider(
				ClickUpTask,
				await this.read(token, `/task/${externalId}`),
			);
			if (
				task.id !== externalId ||
				!(
					task.list.id === projectId ||
					task.locations?.some((location) => location.id === projectId) ||
					discovered.has(externalId)
				)
			) {
				throw new ProviderError('PROVIDER_SCOPE_CHANGED');
			}
			return normalizeTask(task);
		};
		return {
			warnings: [
				'ClickUp imports accessible active and archived tasks/Lists; hidden resources and unavailable archive data cannot be recovered.',
			],
			list: async (project, cursor, start, end) => {
				if (project !== projectId) {
					throw new ProviderError('PROVIDER_SCOPE_CHANGED');
				}
				const page = numericOffset(cursor);
				const pages = [];
				for (const archived of ['false', 'true']) {
					pages.push(
						validateProvider(
							ClickUpTaskPage,
							await this.read(token, `/list/${projectId}/task`, {
								page: String(page),
								archived,
								include_closed: 'true',
								subtasks: 'true',
								include_timl: 'true',
								date_created_gt: String(start.getTime() - 1),
								date_created_lt: String(end.getTime() + 1),
								order_by: 'id',
							}),
						),
					);
				}
				const tasks = unique(pages.flatMap((result) => result.tasks));
				for (const task of tasks) {
					discovered.add(task.id);
				}
				return {
					items: tasks.map(normalizeTask),
					nextCursor: pages.every((result) => result.last_page) ? null : String(page + 1),
				};
			},
			details,
			comments: async (project, externalId) => {
				await details(project, externalId);
				const { comments } = validateProvider(
					zod.object({ comments: zod.array(ClickUpComment) }),
					await this.read(token, `/task/${externalId}/comment`),
				);
				return {
					items: comments.slice(0, LIMITS.commentsPerTask).map((comment) => ({
						externalId: comment.id,
						body: sourceText(comment.comment_text),
						author: comment.user
							? metadata(comment.user.username ?? comment.user.id)
							: null,
						createdAt: new Date(comment.date),
					})),
					hasMore: comments.length > LIMITS.commentsPerTask,
				};
			},
		};
	}
}
