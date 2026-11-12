# D06 — all tasks in the period and batch processing

Period sync retrieves all accessible tasks in the selected project within the createdAt period. Batch size is not a business limit.

## Confirmation status

Accepted 2026-11-11: complete paginated import, deterministic batches, and successive reduction. Numerical budgets are implementation defaults, not measured guarantees or separate user preferences. They impose no total task-count or monetary cap; the [agent workflow](../architecture/agent-workflow.md#limits-and-costs) owns spending and technical limits.

## Choice and alternatives

| Option | Assessment |
| --- | --- |
| Keep only the first tasks or ask the user to narrow the period based on the count | Does not meet the new requirement |
| Put all descriptions into one prompt | Conflicts with bounded model context/costs and does not work for large projects |
| Complete paginated import, bounded batches, and successive reduction | Selected: data completeness is separated from the size of one operation and one summary |

Code traverses all pages and saves the manifest and details independently of the model. The agent investigates saved tasks in batches through list/details and adaptive comments. Validated outputs are stored in AnalysisBatch; compact overall analysis and self-review combine them across several levels without changing primary quotations. This is one research agent with deterministic orchestration, rather than a team of agents.

## Consequences

Tool/model attempt, byte, output, usage, and time limits apply to an individual unit of work rather than limiting the project's task count. Total duration and cost grow with volume; per-batch caps are not presented as a hard monetary cap for the entire run. Actual usage is summed across all attempts; unknown usage is retained.

Import can be complete while AI analysis is incomplete. Succeeded requires completed pagination, retrieval of accessible data, and all target analysis/reduce units. Failures appear as partial/failed with coverage rather than silently discarding the remainder; expected excerpt/comment limits are distinguished from technical incompleteness by the [state rules](../architecture/sync-workflow.md#states). Automatic review still starts only after a succeeded sync. A review leaf/reduce failure does not replace the previous current report.

Batch state and coverage are stored in Postgres; the worker holds only the current batch in memory. A deadline for the current unit and a heartbeat detect stalled work, so a long but progressing import is not interrupted because of its size. Automatic whole-agent retries remain prohibited.

Authoritative rules: [product specification](../product/overview.md#selection-rules), [agent workflow and budgets](../architecture/agent-workflow.md#limits-and-costs), [queue/SSE](../architecture/sync-workflow.md#completeness-and-selection-size). AnalysisBatch storage is described in the [architecture](../architecture/overview.md#data).
