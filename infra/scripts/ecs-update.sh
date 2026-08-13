#!/usr/bin/env bash
# Immutable release update: verify artifacts → backup → migrate → recreate → verify.
# Usage: bash ecs-update.sh <dist-tar> <api-flat-tar-zst> <deploy-manifest>
set -Eeuo pipefail

DIST_TAR="${1:?缺少 dist 压缩包路径}"
FLAT_TAR="${2:?缺少 api-flat 压缩包路径}"
MANIFEST="${3:?缺少部署清单路径}"
DEPLOY_DIR="/opt/schedule"
COMPOSE_FILES=(-f infra/docker/compose.prod.yml)
if [ -f infra/docker/compose.prod.icp-test.yml ]; then
  COMPOSE_FILES+=(-f infra/docker/compose.prod.icp-test.yml)
fi

fail() {
  echo "[deploy] 错误：$*" >&2
  return 1
}

manifest_value() {
  local key="$1"
  sed -nE "s/.*\"${key}\"[[:space:]]*:[[:space:]]*\"([^\"]+)\".*/\1/p" "$MANIFEST" | head -1
}

compose() {
  docker compose --env-file .env.production "${COMPOSE_FILES[@]}" "$@"
}

assert_release_path() {
  local path="$1"
  case "$path" in
    "$DEPLOY_DIR"/*) ;;
    *) fail "路径越界：$path" ;;
  esac
}

if [ ! -f "$DIST_TAR" ] || [ ! -f "$FLAT_TAR" ] || [ ! -f "$MANIFEST" ]; then
  fail "部署输入文件不存在。"
fi

cd "$DEPLOY_DIR"
RELEASE_ID="$(manifest_value releaseId)"
EXPECTED_DIST_SHA="$(manifest_value distArchiveSha256)"
EXPECTED_FLAT_SHA="$(manifest_value apiRuntimeArchiveSha256)"
if [[ ! "$RELEASE_ID" =~ ^[0-9a-f]{40}$ ]]; then
  fail "部署清单中的 releaseId 无效。"
fi
if [[ ! "$EXPECTED_DIST_SHA" =~ ^[0-9a-f]{64}$ ]] || [[ ! "$EXPECTED_FLAT_SHA" =~ ^[0-9a-f]{64}$ ]]; then
  fail "部署清单中的产物哈希无效。"
fi

ACTUAL_DIST_SHA="$(sha256sum "$DIST_TAR" | awk '{print $1}')"
ACTUAL_FLAT_SHA="$(sha256sum "$FLAT_TAR" | awk '{print $1}')"
[ "$ACTUAL_DIST_SHA" = "$EXPECTED_DIST_SHA" ] || fail "dist 压缩包哈希与部署清单不一致。"
[ "$ACTUAL_FLAT_SHA" = "$EXPECTED_FLAT_SHA" ] || fail "API runtime 压缩包哈希与部署清单不一致。"

RELEASE_DIR="$DEPLOY_DIR/releases/$RELEASE_ID"
BACKUP_DIR="$RELEASE_DIR/previous"
CURRENT_MANIFEST="$DEPLOY_DIR/deploy-manifest.json"
assert_release_path "$RELEASE_DIR"
assert_release_path "$BACKUP_DIR"
assert_release_path "$CURRENT_MANIFEST"
mkdir -p "$BACKUP_DIR"
cp "$DIST_TAR" "$RELEASE_DIR/schedule-dist.tar.gz"
cp "$FLAT_TAR" "$RELEASE_DIR/api-flat.tar.zst"
cp "$MANIFEST" "$RELEASE_DIR/deploy-manifest.json"

BACKUP_ENTRIES=()
for relative_path in \
  apps/web/dist \
  apps/api/dist \
  packages/contracts/dist \
  packages/database/dist \
  packages/scheduling-domain/dist \
  migrations \
  pnpm-lock.yaml \
  infra/docker/compose.prod.yml \
  infra/docker/nginx.prod.conf \
  runtime/api-flat/node_modules \
  deploy-manifest.json; do
  if [ -e "$DEPLOY_DIR/$relative_path" ]; then
    BACKUP_ENTRIES+=("$relative_path")
  fi
done
if [ "${#BACKUP_ENTRIES[@]}" -gt 0 ]; then
  tar -czf "$BACKUP_DIR/current-files.tar.gz" -C "$DEPLOY_DIR" "${BACKUP_ENTRIES[@]}"
fi

restore_previous() {
  if [ ! -f "$BACKUP_DIR/current-files.tar.gz" ]; then
    echo "[deploy] 没有可用的应用文件备份，无法自动恢复。" >&2
    return 1
  fi
  for relative_path in \
    apps/web/dist \
    apps/api/dist \
    packages/contracts/dist \
    packages/database/dist \
    packages/scheduling-domain/dist \
    migrations \
    pnpm-lock.yaml \
    infra/docker/compose.prod.yml \
    infra/docker/nginx.prod.conf \
    runtime/api-flat/node_modules \
    deploy-manifest.json; do
    assert_release_path "$DEPLOY_DIR/$relative_path"
    rm -rf "$DEPLOY_DIR/$relative_path"
  done
  tar -xzf "$BACKUP_DIR/current-files.tar.gz" -C "$DEPLOY_DIR"
}

rollback_on_error() {
  local status=$?
  trap - ERR
  echo "[deploy] 发布失败，开始恢复上一版应用文件。" >&2
  if restore_previous; then
    compose up -d --force-recreate api web || true
    curl -fsS http://127.0.0.1/api/health >/dev/null || true
  fi
  exit "$status"
}
trap rollback_on_error ERR

echo "[deploy] 1/7 校验并保留 release $RELEASE_ID"
echo "[deploy] 2/7 解压迁移和应用产物"
tar -xzf "$DIST_TAR" -C "$DEPLOY_DIR" \
  migrations \
  apps/web/dist \
  apps/api/dist \
  packages/contracts/dist \
  packages/database/dist \
  packages/scheduling-domain/dist \
  pnpm-lock.yaml \
  infra/docker/compose.prod.yml \
  infra/docker/nginx.prod.conf
cp "$MANIFEST" "$CURRENT_MANIFEST"

echo "[deploy] 3/7 替换 API 平铺依赖树"
rm -rf "$DEPLOY_DIR/runtime/api-flat-new"
mkdir -p "$DEPLOY_DIR/runtime/api-flat-new"
  tar --zstd -xf "$FLAT_TAR" -C "$DEPLOY_DIR/runtime/api-flat-new"
if [ ! -d "$DEPLOY_DIR/runtime/api-flat-new/node_modules" ]; then
  fail "API runtime 压缩包缺少 node_modules。"
fi
rm -rf "$DEPLOY_DIR/runtime/api-flat/node_modules"
mv "$DEPLOY_DIR/runtime/api-flat-new/node_modules" "$DEPLOY_DIR/runtime/api-flat/node_modules"
rmdir "$DEPLOY_DIR/runtime/api-flat-new"

echo "[deploy] 4/7 容器内执行数据库迁移"
compose run --rm api node apps/api/dist/migrate.js

echo "[deploy] 5/7 重建 api/web 容器"
compose up -d --force-recreate api web

echo "[deploy] 6/7 健康检查和依赖检查"
curl -fsS http://127.0.0.1/api/health
echo
if docker exec medical-schedule-prod-api-1 \
  ls /app/apps/api/node_modules/@cloudbase >/dev/null 2>&1; then
  fail "依赖树仍含 @cloudbase。"
fi

echo "[deploy] 7/7 写入当前 release"
printf '%s\n' "$RELEASE_ID" > "$DEPLOY_DIR/current-release"
trap - ERR
echo "[deploy] 发布成功：$RELEASE_ID"
