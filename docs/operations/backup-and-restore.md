# Backup and Restore

## Backup policy

The `database-backup` job creates a full logical dump of every table in the
configured database, computes a per-table SHA-256 checksum, encrypts the whole
archive with AES-256-GCM, and records the archive in `backup_archives`.

Retention is enforced by the same job:

- the 30 most recent daily backups are kept;
- the first backup of each calendar month is also the monthly archive, and the
  12 most recent monthly archives are kept.

Older archives are deleted from storage and from `backup_archives`. Backups are
never stored or written in plaintext; if `BACKUP_ENCRYPTION_KEY` is missing,
the job fails instead of writing an unencrypted file.

## Running the job

```powershell
$env:BACKUP_DIR = "D:\secure\backups"
$env:BACKUP_ENCRYPTION_KEY = "<64 hex characters or 32-byte base64>"
pnpm --filter @schedule/api build
node --env-file=.env apps/api/dist/jobs/run-job.js --job=database-backup
```

The job prints `{ archiveId, backupKind, tableCount, rowCount, sha256,
deletedArchives, ... }`. Every run (including failures) is recorded in
`platform_job_runs`, and `GET /platform/backups` and `GET /platform/jobs` show
the current state to platform administrators.

In production/CloudBase the storage destination should be a restricted cloud
bucket with a short-lived write credential (Task 30 wires the deployment); the
job contract only requires the `BackupStorage` interface, and the local
implementation resolves every key inside `BACKUP_DIR`.

## Restore drill

The restore script applies the migration journal to the target database, loads
the decrypted rows with foreign-key checks temporarily disabled, and verifies
that every table has the original row count and checksum:

```powershell
pnpm --filter @schedule/api build
pnpm holidays:build
$env:RESTORE_MYSQL_HOST = "127.0.0.1"
$env:RESTORE_MYSQL_PORT = "3307"
$env:RESTORE_MYSQL_DATABASE = "schedule_restore_drill"
$env:RESTORE_MYSQL_USER = "schedule_test_app"
$env:RESTORE_MYSQL_PASSWORD = "<test password>"
$env:BACKUP_ENCRYPTION_KEY = "<the same key used for the backup>"
node infra/scripts/dist/restore-backup.js --backup="D:\secure\backups\backups\daily\2026-08-02T....backup"
```

The target must be an isolated database (never the development or production
database). Exit code 0 means `restored: true` with matching table counts and
checksums; exit code 1 prints the mismatches. Run this drill at least once per
quarter per the recovery policy.

## Recovery verification

After a restore, confirm:

- the printed `tableCount` and `rowCount` match the source backup's metadata;
- `restored: true` (no checksum mismatches);
- `statistics-rebuild` recomputes snapshots if any workflow event is missing:

```powershell
node --env-file=.env apps/api/dist/jobs/run-job.js --job=statistics-rebuild
```

`statistics-rebuild` scans all published periods and refreshes each group-month
snapshot, so a restored database converges to the same statistics the
administrators see.
