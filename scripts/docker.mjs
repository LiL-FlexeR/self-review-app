import { spawnSync } from 'node:child_process';

export function docker(args) {
	const env = { ...process.env };
	const host = env.SELF_REVIEW_DOCKER_HOST;

	if (host) {
		for (const key of [
			'DOCKER_HOST',
			'DOCKER_CONTEXT',
			'DOCKER_TLS',
			'DOCKER_TLS_VERIFY',
			'DOCKER_CERT_PATH',
		]) {
			delete env[key];
		}
	}

	const result = spawnSync('docker', [...(host ? ['--host=' + host] : []), ...args], {
		stdio: 'inherit',
		env,
	});

	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}
