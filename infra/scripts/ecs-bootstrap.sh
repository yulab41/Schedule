#!/usr/bin/env bash
set -euo pipefail

# 阿里云 ECS 全新部署引导（2G 小机器，2026-08-08 用户要求）。
# 用法：bash infra/scripts/ecs-bootstrap.sh /tmp/schedule-deploy.tar.gz

DEPLOY_DIR=/opt/schedule
BUNDLE=${1:-/tmp/schedule-deploy.tar.gz}
COMPOSE_FILE=infra/docker/compose.prod.yml

if [[ ! -f "$BUNDLE" ]]; then
  echo "usage: $0 <deploy-bundle.tar.gz>"
  exit 1
fi

command -v docker >/dev/null 2>&1 || {
  echo "Docker is required but not installed."
  exit 1
}
docker compose version >/dev/null 2>&1 || {
  echo "Docker Compose plugin is required."
  exit 1
}

echo "[bootstrap] extracting bundle to $DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"
tar -xzf "$BUNDLE" -C "$DEPLOY_DIR"
cd "$DEPLOY_DIR"

# The flat tree copies @schedule/database, whose default migrations folder
# resolves relative to that copy as node_modules/migrations. Keep a real copy
# at the top level of the flat tree so `migrate.js` works.
mkdir -p runtime/api-flat/node_modules/migrations
cp -r migrations/. runtime/api-flat/node_modules/migrations/

if [[ ! -f .env.production ]]; then
  echo "[bootstrap] generating .env.production with random secrets"
  cp .env.production.example .env.production
  random_hex() { openssl rand -hex 16; }
  random_hex64() { openssl rand -hex 32; }
  sed -i "s/^MYSQL_PASSWORD=.*/MYSQL_PASSWORD=$(random_hex)/" .env.production
  sed -i "s/^MYSQL_ROOT_PASSWORD=.*/MYSQL_ROOT_PASSWORD=$(random_hex)/" .env.production
  sed -i "s/^BACKUP_ENCRYPTION_KEY=.*/BACKUP_ENCRYPTION_KEY=$(random_hex64)/" .env.production
fi

if ! swapon --show | grep -q .; then
  echo "[bootstrap] adding 2G swap"
  if ! fallocate -l 2G /swapfile; then
    dd if=/dev/zero of=/swapfile bs=1M count=2048
  fi
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
echo 'vm.swappiness=10' > /etc/sysctl.d/99-schedule-swap.conf
sysctl -p /etc/sysctl.d/99-schedule-swap.conf >/dev/null

echo "[bootstrap] installing monitoring, backup and cleanup cron"
install -m 0755 infra/scripts/schedule-monitor.sh /usr/local/bin/schedule-monitor
cat > /etc/cron.d/schedule-monitor <<'EOF'
*/5 * * * * root /usr/local/bin/schedule-monitor >> /var/log/schedule-monitor.log 2>&1
EOF
cat > /etc/cron.d/schedule-backup <<'EOF'
30 3 * * * root /opt/schedule/infra/scripts/schedule-backup.sh >> /var/log/schedule-backup.log 2>&1
EOF
cat > /etc/cron.d/schedule-docker-prune <<'EOF'
0 4 * * 0 root docker image prune -f --filter "until=168h" && docker builder prune -f --filter "until=168h"
EOF
cat > /etc/logrotate.d/schedule <<'EOF'
/var/log/schedule-monitor.log /var/log/schedule-backup.log {
  weekly
  rotate 4
  compress
  missingok
  notifempty
}
EOF

echo "[bootstrap] pulling mysql and nginx images"
docker compose --env-file .env.production -f "$COMPOSE_FILE" pull mysql web

echo "[bootstrap] starting containers"
docker compose --env-file .env.production -f "$COMPOSE_FILE" up -d

echo "[bootstrap] waiting for mysql to be healthy"
mysql_container="$(docker compose --env-file .env.production -f "$COMPOSE_FILE" ps -q mysql)"
for _ in $(seq 1 60); do
  status="$(docker inspect --format '{{.State.Health.Status}}' "$mysql_container" 2>/dev/null || true)"
  if [[ "$status" == "healthy" ]]; then
    break
  fi
  sleep 2
done
if [[ "$(docker inspect --format '{{.State.Health.Status}}' "$mysql_container")" != "healthy" ]]; then
  echo "mysql did not become healthy"
  docker compose --env-file .env.production -f "$COMPOSE_FILE" logs --tail 80 mysql
  exit 1
fi

echo "[bootstrap] running database migrations"
docker compose --env-file .env.production -f "$COMPOSE_FILE" run --rm api node apps/api/dist/migrate.js

echo "[bootstrap] importing and confirming 2026 holidays"
import_output="$(docker compose --env-file .env.production -f "$COMPOSE_FILE" run --rm api node infra/scripts/dist/import-holidays.js --file=infra/holidays/holidays-2026.json --year=2026)"
echo "$import_output"
calendar_version_id="$(printf '%s' "$import_output" | sed -n 's/.*"calendarVersionId":"\([^"]*\)".*/\1/p' | head -1)"
if [[ -z "$calendar_version_id" ]]; then
  echo "holiday import did not return a calendarVersionId"
  exit 1
fi

echo "[bootstrap] provisioning dev-mode users"
curl -sS -o /dev/null -X POST \
  -H "Authorization: Bearer local-admin" \
  -H "Content-Type: application/json" \
  -d '{"realName":"本地管理员"}' \
  http://127.0.0.1/api/users || true
curl -sS -o /dev/null -X POST \
  -H "Authorization: Bearer local-member" \
  -H "Content-Type: application/json" \
  -d '{"realName":"本地成员"}' \
  http://127.0.0.1/api/users || true

curl -fsS -X POST \
  -H "Authorization: Bearer local-admin" \
  "http://127.0.0.1/api/holidays/versions/${calendar_version_id}/confirm" >/dev/null
echo "[bootstrap] holidays confirmed"

echo "[bootstrap] verification"
curl -fsS http://127.0.0.1/api/health
echo
curl -fsS http://127.0.0.1/ | grep -q 'assets/' && echo "web dist is being served"

echo "[bootstrap] done"
