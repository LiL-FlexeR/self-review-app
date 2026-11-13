# Frontend code style

Applies to `frontend/` in addition to [common rules](common.md). Routing, server/local state, authentication coordination, and the shared theme remain defined in [architecture](../architecture/overview.md#frontend-data-flow) and the [frontend design inputs](../stages/README.md#frontend-design-inputs).

## Filesystem style

Each React component has a `PascalCase` directory and its implementation in `index.tsx`: `[owner]/SomeComponent/index.tsx`. Export the named component from that implementation; `index.tsx` is not a forwarding-only barrel. Pages are the route-directory exception: `pages/<route>/index.tsx`, exporting a clearly named page component. Related routes may compose one shared page without changing public URLs.

```text
src/
  App/index.tsx
  pages/
    auth/
      index.tsx
      components/
        LoginForm/
          index.tsx
          types.ts
    otp/index.tsx
    connections/index.tsx
    projects/index.tsx
  components/
    ui/
      Button/index.tsx
      Input/index.tsx
    templates/
      OtpForm/
        index.tsx
        types.ts
      AppShell/index.tsx
  auth/                 # session/coordinator infrastructure
  lib/utils.ts
  styles/globals.css
```

- `pages/<route>/components/` owns components used only by that page. Components local to a template belong in that template's `components/` directory.
- `components/ui/` owns basic UI primitives, including adapted shadcn/ui source. `components/templates/` owns shared composed blocks and behavior, such as OTP reused for login, signup, or a later confirmation flow. Only currently authorized flows are implemented.
- Do not create root-level `components/<feature>/` groups. Promote a local component to a shared template when another page/scenario needs it.
- Keep component-local props/types in `types.ts` when they merit a separate file; hooks, helpers, tests, and any necessary local styles stay in the same component directory. Use the established Tailwind/global theme before adding local styling. Create only files that have content.
- A root `src/types/` is optional and holds types actually shared by independent frontend consumers. Types shared only within a page/template stay there. Import public HTTP/SSE types from `@self-review/contracts` rather than duplicating them.
- Non-component infrastructure such as `auth/session.ts` and `auth/coordinator.ts` stays outside page components. Routes retain their existing URLs; directory organization does not introduce a new route.
- Prefer direct component imports such as `@app/components/ui/Button`; directory resolution selects `index.tsx`. Ordinary helper/type file names remain `kebab-case`.

## Imports

- `@app/` resolves to `frontend/src/` in TypeScript, Vite, and the frontend Vitest project. Use extensionless aliases across source directories, including page-local component directories. Same-directory helpers/types/tests can retain short relative imports such as `./types` or `./coordinator`.
- Keep real extensions on assets, for example `import '@app/styles/globals.css';`. ESLint rejects relative paths across source directories, extensions on code aliases, and the old `@/...` prefix.
- `frontend/components.json` uses the same `@app/...` prefix for shadcn generation. Do not retain a second alias or compatibility copies of imported components.
- The alias stays local to this workspace; public schemas/types come from `@self-review/contracts`. Each Vitest workspace project has its own alias so frontend tests cannot resolve backend's `src/` by mistake.

## React conventions

- Use function components, `PascalCase` names, and `useSomething` names for custom hooks. Declare components at module scope. Type component props explicitly when they form a boundary, following [common naming rules](common.md#names-types-and-imports): for example `TButtonProps` for an alias or `IOtpFormProps` for an interface. Give event handlers descriptive parameters such as `event` and catch handlers `error`.
- Follow the Rules of Hooks and keep render pure. Do not mutate props/state or suppress dependency warnings to force an effect to run once. Derive values from current props/state when no external synchronization is needed.
- Keep event actions in handlers, and use effects for external synchronization with cleanup. Split complicated JSX into appropriately owned components. Use stable keys for lists.
- Reuse the established UI components and semantic theme tokens. Keep loading, error, empty, and busy states explicit. Preserve keyboard behavior, labels, focus, and status announcements when extracting components.
- See [Rules of React](https://react.dev/reference/rules) and [React ESLint rules](https://react.dev/reference/eslint-plugin-react-hooks).

## shadcn/ui additions

Use shadcn CLI **4.23.0**, new-york style, neutral semantic variables, and Radix primitives with the committed `components.json`. Invoke this pinned generator for additions; it is a generation tool rather than a build dependency. Origins: [Button registry](https://ui.shadcn.com/r/styles/new-york/button.json), [Input registry](https://ui.shadcn.com/r/styles/new-york/input.json), [Sidebar and its dependencies](https://ui.shadcn.com/docs/components/sidebar), and [Vite setup](https://ui.shadcn.com/docs/installation/vite).

Keep `components.json` aliases aligned with this workspace. The generator emits conventional flat lowercase files; move each generated component into its `PascalCase/index.tsx` directory and update every generated import before committing it. Preserve theme adaptations and review the final diff. Do not retain parallel flat and directory implementations or assume the generator automatically understands this custom layout.

Current adaptations follow [DESIGN.md](../design/DESIGN.md): semantic neutral feedback, Graphite control boundaries, filled/quiet button radii independent of size, readable type roles, a shared focus outline, and larger mobile targets. AppShell uses the shared content-width tokens and a 240px expanded sidebar; mobile Sheet navigation stays at md/768px. Choose the page contentWidth preset rather than duplicating max-width/padding wrappers; PageHeader owns shared title/description/actions. Tabs now uses the installed Radix umbrella primitive, quiet underline selection and the shared focus treatment in the project workspace; the generated standalone cn helper/dependency is replaced by the existing utility. Dialog, Table and Checkbox are consumed by the Tasks workspace. Dialog retains Radix focus/dismissal behavior with the shared theme; Table leaves its labeled overflow region to the local composition; Checkbox uses a teal check and expanded hit area. Connections also consumes Dialog for provider forms and AlertDialog for permanent local deletion; the latter uses a 480px ceiling, neutral destructive treatment and explicit async action handling so errors do not dismiss confirmation. Both overlays restore their opener, with page-owned fallback when it disappears. The media-query adapter uses `useSyncExternalStore`, and Skeleton width is deterministic. Reuse existing helpers/primitives and review generated dependencies instead of retaining duplicate components or standalone `cn` packages.

## Tailwind and component styling

- Keep `styles/globals.css` limited to imports, reference/semantic theme variables, Tailwind theme mappings, and application-wide base rules. Put screen/component layout, spacing, responsive behavior, and visual states in Tailwind classes beside the JSX. Do not add global selectors such as `.auth-card`, `.sidebar nav`, or `.empty` for individual screens.
- Use the AppShell content container (`@container/workspace`) for compositions whose usable width changes with the sidebar, and a local named container when a nested form needs its own width. Follow [DESIGN's responsive adaptations](../design/DESIGN.md#layout-and-responsive-behavior); keep the viewport-based mobile navigation boundary independent. Preserve bounded, labeled table/tab scroll regions and wrapping control labels.
- Compose the selected shadcn components for standard UI: Sidebar/Sheet for responsive navigation, Card for panels, Label/Input/Button for forms, and Alert for status presentation. Add application-specific composition in the owning template/page; do not rebuild the generic component's focus handling, dialog, or navigation infrastructure from scratch.
- Reuse semantic theme utilities and the reference values. Adapt generated defaults that conflict with the light theme, weights, radii, or elevation. Shared repeated compositions belong in templates such as AuthPanel, rather than a global CSS class collection.
- Keep generated imports on `@app/...` and use the existing `@app/lib/utils` helper. Review generated dependencies, retain exact version pins, and remove accidental duplicate helpers/primitives. Check keyboard behavior and actual narrow-screen interactions after changing navigation; report unavailable manual checks explicitly.
