# Project Status

This file is the concise handoff entry point for every new implementation conversation. It records current state only; Git history preserves older state.

## Current Position

- Last updated: 2026-08-01
- Branch: `main`
- Upstream: `origin/main`
- Target release: Doctor Scheduling Web 1.0
- Current phase: Phase One — Backend and Account Foundation
- Implementation plan: Approved by the user
- Implementation code: Tasks 1 through 5 complete; Task 6 is next.

## Approved Sources

- Design specification: `docs/superpowers/specs/2026-08-01-medical-staff-scheduling-system-design.md`
- Implementation plan: `docs/superpowers/plans/2026-08-01-medical-staff-scheduling-system-implementation-plan.md`
- Repository rules: `AGENTS.md`

## Completed Work

- Product requirements, architecture, and the 32-task implementation plan are approved and committed.
- Automatic Git/GitHub checkpoint and cross-conversation handoff rules are active.
- Task 1 completed: pnpm TypeScript workspace with minimal API, Vue Web, contracts, database, and scheduling-domain package entries.
- Task 1 completed: strict TypeScript, ESLint, Prettier, Vitest, build/typecheck scripts, secure pnpm build approval, and local-output/secret ignore rules.
- Task 2 completed: separate Docker Compose definitions for persistent development MySQL and ephemeral isolated test MySQL, each with a database health check.
- Task 2 completed: API Zod environment validation rejects missing required database settings and invalid ports without exposing password values; test mode maps only `TEST_MYSQL_*` values and local PowerShell setup and recovery steps are documented.
- Task 3 completed: GitHub Actions verifies frozen dependency installation, GitHub configuration formatting, formatting, linting, strict types, unit tests, and builds on every push and pull request using Node.js 24 and the pnpm download cache.
- Task 3 completed: the verification job provides an isolated MySQL 8.4 service with disposable `TEST_MYSQL_*` credentials only; Dependabot groups npm and GitHub Actions version updates into at most one monthly pull request per ecosystem.
- Task 4 completed: one Fastify application factory now powers thin local-server and CloudBase HTTP adapters, with `/health` and `/ready` endpoints and a UUID request ID on every response.
- Task 4 completed: shared API error contracts provide safe code, message, request ID, and optional latest-data summaries; logs recursively redact passwords, tokens, and telephone fields while retaining only redacted error diagnostics.
- Task 5 completed: the database package provides UTC MySQL/Drizzle connection clients, an isolated single-connection test factory, and one shared transaction helper that owns transaction boundaries.
- Task 5 completed: the initial identity and group migration creates the seven approved tables with audit/version conventions, group-code retention through soft deletion, and database-enforced pending-roster-name uniqueness; the API migration entry point validates environment values before running the Drizzle journal.

## Active Batch

- Task 6: Integrate CloudBase authentication.
- Stop after Task 6, or earlier if CloudBase development credentials, authentication SDK behavior, or the identity mapping exposes a blocker.

Task 6 is the only implementation task authorized for the next conversation. It must be validated and committed separately.

## Required Reading for the Next Conversation

1. Read this file completely.
2. Read `AGENTS.md` completely.
3. Read Task 6 in the implementation plan.
4. Read design sections 3, 4, 19, and 20, plus any section referenced by an unexpected issue.
5. Inspect `git status --short --branch`, `git log -5 --oneline --decorate`, the current branch, and remotes.

## Known Environment State

- The repository is connected to `https://github.com/yulab41/Schedule.git`.
- `main` was synchronized with `origin/main` before this handoff update.
- Node.js v24.14.0, pnpm v11.9.0, Docker v29.4.0, and Docker Compose v5.1.2 were detected.
- Docker Desktop is running. `medical-schedule-dev-mysql-1` remains healthy on host port 3306 and persists data in `medical-schedule-dev-mysql-data`.
- Task 5 validation started a new isolated MySQL on host port 3307, exercised the migration and compiled migration entry point, then stopped and removed it. Its temporary data directory never used the development volume.
- A local `.env` was created from `.env.example`; it remains ignored and was not staged. Docker's sandboxed client can warn while reading the user's Docker config, but Compose validation and the live engine checks passed outside the sandbox.
- The API migration entry point reuses validated environment values, opens a UTC MySQL connection, applies the root `migrations/` Drizzle journal, and closes the connection. HTTP startup does not run migrations automatically.
- GitHub Actions uses only disposable test database values and has read-only repository contents permission; no CloudBase, development, or production secret is referenced. Its first remote run `30681864912` was rejected before job execution because the `job` context is unavailable in a job-level `env`; the correction scopes all `TEST_MYSQL_*` values, including the dynamically assigned port, to the `Run tests` step. Corrected remote run `30682009680` passed in 1 minute 15 seconds.
- A user-owned whitespace-only edit remains unstaged in `docs/superpowers/plans/2026-08-01-medical-staff-scheduling-system-implementation-plan.md`; do not stage or overwrite it.
- No CloudBase development environment configuration or secrets are stored in the repository.
- The local API is running from the Task 4 build at `http://127.0.0.1:3000`; `/health` and `/ready` both returned 200. This is a local process only, not a CloudBase deployment.

## Reusable Operational Notes

