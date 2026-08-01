# Continuous Integration

GitHub Actions runs the `Verify` workflow for every push and pull request. It uses Node.js 24, restores the pnpm download cache from `pnpm-lock.yaml`, installs dependencies with the lockfile frozen, and runs formatting, linting, type checks, tests, and production builds.

## Test Database

The workflow starts an isolated MySQL 8.4 service container for the complete job. It supplies only disposable `TEST_MYSQL_*` values to the test process; it never supplies development, CloudBase, or production credentials. The service's dynamically assigned host port is provided through `TEST_MYSQL_PORT`.

The current tests validate environment loading. Database integration tests introduced by later tasks use the same service and variables without changing this credential boundary.

## Reproduce Locally

Start the isolated test database using the local-only values in `.env`:

```powershell
docker compose --env-file .env -f infra/docker/compose.test.yml up -d --wait
```

Set the test environment with the matching values from `.env`, then run the workflow checks:

```powershell
$env:NODE_ENV = 'test'
$env:TEST_MYSQL_HOST = '127.0.0.1'
$env:TEST_MYSQL_PORT = '3307'
$env:TEST_MYSQL_DATABASE = 'schedule_test'
$env:TEST_MYSQL_USER = 'schedule_test_app'
$env:TEST_MYSQL_PASSWORD = '<the local TEST_MYSQL_PASSWORD from .env>'

pnpm install --frozen-lockfile
pnpm exec prettier --check ".github/**/*.yml"
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Stop and remove the temporary test database when finished:

```powershell
docker compose --env-file .env -f infra/docker/compose.test.yml down -v
```

## Dependency Updates

Dependabot checks npm dependencies and GitHub Actions once a month. Each ecosystem is grouped into one update pull request and has a limit of one open version-update pull request, keeping routine maintenance reviewable. Security updates remain controlled by the repository's GitHub security settings.
