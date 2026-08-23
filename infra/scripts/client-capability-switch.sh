#!/usr/bin/env bash
# Atomically toggle one production Mini Program capability and verify the effective policy.
# Usage: schedule-client-capability <capability> <true|false>
set -Eeuo pipefail

DEPLOY_DIR="/opt/schedule"
ENV_FILE="$DEPLOY_DIR/.env.production"
COMPOSE_FILE="$DEPLOY_DIR/infra/docker/compose.prod.yml"
DOMAIN="hosp.schedule.eylinhome.top"
CAPABILITY="${1:-}"
DESIRED_VALUE="${2:-}"
PREVIOUS_VALUE=""
NEXT_ENV=""
ENV_CHANGED="false"

fail() {
  echo "[capability] 错误：$*" >&2
  return 1
}

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

env_value() {
  local key="$1"
  sed -nE "s/^${key}=([^[:space:]]+)$/\\1/p" "$ENV_FILE" | head -1
}

require_single_value() {
  local key="$1"
  local count
  count="$(grep -Ec "^${key}=[^[:space:]]+$" "$ENV_FILE" || true)"
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

validate_environment_file_security() {
  local owner mode
  owner="$(stat -c '%u' "$ENV_FILE")"
  mode="$(stat -c '%a' "$ENV_FILE")"
  [ "$owner" = "0" ] || fail "生产配置必须由 root 所有。"
  [ "$mode" = "600" ] || fail "生产配置权限必须是 0600。"
}

validate_policy_configuration() {
  require_single_value MINIPROGRAM_SUPPORTED_CLIENT_VERSIONS
  require_single_value MINIPROGRAM_LEGACY_CLIENT_VERSION

  local supported legacy
  supported="$(env_value MINIPROGRAM_SUPPORTED_CLIENT_VERSIONS)"
  legacy="$(env_value MINIPROGRAM_LEGACY_CLIENT_VERSION)"
  validate_client_version_configuration "$supported" "$legacy" ||
    fail "Mini Program client version 配置无效、重复或不满足 semver-like≤64。"

  local key value
  for key in \
    MINIPROGRAM_CAPABILITY_GLOBAL_ENABLED \
    MINIPROGRAM_CAPABILITY_CORE_ENABLED \
    MINIPROGRAM_CAPABILITY_WORKFLOWS_ENABLED \
    MINIPROGRAM_CAPABILITY_ORGANIZATION_ENABLED \
    MINIPROGRAM_CAPABILITY_INSIGHTS_ENABLED \
    MINIPROGRAM_CAPABILITY_EXTERNAL_MESSAGES_ENABLED \
    MINIPROGRAM_CAPABILITY_GUEST_ENABLED; do
    require_single_value "$key"
    value="$(env_value "$key")"
    case "$value" in
      true|false) ;;
      *) fail "${key} 必须是 true 或 false。" ;;
    esac
  done
}

wait_for_health() {
  local attempt
  for attempt in $(seq 1 30); do
    if curl -kfsS --max-time 5 --resolve "${DOMAIN}:443:127.0.0.1" \
      "https://${DOMAIN}/api/health" >/dev/null; then
      return 0
    fi
    echo "[capability] 等待 API 健康检查（$attempt/30）..." >&2
    sleep 2
  done
  fail "API 健康检查超时。"
}

probe_effective_capabilities() {
  local version response global core workflows organization insights external_messages guest
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
      const actualKeys = Object.keys(actual).sort();
      const expectedKeys = Object.keys(expected).sort();
      const matches = JSON.stringify(actualKeys) === JSON.stringify(expectedKeys)
        && expectedKeys.every((key) => actual[key] === expected[key]);
      if (!matches) throw new Error("effective capability response mismatch");
    });
  ' "$version" "$global" "$core" "$workflows" "$organization" "$insights" \
    "$external_messages" "$guest"
}

recreate_and_probe() {
  compose up -d --force-recreate api
  wait_for_health
  probe_effective_capabilities
}

