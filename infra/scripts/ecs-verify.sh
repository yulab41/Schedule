#!/usr/bin/env bash
# Deployment verification: health, release hashes, frontend assets, containers and migrations.
set -Eeuo pipefail

DEPLOY_DIR="/opt/schedule"
COMPOSE_FILES=(-f "$DEPLOY_DIR/infra/docker/compose.prod.yml")
if [ -f "$DEPLOY_DIR/infra/docker/compose.prod.icp-test.yml" ]; then
  COMPOSE_FILES+=(-f "$DEPLOY_DIR/infra/docker/compose.prod.icp-test.yml")
fi

manifest_value() {
  local key="$1"
  sed -nE "s/.*\"${key}\"[[:space:]]*:[[:space:]]*\"([^\"]+)\".*/\1/p" "$DEPLOY_DIR/deploy-manifest.json" | head -1
}

tree_sha256() {
  local root="$1"
  local root_prefix="${root#"$DEPLOY_DIR/"}"
  find "$root" -type f -printf '%P\0' | sort -z | while IFS= read -r -d '' relative_path; do
    local file_hash
    file_hash="$(sha256sum "$root/$relative_path" | awk '{print $1}')"
    printf '%s\0%s\0' "$root_prefix/$relative_path" "$file_hash"
  done | sha256sum | awk '{print $1}'
}

compose() {
  docker compose --env-file "$DEPLOY_DIR/.env.production" "${COMPOSE_FILES[@]}" "$@"
}

echo "[verify] api health through Nginx (127.0.0.1:80)"
curl -fsS -o /dev/null -w 'http=%{http_code}\n' http://127.0.0.1/api/health
curl -fsS http://127.0.0.1/api/health
echo

echo "[verify] api health with production Host header"
curl -fsS -o /dev/null -w 'http=%{http_code}\n' \
  -H 'Host: hosp.schedule.eylinhome.top' http://127.0.0.1/api/health

if [ ! -f "$DEPLOY_DIR/deploy-manifest.json" ]; then
  echo "[verify] 错误：缺少部署清单。" >&2
  exit 1
fi

RELEASE_ID="$(manifest_value releaseId)"
EXPECTED_DIST_SHA="$(manifest_value distArchiveSha256)"
EXPECTED_FLAT_SHA="$(manifest_value apiRuntimeArchiveSha256)"
EXPECTED_LOCKFILE_SHA="$(manifest_value lockfileSha256)"
EXPECTED_WEB_SHA="$(manifest_value webDistTreeSha256)"
EXPECTED_API_SHA="$(manifest_value apiDistTreeSha256)"
EXPECTED_CONTRACTS_SHA="$(manifest_value contractsDistTreeSha256)"
EXPECTED_DATABASE_SHA="$(manifest_value databaseDistTreeSha256)"
EXPECTED_DOMAIN_SHA="$(manifest_value schedulingDomainDistTreeSha256)"
EXPECTED_MIGRATIONS_SHA="$(manifest_value migrationsTreeSha256)"
EXPECTED_COMPOSE_SHA="$(manifest_value composeProdSha256)"
EXPECTED_NGINX_SHA="$(manifest_value nginxConfigSha256)"
CURRENT_RELEASE="$(cat "$DEPLOY_DIR/current-release" 2>/dev/null || true)"
if [ "$CURRENT_RELEASE" != "$RELEASE_ID" ]; then
  echo "[verify] 错误：current-release 与部署清单不一致。" >&2
  exit 1
fi
RELEASE_DIR="$DEPLOY_DIR/releases/$RELEASE_ID"

echo "[verify] release=$RELEASE_ID"
if [ ! -f "$RELEASE_DIR/schedule-dist.tar.gz" ] || [ ! -f "$RELEASE_DIR/api-flat.tar.zst" ]; then
  echo "[verify] 错误：release 归档不完整。" >&2
  exit 1
fi
ACTUAL_DIST_SHA="$(sha256sum "$RELEASE_DIR/schedule-dist.tar.gz" | awk '{print $1}')"
ACTUAL_FLAT_SHA="$(sha256sum "$RELEASE_DIR/api-flat.tar.zst" | awk '{print $1}')"
[ "$ACTUAL_DIST_SHA" = "$EXPECTED_DIST_SHA" ] || {
  echo "[verify] 错误：dist 归档哈希不一致。" >&2
  exit 1
}
[ "$ACTUAL_FLAT_SHA" = "$EXPECTED_FLAT_SHA" ] || {
  echo "[verify] 错误：API runtime 归档哈希不一致。" >&2
  exit 1
}

