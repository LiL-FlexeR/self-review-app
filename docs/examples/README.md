# Executed examples

## Offline: synthetic source and scripted output

These files were saved by `backend/test/workflow.integration.test.ts` after password + OTP, an owned fixture connection, a real BullMQ worker, persisted Postgres snapshots, scoped model tools, and automatic review. Mail/model/source boundaries are synthetic; the application orchestration and storage are real.

- [Input](offline-input.json): the fixture's eight candidate tasks and available comments, UTC period, project and synthetic subject. This is reference data, not an upload endpoint.
- [JSON](offline-review.json): validated report and coverage envelope.
- [Markdown](offline-review.md): rendered from the same saved ReportDraft and sources.
- [Safe trace](offline-trace.json): tool names, counts, bytes, and explicit scripted/unknown usage, without prompts, secrets, or encrypted reasoning.

The example saves 6 project tasks, and Anna's report considers her 5 tasks. The scripted researcher requests comments for DEMO-101; the measurement remains qualified to staging, while started/planned work remains a task description. The separate description-evidence fixture does not request comments. These programmed choices do not establish real-model judgment. Test-generated UUIDs are synthetic execution identifiers and do not resolve against a user's local database.

Fixture projects are created for the signed-in account with Anna (`demo-anna`) as the synthetic token owner: `demo-platform` supplies the main example, `demo-137` traverses nine source pages, and `demo-evidence` exercises description-only evidence. Fixture source URLs are null; citations open saved quotations.

Two candidates fall outside October: DEMO-104 was created immediately before the period and DEMO-107 at the next month's boundary. Six tasks are saved, including Boris's DEMO-105; only the five assigned to Anna enter her self-review. The injection in DEMO-103 stays untrusted task text. The input lists comments available at the source; it does not imply that the model read every comment.

## Reproduce and assess

From the repository root, install and prepare the isolated infrastructure as described in [README](../../README.md#verification), then run `npm run test:integration`. The authenticated workflow test rewrites all four artifacts from the executed fixture workflow. IDs, retrieval times, trace timing and ordering can change; compare invariants and exact source quotations rather than whole-file equality. Regeneration uses only the separate test database/Redis namespace.

For a real-model example, start `APP_MODE=demo` with the worker's OpenAI key and repeat [the evaluator walkthrough](../../README.md#evaluator-walkthrough). Save JSON and Markdown from the resulting report and inspect its actual trace. Tool choices, wording, usage and even failure outcomes can differ: the model is not programmed to request DEMO-101 comments. Validate source/snapshot IDs and exact quotes, the five-task subject coverage, staging qualification and treatment of unfinished work. Successful validation establishes those structural/evidence checks; a person still reviews interpretation and attribution.

## Demo: synthetic source and real OpenAI

[Demo JSON](demo-review.json), [Markdown](demo-review.md), and [safe trace](demo-trace.json) were read from an isolated S06 runtime after browser signup + Mailpit OTP, full-period sync with automatic review, and manual regeneration. The model was `gpt-5.4-mini-2026-03-17`, reasoning `low`. The source is the same fixture represented by [the input file](offline-input.json); the runtime mode is `demo` rather than `offline`. The trace contains the sync and the manual review, whose IDs differ because they are separate jobs.

This executed sync used list/details and chose no comments. Its review covers Anna's five tasks, keeps unfinished/canceled work as task descriptions, and makes no staging measurement claim. All nine evidence pairs match the report's source registry and snapshot. The malicious text appears as quoted task content; no arbitrary URL tool exists. This observation is not a general semantic-safety guarantee. Usage is known from the real API; tariff estimates are separate from actual billing.

The offline expectation deliberately reads DEMO-101's comment and reports a qualified staging measurement. The live example demonstrates a different content choice, not a failed equality check against a golden answer. Re-running the model may produce other wording, tool choices, or a bounded failure. These files are a captured run and are not rewritten by the offline integration suite.

Actual real-model and live-provider runs, manual browser observations, and account-dependent limitations are recorded in [ROADMAP](../../ROADMAP.md). No private tracker tickets are included in either example.
