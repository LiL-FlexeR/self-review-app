import { z as zod } from 'zod';
import { ProviderError } from '@app/errors/provider.error';
import { sourceText, validateProvider } from '@app/modules/providers/utils';

const Node = zod.object({
	type: zod.string(),
	text: zod.string().optional(),
	attrs: zod.record(zod.string(), zod.unknown()).optional(),
	content: zod.array(zod.unknown()).optional(),
});

export function adfText(value: unknown): string {
	if (value === null) {
		return '';
	}
	const root = validateProvider(
		Node.extend({ type: zod.literal('doc'), version: zod.literal(1) }),
		value,
	);
	function read(input: unknown, depth: number): string {
		if (depth > 64) {
			throw new ProviderError('PROVIDER_RESPONSE_INVALID');
		}
		const node = validateProvider(Node, input);
		if (node.type === 'text') {
			if (node.text === undefined) {
				throw new ProviderError('PROVIDER_RESPONSE_INVALID');
			}
			return node.text;
		}
		if (node.type === 'hardBreak') {
			return '\n';
		}
		if (node.type === 'mention' || node.type === 'emoji' || node.type === 'status') {
			const text = node.attrs?.text ?? node.attrs?.shortName;
			return typeof text === 'string' ? text : '[inline content unavailable]';
		}
		if (
			[
				'media',
				'mediaInline',
				'inlineCard',
				'blockCard',
				'embedCard',
				'extension',
				'inlineExtension',
			].includes(node.type)
		) {
			return '[embedded content omitted]';
		}
		if (node.type === 'date') {
			const timestamp = Number(node.attrs?.timestamp);
			return Number.isFinite(timestamp) && Number.isFinite(new Date(timestamp).getTime())
				? new Date(timestamp).toISOString()
				: '[date unavailable]';
		}
		const text = (node.content ?? []).map((child) => read(child, depth + 1)).join('');
		if (
			[
				'paragraph',
				'heading',
				'codeBlock',
				'blockquote',
				'listItem',
				'tableRow',
				'rule',
			].includes(node.type)
		) {
			return text + '\n';
		}
		if (['tableCell', 'tableHeader'].includes(node.type)) {
			return text + '\t';
		}
		return text;
	}
	return sourceText(read(root, 0)).trimEnd();
}

export function jiraOrigin(value: unknown): string | null {
	if (typeof value !== 'string') {
		return null;
	}
	try {
		const url = new URL(value);
		if (
			url.protocol === 'https:' &&
			/^[a-z0-9-]+\.atlassian\.net$/.test(url.hostname) &&
			!url.username &&
			!url.password &&
			!url.port &&
			url.pathname === '/' &&
			!url.search &&
			!url.hash
		) {
			return url.origin;
		}
	} catch {
		/* Unverified URLs never become source links. */
	}
	return null;
}
