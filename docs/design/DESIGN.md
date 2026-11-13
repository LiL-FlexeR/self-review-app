# Visual system and reference

Self Review App uses a warm, restrained light theme adapted from the supplied [Perplexity style reference](https://styles.refero.design/style/81afaa5c-73ac-4ef4-9a99-296da325ea6c). The reference informs color, modest type weights and flat surfaces; its search-centered page layout is not an application template.

This document owns visual intent and application adaptations. [UX.md](UX.md) owns interactions, [UI_GUIDELINES.md](UI_GUIDELINES.md) specifies the target application compositions, and [frontend design inputs](../stages/README.md#frontend-design-inputs) defines precedence. Valid [tokens.json](tokens.json) values are the shared numerical/color baseline; [variables.css](variables.css) and [theme.css](theme.css) represent them in CSS. Implemented semantic mappings live in `frontend/src/styles/globals.css`. Actual delivery and verification are recorded only in [ROADMAP](../../ROADMAP.md).

## Color and semantic roles

| Reference color | Value | Application role |
| --- | --- | --- |
| Parchment | `#faf8f5` | Page canvas and document background |
| Soft Paper | `#fdfbfa` | Grouped surfaces and elevated content |
| Warm Mist | `#d1d1cd` | Decorative separators; not the sole boundary of an input |
| Ash | `#92918b` | Nonessential decoration only |
| Graphite | `#72706b` | Secondary/metadata text and identifiable control boundaries |
| Ink | `#27251e` | Primary text, filled actions and explicit feedback |
| Pure Black | `#000000` | Reserved high-contrast reference accent; use sparingly |
| Deep Teal | `#016a71` | Active navigation/selection and visible keyboard focus |

Do not introduce another brand hue, white page surfaces, gradients or decorative glow. White is allowed for text on the teal active fill. Teal is not a body-text accent. Use ink primary actions and quiet neutral secondary/hover surfaces.

The `semantic` group in tokens.json names background/foreground, surface/elevated surface, primary/secondary, muted, accent, hover, selection, border/input/control-border, ring, success, warning, error, destructive and sidebar roles. Semantic aliases reference the palette rather than creating independent colors. Input/control boundaries use Graphite; noninteractive borders remain Warm Mist. Semantic status roles may share colors: words, icons, structure and accessible announcements distinguish meaning.

Success uses a check and readable text on the canvas. Warnings use a warning icon, Soft Paper and a leading ink rule. Errors use an error icon, a strong boundary and actionable text. Destructive confirmation uses the ink filled action with an explicit deletion verb/consequence; no extra accent is required. Do not describe an uncertain/partial result as successful because its colors are quiet.

Calculated contrast: Graphite/Parchment 4.67:1, Graphite/Soft Paper 4.79:1, Ink/Parchment 14.46:1 and white/Teal 6.36:1. Ash/Parchment 2.98:1 and Warm Mist/Parchment 1.44:1 must not carry essential text or a sole control boundary. Inspect rendered opacity/hover/focus states as well as these base pairs.

## Typography

The original reference uses proprietary pplxSans with weights 400/500. No custom font assets are bundled. Use the declared system fallback stack; do not assume a licensed font or silently download one. Use normal letter spacing and the following application roles, backed by tokens.json:

| Role / utility | Size / line height | Weight |
| --- | --- | --- |
| Page / `text-page` | 28 / 36px | 500 |
| Narrow page / `text-page-small` | 24 / 32px | 500 |
| Section / `text-section` | 20 / 28px | 500 |
| Component / `text-component` | 18 / 28px | 500 |
| Body | 16 / 24px | 400 |
| Report / `text-report` | 16 / 28px | 400 |
| UI / `text-ui` | 14 / 20px | 400; labels may use 500 |
| Metadata / `text-metadata` | 14 / 20px | 400 |
| Identifier / `font-mono text-identifier` | 14 / 20px | 400 |

The reference aliases caption 11px/1.5, body-sm 12px/1.33, body 14px/1.43 and body-lg 16px/1.5 remain available for compatibility. The 11–12px roles are nonessential decoration, not the default for dates, help, evidence or errors. Mobile inputs stay 16px. Use semantic headings independently of font size; avoid 600+ weights and oversized hero headings.

## Spacing and shapes

Use a 4px base with 4, 8, 12, 16, 24, 32 and 48px steps. The 24/48px steps deliberately extend the reference. Pixel reference utilities use `--spacing-ref-*`, such as `p-ref-16`, and must not replace Tailwind's numeric spacing unit.

| Shape | Radius / utility |
| --- | --- |
| Filled actions | 12px / `rounded-button-filled` |
| Quiet actions | 6px / `rounded-button-quiet` |
| Inputs | 12px / `rounded-inputs` |
| Meaningful grouped surfaces | 16px / `rounded-cards` |
| Dialog / menu | 16px / 6px |
| Chips/badges | Pill / `rounded-chips` |

Button size controls dimensions only; it must not override the variant's radius. Standard form controls are 40px desktop and 44px mobile. Compact desktop controls may use 32–36px targets where appropriate, with larger mobile targets. Icon glyphs remain 16px inside a usable hit area. Loading/disabled/invalid states must retain readable content and clear semantics.

Use 16px padding for new compact grouped surfaces and 24px for dialog content (16px mobile). Existing Card defaults retain their 24px spacing until their owning screen phase changes the composition; auth's explicit spacing remains valid. Do not globally compress every Card to make tables denser. Cards are optional grouping, not a wrapper for every section. Use lists, dividers and tables rather than nested cards.

## Surfaces and elevation

Default elevation is flat. Soft Paper, quiet separators and spacing establish grouping. The optional subtle shadow is `rgba(0,0,0,0.08) 0 1px 2px`; no larger shadow stack, blur or gradients. The page and report canvas remain Parchment. Use monochrome glyphs sparingly, always with text/accessible names for meaningful actions.

## Focus, input and feedback treatment

Use one visible keyboard focus treatment: a 2px teal outline with 3px offset. Shared controls must not suppress it with generated outline/ring defaults. Invalid inputs use an explicit associated message plus a distinct boundary; styling alone is not validation. Preserve browser autofill, paste and password managers, with readable foreground/background and caret. Native checkbox/radio selection uses the accent without changing their keyboard behavior.

Shared Status offers information/loading/success/warning/error presentations. Ordinary updates are polite; blocking error feedback is assertive. Icons are decorative to assistive technology and a text label communicates the tone. Do not infer tone by parsing server message strings. Loading is static rather than decorative looping animation; reduced-motion preferences apply to transitions/overlays. Existing error and pending conditions are retained by callers.

## Layout adaptation and delivery boundaries

The reference's 900px content column and approximately 260px sidebar describe a search page, not a universal application constraint. The application uses a 240px expanded sidebar and the content-width tokens in tokens.json: authentication 440px, Connections 1040px, Projects 1200px, workspace 1280px, reading 760px. A full-width preset uses available space. Padding is outside these content ceilings: 16px mobile, 24px tablet and 32px desktop; vertical inset is 24px mobile/32px from tablet upward. These are ceilings, not fixed viewport requirements.

AppShell owns the common padding, content preset and mode/navigation strip; PageHeader owns title/description/action alignment. AppSidebar uses compact 44px navigation rows, clear teal active fill, a divided account footer and a session-help disclosure. Desktop offcanvas collapse and the below-768px mobile Sheet retain their existing mechanism. The shell has no sticky overlay that could obscure focused content. Saved reports keep the reading ceiling inside the Self-review tab; their document interior is retained until Phase 5. Authentication retains its separate focused composition.

The project pilot uses persistent source/subject/snapshot/UTC context, quiet underline tabs, a separate execution/connectivity strip, flat Overview sections and a narrow saved-evidence facts column that stacks below the main region on tablet/mobile. Period configuration is expanded without a snapshot and secondary afterwards. Use readable labels with IDs in disclosures; retain native date/checkbox behavior and the common focus treatment. The Tasks tab uses divided rows, separate status/assignee/date/evidence columns, quiet source actions, teal checkbox/row selection and a contextual selection toolbar. A compact 512px-ceiling Dialog confirms refresh; a 640px-ceiling/full-mobile Sheet presents saved task details and replaces its own content for evidence reading. Use 16px mobile/24px desktop overlay padding, readable UTC dates and distinct availability/provenance labels. Reports and traces remain assigned to later refinement. Connections dialogs, project tables and report layouts follow the later phases in [REDESIGN_PLAN](REDESIGN_PLAN.md). Add shadcn primitives when actually consumed, using the pinned generator/settings in the [frontend guide](../codestyle/frontend.md#shadcnui-additions). Do not create unused component scaffolding as a substitute for a working phase.

Verify the composed interface at actual 1440/768/390px viewports, including focus, keyboard, hover/disabled/invalid/pending states, readable text, table overflow and 200% zoom. A build and token contrast calculation do not establish rendered accessibility or responsive quality.
