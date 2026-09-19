#!/usr/bin/env bash
set -euo pipefail

exec 9>/var/lock/schedule-privacy-retention.lock
if ! flock -n 9; then
  echo '[privacy-retention] another retention run is active; skipping'
  exit 0
fi

cd /opt/schedule
API_CONTAINER=medical-schedule-prod-api-1
# 同 schedule-notifications：定时作业在常驻 api 容器内执行，避免在 2 vCPU/
# 1.6GB 机器上每 15 分钟额外起一个一次性容器。
if [ "$(docker inspect --format '{{.State.Running}}' "$API_CONTAINER" 2>/dev/null || true)" = "true" ]; then
  exec docker exec "$API_CONTAINER" node apps/api/dist/jobs/run-job.js --job=privacy-retention
fi
docker compose --env-file .env.production -f infra/docker/compose.prod.yml run --rm api \
  node apps/api/dist/jobs/run-job.js --job=privacy-retention
