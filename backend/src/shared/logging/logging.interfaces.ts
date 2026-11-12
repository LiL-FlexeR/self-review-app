import type { TClaim, TSource } from '@self-review/contracts';

export interface ILogContext {
	requestId?: string;
	runId?: string;
	batchId?: string;
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
}
