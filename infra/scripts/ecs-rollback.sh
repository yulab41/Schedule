#!/usr/bin/env bash
# Roll back application artifacts to one retained immutable release. Database data is preserved.
# Usage: schedule-ecs-rollback <40-character-release-id>
set -Eeuo pipefail

DEPLOY_DIR="/opt/schedule"
UPDATE_SCRIPT="/usr/local/lib/schedule/ecs-update.sh"
VERIFY_SCRIPT="/usr/local/lib/schedule/ecs-verify.sh"
BACKUP_SCRIPT="/usr/local/lib/schedule/schedule-backup.sh"
TARGET_RELEASE="${1:-}"
ROLLBACK_TMP=""
ORIGINAL_RELEASE=""
ROLLBACK_APPLIED="false"

fail() {
  echo "[rollback] 错误：$*" >&2
  return 1
}

manifest_value() {
  local manifest="$1"
  local key="$2"
  sed -nE "s/.*\"${key}\"[[:space:]]*:[[:space:]]*\"([^\"]+)\".*/\\1/p" \
    "$manifest" | head -1
}

cleanup() {
  if [ -n "$ROLLBACK_TMP" ]; then
    case "$ROLLBACK_TMP" in
      "$DEPLOY_DIR"/.rollback.*) rm -rf -- "$ROLLBACK_TMP" ;;
      *) echo "[rollback] 拒绝清理越界临时目录。" >&2 ;;
    esac
  fi
}

restore_original_release() {
  echo "[rollback] 目标版本校验失败，自动前滚回原 release $ORIGINAL_RELEASE。" >&2
  SCHEDULE_PRESERVE_CONTROL_PLANE=true SCHEDULE_RELEASE_LOCK_FD=9 bash "$UPDATE_SCRIPT" \
    "$ROLLBACK_TMP/original-schedule-dist.tar.gz" \
    "$ROLLBACK_TMP/original-api-flat.tar.zst" \
    "$ROLLBACK_TMP/original-deploy-manifest.json" || return 1
  bash "$VERIFY_SCRIPT" || return 1
  ROLLBACK_APPLIED="false"
}

rollback_on_error() {
  local status=$?
  trap - ERR HUP INT TERM
  if [ "$ROLLBACK_APPLIED" = "true" ]; then
    restore_original_release ||
      echo "[rollback] 自动前滚失败，需立即人工恢复原 release $ORIGINAL_RELEASE。" >&2
  fi
  exit "$status"
}

rollback_on_signal() {
  trap - ERR HUP INT TERM
  if [ "$ROLLBACK_APPLIED" = "true" ]; then
    restore_original_release ||
      echo "[rollback] 终止后的自动前滚失败，需立即人工恢复原 release $ORIGINAL_RELEASE。" >&2
  fi
  exit 143
}

if [ "$(id -u)" -ne 0 ]; then
  fail "必须以 root 执行。"
  exit 1
fi
if [[ ! "$TARGET_RELEASE" =~ ^[0-9a-f]{40}$ ]]; then
  fail "release id 必须是 40 位小写十六进制 Git commit。"
  exit 2
fi

exec 9>/var/lock/schedule-release.lock
flock -n 9 || { fail "另一项发布或回滚正在执行。"; exit 1; }

TARGET_DIR="$(readlink -f -- "$DEPLOY_DIR/releases/$TARGET_RELEASE")"
EXPECTED_TARGET_DIR="$DEPLOY_DIR/releases/$TARGET_RELEASE"
if [ "$TARGET_DIR" != "$EXPECTED_TARGET_DIR" ] || [ ! -d "$TARGET_DIR" ]; then
  fail "目标 release 不存在或路径越界。"
  exit 1
fi
ORIGINAL_RELEASE="$(cat "$DEPLOY_DIR/current-release" 2>/dev/null || true)"
if [[ ! "$ORIGINAL_RELEASE" =~ ^[0-9a-f]{40}$ ]]; then
  fail "current-release 无效。"
  exit 1
