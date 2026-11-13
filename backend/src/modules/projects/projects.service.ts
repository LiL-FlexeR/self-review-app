import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { parse } from '@app/utils/http';
import { z as zod } from 'zod';
import {
	ConnectionView,
	ProjectView,
	HTTP_ERROR_CODE,
	HTTP_ERROR_MESSAGE,
} from '@self-review/contracts';
import { DatabaseService } from '@app/shared/database/database.service';
import { ConfigService } from '@app/shared/config/config.service';
import { FixtureService } from '@app/modules/providers/adapters/fixture/fixture.service';
import { ProvidersService } from '@app/modules/providers/providers.service';
import { JobsService } from '@app/modules/jobs/services/jobs.service';
import { SourcesService } from '@app/modules/agent/services/sources.service';
import { Analysis } from '@app/modules/agent/agent.schemas';
import type { Connection } from '@app/generated/prisma/client';

export function serialized(value: unknown): unknown {
	return JSON.parse(JSON.stringify(value));
}
export function pagination(cursor: unknown) {
	const offset = parse(
		zod.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
		cursor ?? 0,
	);
	return { skip: offset, take: 21 };
}
export function page<TItem>(items: TItem[], offset: number) {
	return {
		items: items.slice(0, 20),
		nextCursor: items.length > 20 ? String(offset + 20) : null,
	};
}

@Injectable()
export class ProjectsService {
	constructor(
		@Inject(DatabaseService) private readonly database: DatabaseService,
		@Inject(ConfigService) private readonly configuration: ConfigService,
		@Inject(FixtureService) private readonly fixture: FixtureService,
		@Inject(ProvidersService) private readonly providers: ProvidersService,
		@Inject(JobsService) private readonly jobs: JobsService,
		@Inject(SourcesService) private readonly sources: SourcesService,
	) {}

	connectionView(connection: Connection) {
		return ConnectionView.parse(
			serialized({
				...connection,
				warnings:
					connection.provider === 'jira' && !connection.sourceBaseUrl
						? [
								'Jira browser links are unavailable: no verified atlassian.net origin. Internal citations remain available.',
							]
						: [],
				modelMode:
					this.configuration.get('APP_MODE') === 'offline' ? 'scripted' : 'live OpenAI',
			}),
		);
	}

	async connections(ownerId: string) {
		return {
			availableProviders:
				this.configuration.get('APP_MODE') === 'live'
					? ['linear', 'clickup', 'jira']
					: ['fixture'],
			items: (
				await this.database.client.connection.findMany({
					where: { ownerId },
					orderBy: { createdAt: 'asc' },
				})
			).map((connection) => this.connectionView(connection)),
		};
	}

	async add(ownerId: string) {
		if (this.configuration.get('APP_MODE') === 'live') {
			throw new BadRequestException({
				code: HTTP_ERROR_CODE.MODE_UNAVAILABLE,
				message: HTTP_ERROR_MESSAGE.MODE_UNAVAILABLE,
				retryable: false,
			});
		}
		return this.database.client.$transaction(async (transaction) => {
			await transaction.$queryRaw`SELECT id FROM users WHERE id=${ownerId}::uuid FOR UPDATE`;
			let connection = await transaction.connection.findFirst({
				where: { ownerId, provider: 'fixture' },
			});
			connection ??= await transaction.connection.create({
				data: {
					ownerId,
					provider: 'fixture',
					mode: 'fixture',
					displayName: 'Synthetic demo source',
					sourceUserId: 'demo-anna',
					sourceUserName: 'Anna',
				},
			});
			for (const project of this.fixture.projects()) {
				await transaction.sourceProject.upsert({
					where: {
						connectionId_externalId: {
							connectionId: connection.id,
							externalId: project.externalId,
						},
					},
					create: { connectionId: connection.id, ...project },
					update: {},
				});
			}
			return this.connectionView(connection);
		});
	}

	async catalog(ownerId: string, connectionId: string, cursor: unknown) {
		const connection = await this.database.client.connection.findFirst({
			where: { id: connectionId, ownerId },
		});
		if (!connection) {
			throw new NotFoundException({
				code: HTTP_ERROR_CODE.RESOURCE_NOT_FOUND,
				message: HTTP_ERROR_MESSAGE.RESOURCE_NOT_FOUND,
				retryable: false,
			});
		}
		if (connection.mode === 'live') {
			const after = parse(zod.string().min(1).max(4096).nullable(), cursor ?? null);
			const result = await this.providers.catalog(connection, after);
			const items = [];
			for (const project of result.items) {
				items.push(
					ProjectView.parse(
						await this.database.client.sourceProject.upsert({
							where: {
								connectionId_externalId: {
									connectionId,
									externalId: project.externalId,
								},
							},
							create: { connectionId, ...project },
							update: project,
						}),
					),
				);
			}
			return { items, nextCursor: result.nextCursor };
		}
		const options = pagination(cursor);
		return page(
			(
				await this.database.client.sourceProject.findMany({
					where: { connectionId },
					orderBy: { id: 'asc' },
					...options,
				})
			).map((project) => ProjectView.parse(project)),
			options.skip,
		);
	}

