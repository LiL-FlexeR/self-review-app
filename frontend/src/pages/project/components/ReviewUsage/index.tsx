import { z as zod } from 'zod';

const UsageSummary = zod.object({
	mode: zod.enum(['offline', 'demo', 'live']),
	attempts: zod.number().int().nonnegative(),
	unknown: zod.boolean(),
	inputTokens: zod.number().int().nonnegative(),
	outputTokens: zod.number().int().nonnegative(),
	cachedInputTokens: zod.number().int().nonnegative(),
	reasoningTokens: zod.number().int().nonnegative(),
	estimatedCostUsd: zod.number().nonnegative().nullable(),
});
const NUMBER_FORMAT = new Intl.NumberFormat('en-US');
const COST_FORMAT = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'USD',
	minimumFractionDigits: 2,
	maximumFractionDigits: 6,
});

export function ReviewUsage({ usage }: { usage: unknown }) {
	const parsed = UsageSummary.safeParse(usage);
	const summary = parsed.success ? parsed.data : undefined;
	const isScripted = summary?.mode === 'offline';
	const isUnknown = !summary || summary.unknown || isScripted;
	let label = 'Model usage · Unknown / may be incomplete';
	if (isScripted) {
		label = 'Model usage · Scripted model';
	} else if (summary && !isUnknown) {
		label = `Model usage · ${NUMBER_FORMAT.format(summary.inputTokens)} input / ${NUMBER_FORMAT.format(summary.outputTokens)} output tokens`;
	}

	return (
		<details className="border-t py-4 text-metadata">
			<summary className="cursor-pointer font-medium">{label}</summary>
			<div className="mt-4 space-y-4">
				<p className="text-muted-foreground">
					Usage belongs to this saved review execution. Synchronization usage is separate.
				</p>
				{isScripted && (
					<p>Scripted model output. Actual model usage and cost are unavailable.</p>
				)}
				{isUnknown && !isScripted && (
					<p>Unknown / may be incomplete. Known subtotals are not a complete bill.</p>
				)}
				{summary && (
					<dl className="grid gap-4 sm:grid-cols-2">
						<div>
							<dt className="text-muted-foreground">Model attempts</dt>
							<dd className="mt-1">{NUMBER_FORMAT.format(summary.attempts)}</dd>
						</div>
						<div>
							<dt className="text-muted-foreground">Estimated cost</dt>
							<dd className="mt-1">
								{isUnknown || summary.estimatedCostUsd === null
									? 'Unknown / may be incomplete'
									: COST_FORMAT.format(summary.estimatedCostUsd)}
							</dd>
						</div>
						{!isScripted && (
							<>
								<div>
									<dt className="text-muted-foreground">
										{isUnknown ? 'Known input tokens' : 'Input tokens'}
									</dt>
									<dd className="mt-1">
										{NUMBER_FORMAT.format(summary.inputTokens)}
									</dd>
								</div>
								<div>
									<dt className="text-muted-foreground">
										{isUnknown ? 'Known output tokens' : 'Output tokens'}
									</dt>
									<dd className="mt-1">
										{NUMBER_FORMAT.format(summary.outputTokens)}
									</dd>
								</div>
								<div>
									<dt className="text-muted-foreground">
										Cached input (included in input)
									</dt>
									<dd className="mt-1">
										{NUMBER_FORMAT.format(summary.cachedInputTokens)}
									</dd>
								</div>
								<div>
									<dt className="text-muted-foreground">
										Reasoning (included in output)
									</dt>
									<dd className="mt-1">
										{NUMBER_FORMAT.format(summary.reasoningTokens)}
									</dd>
								</div>
							</>
						)}
					</dl>
				)}
				<details>
					<summary className="w-fit cursor-pointer text-muted-foreground">
						Saved usage JSON
					</summary>
					<pre className="mt-3 max-h-80 overflow-auto font-mono text-identifier whitespace-pre-wrap wrap-anywhere">
						{JSON.stringify(usage, null, 2) ?? 'null'}
					</pre>
				</details>
			</div>
		</details>
	);
}
