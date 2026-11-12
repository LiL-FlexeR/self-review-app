import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { HTTP_ERROR_CODE, HTTP_ERROR_MESSAGE } from '@self-review/contracts';
import type { TLinearConnectionCommand } from '@self-review/contracts';
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
		@Inject(CredentialsService) private readonly credentials: CredentialsService,
	) {}

	async add(ownerId: string, command: TLinearConnectionCommand) {
		if (this.configuration.get('APP_MODE') !== 'live') {
			throw new BadRequestException({
				code: HTTP_ERROR_CODE.MODE_UNAVAILABLE,
				message: HTTP_ERROR_MESSAGE.MODE_UNAVAILABLE,
				retryable: false,
			});
		}
		const identity = await this.linear.identity(command.credentials.token);
		const id = randomUUID();
		try {
			return await this.database.client.connection.create({
				data: {
					id,
					ownerId,
					provider: 'linear',
					mode: 'live',
					displayName: command.displayName,
					sourceUserId: identity.viewer.id,
					sourceUserName: identity.viewer.name,
					sourceScopeId: identity.organization.id,
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

	async replace(
		ownerId: string,
		id: string,
		credentials: TLinearConnectionCommand['credentials'],
	) {
		const previous = await this.owned(ownerId, id);
		if (previous.provider !== 'linear' || this.configuration.get('APP_MODE') !== 'live') {
			throw new BadRequestException({
				code: HTTP_ERROR_CODE.MODE_UNAVAILABLE,
				message: HTTP_ERROR_MESSAGE.MODE_UNAVAILABLE,
				retryable: false,
			});
		}
		const identity = await this.linear.identity(credentials.token);
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
				identity.viewer.id !== current.sourceUserId ||
				identity.organization.id !== current.sourceScopeId
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
					sourceUserName: identity.viewer.name,
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
