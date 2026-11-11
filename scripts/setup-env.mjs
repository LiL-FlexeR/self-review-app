import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

if (existsSync('.env')) {
	console.info('.env already exists; preserved.');
	process.exit(0);
}

let content = readFileSync('.env.example', 'utf8');

for (const key of ['AUTH_SECRET', 'JWT_SECRET', 'TOKEN_ENCRYPTION_KEY']) {
	content = content.replace(
		new RegExp('^' + key + '=$', 'm'),
		key + '=' + randomBytes(32).toString('base64'),
	);
}

writeFileSync('.env', content, { mode: 0o600, flag: 'wx' });

console.info('Created local .env with independent secrets.');
