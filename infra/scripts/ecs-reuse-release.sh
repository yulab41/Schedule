#!/usr/bin/env bash
# Promote a hash-identical release manifest without rebuilding or restarting the application.
# The caller must create the required production database backup first.
# Usage: schedule-ecs-reuse-release <new-deploy-manifest.json>
set -Eeuo pipefail

DEPLOY_DIR="/opt/schedule"
CURRENT_MANIFEST="$DEPLOY_DIR/deploy-manifest.json"
CURRENT_RELEASE_FILE="$DEPLOY_DIR/current-release"
VERIFY_SCRIPT="/usr/local/lib/schedule/ecs-verify.sh"
INPUT_MANIFEST="${1:?缺少新 deploy manifest 路径}"
TEMPORARY_DIR=""
NEW_RELEASE_DIR=""
MUTATION_STARTED="false"

fail() {
  echo "[reuse-release] 错误：$*" >&2
  return 1
}

manifest_value() {
  local manifest="$1"
  local key="$2"
  sed -nE "s/.*\"${key}\"[[:space:]]*:[[:space:]]*\"([^\"]+)\".*/\1/p" \
    "$manifest" | head -1
}

restore_previous_metadata() {
  [ "$MUTATION_STARTED" = "true" ] || return 0
  install -o root -g root -m 0644 "$TEMPORARY_DIR/previous-manifest.json" "$CURRENT_MANIFEST"
  install -o root -g root -m 0644 "$TEMPORARY_DIR/previous-current-release" \
    "$CURRENT_RELEASE_FILE"
  if [ -n "$NEW_RELEASE_DIR" ]; then rm -rf -- "$NEW_RELEASE_DIR"; fi
  MUTATION_STARTED="false"
}

rollback_on_error() {
  local status=$?
  trap - ERR
  echo "[reuse-release] 元数据更新失败，正在恢复上一 release。" >&2
  restore_previous_metadata || true
  exit "$status"
}

rollback_on_signal() {
  trap - HUP INT QUIT TERM
  restore_previous_metadata || true
  exit 143
}

cleanup_on_exit() {
  local status=$?
  trap - EXIT ERR HUP INT QUIT TERM
  if [ "$MUTATION_STARTED" = "true" ]; then restore_previous_metadata || true; fi
  [ -z "$TEMPORARY_DIR" ] || rm -rf -- "$TEMPORARY_DIR"
  exit "$status"
}

if [ "$(id -u)" -ne 0 ]; then fail "必须以 root 执行。"; exit 1; fi
[ -f "$INPUT_MANIFEST" ] && [ ! -L "$INPUT_MANIFEST" ] || {
  fail "新 manifest 必须是普通文件。"; exit 1;
}
INPUT_MANIFEST="$(readlink -f -- "$INPUT_MANIFEST")"
[ -f "$CURRENT_MANIFEST" ] && [ -f "$CURRENT_RELEASE_FILE" ] && [ -x "$VERIFY_SCRIPT" ] || {
  fail "当前可信 release 元数据或 verifier 缺失。"; exit 1;
}

exec 9>/var/lock/schedule-release.lock
flock -n 9 || { fail "另一项发布或回滚正在执行。"; exit 1; }

CURRENT_RELEASE="$(tr -d '\r\n' < "$CURRENT_RELEASE_FILE")"
CURRENT_MANIFEST_RELEASE="$(manifest_value "$CURRENT_MANIFEST" releaseId)"
NEW_RELEASE="$(manifest_value "$INPUT_MANIFEST" releaseId)"
NEW_GIT_COMMIT="$(manifest_value "$INPUT_MANIFEST" gitCommit)"
NEW_ROLLBACK="$(manifest_value "$INPUT_MANIFEST" rollbackCandidate)"
for value in "$CURRENT_RELEASE" "$CURRENT_MANIFEST_RELEASE" "$NEW_RELEASE" "$NEW_GIT_COMMIT"; do
  [[ "$value" =~ ^[0-9a-f]{40}$ ]] || { fail "release 标识无效。"; exit 1; }
done
[ "$CURRENT_MANIFEST_RELEASE" = "$CURRENT_RELEASE" ] || {
  fail "当前 manifest 与 current-release 不一致。"; exit 1;
}
[ "$NEW_RELEASE" = "$NEW_GIT_COMMIT" ] && [ "$NEW_RELEASE" != "$CURRENT_RELEASE" ] || {
  fail "新 releaseId/gitCommit 必须一致且不同于当前 release。"; exit 1;
}
[ "$NEW_ROLLBACK" = "$CURRENT_RELEASE" ] || {
  fail "hash-identical release 的 rollbackCandidate 必须是当前 release。"; exit 1;
}

