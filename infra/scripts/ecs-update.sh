#!/usr/bin/env bash
# Immutable release update: verify artifacts → backup → migrate → recreate → verify.
# Usage: bash ecs-update.sh <dist-tar> <api-flat-tar-zst> <deploy-manifest>
set -Eeuo pipefail

DIST_TAR="${1:?缺少 dist 压缩包路径}"
FLAT_TAR="${2:?缺少 api-flat 压缩包路径}"
MANIFEST="${3:?缺少部署清单路径}"
DEPLOY_DIR="/opt/schedule"
COMPOSE_FILES=(-f infra/docker/compose.prod.yml)
DOMAIN="hosp.schedule.eylinhome.top"
PRESERVE_CONTROL_PLANE="${SCHEDULE_PRESERVE_CONTROL_PLANE:-false}"
P6_RELEASE_FEATURE_LEVEL="p6-client-capabilities-v1"
DEPLOY_MUTATION_STARTED="false"
NEXT_CURRENT_RELEASE=""

fail() {
  echo "[deploy] 错误：$*" >&2
  return 1
}

manifest_value() {
  local key="$1"
  sed -nE "s/.*\"${key}\"[[:space:]]*:[[:space:]]*\"([^\"]+)\".*/\1/p" "$MANIFEST" | head -1
}

archive_has_path() {
  local expected_path="$1"
  tar -tzf "$DIST_TAR" | awk -v expected="$expected_path" '
    $0 == expected { found = 1 }
    END { exit(found ? 0 : 1) }
  '
}

archive_path_sha256() {
  local archive_path="$1"
  tar -xOf "$DIST_TAR" "$archive_path" | sha256sum | awk '{print $1}'
}

env_value() {
  local key="$1"
  sed -nE "s/^${key}=([^[:space:]]+)$/\\1/p" .env.production | head -1
}

require_single_env_value() {
  local key="$1"
  local count
  count="$(grep -Ec "^${key}=[^[:space:]]+$" .env.production || true)"
  [ "$count" = "1" ] || fail "生产配置必须且只能包含一条 ${key}。"
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
  env_owner="$(stat -c '%u' .env.production)"
  env_mode="$(stat -c '%a' .env.production)"
  [ "$env_owner" = "0" ] || fail "生产配置必须由 root 所有。"
  [ "$env_mode" = "600" ] || fail "生产配置权限必须是 0600。"
  require_single_env_value MINIPROGRAM_SUPPORTED_CLIENT_VERSIONS
  require_single_env_value MINIPROGRAM_LEGACY_CLIENT_VERSION
  local supported legacy key value
  supported="$(env_value MINIPROGRAM_SUPPORTED_CLIENT_VERSIONS)"
  legacy="$(env_value MINIPROGRAM_LEGACY_CLIENT_VERSION)"
  validate_client_version_configuration "$supported" "$legacy" ||
    fail "Mini Program client version 配置无效、重复或不满足 semver-like≤64。"
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
      *) fail "${key} 必须是 true 或 false。" ;;
    esac
  done
}

compose() {
  docker compose --env-file .env.production "${COMPOSE_FILES[@]}" "$@"
}

wait_for_health() {
  for attempt in $(seq 1 30); do
    if curl -kfsS --max-time 5 --resolve "${DOMAIN}:443:127.0.0.1" \
      "https://${DOMAIN}/api/health"; then
      echo
      return 0
    fi
    echo "[deploy] 等待 Nginx/API 健康检查（$attempt/30）..." >&2
    sleep 2
  done
  fail "Nginx/API 健康检查超时。"
}

database_migration_count() {
  docker exec medical-schedule-prod-mysql-1 sh -c \
    'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -D "$MYSQL_DATABASE" \
    -e "SELECT COUNT(*) FROM __drizzle_migrations"'
}

configure_database_privacy_retention() {
  docker exec medical-schedule-prod-mysql-1 sh -c \
    'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -D "$MYSQL_DATABASE" \
      -e "SET PERSIST binlog_expire_logs_seconds = 2592000; SET PERSIST general_log = OFF"'
}

