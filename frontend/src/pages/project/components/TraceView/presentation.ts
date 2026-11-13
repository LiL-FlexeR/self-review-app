import { z as zod } from 'zod';

const SafeEvent = zod.object({
	event: zod.string(),
	timestamp: zod.iso.datetime().optional(),
	tool: zod.string().optional(),
	attempt: zod.number().optional(),
	durationMs: zod.number().optional(),
	taskCount: zod.number().optional(),
	sourceCount: zod.number().optional(),
	claimCount: zod.number().optional(),
	errorCode: zod.string().optional(),
});

const EVENT_LABELS: Record<string, string> = {
	unit_started: 'Evidence processing started',
	unit_completed: 'Validated findings saved',
	unit_interrupted: 'Processing interrupted',
	model_started: 'Model request started',
	model_completed: 'Model response received',
	model_failed: 'Model request or validation failed',
	model_retry_scheduled: 'Temporary failure · another attempt scheduled',
	output_correction_requested: 'Output correction requested',
	validation_failed: 'Evidence validation failed',
	tool_started: 'Source read started',
	tool_completed: 'Source read completed',
	tool_failed: 'Source read failed',
	tool_comments: 'Additional comment evidence requested',
	empty_reduction: 'No supported claims to combine',
};

const TOOL_LABELS: Record<string, string> = {
	list_issues: 'List tasks',
	get_issue_details: 'Read task details',
	get_issue_comments: 'Read task comments',
};

export function presentTraceEvent(value: unknown) {
	const parsed = SafeEvent.safeParse(value);
	if (!parsed.success) {
		return { title: 'Saved event · details available', facts: [], timestamp: undefined };
	}
	const event = parsed.data;
	const facts: string[] = [];
	if (event.tool) {
		facts.push(TOOL_LABELS[event.tool] ?? event.tool);
	}
	if (event.attempt !== undefined) {
		facts.push(`Attempt ${event.attempt}`);
	}
	if (event.durationMs !== undefined) {
		facts.push(`${event.durationMs.toLocaleString('en-US')} ms`);
	}
	if (event.taskCount !== undefined) {
		facts.push(`${event.taskCount} tasks`);
	}
	if (event.sourceCount !== undefined) {
		facts.push(`${event.sourceCount} exposed sources`);
	}
	if (event.claimCount !== undefined) {
		facts.push(`${event.claimCount} claims`);
	}
	if (event.errorCode) {
		facts.push(event.errorCode);
	}
	return {
		title: EVENT_LABELS[event.event] ?? 'Saved event · details available',
		facts,
		timestamp: event.timestamp,
	};
}
