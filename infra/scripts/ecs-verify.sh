#!/usr/bin/env bash
# 部署后验证：健康检查、dist MD5、前端资源、依赖树、迁移计数
set -euo pipefail

echo "[verify] api health (127.0.0.1:8080)"
curl -s -o /dev/null -w 'http=%{http_code}\n' http://127.0.0.1:8080/api/health
curl -s http://127.0.0.1:8080/api/health
echo

echo "[verify] api health (Host: hosp.schedule.eylinhome.top)"
curl -s -o /dev/null -w 'http=%{http_code}\n' \
  -H 'Host: hosp.schedule.eylinhome.top' http://127.0.0.1/api/health

echo "[verify] local-server.js md5"
md5sum /opt/schedule/apps/api/dist/local-server.js

echo "[verify] web index asset"
curl -s http://127.0.0.1:8080/ | grep -o 'assets/HomeView-[^"]*\.js' | head -1

echo "[verify] cloudbase dependency"
if docker exec medical-schedule-prod-api-1 \
  ls /app/apps/api/node_modules/@cloudbase >/dev/null 2>&1; then
  echo "FAIL: @cloudbase still present"
  exit 1
fi
echo "ok: no @cloudbase"

echo "[verify] migration count"
docker exec medical-schedule-prod-mysql-1 sh -c \
  'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -D "$MYSQL_DATABASE" \
    -e "SELECT COUNT(*) FROM __drizzle_migrations"'
