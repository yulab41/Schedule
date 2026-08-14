#!/usr/bin/env bash
set -euo pipefail

# 为已经备案的正式域名申请/续期 HTTPS 证书。
# 用法：bash infra/scripts/enable-https.sh hosp.schedule.eylinhome.top [邮箱]
# 该脚本只更新证书并重载现有域名专属 Nginx 配置，不生成 IP/default 静态站点。

DOMAIN="${1:?usage: bash infra/scripts/enable-https.sh hosp.schedule.eylinhome.top [邮箱]}"
EMAIL="${2:-admin@${DOMAIN}}"
EXPECTED_DOMAIN=hosp.schedule.eylinhome.top
DEPLOY_DIR=/opt/schedule
COMPOSE_FILE=infra/docker/compose.prod.yml
CERT_DIR="/etc/letsencrypt/live/$DOMAIN"

if [[ "$DOMAIN" != "$EXPECTED_DOMAIN" ]]; then
  echo "错误：本项目只允许为 $EXPECTED_DOMAIN 申请证书。" >&2
  exit 1
fi

cd "$DEPLOY_DIR"

echo "[https] DNS 检查（仅提示，不阻断）"
if ! getent hosts "$DOMAIN" >/dev/null 2>&1; then
  echo "警告：$DOMAIN 暂未解析到本机，证书签发很可能失败" >&2
fi

if ! command -v certbot >/dev/null 2>&1; then
  echo "[https] 安装 certbot"
  apt-get update -qq
  apt-get install -y -qq certbot
fi

echo "[https] 通过 HTTP-01 申请免费证书"
certbot certonly --webroot -w apps/web/dist -d "$DOMAIN" \
  --email "$EMAIL" --agree-tos --non-interactive --keep-until-expiring

test -f "$CERT_DIR/fullchain.pem"
test -f "$CERT_DIR/privkey.pem"

echo "[https] 重建 web 容器以加载证书挂载与域名专属配置"
docker compose --env-file .env.production -f "$COMPOSE_FILE" up -d --force-recreate web

cat > /etc/cron.d/schedule-certbot <<'CRON'
0 3 * * * root certbot renew --quiet --deploy-hook "docker exec medical-schedule-prod-web-1 nginx -s reload" >> /var/log/certbot-renew.log 2>&1
CRON

echo "[https] 完成：https://$DOMAIN"
