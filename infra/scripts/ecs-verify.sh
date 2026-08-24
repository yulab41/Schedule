#!/usr/bin/env bash
# Deployment verification: domain-only ingress, release hashes, containers and migrations.
set -Eeuo pipefail

DEPLOY_DIR="/opt/schedule"
COMPOSE_FILE="$DEPLOY_DIR/infra/docker/compose.prod.yml"
DOMAIN="hosp.schedule.eylinhome.top"
UNKNOWN_HOST="unknown.invalid"
PUBLIC_HOST="${ECS_PUBLIC_IP:-}"
P6_RELEASE_FEATURE_LEVEL="p6-client-capabilities-v1"
CONTROL_PLANE_MANIFEST="/usr/local/lib/schedule/control-plane-manifest.json"

manifest_value() {
  local key="$1"
  sed -nE "s/.*\"${key}\"[[:space:]]*:[[:space:]]*\"([^\"]+)\".*/\1/p" \
    "$DEPLOY_DIR/deploy-manifest.json" | head -1
}

control_manifest_value() {
  local key="$1"
  sed -nE "s/.*\"${key}\"[[:space:]]*:[[:space:]]*\"([^\"]+)\".*/\\1/p" \
    "$CONTROL_PLANE_MANIFEST" | head -1
}

env_value() {
  local key="$1"
  sed -nE "s/^${key}=([^[:space:]]+)$/\\1/p" "$DEPLOY_DIR/.env.production" | head -1
}

require_single_env_value() {
  local key="$1"
  local count
  count="$(grep -Ec "^${key}=[^[:space:]]+$" "$DEPLOY_DIR/.env.production" || true)"
  if [ "$count" != "1" ]; then
    echo "[verify] 错误：生产配置必须且只能包含一条 ${key}。" >&2
    exit 1
  fi
}

is_valid_client_version() {
  local version="$1"
  local pattern='^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-(0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(\.(0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$'
  [ "${#version}" -le 64 ] && [[ "$version" =~ $pattern ]]
}

is_valid_client_version_list() {
  local list="$1"
  [ -n "$list" ] && [[ "$list" != ,* ]] && [[ "$list" != *, ]] && [[ "$list" != *,,* ]] ||
    return 1
  local -a versions=()
  IFS=',' read -r -a versions <<< "$list"
  declare -A seen_versions=()
  local version
  for version in "${versions[@]}"; do
    is_valid_client_version "$version" || return 1
    [ -z "${seen_versions[$version]+present}" ] || return 1
    seen_versions["$version"]=1
  done
}

validate_client_version_configuration() {
  local supported="$1"
  local legacy="$2"
  is_valid_client_version "$legacy" || return 1
  is_valid_client_version_list "$supported" || return 1
  case ",$supported," in
    *",$legacy,"*) return 0 ;;
    *) return 1 ;;
  esac
}

validate_miniprogram_capability_config() {
  local env_owner env_mode
  env_owner="$(stat -c '%u' "$DEPLOY_DIR/.env.production")"
  env_mode="$(stat -c '%a' "$DEPLOY_DIR/.env.production")"
  if [ "$env_owner" != "0" ] || [ "$env_mode" != "600" ]; then
    echo "[verify] 错误：生产配置必须由 root 所有且权限为 0600。" >&2
    exit 1
  fi
  require_single_env_value MINIPROGRAM_SUPPORTED_CLIENT_VERSIONS
  require_single_env_value MINIPROGRAM_LEGACY_CLIENT_VERSION
  local supported legacy key value
  supported="$(env_value MINIPROGRAM_SUPPORTED_CLIENT_VERSIONS)"
  legacy="$(env_value MINIPROGRAM_LEGACY_CLIENT_VERSION)"
  if ! validate_client_version_configuration "$supported" "$legacy"; then
    echo "[verify] 错误：Mini Program client version 配置无效、重复或不满足 semver-like≤64。" >&2
    exit 1
  fi
  for key in \
    MINIPROGRAM_CAPABILITY_GLOBAL_ENABLED \
    MINIPROGRAM_CAPABILITY_CORE_ENABLED \
    MINIPROGRAM_CAPABILITY_WORKFLOWS_ENABLED \
    MINIPROGRAM_CAPABILITY_ORGANIZATION_ENABLED \
    MINIPROGRAM_CAPABILITY_INSIGHTS_ENABLED \
    MINIPROGRAM_CAPABILITY_EXTERNAL_MESSAGES_ENABLED \
    MINIPROGRAM_CAPABILITY_GUEST_ENABLED; do
    require_single_env_value "$key"
    value="$(env_value "$key")"
    case "$value" in
      true|false) ;;
      *) echo "[verify] 错误：${key} 必须是 true 或 false。" >&2; exit 1 ;;
    esac
  done
}

