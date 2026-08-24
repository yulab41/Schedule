#!/usr/bin/env bash
set -euo pipefail

exec 9>/var/lock/schedule-privacy-retention.lock
if ! flock -n 9; then
  echo '[privacy-retention] another retention run is active; skipping'
  exit 0
fi

cd /opt/schedule
docker compose --env-file .env.production -f infra/docker/compose.prod.yml run --rm api \
  node apps/api/dist/jobs/run-job.js --job=privacy-retention
