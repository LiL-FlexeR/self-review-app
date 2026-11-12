import { afterEach, describe, it, expect, vi } from 'vitest';
import { ModelClient } from '@app/modules/agent/services/model-client.service';
import { config } from '@app/shared/config/config.schema';
import type { ConfigService } from '@app/shared/config/config.service';
import type { IModelInput } from '@app/modules/agent/agent.types';
const configuration = config({
	APP_MODE: 'demo',
	OPENAI_API_KEY: 'synthetic-not-a-real-key',
	APP_ORIGIN: 'http://localhost:3000',
	DATABASE_URL: 'unused',
	REDIS_URL: 'redis://localhost:6379',
	AUTH_SECRET: 'synthetic-auth-secret-long-enough',
	JWT_SECRET: 'synthetic-jwt-secret-long-enough-',
	TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 42).toString('base64'),
});
const service = new ModelClient({
	values: configuration,
	get(key) {
		return configuration[key];
	},
} satisfies ConfigService);
const input: IModelInput = {
	history: [
		{
			type: 'reasoning',
			id: 'rs_synthetic',
			encrypted_content: 'opaque-synthetic',
			summary: [],
		},
		{ type: 'function_call', name: 'list_issues', arguments: '{}', call_id: 'call_synthetic' },
		{ type: 'function_call_output', call_id: 'call_synthetic', output: '[]' },
	],
	allowedIds: [],
	sources: [],
	report: false,
	research: true,
	forcedTool: 'get_issue_details',
};
afterEach(() => {
	vi.unstubAllGlobals();
});
describe('official SDK Responses boundary (synthetic transport)', () => {
	it('uses the exact model, low reasoning, strict tools, stateless replay and known usage', async () => {
		let body: Record<string, unknown> = {};
		vi.stubGlobal('fetch', async (_request: unknown, init: RequestInit) => {
			body = JSON.parse(String(init.body)) as Record<string, unknown>;
			return Response.json({
				id: 'resp_synthetic',
				object: 'response',
				status: 'completed',
				output: [
					{
						type: 'message',
						id: 'msg_synthetic',
						role: 'assistant',
						status: 'completed',
						phase: 'final_answer',
						content: [{ type: 'output_text', text: '{}', annotations: [] }],
					},
				],
				usage: {
					input_tokens: 120,
					output_tokens: 80,
					input_tokens_details: { cached_tokens: 20 },
					output_tokens_details: { reasoning_tokens: 60 },
				},
			});
		});
		const response = await service.respond(input);
		expect(body).toMatchObject({
			model: 'gpt-5.4-mini-2026-03-17',
			reasoning: { effort: 'low' },
			store: false,
			max_output_tokens: 4096,
			parallel_tool_calls: false,
			include: ['reasoning.encrypted_content'],
			input: input.history,
		});
		expect(body.previous_response_id).toBeUndefined();
		expect(response.usage).toEqual({
			inputTokens: 120,
			outputTokens: 80,
			cachedInputTokens: 20,
			reasoningTokens: 60,
		});
	});
	it('enforces the total report claim limit in the schema supplied to the model', async () => {
		let body: Record<string, unknown> = {};
		vi.stubGlobal('fetch', async (_request: unknown, init: RequestInit) => {
			body = JSON.parse(String(init.body)) as Record<string, unknown>;
			return Response.json({ id: 'resp_report', status: 'completed', output: [] });
		});
		await service.respond({ ...input, report: true, research: false, forcedTool: undefined });
		expect(body.text).toMatchObject({
			format: {
				name: 'ReviewModelDraft',
				strict: true,
				schema: {
					properties: {
						claims: { type: 'array', maxItems: 8 },
						groupTitles: { type: 'array', minItems: 4, maxItems: 4 },
					},
				},
			},
		});
	});
	it('retains known usage on incomplete output without changing output budgets', async () => {
		vi.stubGlobal('fetch', async () =>
			Response.json({
				id: 'resp_incomplete',
				status: 'incomplete',
				output: [],
				usage: {
					input_tokens: 10,
					output_tokens: 4096,
					input_tokens_details: { cached_tokens: 0 },
					output_tokens_details: { reasoning_tokens: 4096 },
				},
			}),
		);
		const response = await service.respond(input);
		expect(response.errorCode).toBe('INVALID_MODEL_OUTPUT');
		expect(response.usage?.outputTokens).toBe(4096);
	});
	it.each([false, true])(
		'bounds leaf source IDs in the actual SDK request (report=%s)',
		async (report) => {
			let body: Record<string, unknown> = {};
			vi.stubGlobal('fetch', async (_request: unknown, init: RequestInit) => {
				body = JSON.parse(String(init.body)) as Record<string, unknown>;
				return Response.json({ id: 'resp_sources', status: 'completed', output: [] });
			});
			const sources = ['synthetic-source-a', 'synthetic-source-b'].map((id) => ({
				id,
				taskSnapshotId: '00000000-0000-4000-8000-000000000001',
				kind: 'metadata' as const,
				textExcerpt: 'Synthetic planned task',
				state: 'backlog',
				truncated: false,
				url: null,
				createdAt: null,
				updatedAt: null,
				retrievedAt: '2026-11-12T00:00:00.000Z',
			}));
			await service.respond({
				...input,
				sources,
				report,
				research: false,
				forcedTool: undefined,
			});
			expect(body.text).toMatchObject({
				format: {
					strict: true,
					schema: {
						properties: {
							[report ? 'claims' : 'findings']: {
								maxItems: 8,
								items: {
									properties: {
										evidence: {
											items: {
												properties: {
													sourceId: {
														enum: sources.map((source) => source.id),
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			});
		},
	);
	it.each([false, true])(
		'sends bounded canonical evidence selections for reducers (report=%s)',
		async (report) => {
			let body: Record<string, unknown> = {};
			vi.stubGlobal('fetch', async (_request: unknown, init: RequestInit) => {
				body = JSON.parse(String(init.body)) as Record<string, unknown>;
				return Response.json({ id: 'resp_reducer', status: 'completed', output: [] });
			});
			await service.respond({
				...input,
				report,
				research: false,
				forcedTool: undefined,
				childClaims: [
					{
						kind: 'task_description',
						text: 'Synthetic plan',
						evidence: [
							{ sourceId: 'synthetic-source', quote: 'First quote' },
							{ sourceId: 'synthetic-source', quote: 'Second quote' },
						],
					},
				],
			});
			expect(body.text).toMatchObject({
				format: {
					name: report ? 'ReviewReductionDraft' : 'AnalysisReductionDraft',
					strict: true,
					schema: {
						properties: {
							[report ? 'claims' : 'findings']: {
								maxItems: 8,
								items: {
									properties: {
										evidenceRefs: {
											minItems: 1,
											maxItems: 2,
											items: { type: 'integer', minimum: 0, maximum: 1 },
										},
									},
								},
							},
						},
					},
				},
			});
			expect(JSON.stringify(body.text)).not.toContain('sourceId');
		},
	);
	it('rejects oversized history before a network request and never automatically retries 401', async () => {
		const transport = vi.fn(async () =>
			Response.json({ error: { message: 'synthetic rejected key' } }, { status: 401 }),
		);
		vi.stubGlobal('fetch', transport);
		await expect(
			service.respond({ ...input, history: [{ role: 'user', content: 'x'.repeat(65536) }] }),
		).rejects.toThrow('BUDGET_EXHAUSTED');
		expect(transport).not.toHaveBeenCalled();
		await expect(service.respond(input)).rejects.toThrow();
		expect(transport).toHaveBeenCalledTimes(1);
	});
});
