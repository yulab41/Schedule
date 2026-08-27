#!/usr/bin/env bash
# Atomically ensure exact Mini Program client versions are supported and verify the policy.
# Usage:
#   schedule-client-version-allowlist ensure VERSION [VERSION...]
#   schedule-client-version-allowlist verify
set -Eeuo pipefail

DEPLOY_DIR="/opt/schedule"
ENV_FILE="$DEPLOY_DIR/.env.production"
COMPOSE_FILE="$DEPLOY_DIR/infra/docker/compose.prod.yml"
DOMAIN="hosp.schedule.eylinhome.top"
ACTION="${1:-}"
NEXT_ENV=""
PREVIOUS_LIST=""
ENV_CHANGED="false"
declare -a REQUESTED_VERSIONS=()

fail() {
  echo "[client-version] 错误：$*" >&2
  return 1
}

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

env_value() {
  local key="$1"
  sed -nE "s/^${key}=([^[:space:]]+)$/\1/p" "$ENV_FILE" | head -1
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
  [ -f "$ENV_FILE" ] && [ ! -L "$ENV_FILE" ] || fail "生产配置必须是普通文件。"
  [ "$(stat -c '%u:%g/%a' "$ENV_FILE")" = "0:0/600" ] ||
    fail "生产配置必须为 root:root/0600。"
}

validate_policy_configuration() {
  require_single_value MINIPROGRAM_SUPPORTED_CLIENT_VERSIONS
  require_single_value MINIPROGRAM_LEGACY_CLIENT_VERSION
  local supported legacy key value
  supported="$(env_value MINIPROGRAM_SUPPORTED_CLIENT_VERSIONS)"
  legacy="$(env_value MINIPROGRAM_LEGACY_CLIENT_VERSION)"
  validate_client_version_configuration "$supported" "$legacy" ||
    fail "支持版本列表格式无效、重复或不包含 legacy。"
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
    echo "[client-version] 等待 API 健康检查（$attempt/30）..." >&2
    sleep 2
  done
  fail "API 健康检查超时。"
}

probe_version() {
  local version="$1"
  local response global core workflows organization insights external_messages guest
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
}

choose_unknown_version() {
  local supported="$1"
  local suffix=0 candidate
  while true; do
    candidate="0.0.0-unsupported.$(date +%s).$$.${suffix}"
    case ",$supported," in
      *",$candidate,"*) suffix=$((suffix + 1)) ;;
      *) printf '%s' "$candidate"; return 0 ;;
    esac
  done
}

probe_unknown_version() {
  local supported unknown status
  supported="$(env_value MINIPROGRAM_SUPPORTED_CLIENT_VERSIONS)"
  unknown="$(choose_unknown_version "$supported")"
  status="$(curl -ksS --max-time 5 --get -o /dev/null -w '%{http_code}' \
    --resolve "${DOMAIN}:443:127.0.0.1" --data-urlencode 'platform=miniprogram' \
    --data-urlencode "version=$unknown" \
    "https://${DOMAIN}/api/client-capabilities" || true)"
  [ "$status" = "426" ] || fail "未知版本拒绝探针失败（HTTP ${status:-000}）。"
}

write_version_list() {
  local value="$1"
  umask 077
  NEXT_ENV="$(mktemp "$DEPLOY_DIR/.env.production.client-versions.XXXXXX")"
  awk -v value="$value" '
    /^MINIPROGRAM_SUPPORTED_CLIENT_VERSIONS=/ {
      print "MINIPROGRAM_SUPPORTED_CLIENT_VERSIONS=" value
      replaced += 1
      next
    }
    { print }
    END { if (replaced != 1) exit 42 }
  ' "$ENV_FILE" > "$NEXT_ENV"
  chown 0:0 "$NEXT_ENV"
  chmod 0600 "$NEXT_ENV"
  mv -fT -- "$NEXT_ENV" "$ENV_FILE"
  NEXT_ENV=""
}

recreate_and_probe() {
  local -a versions=("$@")
  compose up -d --force-recreate api web
  wait_for_health
  local version
  for version in "${versions[@]}"; do probe_version "$version"; done
  probe_unknown_version
}

