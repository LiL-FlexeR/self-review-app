import { docker } from './docker.mjs';

docker(['compose', '--env-file', '.env', '-f', 'compose.yaml', ...process.argv.slice(2)]);
