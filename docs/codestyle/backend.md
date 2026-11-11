# Backend code style

Applies to `backend/` in addition to [common rules](common.md). Functional areas, runtime entrypoints, persistence, and dependency boundaries remain in [architecture](../architecture/overview.md#code-structure). Authentication behavior remains in [D04](../decisions/D04-auth-and-credentials.md).

## Filesystem style

Root NestJS modules and feature directories live under `backend/src/modules/`. Put the API root module at `modules/app.module.ts`, the worker root module at `modules/worker.module.ts`, and feature modules in `modules/<feature>/`. Reusable technical modules belong in `backend/src/shared/<responsibility>/` alongside their shared providers: for example, `shared/config/config.module.ts` and `shared/infrastructure/infrastructure.module.ts`.

```text
src/
  modules/
    app.module.ts
    worker.module.ts
    auth/
      auth.module.ts
      auth.controller.ts
      services/
        auth.service.ts
        challenges.service.ts
        crypto.service.ts
        password-hash.service.ts
      tests/
        crypto.service.test.ts
  exceptions/
    safe-errors.filter.ts
  shared/
    config/
      config.module.ts
      config.schema.ts
      config.service.ts
    infrastructure/infrastructure.module.ts
    database/database.service.ts
    redis/redis.service.ts
    mail/mail.service.ts
    clock/clock.service.ts
  app.ts              # API construction
  main.ts             # API entrypoint
  worker.ts           # worker entrypoint
```

Group code by feature/module within `modules/`. Keep a small module flat:

```text
modules/auth/
  auth.module.ts
  auth.controller.ts
  auth.service.ts
  auth.interfaces.ts   # only if needed
  auth.types.ts        # only if needed
```

When a category grows to multiple implementation files, move the whole category into a plural directory. Test files do not count as another implementation. Categories grow independently; one controller may remain beside the module while several services use `services/`.

```text
modules/auth/
  auth.module.ts
  auth.controller.ts
  services/
    auth.service.ts
    challenges.service.ts
    crypto.service.ts
    password-hash.service.ts
  tests/
    crypto.service.test.ts
  auth.types.ts
```

- Keep `<feature>.module.ts` at its `modules/<feature>/` root. New feature areas such as connections, projects, jobs, agent, providers, and reviews follow the same parent directory. Use suffixes such as `.controller.ts`, `.service.ts`, `.guard.ts`, `.pipe.ts`, and `.module.ts` with corresponding class names such as `AuthController` and `AuthService`.
- Apply the same category rule to `controllers/`, `services/`, `guards/`, `pipes/`, `types/`, and `interfaces/` when needed. Use meaningful feature/responsibility names instead of `another` or `misc`.
- `*.interfaces.ts` groups related interfaces; `*.types.ts` groups related aliases/unions. Names follow [common naming rules](common.md#names-types-and-imports), for example `IMail`, `TPending`, and `TConfig`; class tokens such as `MailService` and `ConfigService` keep their class names. A single local type can stay in its consumer. Do not create an interfaces file just because a types file exists.
- Feature-local helpers/types stay inside their feature under `modules/`. Put local unit tests in the owning module’s `tests/` directory, for example `modules/auth/tests/crypto.service.test.ts` for `modules/auth/services/crypto.service.ts`. Shared technical modules follow the same rule, for example `shared/config/tests/config.schema.test.ts`. Cross-feature infrastructure and general reusable logic belong in `src/shared/`; they do not need empty Nest modules or service wrappers solely for naming symmetry.
- API/worker bootstraps stay at `src/main.ts` and `src/worker.ts`. Keep local unit tests in the owning module’s `tests/` directory and cross-module HTTP/persistence integration tests in `backend/test/`.

## Exceptions, filters, and shared code

- Use standard Nest HTTP exceptions for expected API failures, for example `ConflictException`, `UnauthorizedException`, and `ServiceUnavailableException`. Pass an explicit public payload `{ code, message, retryable }`; keep raw provider/database errors and exception causes out of that payload. For statuses without a dedicated built-in class, use `HttpException` with `HttpStatus`. Do not introduce a custom HTTP error base class for the same purpose. Genuine non-HTTP domain error classes may live in `src/errors/` when needed.
- Use the public `HTTP_ERROR_CODE` and `HTTP_ERROR_MESSAGE` constants from `@self-review/contracts` for exception payloads and protocol comparisons. Their placement, variants, and public types follow the [contracts guide](contracts.md); keep third-party library error codes in their original form.
- `src/exceptions/` contains Nest exception filters, for example `safe-errors.filter.ts` exporting `SafeErrorsFilter`. Filters convert thrown errors into the safe HTTP response defined by [architecture](../architecture/overview.md#api). SafeErrorsFilter validates HttpException payloads against the public error schema before exposing fields, adds requestId, and keeps generic fallbacks for unstructured HTTP exceptions and unknown failures. Register the global filter through `APP_FILTER` in AppModule so Nest constructs it. Keep filter code separate from error-class definitions.
- `src/shared/` contains reusable technical modules, classes, helpers, types, and infrastructure used across modules or entrypoints. ConfigModule and ConfigService live together in `shared/config/`; its Zod validation remains in `config.schema.ts`. InfrastructureModule lives in `shared/infrastructure/infrastructure.module.ts` and wires shared providers. DatabaseService, RedisService, MailService, and ClockService live in their corresponding responsibility directories. Keep tests inside their owning technical module’s `tests/` directory. Low-level Prisma/SMTP factory functions may remain beside their owning injectable service.
- Group shared code by responsibility when useful; do not use shared as a collection of unrelated business logic. Feature-specific logic stays with its module until another independent consumer needs it.
- Error classes and shared infrastructure must not import feature modules or exception filters. Filters may depend on error classes; feature modules may depend on errors/shared code. Shared HTTP/SSE contracts remain in the separate contracts workspace.

## Imports

- `@app/` resolves to `backend/src/`. Use extensionless aliases across source directories, including module-local tests: `import type { TConfig } from '@app/shared/config/config.schema';`. Do not use parent-directory chains or downward relative directory paths for backend source dependencies.
- Keep imports within the same directory short, for example `./crypto.service.js`. Integration tests use `@app/...` for production source and relative paths with `.js` for their own test helpers. Generated Prisma source is excluded from style enforcement; maintained imports of its client use `@app/generated/prisma/client`.
- Import contracts through `@self-review/contracts`, preserving package boundaries. Every workspace defines `@app/...` for its own `src/`; frontend/contracts aliases must not resolve backend source.
- TypeScript `paths` and `tsx` resolve source aliases. Backend `build` runs the pinned `tsc-alias` after `tsc`, converting aliases to relative `.js` specifiers for plain Node ESM and Docker. The backend unit-test project and integration configuration mirror the backend source alias; no production runtime resolver is required. ESLint's `no-restricted-imports` checks source path style and extensionless aliases.

## NestJS conventions

- Controllers adapt HTTP requests/responses and delegate application logic to services. Keep application construction and module wiring separate from controller implementations.
- Use static `@Module({ imports, providers, controllers, exports })` declarations for application modules. Register `@Injectable()` services in their owning module and inject their dependencies; bootstraps must not construct AuthService, ChallengesService, or infrastructure services by hand. Use dynamic `register()`/`forRoot()` methods only when a module genuinely needs caller-supplied runtime registration options.
- ConfigModule exports ConfigService, which validates environment values once per application context. InfrastructureModule imports ConfigModule and exports the database, Redis, mail, and clock providers. Use explicit module imports instead of making all providers global. See [backend DI](../architecture/overview.md#backend-dependency-injection) for ownership and startup behavior.
- Use explicit runtime `@Inject(ClassOrToken)` annotations for constructor dependencies so both compiled decorator metadata and the development tsx runner resolve the same providers. Interfaces/types alone are not runtime tokens.
- Infrastructure providers own their connections and use Nest lifecycle hooks for startup/shutdown. PasswordHashService initializes its dummy password hash in `onModuleInit` and owns the password-operation concurrency limit; the worker publishes readiness only after infrastructure initialization.
- Override providers in the Nest testing module when a controlled clock or substituted external boundary is needed. Existing integration setup lives in `backend/test/support/create-test-app.ts`; it reuses the production module graph and HTTP configuration. Borrowed database/Redis clients in child failure-case apps must not be closed by those child apps.
- Use the selected Zod contracts for public validation; this style guide does not introduce class-validator DTOs. Internal provider/model schemas remain backend-owned.
- Preserve runtime class/token imports required by decorator metadata or explicit `@Inject`. Interfaces cannot serve as runtime injection tokens by themselves.
- Keep transaction, cookie, error-redaction, and concurrency behavior unchanged during structural moves. Domain specifications and skills continue to own those rules.
- See Nest's [providers](https://docs.nestjs.com/providers) and [feature modules](https://docs.nestjs.com/modules#feature-modules).
