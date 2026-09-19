#!/usr/bin/env bash
set -Eeuo pipefail

# Generate due reminders, complete pending exports, and deliver pending
# browser/WeChat notifications.
# The host cron invokes this script every minute; flock prevents overlapping
# runs when a slow push provider or a busy database delays one invocation.
#
# 2 vCPU/1.6GB 小机器资源铁律：每分钟为三个作业各新起一个一次性容器，会让机器
# 持续读镜像层、重新分配内存并挤出页缓存；生产实测把 API 请求拖到 5-12 秒。
# 因此作业优先在常驻的 api 容器里以独立进程执行，只有 api 容器不可用时才回退
# 到一次性容器，作业语义与调度频率都不变。
DEPLOY_DIR=/opt/schedule
COMPOSE_FILE=infra/docker/compose.prod.yml
API_CONTAINER=medical-schedule-prod-api-1
LOCK_FILE=/run/lock/schedule-notifications.lock

cd "$DEPLOY_DIR"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  exit 0
fi

run_job() {
  if [ "$(docker inspect --format '{{.State.Running}}' "$API_CONTAINER" 2>/dev/null || true)" = "true" ]; then
    docker exec "$API_CONTAINER" node apps/api/dist/jobs/run-job.js "--job=$1"
    return
  fi
  docker compose --env-file .env.production -f "$COMPOSE_FILE" run --rm api \
    node apps/api/dist/jobs/run-job.js "--job=$1"
}

status=0
if ! run_job export-jobs; then
  echo "[notifications] export-jobs failed" >&2
  status=1
fi
if ! run_job duty-reminders; then
  echo "[notifications] duty-reminders failed" >&2
  status=1
fi
if ! run_job notification-retry; then
  echo "[notifications] notification-retry failed" >&2
  status=1
fi

exit "$status"
