import type { TClaim, TSource } from '@self-review/contracts';

export interface ILogContext {
	requestId?: string;
	runId?: string;
	batchId?: string;
	attempt?: number;
	unitAttempt?: number;
}

export interface ILogFields extends ILogContext {
	error?: unknown;
	reason?: string;
	taskId?: string;
	attempt?: number;
	claimIndex?: number;
	evidenceIndex?: number;
	count?: number;
	bytes?: number;
	port?: number;
	status?: number;
	method?: string;
	stage?: string;
	state?: string;
	tool?: string;
	fields?: string[];
	claim?: TClaim;
	evidence?: TClaim['evidence'][number];
	source?: TSource;
	sources?: TSource[];
	childEvidence?: TClaim['evidence'];
	availableSourceIds?: string[];
	availableSourceCount?: number;
	quoteLength?: number;
	sourceExcerptLength?: number;
	quoteFoundIgnoringWhitespace?: boolean;
	durationMs?: number;
	batchLevel?: number;
	phase?: string;
	taskCount?: number;
	sourceCount?: number;
	claimCount?: number;
	attemptLimit?: number;
	requestBytes?: number;
	outputBytes?: number;
	historyItems?: number;
	inputTokens?: number;
	outputTokens?: number;
	cachedInputTokens?: number;
	reasoningTokens?: number;
	usageKnown?: boolean;
	corrected?: boolean;
	cacheHit?: boolean;
	retryDelayMs?: number;
	providerStatus?: string;
	incompleteReason?: string;
	model?: string;
	reasoningEffort?: string;
}
