# S06 — submission preparation

## Goal and dependencies

The evaluator can quickly start the application and complete the agreed workflow while understanding its limitations. Depends on S05. Status/budget: [ROADMAP](../../ROADMAP.md).

Required UI context: read every source in [Frontend design inputs](README.md#frontend-design-inputs) for final UI review and any corrections; use UX.md as the screen/state checklist.

## Changes and boundaries

- Update the README to match the working application; remove the “not implemented” status only after an actual run.
- Document reproducible Compose startup, environment/secret setup, migrations, login and Mailpit, and model/source modes.
- Add synthetic input/JSON/Markdown, a safe trace, and an explanation of how scripted expectations differ from a live output example.
- Prepare public Git with code/docs/lockfile/migrations/Compose, without keys/.env/private tickets/volumes/generated artifacts.
- If implementation time permits, add one CI workflow with the same unit/integration/build checks; do not add deployment, OAuth, or new features.

## Evaluator's manual scenario

1. Clean checkout → npm run setup → workspace env files/secrets → npm run docker:up. App at :3000, Mailpit at :8025; migrations finish before the app/worker starts.
2. Signup with email/password → open the OTP email → verify. The project is inaccessible before OTP.
3. Offline: add a demo connection, find Demo Platform, select October, run sync, and see SSE and saved tasks.
4. Close the page during work and return; the saved status and result are accessible. Restarting the API does not lose snapshots.
5. Review for the demo token owner (Anna) → citation/source → Markdown/JSON; repeat with generateReview=true and selected resync. Export does not call the model.
6. Demo with real OpenAI; then a live smoke test for each implemented source using the evaluator's own test credentials.
7. Verify access renewal and SSE recovery, including two tabs sharing cookies. Log out and sign in as a second user in the same browser: cached data, queued replays, and late responses from the first user are not displayed or executed for the second account, and local old SSE streams are closed. A rejected refresh leads to password + OTP; an infrastructure failure shows a retryable error. Record automated expiry/concurrency results from S01/S05 alongside the manual browser observations. Check keyboard access, a narrow viewport, and partial/empty/error states.
8. Compare the delivered screens and their states with [UX.md](../design/UX.md) and the [shared visual/token inputs](README.md#frontend-design-inputs). Confirm consistent theme use and record material adaptations, unresolved differences, and actual manual observations.

## Acceptance criteria

- All promised scripts/URLs/examples exist and have been verified; the test database is separate, and secrets have not entered tracked files/image history/trace.
- The README covers the problem, users, scope/non-scope, business cases, architecture, setup, verification, examples, tradeoffs, and next steps; assignment requirements and additional project choices are distinguished.
- It includes the exact phrase Not in production today, 2–3 types of teams, and required production improvements, including operational monitoring, authorized data access/model transmission, human review, retention, and applicable privacy/compliance requirements.
- Mailpit mode is not described as delivery to real email; the scripted model is not described as live AI.
- Unverified adapters and incomplete requirements are explicitly identified. The ROADMAP includes actual time, and the revised scope is not presented as a validated five-hour estimate.
- The public repository is accessible to the evaluator; publishing the completed set is part of implementation, and no remote is created now.

## Commands

```bash
npm ci
npm run infra:up
npm run db:migrate:test
npm run check
npm run test:unit
npm run test:integration
npm run build
npm run docker:up
```

Repeat checks after a new change, failure, or clean installation. Save actual automated check and manual smoke-test results rather than recording success based on a plan alone.