- Docker Desktop can be installed while its engine is stopped. If `docker info` reports a missing Docker named pipe, start Docker Desktop, wait for `docker info` to return a server version, then retry Compose.
- Before diagnosing a silent `docker compose up --wait`, run `docker image inspect mysql:8.4`. If absent, run `docker pull mysql:8.4` and wait for the image to exist; no container or logs are expected before the image is available.
- A sandboxed Docker client can warn that it cannot read the user's Docker config. Keep Compose syntax checks separate from live-engine validation; run the latter in an environment that can access Docker Desktop rather than treating the warning as a Compose-file failure.
- Run API environment tests with `pnpm --filter @schedule/api test`; when `NODE_ENV=test`, provide only the `TEST_MYSQL_*` settings so the loader cannot fall back to development MySQL.
- When a network or UI interruption occurs during a push, verify completion with `git status --short --branch` and `git ls-remote --heads origin main` before retrying. Never stage the user-owned plan edit shown above.

## Latest Validation

- Task 1: `pnpm install --frozen-lockfile=false` passed after allowing only `esbuild` in pnpm's committed `allowBuilds` configuration.
- Task 1: `pnpm verify` passed: Prettier, ESLint, strict TypeScript checks for five workspace packages, 1 Vitest test, and all package/Web production builds.
- Task 2: `pnpm install --no-frozen-lockfile` passed and locked Zod 4.4.3.
- Task 2: `docker compose --env-file .env -f infra/docker/compose.yml config --quiet` and the test equivalent passed.
- Task 2: both Compose services reached `healthy`; the test service was removed and rebuilt, while the development service and `medical-schedule-dev-mysql-data` remained healthy and present.
- Task 2: `pnpm --filter @schedule/api test` passed with 5 environment tests; `pnpm verify` passed formatting, ESLint, strict type checks, 6 Vitest tests, and all production builds.
- Task 3: with the isolated test MySQL healthy, `pnpm install --frozen-lockfile`, `pnpm exec prettier --check ".github/**/*.yml"`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` all passed. `pnpm exec prettier --check docs/development/ci.md` also passed.
- Task 3 remote check: GitHub Actions registered the workflow and Dependabot configuration. Run `30681864912` initially failed at workflow evaluation with `Unrecognized named-value: 'job'` for a job-level environment expression; after moving the test variables to the `Run tests` step, the complete local CI reproduction passed again and corrected run `30682009680` passed remotely in 1 minute 15 seconds.
- Task 4: `pnpm --filter @schedule/api test` passed with 11 tests; `pnpm verify` passed formatting, ESLint, strict type checks, 12 Vitest tests, and all package/Web production builds; `pnpm exec prettier --check docs/development/local-setup.md` passed.
- Task 4 live check: the rebuilt local API returned 200 from `/health` and `/ready`, each with a distinct UUID `x-request-id` header.
- Task 4 checkpoint commit message: `feat(api): add runtime and error contract`.
- Task 5: `pnpm --filter @schedule/database typecheck` passed; its isolated migration suite passed 6 tests for empty-database migration, idempotent reruns, UTC sessions, unmanaged-schema rejection, schema fidelity, database uniqueness, and transaction rollback.
- Task 5: with the isolated test MySQL healthy, `pnpm verify` passed formatting, ESLint, strict types, 18 Vitest tests, and all production builds. The compiled API migration entry point also ran successfully against that test database before the service was removed.

## Recent Checkpoints

- `0c58852` — `docs: add Web 1.0 implementation plan`
- `0a375f0` — `docs: add automatic Git checkpoint policy`
- `2238103` — `Initial commit`
- `ae649b3` — `chore: scaffold TypeScript workspace` (pushed to `origin/main`)
- `c450405` — `chore: add local Docker development environment` (pushed to `origin/main`)
- `470ff00` — `docs: record local setup troubleshooting` (pushed to `origin/main`)
- `66ba02c` — `ci: add repository verification workflow` (pushed; initial remote run rejected before job execution)
- `a48a9ba` — `ci: scope test database variables to test step` (pushed; corrected Verify run passed)
- Task 5 checkpoint commit message: `feat(db): add identity and group schema`

## Decisions and Blockers

- Task 4 keeps Fastify logger configuration inside the application factory: tests may disable logging or provide a stream, but callers cannot bypass the redaction configuration. Every log argument and the final JSON log record are sanitized, covering arbitrary nested plain objects, arrays, and child bindings; request and error serializers remove request headers, query strings, error messages, and stacks.
- Task 5 keeps group codes globally unique until a future recovery purge hard-deletes the group, preserving the 30-day soft-delete window. Stored generated columns with unique indexes enforce active memberships, active contacts, and pending roster names because MySQL does not provide portable partial unique indexes. Timestamps are `TIMESTAMP(3)` and every MySQL session is explicitly set to UTC.
- The Drizzle journal is the migration source of truth; the API wrapper runs it explicitly rather than applying DDL during HTTP startup. No Task 5 blockers remain. CloudBase console configuration remains deferred until Task 6.

## Handoff Requirements

Before ending each implementation conversation:

1. Update the current phase and completed work.
2. Record validation commands and whether they passed.
3. Record relevant decisions, deviations, blockers, and external console state.
4. Set the next active batch to 1–3 exact task numbers with a stop condition.
5. Include the status update in the appropriate task checkpoint commit.
6. Push only when `AGENTS.md` Git rules allow it.
