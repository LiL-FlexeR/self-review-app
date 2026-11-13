# Self Review App UI audit

Planning baseline: 2026-11-13. This audit supports the [target UI guidelines](UI_GUIDELINES.md) and [implementation plan](REDESIGN_PLAN.md). It does not authorize implementation or replace the existing product, UX, architecture, or visual specifications.

## Executive summary

The frontend already has a useful foundation: a coherent warm palette, a small shadcn/ui primitive set, account-scoped TanStack Query data, accessible mobile navigation primitives, immutable saved evidence, and separate sync/review operations. A new framework or application rewrite is unnecessary.

The largest problems are composition and information hierarchy. Connections exposes configuration forms as page content; Projects wraps resources inside connection cards; the project route places synchronization, progress, history, tasks, traces, and reports in one vertical sequence. Reports inherit the visual language of operational panels. Technical identifiers and serialized values occupy space that should explain the user's next action.

The five highest-impact findings are:

1. **The project workspace has no task-oriented navigation.** Its long sequence of equally weighted panels separates the user from tasks and reports.
2. **Operational data needs semantic translation.** Booleans, raw selection JSON, identifiers, and batch counts require interpretation; some counters cannot safely be used as completion ratios.
3. **Setup and discovery use inefficient containers.** Always-visible provider forms and nested project cards make routine management and comparison cumbersome.
4. **Reports and evidence lack a dedicated reading experience.** Provenance is present, but raw IDs, repeated bordered quotations, and embedded traces compete with supported statements and limitations.
5. **The layout and primitive treatments do not distinguish content roles.** One approximately 900px inner width serves tables and prose; a generic bordered status box handles unrelated states; short confirmations use full-height Sheets.

