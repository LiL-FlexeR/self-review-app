# Self Review App redesign implementation plan

Implementation handoff, 2026-11-13. Implementation follows the user-authorized phase; this plan does not independently authorize later phases or backend tracks. Read the [audit baseline](UI_AUDIT.md), [target guidelines](UI_GUIDELINES.md) and reconciled [visual specification](DESIGN.md). Actual verification remains in [ROADMAP](../../ROADMAP.md#current-verification).

## Outcome and scope

Deliver a coherent evidence-first developer tool: minimal Connections/Projects navigation, efficient project discovery, a project workspace with Overview/Tasks/Self-review/Activity, readable saved reports and contextual evidence inspection. Preserve the existing authentication, provider selection, queue/SSE, snapshot, ownership and evidence invariants through incremental changes.

The ten phases below are incremental implementation slices; actual delivery and executed checks are recorded in ROADMAP. Phases 1–2 establish shared foundations; Phase 3 is the first end-to-end visual pilot and the standard for later screens. Phases 4–8 can be reviewed individually against that pilot. Shared-state and responsive checks occur in every phase; Phases 9–10 reconcile the complete journey rather than postponing accessibility until the end.

UI work should not wait for optional backend enhancements. However, a complete dated Activity/history experience and local project deletion cannot be represented as completed until their support is delivered. No fake action, invented field, or partial dataset labeled complete is acceptable.

## Authoritative documents and required reconciliations

Existing [product](../product/overview.md), [UX](UX.md), [DESIGN](DESIGN.md), [architecture](../architecture/overview.md), [sync](../architecture/sync-workflow.md), [agent](../architecture/agent-workflow.md), D02/D04/D05 remain the sources of truth. The user approved the target screen architecture; the differences below must be reconciled in the owning specification with each authorized implementation slice. Phases 1–4 reconcile the Tasks workspace, workspace pilot, typography, spacing, shapes, control/focus boundaries, feedback roles and the width-aware application shell; remaining screen interiors and backend changes remain assigned to their later phases.

| Baseline rule / implementation | Target difference and reason | Owning update before/with implementation |
| --- | --- | --- |
| UX Connections shows provider cards/forms; inline credential management | Provider-action strip, compact account rows, Dialog forms and AlertDialog deletion reduce configuration noise | UX Connections; link to guidelines for visual details. Product/D04 limits and identity rules stay intact |
| UX catalog is a list without search semantics | Table with provider filter and explicitly loaded-resource search | UX Project catalog; retain D02 pagination/source semantics |
| UX project page combines sync/history/tasks/review | Four local sections and persistent context/job strip shorten paths to primary work | UX Project page, Snapshot tasks, Self-review; architecture Frontend UI composition |
| Architecture Frontend UI specifies Sheet for selected refresh | Dialog for short refresh confirmation; Sheet retained for substantial task/evidence reading | Architecture Frontend UI and UX selected-refresh interaction |
| DESIGN assumes a 900px content ceiling and approximately 260px rail | Per-content widths, 240px expanded sidebar; tables and prose have different needs | DESIGN Layout and width prohibition; variables.css layout tokens; frontend-guide adaptation notes |
| Reference sizes stop at 16px and baseline spacing omits 24/48px | Explicit title/report type roles, readable metadata, deliberate extra spacing steps | DESIGN application adaptations, tokens.json/variables.css/theme.css and implementation mappings together |
| Named 6px button radius conflicts with filled-button 12px prose | Filled/input 12px; quiet buttons 6px; semantic roles clarify intent | DESIGN radius examples and named reference tokens reconciled before use |
| Minimal palette lacks semantic feedback/boundary roles | Named neutral success/warning/error/destructive roles, strong control border and consistent focus | DESIGN adaptations and semantic theme mappings; preserve baseline colors and reference precedence |
| Model usage displayed as JSON, identifiers as primary labels | Human summaries and readable provenance, full safe detail on demand | UX Self-review/Activity; no pricing or model changes |
| Product has no individual local-project delete behavior | Add explicit local-history deletion semantics with rediscovery rules | Product Projects and snapshots; architecture Data/API; D04/D05 cross-links where necessary; see backend track |
| Storage has timestamps/versions not fully discoverable through public views | Intentional owned metadata/history API extensions if richer UI is delivered | Architecture API/data and contracts; no automatic assumption from Prisma fields |

Keep UI_GUIDELINES as the visual application guide linked from the owning visual/UX sections when implementation starts. Do not maintain two competing lists of product or security rules. Do not add redesign phases as completed S01–S06 work or replace their prior verification with a plan.

## Implementation boundaries and data dependencies

Every path below is repository-relative. Existing public schemas are in [contracts/src/workflow.ts](../../contracts/src/workflow.ts), routes/services in [projects](../../backend/src/modules/projects/projects.controller.ts), and persistence in [schema.prisma](../../backend/prisma/schema.prisma). New components follow `PascalCase/index.tsx`; new templates require actual shared consumers.

| Work | UI-only delivery possible now | Separate support / honest interim |
| --- | --- | --- |
| Connection dialogs and rows | Yes; keep existing POST/PUT/DELETE and ProviderForm validations | No rename feature or connection-wide idle indicator exists. Use persisted status, local verifying/error state and safe conflict feedback |
| Merged project table/search/filter | Yes; one infinite query/cursor per connection | Global search over undiscovered resources requires new search/indexing semantics; retain “Search loaded projects” |
| Workspace tabs/context/period | Yes; keep route and snapshot parameter | Tasks-mode selection needs validated recursive base resolution using existing owned job reads; missing context is a visible error |
| Sync and review status | Yes; stage mapping and completeness flags, separate transport state | No fictitious Saving stage. For cross-level batch ratios use existing paginated batches, or defer ratio; normalized progress summary is optional API work |
| Saved and eligible counts | Saved count exists; review target/coverage exists once review is available | Sync targetTasks means all saved tasks. Pre-review eligible count can be unavailable; no client guess from the first task page |
| Historical snapshots and their current reports | Yes; paginated syncs and currentReviewReportId | Complete older regeneration history/report-ID discovery needs a new owned paginated contract. ProjectDetail.runs is only 20 recent runs |
| Previous-snapshot report fallback | Yes, if its actual historical pointer is fetched | Resolve through existing history, progressively; do not claim there is no older report when history has not finished loading |
| Last sync / dated Activity | Only actual report/source/trace timestamps are exposed | JobView lacks run timestamps. Expose safe created/started/finished metadata before completion-time labels; never use browser receipt time as execution time |
| Snapshot review subject | Connection identity has the verified name/ID; ReviewView carries saved subject ID | JobView lacks captured subjectSourceUserId. Use connection as verified context and report as saved provenance; richer snapshot provenance needs explicit exposure |
| Assignee display names | Known token-owner ID may use its verified name; other IDs remain readable | No assignee directory or arbitrary avatar lookup. Names/photos require provider normalization + public contract support |
| Rich source metadata | Source registry supplies kind/text/dates/truncation/URL; TaskDetail supplies saved comments/read state | Comment author/read time/error reason and copied-from navigation are not all typed task fields. Extend deliberately if needed; do not rely on stripped server JSON |
| Local project deletion | No | Product/API/service/persistence/concurrency track below; omit trash until real acceptance passes |

No new endpoint path is specified here as an existing API. Future API designs must be documented and reviewed in architecture/contracts before UI consumers use them.

## State and navigation decisions

Keep `/projects/:id` and existing `?snapshot=` semantics. Use local Radix Tabs for Overview/Tasks/Self-review/Activity; default Overview. A shared page-level controller keeps active-run discovery, useJobStream, pending command/idempotency key, selected snapshot and selection alive across tab unmounts. Tab changes and source-panel opening are view actions, never mutations.

Initial local tabs reset to Overview after a reload; selected snapshot remains addressable. This is a deliberate trade-off against URL-backed tabs: simpler compatibility now, weaker shared section links and browser Back restoration. Do not introduce a `tab`, `report`, or new route convention implicitly. Full report-history delivery should choose explicit report navigation/restoration semantics with the API work; current historical-snapshot links remain supported.

Snapshot changes preserve unrelated URL state, reset task cursor/selection and partial-review acknowledgment, close stale detail panels, and cancel/disregard old resource responses. Resolve explicit snapshot links via GET even if absent from loaded history; never silently substitute a different snapshot after a 404. Failed/partial attempts remain inspectable while latest-successful remains the default. A new successful snapshot does not make a previous report current.

## Phase 1 — Design system foundations

**Objective:** establish the approved visual vocabulary and reusable primitive behavior before page composition changes.

- **Scope and likely files:** `frontend/src/styles/globals.css`; existing `components/ui/Button/variants.ts`, Input, Alert, Status, Card; add Dialog, AlertDialog, Tabs, Table as actually consumed. Reconcile `docs/design/{DESIGN.md,tokens.json,variables.css,theme.css}` and relevant frontend-guide notes during implementation.
- **Dependencies:** all five design inputs and common/frontend style guides. Use shadcn CLI 4.23.0/new-york/Radix as the frontend guide requires; review generated imports, rename to local component directories and preserve exact dependency pins. The installed umbrella Radix package may already supply primitives; inspect generated changes before adding packages. No font, form, toast or table dependency is automatic.
- **UX changes:** distinguish inline pending/success, blocking error, coverage warning and destructive confirmation. Preserve content and action meanings while adding semantic roles.
- **Visual requirements:** guideline palette, readable type/metadata, 4px spacing scale, control boundaries, shape rules, one focus treatment; no universal card restyle that breaks auth/navigation.
- **Acceptance:** all consumed primitives have normal/hover/focus/disabled/invalid/pending examples; no Ash essential text; dimensions/semantic roles agree across reference assets and implementation; no accidental numeric Tailwind-spacing override. Contrast targets are documented and inspected.
- **Testing:** run the repository's design-token checker through `npm run check`; existing unit suite/build; manually render synthetic primitive examples in the actual app and inspect keyboard/focus/zoom. No new tests that merely snapshot class strings.
- **Risks:** generated source/config drift, conflicting radius-by-size classes, weak neutral error differentiation, and unintended global theme changes. Keep additions small and reconcile owning references in the same change.

## Phase 2 — Application shell

**Objective:** make navigation, width and page hierarchy consistent across dense and reading views.

- **Scope and likely files:** `components/templates/AppShell/{index.tsx,types.ts}`, AppSidebar, UI Sidebar/use-mobile as needed; shared PageHeader; existing page call sites.
- **Dependencies:** Phase 1 tokens and primitives; retain existing auth coordinator and account query. No auth or routing rewrite.
- **UX changes:** exactly Connections/Projects, clear active state, compact account/footer and sign out, a small truthful mode indicator. Move detailed session explanation into accessible account help while preserving its meaning. Add page width presets rather than repeated hardcoded wrappers.
- **Visual requirements:** 240px expanded rail, target content ceilings, consistent title/action alignment, 32/24/16px page padding and restrained active teal.
- **Acceptance:** long account labels wrap/disclose without layout breakage; project route remains under active Projects; mobile menu closes and restores focus; all routes/deep reloads and skip link still work. Content width choices do not cause page-level overflow.
- **Testing:** root checks/unit/build; manual 1440/768/390px shell, collapsed rail, keyboard and 200% zoom. If identity/recovery code changes, rerun relevant HTTP auth checks and S06 two-tab scenarios.
- **Risks:** universal wrapper assumptions, sticky headers hiding focus, and login flashes during renewal. Keep the coordinator untouched unless a required change is independently verified.

## Phase 3 — Project Overview pilot

**Objective:** establish the workspace and prove the redesign with a complete saved-data workflow before expanding it.

- **Scope and likely files:** `pages/project/index.tsx`; project-local ProjectHeader, WorkspaceTabs, Overview, SyncControls, SyncProgress, SnapshotSelector; helper for safe period formatting/base resolution; `hooks/use-job-stream.ts` only if structured presentation needs it. Reconcile UX and architecture UI composition.
- **Dependencies:** Phases 1–2; public ProjectDetail/JobView; existing sync/job/snapshot reads and mutations; sync + UI skills. Rich run timestamps are a separate API track, not a pilot prerequisite.
- **UX changes:** four tabs; persistent project/owner/snapshot/period context; state-driven next action; period configuration expanded initially and secondary after a saved snapshot; persistent active-job strip. Initially mount existing task/report/activity compositions in their corresponding sections to preserve access before later refinements.
- **Visual requirements:** flat overview sections, concise facts, human period labels, separate processing/connectivity dimensions. No metric-card grid, raw JSON/UUID-led header or fictitious staged progress.
- **Acceptance:** no-snapshot → queued/running → saved snapshot → optional child review is understandable; disabled/conflicting commands retain reason. Partial/failed attempts and prior success remain accessible. Full/selected sync keep automatic review false by default. Counts distinguish saved from eligible and incompatible batch metrics. Snapshot deep link and latest-successful selection remain correct. Background work survives tab changes, navigation, reload and reconnect without another POST.
- **Testing:** add meaningful client tests for period/base selection parsing, bounded chain/cycle/error handling, late snapshot responses and any changed stream/cache behavior. Retain existing auth/subscription tests. Run required HTTP workflow/reliability checks with isolated infrastructure, root check/unit/build. Manually inspect no snapshot, current/historical/partial selection, active sync, child review and exhausted reconnect at three widths; record actual rendered width.
- **Risks:** moving subscriptions into tab children; mutating the base period; interpreting JobRun.version as report version; treating partial as current success; losing idempotency keys during extraction. Approve the pilot's hierarchy with rendered synthetic states before cloning the pattern to other screens.

## Phase 4 — Tasks workspace

**Objective:** enable efficient saved-task inspection and safe selected refresh.

- **Scope and likely files:** extract project-local TaskTable, SelectionToolbar, RefreshTasksDialog; adapt `pages/project/components/TaskDetails/index.tsx`; use Table/Checkbox/Dialog/Sheet primitives; source metadata helpers owned by the project page.
- **Dependencies:** Phase 3 page controller; TaskView/TaskDetail and existing paginated tasks endpoint. Task IDs remain internal snapshot UUIDs; no server-wide task search or select-all command is assumed.
- **UX changes:** separate source status, assignees, creation date and freshness; contextual Refresh selected (N); selection survives pagination/tabs within one snapshot; clear on scope change or accepted refresh. Dialog shows inherited period, selected count, base and analysis/copy consequences. Sheet gives structured description/comments/findings/evidence.
- **Visual requirements:** dense readable rows, task title emphasis, accessible source-action targets, separated semantic badges, no raw timestamp walls; Sheet 640px/full-width mobile.
- **Acceptance:** all task pages reachable; selected IDs remain tied to the base; off-page selected count is accurate. Unread/successful-empty/failed/truncated comments remain distinct. Copied/stale records keep original retrieval dates; source links come only from safe registry metadata. Confirm uses existing selection command and false auto-review default; no task set expansion. Task/evidence panel navigation returns focus without stacked modal traps.
- **Testing:** client tests for cross-page selection/snapshot resets and confirmation payload; existing HTTP selected-refresh/provenance/ownership tests; full root checks as required. Manually inspect long/multiline records, no tasks, unavailable description, comment variants, partial/stale copies, keyboard checkboxes and horizontal scroll at all widths.
- **Risks:** client-side pagination disguising incomplete data, duplicate selection, inferred assignee names, “fresh” implying live currency, or retrieving external comments from the reader. Detail reads use saved data only.

## Phase 5 — Self-review

**Objective:** present a credible document that users can verify and export without losing provenance.

- **Scope and likely files:** adapt `pages/project/components/ReportView/index.tsx`; project-local ReviewDocument, EvidenceCitation/EvidencePanel, report header/actions/usage summary; reuse TaskDetails and TraceView where appropriate.
- **Dependencies:** Phase 3 snapshot/controller and Phase 4 evidence navigation; existing ReviewView/Source/ReportDraft and saved JSON/Markdown. Full regeneration-history discovery is a separate API track; current historical-snapshot reports must work with existing pointers.
- **UX changes:** document header/provenance, categories/work-area hierarchy, contextual numbered citations, visible limitations, distinct Create/Regenerate versus downloads. Preserve the old valid report while a new run is pending/failed. Known previous-snapshot fallback must be labeled accordingly.
- **Visual requirements:** 760px reading column, 16/28px paragraphs, quiet citation controls, no bordered container per claim, human period/version context. Usage/trace are secondary; partial source warning remains above the document.
- **Acceptance:** each quote/source pair opens exact saved evidence and safe link where available; null URL still yields useful internal evidence. Historical/current context agrees with sourceSyncRunId. Empty/zero-subject/no-supported-claim/failure cases use actual coverage/explanation. Downloads match saved JSON/Markdown; opening/exporting/citations initiate no model or tracker requests. Unknown/scripted usage never appears as actual zero. No invented report fields or claims.
- **Testing:** client tests for citation-pair numbering/resolution, unavailable source, usage unknown/scripted formatting and scope transitions; existing HTTP evidence/publication rollback/history tests. Run root checks/unit/integration/build. Manually inspect nonempty/empty/partial reports, regeneration failure, long limitations, evidence-panel Back/Escape/focus, both downloaded formats and responsive reading widths.
- **Risks:** stale pointers after terminal review, current/previous report confusion, disclosure hiding limitations, accidental Markdown/HTML execution and display-label claims stronger than the saved text. Render escaped text and validated references.

## Phase 6 — Connections

**Objective:** replace configuration-heavy pages with compact integration management.

- **Scope and likely files:** `pages/connections/index.tsx`; adapt ProviderForm and replace ConnectionCard composition with ConnectionRow/ConnectionManagement; Dialog/AlertDialog primitives. Preserve provider credential behavior rather than rebuilding it.
- **Dependencies:** Phases 1–2 and pilot standard; availableProviders, existing create/replace/delete contracts; UI + auth + provider skills for the affected boundaries. No API change is necessary for the core layout.
- **UX changes:** three live provider choices and connected account list; occupied provider → Manage; focused provider-specific forms; independent verifying/error feedback; replacement form; destructive local-data confirmation. Offline/demo offers only the actual fixture action.
- **Visual requirements:** divided rows, compact provider identity, visible verified owner/date, quiet Manage; token/site help beside relevant fields; no repeated large provider cards.
- **Acceptance:** one slot/provider respected even after conflict; credential fields masked and cleared on submit/cancel/error/unmount; no stored token is displayed. Jira email/cloudId/scoped token/help/warning remain. Different identity/site is rejected without replacing data. Deletion explains all local consequences, remote preservation and active-job blocking; errors stay actionable. Do not disable legal same-identity replacement just because a job runs. New-connection verification failure must not falsely change a saved connection's status.
- **Testing:** relevant client form/action-state tests if behavior moves; existing provider/auth HTTP cases, including same-identity replacement, scope mismatch and connection deletion with active jobs; root checks/unit/integration/build. Manual synthetic provider forms, validation, occupied slots, fixture/live availability, Cancel/Escape/focus/keyboard and narrow Jira dialog. Use isolated synthetic connections for confirmed destructive verification.
- **Risks:** remounting forms losing pending-result feedback, success replacing the trigger before focus restoration, showing an unverified name as owner, and assuming a connection-wide busy flag exists. Reconcile refetch completion outside a dismissed pending dialog.

## Phase 7 — Projects

**Objective:** support efficient discovery and opening across independent provider catalogs.

- **Scope and likely files:** `pages/projects/index.tsx`; adapt/extract Catalog query ownership into local hooks/helpers; ProjectTable/FilterToolbar; retain `Catalog/pagination.ts` and its tests; Table/Tooltip primitives. Optional deletion UI is gated by the backend track below.
- **Dependencies:** Phases 1–3 patterns, current ProjectView and per-connection catalog endpoint. TanStack Table is optional; use Table and simple derived filtering first. If added, verify/pin compatibility against the installed React/TypeScript versions and assess bundle impact.
- **UX changes:** provider/ID/name/location/actions table, Search loaded projects, All/provider filter; per-connection loaded/error/incomplete status and continuation controls. Open remains existing local route. No global search claim and no fixed-page substitute for full discovery.
- **Visual requirements:** compare rows at a glance, readable provider-specific IDs and hierarchy, explicit List labels, long-value disclosure and named icon actions; table overflow contained.
- **Acceptance:** all provider cursors can reach their end; errors/loops remain independent and successful rows stay usable. No duplicate cross-provider merging by name or ID. Search matches name/ID/location among loaded rows and clearly states incomplete discovery; clearing/filtering preserves fetched pages. No project delete control ships before real support; after support, delete/reappearance behavior is explicit.
- **Testing:** expand catalog unit tests for merged duplicates, provider filtering, loaded-search labels and failed-continuation retention; existing HTTP provider pagination/ownership tests. Root checks/unit/integration/build. Manual many/zero/duplicate-name resources, long IDs/breadcrumbs, partial discovery, load-more retry, filters and mobile scrolling/actions.
- **Risks:** central table component serializing discovery or collapsing error states; row disappearance mistaken for remote deletion; rediscovery recreating local data unexpectedly. Keep query lifecycle separate from row rendering.

## Phase 8 — Authentication

**Objective:** refine the focused entry journey without changing security behavior.

- **Scope and likely files:** AuthPanel, OtpForm, `pages/auth/components/LoginForm/index.tsx`, auth/otp pages only for presentation; Input/autofill base rules if needed.
- **Dependencies:** shared foundation; D04 and existing auth coordinator. No new recovery, OAuth, segmented OTP or password behavior.
- **UX changes:** stronger product/title/form hierarchy; field-associated errors; distinct resend-success feedback; grouped masked destination/expiry/mail hint and visible restart. Keep current-password/new-password/one-time-code autofill and paste support.
- **Visual requirements:** 440px ceiling, consistent field spacing and button height, readable autofill foreground/background, no decorative marketing split layout.
- **Acceptance:** signup/login still grant no access before OTP; challenge expiry/resend/restart and safe delivery errors remain correct; password/code never logged. Mailpit link depends on mailDelivery, not source/model mode. Retryable infrastructure failure differs from definite session rejection; deep return target remains authorized.
- **Testing:** existing auth/client/HTTP tests and full root checks; manual valid/invalid/expired/resend feedback, keyboard/paste/autofill, mobile keyboard and zoom using synthetic local mail. Repeat S06 two-tab recovery if shared auth handling changed.
- **Risks:** treating successful resend as an error, accidental persistence of secrets, repeated live announcements of countdowns, or visual changes disabling password managers.

## Phase 9 — Shared interaction refinement

**Objective:** make status, dialog, empty/error/loading and activity interactions consistent across the now-redesigned journey.

- **Scope and likely files:** shared ErrorState/EmptyState/LoadingState and consumed dialog compositions; project-local Activity/TraceView; page-level feedback. Avoid introducing a notification framework solely for completion messages.
- **Dependencies:** Phases 3–8 and state inventory; safe trace/batch endpoints. A dated complete run/report timeline requires the metadata/history track; without it, clearly label the recent-run subset.
- **UX changes:** readable safe events and lazy trace fetch, consistent recovery placement, durable warnings, one polite completion announcement and nonintrusive View result action. Distinguish read retry, reconnect and explicitly new execution.
- **Visual requirements:** inline progress instead of a bordered Alert for every state, consistent dialog footer/content spacing, meaningful empty-state text, safe technical detail disclosure.
- **Acceptance:** no raw internal log/prompts/model reasoning; safe trace pagination reaches later units. Errors retain usable saved content and correct recovery. All modal paths handle pending/success/failure/cancel, focus return and vanished triggers. No duplicated completion alerts or automatic tab switch.
- **Testing:** client late-response/stream-dedup/recovery tests as affected; relevant HTTP trace/ownership/recovery tests and root checks/unit/integration/build. Manual cross-screen state comparison, screen-reader announcements, task→source panel navigation and deletion cancel/conflict paths.
- **Risks:** an overly generic state component erasing domain distinctions; stale query data after deletion; raw safe event payload drift. Keep unknown payloads readable through a safe disclosure rather than inventing fields.

## Phase 10 — Responsive design and visual QA

**Objective:** verify the complete rendered product and regressions, not merely that extracted components compile.

- **Scope and likely files:** targeted corrections in previously affected components, owning design-spec adaptations and ROADMAP's latest actual verification. No browser automation framework or new backend scope by default.
- **Dependencies:** all preceding UI slices; backend tracks only for functionality included in the delivered scope; isolated synthetic scenario data and real local Postgres/Redis worker flow.
- **UX changes:** fix observed overflow, lost context/focus, unreachable controls, inconsistent state copy and navigation recovery. Do not invent features for visual balance.
- **Visual requirements:** 1440/768/390px actual layouts, 200% zoom, reduced motion, long names/IDs/quotes and all major feedback states; guideline type/spacing/color/radius consistency.
- **Acceptance:** all quality gates below pass or the delivery explicitly lists the remaining gap. Actual screenshot width must match the claimed viewport; a successful viewport API call alone is insufficient. Previously accepted product behavior remains intact. A source/build-only check is not visual completion.
- **Testing:** required isolated integration preparation and full root checks/unit/integration/build; manual screenshot/interactions matrix below. Existing client and HTTP tests remain; add regression tests only for new meaningful boundaries or observed failures.
- **Risks:** reproducing only a happy path, screenshots with private content, accepting a desktop-rendered “mobile” capture, or misrepresenting synthetic tracker/model checks as live acceptance.

## Local project deletion backend track

This is separate product/backend work required by the requested trash action. It is **not available today** and is not authorized for implementation in this planning task.

### Recommended product semantics

Use the action name **Delete local project data**. Delete the owned SourceProject and its saved runs, task/comment snapshots, analyses/batches/model-attempt metadata and reports. Keep its connection and credentials, other local projects and all Linear/ClickUp/Jira resources unchanged. Block deletion when this project has queued/running sync or review work; do not cancel jobs automatically or imply remote deletion.

Discovery is remote-backed and upserts SourceProject records. Therefore a later discovery request may recreate an empty local record for the same connection/external ID. State this in confirmation: “This removes saved history here. Your tracker project is unchanged and can appear again when projects are discovered.” New discovery must not resurrect deleted snapshots/reports. Opening the recreated resource uses its new local ID and begins without saved history. Old project/run/task/report links return a safe unavailable/not-found state.

This recommendation treats deletion as clearing local history, not hiding an available tracker resource forever. If the desired behavior is permanent catalog suppression, the product must explicitly choose an exclusion/tombstone with restore/rediscovery rules; that requires persistence beyond hard deletion. Do not silently implement an archive, browser-only hidden row or remote delete under a trash icon.

### Required changes and ordering

1. **Product/contract design:** update Product Projects and snapshots with data-loss, rediscovery and active-job rules. Specify an owned confirmed-delete command/response and safe conflict/not-found behavior in architecture/API and contracts. No existing project DELETE endpoint is assumed or named as implemented.
2. **Lock and concurrency design:** authorize via project → connection → user before effects. Serialize deletion, new job acceptance and relevant catalog upserts on a compatible connection lock, following the existing connection-row discipline; include automatic review continuation and accepted-but-not-enqueued runs. Recheck project existence after lock acquisition. UI disabling cannot close these races.
3. **Persistence analysis:** inspect JobRun base/source self-relations, currentReviewReportId, TaskSnapshot.copiedFromSnapshotId and report producing/source relations. Many primary relationships cascade, but NoAction/self references and pointer cycles require deliberate transactional deletion order or constraints. Do not assume `sourceProject.delete()` alone is proven safe. No schema migration is presumed necessary for hard deletion; determine it from executed FK/race checks. Tombstone semantics would require new storage/migration.
4. **Queue/reconciliation:** delete only after proving there is no accepted active job. Terminal BullMQ entries may still reference deleted run IDs; any late delivery/reconciliation must see missing/terminal scope and make no provider/model request. Preserve connection-wide deletion's stronger restrictions. Do not remove Redis jobs and then pretend that alone cancels durable work.
5. **Catalog interaction:** in-flight discovery before deletion and later discovery after it need deterministic outcomes under the lock. Do not automatically invalidate/refetch the whole remote catalog on deletion and instantly recreate the row. Remove the local row/query data after success; allow explicit later discovery/reload to recreate it, with the documented consequence. Other tabs/in-flight responses must not revive old local detail data; stale IDs recover via safe errors.
6. **Frontend:** add named trash action only after support passes; AlertDialog with consequences and rediscovery; Cancel initial focus; pending lock/error feedback; scoped cache cleanup and navigate back to Projects if deleting the open project. Connection deletion already invalidates account data and should retain its behavior.

Likely future files: `backend/src/modules/projects/projects.controller.ts`, `projects.service.ts`, jobs/connection locking helpers where required, `contracts/src/` command/error schemas, `backend/prisma/schema.prisma` and migrations only if justified, `backend/test/` HTTP persistence tests, Projects table and project/controller query cleanup. Read common/backend/contracts style guides and auth/sync/provider skills before that implementation.

### Acceptance and verification

Use real isolated Postgres/Redis and a worker, with synthetic external boundaries. Verify another user cannot delete by ID; missing confirmation is rejected; CSRF/Origin apply; double submission has defined behavior; active sync/manual review/automatic review and acceptance races cannot delete running work. Include accepted queue gaps and late worker delivery. Delete multiple snapshots with copied tasks, manual regeneration, current report pointers and historical base relations; prove complete removal of that project's local data while retaining other projects/connection/token. Remote adapters receive no write/delete request. Verify in-flight/later catalog discovery recreates only the intended empty record and old IDs stay inaccessible. Roll back on a persistence failure. Then manually confirm/cancel using disposable isolated data.

The unresolved product decision is whether this recommended rediscoverable local-history deletion matches the desired meaning of trash. The UI phases can proceed with no trash action while that decision and backend work remain open.

## Metadata and history backend track

This separate enhancement supports requested information the current public views do not expose. It must not be smuggled into a UI-only refactor.

- Expose safe run creation/start/completion timestamps in owned GET/history/SSE views consistently if the interface will promise last-sync times or a dated run timeline. Preserve the distinction from source retrievedAt and report createdAt; no schema change is needed merely to expose existing columns.
- Design paginated owned run/report discovery with real report IDs, producing/source run relationship, generated time and current-pointer context. Preserve existing report GET and immutable records. A 20-run preview is not a replacement. Include manual regenerations as well as automatic review; preserve saved IDs after reload.
- Decide report navigation/deep-link behavior explicitly, retaining snapshot links and checking ownership before showing saved data. A simple version chooser is sufficient; version comparison remains outside scope.
- Optionally expose a snapshot-level eligible count/captured subject, precise period resolution, typed usage summary and normalized phase/level progress if they materially simplify the UI. These are not prerequisites for truthful fallback labels.
- Validate cross-project/wrong-owner reads, cursor traversal, immutable old reports, publication rollback, historical pointer isolation and schema/client compatibility. Update architecture/contracts and tests in the same slice; do not change model orchestration to populate display metadata.

## Visual and functional quality gates

### Rendered review matrix

Capture only synthetic account/project/evidence states in an isolated environment; no real tokens, OTPs, account IDs or private task text. Retain screenshot artifacts only in the approved task artifact location and record observed results/limitations in the implementation response and latest ROADMAP verification. Screenshots are evidence of rendering, not a substitute for interaction checks.

| Area | States to inspect | Interaction / semantic gate |
| --- | --- | --- |
| Login/registration/OTP | Idle, invalid, submitting, wrong/expired code, resend success/rate-limited, local-mail hint | Keyboard, paste/autofill, accessible errors, restart, no pre-OTP access |
| Connections | None, one/all live slots occupied, offline/demo, verify failure, replacement, delete/cancel/busy | Correct provider fields/help, masked/cleared secret, focus restoration, unchanged identity/site restrictions |
| Projects | Multiple providers, duplicate names, long IDs/path, zero matches, undiscovered pages, one provider failing | Honest loaded search, independent Load more/retry, all resources reachable, table actions/overflow |
| Overview/progress | No snapshot, queued, listing/reading/analyzing/reducing, succeeded, partial, failed, automatic-review skipped/failed | No fake totals/percentages, source/model mode visible, import/review separate, explicit next action |
| Recovery | Temporary disconnect, bounded retry exhausted, terminal reconnect, reload, API restart, definitive auth rejection vs infrastructure failure | Work continues, GET/SSE restores state, no extra command/model call, saved result retained |
| Tasks/details/refresh | Multiple pages/selection, long title, mixed assignees, copied/stale data, each comment-read state, confirmation | Correct base/period/default, keyboard selection, exact timestamps, only selected external refresh |
| Self-review | Supported claims, zero tasks, zero subject tasks, valid empty claims, partial, generating with previous document, failed regeneration, historical snapshot | Exact citation, limitation visibility, report/snapshot relationship, safe link, both exports agree, no model call on read/export |
| Activity | Paginated snapshots/batches/traces, unknown/scripted usage, unavailable metadata | No completeness claim for a subset, no unsafe/raw internal log, IDs available on demand |
| Deletion after backend delivery | Cancel, confirm, conflict, failure, rediscovery | Correct local cascade, preserved remote resource/connection, no stale result revival |

For every major screen, capture 1440px, 768px and 390px with actual rendered viewport dimensions verified. Assess alignment, type/line length, spacing, surface/shape consistency, meaningful density, long content, error/empty/partial states, mobile keyboard, zoom/reflow and reduced motion. At 390px only labeled table/tab regions may scroll horizontally; no main-page overflow. Check all modal bodies/actions fit and scroll safely.

### Regression strategy

Preserve existing client tests for auth coordination, SSE version/delivery deduplication and catalog cursor loops. Add client unit tests at changed behavior boundaries: selection scope, period/base resolution, loaded search/completeness, citation mapping, feedback states and stale responses. If a rendered component harness is justified later, use it for interaction semantics rather than class-name snapshots; no new dependency is assumed by this plan.

Preserve HTTP/real-persistence tests for OTP/session/ownership, provider discovery and normalization, idempotency/activity slots, background recovery, selected refresh/provenance, exact evidence, report publication and history. Stub only external tracker/model/mail boundaries. A prepared report cannot replace worker execution. For executable changes follow AGENTS/S05 checks after documented isolated infrastructure/migrations: `npm run check`, `npm run test:unit`, `npm run test:integration`, `npm run build`. Any unavailable check remains explicitly unverified.

Browser automation and an automated screenshot-regression service remain outside the agreed MVP. Manual reference screenshots plus a state/viewport checklist provide visual regression review within current scope. A future automated browser/visual suite would need an explicit scope decision. Manual real-provider/model acceptance must be labeled separately from synthetic/offline/demo tests and must use authorized test accounts.

### Completion bar

Each phase must state what changed, which owning specifications were reconciled, what checks actually ran, observed manual interactions and remaining gaps. Do not mark a redesign complete because components render or build. Each screen needs a clear purpose/state/action, appropriate density, common visual language, usable supported viewports and preserved product semantics. Backend-dependent items remain open until implemented and verified; omission with an explicit dependency is honest interim delivery, not completion of the requested feature.

## Recommended starting slice

Start with **Phase 1**, limited to the semantic theme/type/spacing roles and primitives needed by the workspace. Follow with the width-aware shell and **Phase 3 Project Overview pilot**. Prove a synthetic full sync → saved tasks → explicit/automatic review → evidence/export journey, including partial/reconnect/historical states, before carrying its visual standard to the remaining screens. Keep local project deletion and richer metadata/history in their separate tracks.
