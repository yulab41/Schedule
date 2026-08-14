#!/usr/bin/env bash
# Deployment verification: domain-only ingress, release hashes, containers and migrations.
set -Eeuo pipefail

DEPLOY_DIR="/opt/schedule"
COMPOSE_FILE="$DEPLOY_DIR/infra/docker/compose.prod.yml"
DOMAIN="hosp.schedule.eylinhome.top"
UNKNOWN_HOST="unknown.invalid"
PUBLIC_HOST="${ECS_PUBLIC_IP:-}"

manifest_value() {
  local key="$1"
  sed -nE "s/.*\"${key}\"[[:space:]]*:[[:space:]]*\"([^\"]+)\".*/\1/p" \
    "$DEPLOY_DIR/deploy-manifest.json" | head -1
}

tree_sha256() {
  local root="$1"
  local root_prefix="${root#"$DEPLOY_DIR/"}"
  LC_ALL=C find "$root" -type f -printf '%P\0' | LC_ALL=C sort -z | while IFS= read -r -d '' relative_path; do
    local file_hash
    file_hash="$(sha256sum "$root/$relative_path" | awk '{print $1}')"
    printf '%s\0%s\0' "$root_prefix/$relative_path" "$file_hash"
  done | sha256sum | awk '{print $1}'
}

compose() {
  docker compose --env-file "$DEPLOY_DIR/.env.production" -f "$COMPOSE_FILE" "$@"
}

domain_curl() {
  curl -kfsS --max-time 5 --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}$1"
}

status_for_http_host() {
  local host="$1"
  curl -ksS --max-time 5 -o /dev/null -w '%{http_code}' -H "Host: $host" \
    http://127.0.0.1/ || true
}

status_for_https_host() {
  local host="$1"
  curl -ksS --max-time 5 -o /dev/null -w '%{http_code}' \
    --resolve "${host}:443:127.0.0.1" "https://${host}/" || true
}

assert_rejected() {
  local label="$1"
  local status="$2"
  if [[ "$status" =~ ^2[0-9][0-9]$ ]]; then
    echo "[verify] 错误：$label 返回了项目成功响应（HTTP $status）。" >&2
    exit 1
  fi
  echo "[verify] $label 已拒绝（HTTP ${status:-000}）"
}

cd "$DEPLOY_DIR"

if [[ -f infra/docker/compose.prod.icp-test.yml ]]; then
  echo "[verify] 错误：发现已停用的 ICP 测试 Compose override。" >&2
  exit 1
fi
if grep -Eq '^[[:space:]]*AUTH_DEV_MODE[[:space:]]*=[[:space:]]*true([[:space:]]*|$)' .env.production; then
  echo "[verify] 错误：生产配置启用了 AUTH_DEV_MODE。" >&2
  exit 1
fi

if ! grep -Eq '^[[:space:]]*AUTH_PASSWORD_ENABLED[[:space:]]*=[[:space:]]*true([[:space:]]*|$)' .env.production; then
  echo "[verify] 错误：生产配置没有启用 AUTH_PASSWORD_ENABLED。" >&2
  exit 1
fi
if grep -Eq '^[[:space:]]*WECHAT_MOCK_MODE[[:space:]]*=[[:space:]]*true([[:space:]]*|$)' .env.production; then
  echo "[verify] 错误：生产配置启用了 WECHAT_MOCK_MODE。" >&2
  exit 1
fi
grep -Eq 'listen 80 default_server;' infra/docker/nginx.prod.conf
grep -A4 -E 'listen 80 default_server;' infra/docker/nginx.prod.conf | grep -q 'return 444;'
grep -Eq 'listen 443 ssl default_server;' infra/docker/nginx.prod.conf
grep -A4 -E 'listen 443 ssl default_server;' infra/docker/nginx.prod.conf | grep -q 'ssl_reject_handshake on;'
grep -q "server_name $DOMAIN;" infra/docker/nginx.prod.conf

echo "[verify] production domain health"
domain_curl /api/health
echo
domain_curl / | grep -q 'assets/'

echo "[verify] unknown Host and IP ingress are not project routes"
assert_rejected "unknown HTTP Host" "$(status_for_http_host "$UNKNOWN_HOST")"
assert_rejected "unknown HTTPS Host" "$(status_for_https_host "$UNKNOWN_HOST")"
if [[ -n "$PUBLIC_HOST" ]]; then
  assert_rejected "public IP HTTP Host" "$(status_for_http_host "$PUBLIC_HOST")"
  assert_rejected "public IP HTTPS Host" "$(status_for_https_host "$PUBLIC_HOST")"
else
  echo "[verify] 未设置 ECS_PUBLIC_IP，跳过公网 IP 主动探测（可用 ECS_PUBLIC_IP=... 重跑）。"
fi

echo "[verify] public listener ports"
listeners="$(ss -lntH 2>/dev/null || true)"
for port in 8080 3000 3001 3306 3307; do
  if printf '%s\n' "$listeners" | grep -Eq ":${port}[[:space:]]"; then
    echo "[verify] 错误：检测到公网监听端口 $port。" >&2
    exit 1
  fi
