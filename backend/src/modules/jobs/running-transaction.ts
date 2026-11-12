import type { Prisma } from '@app/generated/prisma/client';
import type { TDatabase } from '@app/shared/database/database';

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
			throw new Error('RUN_INTERRUPTED');
		}
		return operation(transaction);
	});
}
