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
