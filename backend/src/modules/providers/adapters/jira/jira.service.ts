import { Inject, Injectable } from '@nestjs/common';
import { z as zod } from 'zod';
import { JiraCredentials } from '@self-review/contracts';
import { ProviderError } from '@app/errors/provider.error';
import { LIMITS } from '@app/modules/agent/agent.schemas';
import { RestTransport } from '@app/modules/providers/services/rest-transport.service';
import {
	metadata,
	numericOffset,
	taskFields,
	validateProvider,
} from '@app/modules/providers/utils';
import type { ITaskProvider, IProviderTask } from '@app/modules/providers/provider.interfaces';
import { JiraId, JiraProject, JiraIssue, JiraComment } from './jira.schemas.js';
import { adfText, jiraOrigin } from './adf.js';

type TJiraCredentials = zod.infer<typeof JiraCredentials>;
const FIELDS = 'project,summary,description,status,assignee,created,updated';

function normalizeTask(
	issue: zod.infer<typeof JiraIssue>,
	projectId: string,
	origin: string | null,
): IProviderTask {
	if (issue.fields.project.id !== projectId) {
		throw new ProviderError('PROVIDER_SCOPE_CHANGED');
	}
	return {
		externalId: issue.id,
		...taskFields(
			issue.key,
			issue.fields.summary,
			`${issue.fields.status.name} (${issue.fields.status.statusCategory.key})`,
		),
		description: adfText(issue.fields.description),
		assignees: issue.fields.assignee ? [issue.fields.assignee.accountId] : [],
		createdAt: new Date(issue.fields.created),
		updatedAt: new Date(issue.fields.updated),
		safeUrl: origin ? `${origin}/browse/${encodeURIComponent(issue.key)}` : null,
	};
}

@Injectable()
export class JiraService {
	constructor(@Inject(RestTransport) private readonly transport: RestTransport) {}

	private read(credentials: TJiraCredentials, path: string, query: Record<string, string> = {}) {
		return this.transport.send('jira', credentials, path, query);
	}

	async identity(credentials: TJiraCredentials) {
		const user = validateProvider(
			zod.object({ accountId: zod.string().min(1), displayName: zod.string() }),
			await this.read(credentials, '/myself'),
		);
		let sourceBaseUrl: string | null = null;
		try {
			const info = validateProvider(
				zod.object({ baseUrl: zod.string() }),
				await this.read(credentials, '/serverInfo'),
			);
			sourceBaseUrl = jiraOrigin(info.baseUrl);
		} catch {
			/* Link discovery is optional; identity verification already succeeded. */
		}
		return {
			sourceUserId: user.accountId,
			sourceUserName: metadata(user.displayName),
			sourceScopeId: credentials.cloudId,
			sourceBaseUrl,
		};
	}

	async projects(credentials: TJiraCredentials, cursor: string | null, origin: string | null) {
		const startAt = numericOffset(cursor);
		const result = validateProvider(
			zod.object({
				values: zod.array(JiraProject),
				startAt: zod.number().int().nonnegative(),
				isLast: zod.boolean(),
			}),
			await this.read(credentials, '/project/search', {
				startAt: String(startAt),
				maxResults: '50',
				orderBy: 'key',
			}),
		);
		if (result.startAt !== startAt || (!result.isLast && !result.values.length)) {
			throw new ProviderError('PAGINATION_LOOP');
		}
		return {
			items: [
				...new Map(
					result.values.map((project) => [
						project.id,
						{
							externalId: project.id,
							name: metadata(project.name),
							resourceType: 'project',
							breadcrumb: [
								origin ?? `Jira site ${credentials.cloudId}`,
								metadata(project.key),
							],
						},
					]),
				).values(),
			],
			nextCursor: result.isLast ? null : String(startAt + result.values.length),
		};
	}

	async open(
		credentials: TJiraCredentials,
		projectId: string,
		baseUrl: string | null,
	): Promise<ITaskProvider> {
		validateProvider(JiraId, projectId);
		const origin = jiraOrigin(baseUrl);
		const project = validateProvider(
			JiraProject,
			await this.read(credentials, `/project/${projectId}`),
		);
		if (project.id !== projectId) {
			throw new ProviderError('PROVIDER_SCOPE_CHANGED');
		}
		const details = async (selectedProject: string, externalId: string) => {
			if (selectedProject !== projectId) {
				throw new ProviderError('PROVIDER_SCOPE_CHANGED');
			}
			validateProvider(JiraId, externalId);
			const issue = validateProvider(
				JiraIssue,
				await this.read(credentials, `/issue/${externalId}`, { fields: FIELDS }),
			);
			if (issue.id !== externalId) {
				throw new ProviderError('PROVIDER_SCOPE_CHANGED');
			}
			return normalizeTask(issue, projectId, origin);
		};
		return {
			warnings: [
				'Jira standard search imports accessible issues; archived issues and restricted resources are not guaranteed. ADF attachments and embedded content are omitted.',
				...(origin
					? []
					: [
							'Jira browser links are unavailable: no verified atlassian.net origin. Saved internal citations remain available.',
						]),
			],
			list: async (selectedProject, cursor, start, end) => {
				if (selectedProject !== projectId) {
					throw new ProviderError('PROVIDER_SCOPE_CHANGED');
				}
				// JQL dates use the account timezone. Widen by two days, then let the shared importer enforce exact UTC.
				const lower = new Date(start.getTime() - 2 * 86400000).toISOString().slice(0, 10);
				const upper = new Date(end.getTime() + 2 * 86400000).toISOString().slice(0, 10);
				const result = validateProvider(
					zod.object({
						issues: zod.array(JiraIssue),
						isLast: zod.boolean(),
						nextPageToken: zod.string().min(1).optional(),
					}),
					await this.read(credentials, '/search/jql', {
						jql: `project = ${projectId} AND created >= "${lower}" AND created < "${upper}" ORDER BY id ASC`,
						fields: FIELDS,
						maxResults: '50',
						...(cursor ? { nextPageToken: cursor } : {}),
					}),
				);
				if (
					!result.isLast &&
					(!result.nextPageToken ||
						result.nextPageToken === cursor ||
						!result.issues.length)
				) {
					throw new ProviderError('PAGINATION_LOOP');
				}
				return {
					items: result.issues.map((issue) => normalizeTask(issue, projectId, origin)),
					nextCursor: result.isLast ? null : result.nextPageToken!,
				};
			},
			details,
			comments: async (selectedProject, externalId) => {
				await details(selectedProject, externalId);
				const result = validateProvider(
					zod.object({
						comments: zod.array(JiraComment),
						startAt: zod.number().int().nonnegative(),
						total: zod.number().int().nonnegative(),
					}),
					await this.read(credentials, `/issue/${externalId}/comment`, {
						maxResults: String(LIMITS.commentsPerTask + 1),
						orderBy: '-created',
					}),
				);
				if (result.startAt !== 0 || (result.total > 0 && !result.comments.length)) {
					throw new ProviderError('PROVIDER_RESPONSE_INVALID');
				}
				return {
					items: result.comments.slice(0, LIMITS.commentsPerTask).map((comment) => ({
						externalId: comment.id,
						body: adfText(comment.body),
						author: comment.author ? metadata(comment.author.displayName) : null,
						createdAt: new Date(comment.created),
					})),
					hasMore:
						result.total > Math.min(result.comments.length, LIMITS.commentsPerTask),
				};
			},
		};
	}
}