write_environment_value() {
  local value="$1"
  NEXT_ENV="$(mktemp "$DEPLOY_DIR/.env.production.capability.XXXXXX")" || return 1
  awk -v key="$TARGET_KEY" -v value="$value" '
    index($0, key "=") == 1 { print key "=" value; replaced += 1; next }
    { print }
    END { if (replaced != 1) exit 42 }
  ' "$ENV_FILE" > "$NEXT_ENV" || return 1
  chmod --reference="$ENV_FILE" "$NEXT_ENV" || return 1
  chown --reference="$ENV_FILE" "$NEXT_ENV" || return 1
  mv -f -- "$NEXT_ENV" "$ENV_FILE" || return 1
  NEXT_ENV=""
}

restore_previous_environment() {
  [ "$ENV_CHANGED" = "true" ] || return 0
  write_environment_value "$PREVIOUS_VALUE" || return 1
  ENV_CHANGED="false"
}

restore_runtime_after_failure() {
  if ! restore_previous_environment; then
    echo "[capability] 自动恢复失败；能力值可能已变化，请立即人工检查 $ENV_FILE 与 API。" >&2
    return 1
  fi
  compose up -d --force-recreate api || true
  wait_for_health || true
  probe_effective_capabilities || true
}

rollback_on_error() {
  local status=$?
  trap - ERR
  echo "[capability] 切换失败，恢复上一份生产配置。" >&2
  restore_runtime_after_failure || true
  exit "$status"
}

rollback_on_signal() {
  trap - HUP INT TERM
  echo "[capability] 收到终止信号，恢复上一份生产配置。" >&2
  restore_runtime_after_failure || true
  exit 143
}

cleanup_on_exit() {
  local status=$?
  trap - EXIT ERR HUP INT TERM
  if [ "$ENV_CHANGED" = "true" ]; then
    echo "[capability] 退出时检测到未确认的配置变更，尝试恢复。" >&2
    restore_runtime_after_failure || true
  fi
  if [ -n "$NEXT_ENV" ]; then
    rm -f -- "$NEXT_ENV"
  fi
  exit "$status"
}

if [ "$(id -u)" -ne 0 ]; then
  fail "必须以 root 执行。"
  exit 1
fi
case "$CAPABILITY" in
  global|core|workflows|organization|insights|externalMessages|guest) ;;
  *) fail "能力名必须是 global/core/workflows/organization/insights/externalMessages/guest 之一。"; exit 2 ;;
esac
case "$DESIRED_VALUE" in
  true|false) ;;
  *) fail "值必须是 true 或 false。"; exit 2 ;;
esac

case "$CAPABILITY" in
  global) TARGET_KEY="MINIPROGRAM_CAPABILITY_GLOBAL_ENABLED" ;;
  core) TARGET_KEY="MINIPROGRAM_CAPABILITY_CORE_ENABLED" ;;
  workflows) TARGET_KEY="MINIPROGRAM_CAPABILITY_WORKFLOWS_ENABLED" ;;
  organization) TARGET_KEY="MINIPROGRAM_CAPABILITY_ORGANIZATION_ENABLED" ;;
  insights) TARGET_KEY="MINIPROGRAM_CAPABILITY_INSIGHTS_ENABLED" ;;
  externalMessages) TARGET_KEY="MINIPROGRAM_CAPABILITY_EXTERNAL_MESSAGES_ENABLED" ;;
  guest) TARGET_KEY="MINIPROGRAM_CAPABILITY_GUEST_ENABLED" ;;
esac

exec 8>/var/lock/schedule-release.lock
flock -n 8 || { fail "另一项发布或回滚正在执行。"; exit 1; }
exec 9>/var/lock/schedule-client-capability.lock
flock -n 9 || { fail "另一项能力切换正在执行。"; exit 1; }
cd "$DEPLOY_DIR"
[ -f "$ENV_FILE" ] || { fail "缺少 $ENV_FILE。"; exit 1; }
validate_environment_file_security
validate_policy_configuration

PREVIOUS_VALUE="$(env_value "$TARGET_KEY")"
trap cleanup_on_exit EXIT
trap rollback_on_error ERR
trap rollback_on_signal HUP INT TERM
ENV_CHANGED="true"
write_environment_value "$DESIRED_VALUE"
validate_policy_configuration
recreate_and_probe
ENV_CHANGED="false"
trap - ERR HUP INT TERM

echo "[capability] ${CAPABILITY}=${DESIRED_VALUE} 已生效并通过健康与策略校验。"
