# 阿里云 ECS 部署踩坑与铁律（实战总结 2026-08-08）

> 适用范围：试用机 `8.148.183.46`（服务器不编译、代码/依赖全部由宿主机挂载）的每次代码更新与配置变更。
> **部署前必须完整阅读本文件**，与 `docs/deployment/aliyun-ecs.md` 配合使用。
> 来源：fix-progress 轮次 42/52 实战（门禁反复弹框、依赖树拍平失败、挂载目录不更新等）。

## 0. 部署前必读：2G 小机器资源铁律（2026-08-08 用户要求）

1. **单机单入口 + 自动 HTTPS**：一个 Nginx/Caddy 入口按子域名路由所有服务；接域名并完成 ICP 备案后启用自动 HTTPS（Caddy 自动签发，或 Nginx + ACME）。
2. **复用同一个 MySQL**：每个应用建独立 database 与独立账号，禁止一个应用起一个 MySQL 容器（2G 机器上最浪费内存的写法）。
3. **静态资源全部 OSS/COS + CDN**：图片、文件、前端包都别放服务器磁盘；本项目前端构建产物由开发机构建后挂载（已按此模式执行），继续维持。
4. **容器资源与压缩**：容器必须设内存上限；开启 gzip/brotli 压缩与浏览器缓存；容器日志 json-file 轮转；定期清理 Docker 镜像与构建缓存。
5. **swap/ZRAM 兜底 + 监控**：加 1–2G swap 或 ZRAM；监控只需 `free` + `docker stats`（已由 `infra/scripts/schedule-monitor.sh` + cron 落地）。
6. **备份优先于扩容**：MySQL 定时 `mysqldump` 加密后推 OSS（当前已定时加密备份到命名卷；OSS 推送待 ossutil 与凭据配置后补充）。

## 一、命令执行铁律（PowerShell → SSH）

1. **不要用 PowerShell 双引号字符串拼远程命令**。内嵌双引号会被吞掉，导致：
   - `printf "admin:%s\n" ...` 的 `\n` 变成字面 `n`，密码文件被写坏（轮次 42 实测）；
   - `.env` 追加变量时 `\n` 变成 `n`，门禁提示名变成 `Trial_accessn`；
   - `docker ps --format "{{.Names}}..."` 的管道/花括号被 shell 拆坏。
2. **不要用 `ssh "echo $(curl ...)"` 做验证**：PowerShell 会在**本机**执行 `$(...)`，返回的是本机结果，不是服务器结果（轮次 52 实测假阳性）。
3. **正确做法**：
   - 本地用 `[System.IO.File]::WriteAllText(路径, 内容, [System.Text.UTF8Encoding]::new($false))` 写 LF 结尾的 bash 脚本；
   - 再 `Get-Content -Raw $脚本 | ssh -i <key> root@<ip> 'bash -s'` 执行（含部署与验证）；
   - 或文件直接用 scp 上传，避免命令行引号。
4. PowerShell 不支持 `<` 重定向到原生命令；用管道喂 stdin。
5. 写文件禁止用 `Set-Content -Encoding UTF8`（会带 BOM，nginx 报 `unknown directive "﻿server"`）；用 .NET `UTF8Encoding($false)`。

## 二、API 依赖树（runtime/api-flat）生成铁律

1. Windows 上 `pnpm deploy --legacy --filter @schedule/api --prod <dir>` 默认生成含 junction 和 `.pnpm` 虚拟库的树，**不能直接上传 Linux 服务器**。
2. Windows `tar --dereference` 与 Linux 容器 `cp -rL` 都**无法**正确拍平该 junction 树：嵌套 `node_modules` 会丢，典型症状是 API 启动即崩：
   `ERR_MODULE_NOT_FOUND: Cannot find package 'mysql2' imported from .../drizzle-orm/mysql2/driver.js`。
3. **唯一可靠方法**（已验证）：
   ```bash
   pnpm deploy --legacy --config.node-linker=hoisted --filter @schedule/api --prod <临时目录>
   ```
   产物为 npm 式全平铺、无符号链接的 `node_modules`（顶层直接有 `mysql2`/`fastify`/`zod` 等）。
4. 生成后必须本地验证：
   - 顶层存在 `mysql2`、`drizzle-orm`、`fastify`、`zod`、`web-push`；
   - `node_modules/@schedule/{contracts,database,scheduling-domain}/dist` 存在；
   - `node_modules/@cloudbase` **不存在**；
   - 全树无 LinkType（符号链接/junction）。
