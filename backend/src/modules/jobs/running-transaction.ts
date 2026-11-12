import type { Prisma } from '@app/generated/prisma/client';
import type { TDatabase } from '@app/shared/database/database';
import { AppLogger } from '@app/shared/logging/logger';

const logger = new AppLogger('RunningTransaction');

export async function inRunningRun<TResult>(
	database: TDatabase,
	runId: string,
	operation: (transaction: Prisma.TransactionClient) => Promise<TResult>,
) {
	return database.$transaction(async (transaction) => {
		const rows = await transaction.$queryRaw<
			{ state: string }[]
		>`SELECT state FROM job_runs WHERE id=${runId}::uuid FOR UPDATE`;
		if (rows[0]?.state !== 'running') {
			logger.error('operation_rejected', { reason: 'RUN_INTERRUPTED' });
			throw new Error('RUN_INTERRUPTED');
		}
		return operation(transaction);
	});
}