fi
if [ "$ORIGINAL_RELEASE" = "$TARGET_RELEASE" ]; then
  fail "目标 release 已经是当前版本。"
  exit 1
fi
ALLOWED_ROLLBACK_CANDIDATE="$(manifest_value "$DEPLOY_DIR/deploy-manifest.json" rollbackCandidate)"
if [[ ! "$ALLOWED_ROLLBACK_CANDIDATE" =~ ^[0-9a-f]{40}$ ]] ||
  [ "$TARGET_RELEASE" != "$ALLOWED_ROLLBACK_CANDIDATE" ]; then
  fail "目标 release 不是当前 manifest 显式审计的直接 rollback candidate。"
  exit 1
fi
ORIGINAL_DIR="$(readlink -f -- "$DEPLOY_DIR/releases/$ORIGINAL_RELEASE")"
if [ "$ORIGINAL_DIR" != "$DEPLOY_DIR/releases/$ORIGINAL_RELEASE" ] || [ ! -d "$ORIGINAL_DIR" ]; then
  fail "原 release 不存在或路径越界，无法提供失败补偿。"
  exit 1
fi

DIST_SOURCE="$TARGET_DIR/schedule-dist.tar.gz"
FLAT_SOURCE="$TARGET_DIR/api-flat.tar.zst"
MANIFEST_SOURCE="$TARGET_DIR/deploy-manifest.json"
for required_file in "$DIST_SOURCE" "$FLAT_SOURCE" "$MANIFEST_SOURCE"; do
  [ -f "$required_file" ] || { fail "目标 release 缺少 $(basename "$required_file")。"; exit 1; }
done
for original_file in \
  "$ORIGINAL_DIR/schedule-dist.tar.gz" \
  "$ORIGINAL_DIR/api-flat.tar.zst" \
  "$ORIGINAL_DIR/deploy-manifest.json"; do
  [ -f "$original_file" ] || { fail "原 release 缺少 $(basename "$original_file")。"; exit 1; }
done
for trusted_script in "$UPDATE_SCRIPT" "$VERIFY_SCRIPT" "$BACKUP_SCRIPT"; do
  [ -f "$trusted_script" ] && [ -x "$trusted_script" ] || {
    fail "缺少可信发布控制：$trusted_script。"
    exit 1
  }
  [ "$(stat -c '%u' "$trusted_script")" = "0" ] || {
    fail "可信发布控制不是 root 所有：$trusted_script。"
    exit 1
  }
  if find "$trusted_script" -perm /022 -print -quit | grep -q .; then
    fail "可信发布控制可被非 root 写入：$trusted_script。"
    exit 1
  fi
done

MANIFEST_RELEASE="$(manifest_value "$MANIFEST_SOURCE" releaseId)"
EXPECTED_DIST_SHA="$(manifest_value "$MANIFEST_SOURCE" distArchiveSha256)"
EXPECTED_FLAT_SHA="$(manifest_value "$MANIFEST_SOURCE" apiRuntimeArchiveSha256)"
TARGET_DATABASE_SCHEMA_MIN="$(manifest_value "$MANIFEST_SOURCE" databaseSchemaMin)"
TARGET_DATABASE_SCHEMA_MAX="$(manifest_value "$MANIFEST_SOURCE" databaseSchemaMax)"
if [ -z "$TARGET_DATABASE_SCHEMA_MIN" ] && [ -z "$TARGET_DATABASE_SCHEMA_MAX" ]; then
  TARGET_DATABASE_SCHEMA_MIN="0"
  TARGET_DATABASE_SCHEMA_MAX="49"
