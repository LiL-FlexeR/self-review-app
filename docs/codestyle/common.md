# Common code style

Applies to JavaScript/TypeScript source, tests, scripts, and configuration across the repository. Read the relevant [frontend](frontend.md), [backend](backend.md), and [contracts](contracts.md) additions for affected workspaces. Responsibilities and dependency boundaries remain in [architecture](../architecture/overview.md); selected tools remain in [D01](../decisions/D01-stack-and-local-runtime.md).

## Formatting and readability

- Use the root [.prettierrc.json](../../.prettierrc.json) as the source of exact formatting options. It selects tabs with a displayed width of four, semicolons, single JavaScript/TypeScript quotes, double JSX quotes, and a 100-column wrapping target. The target is not a hard line-length limit; long strings can remain longer.
- Put each instruction and each variable declaration on its own line. Use braces around control-flow bodies. Function bodies with statements are multiline; concise expression callbacks such as `items.map((item) => item.id)` are fine.
- Separate independent functions and class methods with one blank line. Within a function, separate meaningful phases such as input preparation, an external operation, and returning a result. Keep closely related declarations together without a blank line between every variable.
- Separate a nested helper function from neighboring instructions. Do not add blank lines at the beginning or end of a block, or multiple consecutive blank lines. Prettier preserves meaningful blank lines; the author and reviewer decide their placement.
- Prefer early exits over deep nesting. Keep a function focused on one responsibility; do not split functions solely to meet an arbitrary line count. Avoid nested ternaries and assignments hidden in expressions.
- Comments explain reasons, constraints, or non-obvious behavior. Preserve comments that document security, ordering, and concurrency invariants. Use synthetic examples without credentials or private tracker content.

```ts
function sumSortedNumbers(values: number[]) {
	const sorted = values.toSorted((left, right) => left - right);
	const total = sorted.reduce((sum, value) => sum + value, 0);

	return total;
}
```

## Names, types, and imports

- Use descriptive `camelCase` variable/function/method names and `PascalCase` class names. Boolean names should express a condition, such as `isLoading`, `hasAccess`, or `canRetry`.
- Single-character bindings are prohibited across backend, frontend, contracts, tests, scripts, and maintained configuration. This includes variables, function/callback/catch parameters, destructured bindings, imports, and class/constructor properties. Use names such as `response`, `runtime`, `configuration`, `event`, `error`, and `index` according to their meaning. Do not use `r`, `c`, `e`, `i`, or an underscore to conceal the same short name. Longer names must still explain their purpose.
- Project-defined type aliases use `T` + `PascalCase`, interfaces use `I` + `PascalCase`, and enums use `E` + `PascalCase`: `TPending`, `IUser`, `EAuthType`. Generic type parameters also use a meaningful `T` name such as `TResult` or `TKey`, never a bare `T`.
- The type-prefix policy applies to declarations owned by this project. Classes and runtime Zod schemas retain their class/schema names. Third-party type declarations keep their upstream names; use descriptive local import aliases for single-character library bindings, for example `import { z as zod } from 'zod'`.
- Preserve serialized payload fields and externally defined property names while renaming local bindings. A short external property can be read into a descriptive local alias. Apply the same readable-name convention to embedded Lua locals; these strings require manual review because the TypeScript linter does not parse Lua.
- Use `UPPER_SNAKE_CASE` for named fixed constants, not every local `const`. Prefer `const`; use `let` only for reassignment and never use `var`.
- Use `kebab-case` for ordinary files and directories. React component directories and route directories follow the exceptions in [frontend](frontend.md).
- Keep TypeScript strict checking enabled. Let obvious local types be inferred; describe public boundaries clearly. Avoid `any` and unchecked assertions; validate external input at its boundary. Do not duplicate runtime schemas with independently maintained interfaces.
- Use type-only imports when an import is only a type. Preserve runtime imports needed by Nest injection/decorator metadata. Each workspace uses extensionless `@app/...` for its own `src/`, especially across source directories; import other workspaces through their public package entrypoints. Same-directory imports may stay relative: backend/contracts ESM relatives retain `.js`, while frontend relatives omit code extensions. Asset imports retain their real extensions.
- Handle promises explicitly through `await`, return, or error handling. `void` is appropriate only for intentionally detached work whose rejection is handled or whose API handles its own failures; it does not itself catch a rejection.

## Files and tests

- Keep a local helper/type near its consumer. Move shared code to the nearest common owner when another independent consumer needs it. Do not create empty scaffolding or global `misc`/`helpers` collections.
- Name unit tests `name.test.ts` or `Component/index.test.tsx` and place them according to the owning workspace guide. Backend module-local unit tests use the module’s `tests/` directory; frontend tests use `frontend/tests/`, mirroring their source hierarchy. HTTP/persistence integration tests stay in `backend/test/` as `*.integration.test.ts`.
- Keep changes to formatting and file movement distinguishable from behavior changes during review. Update all imports when moving a file; do not leave compatibility copies without an actual consumer.
- Generated Prisma code, installed dependencies, compiled output, and npm's lockfile are not hand-formatted. Formatting covers maintained source/configuration, while Markdown and reference design inputs are excluded in [.prettierignore](../../.prettierignore).

## Enforcement

- `npm run format` writes the agreed formatting; `npm run format:check` checks without writing.
- `npm run lint` checks ESLint rules, including minimum binding-name length, `T`/`I`/`E` declaration prefixes, React Hooks, and selected type-aware promise rules. Exact rules and their scopes live in [eslint.config.js](../../eslint.config.js). Naming conventions are shared across all three workspaces and also apply to tests/scripts.
- `npm run check` includes formatting, lint, workspace type checks, Prisma validation, and design-token checks. Run the stage's tests/build as required by [AGENTS.md](../../AGENTS.md).
- File placement, names, responsibilities, and meaningful blank lines are reviewed manually. There is no custom filesystem-checking framework.
- See [Prettier options](https://prettier.io/docs/options), [Prettier/linter integration](https://prettier.io/docs/integrating-with-linters), and [typed linting](https://typescript-eslint.io/getting-started/typed-linting/) for tool behavior.
