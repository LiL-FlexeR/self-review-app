import { Inject, Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponsesFunction, zodTextFormat } from 'openai/helpers/zod';
import {
	analysisSourceSchema,
	reviewSourceSchema,
} from '@app/modules/agent/utils/source-bound-draft';
import {
	analysisReductionSchema,
	reductionEvidence,
	reviewReductionSchema,
} from '@app/modules/agent/utils/reduction-model-draft';
import type { TClaim } from '@self-review/contracts';
import { ConfigService } from '@app/shared/config/config.service';
import { TOOL_SCHEMAS, SAFETY, LIMITS } from '@app/modules/agent/agent.schemas';
import type { IModelInput, IModelResult } from '@app/modules/agent/agent.types';
import { AppLogger } from '@app/shared/logging/logger';

const logger = new AppLogger('ModelClient');

@Injectable()
export class ModelClient {
	constructor(@Inject(ConfigService) private readonly configuration: ConfigService) {}

	validateConfiguration() {
		if (
			this.configuration.get('APP_MODE') !== 'offline' &&
			!this.configuration.get('OPENAI_API_KEY')
		) {
			logger.error('operation_rejected', { reason: 'MODEL_CONFIGURATION' });
			throw new Error('MODEL_CONFIGURATION');
		}
	}

	async respond(input: IModelInput): Promise<IModelResult> {
		if (this.configuration.get('APP_MODE') === 'offline') {
			return this.scripted(input);
		}
		const key = this.configuration.get('OPENAI_API_KEY');
		if (!key) {
			logger.error('operation_rejected', { reason: 'MODEL_CONFIGURATION' });
			throw new Error('MODEL_CONFIGURATION');
		}
		const client = new OpenAI({
			apiKey: key,
			maxRetries: 0,
			timeout: LIMITS.requestMs,
			logLevel: 'off',
		});
		const sourceIds = input.sources.map((source) => source.id);
		let format: OpenAI.Responses.ResponseFormatTextJSONSchemaConfig = input.report
			? zodTextFormat(reviewSourceSchema(sourceIds), 'ReviewModelDraft')
			: zodTextFormat(analysisSourceSchema(sourceIds), 'BatchAnalysis');
		if (input.childClaims) {
			const evidenceCount = reductionEvidence(input.childClaims).length;
			format = input.report
				? zodTextFormat(reviewReductionSchema(evidenceCount), 'ReviewReductionDraft')
				: zodTextFormat(analysisReductionSchema(evidenceCount), 'AnalysisReductionDraft');
		}
		const request: OpenAI.Responses.ResponseCreateParamsNonStreaming = {
			model: this.configuration.get('OPENAI_MODEL'),
			reasoning: { effort: 'low' },
			store: false,
			include: ['reasoning.encrypted_content'],
			max_output_tokens: LIMITS.outputTokens,
			instructions: SAFETY,
			input: input.history,
			parallel_tool_calls: false,
			tools: input.research
				? Object.entries(TOOL_SCHEMAS).map(([name, schema]) =>
						zodResponsesFunction({ name, description: name, parameters: schema }),
					)
				: [],
			tool_choice: input.forcedTool ? { type: 'function', name: input.forcedTool } : 'auto',
			text: { format },
		};
		if (Buffer.byteLength(JSON.stringify(request)) > LIMITS.requestBytes) {
			logger.error('operation_rejected', { reason: 'BUDGET_EXHAUSTED' });
			throw new Error('BUDGET_EXHAUSTED');
		}
		const startedAt = Date.now();
		logger.info('model_request_started', {
			model: request.model,
			reasoningEffort: 'low',
			requestBytes: Buffer.byteLength(JSON.stringify(request)),
			historyItems: input.history.length,
			sourceCount: input.sources.length,
			claimCount: input.childClaims?.length ?? 0,
		});
		let response: OpenAI.Responses.Response;
		try {
			response = await client.responses.create(request);
		} catch (error) {
			logger.error('model_request_failed', { error, durationMs: Date.now() - startedAt });
			throw error;
		}
		const text = response.output_text ?? '';
		logger.info('model_request_completed', {
			durationMs: Date.now() - startedAt,
			providerStatus: response.status,
			incompleteReason: response.incomplete_details?.reason,
			outputBytes: Buffer.byteLength(text),
			usageKnown: !!response.usage,
			inputTokens: response.usage?.input_tokens,
			outputTokens: response.usage?.output_tokens,
			cachedInputTokens: response.usage?.input_tokens_details.cached_tokens,
			reasoningTokens: response.usage?.output_tokens_details.reasoning_tokens,
		});
		const errorCode = response.output.some(
			(item) =>
				item.type === 'message' && item.content.some((part) => part.type === 'refusal'),
		)
			? 'MODEL_REFUSAL'
			: response.status !== 'completed'
				? 'INVALID_MODEL_OUTPUT'
				: undefined;
		return {
			output: response.output,
			providerStatus: response.status,
			incompleteReason: response.incomplete_details?.reason,
			errorCode,
			text,
			responseId: response.id,
			usage: response.usage
				? {
						inputTokens: response.usage.input_tokens,
						outputTokens: response.usage.output_tokens,
						cachedInputTokens: response.usage.input_tokens_details.cached_tokens,
						reasoningTokens: response.usage.output_tokens_details.reasoning_tokens,
					}
				: null,
		};
	}

