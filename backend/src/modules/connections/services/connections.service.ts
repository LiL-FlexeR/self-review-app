import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { HTTP_ERROR_CODE, HTTP_ERROR_MESSAGE } from '@self-review/contracts';
import { JiraCredentials, LinearCredentials } from '@self-review/contracts';
import type { TLiveConnectionCommand, TTrackerCredentials } from '@self-review/contracts';
import { parse } from '@app/utils/http';
import { ClickUpService } from '@app/modules/providers/adapters/clickup/clickup.service';
import { JiraService } from '@app/modules/providers/adapters/jira/jira.service';
import { DatabaseService } from '@app/shared/database/database.service';
import { ConfigService } from '@app/shared/config/config.service';
import { LinearService } from '@app/modules/providers/adapters/linear/services/linear.service';
import { CredentialsService } from '@app/shared/credentials/credentials.service';
import type { Prisma } from '@app/generated/prisma/client';

@Injectable()
export class ConnectionsService {
	constructor(
		@Inject(DatabaseService) private readonly database: DatabaseService,
		@Inject(ConfigService) private readonly configuration: ConfigService,
		@Inject(LinearService) private readonly linear: LinearService,
		@Inject(ClickUpService) private readonly clickup: ClickUpService,
		@Inject(JiraService) private readonly jira: JiraService,
		@Inject(CredentialsService) private readonly credentials: CredentialsService,
	) {}

	async add(ownerId: string, command: TLiveConnectionCommand) {
		if (this.configuration.get('APP_MODE') !== 'live') {
			throw new BadRequestException({
				code: HTTP_ERROR_CODE.MODE_UNAVAILABLE,
				message: HTTP_ERROR_MESSAGE.MODE_UNAVAILABLE,
				retryable: false,
			});
		}
		const identity = await this.verify(command.provider, command.credentials);
		const id = randomUUID();
		try {
			return await this.database.client.connection.create({
				data: {
					id,
					ownerId,
					provider: command.provider,
					mode: 'live',
					displayName: command.displayName,
					...identity,
					encryptedCredentials: this.credentials.encrypt(
						ownerId,
						id,
						command.credentials,
					),
				},
			});
		} catch (error) {
			if (
				typeof error === 'object' &&
				error !== null &&
				'code' in error &&
				error.code === 'P2002'
			) {
				throw new ConflictException({
					code: HTTP_ERROR_CODE.CONNECTION_CONFLICT,
					message: HTTP_ERROR_MESSAGE.CONNECTION_CONFLICT,
					retryable: false,
				});
			}
			throw error;
		}
	}

	private async verify(provider: string, credentials: TTrackerCredentials) {
		if (provider === 'jira') {
			return this.jira.identity(parse(JiraCredentials, credentials));
		}
		const { token } = parse(LinearCredentials, credentials);
		if (provider === 'clickup') {
			return this.clickup.identity(token);
		}
		const identity = await this.linear.identity(token);
		return {
			sourceUserId: identity.viewer.id,
			sourceUserName: identity.viewer.name,
			sourceScopeId: identity.organization.id,
			sourceBaseUrl: null,
		};
	}

	async owned(ownerId: string, id: string) {
		const connection = await this.database.client.connection.findFirst({
			where: { id, ownerId },
		});
		if (!connection) {
			throw new NotFoundException({
				code: HTTP_ERROR_CODE.RESOURCE_NOT_FOUND,
				message: HTTP_ERROR_MESSAGE.RESOURCE_NOT_FOUND,
				retryable: false,
			});
		}
		return connection;
	}

	async replace(ownerId: string, id: string, credentials: TTrackerCredentials) {
		const previous = await this.owned(ownerId, id);
		if (
			!['linear', 'clickup', 'jira'].includes(previous.provider) ||
			this.configuration.get('APP_MODE') !== 'live'
		) {
			throw new BadRequestException({
				code: HTTP_ERROR_CODE.MODE_UNAVAILABLE,
				message: HTTP_ERROR_MESSAGE.MODE_UNAVAILABLE,
				retryable: false,
			});
		}
		const identity = await this.verify(previous.provider, credentials);
		return this.database.client.$transaction(async (transaction) => {
			await this.lock(transaction, id);
			const current = await transaction.connection.findFirst({ where: { id, ownerId } });
			if (!current) {
				throw new NotFoundException({
					code: HTTP_ERROR_CODE.RESOURCE_NOT_FOUND,
					message: HTTP_ERROR_MESSAGE.RESOURCE_NOT_FOUND,
					retryable: false,
				});
			}
			if (
				identity.sourceUserId !== current.sourceUserId ||
				identity.sourceScopeId !== current.sourceScopeId
			) {
				throw new ConflictException({
					code: HTTP_ERROR_CODE.CONNECTION_IDENTITY_MISMATCH,
					message: HTTP_ERROR_MESSAGE.CONNECTION_IDENTITY_MISMATCH,
					retryable: false,
				});
			}
			return transaction.connection.update({
				where: { id },
				data: {
					encryptedCredentials: this.credentials.encrypt(ownerId, id, credentials),
					credentialVersion: { increment: 1 },
					sourceUserName: identity.sourceUserName,
					sourceBaseUrl: identity.sourceBaseUrl,
					verifiedAt: new Date(),
					status: 'active',
				},
			});
		});
	}

	async remove(ownerId: string, id: string) {
		await this.owned(ownerId, id);
		await this.database.client.$transaction(async (transaction) => {
			await this.lock(transaction, id);
			const active = await transaction.jobRun.count({
				where: { project: { connectionId: id }, state: { in: ['queued', 'running'] } },
			});
			if (active) {
				throw new ConflictException({
					code: HTTP_ERROR_CODE.CONNECTION_BUSY,
					message: HTTP_ERROR_MESSAGE.CONNECTION_BUSY,
					retryable: false,
				});
			}
			await transaction.connection.deleteMany({ where: { id, ownerId } });
		});
	}

	private async lock(transaction: Prisma.TransactionClient, id: string) {
		await transaction.$queryRaw`SELECT id FROM connections WHERE id=${id}::uuid FOR UPDATE`;
	}
}