for key in \
  releaseFeatureLevel databaseSchemaMin databaseSchemaMax authMode lockfileSha256 \
  distArchiveSha256 apiRuntimeArchiveSha256 webDistTreeSha256 apiDistTreeSha256 \
  contractsDistTreeSha256 databaseDistTreeSha256 schedulingDomainDistTreeSha256 \
  infraScriptsDistTreeSha256 migrationsTreeSha256 composeProdSha256 nginxConfigSha256 \
  notificationSchedulerSha256 backupSchedulerSha256 privacyRetentionSchedulerSha256 \
  ecsUpdateSha256 ecsVerifySha256 ecsRollbackSha256 clientCapabilitySwitchSha256 \
  clientVersionAllowlistSha256; do
  current_value="$(manifest_value "$CURRENT_MANIFEST" "$key")"
  next_value="$(manifest_value "$INPUT_MANIFEST" "$key")"
  [ -n "$current_value" ] && [ "$next_value" = "$current_value" ] || {
    fail "artifact/control key 不同，必须使用完整部署：$key"; exit 1;
  }
done

CURRENT_RELEASE_DIR="$DEPLOY_DIR/releases/$CURRENT_RELEASE"
CURRENT_DIST="$CURRENT_RELEASE_DIR/schedule-dist.tar.gz"
CURRENT_FLAT="$CURRENT_RELEASE_DIR/api-flat.tar.zst"
[ -f "$CURRENT_DIST" ] && [ -f "$CURRENT_FLAT" ] || {
  fail "当前 release 缺少 retained archives。"; exit 1;
}
[ "$(sha256sum "$CURRENT_DIST" | awk '{print $1}')" = \
  "$(manifest_value "$INPUT_MANIFEST" distArchiveSha256)" ] || {
  fail "当前 dist archive 与新 manifest 不一致。"; exit 1;
}
[ "$(sha256sum "$CURRENT_FLAT" | awk '{print $1}')" = \
  "$(manifest_value "$INPUT_MANIFEST" apiRuntimeArchiveSha256)" ] || {
  fail "当前 API runtime archive 与新 manifest 不一致。"; exit 1;
}

cd "$DEPLOY_DIR"
bash "$VERIFY_SCRIPT"

NEW_RELEASE_DIR="$DEPLOY_DIR/releases/$NEW_RELEASE"
[ ! -e "$NEW_RELEASE_DIR" ] || { fail "目标 release 目录已存在。"; exit 1; }
TEMPORARY_DIR="$(mktemp -d "$DEPLOY_DIR/.reuse-release.XXXXXX")"
install -o root -g root -m 0644 "$CURRENT_MANIFEST" "$TEMPORARY_DIR/previous-manifest.json"
install -o root -g root -m 0644 "$CURRENT_RELEASE_FILE" \
  "$TEMPORARY_DIR/previous-current-release"

trap cleanup_on_exit EXIT
trap rollback_on_error ERR
trap rollback_on_signal HUP INT QUIT TERM
MUTATION_STARTED="true"
mkdir -p "$NEW_RELEASE_DIR"
cp --reflink=auto -- "$CURRENT_DIST" "$NEW_RELEASE_DIR/schedule-dist.tar.gz"
cp --reflink=auto -- "$CURRENT_FLAT" "$NEW_RELEASE_DIR/api-flat.tar.zst"
install -o root -g root -m 0644 "$INPUT_MANIFEST" "$NEW_RELEASE_DIR/deploy-manifest.json"
install -o root -g root -m 0644 "$INPUT_MANIFEST" "$TEMPORARY_DIR/new-manifest.json"
printf '%s\n' "$NEW_RELEASE" > "$TEMPORARY_DIR/new-current-release"
chown root:root "$TEMPORARY_DIR/new-current-release"
chmod 0644 "$TEMPORARY_DIR/new-current-release"
mv -fT -- "$TEMPORARY_DIR/new-manifest.json" "$CURRENT_MANIFEST"
mv -fT -- "$TEMPORARY_DIR/new-current-release" "$CURRENT_RELEASE_FILE"

bash "$VERIFY_SCRIPT"
MUTATION_STARTED="false"
trap - ERR HUP INT QUIT TERM

echo "[reuse-release] hash-identical release 已无停机切换：$NEW_RELEASE"
