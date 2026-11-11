import { spawnSync } from 'node:child_process';
import { testEnv } from './test-env.mjs';

const result = spawnSync('npm', ['run', 'migrate', '-w', 'backend'], {
	stdio: 'inherit',
	env: testEnv,
});

process.exit(result.status ?? 1);
