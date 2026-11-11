import { PrismaClient } from '@app/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

export function database(url: string) {
	return new PrismaClient({
		adapter: new PrismaPg({
			connectionString: url,
			connectionTimeoutMillis: 3000,
		}),
	});
}

export type TDatabase = ReturnType<typeof database>;