restore_previous_list() {
  [ "$ENV_CHANGED" = "true" ] || return 0
  write_version_list "$PREVIOUS_LIST"
  validate_environment_file_security
  validate_policy_configuration
  recreate_and_probe "$(env_value MINIPROGRAM_LEGACY_CLIENT_VERSION)"
  ENV_CHANGED="false"
}

rollback_on_error() {
  local status=$?
  trap - ERR
  echo "[client-version] 更新失败，正在恢复上一份版本列表。" >&2
  restore_previous_list ||
    echo "[client-version] 自动恢复验证失败，请立即检查生产版本策略。" >&2
  exit "$status"
}

rollback_on_signal() {
  trap - HUP INT QUIT TERM
  echo "[client-version] 收到终止信号，正在恢复上一份版本列表。" >&2
  restore_previous_list || true
  exit 143
}

cleanup_on_exit() {
  local status=$?
  trap - EXIT ERR HUP INT QUIT TERM
  [ -z "$NEXT_ENV" ] || rm -f -- "$NEXT_ENV"
  if [ "$ENV_CHANGED" = "true" ]; then restore_previous_list || true; fi
  exit "$status"
}

if [ "$(id -u)" -ne 0 ]; then fail "必须以 root 执行。"; exit 1; fi
case "$ACTION" in
  ensure)
    shift
    [ "$#" -gt 0 ] || { fail "ensure 至少需要一个版本。"; exit 2; }
    declare -A requested_seen=()
    for version in "$@"; do
      is_valid_client_version "$version" || { fail "输入版本格式无效。"; exit 2; }
      [ -z "${requested_seen[$version]+present}" ] || { fail "输入版本不得重复。"; exit 2; }
      requested_seen["$version"]=1
      REQUESTED_VERSIONS+=("$version")
    done
    ;;
  verify) shift; [ "$#" -eq 0 ] || { fail "verify 不接受版本参数。"; exit 2; } ;;
  *) fail "命令必须是 ensure 或 verify。"; exit 2 ;;
esac

exec 8>/var/lock/schedule-release.lock
flock -n 8 || { fail "另一项发布或回滚正在执行。"; exit 1; }
exec 9>/var/lock/schedule-client-capability.lock
flock -n 9 || { fail "另一项能力或版本切换正在执行。"; exit 1; }

cd "$DEPLOY_DIR"
validate_environment_file_security
validate_policy_configuration
wait_for_health
probe_version "$(env_value MINIPROGRAM_LEGACY_CLIENT_VERSION)"
probe_unknown_version

if [ "$ACTION" = "verify" ]; then
  echo "[client-version] 版本白名单与能力策略验证通过。"
  exit 0
fi

PREVIOUS_LIST="$(env_value MINIPROGRAM_SUPPORTED_CLIENT_VERSIONS)"
FINAL_LIST="$PREVIOUS_LIST"
declare -a ADDED_VERSIONS=()
for version in "${REQUESTED_VERSIONS[@]}"; do
  case ",$FINAL_LIST," in
    *",$version,"*) ;;
    *) FINAL_LIST="$FINAL_LIST,$version"; ADDED_VERSIONS+=("$version") ;;
  esac
done

if [ "${#ADDED_VERSIONS[@]}" -eq 0 ]; then
  for version in "${REQUESTED_VERSIONS[@]}"; do probe_version "$version"; done
  probe_unknown_version
  echo "[client-version] 请求的版本已存在并通过验证；未重建容器。"
  exit 0
fi

trap cleanup_on_exit EXIT
trap rollback_on_error ERR
trap rollback_on_signal HUP INT QUIT TERM
ENV_CHANGED="true"
write_version_list "$FINAL_LIST"
validate_environment_file_security
validate_policy_configuration
recreate_and_probe "${REQUESTED_VERSIONS[@]}"
ENV_CHANGED="false"
trap - ERR HUP INT QUIT TERM

echo "[client-version] 已追加 ${#ADDED_VERSIONS[@]} 个版本并通过健康与策略验证。"