done
echo "[verify] only shared gateway ports may be public"

if [ ! -f "$DEPLOY_DIR/deploy-manifest.json" ]; then
  echo "[verify] 错误：缺少部署清单。" >&2
  exit 1
fi

RELEASE_ID="$(manifest_value releaseId)"
AUTH_MODE="$(manifest_value authMode)"
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
EXPECTED_NOTIFICATION_SCHEDULER_SHA="$(manifest_value notificationSchedulerSha256)"
CURRENT_RELEASE="$(cat "$DEPLOY_DIR/current-release" 2>/dev/null || true)"
if [ "$AUTH_MODE" != "production" ]; then
  echo "[verify] 错误：发布清单不是 production 认证模式。" >&2
  exit 1
fi
if [ "$CURRENT_RELEASE" != "$RELEASE_ID" ]; then
  echo "[verify] 错误：current-release 与部署清单不一致。" >&2
  exit 1
fi
RELEASE_DIR="$DEPLOY_DIR/releases/$RELEASE_ID"

echo "[verify] release=$RELEASE_ID"
test -f "$RELEASE_DIR/schedule-dist.tar.gz"
test -f "$RELEASE_DIR/api-flat.tar.zst"
ACTUAL_DIST_SHA="$(sha256sum "$RELEASE_DIR/schedule-dist.tar.gz" | awk '{print $1}')"
ACTUAL_FLAT_SHA="$(sha256sum "$RELEASE_DIR/api-flat.tar.zst" | awk '{print $1}')"
[ "$ACTUAL_DIST_SHA" = "$EXPECTED_DIST_SHA" ]
[ "$ACTUAL_FLAT_SHA" = "$EXPECTED_FLAT_SHA" ]

ACTUAL_COMPOSE_SHA="$(sha256sum "$COMPOSE_FILE" | awk '{print $1}')"
ACTUAL_NGINX_SHA="$(sha256sum "$DEPLOY_DIR/infra/docker/nginx.prod.conf" | awk '{print $1}')"
[ "$ACTUAL_COMPOSE_SHA" = "$EXPECTED_COMPOSE_SHA" ]
[ "$ACTUAL_NGINX_SHA" = "$EXPECTED_NGINX_SHA" ]
[ "$(sha256sum "$DEPLOY_DIR/pnpm-lock.yaml" | awk '{print $1}')" = "$EXPECTED_LOCKFILE_SHA" ]
[ "$(tree_sha256 "$DEPLOY_DIR/apps/web/dist")" = "$EXPECTED_WEB_SHA" ]
[ "$(tree_sha256 "$DEPLOY_DIR/apps/api/dist")" = "$EXPECTED_API_SHA" ]
[ "$(tree_sha256 "$DEPLOY_DIR/packages/contracts/dist")" = "$EXPECTED_CONTRACTS_SHA" ]
[ "$(tree_sha256 "$DEPLOY_DIR/packages/database/dist")" = "$EXPECTED_DATABASE_SHA" ]
[ "$(tree_sha256 "$DEPLOY_DIR/packages/scheduling-domain/dist")" = "$EXPECTED_DOMAIN_SHA" ]
[ "$(tree_sha256 "$DEPLOY_DIR/migrations")" = "$EXPECTED_MIGRATIONS_SHA" ]
ACTUAL_NOTIFICATION_SCHEDULER_SHA="$(sha256sum "$DEPLOY_DIR/infra/scripts/schedule-notifications.sh" | awk '{print $1}')"
[ "$ACTUAL_NOTIFICATION_SCHEDULER_SHA" = "$EXPECTED_NOTIFICATION_SCHEDULER_SHA" ]
echo "[verify] artifact hashes match"

for required_path in \
  "$DEPLOY_DIR/apps/api/dist/local-server.js" \
  "$DEPLOY_DIR/apps/web/dist/index.html" \
  "$DEPLOY_DIR/packages/contracts/dist/index.js" \
  "$DEPLOY_DIR/packages/database/dist/index.js" \
  "$DEPLOY_DIR/packages/scheduling-domain/dist/index.js"; do
  test -f "$required_path"
  sha256sum "$required_path"
done

echo "[verify] containers"
compose ps

echo "[verify] no retired local-auth records"
if docker exec medical-schedule-prod-mysql-1 sh -c \
  'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -D "$MYSQL_DATABASE" \
    -e "SELECT COUNT(*) FROM users WHERE cloudbase_uid IN (\"local-admin\", \"local-member\")"' | grep -Eq '[1-9]'; then
  echo "[verify] 错误：发现 local-admin/local-member 生产初始化记录。" >&2
  exit 1
fi

echo "[verify] no @cloudbase"
if docker exec medical-schedule-prod-api-1 ls /app/apps/api/node_modules/@cloudbase >/dev/null 2>&1; then
  echo "[verify] 错误：依赖树仍含 @cloudbase。" >&2
  exit 1
fi

echo "[verify] migration count"
docker exec medical-schedule-prod-mysql-1 sh -c \
  'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -D "$MYSQL_DATABASE" \
    -e "SELECT COUNT(*) FROM __drizzle_migrations"' | grep -qx '36'
echo "[verify] complete"
