import type { TClaim, TSource, TReportDraft } from '@self-review/contracts';
import type { TAnalysis } from './agent.schemas.js';
import type { Prisma } from '@app/generated/prisma/client';

export function json(value: unknown): Prisma.InputJsonValue {
	return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function excerpt(text: string, bytes = 1024) {
	let result = '';
	for (const character of text.replace(/\r\n/g, '\n').replace(/\0/g, '')) {
		if (Buffer.byteLength(result + character) > bytes) {
			break;
		}
		result += character;
	}
	return result;
}

export function validateEvidence(
	result: TAnalysis | TReportDraft,
	sources: TSource[],
	childClaims?: TClaim[],
) {
	const claims =
		'findings' in result ? result.findings : result.groups.flatMap((group) => group.claims);
	for (const claim of claims) {
		let substantive = false;
		for (const evidence of claim.evidence) {
			const source = sources.find((item) => item.id === evidence.sourceId);
			const quote = evidence.quote.replace(/\r\n/g, '\n').replace(/\0/g, '');
			if (
				!quote ||
				!source ||
				!source.textExcerpt.includes(quote) ||
				(childClaims &&
					!childClaims.some((child) =>
						child.evidence.some(
							(pair) =>
								pair.sourceId === evidence.sourceId &&
								pair.quote === evidence.quote,
						),
					))
			) {
				throw new Error('INVALID_MODEL_OUTPUT');
			}
			if (source.kind !== 'metadata') {
				substantive = true;
			}
			if (
				claim.kind !== 'task_description' &&
				['started', 'canceled', 'backlog'].includes(source.state)
			) {
				throw new Error('INVALID_MODEL_OUTPUT');
			}
		}
		if (claim.kind !== 'task_description' && !substantive) {
			throw new Error('INVALID_MODEL_OUTPUT');
		}
		if (
			claim.kind === 'reported_measurement' &&
			!claim.evidence.some(
				(pair) =>
					/\d/.test(pair.quote) &&
					sources.some(
						(source) => source.id === pair.sourceId && source.kind !== 'metadata',
					),
			)
		) {
			throw new Error('INVALID_MODEL_OUTPUT');
		}
	}
}

function escapeMarkdown(text: string) {
	return text.replace(/[\\`*_{}\[\]()<>#!|]/g, '\\$&');
}

export function markdown(draft: TReportDraft, sources: TSource[]) {
	const sections = draft.groups.map(
		(group) =>
			`## ${escapeMarkdown(group.title)}\n\n` +
			group.claims
				.map(
					(claim) =>
						`- ${escapeMarkdown(claim.text)} (${claim.kind})\n` +
						claim.evidence
							.map(
								(pair) =>
									`  > ${escapeMarkdown(pair.quote)}\n  Source: ${escapeMarkdown(pair.sourceId)}`,
							)
							.join('\n'),
				)
				.join('\n\n'),
	);
	return [
		'# Self-review draft',
		...sections,
		'## Limitations',
		...draft.limitations.map((item) => `- ${escapeMarkdown(item)}`),
		escapeMarkdown(draft.explanation),
		`Saved source references: ${sources.length}`,
	].join('\n\n');
}

export function boundSources(sources: TSource[], maxBytes: number) {
	const supplied: TSource[] = [];
	const omittedSourceIds: string[] = [];
	for (const source of sources) {
		let candidate = { ...source };
		while (
			Buffer.byteLength(JSON.stringify([...supplied, candidate])) > maxBytes &&
			candidate.textExcerpt.length
		) {
			candidate = {
				...candidate,
				textExcerpt: excerpt(
					candidate.textExcerpt,
					Math.max(0, Buffer.byteLength(candidate.textExcerpt) - 128),
				),
				truncated: true,
			};
		}
		if (Buffer.byteLength(JSON.stringify([...supplied, candidate])) > maxBytes) {
			omittedSourceIds.push(source.id);
		} else {
			supplied.push(candidate);
		}
	}
	return { sources: supplied, omittedSourceIds };
}
