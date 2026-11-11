import { defineConfig } from 'prisma/config';

export default defineConfig({
	schema: 'prisma/schema.prisma',
	migrations: { path: 'prisma/migrations' },
	datasource: {
		url:
			process.env.DATABASE_URL ??
			'postgresql://self_review:local_dev@localhost:5432/self_review',
	},
});
