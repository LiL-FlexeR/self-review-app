# Self Review App target UI guidelines

Target specification, 2026-11-13. The shared foundations and application shell are reconciled in [DESIGN.md](DESIGN.md); later screen compositions remain targets until their owning implementation phase. Read the [audit](UI_AUDIT.md) for evidence and the [plan](REDESIGN_PLAN.md) for delivery order and specification updates. The [design-input precedence](../stages/README.md#frontend-design-inputs) remains authoritative. Apply only the user-authorized phase; these guidelines do not independently authorize later screen or backend work.

## Design philosophy

Make the saved work and its evidence the center of the interface. Use warm surfaces, quiet dividers and purposeful whitespace; put dense records in tables and reports in a document column. A surface earns a border when it groups an independent decision, not merely because it contains a heading.

Every view should establish its project/account context, the saved state being inspected, any material limitation, and the next action. Prefer one dominant action per working region. Keep report limitations visible while moving diagnostic detail behind a named disclosure. Minimal appearance must not obscure incomplete evidence or historical context.

## Reference analysis

Research was read from public pages on 2026-11-13. No authenticated reference-product session or Refero MCP inspection was available. These are the only verified reference claims used here:

| Reference | Verified published pattern | Application-specific interpretation |
| --- | --- | --- |
| [Refero Perplexity style](https://styles.refero.design/style/81afaa5c-73ac-4ef4-9a99-296da325ea6c) | Warm off-white surfaces, ink text, restrained teal selection, modest type weights, subtle separation | Retain the supplied palette. Adapt the search-oriented composition into table and report widths; omit hero search and decorative glow |
| [Linear projects](https://linear.app/docs/projects) and [display options](https://linear.app/docs/display-options) | Project context separates overview and issue work; supported views choose which properties to display | Use project-local sections and compact rows. Do not add boards, custom views, milestones or Linear's remote-delete behavior |
| [Notion page styling](https://www.notion.com/help/customize-and-style-your-content) | Page typography/layout and page width can be adjusted separately | Treat the self-review as a readable document while tables use available workspace width; no editor or Notion block system |
| [shadcn data-table guide](https://ui.shadcn.com/docs/components/data-table) | Table source can be composed with TanStack Table for application-specific behavior | Start with semantic Table; add a headless row model only if actual sorting/selection complexity needs it. Retain Radix and this repository's pinned generator |
| [Radix AlertDialog](https://www.radix-ui.com/primitives/docs/components/alert-dialog) | Dedicated confirmation structure with cancel/action and focus behavior | Use for irreversible local deletion; test composed focus/async behavior rather than implementing a custom modal |

The designs below are proposals for Self Review App. Exact sizes, table columns, citation presentation and status rules are not presented as measurements of Linear, Notion or Perplexity.

## Semantic color system

Retain the existing light palette and map it to explicit roles in Phase 1. Values are chosen from the supplied local tokens. No additional brand hue or dark theme is proposed.

| Semantic role | Value / mapping | Use |
| --- | --- | --- |
| background | Parchment `#faf8f5` | Page and document canvas |
| surface | Soft Paper `#fdfbfa` | Dialogs, detail panels, occasional grouped surface |
| elevated surface / popover | Soft Paper | Overlay plus border establishes separation; no extra elevation color |
| foreground | Ink `#27251e` | Body, headings, identifiers and icons |
| secondary / muted foreground | Graphite `#72706b` | Supporting text, labels and metadata at readable size |
| decorative muted | Ash `#92918b` | Decorative lines/disabled decoration only; no essential text |
| border / divider | Warm Mist `#d1d1cd` | Nonessential separators and surface outlines |
| control boundary | Graphite | Default field/checkbox boundary when needed to identify the control against canvas |
| primary / primary foreground | Ink / Parchment | Explicit primary action |
| accent / accent foreground | Deep Teal `#016a71` / white | Active navigation and selected controls |
| hover | Soft Paper on canvas; Parchment on surface | Quiet row/control hover; never communicate state through hover alone |
| selection | Teal indicator/check plus warm neutral row fill | Table selection, active tab indicator; text stays readable |
| focus ring | Deep Teal | 2px visible outline, 3px offset; use one consistent treatment |
| success | Ink text + check icon on canvas | “Tasks saved”; do not recolor every task marked done |
| warning | Ink text + warning icon, Soft Paper, leading Ink rule | Partial/stale/limited evidence; explicitly state what is incomplete |
| error | Ink text + error icon, strong boundary and actionable message | Failed request/validation; use assertive announcement for blocking submissions |
| destructive | Ink fill + Parchment text, trash icon and explicit destructive verb | Only confirmation's committing action; text and placement distinguish it from ordinary actions |

Success/warning/error/destructive are distinct semantic roles even where values coincide. Their words, icons, structure and action semantics carry the distinction; color does not. Preserve the reference's restraint instead of adding red/amber/green as decoration. If later research demonstrates a need for chromatic status colors, revise the owning palette and contrast pairs explicitly before adopting them.

Calculated contrast: Graphite on Parchment ≈4.67:1, Ink on Parchment ≈14.46:1, white on Teal ≈6.36:1. Ash on Parchment ≈2.98:1 and Warm Mist on Parchment ≈1.44:1 are inadequate for normal essential text or a sole interactive boundary. Validate actual rendered states, including opacity, focus, selected/hover states and disabled controls; palette math alone is insufficient.

## Typography

Use the current declared system fallback stack when `pplxSans` is absent. Do not download or assume custom fonts. Normal letter spacing; regular 400 and medium 500. Avoid uppercase micro-labels and weight 600+ as hierarchy shortcuts.

| Role | Size / line height / weight | Application |
| --- | --- | --- |
| Page title | 28 / 36px / 500; 24 / 32px on narrow screens | Connections, Projects, project name |
| Report title | 28 / 36px / 500 | Self-review document title; no oversized hero |
| Section heading | 20 / 28px / 500 | Connected accounts, work-area headings |
| Component / dialog heading | 18 / 28px / 500 | Focused form/confirmation title |
| Body / report | 16 / 24px / 400; report paragraphs 16 / 28px | Readable source text, supported statements and limitations |
| UI / table | 14 / 20px / 400; labels/headers 500 | Controls, table cells, toolbars |
| Secondary / metadata | 14 / 20px / 400 | Dates, provenance, source availability; essential content is not microtext |
| Optional micro-label | 12 / 16px / 400–500 | Nonessential count decoration only |
| Identifier / raw detail | ui-monospace at 14 / 20px | Provider IDs, copyable internal IDs, safe JSON |

At mobile widths inputs remain 16px to preserve readability and avoid browser zoom. Report paragraphs target 60–80 characters per line within the width preset. Headings use semantic h1/h2/h3 independently of visual size. Dates are never truncated so aggressively that current versus historical context becomes ambiguous.

## Spacing, shapes and surfaces

Use a 4px base: 4, 8, 12, 16, 24, 32, 48px. The 24/48px values are deliberate extensions to the baseline reference scale. Keep Tailwind numeric spacing intact; preserve `--spacing-ref-*` names for reference tokens.

| Composition | Rule |
| --- | --- |
| Page inset | 32px desktop, 24px tablet, 16px mobile; top 32px desktop/24px mobile |
| Page header → toolbar/content | 24px; sections 32px; major document groups 32px |
| Field label → input | 8px; input → help/error 8px; fields 16px apart |
| Compact row | 12px vertical / 16px horizontal; minimum 48px high, grow for content |
| Table cell | 12px vertical / 12px horizontal; header 12px; no empty padding columns |
| Grouped surface | 16px inner spacing, 16px padding; use only where grouping is meaningful |
| Dialog | 24px padding, 16px content gaps, 24px before footer; 16px padding on mobile |
| Controls | 40px desktop form/control height; 44px mobile primary/touch target; dense icon glyph 16px within a generous hit area |
| Shape | Filled buttons/inputs 12px; quiet buttons/menus 6px; grouped surfaces/dialogs 16px; small text badges pill |

No radius around every row or report claim. Tables use one outer boundary if useful plus internal row dividers. Cards must not contain a second Card for routine content. Default elevation is none; occasional popover/dialog uses only the supplied subtle shadow `0 1px 2px rgba(0,0,0,.08)`. No gradients, decorative blur, illustration panels or metric-card grids.

## Layout and navigation

Use AppShell width presets chosen by the page. Max widths refer to content inside page padding; they are ceilings, never minimum viewport requirements.

| Content | Target maximum | Layout |
| --- | --- | --- |
| Authentication | 440px | One column, usable with mobile keyboard |
| Connections | 1040px | Header/actions, then divided account rows |
| Projects | 1200px | Toolbar/table; use all available width below the ceiling |
| Overview / Activity | 1280px | Main decision region and compact supporting facts; stack on tablet |
| Tasks | Available workspace width | Scroll table inside its labeled region |
| Self-review | 1280px outer workspace; 760px document | Center reading column; contextual evidence opens in Sheet |
| Sidebar | 240px expanded desktop | Exactly Connections and Projects; keep existing collapse mechanism |

Global sidebar: product identity at top, labeled navigation with icons/clear active fill, account label/email and sign out at bottom. Keep a compact source/model-mode indicator visible in the shell. Move the detailed access-token expiry explanation to account/session help without claiming immediate server revocation on logout. Mobile uses the existing Sidebar Sheet below 768px and closes after navigation.

The project header shows name, provider/resource type, connection and verified review subject, followed by a compact snapshot selector and explicit UTC period. Below: **Overview · Tasks · Self-review · Activity**. These are local tabs within `/projects/:id`. Default Overview; existing snapshot deep links still resolve. Initial tab changes do not add routes or query parameters. A later URL-backed tab would improve shared deep links and Back restoration, but requires the explicit trade-off/specification change recorded in the plan.

Keep job subscription, accepted-run state, command identity and selected-snapshot context above tab panels. Switching tabs must not stop recovery or start work. Keep a compact active-job strip visible across project tabs; full activity details belong in Activity. Announce completion and offer View tasks/View self-review without switching tabs or stealing focus.

## Component ownership and action hierarchy

Reuse AppShell/AppSidebar/AuthPanel/OtpForm and existing primitives. Add shared templates only when independently reused. Page-specific compositions stay under their page, following the [frontend file guide](../codestyle/frontend.md).

| Candidate | Responsibility / location |
| --- | --- |
| PageHeader | Shared title, description, action region; templates |
| ProviderBadge / StatusBadge | Provider labeling; explicit domain status + icon/text; templates when reused |
| EmptyState / ErrorState / LoadingState | Shared feedback composition, recovery and announcement semantics; templates |
| ProjectHeader / WorkspaceTabs / SnapshotSelector / SyncProgress | Project-local context, navigation and persisted status |
| ConnectionRow / ConnectionDialog / ConnectionManagement | Connections-local compositions of existing ProviderForm behavior |
| ProjectTable / FilterToolbar | Projects-local table and loaded-catalog controls |
| TaskTable / SelectionToolbar / TaskDetailView | Project-local saved-task inspection and refresh |
| ReviewDocument / EvidenceCitation / EvidencePanel | Project-local report and exact saved-source inspection |
| ConfirmationDialog | Small composition over AlertDialog when connection/project deletion actually share requirements |

Do not build a universal DataTable engine before two tables need the same behavior. Add the shadcn Table primitive; keep provider discovery and saved-task pagination independent of its rendering. TanStack Table is optional and currently absent; validate a compatible pinned version at implementation time if its row model is justified. Do not copy current web examples' framework, aliases, `latest` generator commands or API generation blindly.

Use Ink-filled **primary** for the next explicit mutation, quiet outline **secondary** for export/configuration, **ghost/link** for navigation/details, and explicit **destructive** treatment only at the confirmation commit. Connections' three equivalent provider choices share secondary styling; none is arbitrarily preferred. View self-review is the dominant navigation action when a report exists. Generating/regenerating remains a separate, clearly labeled paid-work action. Reconnect fetches saved state and must never resemble Retry generation.

## Connections and provider dialogs

Live page order: heading/description → Connect Linear, Connect ClickUp, Connect Jira Cloud → Connected accounts divided list. Occupied slots become “Manage Linear”, etc.; no duplicate-create action. Before availableProviders loads, show loading rather than enabled provider guesses. Offline/demo shows Add demo source and its actual data/model label; unavailable live providers may be explained in plain text but have no active connect controls.

Account row hierarchy: provider/name, stored status, verified owner, last verification date, Manage. Verification is a past check, not a permanent live-health guarantee. Long source ID and identity/site restrictions belong in management details. Preserve Jira link-availability warnings at the account and affected evidence view.

Connect Dialog fields: connection name + personal token for Linear/ClickUp; name + Atlassian email + cloud ID + scoped token for Jira. Explain cloud ID, preserve official help links and validations, distinguish application email from tracker identity. No remote OAuth or scope picker is introduced.

Manage presents verified information plus Replace credentials and Delete local connection. Replacement uses a Dialog; retains the saved name as read-only, because the existing PUT changes credentials rather than renaming the connection. It submits only a new secret and provider-required Jira inputs. Verify identity/site server-side as today; clear tokens on submit, cancel and unmount, including failures. Same-identity replacement during a job is currently allowed; do not impose a new blanket job lock.

Deletion uses AlertDialog. Copy: “Delete local connection? This permanently removes its local projects, snapshots, tasks, reports and credentials. It does not revoke the token or delete projects in your tracker.” Focus Cancel initially. Keep the dialog open for safe server errors, including an active-job conflict. A loaded active run can explain the restriction, but ConnectionView cannot prove that the entire connection is idle. Do not invent an activeJobs field or preflight endpoint.

## Projects table, search and continuation

Columns: **Provider · ID · Name · Workspace / Location · Actions**. Join provider/name from the connection; ID is ProjectView.externalId, name links to the existing local project ID, location uses breadcrumb and connection display name. A ClickUp name includes a subtle List label. Jira project key may appear in location beside the numeric ID; do not relabel a local UUID as the remote project ID.

Use readable text and ellipsis for a long ID only with keyboard/touch-accessible full-value disclosure/copy. Accessible actions say “Open [name]” and, after backend support, “Delete local data for [name]”. Prefer name link + arrow action; no whole-row click that captures checkboxes or links. Use established Lucide glyphs; provider labels remain visible if no verified brand asset exists.

Search label: **Search loaded projects**. Case-insensitive matching over name, external ID, breadcrumb and connection name; trimmed query. Provider filter: All, Linear, ClickUp, Jira Cloud; label fixture rows Synthetic demo source and include them under All. Search is local to loaded pages. Show “N matches in M loaded projects” and a per-connection completeness summary. Until every relevant cursor ends successfully, display “More projects may be available. Load remaining pages to broaden this search.” A zero match is not “No projects exist”.

Maintain one useInfiniteQuery per connection, cursor-loop protection, deduplication by local project ID (remote identity is connectionId + externalId), cached successful pages and independent error/retry/loading controls. A merged table does not mean a single global cursor. Footer rows identify which provider has more pages or failed. Filtering must not clear or restart those queries. No automatic load-all loop or client pagination that disguises undiscovered resources.

Open uses the existing local route; discovery already upserts the resource. Omit trash until [local deletion support](REDESIGN_PLAN.md#local-project-deletion-backend-track) exists. Permanent suppression from the remote catalog is a different feature.

## Project Overview and synchronization

Composition on desktop:

```text
Projects / Project name                 Provider · connection · mode
Review subject                         Snapshot selector · period · UTC
Overview    Tasks    Self-review    Activity
[active-job strip or material coverage warning, when relevant]

Next action + concise state             Saved evidence facts
Period sync configuration               Report availability / provenance
(expanded initially; secondary later)    Coverage and freshness explanation
```

Use flat sections/dividers and a narrow supporting facts column, not a dashboard of metric cards. Facts: saved task count, eligible count when available, discovery/import/analysis coverage, report availability, freshness explanation. Mixed timestamps are described as mixed; no made-up single “updated at”. A last-sync completion time requires the contract work in the plan.

| Persisted context | Main focus / action |
| --- | --- |
| No snapshot | Expanded period form; Synchronize project |
| Queued/running sync or review | Actual job state and “You can leave this page”; disable conflicting starts |
| Saved succeeded snapshot, no report | Create self-review; visible usage consequence |
| Partial snapshot, no report | Specific limitation + Inspect tasks; explicit acknowledgment before a manual review |
| Current report available | View self-review; regeneration is secondary |
| New snapshot with older report | “Based on a previous snapshot” when that report is actually resolved; never label it current |
| Failed operation with saved prior success | Retain prior snapshot/report, explain failed operation; new execution requires explicit action |

Period controls retain native date inputs, inclusive start/end and UTC labeling. Automatic-review checkbox starts unchecked for full sync and resets unchecked when selected refresh opens. Explain that sync includes model analysis even when automatic review is off. After the first saved snapshot, offer visible “Synchronize again” that expands configuration; do not hide it behind an unexplained icon. Editing dates does not start a job or relabel the saved snapshot's period.

## Processing state and status presentation

Execution state and connection state are independent. Retain the last persisted state while reconnecting; say “Updates interrupted; background work may still be running.” The actual saved state decides success/partial/failure. Do not infer job failure from a lost stream.

| Observed backend stage | User label / constraint |
| --- | --- |
| queued | Queued; no ETA |
| listing | Discovering tasks; counts are records saved so far, not a final remote total |
| reading | Reading task details |
| analyzing | Analyzing saved evidence |
| reducing | Combining validated findings |
| finished | Use succeeded/partial/failed result, not “finished” alone |
| Any unrecognized stage | “Processing”; exact safe stage in details; do not invent a milestone |

Saving occurs within operations and is not a separately observable JobView stage. Do not animate a fictitious Saving milestone. Completed discovery/import/analysis indicators derive from their actual completeness flags; current stage does not prove earlier success after a partial failure. Review child is a separate persisted run: “Tasks saved; preparing self-review”, with its own queued/running/result/usage.

Show saved/read counters with explicit labels and unknown totals omitted. Only show a batch fraction when numerator and denominator refer to the same phase/level and completed plan. Existing completed-batch and level-zero counters are incompatible; use separate counts or the paginated batches breakdown. Reduction nodes have their own context, not a guessed percentage. Warnings remain visible beside the affected result.

Connection statuses: checking state, receiving updates, reconnecting, recovery exhausted, inaccessible. Manual Reconnect appears when useful and stops for terminal/inaccessible runs. Preserve the existing bounded GET/auth/SSE recovery path and idempotency semantics; tab changes, reloads, reads and exports never submit a new model job.

## Tasks, selection and evidence availability

Task table columns: selection, identifier/title, source status, assignees, created date, freshness/evidence, source action. Show status as supplied by the provider rather than imposing an invented shared workflow. Assignee IDs remain IDs unless a trusted display name is available. Freshness and availability use separate text: “Copied · description available”, “Stale · refresh failed”, “Fresh · comments not read”. Fresh refers to retrieval provenance, not proof the external record is still current.

Selection belongs to internal TaskSnapshot IDs within one base snapshot; retain selection when paging and switching workspace tabs. Show “N selected” and Refresh selected (N) in a contextual toolbar. Clear explicitly or on snapshot/project/account change or accepted refresh. Do not add “Select all matching” semantics without an implementation that covers unseen pages. Selected refresh rereads only selected external tasks, creates a new snapshot containing the full base set, and reanalyzes the resulting set; review considers the entire qualifying subset, not just the selected tasks.

Refresh Dialog: count, readable base label, resolved inherited UTC period, explanation of copied timestamps/stale fallback, unchecked optional automatic review, model-usage consequence, Cancel, Refresh N tasks. No editable period or invented preview cost. If base context cannot be loaded, show a recovery error instead of confirming an ambiguous selection.

Task details remain a Sheet: 640px maximum desktop width, viewport width on mobile, independently scrollable body. Header: identifier/title and verified external source action. Content order: availability/freshness warning → description → comments read → findings → source metadata. Do not nest a second Sheet for finding citations; switch the same panel to an evidence view with Back to task. Escape and Close restore the opener or its stable table fallback.

| Saved state | Required copy / treatment |
| --- | --- |
| Comments not_read | “Comments were not read during this synchronization.” No empty-discussion claim |
| Successful read with no comments | “No comments returned by the saved read.” Only when stored state supports success |
| Successful read with comments | Show only saved comments and available source timestamps |
| Capped/truncated | “Some source content was omitted”; show actual saved excerpt and relevant limitation |
| Failed comment retrieval | “Comments unavailable because the read failed”; do not render an empty success |
| Detail pending/unavailable | Explain incomplete/unavailable description using detailStatus; do not substitute “No description” |
| Available empty description | “No description in the saved source.” Distinct from a failed read |
| Copied or stale task | Show original retrievedAt and provenance label; do not replace with the latest job's time |

## Self-review document and citations

Header: Self-review, project/resource, verified review subject, UTC period, selected source snapshot, generated-at time from ReviewView.createdAt, current/historical/partial context. An arbitrary snapshot ordinal or “version 3” is not available: use current/earlier report labels and generated time, with full IDs copyable in provenance. JobRun.version is stream state revision, never report version.

Toolbar: Download Markdown, Download JSON; separate Create/Regenerate action. Keep the existing valid document mounted while regeneration runs, show the new run's status above it, and only update after publication/refetch. Failure leaves the old document readable and exportable. Viewing a historical snapshot shows its own report; browsing older regenerations requires the separate history API track.

Render ReportDraft.groups as work-area sections; each claim gets its exact category: Task description, Reported result, Measurement from a source. Retain claim text as validated; never promote a reported result into a verified achievement through headings, icons or copy. Preserve explanation and limitations. No invented executive summary, impact score, performance rating, editor or PDF action.

Each claim has one or two numbered citation buttons with accessible labels such as “Evidence 2 for [claim context]”. Deduplicate display numbers by exact sourceId + quote within the report, not by source ID alone; two quotations from one source are distinct evidence pairs. Activating a citation opens the contextual evidence Sheet without replacing or scrolling the document. Show the exact quote, saved source excerpt/kind, available dates, truncation, source snapshot and verified external link when present. Keep raw source ID in details with Copy. Missing registry entry is an unavailable-evidence error, never a guessed link or fabricated quote.

At mobile width, the same evidence Sheet occupies the viewport; closing restores citation focus and document position. Do not open task details as a stacked modal from it; switch the panel context and offer Back. The source excerpt is saved text, not a live tracker preview. Null external URL retains internal evidence and a readable link-availability explanation.

Limitations appear as a visible named section; partial source coverage also gets a concise banner above the document. Do not collapse all limitations. Unknown timing, later source information, individual-contribution caveats and rollout qualifications remain attached to the relevant text where present; do not calculate unsupported metrics.

| Empty/failure context | Message / useful action |
| --- | --- |
| No snapshot | “Synchronize a period to collect evidence.” Go to Overview |
| Zero saved tasks | “No tasks were saved for this creation-date period.” Inspect period/source coverage |
| No qualifying subject tasks | “Saved tasks do not qualify for this verified tracker owner.” Inspect assignees/period; no arbitrary subject picker |
| No supported claims | Preserve valid empty report, explanation and limitations; inspect evidence; keep exports |
| No report yet | Create self-review, with explicit model usage and partial acknowledgment if required |
| Generation failed | Safe error/recovery; previous valid report stays visible, otherwise no successful empty draft is invented |

Model usage and safe execution details are secondary disclosures. Validate the unknown usage payload before formatting it. Show known input/output tokens, attempts and backend estimatedCostUsd separately; use “Unknown / may be incomplete” when unknown=true and “Scripted model” for offline. Known subtotals under unknown usage are not a complete bill. Do not recompute prices or imply zero cost from a null estimate. Sync and review usage belong to different runs; never silently double-count them. Raw safe JSON remains available if the client cannot recognize a payload.

## Activity, forms, dialogs and shared states

Activity contains complete paginated sync history, available recent runs, selected run's coverage/warnings, batches, safe trace and copyable IDs. Label ProjectDetail's 20-run preview as recent, not complete history. Use only timestamps actually exposed by the selected resource/trace. Full dated all-run/report history is a backend dependency. Request traces lazily, preserve pagination, use safe event fields and keep raw safe JSON in a secondary disclosure. Never show backend diagnostic logs, raw model output, prompts or hidden reasoning.

Dialog for connect/replace/refresh: 480px maximum, Jira 560px, width viewport minus 32px, maximum height viewport minus 32px with body scrolling. AlertDialog for permanent deletion: 480px. Sheet for substantial saved evidence/task reading and mobile navigation. Do not use full-height Sheets for two-button decisions.

Dialog order: title → purpose/consequence → fields/content → inline status/error → footer. Cancel precedes committing action in DOM and appears left of it on desktop; mobile footer stacks with both buttons visible and readable. Preserve entered nonsecret data on errors. Initial focus goes to first field for a form, Cancel for destruction. Keep validation errors associated with their inputs and move focus to the first invalid field. Success closes the form and announces the new saved state; focus returns to trigger, or the new account row if the trigger was replaced. Clicking outside does not confirm an action; AlertDialog requires an explicit choice. Escape cancels idle forms. If an accepted request is already pending, dismissal must not pretend to cancel server work: announce that state and reconcile completion outside the modal.

Use native text/date/select/checkbox semantics and existing validation before adding input libraries. Keep OTP as one input with paste/autofill; do not disable password managers or paste. Browser autofill must retain readable foreground/background and focus outline. No toast library is needed for this redesign: inline live feedback covers completion while durable errors/warnings remain with their content.

Loading uses reserved-height skeletons for initial structures and small inline feedback for subsequent pages. Busy actions retain their labels with a meaningful pending verb, disable duplicate submission and expose aria-busy. ErrorState distinguishes unavailable infrastructure, definitive authentication rejection, inaccessible resource and validation; it offers the correct read retry versus an explicitly new paid execution. EmptyState explains the missing resource and one relevant action. No generic “Something went wrong” screen that hides usable saved data.

## Responsive and accessibility acceptance

| Actual viewport | Required composition |
| --- | --- |
| 1440px | 240px sidebar, available content presets, aligned header/toolbars, 760px report line length, readable 640px detail Sheet |
| 768px | Existing md boundary remains desktop/collapsible; collapsing the rail must make tables/forms usable. Overview facts stack, toolbars wrap, no page overflow |
| 390px | Mobile nav Sheet, 16px page inset, tabs remain reachable in a labeled horizontal region if needed, stacked forms/toolbars, table scroll confined to its region, full-width detail Sheet, dialogs within viewport |

Table columns retain headers/semantics; prioritize name/identifier/actions visually but allow horizontal access to all essential columns. Do not silently remove location, assignees, freshness or evidence. Avoid sticky column layering until tested with focus and horizontal scrolling. Sticky action/status regions must not obscure content or controls under the mobile keyboard.

Keyboard: skip link, sidebar, tabs using Radix keyboard behavior, table links/checkboxes, tooltips on focus, dialogs, source panel, cancellation and focus restoration. No hover-only critical controls. Table scroll regions are labeled and keyboard focusable. Icon buttons have context-specific names; decorative icons are hidden from assistive technology. Use native table headers and captions; do not turn the page into a custom ARIA grid.

Target WCAG 2.2 AA: normal text at least 4.5:1, large text 3:1, meaningful control/focus boundaries 3:1, visible focus, no color-only meanings, adequate target spacing and zoom/reflow. At 200% zoom, actions and content remain accessible. Announce stage/terminal/error changes rather than every counter tick; OTP resend countdown is not a continuously announced live region. Respect reduced motion; progress has no decorative looping shimmer or fake timed advancement. These are acceptance targets, not an existing conformance claim.

## Anti-patterns to reject in review

Reject nested cards for ordinary sections, giant empty status panels, dashboards of invented metrics, copied Perplexity hero layouts, raw selection JSON as primary copy, UUID-led history, uniform button prominence, whole-page table overflow, full-height confirmation Sheets, fake global search, nonfunctional trash icons, guessed provider links, collapsed-away partial warnings, invented run times/percentages and autogenerated claims to fill empty reports. The quality gate is the readable, functioning workflow in actual rendered states; a successful build is only one check.
