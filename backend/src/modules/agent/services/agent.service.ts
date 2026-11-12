import { Inject, Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { inRunningRun } from '@app/modules/jobs/running-transaction';
import { z as zod } from 'zod';
import { Source, ReportDraft } from '@self-review/contracts';
import type { TReportDraft } from '@self-review/contracts';
import type { TClaim, TSource } from '@self-review/contracts';
import { DatabaseService } from '@app/shared/database/database.service';
import { ModelClient } from './model-client.service.js';
import { SourcesService } from './sources.service.js';
import { FixtureService } from '@app/modules/providers/fixture.service';
import { Analysis, LIMITS, TOOL_SCHEMAS } from '@app/modules/agent/agent.schemas';
import type { TAnalysis } from '@app/modules/agent/agent.schemas';
import type { IModelResult, IUnitOptions, IUnitContext } from '@app/modules/agent/agent.types';
import type {
	AnalysisBatch,
	ModelAttempt,
	TaskSnapshot,
	Prisma,
} from '@app/generated/prisma/client';
import { boundSources, excerpt, json, validateEvidence } from '@app/modules/agent/agent.utils';

@Injectable()
export class AgentService {
	constructor(
		@Inject(DatabaseService) private readonly database: DatabaseService,
		@Inject(ModelClient) private readonly model: ModelClient,
		@Inject(SourcesService) private readonly sources: SourcesService,
		@Inject(FixtureService) private readonly provider: FixtureService,
	) {}

	async run(
		runId: string,
		sourceRunId: string,
		report: boolean,
		subject?: string,
	): Promise<TAnalysis | TReportDraft> {
		const leafIds = await this.analyzeTaskBatches(runId, sourceRunId, report, subject);
		if (!leafIds.length) {
			return {
				schemaVersion: '1.0',
				...(report ? { groups: [] } : { findings: [] }),
				limitations: ['No eligible tasks in this snapshot.'],
				explanation: 'Empty selection; no model request.',
			};
		}

		const finalBatchId = await this.reduceBatchResults(runId, leafIds, report);
		const final = await this.database.client.analysisBatch.findUniqueOrThrow({
			where: { id: finalBatchId },
		});

		return report ? ReportDraft.parse(final.output) : Analysis.parse(final.output);
	}

	private async analyzeTaskBatches(
		runId: string,
		sourceRunId: string,
		report: boolean,
		subject?: string,
	): Promise<string[]> {
		const db = this.database.client;
		const leafIds: string[] = [];
		let cursor: string | undefined;
		let ordinal = 0;

		// Keyset pages keep raw descriptions scoped to one processing unit.
		while (true) {
			const tasks = await db.taskSnapshot.findMany({
				where: {
					syncRunId: sourceRunId,
					...(subject ? { assignees: { array_contains: [subject] } } : {}),
					...(cursor ? { externalId: { gt: cursor } } : {}),
				},
				orderBy: { externalId: 'asc' },
				take: LIMITS.batch,
			});
			if (!tasks.length) {
				break;
			}
			cursor = tasks.at(-1)!.externalId;

			const taskIds = tasks.map((task) => task.id);
			const allowedIds = tasks.map((task) => task.externalId);
			const batch = await inRunningRun(db, runId, (transaction) =>
				transaction.analysisBatch.create({
					data: {
						runId,
						phase: report ? 'review' : 'sync',
						ordinal: ordinal++,
						inputIds: taskIds,
						state: 'running',
					},
				}),
			);
			await this.executeBatch(
				batch,
				() => this.unit(runId, batch.id, taskIds, allowedIds, !report, undefined, report),
				{ taskIds },
			);

			leafIds.push(batch.id);
			await db.jobRun.updateMany({
				where: { id: runId, state: 'running' },
				data: { counts: { processedBatches: ordinal }, version: { increment: 1 } },
			});
		}

		return leafIds;
	}

	private async reduceBatchResults(
		runId: string,
		leafIds: string[],
		report: boolean,
	): Promise<string> {
		let level = 1;
		let current = leafIds;

		while (current.length > 1) {
			const next: string[] = [];
			for (let offset = 0; offset < current.length; offset += LIMITS.reduceChildren) {
				const childIds = current.slice(offset, offset + LIMITS.reduceChildren);
				if (childIds.length === 1) {
					next.push(childIds[0]!);
					continue;
				}

				const ordinal = offset / LIMITS.reduceChildren;
				const batchId = await this.reduceBatchGroup(
					runId,
					childIds,
					report,
					level,
					ordinal,
				);
				next.push(batchId);
			}
			current = next;
			level++;
		}

		return current[0]!;
	}

	private async reduceBatchGroup(
		runId: string,
		childIds: string[],
		report: boolean,
		level: number,
		ordinal: number,
	): Promise<string> {
		const db = this.database.client;
		const children = await db.analysisBatch.findMany({
			where: { id: { in: childIds }, state: 'succeeded' },
		});
		if (children.length !== childIds.length) {
			throw new Error('INVALID_MODEL_OUTPUT');
		}
		const childClaims = childIds.flatMap((childId) => {
			const child = children.find((item) => item.id === childId)!;
			return report
				? ReportDraft.parse(child.output).groups.flatMap((group) => group.claims)
				: Analysis.parse(child.output).findings;
		});

		const batch = await inRunningRun(db, runId, (transaction) =>
			transaction.analysisBatch.create({
				data: {
					runId,
					phase: report ? 'review-reduce' : 'sync-reduce',
					level,
					ordinal,
					inputIds: childIds,
					state: 'running',
					coverage: { childIds },
				},
			}),
		);
		await this.executeBatch(batch, () =>
			this.unit(runId, batch.id, [], [], false, childClaims, report),
		);

		return batch.id;
	}

	private async executeBatch(
		batch: AnalysisBatch,
		work: () => Promise<TAnalysis | TReportDraft>,
		coverage?: Prisma.InputJsonValue,
	): Promise<void> {
		const db = this.database.client;

		try {
			const output = await work();
			await inRunningRun(db, batch.runId, (transaction) =>
				transaction.analysisBatch.update({
					where: { id: batch.id },
					data: {
						state: 'succeeded',
						output: json(output),
						...(coverage ? { coverage } : {}),
					},
				}),
			);
		} catch (error) {
			await db.analysisBatch.update({
				where: { id: batch.id },
				data: { state: 'failed' },
			});
			throw error;
		}
	}

	private async unit(
		runId: string,
		batchId: string,
		taskIds: string[],
		allowedIds: string[],
		research: boolean,
		childClaims?: TClaim[],
		report = false,
	): Promise<TAnalysis | TReportDraft> {
		const context = await this.prepareUnit({
			runId,
			batchId,
			taskIds,
			allowedIds,
			research,
			childClaims,
			report,
		});
		const maximum = research ? LIMITS.attempts : 2;

		for (let step = 0; step < maximum; step++) {
			const attempt = await this.reserveModelAttempt(context);
			try {
				const response = await this.requestModel(context, attempt);
				const output = await this.handleModelResponse(context, response);
				if (output) {
					return output;
				}
			} catch (error) {
				await this.recordFailedAttempt(context, attempt);
				if (await this.retryTemporaryFailure(context, error, step + 1 < maximum)) {
					continue;
				}
				throw error;
			}
		}

		throw new Error('INVALID_MODEL_OUTPUT');
	}

	private async prepareUnit(options: IUnitOptions): Promise<IUnitContext> {
		this.model.validateConfiguration();
		const deadline = Date.now() + LIMITS.unitMs;
		await this.database.client.jobRun.updateMany({
			where: { id: options.runId, state: 'running' },
			data: {
				stage: options.childClaims ? 'reducing' : 'analyzing',
				unitDeadlineAt: new Date(deadline),
				version: { increment: 1 },
			},
		});
		const sources = await this.loadUnitSources(options);
		const exposed = new Map<string, TSource>();
		if (!options.research) {
			sources.forEach((source) => exposed.set(source.id, source));
		}

		return {
			...options,
			deadline,
			exposed,
			history: [
				{
					role: 'user',
					content: JSON.stringify({
						allowedIssueIds: options.allowedIds,
						sources: options.research || options.childClaims ? [] : sources,
						childClaims: options.childClaims ?? null,
						task: options.report
							? 'Produce ReportDraft from saved evidence.'
							: 'Produce BatchAnalysis from saved evidence.',
					}),
				},
			],
			toolCount: 0,
			commentCount: 0,
			dataBytes: 0,
			usageTokens: 0,
			corrected: false,
			violations: 0,
			mandatoryStage: 0,
			transportRetried: false,
			commentMemo: new Set<string>(),
			trace: [
				{
					event: 'unit_started',
					runId: options.runId,
					batchId: options.batchId,
					taskCount: options.taskIds.length,
				},
			],
		};
	}

	private async loadUnitSources(options: IUnitOptions): Promise<TSource[]> {
		let sources = await this.sources.forTasks(options.taskIds);
		if (options.childClaims) {
			const citedIds = [
				...new Set(
					options.childClaims.flatMap((claim) =>
						claim.evidence.map((pair) => pair.sourceId),
					),
				),
			];
			// Resolve only cited primary records, never the entire project's text.
			const taskSnapshotIds = await this.citedTasks(citedIds);
			sources = (await this.sources.forTasks(taskSnapshotIds)).filter((source) =>
				citedIds.includes(source.id),
			);
		}
		if (!options.research && !options.childClaims) {
			sources = boundSources(sources, LIMITS.dataBytes).sources;
		}

		return sources;
	}

	private async reserveModelAttempt(context: IUnitContext): Promise<ModelAttempt> {
		if (Date.now() >= context.deadline) {
			throw new Error('UNIT_TIMEOUT');
		}
		if (context.usageTokens >= LIMITS.tokens) {
			throw new Error('BUDGET_EXHAUSTED');
		}
		const db = this.database.client;
		const active = await db.jobRun.findUniqueOrThrow({
			where: { id: context.runId },
			select: { state: true },
		});
		if (active.state !== 'running') {
			throw new Error('RUN_INTERRUPTED');
		}
		const attemptNo = (await db.modelAttempt.count({ where: { runId: context.runId } })) + 1;
		const attempt = await db.modelAttempt.create({
			data: {
				runId: context.runId,
				batchId: context.batchId,
				attemptNo,
				status: 'submitted',
			},
		});
		context.trace.push({ event: 'model_started', attempt: attemptNo });

		return attempt;
	}

	private async requestModel(
		context: IUnitContext,
		attempt: ModelAttempt,
	): Promise<IModelResult> {
		let forcedTool: string | undefined;
		if (context.research && context.mandatoryStage < 2) {
			forcedTool = context.mandatoryStage === 0 ? 'list_issues' : 'get_issue_details';
		}
		const response = await this.model.respond({
			history: context.history,
			forcedTool,
			allowedIds: context.allowedIds,
			sources: [...context.exposed.values()],
			childClaims: context.childClaims,
			report: context.report,
			research: context.research,
		});
		context.transportRetried = false;
		await this.database.client.modelAttempt.update({
			where: { id: attempt.id },
			data: {
				status: 'completed',
				providerResponseId: response.responseId,
				usage: response.usage ? json(response.usage) : undefined,
				usageUnknown: !response.usage,
			},
		});
		context.usageTokens += response.usage
			? response.usage.inputTokens + response.usage.outputTokens
			: 0;
		context.trace.push({
			event: 'model_completed',
			attempt: attempt.attemptNo,
			usage: response.usage,
			mode: response.usage ? 'live' : 'scripted',
		});

		return response;
	}

	private async handleModelResponse(
		context: IUnitContext,
		response: IModelResult,
	): Promise<TAnalysis | TReportDraft | undefined> {
		// Replay complete output items, including opaque reasoning and tool call IDs.
		for (const item of response.output) {
			if (
				item.type !== 'message' &&
				item.type !== 'function_call' &&
				item.type !== 'reasoning'
			) {
				throw new Error('GUARDRAIL_VIOLATION');
			}
			context.history.push(item);
		}
		if (response.errorCode === 'MODEL_REFUSAL') {
			throw new Error('MODEL_REFUSAL');
		}
		if (response.errorCode) {
			this.requestOutputCorrection(
				context,
				'Previous output was incomplete. Return valid structured output within the unchanged output limit.',
			);
			return;
		}
		const calls = response.output.filter((item) => item.type === 'function_call');
		if (calls.length) {
			await this.handleToolCall(context, calls);
			return;
		}

		return this.validateUnitResult(context, response);
	}

	private requestOutputCorrection(context: IUnitContext, message: string): void {
		if (context.corrected) {
			throw new Error('INVALID_MODEL_OUTPUT');
		}
		context.corrected = true;
		context.history.push({ role: 'user', content: message });
	}

	private async handleToolCall(
		context: IUnitContext,
		calls: OpenAI.Responses.ResponseFunctionToolCall[],
	): Promise<void> {
		if (calls.length !== 1 || !context.research || ++context.toolCount > LIMITS.tools) {
			throw new Error('GUARDRAIL_VIOLATION');
		}
		const call = calls[0]!;
		let result: unknown;
		try {
			if (
				(context.mandatoryStage === 0 && call.name !== 'list_issues') ||
				(context.mandatoryStage === 1 && call.name !== 'get_issue_details')
			) {
				throw new Error('GUARDRAIL_VIOLATION');
			}
			const args: unknown = JSON.parse(call.arguments);
			result = await this.dispatchTool(context, call.name, args);
		} catch (error) {
			if (
				error instanceof Error &&
				['PROVIDER_READ_FAILED', 'RUN_INTERRUPTED'].includes(error.message)
			) {
				throw error;
			}
			if (++context.violations > 1) {
				throw new Error('GUARDRAIL_VIOLATION');
			}
			result = { error: 'GUARDRAIL_VIOLATION' };
		}
		if (
			context.mandatoryStage < 2 &&
			!(typeof result === 'object' && result !== null && 'error' in result)
		) {
			context.mandatoryStage++;
		}
		const encoded = this.encodeToolResult(context, result);
		context.trace.push({
			event: 'tool_completed',
			tool: call.name,
			bytes: Buffer.byteLength(encoded),
		});
		context.history.push({
			type: 'function_call_output',
			call_id: call.call_id,
			output: encoded,
		});
	}

	private async dispatchTool(
		context: IUnitContext,
		name: string,
		args: unknown,
	): Promise<unknown> {
		switch (name) {
			case 'list_issues':
				return this.listIssues(context, args);
			case 'get_issue_details':
				return this.getIssueDetails(context, args);
			case 'get_issue_comments':
				return this.getIssueComments(context, args);
			default:
				throw new Error('GUARDRAIL_VIOLATION');
		}
	}

	private async listIssues(context: IUnitContext, args: unknown) {
		TOOL_SCHEMAS.list_issues.parse(args);
		const listed = await this.database.client.taskSnapshot.findMany({
			where: { id: { in: context.taskIds } },
			select: { externalId: true, identifier: true, id: true, state: true, title: true },
		});

		return listed.map(({ id, ...metadata }) => ({
			...metadata,
			title: Array.from(metadata.title).slice(0, 256).join(''),
			taskSnapshotId: id,
		}));
	}

	private async getIssueDetails(context: IUnitContext, args: unknown) {
		const details = TOOL_SCHEMAS.get_issue_details.parse(args);
		if (
			new Set(details.issueIds).size !== context.allowedIds.length ||
			details.issueIds.length !== context.allowedIds.length ||
			details.issueIds.some((issueId) => !context.allowedIds.includes(issueId))
		) {
			throw new Error('GUARDRAIL_VIOLATION');
		}

		return { sources: await this.sources.forTasks(context.taskIds) };
	}

	private async getIssueComments(context: IUnitContext, args: unknown) {
		const { issueId } = TOOL_SCHEMAS.get_issue_comments.parse(args);
		if (!context.allowedIds.includes(issueId)) {
			throw new Error('GUARDRAIL_VIOLATION');
		}
		const task = await this.database.client.taskSnapshot.findFirstOrThrow({
			where: { id: { in: context.taskIds }, externalId: issueId },
		});
		const cacheHit = context.commentMemo.has(issueId) || task.commentReadState !== 'not_read';
		let result: unknown;
		if (!cacheHit && task.refreshStatus === 'fresh') {
			if (++context.commentCount > LIMITS.comments) {
				result = { availability: 'comment_budget_exhausted' };
			} else {
				await this.refreshTaskComments(context.runId, task);
			}
		}
		context.commentMemo.add(issueId);
		const commentSources = (await this.sources.forTasks([task.id])).filter(
			(source) => source.kind === 'comment',
		);
		result ??= {
			sources: commentSources,
			availability:
				task.copiedFromSnapshotId && task.commentReadState === 'not_read'
					? 'not_read_in_base'
					: 'read',
		};
		context.trace.push({
			event: 'tool_comments',
			tool: 'get_issue_comments',
			issueId,
			cacheHit,
			count: commentSources.length,
			reason: 'Additional outcome evidence requested after description read.',
		});

		return result;
	}

	private async refreshTaskComments(runId: string, task: TaskSnapshot): Promise<void> {
		const db = this.database.client;
		let comments: Awaited<ReturnType<FixtureService['comments']>>;
		try {
			comments = await this.provider.comments(task.externalId);
		} catch {
			await inRunningRun(db, runId, (transaction) =>
				transaction.taskSnapshot.update({
					where: { id: task.id },
					data: {
						commentReadState: 'failed',
						commentErrorCode: 'PROVIDER_READ_FAILED',
						commentReadAt: new Date(),
					},
				}),
			);
			throw new Error('PROVIDER_READ_FAILED');
		}
		await inRunningRun(db, runId, async (transaction) => {
			for (const comment of comments.slice(0, 5)) {
				await transaction.commentSnapshot.create({
					data: {
						taskSnapshotId: task.id,
						externalId: comment.externalId,
						body: excerpt(comment.body, 65536),
						author: comment.author,
						sourceCreatedAt: comment.createdAt,
						retrievedAt: new Date(),
					},
				});
			}
			await transaction.taskSnapshot.update({
				where: { id: task.id },
				data: {
					commentReadState: comments.some(
						(comment) => Buffer.byteLength(comment.body) > 65536,
					)
						? 'truncated'
						: 'read',
					commentReadAt: new Date(),
					commentsTruncated: comments.length > 5,
				},
			});
		});
	}

	private encodeToolResult(context: IUnitContext, result: unknown): string {
		if (typeof result === 'object' && result !== null && 'sources' in result) {
			const toolSources = zod.array(Source).parse(result.sources);
			const bounded = boundSources(
				toolSources,
				Math.max(0, LIMITS.dataBytes - context.dataBytes - 512),
			);
			result = { ...result, ...bounded };
			bounded.sources.forEach((source) => {
				if (
					!context.exposed.has(source.id) ||
					context.exposed.get(source.id)!.textExcerpt.length < source.textExcerpt.length
				) {
					context.exposed.set(source.id, source);
				}
			});
		}
		const encoded = JSON.stringify(result);
		context.dataBytes += Buffer.byteLength(encoded);
		if (context.dataBytes > LIMITS.dataBytes) {
			throw new Error('BUDGET_EXHAUSTED');
		}

		return encoded;
	}

	private async validateUnitResult(
		context: IUnitContext,
		response: IModelResult,
	): Promise<TAnalysis | TReportDraft | undefined> {
		try {
			if (response.errorCode || (context.research && context.mandatoryStage < 2)) {
				throw new Error('INVALID_MODEL_OUTPUT');
			}
			const output = (context.report ? ReportDraft : Analysis).parse(
				JSON.parse(response.text),
			);
			validateEvidence(output, [...context.exposed.values()], context.childClaims);
			if (Buffer.byteLength(JSON.stringify(output)) > 12288) {
				throw new Error('INVALID_MODEL_OUTPUT');
			}
			await this.database.client.analysisBatch.update({
				where: { id: context.batchId },
				data: { trace: json(context.trace.slice(0, 100)) },
			});
			console.info(
				JSON.stringify({
					event: 'unit_completed',
					runId: context.runId,
					batchId: context.batchId,
					events: context.trace.slice(0, 100),
				}),
			);

			return output;
		} catch {
			context.trace.push({ event: 'validation_failed', errorCode: 'INVALID_MODEL_OUTPUT' });
			this.requestOutputCorrection(
				context,
				'INVALID_MODEL_OUTPUT: return schema-valid JSON with exact supplied evidence and permitted task states; retain the requested schema.',
			);
		}
	}

	private async recordFailedAttempt(context: IUnitContext, attempt: ModelAttempt): Promise<void> {
		context.trace.push({
			event: 'model_failed',
			attempt: attempt.attemptNo,
			errorCode: 'MODEL_REQUEST_OR_VALIDATION_FAILED',
		});
		await this.database.client.modelAttempt.updateMany({
			where: { id: attempt.id, status: 'submitted' },
			data: { status: 'failed' },
		});
		await this.database.client.analysisBatch.update({
			where: { id: context.batchId },
			data: { trace: json(context.trace.slice(0, 100)) },
		});
	}

	private async retryTemporaryFailure(
		context: IUnitContext,
		error: unknown,
		hasAttempts: boolean,
	): Promise<boolean> {
		const transient =
			error instanceof OpenAI.APIConnectionError ||
			(error instanceof OpenAI.APIError &&
				(error.status === 429 || (error.status ?? 0) >= 500));
		if (!transient || context.transportRetried || !hasAttempts) {
			return false;
		}
		const retryAfter =
			error instanceof OpenAI.APIError ? error.headers?.get('retry-after') : null;
		const requestedDelay = retryAfter ? Number(retryAfter) * 1000 : 0;
		const delay = Math.max(
			250 + Math.random() * 500,
			Number.isFinite(requestedDelay) ? requestedDelay : 0,
		);
		if (delay > 30000 || Date.now() + delay >= context.deadline) {
			return false;
		}
		context.transportRetried = true;
		await new Promise((resolve) => setTimeout(resolve, delay));

		return true;
	}

	private async citedTasks(sourceIds: string[]) {
		const ids = new Set<string>();
		for (const sourceId of sourceIds) {
			const parts = sourceId.split(':');
			if (parts[2] === 'comment') {
				const comment = await this.database.client.commentSnapshot.findUnique({
					where: { id: parts[3] },
				});
				if (comment) {
					ids.add(comment.taskSnapshotId);
				}
			} else {
				const task = await this.database.client.taskSnapshot.findUnique({
					where: {
						syncRunId_externalId: { syncRunId: parts[1]!, externalId: parts[3]! },
					},
				});
				if (task) {
					ids.add(task.id);
				}
			}
		}
		return [...ids];
	}
}
