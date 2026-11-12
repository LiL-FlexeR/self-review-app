import { z as zod } from 'zod';

const Usage = zod.object({
	inputTokens: zod.number(),
	outputTokens: zod.number(),
	cachedInputTokens: zod.number(),
	reasoningTokens: zod.number(),
});

export function aggregateUsage(
	mode: string,
	attempts: { usage: unknown; usageUnknown: boolean }[],
) {
	const totals = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, reasoningTokens: 0 };
	let unknown = mode === 'offline';
	for (const attempt of attempts) {
		const usage = Usage.safeParse(attempt.usage);
		unknown ||= attempt.usageUnknown || !usage.success;
		if (usage.success) {
			for (const key of Object.keys(totals) as (keyof typeof totals)[]) {
				totals[key] += usage.data[key];
			}
		}
	}
	return {
		mode,
		attempts: attempts.length,
		unknown,
		...totals,
		estimatedCostUsd: unknown
			? null
			: ((totals.inputTokens - totals.cachedInputTokens) * 0.75 +
					totals.cachedInputTokens * 0.075 +
					totals.outputTokens * 4.5) /
				1000000,
	};
}