No fresh rendered-app observations are claimed. These findings are grounded in source and contract inspection. Existing browser acceptance in [ROADMAP](../../ROADMAP.md#current-verification) is prior evidence, not a redesign validation.

## Evidence and inspection limits

| Evidence | Inspected material | What it establishes |
| --- | --- | --- |
| Product and workflow | [README](../../README.md), [AGENTS](../../AGENTS.md), [product](../product/overview.md), [architecture](../architecture/overview.md), [sync workflow](../architecture/sync-workflow.md), agent workflow, D02/D04/D05, S05/S06 | Intended behavior, security boundaries, state meanings, existing acceptance requirements |
| Design baseline | [UX](UX.md), [DESIGN](DESIGN.md), [tokens](tokens.json), [variables](variables.css), [theme](theme.css), [frontend guide](../codestyle/frontend.md) | Established appearance, interaction requirements, token precedence and file conventions |
| Implementation | Route tree, shell, auth/OTP, connection/catalog/project components, global styles, HTTP/SSE client, public contracts, project/job/connection services, Prisma relations | Actual composition, exposed fields, API availability and implementation gaps |
| Browser attempt | In-app browser opened `http://localhost:3000`; returned `ERR_CONNECTION_REFUSED` | This preview endpoint was unavailable to that browser. No login, OTP, authenticated screen, active job, modal, or responsive screenshot was inspected |
| Reference research | Public Refero, Linear, Notion and component documentation; see [reference analysis](UI_GUIDELINES.md#reference-analysis) | Published patterns and documented component capabilities; not hands-on inspection of those products |

No Refero MCP tool was available. No app startup, dependency installation, model request, tracker request, credential change, or database mutation was performed. No screenshot assets were captured. Layout/contrast effects inferred from code remain hypotheses to confirm at 1440px, 768px, and 390px.

## Current implementation inventory

### Routes, layout and dependencies

The [route tree](../../frontend/src/App/components/SessionRoutes/index.tsx) implements `/login`, `/register`, `/otp`, `/connections`, `/projects`, `/projects/:id`, `/`, and a not-found route. The project route already uses `?snapshot=<runId>` for saved snapshot selection. There are no Overview/Tasks/Self-review/Activity subroutes.

| Area | Actual implementation | Redesign consequence |
| --- | --- | --- |
| React application | React/React DOM 19.3.1; Vite 8.3.8; React Router 7.18.5, Declarative BrowserRouter | Keep the current routing and rendering architecture |
| Server state | TanStack React Query 5.107.1; fetch; native EventSource | Table composition must preserve independent queries, cancellation, ownership and recovery |
| Styling | Tailwind 4.3.5; CSS variables; CVA; clsx/tailwind-merge; Lucide 1.72.0 | Reuse semantic utilities and icons; no new styling framework |
| shadcn/ui | Committed source; new-york, neutral, CSS variables, `@app` aliases; `radix-ui` 1.8.1 | Add only needed Radix-based primitives through the pinned generator in the frontend guide |
| Existing primitives | Alert, Button, Card, Input, Label, Separator, Sheet, Sidebar, Skeleton, Status, Tooltip | Preserve and adapt rather than replace them wholesale |
| Missing local primitives | Dialog, AlertDialog, Tabs, Table and a dedicated checkbox wrapper are absent | These are future source additions, not existing capabilities |
| Table library | `@tanstack/react-table` is absent from the frontend manifest | TanStack Query is not TanStack Table; no installation is needed to write this plan |
| Fonts | `pplxSans` is declared; no bundled font assets found | Use the established system fallback; do not assume a licensed font is available |

Version values above come from the committed [frontend manifest](../../frontend/package.json), not a claim about latest upstream releases.

[AppShell](../../frontend/src/components/templates/AppShell/index.tsx) uses `max-w-[964px]` with 32px desktop horizontal padding: approximately 900px remains for content. [AppSidebar](../../frontend/src/components/templates/AppShell/components/AppSidebar/index.tsx) already has exactly Connections/Projects, account information, and sign out. Sidebar uses 260px desktop width and Sheet-based navigation below 768px. The repeated session-expiry explanation at the bottom of every protected page gives implementation detail permanent prominence.

### Existing automated coverage

Frontend tests cover [auth coordination](../../frontend/src/auth/coordinator.test.ts), [job subscriptions](../../frontend/src/lib/job-subscription.test.ts), and [catalog continuation](../../frontend/src/pages/projects/components/Catalog/pagination.test.ts). They protect meaningful recovery and pagination behavior but do not establish rendered table, dialog, typography, or responsive quality. HTTP/storage coverage lives in `backend/test/` for auth, workflow, reliability, Linear, and task sources. No browser automation or screenshot-regression suite is committed; browser e2e is outside the agreed scope.

## Screen-by-screen findings

P0 = critical usability/workflow interpretation problem; P1 = significant UX/design problem; P2 = visual refinement; P3 = optional improvement. A P0 design risk below is not a claim of a newly reproduced backend defect.

| Screen / priority | Existing layout and problem | UX and visual impact | Recommended target |
| --- | --- | --- | --- |
| Login/registration — P2 | [LoginForm](../../frontend/src/pages/auth/components/LoginForm/index.tsx) inside a 440px AuthPanel; correct labels/autocomplete and one submit action. Several equally styled helper paragraphs; link emphasis varies | Simple flow is sound; supporting copy competes with heading/action. Autofill appearance is unverified | Retain focused form and identity, tighten supporting copy, standardize field/error spacing and native autofill treatment |
| OTP — P1 | One six-digit text input supports numeric keyboard, paste and one-time-code autofill. Destination, expiry, Mailpit, resend, restart appear sequentially. Successful resend uses the same `error`/Status path as failures | Feedback tone and hierarchy are ambiguous; replacement with segmented inputs could damage a working interaction | Group destination/expiry, retain one input, give success/error distinct semantics, retain all challenge/security behavior |
| Global shell — P1 | Narrow shared wrapper; expanded account email and outlined logout; mode label above title; technical logout copy below content | Tables become constrained while report prose can be too wide; operational details frame every page | Width presets, compact account footer, persistent readable source/model-mode label, contextual session explanation |
| Connections — P1 | [ConnectionsPage](../../frontend/src/pages/connections/index.tsx) renders saved cards then a full Card/Form for each unused provider | Setup feels like a configuration document; users scroll past help and fields to manage accounts | Three provider actions in live mode; focused connection dialogs; compact Connected accounts list; mode-aware demo action |
| Connection management — P1 | [ConnectionCard](../../frontend/src/pages/connections/components/ConnectionCard/index.tsx) puts owner ID, restrictions, verification and actions together. Credential replacement expands inline; deletion opens Sheet | Large repeated surfaces and long identifiers obscure verified owner and status; a short destructive decision occupies a tall panel | Manage dialog, replacement Dialog, deletion AlertDialog. Keep restrictions and irreversible local consequences next to their actions |
| Projects — P1 | [Catalog](../../frontend/src/pages/projects/components/Catalog/index.tsx) Card contains bordered resource rows; no search/provider filter or ID column | Repeated names and locations are harder to compare; large catalogs require scanning | One merged semantic table, loaded-resource search and provider filter; independent per-connection continuation/error controls |
| Project Overview — P1 | [ProjectPage](../../frontend/src/pages/project/index.tsx) begins with token-owner text and a permanent sync Card followed by progress/history/tasks | Returning users must navigate setup and operational material to reach the saved result | Persistent project/snapshot context; Overview, Tasks, Self-review, Activity tabs; state-driven next action |
| Sync progress — P0 interpretation risk | Raw type/state/stage string, saved/batch counters, run UUID and generic Reconnect action. Discovery counters reflect persisted records; completed batches include reduction nodes | Users can mistake saved counts for a final remote total or see an impossible batch ratio. Connectivity and execution messages compete | Separate transport status from execution, map observed stages, show only justified counts; never divide incompatible batch counters |
| Snapshot history — P1 | Full-width buttons labeled terminal state + eight-character run prefix, above the tasks | Identifiers carry most of the meaning; history displaces primary work | Compact shared selector, period/status/count labels, full history in Activity; keep partial/failed and latest-successful distinct |
| Tasks — P1 | Plain HTML table, 620px minimum; combined status/assignees and date/freshness cells; raw timestamps; pagination and refresh/review buttons together | Hard to distinguish source workflow status from data availability; review controls interrupt task inspection | Dedicated table, stable snapshot selection across pages, contextual refresh toolbar, review generation in Self-review |
| Selected refresh — P1 | Short confirmation uses Sheet; base UUID shown; automatic review resets false on opening | Space and context are poorly balanced; the inherited period is absent from confirmation | Focused Dialog with selected count, base label, resolved UTC period, copy/stale behavior and paid-analysis explanation |
| Task details — P1 | [TaskDetails](../../frontend/src/pages/project/components/TaskDetails/index.tsx) uses Sheet with flat description, raw status string, quotations and findings; empty description uses a generic fallback | Distinct unavailable/unread/empty evidence can be visually conflated; source relationships in findings are not navigable | Retain Sheet for substantial reading, structure content into source/description/comments/findings, explain availability and open exact evidence |
| Self-review — P1 | [ReportView](../../frontend/src/pages/project/components/ReportView/index.tsx) Card with raw subject/snapshot IDs, serialized selection, group paragraphs, repeated bordered quotation disclosures, limitations, TraceView and usage JSON | Primary value resembles technical output; repeated source chrome fragments reading; exports are far below the header | Document canvas, human-readable provenance, inline numbered citations opening evidence Sheet, persistent limitations and separate export/generation actions |
| Activity — P1 | No dedicated section; [TraceView](../../frontend/src/pages/project/components/TraceView/index.tsx) is a bordered disclosure containing JSON and paginated units, fetched even when closed | Secondary data dominates page length and is hard to interpret | Dedicated snapshot/run area with a readable safe-event list and optional raw safe JSON; lazy reads on disclosure |
| Shared loading/error/empty — P1 | Most feedback uses [Status](../../frontend/src/components/ui/Status/index.tsx), a bordered Alert with polite live role | Loading, success, warning and failure look alike; repeated boxes add noise; recovery controls lack consistent placement | Shared inline loading, actionable error, empty-state and warning compositions; preserve safe request/run details on demand |
| Narrow layouts — P1 validation gap | Mobile Sheet and local task-table overflow exist in source; other panels rely on wrapping; long IDs use inconsistent break rules | Source alone cannot establish usable dialog height, focus, touch targets, or real viewport width | Content-specific responsive rules and actual viewport verification; no page-wide horizontal scrolling |

## Design-system audit

| Finding | Evidence and implication | Target decision |
| --- | --- | --- |
| Baseline colors agree | tokens/reference CSS/global palette share warm neutrals, ink and teal | Retain palette; improve roles before adding color |
| No semantic status system | `--destructive` aliases ink; Status has no tone distinction | Define success/warning/error/destructive roles with explicit words/icons and hierarchy; retain restrained monochrome status treatment |
| Border is decorative | Warm Mist on Parchment has approximately 1.44:1 contrast | Keep separators subtle; use a stronger border where it is the sole control boundary |
| Essential muted text needs discipline | Graphite/Parchment is approximately 4.67:1; Ash/Parchment approximately 2.98:1 | Graphite is the minimum normal essential text tone; Ash cannot carry essential helper/status text |
| Incomplete heading/reading roles | Base 16px, common text-sm, ad hoc 28px titles, repeated text-xs metadata; fallback font | Add page/section/report/metadata roles; IDs are secondary but readable |
| Reference radius ambiguity | Named button radius is 6px; filled-button prose says 12px; generated sizes can override shape | Specify filled/input 12px, quiet buttons 6px, meaningful surfaces 16px; reconcile reference representations in Phase 1 |
| Padding varies by construction | Reference card padding 16px; Card uses 24px horizontal/vertical padding and 24px gaps | Define deliberate 16px surface and 24px dialog padding; avoid changing all Card consumers blindly |
| Repeated inline composition | `space-y-4/6`, wrap-anywhere, metadata paragraphs, outlined actions recur across screens | Extract only repeated PageHeader, status, provider, selection and empty/error compositions |
| Existing variants need usage rules | Button ships six variants and eight sizes, including 24px controls and dark classes in a light app | No evidence warrants deleting variants wholesale; define approved usages, minimum targets, shape precedence and light-theme QA |
| Visual reference assumes a search page | DESIGN caps main content at 900px and references a search-led layout | Document explicit per-content width adaptation; do not copy the reference's hero/search composition |

Contrast figures were calculated from the hex colors using sRGB relative luminance; they are not a rendered accessibility audit.

## Implementation constraints and missing support

### Public data limitations

The [public schemas](../../contracts/src/workflow.ts) are the browser boundary. A database column is not automatically a UI field: Zod response parsing strips unexposed data.

| Desired presentation | Available today | Consequence / separate dependency |
| --- | --- | --- |
| Project/resource ID and location | ProjectView.externalId, resourceType, breadcrumb; parent connection joins provider/name | UI-only. Linear ID may be opaque; Jira externalId is numeric and key appears in breadcrumb. Do not replace it with an invented common ID |
| Last sync time, dated snapshot/run timeline | JobView has no createdAt/startedAt/finishedAt | Use period, state and short disambiguating ID; expose timestamps through an intentional contract change before showing completion dates/durations |
| Review-eligible task count before review | Sync counts.targetTasks counts all saved tasks; review counts.targetTasks and ReviewView.coverage.targetTasks count the owner subset | Show “Available after review starts” when unavailable; never substitute imported count. A cheap pre-review count is an optional backend enhancement |
| Period for a selected refresh | selection is unknown publicly; tasks selection points to baseSyncRunId | Validate the known selection forms and resolve the owned base chain with existing job GETs, cycle/missing handling and cancellation. No new period field is assumed |
| Subject and assignees | Connection has verified owner name/ID; report has saved subjectSourceUserId; TaskView.assignees contains IDs, not a display-name directory | Join only matching known owner identity; preserve other IDs. Rich assignee names/avatar lookup is separate API work |
| Comment/source dates and errors | TaskDetail comments expose id/body/retrievedAt; Source has source dates, truncation and kind. TaskView has read state/truncation | Render available source metadata by registry relation. Author, precise comment-read time, copied-from link and safe retrieval reason are not all exposed as typed task fields |
| Report history | Snapshot history is paginated; each snapshot has a current-report pointer; GET review reads a known report ID. ProjectDetail.runs is capped at 20 | Current report per historical snapshot is reachable. Complete history of every regeneration, report IDs for old review runs and an all-runs timeline need an owned paginated API; do not simulate them from 20 runs |
| Connection-wide busy state | ConnectionView has no active-job boolean; server rejects deletion under lock | Show known activity/conflict reasons; do not infer all projects are idle from one loaded project. Replacement currently permits the same identity during jobs; deletion is the blocked operation |
| Accurate batch fractions | counts.batches counts level-zero units; batchesCompleted includes all levels; totalBatches is based on current target size | Use the paginated batches endpoint for phase/level breakdown, or separate counts without a fraction. A normalized progress summary is separate API work |

### Local project deletion investigation

**Local project deletion is not supported.** The [controller](../../backend/src/modules/projects/projects.controller.ts) has DELETE for connections only. There is no project deletion command, contract, or frontend action.

[ProjectsService.catalog](../../backend/src/modules/projects/projects.service.ts) upserts each live discovered resource into SourceProject before returning the page. Opening the row navigates using that persisted local ID; it is not a remote create or a separate “import project” mutation. Offline/demo adding the fixture also creates its local project records.

The [Prisma schema](../../backend/prisma/schema.prisma) connects SourceProject → JobRun → TaskSnapshot/CommentSnapshot, AnalysisBatch, SyncAnalysis, ModelAttempt and ReviewReport. Review-source/base-run/copy relations and current-report pointers also cross those records. Deletion cannot be planned as removing just the visible catalog row.

Recommended semantics and the required backend track are specified once in [the deletion plan](REDESIGN_PLAN.md#local-project-deletion-backend-track): remove this project's locally saved history, retain the connection/token and all remote data, allow later rediscovery to recreate a fresh local record. Hiding a remote catalog entry permanently would require separate exclusion/tombstone semantics. Until backend support passes acceptance, omit the trash action; do not ship a disabled placeholder implying a working feature.

## Priorities and handoff

Resolve P0 interpretation risks while creating the Phase 3 project pilot: imported versus review-eligible counts, compatible progress counters, partial coverage, historical versus current report context, and transport versus job state. These decisions protect trust even before visual refinement.

P1 work should proceed through shell/workspace navigation, tasks, report reading, compact connection management and the project table. P2 auth/typography refinements follow the shared foundations. P3 work includes server-wide catalog search, richer dated history, assignee directories, optional table sorting and version comparison; none should be added to fill empty space.

The [implementation plan](REDESIGN_PLAN.md) records specification differences, dependencies and phase acceptance. No current UX/DESIGN/API/schema was rewritten by this audit.
