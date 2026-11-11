import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import { fileURLToPath } from 'node:url';
export default defineConfig({
	resolve: {
		alias: {
			'@app': fileURLToPath(new URL('./backend/src', import.meta.url)),
		},
	},
	plugins: [
		swc.vite({
			jsc: {
				target: 'es2023',
				parser: { syntax: 'typescript', decorators: true },
				transform: { legacyDecorator: true, decoratorMetadata: true },
			},
		}),
	],
	test: {
		include: ['backend/test/**/*.integration.test.ts'],
		exclude: [],
		testTimeout: 30000,
		hookTimeout: 30000,
		fileParallelism: false,
	},
});
