import { docker } from './docker.mjs';

const cmd = process.argv[2];

if (!['up', 'down'].includes(cmd)) {
	throw Error('Expected up/down');
}

docker([
	'compose',
	'-p',
	'self-review-infra',
	'-f',
	'compose.infra.yaml',
	...(cmd === 'up' ? ['up', '-d', '--wait', ...process.argv.slice(3)] : ['down']),
]);
