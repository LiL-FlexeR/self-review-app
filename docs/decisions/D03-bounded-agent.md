# D03 — bounded agent and snapshot-based self-review

Date: 2026-11-10. Updated for background synchronization, task browsing, and a shared review stage triggered automatically after sync or by a button.

## Confirmation status

Accepted as an architecture decision on 2026-11-11. The user confirmed a custom orchestrator over the official OpenAI TypeScript SDK and Responses API, using gpt-5.4-mini-2026-03-17 with reasoning effort low throughout sync analysis, reduction, and self-review. The sync → saved tasks → self-review flow and the optional automatic review have also been agreed. Acceptance does not mean implementation: no application code or authenticated model smoke test exists yet.

## Choice

| Option | Assessment |
| --- | --- |
| Standard importer + a single generation | Suitable for transferring data, but does not demonstrate useful selection of additional tools |
| Official OpenAI SDK + an explicit tool-calling loop | Selected: one bounded research agent with application-owned dispatch, validation, budgets, and safe traces; self-review reuses saved evidence |
| OpenAI Agents SDK with one agent | Alternative: provides an agent runtime and tracing integrations; adds a framework to configure, while application-specific scope, persistence, and spending controls still need implementation |

Use the official OpenAI SDK directly with a small, explicit loop. Code imports and saves every page in the period, then list/details calls are mandatory in each analysis batch; the model chooses subsequent comments based on the content. Code controls the saved task set, database writes, scope, and terminal state. Data transfer itself is not presented as an intelligent task.

The assignment requires multi-step agent behavior, not a particular SDK; it explicitly permits a custom orchestrator. Our agent uses tool results to decide which comments to read and then produces evidence-backed findings. Merely adding an agent framework would not demonstrate that behavior. The Agents SDK does not require multiple agents or inherently increase model calls. The custom loop is selected for this workflow's small tool set and explicit per-request accounting; both approaches can support those controls. Official documentation rechecked on 2026-11-11: [function-calling loop](https://developers.openai.com/api/docs/guides/function-calling) and [Agents SDK](https://developers.openai.com/api/docs/guides/agents/sdk).

Sync stores normalized primary snapshots separately from the validated SyncAnalysis. Review uses all of the token owner's tasks in one snapshot: structured batch results are combined into the final summary, without repeated external research or selecting only the first tasks. Code decides generateReview based on the user's request; the model does not. The manual and automatic paths reuse one ReviewService. Versioning/selected resync behavior is defined in [D05](D05-sync-review-and-refresh.md). Agent observations are not primary evidence and do not replace source quotations.

## Model and API

Use the Responses API and official openai TypeScript SDK with gpt-5.4-mini-2026-03-17 and reasoning.effort=low for every AI stage. Explicitly set both parameters rather than relying on SDK defaults. The snapshot reduces the risk of an unnoticed model change but does not make output deterministic. There is no automatic model or effort fallback.

The same mini model with effort none was considered for lower latency; full-size GPT-5.4 with effort low was considered at higher token rates. The selected configuration is a starting point for tool decisions and evidence comparison, not a measured quality advantage for this application. S02 verifies the real model against the example invariants and existing unit budgets; a separate model benchmark is outside scope.

Model capabilities rechecked on 2026-11-11: the [model page](https://developers.openai.com/api/docs/models/gpt-5.4-mini) documents the snapshot, Responses API, function calling, Structured Outputs, and effort low. The [reasoning guide](https://developers.openai.com/api/docs/guides/reasoning) explains the effort trade-off and output-token accounting. SDK and schema references: [SDK](https://developers.openai.com/api/docs/libraries), [function calling](https://developers.openai.com/api/docs/guides/function-calling), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs). Confirm the specific account's snapshot access and compatibility with the pinned SDK in S02; documented support alone does not establish access or working output under this application's limits.

## Consequences

Validate JSON and generate Markdown in code from the same result. Source IDs refer to immutable snapshots, so a new sync does not overwrite evidence for an older report. A quotation proves where the text came from, rather than its truth or semantic correctness.

The queue may redeliver work; this does not authorize spending tokens again. The attempt journal, database claim, and prohibition on automatic whole-agent retries are described in the [sync workflow](../architecture/sync-workflow.md); numerical budgets per unit and unknown usage are in the [agent workflow](../architecture/agent-workflow.md#limits-and-costs).

Few AI dependencies and a transparent loop, but correlation IDs, budgets, guards, and errors must be implemented manually. Production requires broader evaluations, a data policy, and operational guarantees; the interface must make these limitations visible.
