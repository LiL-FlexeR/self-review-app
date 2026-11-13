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
	for (const [name, token] of Object.entries(tokens.layout)) {
		assert(css.includes(`--${name}: ${token.$value};`), `${file}: layout ${name}`);
	}
	for (const [name, token] of Object.entries(tokens.shape)) {
		assert(css.includes(`--radius-${name}: ${token.$value};`), `${file}: shape ${name}`);
	}
	for (const role of [
		'page',
		'page-small',
		'section',
		'component',
		'report',
		'ui',
		'metadata',
		'identifier',
	]) {
		const value = tokens.typography[role].$value;
		assert(css.includes(`--text-${role}: ${value.fontSize};`), `${file}: type ${role}`);
		assert(
			css.includes(`--text-${role}--line-height: ${value.lineHeight};`),
			`${file}: leading ${role}`,
		);
		assert(
			css.includes(`--text-${role}--font-weight: ${value.fontWeight};`),
			`${file}: weight ${role}`,
		);
	}
	for (const [name, token] of Object.entries(tokens.semantic)) {
		const value = token.$value;
		const mapped = value.startsWith('{')
			? `var(--${value.slice(1, -1).replace('.', '-')})`
			: value;
		assert(
			css.includes(`--${name}: ${mapped};`) ||
				(file.endsWith('theme.css') && css.includes(`--color-${name}: var(--${name});`)),
			`${file}: semantic ${name}`,
		);
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

function resolveSemanticColor(name) {
	const value = tokens.semantic[name].$value;

	return value.startsWith('{') ? tokens.color[value.slice(7, -1)].$value : value;
}

for (const [foreground, background] of [
	['input', 'background'],
	['control-border', 'surface'],
	['ring', 'background'],
	['success', 'success-surface'],
	['warning', 'warning-surface'],
	['error', 'error-surface'],
	['destructive-foreground', 'destructive'],
]) {
	const minimum = ['input', 'control-border', 'ring'].includes(foreground) ? 3 : 4.5;

	assert(
		contrast(resolveSemanticColor(foreground), resolveSemanticColor(background)) >= minimum,
		`${foreground}/${background}`,
	);
}

console.info('Theme references, typography, semantic states and essential contrast verified.');