ACTUAL_COMPOSE_SHA="$(sha256sum "$DEPLOY_DIR/infra/docker/compose.prod.yml" | awk '{print $1}')"
ACTUAL_NGINX_SHA="$(sha256sum "$DEPLOY_DIR/infra/docker/nginx.prod.conf" | awk '{print $1}')"
[ "$ACTUAL_COMPOSE_SHA" = "$EXPECTED_COMPOSE_SHA" ] || {
  echo "[verify] 错误：Compose 配置哈希不一致。" >&2
  exit 1
}
[ "$ACTUAL_NGINX_SHA" = "$EXPECTED_NGINX_SHA" ] || {
  echo "[verify] 错误：Nginx 配置哈希不一致。" >&2
  exit 1
}
[ "$(sha256sum "$DEPLOY_DIR/pnpm-lock.yaml" | awk '{print $1}')" = "$EXPECTED_LOCKFILE_SHA" ] || {
  echo "[verify] 错误：pnpm-lock.yaml 哈希不一致。" >&2
  exit 1
}
[ "$(tree_sha256 "$DEPLOY_DIR/apps/web/dist")" = "$EXPECTED_WEB_SHA" ] || {
  echo "[verify] 错误：Web dist 哈希不一致。" >&2
  exit 1
}
[ "$(tree_sha256 "$DEPLOY_DIR/apps/api/dist")" = "$EXPECTED_API_SHA" ] || {
  echo "[verify] 错误：API dist 哈希不一致。" >&2
  exit 1
}
[ "$(tree_sha256 "$DEPLOY_DIR/packages/contracts/dist")" = "$EXPECTED_CONTRACTS_SHA" ] || {
  echo "[verify] 错误：contracts dist 哈希不一致。" >&2
  exit 1
}
[ "$(tree_sha256 "$DEPLOY_DIR/packages/database/dist")" = "$EXPECTED_DATABASE_SHA" ] || {
  echo "[verify] 错误：database dist 哈希不一致。" >&2
  exit 1
}
[ "$(tree_sha256 "$DEPLOY_DIR/packages/scheduling-domain/dist")" = "$EXPECTED_DOMAIN_SHA" ] || {
  echo "[verify] 错误：scheduling-domain dist 哈希不一致。" >&2
  exit 1
}
[ "$(tree_sha256 "$DEPLOY_DIR/migrations")" = "$EXPECTED_MIGRATIONS_SHA" ] || {
  echo "[verify] 错误：migrations 哈希不一致。" >&2
  exit 1
}
echo "[verify] artifact hashes match"
echo "[verify] compose hash: $ACTUAL_COMPOSE_SHA"
echo "[verify] nginx hash: $ACTUAL_NGINX_SHA"

echo "[verify] deployed files"
for required_path in \
  "$DEPLOY_DIR/apps/api/dist/local-server.js" \
  "$DEPLOY_DIR/apps/web/dist/index.html" \
  "$DEPLOY_DIR/packages/contracts/dist/index.js" \
  "$DEPLOY_DIR/packages/database/dist/index.js" \
  "$DEPLOY_DIR/packages/scheduling-domain/dist/index.js"; do
  if [ ! -f "$required_path" ]; then
    echo "[verify] 错误：缺少 $required_path" >&2
    exit 1
  fi
  sha256sum "$required_path"
done

echo "[verify] web index asset"
curl -fsS http://127.0.0.1/ | grep -o 'assets/index-[^" ]*\.js' | head -1

echo "[verify] containers"
compose ps

echo "[verify] cloudbase dependency"
if docker exec medical-schedule-prod-api-1 \
  ls /app/apps/api/node_modules/@cloudbase >/dev/null 2>&1; then
  echo "FAIL: @cloudbase still present" >&2
  exit 1
fi
echo "ok: no @cloudbase"

echo "[verify] migration count"
docker exec medical-schedule-prod-mysql-1 sh -c \
  'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -D "$MYSQL_DATABASE" \
    -e "SELECT COUNT(*) FROM __drizzle_migrations"'