5. 上传方式：先 `tar -czf` 压缩（平铺树约 5MB），scp 压缩包，服务器 `tar -xzf` 解压；**不要直接 scp -r 几百 MB 的 node_modules**（会超时留半成品）。
6. 服务器替换依赖树：`mv` 旧目录留备份 → `cp -r` 新目录 → `docker compose up -d --force-recreate api`。

## 三、挂载与容器铁律

1. **替换被容器挂载的目录后必须重建容器**。`mv 旧目录` + `cp 新目录` 不会更新运行中容器的 bind mount（挂的是旧目录 inode），nginx 会继续服务旧文件。必须 `docker compose up -d --force-recreate <svc>`。
2. compose 挂载的**宿主文件必须先存在**；不存在时 Docker 会生成一个目录，容器内读取报错。先创建再 `up`。
3. 通过 bind mount 进容器的文件权限要按**容器内用户**考虑（nginx 工作进程是 uid 101）：`.htpasswd` 用 600(root) 会导致带凭据请求 500，需 `chmod 644` 或 `chown 101:101`。
4. nginx 在启动/重载时读取密码文件；修改后必须 reload 或重建容器。

## 四、不要再犯的架构坑

1. **不要给本应用加 nginx `auth_basic`（HTTP Basic Auth）门禁**。前端 API 请求自带 `Authorization: Bearer ...`，浏览器不会给带显式 Authorization 的请求附加缓存的 Basic 凭据，nginx 对每个接口返回 401 + `WWW-Authenticate: Basic`，形成“登录反复弹密码框”死循环（轮次 42 部署、轮次 52 撤除）。
2. 若未来仍需访问控制，可选：IP 白名单（`allow/deny`）、或改造前端认证传输（把 Bearer 换到自定义头）后再加网关，二选一，且都要先写回归/浏览器验证。
3. 服务器 `git` 停留在旧提交，`infra/docker/*` 是手动上传的**未跟踪文件**：不要依赖服务器上的 git 判断版本，一切以仓库 + 上传时间为准。

## 五、部署后验证清单（每次必做）

在服务器上（用 `bash -s` 脚本执行，不要用 PowerShell 内联 `$(...)`）：

1. `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1/` → 200
2. `curl -s http://127.0.0.1/api/health` → `{"component":"api","ready":true,...}`
3. `curl -s http://127.0.0.1/ | grep <新构建资源名>` → 命中（确认前端换了新版本）
4. `docker exec medical-schedule-prod-api-1 ls /app/apps/api/node_modules/@cloudbase` → 报不存在
5. `docker exec medical-schedule-prod-api-1 md5sum /app/apps/api/dist/local-server.js` → 与本地 `Get-FileHash -Algorithm MD5` 一致
6. 真实浏览器（无头 Edge + playwright-core）：打开无弹框；点“本地管理员”能进入工作台；接口无 401/`WWW-Authenticate`；无 console 错误
7. 通过后清理 `/tmp` 上传目录与 `*.broken-*`，保留 `*.old-*` 备份待用户确认

## 六、多会话/多轮次并行时

1. 每次动手前 `git status --short --branch` + `git log --oneline -5`，确认没有其他会话正在改同一批文件。
2. 只提交自己改的文件；别人的 WIP 一律不暂存、不提交、不覆盖。
3. 在 fix-progress.md 追加轮次记录前，先查现有 `### 轮次 N` 标题，取下一个可用编号（轮次 52 曾因并行会话撞号改过名）。
4. 上传的构建产物若混入别人未提交的改动，要在记录里注明，并在对方提交后重新同步。

## 七、环境速查

- SSH：`ssh -i "$env:USERPROFILE\.ssh\aliyun_schedule" root@8.148.183.46`
- 部署目录：`/opt/schedule`（web 挂 `apps/web/dist`；api 挂 `apps/api/dist` + `packages/*/dist` + `runtime/api-flat/node_modules`，见 compose.prod.yml）
- `.env.production`：服务器手工维护，含数据库密码；改动后检查是否残留已删除功能的变量
- 数据库迁移：线上库已到 0031；含新迁移的发布必须先跑 `node apps/api/dist/migrate.js` 再重启 api
- 回滚：旧产物保留为 `*.old-20260808*`，确认稳定后再清理
