import type OpenAI from 'openai';
import type { TSource, TClaim } from '@self-review/contracts';

export type TEvidenceValidationReason =
	| 'EMPTY_QUOTE'
	| 'EMPTY_SOURCE'
	| 'SOURCE_NOT_EXPOSED'
	| 'QUOTE_NOT_FOUND'
	| 'REDUCER_EVIDENCE_NOT_IN_CHILD'
	| 'TASK_STATE_NOT_RESULT'
	| 'METADATA_ONLY_RESULT'
	| 'MEASUREMENT_WITHOUT_DIGITS';

export interface IEvidenceValidationFailure {
	reason: TEvidenceValidationReason;
	claimIndex: number;
	evidenceIndex?: number;
	sourceId?: string;
	quote?: string;
	sourceKind?: TSource['kind'];
	sourceState?: string;
}

export interface IModelInput {
	history: OpenAI.Responses.ResponseInput;
	forcedTool?: string;
	allowedIds: string[];
	sources: TSource[];
	childClaims?: TClaim[];
	report: boolean;
	research: boolean;
}
export interface IModelResult {
	output: OpenAI.Responses.ResponseOutputItem[];
	text: string;
	errorCode?: string;
	responseId: string | null;
	usage: {
		inputTokens: number;
		outputTokens: number;
		cachedInputTokens: number;
		reasoningTokens: number;
	} | null;
}

export interface IUnitOptions {
	runId: string;
	batchId: string;
	taskIds: string[];
	allowedIds: string[];
	research: boolean;
	childClaims?: TClaim[];
	report: boolean;
}

// One batch owns its mutable history and counters; this context stays in worker memory.
export interface IUnitContext extends IUnitOptions {
	deadline: number;
	history: OpenAI.Responses.ResponseInput;
	exposed: Map<string, TSource>;
	toolCount: number;
	commentCount: number;
	dataBytes: number;
	usageTokens: number;
	corrected: boolean;
	violations: number;
	mandatoryStage: number;
	transportRetried: boolean;
	commentMemo: Set<string>;
	trace: object[];
}
