#!/usr/bin/env bash
# Trusted global DIRECTORY_QUERY_PLAN switch for the single production Compose project.
# Usage: sudo schedule-directory-query-plan <legacy|candidate>
set -Eeuo pipefail

DESIRED_PLAN="${1:-}"
DEPLOY_DIR="/opt/schedule"
ENV_FILE="$DEPLOY_DIR/.env.production"
COMPOSE_FILES=(-f infra/docker/compose.prod.yml)
DOMAIN="hosp.schedule.eylinhome.top"
MIGRATION_FILE="migrations/0053_directory_candidate_covering_index.sql"
PLAN_MUTATION_STARTED="false"
NEXT_ENV=""

fail() {
  echo "[directory-plan] 错误：$*" >&2
  return 1
}

compose() {
  docker compose --env-file "$ENV_FILE" "${COMPOSE_FILES[@]}" "$@"
}

read_current_plan() {
  local count value
  count="$(grep -Ec '^DIRECTORY_QUERY_PLAN=' "$ENV_FILE" || true)"
  [ "$count" -le 1 ] || fail "DIRECTORY_QUERY_PLAN 配置重复。"
  if [ "$count" -eq 0 ]; then
    printf '%s\n' legacy
    return
  fi
  value="$(sed -nE 's/^DIRECTORY_QUERY_PLAN=(legacy|candidate)$/\1/p' "$ENV_FILE")"
  case "$value" in
    legacy|candidate) printf '%s\n' "$value" ;;
    *) fail "DIRECTORY_QUERY_PLAN 配置无效。" ;;
  esac
}

write_environment_value() {
  local desired="$1"
  NEXT_ENV="$(mktemp "$DEPLOY_DIR/.env.production.directory-plan.XXXXXX")"
  awk -v desired="$desired" '
    BEGIN { replaced = 0 }
    /^DIRECTORY_QUERY_PLAN=/ {
      if (replaced == 0) {
        print "DIRECTORY_QUERY_PLAN=" desired
        replaced = 1
      }
      next
    }
    { print }
    END {
      if (replaced == 0) print "DIRECTORY_QUERY_PLAN=" desired
    }
  ' "$ENV_FILE" > "$NEXT_ENV"
  chmod --reference="$ENV_FILE" "$NEXT_ENV"
  chown --reference="$ENV_FILE" "$NEXT_ENV"
  mv -f -- "$NEXT_ENV" "$ENV_FILE"
  NEXT_ENV=""
}

