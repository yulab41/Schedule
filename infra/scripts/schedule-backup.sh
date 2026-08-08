#!/usr/bin/env bash
set -euo pipefail

# 每日加密备份（由 /etc/cron.d/schedule-backup 触发）。
# 备份写入 api 容器的 BACKUP_DIR=/data/backups 命名卷；推送到 OSS 待配置 ossutil 后补充。
cd /opt/schedule
docker compose --env-file .env.production -f infra/docker/compose.prod.yml run --rm api \
  node apps/api/dist/jobs/run-job.js --job=database-backup
