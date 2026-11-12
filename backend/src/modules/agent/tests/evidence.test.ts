import { aggregateUsage } from '@app/modules/agent/agent.usage';
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { SyncCommand, ReviewCommand } from '@self-review/contracts';
import type { TSource } from '@self-review/contracts';
import { validateEvidence, excerpt, markdown } from '@app/modules/agent/agent.utils';
import { Analysis } from '@app/modules/agent/agent.schemas';
const source: TSource = {
	id: 'sync:known:description',
	taskSnapshotId: randomUUID(),
	kind: 'description',
	textExcerpt: 'Staging p95 decreased from 1200 to 900 ms.',
	url: null,
	createdAt: null,
	updatedAt: null,
	retrievedAt: new Date().toISOString(),
	truncated: false,
	state: 'completed',
};
const output = Analysis.parse({
	schemaVersion: '1.0',
	findings: [
		{
			kind: 'reported_measurement',
			text: 'A staging measurement was reported.',
			evidence: [{ sourceId: source.id, quote: 'p95 decreased from 1200 to 900 ms.' }],
		},
	],
	limitations: [],
	explanation: 'Source quotation.',
});
describe('workflow trust boundaries', () => {
	it('validates exact exposed quotes and reducer pairs', () => {
		expect(() => validateEvidence(output, [source])).not.toThrow();
		expect(() => validateEvidence(output, [{ ...source, id: 'another-snapshot' }])).toThrow(
			'INVALID_MODEL_OUTPUT',
		);
		expect(() =>
			validateEvidence(output, [
				{ ...source, textExcerpt: 'Unseen suffix is not supplied.' },
			]),
		).toThrow();
		expect(() => validateEvidence(output, [source], [])).toThrow();
		expect(() => validateEvidence(output, [source], output.findings)).not.toThrow();
	});
	it('rejects metadata measurements and started/canceled achievements', () => {
		for (const state of ['started', 'canceled', 'backlog']) {
			expect(() => validateEvidence(output, [{ ...source, state }])).toThrow();
		}
		expect(() => validateEvidence(output, [{ ...source, kind: 'metadata' }])).toThrow();
	});
	it('does not split UTF-8 excerpts and escapes rendered source text', () => {
		expect(Buffer.byteLength(excerpt('🙂'.repeat(500)))).toBe(1024);
		expect(
			markdown(
				{ schemaVersion: '1.0', groups: [], limitations: ['<script>'], explanation: '' },
				[],
			),
		).toContain('\\<script\\>');
	});
	it('rejects invalid calendar dates and arbitrary subjects without a task-count cap', () => {
		expect(
			SyncCommand.safeParse({
				selection: { mode: 'period', startDate: '2026-02-30', endDate: '2026-10-01' },
				idempotencyKey: randomUUID(),
			}).success,
		).toBe(false);
		expect(
			SyncCommand.safeParse({
				selection: {
					mode: 'tasks',
					baseSyncRunId: randomUUID(),
					taskIds: Array.from({ length: 137 }, () => randomUUID()),
				},
				idempotencyKey: randomUUID(),
			}).success,
		).toBe(true);
		expect(
			ReviewCommand.safeParse({
				syncRunId: randomUUID(),
				idempotencyKey: randomUUID(),
				developerId: 'other',
			}).success,
		).toBe(false);
	});
});

it('aggregates token subsets once and preserves unknown/scripted cost', () => {
	const usage = {
		inputTokens: 12000,
		outputTokens: 1500,
		cachedInputTokens: 0,
		reasoningTokens: 1000,
	};
	expect(aggregateUsage('demo', [{ usage, usageUnknown: false }]).estimatedCostUsd).toBe(0.01575);
	expect(aggregateUsage('offline', []).estimatedCostUsd).toBeNull();
	expect(aggregateUsage('demo', [{ usage: null, usageUnknown: true }]).unknown).toBe(true);
});
