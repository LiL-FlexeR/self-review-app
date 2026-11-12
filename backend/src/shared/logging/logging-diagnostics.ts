import type { TClaim, TSource } from '@self-review/contracts';
import type { ILogFields } from './logging.interfaces.js';

// Detailed validation diagnostics are explicitly requested for server logs.
// Keep their shape bounded and redact credentials even inside source quotations.
export function diagnosticText(value: string, maximumCharacters = 2048): string {
	let redacted = value;
	for (const name of [
		'OPENAI_API_KEY',
		'AUTH_SECRET',
		'JWT_SECRET',
		'TOKEN_ENCRYPTION_KEY',
		'SMTP_PASSWORD',
		'DATABASE_URL',
		'REDIS_URL',
	]) {
		const secret = process.env[name];
		if (secret && secret.length >= 4) {
			redacted = redacted.replaceAll(secret, '[REDACTED]');
		}
	}
	redacted = redacted
		.replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[REDACTED]')
		.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED]')
		.replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+\/-]+=*/gi, '$1 [REDACTED]')
		.replace(/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]*@/gi, '$1[REDACTED]@')
		.replace(
			/\b((?:OPENAI_API_KEY|AUTH_SECRET|JWT_SECRET|TOKEN_ENCRYPTION_KEY|SMTP_PASSWORD|password|api[_-]?key|(?:access|refresh|csrf)[_-]?token|otp|secret)["']?\s*[:=]\s*)["']?[^\s,"'}]+["']?/gi,
			'$1[REDACTED]',
		);
	const characters = Array.from(redacted);
	if (characters.length > maximumCharacters) {
		return characters.slice(0, maximumCharacters).join('') + '[TRUNCATED]';
	}
	return redacted;
}

function evidenceDetails(evidence: TClaim['evidence'][number]) {
	return {
		sourceId: diagnosticText(evidence.sourceId, 512),
		quote: diagnosticText(evidence.quote, 512),
	};
}

function sourceDetails(source: TSource) {
	return {
		id: diagnosticText(source.id, 512),
		kind: diagnosticText(source.kind, 32),
		state: diagnosticText(source.state, 64),
		textExcerpt: diagnosticText(source.textExcerpt),
		truncated: source.truncated,
	};
}

export function validationLogDetails(fields: ILogFields): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	if (fields.claim) {
		result.claim = {
			kind: diagnosticText(fields.claim.kind, 32),
			text: diagnosticText(fields.claim.text, 512),
			evidence: fields.claim.evidence.slice(0, 2).map(evidenceDetails),
		};
	}
	if (fields.evidence) {
		result.evidence = evidenceDetails(fields.evidence);
	}
	if (fields.source) {
		result.source = sourceDetails(fields.source);
	}
	if (fields.sources) {
		result.sources = fields.sources.slice(0, 2).map(sourceDetails);
	}
	if (fields.childEvidence) {
		result.childEvidence = fields.childEvidence.slice(0, 8).map(evidenceDetails);
	}
	if (fields.availableSourceIds) {
		result.availableSourceIds = fields.availableSourceIds
			.slice(0, 20)
			.map((sourceId) => diagnosticText(sourceId, 512));
		result.availableSourceIdsTruncated = fields.availableSourceIds.length > 20;
	}
	if (typeof fields.quoteFoundIgnoringWhitespace === 'boolean') {
		result.quoteFoundIgnoringWhitespace = fields.quoteFoundIgnoringWhitespace;
	}
	return result;
}