fi
if [ "$MANIFEST_RELEASE" != "$TARGET_RELEASE" ] ||
  [[ ! "$EXPECTED_DIST_SHA" =~ ^[0-9a-f]{64}$ ]] ||
  [[ ! "$EXPECTED_FLAT_SHA" =~ ^[0-9a-f]{64}$ ]] ||
  [[ ! "$TARGET_DATABASE_SCHEMA_MIN" =~ ^[0-9]+$ ]] ||
  [[ ! "$TARGET_DATABASE_SCHEMA_MAX" =~ ^[0-9]+$ ]] ||
  [ "$TARGET_DATABASE_SCHEMA_MIN" -gt "$TARGET_DATABASE_SCHEMA_MAX" ]; then
  fail "目标 release 的部署清单无效。"
  exit 1
fi
[ "$(sha256sum "$DIST_SOURCE" | awk '{print $1}')" = "$EXPECTED_DIST_SHA" ] || {
  fail "目标 dist 归档哈希不匹配。"
  exit 1
}
[ "$(sha256sum "$FLAT_SOURCE" | awk '{print $1}')" = "$EXPECTED_FLAT_SHA" ] || {
  fail "目标 API runtime 归档哈希不匹配。"
  exit 1
}
CURRENT_DATABASE_SCHEMA="$(docker exec medical-schedule-prod-mysql-1 sh -c \
  'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -D "$MYSQL_DATABASE" \
  -e "SELECT COUNT(*) FROM __drizzle_migrations"')"
if [[ ! "$CURRENT_DATABASE_SCHEMA" =~ ^[0-9]+$ ]] ||
  [ "$CURRENT_DATABASE_SCHEMA" -lt "$TARGET_DATABASE_SCHEMA_MIN" ] ||
  [ "$CURRENT_DATABASE_SCHEMA" -gt "$TARGET_DATABASE_SCHEMA_MAX" ]; then
  fail "当前数据库 schema $CURRENT_DATABASE_SCHEMA 不在目标应用兼容范围 ${TARGET_DATABASE_SCHEMA_MIN}..${TARGET_DATABASE_SCHEMA_MAX}。"
  exit 1
fi

ROLLBACK_TMP="$(mktemp -d "$DEPLOY_DIR/.rollback.XXXXXX")"
trap cleanup EXIT
cp -- "$TARGET_DIR/schedule-dist.tar.gz" "$ROLLBACK_TMP/schedule-dist.tar.gz"
cp -- "$TARGET_DIR/api-flat.tar.zst" "$ROLLBACK_TMP/api-flat.tar.zst"
cp -- "$TARGET_DIR/deploy-manifest.json" "$ROLLBACK_TMP/deploy-manifest.json"
cp -- "$ORIGINAL_DIR/schedule-dist.tar.gz" "$ROLLBACK_TMP/original-schedule-dist.tar.gz"
cp -- "$ORIGINAL_DIR/api-flat.tar.zst" "$ROLLBACK_TMP/original-api-flat.tar.zst"
cp -- "$ORIGINAL_DIR/deploy-manifest.json" "$ROLLBACK_TMP/original-deploy-manifest.json"
trap rollback_on_error ERR
trap rollback_on_signal HUP INT TERM

echo "[rollback] 1/3 创建独立生产数据库备份（数据库不会降级或覆盖）"
bash "$BACKUP_SCRIPT"
echo "[rollback] 2/3 回退应用文件到 $TARGET_RELEASE"
ROLLBACK_APPLIED="true"
SCHEDULE_PRESERVE_CONTROL_PLANE=true SCHEDULE_RELEASE_LOCK_FD=9 bash "$UPDATE_SCRIPT" \
  "$ROLLBACK_TMP/schedule-dist.tar.gz" \
  "$ROLLBACK_TMP/api-flat.tar.zst" \
  "$ROLLBACK_TMP/deploy-manifest.json"
echo "[rollback] 3/3 执行完整生产校验"
bash "$VERIFY_SCRIPT"
ROLLBACK_APPLIED="false"
trap - ERR HUP INT TERM
echo "[rollback] 应用回退成功：$TARGET_RELEASE；生产数据库保持前向兼容状态。"
