import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const tokens = JSON.parse(readFileSync('docs/design/tokens.json', 'utf8'));

for (const file of [
	'docs/design/variables.css',
	'docs/design/theme.css',
	'frontend/src/styles/globals.css',
]) {
	const css = readFileSync(file, 'utf8');

	for (const [name, token] of Object.entries(tokens.color)) {
		assert(css.includes(`--color-${name}: ${token.$value};`), `${file}: ${name}`);
	}
	for (const [name, token] of Object.entries(tokens.spacing)) {
		if (name === 'unit') {
			continue;
		}

		assert(css.includes(`--spacing-ref-${name}: ${token.$value};`), `${file}: spacing ${name}`);
		assert(!css.includes(`--spacing-${name}:`), `${file}: Tailwind spacing collision`);
	}
	for (const [name, token] of Object.entries(tokens.radius)) {
		assert(css.includes(`--radius-${name}: ${token.$value};`), `${file}: radius ${name}`);
	}
	for (const [role, value] of Object.entries({
		caption: '1.5',
		'body-sm': '1.33',
		body: '1.43',
		'body-lg': '1.5',
	})) {
		assert(css.includes(`--leading-${role}: ${value};`), `${file}: ${role}`);
	}
}

function luminance(hex) {
	const rgb = hex
		.match(/\w\w/g)
		.map((channel) => parseInt(channel, 16) / 255)
		.map((intensity) =>
			intensity <= 0.04045 ? intensity / 12.92 : ((intensity + 0.055) / 1.055) ** 2.4,
		);

	return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

const contrast = (foreground, background) =>
	(Math.max(luminance(foreground), luminance(background)) + 0.05) /
	(Math.min(luminance(foreground), luminance(background)) + 0.05);

for (const [foreground, background] of [
	['72706b', 'faf8f5'],
	['72706b', 'fdfbfa'],
	['27251e', 'faf8f5'],
	['ffffff', '016a71'],
]) {
	const ratio = contrast(foreground, background);

	assert(ratio >= 4.5);
	console.info(`${foreground}/${background}: ${ratio.toFixed(2)}:1`);
}

console.info('Theme references and essential text contrast verified.');
