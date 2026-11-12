import { Inject, Injectable } from '@nestjs/common';
import type { TSource } from '@self-review/contracts';
import { aggregateUsage } from '@app/modules/agent/agent.usage';
import { ReportDraft } from '@self-review/contracts';
import { DatabaseService } from '@app/shared/database/database.service';
import { AgentService } from '@app/modules/agent/services/agent.service';
import { SourcesService } from '@app/modules/agent/services/sources.service';
import { json, markdown } from '@app/modules/agent/agent.utils';
import { ConfigService } from '@app/shared/config/config.service';

@Injectable()
export class ReviewService {
	constructor(
		@Inject(DatabaseService) private readonly database: DatabaseService,
		@Inject(AgentService) private readonly agent: AgentService,
		@Inject(SourcesService) private readonly sources: SourcesService,
		@Inject(ConfigService) private readonly configuration: ConfigService,
	) {}

	async execute(runId: string) {
		const db = this.database.client;
		const run = await db.jobRun.findUniqueOrThrow({ where: { id: runId } });
		const source = await db.jobRun.findUniqueOrThrow({ where: { id: run.sourceSyncRunId! } });
		const analysis = ReportDraft.parse(
			await this.agent.run(run.id, source.id, true, run.subjectSourceUserId),
		);
		const draft = ReportDraft.parse({
			schemaVersion: '1.0',
			groups: analysis.groups,
			limitations: [
				...analysis.limitations.slice(0, 4),
				'Selection uses task creation dates in UTC and current source snapshots; outcome timing may differ.',
				'Assignment does not confirm individual contribution or production rollout.',
				...(source.state === 'partial'
					? ['Incomplete source snapshot explicitly accepted.']
					: []),
			],
			explanation: analysis.explanation,
		});
		const sourceIds = [
			...new Set(
				analysis.groups
					.flatMap((group) => group.claims)
					.flatMap((claim) => claim.evidence.map((pair) => pair.sourceId)),
			),
		];
		const registry: TSource[] = [];
		// Cited sources alone are retained in the public report envelope.
		for (const sourceId of sourceIds) {
			const parts = sourceId.split(':');
			const task =
				parts[2] === 'comment'
					? (
							await db.commentSnapshot.findUnique({
								where: { id: parts[3] },
								include: { task: true },
							})
						)?.task
					: await db.taskSnapshot.findUnique({
							where: {
								syncRunId_externalId: {
									syncRunId: source.id,
									externalId: parts[3]!,
								},
							},
						});
			if (!task || task.syncRunId !== source.id) {
				throw new Error('INVALID_MODEL_OUTPUT');
			}
			const found = (await this.sources.forTasks([task.id])).find(
				(item) => item.id === sourceId,
			);
			if (!found) {
				throw new Error('INVALID_MODEL_OUTPUT');
			}
			registry.push(found);
		}
		const attempts = await db.modelAttempt.findMany({ where: { runId } });
		const usage = aggregateUsage(this.configuration.get('APP_MODE'), attempts);
		await db.$transaction(async (transaction) => {
			const claimed = await transaction.jobRun.updateMany({
				where: { id: runId, state: 'running' },
				data: {
					state: source.state === 'partial' ? 'partial' : 'succeeded',
					stage: 'finished',
					finishedAt: new Date(),
					analysisComplete: true,
					importComplete: source.importComplete,
					coverage: json(source.coverage),
					usage: json(usage),
					version: { increment: 1 },
				},
			});
			if (!claimed.count) {
				throw new Error('RUN_INTERRUPTED');
			}
			const report = await transaction.reviewReport.create({
				data: {
					reviewRunId: runId,
					sourceSyncRunId: source.id,
					subjectSourceUserId: run.subjectSourceUserId,
					draft: json(draft),
					markdown: markdown(draft, registry),
					sources: json(registry),
				},
			});
			await transaction.jobRun.update({
				where: { id: source.id },
				data: { currentReviewReportId: report.id, version: { increment: 1 } },
			});
		});
	}
}
