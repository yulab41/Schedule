#!/usr/bin/env bash
# 增量更新部署：迁移先行 → 替换依赖与代码 → 重建容器 → 基本验证
# 用法：bash ecs-update.sh <dist-tar> <api-flat-tar>
set -euo pipefail

DIST_TAR="${1:?缺少 dist 压缩包路径}"
FLAT_TAR="${2:?缺少 api-flat 压缩包路径}"
DEPLOY_DIR="/opt/schedule"
BACKUP_SUFFIX=".old-$(date +%Y%m%d%H%M%S)"
COMPOSE_FILES=(-f infra/docker/compose.prod.yml)
if [ -f infra/docker/compose.prod.icp-test.yml ]; then
  COMPOSE_FILES+=(-f infra/docker/compose.prod.icp-test.yml)
fi

cd "$DEPLOY_DIR"

echo "[deploy] 1/6 解压迁移文件（迁移先行）"
tar -xzf "$DIST_TAR" -C "$DEPLOY_DIR" migrations

echo "[deploy] 2/6 替换 API 平铺依赖树（保留旧树备份）"
rm -rf "$DEPLOY_DIR/runtime/api-flat-new"
mkdir -p "$DEPLOY_DIR/runtime/api-flat-new"
tar -xzf "$FLAT_TAR" -C "$DEPLOY_DIR/runtime/api-flat-new"
if [ -d "$DEPLOY_DIR/runtime/api-flat/node_modules" ]; then
  mv "$DEPLOY_DIR/runtime/api-flat/node_modules" \
    "$DEPLOY_DIR/runtime/api-flat/node_modules$BACKUP_SUFFIX"
fi
mv "$DEPLOY_DIR/runtime/api-flat-new/node_modules" "$DEPLOY_DIR/runtime/api-flat/node_modules"
rmdir "$DEPLOY_DIR/runtime/api-flat-new"

echo "[deploy] 3/6 容器内执行数据库迁移（先迁移线上库）"
docker compose --env-file .env.production -f infra/docker/compose.prod.yml \
  run --rm api node apps/api/dist/migrate.js

echo "[deploy] 4/6 替换应用 dist"
tar -xzf "$DIST_TAR" -C "$DEPLOY_DIR" \
  apps/web/dist \
  apps/api/dist \
  packages/contracts/dist \
  packages/database/dist \
  packages/scheduling-domain/dist

echo "[deploy] 5/6 重建 api/web 容器"
docker compose --env-file .env.production "${COMPOSE_FILES[@]}" \
  up -d --force-recreate api web

echo "[deploy] 6/6 基本验证"
curl -s -o /dev/null -w 'self-test api health: %{http_code}\n' \
  http://127.0.0.1:8080/api/health
curl -s http://127.0.0.1:8080/api/health
echo
if docker exec medical-schedule-prod-api-1 \
  ls /app/apps/api/node_modules/@cloudbase >/dev/null 2>&1; then
  echo "[deploy] 错误：依赖树仍含 @cloudbase"
  exit 1
fi
echo "[deploy] 依赖树无 @cloudbase"
