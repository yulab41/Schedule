# API Integration Test Runtime Design

**Date:** 2026-08-12
**Status:** Approved for implementation

## Problem

The leave, swap, and duty-adjustment integration suites already reset an isolated MySQL database, apply migrations, and seed real users, memberships, published schedules, and workflow requests for every case. They are currently skipped locally because plain `pnpm vitest` does not load `.env`, so `NODE_ENV` and the required `TEST_MYSQL_*` variables are absent from the Vitest process.

The local test container is intentionally separate from the development database: it is the `medical-schedule-test` Compose service, published on the configured test port and backed by `tmpfs`. Its test suites share one schema, so Vitest must remain file-serial.

## Options Considered

1. Require developers to export five variables manually before every run. This needs no code, but is error-prone and was the direct cause of the skipped suites.
2. Run every test through `.env`. This would make local integration tests work, but it broadens database credentials to unit-test runs and makes a destructive test target less explicit.
3. **Recommended: add a dedicated integration runner.** It loads `.env` only for an explicit `test:api-integration` command, validates the test-only database contract before spawning Vitest, and runs the three workflow suites serially. This matches CI's isolated `schedule_test` database while keeping ordinary tests credential-free.

## Design

### Dedicated runner and safety boundary

Add `scripts/run-api-integration.mjs` and expose it through a root `test:api-integration` script using `node --env-file=.env`.

The runner will:

- set `NODE_ENV=test` only for the child Vitest process;
- require `TEST_MYSQL_DATABASE`, `TEST_MYSQL_USER`, and `TEST_MYSQL_PASSWORD`, and validate the optional port;
- refuse any database name other than the repository's fixed `schedule_test` test schema before a test opens a connection;
- never print credentials; and
- invoke only the leave, swap, and duty-adjustment integration files. Vitest's existing `fileParallelism: false` remains the serialization mechanism because each file drops and migrates the same schema.

The runner does not create persistent fixtures itself. Each test's existing `beforeEach` is the source of real data: reset schema, migrate, create the Fastify application, register fake-auth users, and seed the published rotation needed by its request. The existing `afterEach` closes the app and database client. The Compose service's `tmpfs` makes all test data disposable when the container stops.

### Coverage completion

First add a runner unit test that fails on missing/unsafe configuration and passes for the fixed test database contract. Then run the three existing suites against the live isolated MySQL service.

Those suites already cover the Task 9 workflow semantics that the mini-program depends on: preview and normal mutations, direct swap and duty paths, setting endpoints, 409/latest-data conflicts, idempotency, permissions, cancellation, revocation, and real schedule effects. Do not add duplicate assertions merely to increase count. If the live run exposes an uncovered behavior or a test-data setup fault, add the smallest focused regression case in the owning integration file.

## Non-goals

- No production, development, or user data is read, altered, or copied.
- No API business behavior, contracts, mini-program UI, or Task 10 code changes.
- No broad all-suite integration command is introduced in this batch; the scope is the three workflow files that were skipped in Task 9.3 validation.

## Validation

1. Runner unit test: red for missing/unsafe configuration, green for a complete `schedule_test` configuration.
2. `pnpm test:api-integration`: all three selected suites execute with zero skipped tests and create their own real test data.
3. Targeted API typecheck/lint/Prettier and `git diff --check` pass.
4. Because this changes API test/runtime tooling, run `pnpm smoke:browser` and then `pnpm smoke:check-core`; record both outcomes in the debug log.
