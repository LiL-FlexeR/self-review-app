# Executed S02 offline example

These files were saved by `backend/test/workflow.integration.test.ts` after password + OTP, an owned fixture connection, a real BullMQ worker, persisted Postgres snapshots, scoped model tools, and automatic review. Mail/model/source boundaries are synthetic; the application orchestration and storage are real.

- [JSON](offline-review.json): validated report and coverage envelope.
- [Markdown](offline-review.md): rendered from the same saved ReportDraft and sources.
- [Safe trace](offline-trace.json): tool names, counts, bytes, and explicit scripted/unknown usage, without prompts, secrets, or encrypted reasoning.

The example saves 6 project tasks, and Anna's report considers her 5 tasks. The scripted researcher requests comments for DEMO-101; the measurement remains qualified to staging, while started/planned work remains a task description. The separate description-evidence fixture does not request comments. These programmed choices do not establish real-model judgment. Test-generated UUIDs are synthetic execution identifiers and do not resolve against a user's local database.

Regenerate through the isolated integration suite. Live OpenAI and manual browser verification remain outside this example's evidence; see [ROADMAP](../../ROADMAP.md).
