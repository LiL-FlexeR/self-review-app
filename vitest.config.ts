import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import { fileURLToPath } from 'node:url';
export default defineConfig({
	plugins: [
		swc.vite({
			jsc: {
				target: 'es2023',
				parser: { syntax: 'typescript', tsx: true, decorators: true },
				transform: {
					legacyDecorator: true,
					decoratorMetadata: true,
					react: { runtime: 'automatic' },
				},
			},
		}),
	],
	test: {
		exclude: ['**/*.integration.test.ts'],
		fileParallelism: false,
		projects: [
			{
				extends: true,
				test: { name: 'scripts', include: ['scripts/tests/**/*.test.ts'] },
			},
			{
				extends: true,
				resolve: {
					alias: { '@app': fileURLToPath(new URL('./backend/src', import.meta.url)) },
				},
				test: { name: 'backend', include: ['backend/src/**/*.test.ts'] },
			},
			{
				extends: true,
				resolve: {
					alias: { '@app': fileURLToPath(new URL('./frontend/src', import.meta.url)) },
				},
				test: { name: 'frontend', include: ['frontend/tests/**/*.test.{ts,tsx}'] },
			},
			{
				extends: true,
				resolve: {
					alias: { '@app': fileURLToPath(new URL('./contracts/src', import.meta.url)) },
				},
				test: { name: 'contracts', include: ['contracts/src/**/*.test.ts'] },
			},
		],
	},
});
