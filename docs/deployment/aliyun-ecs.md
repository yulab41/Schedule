# Aliyun ECS Docker 部署

> 2026-08-06：Web 1.0 从腾讯云 CloudBase 迁移到阿里云 ECS 试用机
> （`8.148.183.46`，Ubuntu 22.04，Docker 预装）。
> 2026-08-07：CloudBase 已弃用并清理；部署目标固定为阿里云 ECS。
> 试用期认证以开发模式运行（`NODE_ENV=development` + `AUTH_DEV_MODE=true`），
> 自建认证改造见后续任务；正式上线前必须切回 `NODE_ENV=production`。

> **部署前必读**：`docs/deployment/ecs-deployment-pitfalls.md`（踩坑与铁律：远程命令引号、依赖树拍平、挂载目录重建、部署后验证清单）。

> 2026-08-08：正式试用目标切换为新 ECS `120.77.220.79`（2 vCPU / 2 GiB / 40G，Ubuntu 22.04，Docker 预装），全新部署；旧试用机 `8.148.183.46` 保留为历史环境。

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

## 一键全新部署（推荐）

```bash
# 本机：构建并打包（含 apps/*/dist、packages/*/dist、runtime/api-flat/node_modules、infra/docker、migrations、infra/scripts/dist、infra/holidays）
pnpm build
tar -czf runtime/schedule-deploy-YYYYMMDD.tar.gz apps/web/dist apps/api/dist packages/contracts/dist packages/database/dist packages/scheduling-domain/dist infra/docker migrations .env.production.example runtime/api-flat/node_modules infra/scripts/dist infra/holidays

# 上传并执行一键引导（自动生成随机密码、2G swap、监控/备份/清理 cron、pull + up + migrate + 导入确认 2026 节假日 + 验证）
scp runtime/schedule-deploy-YYYYMMDD.tar.gz root@120.77.220.79:/tmp/
ssh root@120.77.220.79 'mkdir -p /opt/schedule && tar -xzf /tmp/schedule-deploy-YYYYMMDD.tar.gz -C /opt/schedule && bash /opt/schedule/infra/scripts/ecs-bootstrap.sh /tmp/schedule-deploy-YYYYMMDD.tar.gz'
```

## 省带宽实践（2026-08-08，不上 OSS）

- 静态资源已开 gzip（文本/JSON/CSS/JS/SVG/WOFF2）与浏览器缓存（带 hash 的资源 365 天 immutable，入口 HTML 不缓存）。
- PWA 会缓存应用壳与排班数据，重复访问基本不再消耗公网带宽。
- 后续接 HTTPS 后可升级 HTTP/2/3 与 brotli（Caddy 自带，或换带 brotli 模块的 Nginx），预计再省 15–20% 传输量。
- 可选优化：HomeView 大包（约 160KB gzip）进一步按页面拆包，降低首次访问带宽。
- 3 Mbps 出口带宽下，图片/文件等大资源若未来增多，再按需考虑 CDN，不强制上对象存储。

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

> 试用期 Nginx 浏览器密码门禁已于 2026-08-08 撤除：该门禁（HTTP Basic Auth）
> 与网页登录携带的 Bearer 身份令牌在同一个 `Authorization` 头上冲突，导致
> 登录请求反复弹密码框。正式账号/微信登录落地前不再启用门禁，公网入口保持
> 开发模式认证（`NODE_ENV=development` + `AUTH_DEV_MODE=true`）。

## 更新代码（试用机不编译）

试用机不安装依赖、不构建镜像；API 代码由宿主挂载覆盖，前端由 Nginx 挂载 dist。

1. 本机构建全部产物：`pnpm build`（生成 `apps/web/dist`、`apps/api/dist`、`packages/*/dist`）。
2. API 依赖变化时重新生成拍平依赖树：
   ```bash
   pnpm deploy --legacy --filter @schedule/api --prod <临时目录>
   tar -cf <临时目录>/api-flat.tar -C <临时目录> --dereference node_modules
   mkdir -p runtime/api-flat && tar -xf <临时目录>/api-flat.tar -C runtime/api-flat
   ```
3. 上传 `apps/web/dist`、`apps/api/dist`、`packages/*/dist`、`runtime/api-flat/node_modules`
   到 `/opt/schedule` 对应目录（旧的 `node_modules` 建议先移走保留，确认可用后再清理）。
4. 重建 API 与 Web 容器：
   `docker compose --env-file .env.production -f infra/docker/compose.prod.yml up -d --force-recreate api web`
5. 验证：`curl -s http://127.0.0.1/api/health` 返回 `{"component":"api","ready":true,...}`；
   容器内确认旧 CloudBase 依赖已移除：`docker exec medical-schedule-prod-api-1 ls /app/apps/api/node_modules/@cloudbase` 应报不存在。

## 环境变量

`MYSQL_DATABASE`、`MYSQL_USER`、`MYSQL_PASSWORD`、`MYSQL_ROOT_PASSWORD`：
MySQL 数据库名和账号（`api` 容器通过 compose 网络连接 `mysql:3306`）。

`BACKUP_ENCRYPTION_KEY`：32 字节（64 位 hex 或 base64），备份失败即关闭。

`VAPID_*`：Web Push 可选；不配置时推送功能停用。

`HOLIDAY_ADMIN_UIDS` / `PLATFORM_ADMIN_UIDS`：开发模式下为测试 UID
（例如 `local-admin`），自建认证落地后改为正式 UID。

## 当前限制与后续任务

- 认证为开发模式（页面提供“本地管理员/本地成员”按钮），正式上线前必须完成
  自建登录认证改造（当前无账号密码后端）。
- 暂未配置 HTTPS / 自定义域名 / ICP 备案；微信小程序上线前按
  `docs/deployment/dns-and-https.md` 与 `icp-checklist.md` 补齐。
- 定时任务（duty reminders 等）暂未在 Docker 中配置 cron，需后续补充。
- 腾讯云 CynosDB 历史数据迁移需要数据库连接凭据，另行确认后执行。
