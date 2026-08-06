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

## Local Development Auth

The `.env.example` includes two local-only switches:

- `VITE_AUTH_DEV_MODE=true` shows the “本地管理员 / 本地成员” buttons on the login page.
- `AUTH_DEV_MODE=true` makes the API accept `Bearer local-admin` / `Bearer local-member` as local identities.

Both default to `false`. The API enables the development auth port only when `NODE_ENV=development` and `AUTH_DEV_MODE=true`; a leaked switch cannot activate it in test or production mode.

## Start Development MySQL

```powershell
docker compose --env-file .env -f infra/docker/compose.yml up -d --wait
docker compose --env-file .env -f infra/docker/compose.yml ps
```

The `mysql` service must show `healthy`. Its data is stored in the named Docker volume `medical-schedule-dev-mysql-data`, so stopping the service does not remove development data.

## Apply Database Migrations

Build the workspace, then run the controlled migration entry point:

```powershell
pnpm build
pnpm --filter @schedule/api migrate
```

The entry point validates the same local environment values used by the API, connects with UTC session handling, applies the Drizzle migration journal, and closes the connection. It is safe to rerun: applied migrations are recorded in `__drizzle_migrations`. In a non-local environment, take the required backup before running migrations.

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

## Run the Local API

Build and start the API after the local configuration has been created:

```powershell
pnpm --filter @schedule/api build
pnpm --filter @schedule/api start
```

The local server reads the repository `.env` file, validates it before listening, and serves `http://127.0.0.1:3000/health` and `http://127.0.0.1:3000/ready`. Until Task 5 adds the database connection, readiness confirms only that the API runtime is available.
