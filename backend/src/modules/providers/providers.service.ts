import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '@app/shared/database/database.service';
import { ConfigService } from '@app/shared/config/config.service';
import { CredentialsService } from '@app/shared/credentials/credentials.service';
import { FixtureService } from '@app/modules/providers/adapters/fixture/fixture.service';
import { ProviderError } from '@app/errors/provider.error';
import { LIMITS } from '@app/modules/agent/agent.schemas';
import type { Connection } from '@app/generated/prisma/client';
import type { ITaskProvider } from '@app/modules/providers/provider.interfaces';
import { LinearService } from '@app/modules/providers/adapters/linear/services/linear.service';

@Injectable()
export class ProvidersService {
	constructor(
		@Inject(DatabaseService) private readonly database: DatabaseService,
		@Inject(ConfigService) private readonly configuration: ConfigService,
		@Inject(CredentialsService) private readonly credentials: CredentialsService,
		@Inject(FixtureService) private readonly fixture: FixtureService,
		@Inject(LinearService) private readonly linear: LinearService,
	) {}

	private token(connection: Connection) {
		if (
			this.configuration.get('APP_MODE') !== 'live' ||
			connection.provider !== 'linear' ||
			connection.mode !== 'live' ||
			connection.status !== 'active' ||
			!connection.encryptedCredentials
		) {
			throw new ProviderError('PROVIDER_CREDENTIALS_INVALID');
		}
		return this.credentials.decrypt(
			connection.ownerId,
			connection.id,
			connection.encryptedCredentials,
		).token;
	}

	async catalog(connection: Connection, cursor: string | null) {
		return this.linear.projects(this.token(connection), cursor);
	}

	async forRun(runId: string): Promise<ITaskProvider> {
		const run = await this.database.client.jobRun.findUniqueOrThrow({
			where: { id: runId },
			include: { project: { include: { connection: true } } },
		});
		const connection = run.project.connection;
		if (
			run.type !== 'sync' ||
			run.state !== 'running' ||
			connection.ownerId !== run.ownerId ||
			connection.sourceUserId !== run.subjectSourceUserId ||
			connection.status !== 'active'
		) {
			throw new ProviderError('PROVIDER_SCOPE_CHANGED');
		}
		if (
			connection.provider === 'fixture' &&
			connection.mode === 'fixture' &&
			this.configuration.get('APP_MODE') !== 'live'
		) {
			return {
				list: async (project, cursor) => {
					const result = await this.fixture.list(project, Number(cursor ?? 0));
					return {
						items: result.items,
						nextCursor: result.nextCursor === null ? null : String(result.nextCursor),
					};
				},
				details: (project, externalId) => this.fixture.details(project, externalId),
				comments: async (_project, externalId) => {
					const items = await this.fixture.comments(externalId);
					return { items, hasMore: items.length > LIMITS.commentsPerTask };
				},
			};
		}
		return this.linear.open(this.token(connection), run.project.externalId);
	}

	async comments(runId: string, externalId: string) {
		// Public/tool IDs are resolved inside the running snapshot before any request.
		const run = await this.database.client.jobRun.findUniqueOrThrow({
			where: { id: runId },
			include: { project: true },
		});
		const task = await this.database.client.taskSnapshot.findUniqueOrThrow({
			where: { syncRunId_externalId: { syncRunId: runId, externalId } },
		});
		if (task.refreshStatus !== 'fresh') {
			throw new ProviderError('PROVIDER_SCOPE_CHANGED');
		}
		return (await this.forRun(runId)).comments(run.project.externalId, externalId);
	}
}
