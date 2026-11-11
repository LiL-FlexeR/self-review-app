import { spawnSync } from 'node:child_process';
import { testEnv } from './test-env.mjs';

const result = spawnSync(
	'npx',
	['--no-install', 'vitest', 'run', '--config', 'vitest.integration.config.ts'],
	{ stdio: 'inherit', env: testEnv },
);

process.exit(result.status ?? 1);
