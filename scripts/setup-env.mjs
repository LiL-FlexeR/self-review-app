import { readFileSync, writeFileSync, existsSync, renameSync, chmodSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const rootDirectory = new URL('../', import.meta.url);
const legacyEnvPath = new URL('.env', rootDirectory);
const backendEnvPath = new URL('backend/.env', rootDirectory);

if (existsSync(legacyEnvPath)) {
	if (existsSync(backendEnvPath)) {
		throw Error(
			'Both .env and backend/.env exist. Resolve the duplicate before running setup.',
		);
	}

	// Keep existing signing/encryption keys so sessions and stored credentials remain usable.
	renameSync(legacyEnvPath, backendEnvPath);
	chmodSync(backendEnvPath, 0o600);
	console.info('Moved existing .env to backend/.env; all values preserved.');
}

for (const workspace of ['backend', 'frontend']) {
	const envPath = new URL(workspace + '/.env', rootDirectory);

	if (existsSync(envPath)) {
		console.info(workspace + '/.env already exists; preserved.');
		continue;
	}

	let content = readFileSync(new URL(workspace + '/.env.example', rootDirectory), 'utf8');

	if (workspace === 'backend') {
		for (const key of ['AUTH_SECRET', 'JWT_SECRET', 'TOKEN_ENCRYPTION_KEY']) {
			content = content.replace(
				new RegExp('^' + key + '=$', 'm'),
				key + '=' + randomBytes(32).toString('base64'),
			);
		}
	}

	writeFileSync(envPath, content, { mode: 0o600, flag: 'wx' });

	console.info('Created ' + workspace + '/.env.');
}
