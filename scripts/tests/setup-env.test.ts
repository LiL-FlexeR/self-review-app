import { afterEach, beforeEach, expect, it } from 'vitest';
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseEnv } from 'node:util';

let fixtureDirectory = '';

beforeEach(() => {
	fixtureDirectory = mkdtempSync(join(tmpdir(), 'self-review-setup-'));

	for (const workspace of ['backend', 'frontend', 'scripts']) {
		mkdirSync(join(fixtureDirectory, workspace));
	}

	for (const file of ['scripts/setup-env.mjs', 'backend/.env.example', 'frontend/.env.example']) {
		copyFileSync(new URL('../../' + file, import.meta.url), join(fixtureDirectory, file));
	}
});

afterEach(() => {
	rmSync(fixtureDirectory, { recursive: true, force: true });
});

function runSetup() {
	return spawnSync(process.execPath, [join(fixtureDirectory, 'scripts/setup-env.mjs')], {
		cwd: tmpdir(),
		encoding: 'utf8',
	});
}

it('creates separate env files with independent backend secrets from any working directory', () => {
	const result = runSetup();

	expect(result.status).toBe(0);
	const backend = parseEnv(readFileSync(join(fixtureDirectory, 'backend/.env'), 'utf8'));
	const frontend = parseEnv(readFileSync(join(fixtureDirectory, 'frontend/.env'), 'utf8'));
	const secrets = [backend.AUTH_SECRET, backend.JWT_SECRET, backend.TOKEN_ENCRYPTION_KEY];

	expect(new Set(secrets).size).toBe(3);

	for (const secret of secrets) {
		expect(Buffer.from(secret, 'base64').length).toBe(32);
		expect(result.stdout + result.stderr).not.toContain(secret);
	}

	expect(frontend).toEqual({ DEV_API_PORT: '3000' });
	expect(existsSync(join(fixtureDirectory, '.env'))).toBe(false);
	expect(statSync(join(fixtureDirectory, 'backend/.env')).mode & 0o777).toBe(0o600);
});

it('moves the legacy env byte for byte without rotating signing or encryption keys', () => {
	const legacy =
		'AUTH_SECRET=synthetic-auth\nJWT_SECRET=synthetic-jwt\nTOKEN_ENCRYPTION_KEY=synthetic-encryption\nOPENAI_API_KEY=synthetic-model-key\n';
	writeFileSync(join(fixtureDirectory, '.env'), legacy);

	const result = runSetup();

	expect(result.status).toBe(0);
	expect(readFileSync(join(fixtureDirectory, 'backend/.env'), 'utf8')).toBe(legacy);
	expect(existsSync(join(fixtureDirectory, '.env'))).toBe(false);
	expect(existsSync(join(fixtureDirectory, 'frontend/.env'))).toBe(true);
	expect(result.stdout + result.stderr).not.toContain('synthetic-');
});

it('preserves existing workspace configuration across repeated setup runs', () => {
	writeFileSync(join(fixtureDirectory, 'backend/.env'), 'AUTH_SECRET=synthetic-existing\n');

	expect(runSetup().status).toBe(0);
	writeFileSync(join(fixtureDirectory, 'frontend/.env'), 'DEV_API_PORT=3002\n');
	expect(runSetup().status).toBe(0);
	expect(readFileSync(join(fixtureDirectory, 'backend/.env'), 'utf8')).toBe(
		'AUTH_SECRET=synthetic-existing\n',
	);
	expect(readFileSync(join(fixtureDirectory, 'frontend/.env'), 'utf8')).toBe(
		'DEV_API_PORT=3002\n',
	);
});

it('rejects ambiguous legacy and backend files without overwriting either', () => {
	writeFileSync(join(fixtureDirectory, '.env'), 'AUTH_SECRET=synthetic-legacy\n');
	writeFileSync(join(fixtureDirectory, 'backend/.env'), 'AUTH_SECRET=synthetic-existing\n');

	const result = runSetup();

	expect(result.status).not.toBe(0);
	expect(result.stderr).toContain('Both .env and backend/.env exist');
	expect(readFileSync(join(fixtureDirectory, '.env'), 'utf8')).toBe(
		'AUTH_SECRET=synthetic-legacy\n',
	);
	expect(readFileSync(join(fixtureDirectory, 'backend/.env'), 'utf8')).toBe(
		'AUTH_SECRET=synthetic-existing\n',
	);
	expect(existsSync(join(fixtureDirectory, 'frontend/.env'))).toBe(false);
	expect(result.stdout + result.stderr).not.toContain('synthetic-');
});
