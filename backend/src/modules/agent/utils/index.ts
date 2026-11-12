import type { TClaim, TSource, TReportDraft } from '@self-review/contracts';
import type { TAnalysis } from '@app/modules/agent/agent.schemas';
import { AppLogger } from '@app/shared/logging/logger';
import type { ILogFields } from '@app/shared/logging/logging.interfaces';
import { EvidenceValidationError } from '@app/modules/agent/evidence-validation.error';
import type { TEvidenceValidationReason } from '@app/modules/agent/agent.types';
import { excerpt } from '@app/utils/excerpt';

const logger = new AppLogger('AgentEvidence');

function rejectEvidence(
	reason: TEvidenceValidationReason,
	details: ILogFields & { claimIndex: number },
): never {
	logger.error('evidence_validation_failed', { ...details, reason });
	throw new EvidenceValidationError({
		reason,
		claimIndex: details.claimIndex,
		evidenceIndex: details.evidenceIndex,
		sourceId: details.evidence?.sourceId,
		quote: details.evidence?.quote,
		sourceKind: details.source?.kind,
		sourceState: details.source?.state,
	});
}

export function validateEvidence(
	result: TAnalysis | TReportDraft,
	sources: TSource[],
	childClaims?: TClaim[],
) {
	const claims =
		'findings' in result ? result.findings : result.groups.flatMap((group) => group.claims);
	for (const [claimIndex, claim] of claims.entries()) {
		let substantive = false;
		for (const [evidenceIndex, evidence] of claim.evidence.entries()) {
			const source = sources.find((item) => item.id === evidence.sourceId);
			const quote = evidence.quote.replace(/\r\n/g, '\n').replace(/\0/g, '');
			const details = {
				claim,
				evidence,
				source,
				claimIndex,
				evidenceIndex,
				quoteLength: quote.length,
				sourceExcerptLength: source?.textExcerpt.length,
			};
			if (!quote.trim()) {
				rejectEvidence('EMPTY_QUOTE', {
					...details,
				});
			}
			if (!source) {
				rejectEvidence('SOURCE_NOT_EXPOSED', {
					...details,
					availableSourceCount: sources.length,
					availableSourceIds: sources.map((item) => item.id),
				});
			}
			if (!source.textExcerpt.trim()) {
				rejectEvidence('EMPTY_SOURCE', details);
			}
			if (!source.textExcerpt.includes(quote)) {
				const normalizedQuote = quote.replace(/\s+/gu, ' ').trim();
				rejectEvidence('QUOTE_NOT_FOUND', {
					...details,
					quoteFoundIgnoringWhitespace:
						Boolean(normalizedQuote) &&
						source.textExcerpt.replace(/\s+/gu, ' ').trim().includes(normalizedQuote),
				});
			}
			if (
				childClaims &&
				!childClaims.some((child) =>
					child.evidence.some(
						(pair) =>
							pair.sourceId === evidence.sourceId && pair.quote === evidence.quote,
					),
				)
			) {
				rejectEvidence('REDUCER_EVIDENCE_NOT_IN_CHILD', {
					...details,
					childEvidence: childClaims
						.flatMap((child) => child.evidence)
						.filter((pair) => pair.sourceId === evidence.sourceId),
				});
			}
			if (source.kind !== 'metadata') {
				substantive = true;
			}
			if (
				claim.kind !== 'task_description' &&
				['started', 'canceled', 'backlog'].includes(source.state)
			) {
				rejectEvidence('TASK_STATE_NOT_RESULT', {
					...details,
				});
			}
		}
		if (claim.kind !== 'task_description' && !substantive) {
			rejectEvidence('METADATA_ONLY_RESULT', {
				claim,
				sources: sources.filter((source) =>
					claim.evidence.some((pair) => pair.sourceId === source.id),
				),
				claimIndex,
			});
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
			rejectEvidence('MEASUREMENT_WITHOUT_DIGITS', {
				claim,
				sources: sources.filter((source) =>
					claim.evidence.some((pair) => pair.sourceId === source.id),
				),
				claimIndex,
			});
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
		if (!source.textExcerpt.trim()) {
			continue;
		}
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
		if (
			!candidate.textExcerpt.trim() ||
			Buffer.byteLength(JSON.stringify([...supplied, candidate])) > maxBytes
		) {
			omittedSourceIds.push(source.id);
		} else {
			supplied.push(candidate);
		}
	}
	return { sources: supplied, omittedSourceIds };
}