tree_sha256_entries() {
  local root="$1"
  local root_prefix="$2"
  local relative_root="$3"
  local current_root="$root"
  if [ -n "$relative_root" ]; then
    current_root="$root/$relative_root"
  fi

  while IFS= read -r -d '' entry_name; do
    local relative_path="${relative_root:+$relative_root/}$entry_name"
    if [ -d "$root/$relative_path" ]; then
      tree_sha256_entries "$root" "$root_prefix" "$relative_path"
    elif [ -f "$root/$relative_path" ]; then
      local file_hash
      file_hash="$(sha256sum "$root/$relative_path" | awk '{print $1}')"
      printf '%s\0%s\0' "$root_prefix/$relative_path" "$file_hash"
    fi
  done < <(LC_ALL=C find "$current_root" -mindepth 1 -maxdepth 1 -printf '%f\0' | LC_ALL=C sort -z)
}

tree_sha256() {
  local root="$1"
  local root_prefix="${root#"$DEPLOY_DIR/"}"
  tree_sha256_entries "$root" "$root_prefix" '' | sha256sum | awk '{print $1}'
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

verify_miniprogram_capabilities() {
  local version response global core workflows organization insights external_messages guest unknown_status
  version="$(env_value MINIPROGRAM_LEGACY_CLIENT_VERSION)"
  global="$(env_value MINIPROGRAM_CAPABILITY_GLOBAL_ENABLED)"
  core="$(env_value MINIPROGRAM_CAPABILITY_CORE_ENABLED)"
  workflows="$(env_value MINIPROGRAM_CAPABILITY_WORKFLOWS_ENABLED)"
  organization="$(env_value MINIPROGRAM_CAPABILITY_ORGANIZATION_ENABLED)"
  insights="$(env_value MINIPROGRAM_CAPABILITY_INSIGHTS_ENABLED)"
  external_messages="$(env_value MINIPROGRAM_CAPABILITY_EXTERNAL_MESSAGES_ENABLED)"
  guest="$(env_value MINIPROGRAM_CAPABILITY_GUEST_ENABLED)"
  response="$(curl -kfsS --max-time 5 --get --resolve "${DOMAIN}:443:127.0.0.1" \
    --data-urlencode 'platform=miniprogram' --data-urlencode "version=$version" \
    "https://${DOMAIN}/api/client-capabilities")"

  printf '%s' "$response" | compose exec -T api node -e '
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { input += chunk; });
    process.stdin.on("end", () => {
      const [version, globalRaw, coreRaw, workflowsRaw, organizationRaw, insightsRaw, externalRaw, guestRaw] = process.argv.slice(1);
      const enabled = (value) => value === "true";
      const global = enabled(globalRaw);
      const expected = {
        platform: "miniprogram",
        version,
        global,
        core: global && enabled(coreRaw),
        workflows: global && enabled(workflowsRaw),
        organization: global && enabled(organizationRaw),
        insights: global && enabled(insightsRaw),
        externalMessages: global && enabled(externalRaw),
        guest: global && enabled(guestRaw),
      };
      const actual = JSON.parse(input);
      const keys = Object.keys(expected).sort();
      if (JSON.stringify(Object.keys(actual).sort()) !== JSON.stringify(keys)
        || !keys.every((key) => actual[key] === expected[key])) {
        throw new Error("effective capability response mismatch");
      }
    });
  ' "$version" "$global" "$core" "$workflows" "$organization" "$insights" \
    "$external_messages" "$guest"

  unknown_status="$(curl -ksS --max-time 5 --get -o /dev/null -w '%{http_code}' \
    --resolve "${DOMAIN}:443:127.0.0.1" --data-urlencode 'platform=miniprogram' \
    --data-urlencode 'version=9.9.9-p6.unsupported' \
    "https://${DOMAIN}/api/client-capabilities" || true)"
  if [ "$unknown_status" != "426" ]; then
    echo "[verify] 错误：未知小程序版本应返回 HTTP 426，实际为 ${unknown_status:-000}。" >&2
    exit 1
  fi
  echo "[verify] Mini Program capability contract and unknown-version rejection match"
}

