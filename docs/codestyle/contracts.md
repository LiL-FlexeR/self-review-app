# Contracts code style

Applies to `contracts/` in addition to [common rules](common.md). Package responsibilities and browser compatibility are owned by [architecture](../architecture/overview.md#code-structure); schema/validation choices are owned by [D01](../decisions/D01-stack-and-local-runtime.md).

## Files and exports

- Group public schemas by API responsibility using descriptive `kebab-case` files, such as `auth.ts` and `errors.ts`. Add more files only when the corresponding contracts exist.
- Keep `src/index.ts` as the explicit public package entrypoint. Export supported schemas and inferred types; consumers import from `@self-review/contracts`, not private source paths.
- Keep runtime schemas in `PascalCase` and give their inferred aliases the `T` prefix: `export const Identity = zod.strictObject(...)` and `export type TIdentity = zod.infer<typeof Identity>`. Export aliases explicitly with `export type`; type-only consumers use `import type { TIdentity }`. The same pattern applies to `Challenge`/`TChallenge`. Project-owned interfaces/enums follow the `I`/`E` policy in [common rules](common.md#names-types-and-imports).
- Keep inferred types beside their schemas. Do not create parallel handwritten DTO interfaces, frontend copies, or a global types directory for those same payloads.
- Keep public HTTP error codes and safe messages in `errors.ts` as `HTTP_ERROR_CODE` and `HTTP_ERROR_MESSAGE`, exported through the package entrypoint. Backend exceptions and frontend protocol comparisons use these constants. Messages normally share the code's key; name contextual variants explicitly when existing behavior uses different copy. Keep browser-only coordination/network errors local to the frontend. Boundary tests may retain literal values as independent wire-compatibility expectations.
- Use the workspace-local `@app/` alias for `contracts/src/`, without code extensions, including public entrypoint re-exports such as `export { ApiError } from '@app/errors';`. Same-directory relatives may retain explicit `.js` NodeNext specifiers. ESLint enforces the common source path rules.
- Contracts build runs the pinned `tsc-alias` after `tsc`, rewriting aliases to ordinary relative `.js` specifiers in both emitted JavaScript and declarations. Consumers must not need the contracts-private alias in their TypeScript or runtime configuration. Preserve the existing package build order.

## Boundaries and validation

- Keep runtime schemas for public HTTP/SSE payloads browser-safe. Refer to architecture for allowed contents; do not export internal provider/model/Prisma types through the public entrypoint.
- Express input constraints in the schema and infer the TypeScript type from it. Distinguish input and output types explicitly when transforms make them different.
- Contract reorganizations preserve field names and validation. Authorized changes to exported TypeScript names must update the public entrypoint and every workspace consumer together; naming changes do not change the wire payload. Changes to accepted payloads belong in the owning API specification and need behavior tests.
- `THttpErrorCode` describes the known public catalog. The `ApiError` schema continues accepting string codes/messages so an older client can parse a newer server's safe error response; recovery decisions compare known codes, never message text.
- Review exported schemas for accidental secrets or private internal fields. Do not place fixture credentials or user data in schema files.
