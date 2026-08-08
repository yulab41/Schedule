#!/usr/bin/env bash
set -euo pipefail

# 为现有 Nginx 入口绑定域名并启用免费 HTTPS（Let's Encrypt）。
# 用法：bash infra/scripts/enable-https.sh <域名> [证书邮箱]
# 前提：域名 A 记录已指向本机公网 IP；安全组已放行 80/443；大陆服务器域名已完成 ICP 备案。

DOMAIN="${1:?usage: bash infra/scripts/enable-https.sh <域名> [邮箱]}"
EMAIL="${2:-admin@${DOMAIN}}"
DEPLOY_DIR=/opt/schedule
COMPOSE_FILE=infra/docker/compose.prod.yml
WEB_CONF="$DEPLOY_DIR/infra/docker/nginx.prod.conf"
WEB_CONF_BACKUP="$WEB_CONF.before-https"
CERT_DIR="/etc/letsencrypt/live/$DOMAIN"

cd "$DEPLOY_DIR"

echo "[https] DNS 检查（仅提示，不阻断）"
if ! getent hosts "$DOMAIN" >/dev/null 2>&1; then
  echo "警告：$DOMAIN 暂未解析到本机公网 IP，证书签发很可能失败"
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

if [[ ! -f "$WEB_CONF_BACKUP" ]]; then
  cp "$WEB_CONF" "$WEB_CONF_BACKUP"
fi

cat > "$WEB_CONF" <<EOF
server {
    listen 80 default_server;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_comp_level 5;
    gzip_min_length 1024;
    gzip_vary on;
    gzip_types
        text/plain
        text/css
        application/javascript
        application/json
        application/manifest+json
        application/xml
        image/svg+xml
        font/woff2;

    location /api/ {
        proxy_pass http://api:3000/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location = /health {
        proxy_pass http://api:3000/health;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }

    location /assets/ {
        expires 365d;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }

    location = /manifest.webmanifest {
        expires 1h;
        add_header Cache-Control "public";
        try_files \$uri =404;
    }

    location / {
        add_header Cache-Control "no-cache";
        try_files \$uri \$uri/ /index.html;
    }
}

server {
    listen 80;
    server_name $DOMAIN;

    location /.well-known/acme-challenge/ {
        root /usr/share/nginx/html;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    http2 on;
    server_name $DOMAIN;

    ssl_certificate $CERT_DIR/fullchain.pem;
    ssl_certificate_key $CERT_DIR/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_comp_level 5;
    gzip_min_length 1024;
    gzip_vary on;
    gzip_types
        text/plain
        text/css
        application/javascript
        application/json
        application/manifest+json
        application/xml
        image/svg+xml
        font/woff2;

    location /api/ {
        proxy_pass http://api:3000/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    location = /health {
        proxy_pass http://api:3000/health;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }

    location /assets/ {
        expires 365d;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }

    location = /manifest.webmanifest {
        expires 1h;
        add_header Cache-Control "public";
        try_files \$uri =404;
    }

    location / {
        add_header Cache-Control "no-cache";
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

echo "[https] 重建 web 容器以加载证书挂载与 HTTPS 配置"
docker compose --env-file .env.production -f "$COMPOSE_FILE" up -d --force-recreate web

cat > /etc/cron.d/schedule-certbot <<'CRON'
0 3 * * * root certbot renew --quiet --deploy-hook "docker exec medical-schedule-prod-web-1 nginx -s reload" >> /var/log/certbot-renew.log 2>&1
CRON

echo "[https] 完成：https://$DOMAIN"