verify_installed_control_plane() {
  if [ ! -f "$CONTROL_PLANE_MANIFEST" ]; then
    return 1
  fi
  local backup_sha update_sha verify_sha rollback_sha capability_sha privacy_sha
  backup_sha="$(control_manifest_value backupSchedulerSha256)"
  update_sha="$(control_manifest_value ecsUpdateSha256)"
  verify_sha="$(control_manifest_value ecsVerifySha256)"
  rollback_sha="$(control_manifest_value ecsRollbackSha256)"
  capability_sha="$(control_manifest_value clientCapabilitySwitchSha256)"
  privacy_sha="$(control_manifest_value privacyRetentionSchedulerSha256)"
  for expected_hash in "$backup_sha" "$update_sha" "$verify_sha" "$rollback_sha" "$capability_sha"; do
    [[ "$expected_hash" =~ ^[0-9a-f]{64}$ ]] || return 1
  done
  [ "$(sha256sum /usr/local/lib/schedule/schedule-backup.sh | awk '{print $1}')" = "$backup_sha" ] || return 1
  [ "$(sha256sum /usr/local/lib/schedule/ecs-update.sh | awk '{print $1}')" = "$update_sha" ] || return 1
  [ "$(sha256sum /usr/local/lib/schedule/ecs-verify.sh | awk '{print $1}')" = "$verify_sha" ] || return 1
  [ "$(sha256sum /usr/local/bin/schedule-ecs-rollback | awk '{print $1}')" = "$rollback_sha" ] || return 1
  [ "$(sha256sum /usr/local/bin/schedule-client-capability | awk '{print $1}')" = "$capability_sha" ] || return 1
  if [ -n "$privacy_sha" ]; then
    [[ "$privacy_sha" =~ ^[0-9a-f]{64}$ ]] || return 1
    [ "$(sha256sum /usr/local/lib/schedule/schedule-privacy-retention.sh | awk '{print $1}')" = "$privacy_sha" ] || return 1
  fi
  local installed_path
  for installed_path in \
    /usr/local/lib/schedule/schedule-backup.sh \
    /usr/local/lib/schedule/ecs-update.sh \
    /usr/local/lib/schedule/ecs-verify.sh \
    /usr/local/bin/schedule-ecs-rollback \
    /usr/local/bin/schedule-client-capability \
    "$CONTROL_PLANE_MANIFEST"; do
    [ -f "$installed_path" ] || return 1
    [ "$(stat -c '%u' "$installed_path")" = "0" ] || return 1
    if find "$installed_path" -perm /022 -print -quit | grep -q .; then
      return 1
    fi
  done
  if [ -n "$privacy_sha" ]; then
    [ -f /usr/local/lib/schedule/schedule-privacy-retention.sh ] || return 1
    [ "$(stat -c '%u' /usr/local/lib/schedule/schedule-privacy-retention.sh)" = "0" ] || return 1
    if find /usr/local/lib/schedule/schedule-privacy-retention.sh -perm /022 -print -quit | grep -q .; then
      return 1
    fi
  fi
  echo "[verify] installed forward-only control plane matches its own manifest"
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
RELEASE_FEATURE_LEVEL="$(manifest_value releaseFeatureLevel)"
EXPECTED_DATABASE_SCHEMA_MIN="$(manifest_value databaseSchemaMin)"
EXPECTED_DATABASE_SCHEMA_MAX="$(manifest_value databaseSchemaMax)"
AUTH_MODE="$(manifest_value authMode)"
EXPECTED_DIST_SHA="$(manifest_value distArchiveSha256)"
EXPECTED_FLAT_SHA="$(manifest_value apiRuntimeArchiveSha256)"
EXPECTED_LOCKFILE_SHA="$(manifest_value lockfileSha256)"
EXPECTED_WEB_SHA="$(manifest_value webDistTreeSha256)"
EXPECTED_API_SHA="$(manifest_value apiDistTreeSha256)"
EXPECTED_CONTRACTS_SHA="$(manifest_value contractsDistTreeSha256)"
EXPECTED_DATABASE_SHA="$(manifest_value databaseDistTreeSha256)"
EXPECTED_DOMAIN_SHA="$(manifest_value schedulingDomainDistTreeSha256)"
EXPECTED_INFRA_SCRIPTS_SHA="$(manifest_value infraScriptsDistTreeSha256)"
EXPECTED_MIGRATIONS_SHA="$(manifest_value migrationsTreeSha256)"
EXPECTED_COMPOSE_SHA="$(manifest_value composeProdSha256)"
EXPECTED_NGINX_SHA="$(manifest_value nginxConfigSha256)"
EXPECTED_NOTIFICATION_SCHEDULER_SHA="$(manifest_value notificationSchedulerSha256)"
EXPECTED_BACKUP_SCHEDULER_SHA="$(manifest_value backupSchedulerSha256)"
EXPECTED_PRIVACY_RETENTION_SCHEDULER_SHA="$(manifest_value privacyRetentionSchedulerSha256)"
EXPECTED_ECS_UPDATE_SHA="$(manifest_value ecsUpdateSha256)"
EXPECTED_ECS_VERIFY_SHA="$(manifest_value ecsVerifySha256)"
EXPECTED_ECS_ROLLBACK_SHA="$(manifest_value ecsRollbackSha256)"
EXPECTED_CAPABILITY_SWITCH_SHA="$(manifest_value clientCapabilitySwitchSha256)"
CURRENT_RELEASE="$(cat "$DEPLOY_DIR/current-release" 2>/dev/null || true)"
if [ -z "$EXPECTED_DATABASE_SCHEMA_MIN" ] && [ -z "$EXPECTED_DATABASE_SCHEMA_MAX" ]; then
  EXPECTED_DATABASE_SCHEMA_MIN="0"
  EXPECTED_DATABASE_SCHEMA_MAX="49"
fi
if [[ ! "$EXPECTED_DATABASE_SCHEMA_MIN" =~ ^[0-9]+$ ]] ||
  [[ ! "$EXPECTED_DATABASE_SCHEMA_MAX" =~ ^[0-9]+$ ]] ||
  [ "$EXPECTED_DATABASE_SCHEMA_MIN" -gt "$EXPECTED_DATABASE_SCHEMA_MAX" ]; then
  echo "[verify] 错误：release database schema 兼容范围无效。" >&2
  exit 1
fi
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
[ "$(tree_sha256 "$DEPLOY_DIR/infra/scripts/dist")" = "$EXPECTED_INFRA_SCRIPTS_SHA" ]
[ "$(tree_sha256 "$DEPLOY_DIR/migrations")" = "$EXPECTED_MIGRATIONS_SHA" ]
ACTUAL_NOTIFICATION_SCHEDULER_SHA="$(sha256sum "$DEPLOY_DIR/infra/scripts/schedule-notifications.sh" | awk '{print $1}')"
[ "$ACTUAL_NOTIFICATION_SCHEDULER_SHA" = "$EXPECTED_NOTIFICATION_SCHEDULER_SHA" ]
DEPLOY_HAS_CAPABILITY_CONTROL="false"
if [ -f "$DEPLOY_DIR/infra/scripts/client-capability-switch.sh" ]; then
  DEPLOY_HAS_CAPABILITY_CONTROL="true"
fi
if [ "$RELEASE_FEATURE_LEVEL" = "$P6_RELEASE_FEATURE_LEVEL" ]; then
  [ "$DEPLOY_HAS_CAPABILITY_CONTROL" = "true" ]
  validate_miniprogram_capability_config
  for expected_hash in \
    "$EXPECTED_BACKUP_SCHEDULER_SHA" \
    "$EXPECTED_ECS_UPDATE_SHA" \
    "$EXPECTED_ECS_VERIFY_SHA" \
    "$EXPECTED_ECS_ROLLBACK_SHA" \
    "$EXPECTED_CAPABILITY_SWITCH_SHA"; do
    [[ "$expected_hash" =~ ^[0-9a-f]{64}$ ]]
  done
  [ "$(sha256sum "$DEPLOY_DIR/infra/scripts/schedule-backup.sh" | awk '{print $1}')" = "$EXPECTED_BACKUP_SCHEDULER_SHA" ]
  [ "$(sha256sum "$DEPLOY_DIR/infra/scripts/ecs-update.sh" | awk '{print $1}')" = "$EXPECTED_ECS_UPDATE_SHA" ]
  [ "$(sha256sum "$DEPLOY_DIR/infra/scripts/ecs-verify.sh" | awk '{print $1}')" = "$EXPECTED_ECS_VERIFY_SHA" ]
  [ "$(sha256sum "$DEPLOY_DIR/infra/scripts/ecs-rollback.sh" | awk '{print $1}')" = "$EXPECTED_ECS_ROLLBACK_SHA" ]
  [ "$(sha256sum "$DEPLOY_DIR/infra/scripts/client-capability-switch.sh" | awk '{print $1}')" = "$EXPECTED_CAPABILITY_SWITCH_SHA" ]
  if [ -n "$EXPECTED_PRIVACY_RETENTION_SCHEDULER_SHA" ]; then
    [[ "$EXPECTED_PRIVACY_RETENTION_SCHEDULER_SHA" =~ ^[0-9a-f]{64}$ ]]
    [ "$(sha256sum "$DEPLOY_DIR/infra/scripts/schedule-privacy-retention.sh" | awk '{print $1}')" = "$EXPECTED_PRIVACY_RETENTION_SCHEDULER_SHA" ]
  fi
elif [ -z "$RELEASE_FEATURE_LEVEL" ] && [ "$DEPLOY_HAS_CAPABILITY_CONTROL" = "false" ]; then
  echo "[verify] pre-P6 release: capability endpoint probe skipped"
else
  echo "[verify] 错误：release feature level 与 capability 控制文件不一致。" >&2
  exit 1
fi
if [ -f "$CONTROL_PLANE_MANIFEST" ]; then
  verify_installed_control_plane || {
    echo "[verify] 错误：已安装可信控制面与其独立 manifest 不一致。" >&2
    exit 1
  }
elif [ "$RELEASE_FEATURE_LEVEL" = "$P6_RELEASE_FEATURE_LEVEL" ]; then
  echo "[verify] 错误：P6 release 缺少已安装控制面 manifest。" >&2
  exit 1
fi
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

if [ "$RELEASE_FEATURE_LEVEL" = "$P6_RELEASE_FEATURE_LEVEL" ]; then
  verify_miniprogram_capabilities
fi

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
CURRENT_DATABASE_SCHEMA="$(docker exec medical-schedule-prod-mysql-1 sh -c \
  'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -D "$MYSQL_DATABASE" \
  -e "SELECT COUNT(*) FROM __drizzle_migrations"')"
if [[ ! "$CURRENT_DATABASE_SCHEMA" =~ ^[0-9]+$ ]] ||
  [ "$CURRENT_DATABASE_SCHEMA" -lt "$EXPECTED_DATABASE_SCHEMA_MIN" ] ||
  [ "$CURRENT_DATABASE_SCHEMA" -gt "$EXPECTED_DATABASE_SCHEMA_MAX" ]; then
  echo "[verify] 错误：数据库 schema $CURRENT_DATABASE_SCHEMA 不在 release 兼容范围 ${EXPECTED_DATABASE_SCHEMA_MIN}..${EXPECTED_DATABASE_SCHEMA_MAX}。" >&2
  exit 1
fi

MYSQL_PRIVACY_SETTINGS="$(docker exec medical-schedule-prod-mysql-1 sh -c \
  'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -D "$MYSQL_DATABASE" \
    -e "SELECT @@global.binlog_expire_logs_seconds, @@global.general_log"')"
[ "$MYSQL_PRIVACY_SETTINGS" = $'2592000\t0' ] || {
  echo "[verify] 错误：MySQL binlog/general log 隐私保留配置无效。" >&2
  exit 1
}

if [ "$CURRENT_DATABASE_SCHEMA" -ge 50 ]; then
  [ -f /etc/cron.d/schedule-privacy-retention ]
  grep -Fxq '*/15 * * * * root /usr/local/lib/schedule/schedule-privacy-retention.sh >> /var/log/schedule-privacy-retention.log 2>&1' /etc/cron.d/schedule-privacy-retention
  VISITOR_PRIVACY_SCHEMA="$(docker exec medical-schedule-prod-mysql-1 sh -c \
    'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -D "$MYSQL_DATABASE" \
      -e "SELECT
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = \"visitor_access_monthly_aggregates\"),
        (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = \"visitor_access_logs\" AND index_name = \"visitor_access_logs_created_idx\"),
        (SELECT COUNT(*) FROM visitor_access_logs WHERE created_at < TIMESTAMPADD(DAY, -90, CURRENT_TIMESTAMP(3))),
        (SELECT COUNT(*) FROM platform_job_runs WHERE job_name = \"privacy-retention\" AND status = \"completed\")"')"
  IFS=$'\t' read -r aggregate_table expiry_index expired_rows completed_runs <<< "$VISITOR_PRIVACY_SCHEMA"
  [ "$aggregate_table" = "1" ] && [ "$expiry_index" = "2" ] && [ "$expired_rows" = "0" ] &&
    [ "$completed_runs" -ge 1 ] || {
    echo "[verify] 错误：访客隐私表、索引、90天边界或 retention job 无效。" >&2
    exit 1
  }
fi

if [ "$CURRENT_DATABASE_SCHEMA" -ge 51 ]; then
  TELEMETRY_PRIVACY_SCHEMA="$(docker exec medical-schedule-prod-mysql-1 sh -c \
    'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -D "$MYSQL_DATABASE" \
      -e "SELECT
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = \"miniprogram_telemetry_events\"),
        (SELECT COUNT(DISTINCT index_name) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = \"miniprogram_telemetry_events\" AND index_name IN (\"miniprogram_telemetry_created_idx\", \"miniprogram_telemetry_version_page_idx\", \"miniprogram_telemetry_error_fingerprint_idx\")),
        (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = \"miniprogram_telemetry_events\" AND constraint_type = \"CHECK\" AND constraint_name IN (\"miniprogram_telemetry_error_or_performance_check\", \"miniprogram_telemetry_performance_pair_check\", \"miniprogram_telemetry_stack_requires_error_check\")),
        (SELECT COUNT(*) FROM miniprogram_telemetry_events WHERE created_at < TIMESTAMPADD(DAY, -30, CURRENT_TIMESTAMP(3))),
        (SELECT COUNT(*) FROM platform_job_runs WHERE job_name = \"privacy-retention\" AND status = \"completed\"),
        COALESCE((SELECT table_count FROM backup_archives WHERE deleted_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 1), -1)"')"
  IFS=$'\t' read -r telemetry_table telemetry_indexes telemetry_checks expired_telemetry_rows telemetry_retention_runs latest_backup_table_count <<< "$TELEMETRY_PRIVACY_SCHEMA"
  [ "$telemetry_table" = "1" ] && [ "$telemetry_indexes" = "3" ] &&
    [ "$telemetry_checks" = "3" ] && [ "$expired_telemetry_rows" = "0" ] &&
    [ "$telemetry_retention_runs" -ge 1 ] && [ "$latest_backup_table_count" = "54" ] || {
    echo "[verify] 错误：遥测表、索引、CHECK、30天边界、retention job 或备份排除无效。" >&2
    exit 1
  }
fi

WEB_LOGS="$(docker logs --since 15m medical-schedule-prod-web-1 2>&1 || true)"
if printf '%s\n' "$WEB_LOGS" | grep -Eq \
  'client: ([0-9a-fA-F:.]+)|(^|[[:space:]])([0-9]{1,3}\.){3}[0-9]{1,3}[[:space:]]+-[[:space:]]+-|visitorKey=|businessMonth='; then
  echo "[verify] 错误：Nginx 容器日志仍可能包含原始来源 IP 或 query。" >&2
  exit 1
fi
echo "[verify] complete"
