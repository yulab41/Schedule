# Local Development Setup

## Prerequisites

- Windows 11 with Docker Desktop running.
- Node.js and pnpm versions required by `package.json`.

## Create Local Configuration

From the repository root, create the ignored local environment file once:

```powershell
Copy-Item .env.example .env
```

Use local-only passwords in `.env`. Do not copy CloudBase, test, or production credentials into this file.

## Start Development MySQL

```powershell
docker compose --env-file .env -f infra/docker/compose.yml up -d --wait
docker compose --env-file .env -f infra/docker/compose.yml ps
```

The `mysql` service must show `healthy`. Its data is stored in the named Docker volume `medical-schedule-dev-mysql-data`, so stopping the service does not remove development data.

## Stop, Rebuild, and Inspect Development MySQL

```powershell
docker compose --env-file .env -f infra/docker/compose.yml logs -f mysql
docker compose --env-file .env -f infra/docker/compose.yml down
docker compose --env-file .env -f infra/docker/compose.yml up -d --wait --force-recreate
```

To intentionally delete all local development MySQL data, first stop the service and then remove its named volume. This cannot be undone:

```powershell
docker compose --env-file .env -f infra/docker/compose.yml down -v
```

## Run an Isolated Test MySQL

```powershell
docker compose --env-file .env -f infra/docker/compose.test.yml up -d --wait
docker compose --env-file .env -f infra/docker/compose.test.yml down -v
```

The test service uses host port `3307` and a temporary MySQL data directory. Every `down -v` followed by `up` starts with a fresh test database and does not touch the development named volume.

When an API process runs with `NODE_ENV=test`, it must supply `TEST_MYSQL_HOST`, `TEST_MYSQL_PORT`, `TEST_MYSQL_DATABASE`, `TEST_MYSQL_USER`, and `TEST_MYSQL_PASSWORD`. The environment loader maps only these values to the API database settings in test mode, so it never falls back to development MySQL credentials.

## Validate API Environment Values

The API loads its configuration through `loadEnvironment`. Missing `MYSQL_DATABASE`, `MYSQL_USER`, or `MYSQL_PASSWORD`, or invalid port values, stop startup with a field-specific `EnvironmentValidationError`. The local server added in task 4 must call this function before listening for requests.

```powershell
pnpm --filter @schedule/api test
```

The test verifies valid defaults and the clear errors for a missing database password and an invalid port. Configuration errors identify only field names and validation messages; they never include password values.
