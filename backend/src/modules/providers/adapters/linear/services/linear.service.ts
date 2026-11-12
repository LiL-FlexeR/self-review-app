import { Inject, Injectable } from '@nestjs/common';
import { z as zod } from 'zod';
import { ProviderError } from '@app/errors/provider.error';
import { LIMITS } from '@app/modules/agent/agent.schemas';
import { excerpt } from '@app/utils/excerpt';
import { LINEAR_QUERIES } from '@app/modules/providers/adapters/linear/linear.queries';
import {
	LinearIdentity,
	LinearProject,
	LinearIssue,
	LinearPageInfo,
	LinearComment,
} from '@app/modules/providers/adapters/linear/linear.schemas';
import type { ITaskProvider, IProviderTask } from '@app/modules/providers/provider.interfaces';
import { LinearTransport } from './linear-transport.service.js';

function validate<TResult>(schema: zod.ZodType<TResult>, value: unknown): TResult {
	const result = schema.safeParse(value);
	if (!result.success) {
		throw new ProviderError('PROVIDER_RESPONSE_INVALID');
	}
	return result.data;
}

function nextCursor(
	info: zod.infer<typeof LinearPageInfo>,
	previous: string | null,
	count: number,
) {
	if (!info.hasNextPage) {
		return null;
	}
	if (!info.endCursor || info.endCursor === previous || !count) {
		throw new ProviderError('PAGINATION_LOOP');
	}
	return info.endCursor;
}

function field(value: string): string {
	const normalized = value.replace(/\r\n/g, '\n').replace(/\0/g, '');
	if (Buffer.byteLength(normalized) > LIMITS.sourceFieldBytes) {
		throw new ProviderError('PROVIDER_FIELD_LIMIT');
	}
	return normalized;
}

function task(issue: zod.infer<typeof LinearIssue>, projectId: string): IProviderTask {
	if (issue.project?.id !== projectId) {
		throw new ProviderError('PROVIDER_SCOPE_CHANGED');
	}
	let safeUrl: string | null = null;
	try {
		const url = new URL(issue.url);
		if (
			url.protocol === 'https:' &&
			url.hostname === 'linear.app' &&
			!url.username &&
			!url.password &&
			!url.port
		) {
			safeUrl = url.href;
		}
	} catch {
		/* Invalid links retain internal snapshot citations. */
	}
	return {
		externalId: issue.id,
		identifier: excerpt(issue.identifier, LIMITS.sourceFieldBytes),
		title: excerpt(issue.title, LIMITS.sourceFieldBytes),
		description: (issue.description ?? '').replace(/\r\n/g, '\n').replace(/\0/g, ''),
		state: excerpt(issue.state.type, LIMITS.sourceFieldBytes),
		hasTruncatedFields: [issue.identifier, issue.title, issue.state.type].some(
			(value) => Buffer.byteLength(value) > LIMITS.sourceFieldBytes,
		),
		assignees: issue.assignee ? [issue.assignee.id] : [],
		createdAt: new Date(issue.createdAt),
		updatedAt: new Date(issue.updatedAt),
		safeUrl,
	};
}

@Injectable()
export class LinearService {
	constructor(@Inject(LinearTransport) private readonly transport: LinearTransport) {}

	async identity(token: string) {
		const identity = validate(
			LinearIdentity,
			await this.transport.send(token, LINEAR_QUERIES.identity, {}),
		);
		field(identity.viewer.name);
		field(identity.organization.name);
		return identity;
	}

	async projects(token: string, cursor: string | null) {
		const result = validate(
			zod.object({
				organization: zod.object({ name: zod.string() }),
				projects: zod.object({ nodes: zod.array(LinearProject), pageInfo: LinearPageInfo }),
			}),
			await this.transport.send(token, LINEAR_QUERIES.projects, { after: cursor }),
		);
		return {
			items: [
				...new Map(
					result.projects.nodes.map((project) => [
						project.id,
						{
							externalId: project.id,
							name: field(project.name),
							resourceType: 'project',
							breadcrumb: [field(result.organization.name)],
						},
					]),
				).values(),
			],
			nextCursor: nextCursor(result.projects.pageInfo, cursor, result.projects.nodes.length),
		};
	}

	async open(token: string, projectId: string): Promise<ITaskProvider> {
		const result = validate(
			zod.object({ project: LinearProject.nullable() }),
			await this.transport.send(token, LINEAR_QUERIES.project, { id: projectId }),
		);
		if (result.project?.id !== projectId) {
			throw new ProviderError('PROVIDER_SCOPE_CHANGED');
		}
		return {
			list: (project, cursor, start, end) => this.list(token, project, cursor, start, end),
			details: (project, externalId) => this.details(token, project, externalId),
			comments: (project, externalId) => this.comments(token, project, externalId),
		};
	}

	private async list(
		token: string,
		projectId: string,
		cursor: string | null,
		start: Date,
		end: Date,
	) {
		const result = validate(
			zod.object({
				project: zod
					.object({
						id: zod.string(),
						issues: zod.object({
							nodes: zod.array(LinearIssue),
							pageInfo: LinearPageInfo,
						}),
					})
					.nullable(),
			}),
			await this.transport.send(token, LINEAR_QUERIES.issues, {
				id: projectId,
				after: cursor,
				filter: { createdAt: { gte: start.toISOString(), lte: end.toISOString() } },
			}),
		);
		if (result.project?.id !== projectId) {
			throw new ProviderError('PROVIDER_SCOPE_CHANGED');
		}
		return {
			items: result.project.issues.nodes.map((issue) => task(issue, projectId)),
			nextCursor: nextCursor(
				result.project.issues.pageInfo,
				cursor,
				result.project.issues.nodes.length,
			),
		};
	}

	private async details(token: string, projectId: string, externalId: string) {
		const result = validate(
			zod.object({ issue: LinearIssue.nullable() }),
			await this.transport.send(token, LINEAR_QUERIES.details, { id: externalId }),
		);
		if (!result.issue || result.issue.id !== externalId) {
			throw new ProviderError('PROVIDER_SCOPE_CHANGED');
		}
		return task(result.issue, projectId);
	}

	private async comments(token: string, projectId: string, externalId: string) {
		const result = validate(
			zod.object({
				issue: zod
					.object({
						id: zod.string(),
						project: zod.object({ id: zod.string() }).nullable(),
						comments: zod.object({
							nodes: zod.array(LinearComment),
							pageInfo: LinearPageInfo,
						}),
					})
					.nullable(),
			}),
			await this.transport.send(token, LINEAR_QUERIES.comments, { id: externalId }),
		);
		if (result.issue?.id !== externalId || result.issue.project?.id !== projectId) {
			throw new ProviderError('PROVIDER_SCOPE_CHANGED');
		}
		return {
			hasMore:
				result.issue.comments.pageInfo.hasNextPage ||
				result.issue.comments.nodes.length > LIMITS.commentsPerTask,
			items: result.issue.comments.nodes.map((comment) => ({
				externalId: comment.id,
				body: comment.body.replace(/\r\n/g, '\n').replace(/\0/g, ''),
				author: comment.user ? field(comment.user.name) : null,
				createdAt: new Date(comment.createdAt),
			})),
		};
	}
}
