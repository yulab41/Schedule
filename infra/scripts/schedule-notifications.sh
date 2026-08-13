#!/usr/bin/env bash
set -Eeuo pipefail

# Generate due reminders and deliver pending browser/WeChat notifications.
# The host cron invokes this script every minute; flock prevents overlapping
# runs when a slow push provider or a busy database delays one invocation.
DEPLOY_DIR=/opt/schedule
COMPOSE_FILE=infra/docker/compose.prod.yml
LOCK_FILE=/run/lock/schedule-notifications.lock

cd "$DEPLOY_DIR"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  exit 0
fi

compose_run() {
  docker compose --env-file .env.production -f "$COMPOSE_FILE" run --rm api \
    node apps/api/dist/jobs/run-job.js "--job=$1"
}

status=0
if ! compose_run duty-reminders; then
  echo "[notifications] duty-reminders failed" >&2
  status=1
fi
if ! compose_run notification-retry; then
  echo "[notifications] notification-retry failed" >&2
  status=1
fi

exit "$status"