	async project(ownerId: string, id: string) {
		const project = await this.jobs.project(ownerId, id);
		const runs = await this.database.client.jobRun.findMany({
			where: { projectId: id },
			orderBy: { createdAt: 'desc' },
			take: 20,
		});
		const latestSuccessful = await this.database.client.jobRun.findFirst({
			where: { projectId: id, type: 'sync', state: 'succeeded' },
			orderBy: { createdAt: 'desc' },
		});
		return {
			...ProjectView.parse(project),
			connection: this.connectionView(project.connection),
			latestSuccessfulSync: latestSuccessful ? await this.jobs.view(latestSuccessful) : null,
			runs: await Promise.all(runs.map((run) => this.jobs.view(run))),
		};
	}

	async history(ownerId: string, id: string, cursor: unknown) {
		await this.jobs.project(ownerId, id);
		const options = pagination(cursor);
		const runs = await this.database.client.jobRun.findMany({
			where: { projectId: id, type: 'sync' },
			orderBy: { createdAt: 'desc' },
			...options,
		});
		return page(await Promise.all(runs.map((run) => this.jobs.view(run))), options.skip);
	}

	async tasks(ownerId: string, id: string, syncRunId: string, cursor: unknown) {
		await this.jobs.project(ownerId, id);
		const run = await this.jobs.owned(ownerId, syncRunId);
		if (run.projectId !== id || run.type !== 'sync') {
			throw new NotFoundException({
				code: HTTP_ERROR_CODE.RESOURCE_NOT_FOUND,
				message: HTTP_ERROR_MESSAGE.RESOURCE_NOT_FOUND,
				retryable: false,
			});
		}
		const options = pagination(cursor);
		return serialized(
			page(
				await this.database.client.taskSnapshot.findMany({
					where: { syncRunId },
					orderBy: { externalId: 'asc' },
					...options,
				}),
				options.skip,
			),
		);
	}

	async task(ownerId: string, id: string) {
		const task = await this.database.client.taskSnapshot.findFirst({
			where: { id, syncRun: { ownerId } },
			include: { comments: true },
		});
		if (!task) {
			throw new NotFoundException({
				code: HTTP_ERROR_CODE.RESOURCE_NOT_FOUND,
				message: HTTP_ERROR_MESSAGE.RESOURCE_NOT_FOUND,
				retryable: false,
			});
		}
		const batches = await this.database.client.analysisBatch.findMany({
			where: {
				runId: task.syncRunId,
				level: 0,
				inputIds: { array_contains: [id] },
				state: 'succeeded',
			},
			select: { output: true },
		});
		const sources = await this.sources.forTasks([id]);
		return serialized({
			...task,
			sources,
			findings: batches
				.flatMap((batch) => Analysis.parse(batch.output).findings)
				.filter((claim) =>
					claim.evidence.some((pair) =>
						sources.some((source) => source.id === pair.sourceId),
					),
				),
		});
	}

	async report(ownerId: string, id: string) {
		const report = await this.database.client.reviewReport.findFirst({
			where: { id, reviewRun: { ownerId } },
			include: {
				reviewRun: {
					select: {
						state: true,
						usage: true,
						importComplete: true,
						analysisComplete: true,
						coverage: true,
					},
				},
				sourceSyncRun: { select: { selection: true } },
			},
		});
		if (!report) {
			throw new NotFoundException({
				code: HTTP_ERROR_CODE.RESOURCE_NOT_FOUND,
				message: HTTP_ERROR_MESSAGE.RESOURCE_NOT_FOUND,
				retryable: false,
			});
		}
		const targetTasks = await this.database.client.taskSnapshot.count({
			where: {
				syncRunId: report.sourceSyncRunId,
				assignees: { array_contains: [report.subjectSourceUserId] },
			},
		});
		return serialized({
			...report,
			selection: report.sourceSyncRun.selection,
			coverage: {
				discoveryComplete:
					zod
						.object({ discoveryComplete: zod.boolean().optional() })
						.parse(report.reviewRun.coverage).discoveryComplete ?? false,
				importComplete: report.reviewRun.importComplete,
				analysisComplete: report.reviewRun.analysisComplete,
				targetTasks,
			},
			traceUrl: `/api/jobs/${report.reviewRunId}/trace`,
			state: report.reviewRun.state,
			usage: report.reviewRun.usage,
		});
	}

	async units(ownerId: string, id: string, cursor: unknown, trace: boolean) {
		await this.jobs.owned(ownerId, id);
		const options = pagination(cursor);
		const batches = await this.database.client.analysisBatch.findMany({
			where: { runId: id },
			orderBy: [{ level: 'asc' }, { ordinal: 'asc' }],
			...options,
		});
		return page(
			batches.map((batch) =>
				trace ? { batchId: batch.id, level: batch.level, events: batch.trace } : batch,
			),
			options.skip,
		);
	}
}
