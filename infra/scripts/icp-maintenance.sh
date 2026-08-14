#!/usr/bin/env bash
set -euo pipefail

# 可选的备案维护模式：只把正式域名切换到占位页。
# 不创建测试端口、测试 Compose override 或公网 IP 入口。
# 用法：bash infra/scripts/icp-maintenance.sh on|off

DEPLOY_DIR=/opt/schedule
DOMAIN="${ICP_DOMAIN:-hosp.schedule.eylinhome.top}"
CERT_DIR="/etc/letsencrypt/live/$DOMAIN"
WEB_CONF="$DEPLOY_DIR/infra/docker/nginx.prod.conf"
WEB_CONF_BAK="$WEB_CONF.before-icp-maintenance"
PLACEHOLDER="$DEPLOY_DIR/apps/web/dist/icp-placeholder.html"
CTN=medical-schedule-prod-web-1
COMPOSE_FILE="$DEPLOY_DIR/infra/docker/compose.prod.yml"

if [[ "${1:-}" != on && "${1:-}" != off ]]; then
  echo "用法: bash $0 on|off"
  exit 1
fi

reload_nginx() {
  docker exec "$CTN" nginx -t
  docker exec "$CTN" nginx -s reload
  echo "[icp] nginx 已重载"
}

write_placeholder() {
  cat > "$PLACEHOLDER" <<'HTML'
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>网站备案中 - eylinhome.top</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: flex; align-items: center;
      justify-content: center; background: #f5f7fa; color: #1f2329;
      font-family: "PingFang SC", "Microsoft YaHei", sans-serif; }
    .card { max-width: 560px; margin: 24px; padding: 40px 32px; background: #fff;
      border-radius: 12px; box-shadow: 0 8px 24px rgba(0, 0, 0, .06); text-align: center; }
    h1 { font-size: 22px; margin: 0 0 12px; }
    p { font-size: 15px; line-height: 1.7; margin: 0 0 8px; color: #5a5f66; }
  </style>
</head>
<body>
  <main class="card">
    <h1>网站备案中，暂时无法访问</h1>
    <p>本站正在按照工信部要求办理 ICP 备案。</p>
    <p>备案完成后将恢复访问，感谢您的理解。</p>
  </main>
</body>
</html>
HTML
}

write_maintenance_conf() {
  cat > "$WEB_CONF" <<EOF
# ICP 备案维护页（由 icp-maintenance.sh on 生成）
server {
    listen 443 ssl default_server;
    server_name _;
    ssl_reject_handshake on;
}

server {
    listen 80 default_server;
    server_name _;
    return 444;
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

    location = /icp-placeholder.html {
        add_header Cache-Control "no-store";
    }

    location / {
        return 302 /icp-placeholder.html;
    }
}
EOF
}

cd "$DEPLOY_DIR"
if [[ "$1" == on ]]; then
  if [[ -f "$WEB_CONF_BAK" ]]; then
    echo "[icp] 已是备案维护模式，无需重复开启"
    exit 0
  fi
  test -f "$CERT_DIR/fullchain.pem"
  write_placeholder
  cp -p "$WEB_CONF" "$WEB_CONF_BAK"
  write_maintenance_conf
  docker compose --env-file .env.production -f "$COMPOSE_FILE" up -d web
  reload_nginx
  echo "[icp] 已开启备案维护页：仅正式域名显示占位页"
else
  if [[ ! -f "$WEB_CONF_BAK" ]]; then
    echo "[icp] 当前不是备案维护模式（无备份），无需恢复"
    exit 0
  fi
  cp -p "$WEB_CONF_BAK" "$WEB_CONF"
  docker compose --env-file .env.production -f "$COMPOSE_FILE" up -d web
  rm -f "$WEB_CONF_BAK" "$PLACEHOLDER"
  reload_nginx
  echo "[icp] 已恢复正式站点"
fi
