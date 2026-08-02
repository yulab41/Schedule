# Incident Response

## Severity levels

- **S1 – data loss or unavailability**: a database restore is required, or the
  service cannot answer requests.
- **S2 – degraded operation**: one scheduled job fails repeatedly, exports are
  delayed, or notifications are stale.
- **S3 – single-user/group issue**: one account or group behaves incorrectly;
  no restore is needed.

## S1: restore procedure

1. Pause writes: stop schedule generation, approvals, and any running jobs that
   mutate the database.
2. Pick the newest archive whose `created_at` precedes the incident. List
   archives with `GET /platform/backups` or query `backup_archives`.
3. Restore into an isolated database following
   [backup-and-restore.md](./backup-and-restore.md), then verify counts and
   checksums.
4. Run `--job=statistics-rebuild` on the restored database so snapshots match
   the recovered data.
5. Re-open writes, then confirm `/ready` and one representative group's
   calendar/statistics reads.
6. Record the archive id, restore time, and verification output in the incident
   log (security audit rows already record the platform operations that led to
   the incident).

## S2: job health

- `GET /platform/jobs` shows the last run of every scheduled job
  (`duty-reminders`, `notification-retry`, `holiday-alerts`, `export-jobs`,
  `database-backup`, `statistics-rebuild`, `group-recycle`).
- A failed backup run means `BACKUP_ENCRYPTION_KEY` or storage credentials need
  attention; the job intentionally fails closed.
- A failed `group-recycle` run usually indicates a foreign-key ordering issue;
  fix and rerun — the job is idempotent (it only processes groups still past
  the 30-day window).
- Repeat the exact failing command locally against an isolated copy of the
  database before touching production.

## S3: group and account incidents

- A group deleted by its owner stays in the 30-day recycle window. A platform
  administrator restores it with
  `POST /platform/groups/:groupId/restore`; after 30 days the `group-recycle`
  job purges it and frees the group code.
- A deregistered account has its CloudBase identity and contact numbers
  detached immediately, while its name snapshots and schedule history remain.
- Account bans are applied with `PUT /platform/users/:userId/status`; the
  status change is audit-logged and takes effect on the next authenticated
  request.

## Communication

For S1/S2, notify affected group administrators through the in-app
notification center and record the incident's cause, impact window, and
recovery verification in the project status file for the next conversation.
