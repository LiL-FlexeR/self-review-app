import { expect, it } from 'vitest';
import { z as zod } from 'zod';
import { randomUUID } from 'node:crypto';
import type { TSource } from '@self-review/contracts';
import { boundSources } from '@app/modules/agent/agent.utils';
import { EvidenceValidationError } from '@app/modules/agent/evidence-validation.error';
import { outputCorrection } from '@app/modules/agent/output-correction';

const source: TSource = {
	id: 'sync:synthetic:issue:DEMO-108:description',
	taskSnapshotId: randomUUID(),
	kind: 'description',
	textExcerpt: '',
	url: null,
	createdAt: null,
	updatedAt: null,
	retrievedAt: new Date().toISOString(),
	truncated: false,
	state: 'completed',
};

it('excludes empty and whitespace-only excerpts while retaining usable metadata', () => {
	const metadata = {
		...source,
		id: 'metadata',
		kind: 'metadata' as const,
		textExcerpt: 'Title: Demo task\nStatus: completed',
	};
	const result = boundSources([source, { ...source, textExcerpt: ' \r\n\t' }, metadata], 32768);
	expect(result.sources).toEqual([metadata]);
});

it('marks a source omitted when byte truncation removes all usable text', () => {
	const maximumBytes = Buffer.byteLength(JSON.stringify([{ ...source, truncated: true }]));
	const result = boundSources(
		[{ ...source, textExcerpt: 'Text that cannot fit in this byte budget.' }],
		maximumBytes,
	);
	expect(result.sources).toEqual([]);
	expect(result.omittedSourceIds).toEqual([source.id]);
});

it('preserves the public failure code and gives correction the actual rejected reference', () => {
	const error = new EvidenceValidationError({
		reason: 'QUOTE_NOT_FOUND',
		claimIndex: 4,
		evidenceIndex: 0,
		sourceId: source.id,
		quote: ',',
	});
	expect(error.message).toBe('INVALID_MODEL_OUTPUT');
	const correction = outputCorrection(error);
	expect(JSON.parse(correction.split('\n')[1]!)).toMatchObject(error.details);
	expect(correction).toContain('does not occur exactly');
	expect(correction).toContain('Do not invent punctuation');
});

it('identifies a schema constraint instead of repeating only a generic error', () => {
	const parsed = zod
		.object({ findings: zod.array(zod.string()).max(8) })
		.safeParse({ findings: Array.from({ length: 9 }, () => 'synthetic') });
	expect(parsed.success).toBe(false);
	const correction = outputCorrection(parsed.error);
	expect(JSON.parse(correction.split('\n')[1]!)).toMatchObject({
		reason: 'SCHEMA_INVALID',
		issues: [{ code: 'too_big', path: ['findings'], maximum: 8 }],
	});
});
