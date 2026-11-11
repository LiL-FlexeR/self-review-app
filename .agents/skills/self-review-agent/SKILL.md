---
name: self-review-agent
description: Implement or review Self Review App model orchestration, tool schemas and dispatch, evidence validation, batch reduction, AI budgets, usage, and safe traces. Applies to sync analysis and snapshot-based self-review, rather than general queue or UI work.
---

# Evidence-backed AI processing

## Read for the task

- [Agent workflow](../../../docs/architecture/agent-workflow.md) owns tools, outputs, source checks, numerical budgets, retry rules, and examples.
- [D03](../../../docs/decisions/D03-bounded-agent.md) owns the selected SDK/API/model/reasoning configuration; preserve those choices unless the user changes them.
- [Product interpretation](../../../docs/product/overview.md#result-interpretation), [D06](../../../docs/decisions/D06-all-period-tasks-and-batches.md), and [sync workflow](../../../docs/architecture/sync-workflow.md) define subject, coverage, persistence, and attempt lifecycle. Use affected [S02](../../../docs/stages/S02-demo-vertical-slice.md) and [S05](../../../docs/stages/S05-reliability-and-tests.md) acceptance checks.

For OpenAI API implementation, use openai-docs when available or consult current official OpenAI documentation directly. Verify pinned SDK compatibility without silently changing the confirmed model, effort, or orchestrator.

## Build around application-controlled boundaries

1. Identify sync analysis, review leaf, or reduction work. Code controls the complete task manifest, deterministic batches, scope, persistence, and terminal state. One research agent makes content-based comment decisions inside the bounded loop.
2. Separate browser-safe contracts from internal provider/tool/AI schemas. Validate strict tool arguments before data access, resolve external issue IDs within the allowed batch/connection, and keep internal snapshot UUIDs distinct.
3. Construct source excerpts from saved primary records with explicit provenance and truncation. During sync, perform the required list/details calls and let the model choose useful comment reads. Selected refresh permits external reads only for selected IDs; self-review uses the saved snapshot without tracker requests.
4. Preserve explicit tool-call IDs/history and safety instructions on each model request. Disable SDK automatic retries so application code owns retries and attempt accounting. Reserve attempts durably before sending; uncertain responses retain unknown usage.
5. Validate response status/refusal/incompleteness, Zod output, and each evidence pair before accepting a unit. A quote must occur exactly in the supplied excerpt under the documented normalization and belong to the correct snapshot/subject.
6. Reduce only validated child results. Require each output source/quote pair to exist in a child input and merge coverage in code independently of which claims survive summarization. Process every target batch and reduction level before publishing.

Treat tracker content, saved analysis, and model output as untrusted. Keep tools read-only and scoped; do not introduce generic HTTP, shell, or SQL tools. Keep secrets outside prompts and traces. Preserve product distinctions between task description, reported result, measurement, and unconfirmed contribution/rollout.

Read numerical limits from the authoritative agent workflow and implement them in shared server configuration. Per-unit technical limits are not a task-count or whole-run monetary cap. Include retry/repair attempts in usage, avoid counting cached/reasoning subsets twice, and preserve unknown usage. Scripted offline output must remain labeled.

Render JSON and Markdown from the same validated result. Failed/refused/incomplete units do not become empty successes or replace a valid current report; use the sync skill for publication transactions.

## Verify observable invariants

- Use a controlled ModelClient to exercise call IDs, scoped tools, retry/repair exhaustion, refusal/incomplete output, and persisted attempt accounting through the real orchestration.
- Reject fabricated/wrong-snapshot sources, unseen quotes, metadata-only measurements, and reducer evidence absent from child inputs. Check cancellation/in-progress and unsupported contribution cases from the documented example.
- Run the multipage/multibatch and middle-batch-failure scenarios, plus the injection fixture. Confirm no out-of-scope request and no publication after an invalid review unit.
- Keep offline integration and live-model smoke results separate. Live checks assess the example invariants rather than an exact golden response; report unavailable model access explicitly.