assert_candidate_readiness() {
  [ -f "$MIGRATION_FILE" ] || fail "缺少 0053 migration 文件。"
  local expected_hash readiness exact_rows related_rows migration_id columns non_unique index_type visible
  expected_hash="$(sha256sum "$MIGRATION_FILE" | awk '{print $1}')"
  [[ "$expected_hash" =~ ^[0-9a-f]{64}$ ]] || fail "0053 migration hash 无效。"
  readiness="$(docker exec -e SCHEDULE_0053_HASH="$expected_hash" \
    medical-schedule-prod-mysql-1 sh -c \
    'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -D "$MYSQL_DATABASE" -e "SELECT
      (SELECT COUNT(*) FROM __drizzle_migrations WHERE created_at = 1785542400053 AND hash = \"$SCHEDULE_0053_HASH\"),
      (SELECT COUNT(*) FROM __drizzle_migrations WHERE created_at = 1785542400053 OR hash = \"$SCHEDULE_0053_HASH\"),
      COALESCE((SELECT MIN(id) FROM __drizzle_migrations WHERE created_at = 1785542400053 AND hash = \"$SCHEDULE_0053_HASH\"), 0),
      COALESCE((SELECT GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR \",\") FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = \"directory_search_aliases\" AND INDEX_NAME = \"directory_search_aliases_entry_type_normalized_idx\"), \"\"),
      COALESCE((SELECT GROUP_CONCAT(DISTINCT NON_UNIQUE) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = \"directory_search_aliases\" AND INDEX_NAME = \"directory_search_aliases_entry_type_normalized_idx\"), \"\"),
      COALESCE((SELECT GROUP_CONCAT(DISTINCT INDEX_TYPE) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = \"directory_search_aliases\" AND INDEX_NAME = \"directory_search_aliases_entry_type_normalized_idx\"), \"\"),
      COALESCE((SELECT GROUP_CONCAT(DISTINCT IS_VISIBLE) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = \"directory_search_aliases\" AND INDEX_NAME = \"directory_search_aliases_entry_type_normalized_idx\"), \"\")"')" ||
    fail "读取 0053 migration/index readiness 失败。"
  IFS=$'\t' read -r exact_rows related_rows migration_id columns non_unique index_type visible <<< "$readiness"
  [ "$exact_rows" = "1" ] && [ "$related_rows" = "1" ] && [[ "$migration_id" =~ ^[1-9][0-9]*$ ]] &&
    [ "$columns" = "entry_id,type,normalized_value" ] && [ "$non_unique" = "1" ] &&
    [ "$index_type" = "BTREE" ] && [ "$visible" = "YES" ] ||
    fail "candidate readiness 不满足精确 migration/index 定义。"
}

wait_for_health() {
  local attempt
  for attempt in $(seq 1 30); do
    if curl -kfsS --max-time 2 --resolve "${DOMAIN}:443:127.0.0.1" \
      "https://${DOMAIN}/api/health" >/dev/null; then
      return 0
    fi
    sleep 1
  done
  fail "API health 在 90 秒有界窗口内未恢复。"
}

assert_all_api_instances_use_plan() {
  local desired="$1" container_ids container_id count
  container_ids="$(compose ps -q api)"
  [ -n "$container_ids" ] || fail "没有运行中的 API 实例。"
  while IFS= read -r container_id; do
    [ -n "$container_id" ] || continue
    count="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$container_id" |
      grep -Fxc "DIRECTORY_QUERY_PLAN=$desired" || true)"
    [ "$count" = "1" ] || fail "API 实例未统一使用目标查询计划。"
  done <<< "$container_ids"
}

restore_legacy_after_failed_candidate() {
  echo "[directory-plan] candidate 切换失败，恢复 legacy。" >&2
  write_environment_value legacy || return 1
  compose up -d --force-recreate api || return 1
  wait_for_health || return 1
  assert_all_api_instances_use_plan legacy
}

rollback_on_error() {
  local status=$?
  trap - EXIT ERR HUP INT TERM
  recover_failed_mutation
  [ -z "$NEXT_ENV" ] || rm -f -- "$NEXT_ENV"
  exit "$status"
}

recover_failed_mutation() {
  if [ "$PLAN_MUTATION_STARTED" = "true" ]; then
    if [ "$DESIRED_PLAN" = "candidate" ]; then
      restore_legacy_after_failed_candidate ||
        echo "[directory-plan] legacy 自动恢复失败，需立即人工处理。" >&2
    else
      echo "[directory-plan] legacy rollback remains active; API 健康需人工恢复。" >&2
    fi
  fi
}

rollback_on_signal() {
  trap - EXIT ERR HUP INT TERM
  recover_failed_mutation
  [ -z "$NEXT_ENV" ] || rm -f -- "$NEXT_ENV"
  exit 143
}

cleanup_on_exit() {
  local status=$?
  trap - EXIT ERR HUP INT TERM
  [ -z "$NEXT_ENV" ] || rm -f -- "$NEXT_ENV"
  exit "$status"
}

if [ "$(id -u)" -ne 0 ]; then
  fail "必须以 root 执行。"
  exit 1
fi
case "$DESIRED_PLAN" in
  legacy|candidate) ;;
  *) fail "参数必须是 legacy|candidate。"; exit 1 ;;
esac
cd "$DEPLOY_DIR"
[ -f "$ENV_FILE" ] || { fail "缺少 .env.production。"; exit 1; }
[ "$(stat -c '%u' "$ENV_FILE")" = "0" ] || { fail ".env.production 必须由 root 所有。"; exit 1; }
[ "$(stat -c '%a' "$ENV_FILE")" = "600" ] || { fail ".env.production 权限必须是 0600。"; exit 1; }
exec 9>/var/lock/schedule-release.lock
flock -n 9 || { fail "另一项发布、回滚或查询计划切换正在执行。"; exit 1; }

CURRENT_PLAN="$(read_current_plan)"
if [ "$DESIRED_PLAN" = "candidate" ]; then
  assert_candidate_readiness
fi
if [ "$CURRENT_PLAN" = "$DESIRED_PLAN" ]; then
  assert_all_api_instances_use_plan "$DESIRED_PLAN"
  echo "[directory-plan] 已是 $DESIRED_PLAN，无需重建。"
  exit 0
fi

trap rollback_on_error ERR
trap rollback_on_signal HUP INT TERM
trap cleanup_on_exit EXIT
PLAN_MUTATION_STARTED="true"
write_environment_value "$DESIRED_PLAN"
compose up -d --force-recreate api
wait_for_health
assert_all_api_instances_use_plan "$DESIRED_PLAN"
PLAN_MUTATION_STARTED="false"
trap - EXIT ERR HUP INT TERM
echo "[directory-plan] 全局查询计划已切换为 $DESIRED_PLAN。"