assert_release_path() {
  local path="$1"
  case "$path" in
    "$DEPLOY_DIR"/*) ;;
    *) fail "路径越界：$path" ;;
  esac
}

copy_retained_artifact() {
  local source_path destination destination_path
  source_path="$(readlink -f -- "$1")"
  destination="$2"
  destination_path="$(readlink -f -- "$destination" 2>/dev/null || true)"
  if [ "$source_path" = "$destination_path" ]; then
    return 0
  fi
  cp -- "$source_path" "$destination"
}

if [ "$(id -u)" -ne 0 ]; then
  fail "必须以 root 执行。"
  exit 1
fi
case "$PRESERVE_CONTROL_PLANE" in
  true|false) ;;
  *) fail "SCHEDULE_PRESERVE_CONTROL_PLANE 只能是 true 或 false。"; exit 1 ;;
esac
if [ ! -f "$DIST_TAR" ] || [ ! -f "$FLAT_TAR" ] || [ ! -f "$MANIFEST" ]; then
  fail "部署输入文件不存在。"
  exit 1
fi
DIST_TAR="$(readlink -f -- "$DIST_TAR")"
FLAT_TAR="$(readlink -f -- "$FLAT_TAR")"
MANIFEST="$(readlink -f -- "$MANIFEST")"

RELEASE_LOCK_PATH="/var/lock/schedule-release.lock"
CANONICAL_RELEASE_LOCK_PATH="$(readlink -f -- "$RELEASE_LOCK_PATH")"
if [ "${SCHEDULE_RELEASE_LOCK_FD:-}" = "9" ]; then
  INHERITED_LOCK_PATH="$(readlink -f -- "/proc/$$/fd/9" 2>/dev/null || true)"
  if [ "$INHERITED_LOCK_PATH" != "$CANONICAL_RELEASE_LOCK_PATH" ]; then
    fail "继承的发布锁无效。"
    exit 1
  fi
else
  exec 9>"$RELEASE_LOCK_PATH"
  flock -n 9 || { fail "另一项发布或回滚正在执行。"; exit 1; }
fi

cd "$DEPLOY_DIR"
if [ -f infra/docker/compose.prod.icp-test.yml ]; then
  echo "[deploy] 清理已停用的 ICP 测试 Compose override" >&2
  rm -f infra/docker/compose.prod.icp-test.yml
fi
if grep -Eq '^[[:space:]]*AUTH_PASSWORD_ENABLED[[:space:]]*=[[:space:]]*false([[:space:]]*|$)' .env.production; then
  fail "生产配置 AUTH_PASSWORD_ENABLED 必须为 true"
fi
if ! grep -Eq '^[[:space:]]*AUTH_PASSWORD_ENABLED[[:space:]]*=[[:space:]]*true([[:space:]]*|$)' .env.production; then
  printf '\nAUTH_PASSWORD_ENABLED=true\n' >> .env.production
fi
RELEASE_ID="$(manifest_value releaseId)"
RELEASE_FEATURE_LEVEL="$(manifest_value releaseFeatureLevel)"
DATABASE_SCHEMA_MIN="$(manifest_value databaseSchemaMin)"
DATABASE_SCHEMA_MAX="$(manifest_value databaseSchemaMax)"
EXPECTED_DIST_SHA="$(manifest_value distArchiveSha256)"
EXPECTED_FLAT_SHA="$(manifest_value apiRuntimeArchiveSha256)"
if [[ ! "$RELEASE_ID" =~ ^[0-9a-f]{40}$ ]]; then
  fail "部署清单中的 releaseId 无效。"
fi
if [[ ! "$EXPECTED_DIST_SHA" =~ ^[0-9a-f]{64}$ ]] || [[ ! "$EXPECTED_FLAT_SHA" =~ ^[0-9a-f]{64}$ ]]; then
  fail "部署清单中的产物哈希无效。"
fi
if [ -z "$DATABASE_SCHEMA_MIN" ] && [ -z "$DATABASE_SCHEMA_MAX" ]; then
  DATABASE_SCHEMA_MIN="0"
  DATABASE_SCHEMA_MAX="49"
fi
if [[ ! "$DATABASE_SCHEMA_MIN" =~ ^[0-9]+$ ]] ||
  [[ ! "$DATABASE_SCHEMA_MAX" =~ ^[0-9]+$ ]] ||
  [ "$DATABASE_SCHEMA_MIN" -gt "$DATABASE_SCHEMA_MAX" ]; then
  fail "release database schema 兼容范围无效。"
fi
CURRENT_DATABASE_SCHEMA="$(database_migration_count)"
if [[ ! "$CURRENT_DATABASE_SCHEMA" =~ ^[0-9]+$ ]] ||
  [ "$CURRENT_DATABASE_SCHEMA" -gt "$DATABASE_SCHEMA_MAX" ]; then
  fail "当前数据库 schema 无法安全部署该 release。"
fi
if archive_has_path infra/scripts/client-capability-switch.sh; then
  [ "$RELEASE_FEATURE_LEVEL" = "$P6_RELEASE_FEATURE_LEVEL" ] ||
    fail "P6 release 归档与 feature level 不一致。"
  CONTROL_PATHS=(
    infra/scripts/schedule-backup.sh
    infra/scripts/ecs-update.sh
    infra/scripts/ecs-verify.sh
    infra/scripts/ecs-rollback.sh
    infra/scripts/client-capability-switch.sh
  )
  CONTROL_HASH_KEYS=(
    backupSchedulerSha256
    ecsUpdateSha256
    ecsVerifySha256
    ecsRollbackSha256
    clientCapabilitySwitchSha256
  )
  if archive_has_path infra/scripts/schedule-privacy-retention.sh; then
    CONTROL_PATHS+=(infra/scripts/schedule-privacy-retention.sh)
    CONTROL_HASH_KEYS+=(privacyRetentionSchedulerSha256)
  fi
  for index in "${!CONTROL_PATHS[@]}"; do
    expected_control_sha="$(manifest_value "${CONTROL_HASH_KEYS[$index]}")"
    if [[ ! "$expected_control_sha" =~ ^[0-9a-f]{64}$ ]] ||
      [ "$(archive_path_sha256 "${CONTROL_PATHS[$index]}")" != "$expected_control_sha" ]; then
      fail "P6 release 控制脚本哈希无效：${CONTROL_PATHS[$index]}。"
    fi
  done
  validate_miniprogram_capability_config
elif [ -n "$RELEASE_FEATURE_LEVEL" ]; then
  fail "pre-P6 归档不得声明 P6 release feature level。"
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
copy_retained_artifact "$DIST_TAR" "$RELEASE_DIR/schedule-dist.tar.gz"
copy_retained_artifact "$FLAT_TAR" "$RELEASE_DIR/api-flat.tar.zst"
copy_retained_artifact "$MANIFEST" "$RELEASE_DIR/deploy-manifest.json"

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
  infra/scripts/dist \
  infra/scripts/ecs-update.sh \
  infra/scripts/ecs-verify.sh \
  infra/scripts/ecs-rollback.sh \
  infra/scripts/client-capability-switch.sh \
  infra/scripts/schedule-backup.sh \
  infra/scripts/schedule-notifications.sh \
  infra/scripts/schedule-privacy-retention.sh \
  .env.production.example \
  runtime/api-flat/node_modules \
  deploy-manifest.json \
  current-release; do
  if [ -e "$DEPLOY_DIR/$relative_path" ]; then
    BACKUP_ENTRIES+=("$relative_path")
  fi
done
if [ "${#BACKUP_ENTRIES[@]}" -gt 0 ]; then
  tar -czf "$BACKUP_DIR/current-files.tar.gz" -C "$DEPLOY_DIR" "${BACKUP_ENTRIES[@]}"
fi

SYSTEM_CONTROL_BACKUP="$BACKUP_DIR/system-controls.tar.gz"
SYSTEM_CONTROL_PATHS=()
if [ "$PRESERVE_CONTROL_PLANE" = "false" ]; then
  SYSTEM_CONTROL_PATHS+=(
    /usr/local/bin/schedule-notifications
    /usr/local/bin/schedule-ecs-rollback
    /usr/local/bin/schedule-client-capability
    /usr/local/lib/schedule
    /etc/cron.d/schedule-notifications
    /etc/cron.d/schedule-backup
    /etc/cron.d/schedule-privacy-retention
    /etc/logrotate.d/schedule
  )
fi
SYSTEM_CONTROL_ENTRIES=()
for absolute_path in "${SYSTEM_CONTROL_PATHS[@]}"; do
  if [ -e "$absolute_path" ]; then
    SYSTEM_CONTROL_ENTRIES+=("${absolute_path#/}")
  fi
done
if [ "${#SYSTEM_CONTROL_ENTRIES[@]}" -gt 0 ]; then
  tar -czf "$SYSTEM_CONTROL_BACKUP" -C / "${SYSTEM_CONTROL_ENTRIES[@]}"
else
  tar -czf "$SYSTEM_CONTROL_BACKUP" -C / --files-from /dev/null
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
    infra/scripts/dist \
    infra/scripts/ecs-update.sh \
    infra/scripts/ecs-verify.sh \
    infra/scripts/ecs-rollback.sh \
    infra/scripts/client-capability-switch.sh \
    infra/scripts/schedule-backup.sh \
    infra/scripts/schedule-notifications.sh \
    infra/scripts/schedule-privacy-retention.sh \
    .env.production.example \
    runtime/api-flat/node_modules \
    deploy-manifest.json \
    current-release; do
    assert_release_path "$DEPLOY_DIR/$relative_path" || return 1
    rm -rf "$DEPLOY_DIR/$relative_path" || return 1
  done
  tar -xzf "$BACKUP_DIR/current-files.tar.gz" -C "$DEPLOY_DIR" || return 1
}

restore_system_controls() {
  [ -f "$SYSTEM_CONTROL_BACKUP" ] || return 1
  local absolute_path
  for absolute_path in "${SYSTEM_CONTROL_PATHS[@]}"; do
    rm -rf -- "$absolute_path" || return 1
  done
  tar -xzf "$SYSTEM_CONTROL_BACKUP" -C / || return 1
}

restore_deployment_state() {
  echo "[deploy] 发布失败，开始恢复上一版应用文件。" >&2
  local application_restored="false"
  if restore_previous; then
    application_restored="true"
  else
    echo "[deploy] 上一版应用文件自动恢复失败，需立即人工处理。" >&2
  fi
  if ! restore_system_controls; then
    echo "[deploy] 可信控制面自动恢复失败，需立即人工处理。" >&2
  fi
  if [ "$application_restored" = "true" ]; then
    compose up -d --force-recreate api web || true
    curl -kfsS --resolve "${DOMAIN}:443:127.0.0.1" \
      "https://${DOMAIN}/api/health" >/dev/null || true
  fi
  if [ -n "$NEXT_CURRENT_RELEASE" ]; then
    rm -f -- "$NEXT_CURRENT_RELEASE" || true
    NEXT_CURRENT_RELEASE=""
  fi
  DEPLOY_MUTATION_STARTED="false"
}

rollback_on_error() {
  local status=$?
  trap - EXIT ERR HUP INT TERM
  restore_deployment_state
  exit "$status"
}

rollback_on_signal() {
  trap - EXIT ERR HUP INT TERM
  restore_deployment_state
  exit 143
}

cleanup_on_exit() {
  local status=$?
  trap - EXIT ERR HUP INT TERM
  if [ "$DEPLOY_MUTATION_STARTED" = "true" ]; then
    echo "[deploy] 检测到未完成发布，执行退出恢复。" >&2
    restore_deployment_state
  fi
  exit "$status"
}

trap rollback_on_error ERR
trap rollback_on_signal HUP INT TERM
trap cleanup_on_exit EXIT

echo "[deploy] 1/7 校验并保留 release $RELEASE_ID"
echo "[deploy] 2/7 解压迁移和应用产物"
DEPLOY_MUTATION_STARTED="true"
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
  infra/scripts/dist \
  infra/scripts/ecs-update.sh \
  infra/scripts/ecs-verify.sh \
  infra/scripts/ecs-rollback.sh \
  infra/scripts/client-capability-switch.sh \
  infra/scripts/schedule-backup.sh \
  infra/scripts/schedule-notifications.sh \
  infra/scripts/schedule-privacy-retention.sh \
  .env.production.example; do
  assert_release_path "$DEPLOY_DIR/$relative_path"
  rm -rf "$DEPLOY_DIR/$relative_path"
done
EXTRACT_PATHS=(
  migrations \
  apps/web/dist \
  apps/api/dist \
  packages/contracts/dist \
  packages/database/dist \
  packages/scheduling-domain/dist \
  pnpm-lock.yaml \
  infra/docker/compose.prod.yml \
  infra/docker/nginx.prod.conf \
  infra/scripts/dist \
  infra/scripts/schedule-notifications.sh \
  .env.production.example
)
for optional_path in \
  infra/scripts/ecs-update.sh \
  infra/scripts/ecs-verify.sh \
  infra/scripts/ecs-rollback.sh \
  infra/scripts/client-capability-switch.sh \
  infra/scripts/schedule-backup.sh \
  infra/scripts/schedule-privacy-retention.sh; do
  if archive_has_path "$optional_path"; then
    EXTRACT_PATHS+=("$optional_path")
  fi
done
tar -xzf "$DIST_TAR" -C "$DEPLOY_DIR" "${EXTRACT_PATHS[@]}"
copy_retained_artifact "$MANIFEST" "$CURRENT_MANIFEST"

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

echo "[deploy] 4/7 停止旧 API 写入并在容器内执行数据库迁移"
compose stop api
compose run --rm api node apps/api/dist/migrate.js
configure_database_privacy_retention
CURRENT_DATABASE_SCHEMA="$(database_migration_count)"
if [[ ! "$CURRENT_DATABASE_SCHEMA" =~ ^[0-9]+$ ]] ||
  [ "$CURRENT_DATABASE_SCHEMA" -lt "$DATABASE_SCHEMA_MIN" ] ||
  [ "$CURRENT_DATABASE_SCHEMA" -gt "$DATABASE_SCHEMA_MAX" ]; then
  fail "迁移后的数据库 schema 不在 release 兼容范围内。"
fi

echo "[deploy] 5/7 重建 api/web 容器"
compose up -d --force-recreate api web

echo "[deploy] 6/7 健康检查并安装可信发布控制与调度"
wait_for_health
if docker exec medical-schedule-prod-api-1 \
  ls /app/apps/api/node_modules/@cloudbase >/dev/null 2>&1; then
  fail "依赖树仍含 @cloudbase。"
fi

if [ "$PRESERVE_CONTROL_PLANE" = "true" ]; then
  echo "[deploy] preserving the installed trusted control plane"
else
  install -m 0755 infra/scripts/schedule-notifications.sh /usr/local/bin/schedule-notifications
  cat > /etc/cron.d/schedule-notifications <<'EOF'
* * * * * root /usr/local/bin/schedule-notifications >> /var/log/schedule-notifications.log 2>&1
EOF
  if [ -f infra/scripts/ecs-update.sh ] && [ -f infra/scripts/ecs-verify.sh ]; then
    install -d -m 0755 /usr/local/lib/schedule
    install -m 0755 infra/scripts/ecs-update.sh /usr/local/lib/schedule/ecs-update.sh
    install -m 0755 infra/scripts/ecs-verify.sh /usr/local/lib/schedule/ecs-verify.sh
  fi
  if [ -f infra/scripts/ecs-rollback.sh ]; then
    install -m 0755 infra/scripts/ecs-rollback.sh /usr/local/bin/schedule-ecs-rollback
  fi
  if [ -f infra/scripts/client-capability-switch.sh ]; then
    install -m 0755 infra/scripts/client-capability-switch.sh /usr/local/bin/schedule-client-capability
  fi
  if [ -f infra/scripts/schedule-backup.sh ]; then
    install -d -m 0755 /usr/local/lib/schedule
    install -m 0755 infra/scripts/schedule-backup.sh /usr/local/lib/schedule/schedule-backup.sh
    install -m 0644 "$MANIFEST" /usr/local/lib/schedule/control-plane-manifest.json
    cat > /etc/cron.d/schedule-backup <<'EOF'
30 3 * * * root /usr/local/lib/schedule/schedule-backup.sh >> /var/log/schedule-backup.log 2>&1
EOF
  fi
  if [ -f infra/scripts/schedule-privacy-retention.sh ]; then
    install -d -m 0755 /usr/local/lib/schedule
    install -m 0755 infra/scripts/schedule-privacy-retention.sh \
      /usr/local/lib/schedule/schedule-privacy-retention.sh
    if [ "$CURRENT_DATABASE_SCHEMA" -ge 50 ]; then
      cat > /etc/cron.d/schedule-privacy-retention <<'EOF'
*/15 * * * * root /usr/local/lib/schedule/schedule-privacy-retention.sh >> /var/log/schedule-privacy-retention.log 2>&1
EOF
      bash /usr/local/lib/schedule/schedule-privacy-retention.sh
    else
      rm -f -- /etc/cron.d/schedule-privacy-retention
    fi
  fi
  cat > /etc/logrotate.d/schedule <<'EOF'
/var/log/schedule-monitor.log /var/log/schedule-backup.log /var/log/schedule-notifications.log /var/log/schedule-privacy-retention.log {
  weekly
  rotate 4
  compress
  missingok
  notifempty
}
EOF
fi

echo "[deploy] 7/7 写入当前 release"
NEXT_CURRENT_RELEASE="$(mktemp "$DEPLOY_DIR/.current-release.XXXXXX")"
printf '%s\n' "$RELEASE_ID" > "$NEXT_CURRENT_RELEASE"
chmod 0644 "$NEXT_CURRENT_RELEASE"
mv -f -- "$NEXT_CURRENT_RELEASE" "$DEPLOY_DIR/current-release"
NEXT_CURRENT_RELEASE=""
DEPLOY_MUTATION_STARTED="false"
trap - EXIT ERR HUP INT TERM
echo "[deploy] 发布成功：$RELEASE_ID"