	private scripted(input: IModelInput): IModelResult {
		const call = (name: string, args: object): IModelResult => ({
			providerStatus: 'scripted',
			output: [
				{
					type: 'function_call',
					name,
					arguments: JSON.stringify(args),
					call_id: crypto.randomUUID(),
				},
			],
			text: '',
			usage: null,
			responseId: null,
		});
		if (input.forcedTool) {
			return call(
				input.forcedTool,
				input.forcedTool === 'get_issue_details' ? { issueIds: input.allowedIds } : {},
			);
		}
		const commentCandidate = input.sources.find(
			(source) =>
				source.kind === 'description' &&
				source.textExcerpt === 'Add an index to speed up the API.',
		);
		if (
			input.research &&
			commentCandidate &&
			!input.sources.some(
				(source) =>
					source.kind === 'comment' &&
					source.taskSnapshotId === commentCandidate.taskSnapshotId,
			)
		) {
			return call('get_issue_comments', { issueId: 'DEMO-101' });
		}
		const claims: TClaim[] = input.childClaims
			? input.childClaims.slice(-8)
			: input.sources
					.filter(
						(source) =>
							source.kind !== 'metadata' &&
							source.textExcerpt &&
							!source.textExcerpt.includes('attacker.example'),
					)
					.slice(-8)
					.map((source) => ({
						kind:
							source.kind === 'comment' || source.textExcerpt.includes('reports')
								? 'reported_measurement'
								: 'task_description',
						text: `The saved ${source.kind} states: ${source.textExcerpt.slice(0, 230)}`,
						evidence: [
							{ sourceId: source.id, quote: source.textExcerpt.slice(0, 240) },
						],
					}));
		for (const claim of claims) {
			if (claim.kind === 'reported_measurement' && !/\d/.test(claim.evidence[0]!.quote)) {
				claim.kind = 'reported_result';
			}
		}
		const shared = {
			schemaVersion: '1.0',
			limitations: [
				'Synthetic scripted model output; individual contribution and production rollout are not confirmed.',
			],
			explanation:
				'Evidence comes from saved excerpts; offline output does not verify model judgment.',
		};
		const evidence = reductionEvidence(input.childClaims ?? []);
		const modelClaims = input.childClaims
			? claims.map(({ evidence: pairs, ...claim }) => ({
					...claim,
					evidenceRefs: pairs.map((pair) =>
						evidence.findIndex(
							(candidate) =>
								candidate.sourceId === pair.sourceId &&
								candidate.quote === pair.quote,
						),
					),
				}))
			: claims;
		return {
			output: [],
			providerStatus: 'scripted',
			text: JSON.stringify(
				input.report
					? {
							...shared,
							groupTitles: ['Saved work', '', '', ''],
							claims: modelClaims.map((claim) => ({ ...claim, groupIndex: 0 })),
						}
					: { ...shared, findings: modelClaims },
			),
			usage: null,
			responseId: null,
		};
	}
}
