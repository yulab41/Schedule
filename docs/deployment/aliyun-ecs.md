# Aliyun ECS Docker 部署

> 2026-08-06：Web 1.0 从腾讯云 CloudBase 迁移到阿里云 ECS 试用机
> （`8.148.183.46`，Ubuntu 22.04，Docker 预装）。
> 2026-08-07：CloudBase 已弃用并清理；部署目标固定为阿里云 ECS。
> 试用期认证以开发模式运行（`NODE_ENV=development` + `AUTH_DEV_MODE=true`），
> 自建认证改造见后续任务；正式上线前必须切回 `NODE_ENV=production`。

## 架构

```
用户 ── HTTP :80 ──> Nginx (web 容器)
                        │ /api/* 去掉前缀后转发
                        ▼
                     Fastify (api 容器) ──> MySQL 8.4 (mysql 容器)
```

三个容器都在同一台 ECS 上：

- `mysql`：数据卷 `schedule_mysql_data`
- `api`：Fastify 服务，数据卷 `schedule_backups`（`BACKUP_DIR=/data/backups`）
- `web`：Nginx 提供 Vue SPA 静态文件并反向代理 `/api`；试用机上的 `web`
  服务直接挂载本机构建的 `apps/web/dist`（不在这台 1.6G 内存的 ECS 上编译）

## 首次部署

```bash
cd /opt/schedule
cp .env.production.example .env.production   # 生成随机密码并填写
docker compose --env-file .env.production -f infra/docker/compose.prod.yml pull mysql nginx
# 在本机构建前端：pnpm --filter @schedule/web exec vite build，然后上传 apps/web/dist
docker compose --env-file .env.production -f infra/docker/compose.prod.yml up -d
docker compose --env-file .env.production -f infra/docker/compose.prod.yml run --rm api node apps/api/dist/migrate.js
```

健康检查：

```bash
curl -s http://127.0.0.1/health
curl -s http://127.0.0.1/api/health
```

> 启用下面的临时门禁后，健康检查需带用户名/密码：
> `curl -u <试用用户名>:<密码> -s http://127.0.0.1/health`

## 试用期临时门禁（浏览器密码提示）

当前公网试用机以开发模式认证运行（`NODE_ENV=development` + `AUTH_DEV_MODE=true`），
任何能构造 Bearer token 的请求都可以冒充任意用户（含管理员）。在自建/微信登录落地前，
Nginx 增加浏览器密码提示（HTTP Basic Auth）作为临时门禁。

> **这是非正式测试阶段的临时措施**：微信小程序上线、网页改用微信账号登录后，
> 必须按下面的“关闭门禁”移除它，否则用户无法直接登录网页。

### 启用门禁

1. 在服务器上生成密码文件（任选一种）：
   - OpenSSL：`printf 'trial:%s\n' "$(openssl passwd -apr1 '<换成强密码>')" > infra/docker/.htpasswd`
   - Apache htpasswd 容器：`docker run --rm httpd:2.4-alpine htpasswd -nbB trial '<换成强密码>' > infra/docker/.htpasswd`
2. 收紧文件权限：`chmod 600 infra/docker/.htpasswd`
3. 在 `.env.production` 设置 `NGINX_BASIC_AUTH_REALM=Trial_access`
   （任意非 `off` 值都表示开启；`off` 表示不拦截）。
4. 重建并重启 web 容器：
   `docker compose --env-file .env.production -f infra/docker/compose.prod.yml up -d --force-recreate web`
5. 验证门禁：
   - `curl -i http://127.0.0.1/` → `401 Unauthorized`
   - `curl -u trial:'<密码>' http://127.0.0.1/` → `200 OK`
   - 浏览器打开 `http://8.148.183.46` 会先弹出“用户名+密码”提示，输入正确后才能进入。

### 关闭门禁（微信/正式上线前必须执行）

1. 在 `.env.production` 把 `NGINX_BASIC_AUTH_REALM` 改为 `off`，重建 web 容器（同上面第 4 步）。
2. 正式改用微信账号登录后，从 `infra/docker/compose.prod.yml` 删除
   `.htpasswd` 挂载，从 `nginx.prod.conf.template` 删除 `auth_basic` 两行，
   并删除服务器上的 `infra/docker/.htpasswd` 文件。

## 环境变量

`MYSQL_DATABASE`、`MYSQL_USER`、`MYSQL_PASSWORD`、`MYSQL_ROOT_PASSWORD`：
MySQL 数据库名和账号（`api` 容器通过 compose 网络连接 `mysql:3306`）。

`BACKUP_ENCRYPTION_KEY`：32 字节（64 位 hex 或 base64），备份失败即关闭。

`VAPID_*`：Web Push 可选；不配置时推送功能停用。

`HOLIDAY_ADMIN_UIDS` / `PLATFORM_ADMIN_UIDS`：开发模式下为测试 UID
（例如 `local-admin`），自建认证落地后改为正式 UID。

## 当前限制与后续任务

- 认证为开发模式（页面提供“本地管理员/本地成员”按钮），正式上线前必须完成
  自建登录认证改造（当前无账号密码后端）；试用期同时启用 Nginx 浏览器密码门禁
  （临时措施，微信小程序上线、网页改用微信账号登录时必须移除）。
- 暂未配置 HTTPS / 自定义域名 / ICP 备案；微信小程序上线前按
  `docs/deployment/dns-and-https.md` 与 `icp-checklist.md` 补齐。
- 定时任务（duty reminders 等）暂未在 Docker 中配置 cron，需后续补充。
- 腾讯云 CynosDB 历史数据迁移需要数据库连接凭据，另行确认后执行。
