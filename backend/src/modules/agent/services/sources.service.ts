import { Inject, Injectable } from '@nestjs/common';
import type { TSource } from '@self-review/contracts';
import { DatabaseService } from '@app/shared/database/database.service';
import { excerpt } from '@app/modules/agent/agent.utils';

@Injectable()
export class SourcesService {
	constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

	async forTasks(ids: string[]): Promise<TSource[]> {
		const tasks = await this.database.client.taskSnapshot.findMany({
			where: { id: { in: ids } },
			include: { comments: true },
			orderBy: { externalId: 'asc' },
		});
		return tasks.flatMap((task) => {
			const common = {
				taskSnapshotId: task.id,
				url: task.safeUrl,
				createdAt: task.sourceCreatedAt.toISOString(),
				updatedAt: task.sourceUpdatedAt?.toISOString() ?? null,
				retrievedAt: task.retrievedAt.toISOString(),
				state: task.state,
			};
			const source = (kind: TSource['kind'], suffix: string, text: string): TSource => ({
				...common,
				id: `sync:${task.syncRunId}:${suffix}`,
				kind,
				textExcerpt: excerpt(text),
				truncated: Buffer.byteLength(text) > 1024,
			});
			return [
				source(
					'metadata',
					`issue:${task.externalId}:metadata`,
					`Title: ${excerpt(task.title, 256)}\nStatus: ${task.state}`,
				),
				source('description', `issue:${task.externalId}:description`, task.description),
				...task.comments.map((comment) => ({
					...source('comment', `comment:${comment.id}`, comment.body),
					createdAt: comment.sourceCreatedAt?.toISOString() ?? null,
					retrievedAt: comment.retrievedAt.toISOString(),
				})),
			];
		});
	}
}
