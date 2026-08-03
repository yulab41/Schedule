# CloudBase 开发环境运维实战记录（踩坑、发现与工具）

本文档是 2026-08-02 Task 30 上线过程中的实战记录，供后续对话直接继承：先读本文档 + `docs/project-status.md` + `docs/deployment/cloudbase-development.md`，再动手操作 CloudBase。

## 1. 当前环境配置（开发环境）

### 账号与权限

- GitHub 仓库：`yulab41/Schedule`，分支 `main`，上游 `origin/main`。
- GitHub `development` 环境变量：`CLOUDBASE_DEV_ENV_ID=schedule-dev-d1geh4w1l4af7359d`、`CLOUDBASE_DEV_DOMAIN=https://schedule-dev-d1geh4w1l4af7359d-1300188335.tcloudbaseapp.com`；Secrets：`TENCENT_SECRET_ID`、`TENCENT_SECRET_KEY`（GitHub Secrets 无法回读，改密钥后要重新设置）。
- CAM 子账号 `schedule`（生产建议回收）：`QcloudTCBFullAccess` + `QcloudSCFFullAccess` + `QcloudCOSFullAccess` + `QcloudCDNFullAccess`。子账号**没有** `cynosdb` 权限，也没有直接操作 CloudBase 托管 CDN 域名的权限。
- CloudBase 环境：`schedule-dev-d1geh4w1l4af7359d`（ap-shanghai，体验版，到期 2027-02-01）。

### MySQL（CloudBase 关联 TDSQL-C）

- 集群 ID：`cynosdbmysql-mo0kul2i`（控制台显示名 `cloudbase__JTeWkaheNb`，CloudBase 托管）。
- VPC：`vpc-600y03ms/subnet-kp45m5o5`；内网 `172.17.0.6:3306`；直连外网 `sh-cynosdbmysql-grp-3vcucsya.sql.tencentcdb.com:24819`。
- 业务库：`schedule_dev`；账号：`schedule_app`（开发期单账号妥协，全局授权 + 公网；生产必须 VPC 内网 + 专用运行账号）。
- 数据库密码等敏感值：见 `infra/cloudbase/cloudbaserc.local.json`（gitignored，勿提交）与云函数环境变量；DMC 也用它。
- 迁移已应用：19 条迁移记录、37 张业务表 + `__drizzle_migrations`（2026-08-03 round 12 已补跑 `0018`/`0019`）。

### 云函数与路由

- `schedule-api`（Event、Nodejs20.19、30s/512MB）、`schedule-jobs`（300s）。
- 环境变量：`MYSQL_*`（公网地址 + 强密码）、`NODE_ENV=production`、`VAPID_SUBJECT=mailto:546848587@qq.com` + VAPID 公私钥、`HOLIDAY_ADMIN_UIDS`/`PLATFORM_ADMIN_UIDS=2083889108729126914`（admin01）、`BACKUP_DIR=/tmp/backups`、`BACKUP_ENCRYPTION_KEY`（值在 gitignored 本地配置）。
- 路由（HTTP 访问服务，开发默认域名）：
  - `/` → `STATIC_STORE`（默认静态托管绑定）；
  - `/api` → `SCF`/`schedule-api`，**网关鉴权开启**，路径透传开启；
  - `/api/health` → `SCF`/`schedule-api`，**鉴权关闭**（匿名健康检查，实测更具体路径优先）。
- `schedule-jobs` 定时触发器 7 个：`schedule_notification_retry`（`0 */5 * * * * *`）、`schedule_export_jobs`（`0 */15 * * * * *`）、`schedule_database_backup`（`0 0 2 * * * *`）、`schedule_group_recycle`（`0 0 3 * * * *`）、`schedule_statistics_rebuild`（`0 30 3 * * * *`）、`schedule_duty_reminders`（`0 0 7 * * * *`）、`schedule_holiday_alerts`（`0 0 9 * * * *`）。

### CloudBase 用户

- `admin01`（UID `2083889108729126914`，节假日/平台管理员白名单）、`test`（UID `2083456390410330113`）。用户名密码登录已启用；Web 无自助注册。

## 2. 工具与可复用命令

### GitHub CLI

- 路径：`C:\Program Files\GitHub CLI\gh.exe`（不在 PATH，PowerShell 先 `$gh = 'C:\Program Files\GitHub CLI\gh.exe'`）。
- 常用：`& $gh run list -L 10`、`& $gh run view <id> --log-failed`、`& $gh workflow run deploy-development.yml --ref main`、`& $gh run cancel <id>`。
- 坑：`--jq '...'` 带空格/管道在 PowerShell 下会被拆参，直接用默认表格输出即可。

### CloudBase CLI（@cloudbase/cli 3.7.0，root devDependency）

- 登录：`pnpm exec tcb login --apiKeyId "SecretId" --apiKey "SecretKey"`（密钥不要贴进聊天）。
- 常规命令走 `pnpm exec tcb ...`；**JSON 参数含引号时**（`--body`/`--data`/`routes --data`）pnpm.ps1 会吃掉内嵌双引号，改用：
  `node node_modules/@cloudbase/cli/dist/standalone/cli.js api tcb RunSql --body '{\"EnvId\":\"...\"}'`
  （PowerShell 单引号内用 `\"` 转义；`--body @file` 不支持，含空格的 JSON 请用 manager-node SDK）。
- `tcb api <service> <action>` 使用 CAM 密钥直接调云 API，权限与“登录上下文”不同：`cynosdb`、`cdn` 下的很多调用会 PermissionDenied 或“账号下无此域名”。CLI 内部命令（如 `tcb hosting detail`）走 CloudBase 上下文，行为不同。
- 改函数环境变量：`tcb config update fn <name> --config-file infra/cloudbase/cloudbaserc.local.json -e <envId>`，出现 Override/Merge 交互提示时管道输入 `"$([char]27)[B`n"` 选 **Merge update**。`--config-file`用`*.local.json`（gitignored）避免把密钥写进仓库。
- 路由：`tcb routes add/edit -e <envId> --data '{...}'`，确认提示管道输入 `"Y`n"`；`tcb routes list`对旧默认绑定可能返回空，但`routes add`会提示`/` 已存在。
- 函数直调验证：`tcb fn invoke schedule-api -e <envId> --data '{事件JSON}' --json`。
- 日志：`tcb fn log <name>` 已废弃，用控制台日志检索或 `tcb logs`。

### @cloudbase/manager-node（临时装在 `%TEMP%\mgrwork`）

- 安装：`npm install --prefix "$env:TEMP\mgrwork" @cloudbase/manager-node`。
- 用途：`new CloudBase({ secretId, secretKey, envId })` 后：
  - `app.mysql.runSql({ Sql })` —— 通过 TCB 接口执行任意 SQL（改密码、查询，不需要公网连接）；
  - `app.mysql.describeClusterDetail()` —— 查看 `WanStatus`/`IsOpenPubNetAccess` 等；
  - `app.hosting.setWebsiteDocument(...)` —— 走正确静态桶写索引/错误文档。
- 注意：manager-node 里的 `cynosdb` 原生调用（openWan、安全组等）仍受子账号 CAM 权限限制。

### cos-nodejs-sdk-v5（临时装在 `%TEMP%\coswork`）

- 用途：直接写 COS bucket website 配置（404 重定向规则）。脚本模板见第 3 节。
- 临时目录重装系统/换机后会丢失，用时按上述命令重装即可（不进入仓库依赖）。

## 3. 关键脚本模板

### COS 404 → index.html（SPA 刷新回落）

```js
const COS = require('cos-nodejs-sdk-v5');
const cos = new COS({ SecretId, SecretKey });
const Bucket = 'a9e6-static-schedule-dev-d1geh4w1l4af7359d-1300188335'; // 静态桶（DescribeStaticStore/StaticStorages）
const Region = 'ap-shanghai';
await cos.putBucketWebsite({
  Bucket,
  Region,
  WebsiteConfiguration: {
    IndexDocument: { Suffix: 'index.html' },
    ErrorDocument: { Key: 'index.html' },
    RoutingRules: [
      {
        Condition: { HttpErrorCodeReturnedEquals: '404' },
        Redirect: { ReplaceKeyWith: 'index.html' },
      },
    ],
  },
});
```

### manager-node 执行 SQL

```js
const CloudBase = require('@cloudbase/manager-node');
const app = new CloudBase({ secretId, secretKey, envId: 'schedule-dev-d1geh4w1l4af7359d' });
await app.mysql.runSql({ Sql: 'SELECT 1' });
```

## 4. 踩坑清单（现象 → 原因 → 解决）

### 4.1 路由与鉴权

1. `/api` 返回 400（`x-cloudbase-upstream-type: Tencent-SCF_HTTP`）：事件型函数配了 `WEB_SCF` 上游。**解决**：上游类型必须用 `SCF`；`WEB_SCF` 只用于 Web/HTTP 型函数。Task 6 的旧结论已作废。
2. 登录后无限提示“需要先登录后才能继续”：路由 `enableAuth` 关闭时，网关不校验令牌、不注入 `x-cloudbase-context`，SDK 登录成功但业务请求全 401。**解决**：`/api` 开启网关鉴权；另加 `/api/health` 匿名路由保持健康检查（更具体路径优先匹配）。
3. `tcb routes list` 返回空，但 `routes add` 报 `/` 已存在：默认静态托管绑定不在新路由列表里。**解决**：不要重复加 `/`。
4. 部署健康检查一直失败但接口 200：workflow grep `"status"`，而 `/api/health` 返回 `"ready"`。**解决**：grep `"ready"`。

### 4.2 静态托管 404

5. 新版控制台没有旧“设置 → 错误页面”输入框：入口改为「重定向规则 → 错误码重定向」（4xx）。**解决**：控制台配 404 → `index.html`，或用 COS `RoutingRules`（第 3 节模板）等效实现，实测生效。
6. `tcb hosting detail` 的 `errorDocument` 不可信：CLI 读的是 `Storages[0]`（云存储桶 `7363-...`）而不是静态桶（`a9e6-...`）。**解决**：不要据此判断；不要给 `7363-...` 桶配 website 配置（曾误配后已删除恢复）。
7. 改完 404 规则后旧路径仍短暂 404：CDN 缓存。**解决**：等缓存过期或换新路径验证。

### 4.3 数据库

8. TDSQL-C 控制台提示“cloudbase__JTeWkaheNb 运行中，但当前状态不允许操作集群”：集群是 CloudBase 托管的。**解决**：所有 MySQL 管理走 CloudBase 控制台（数据库 → MySQL → 直连服务）或 manager-node `runSql`，不要改 TDSQL-C 控制台。
9. 外网连接 `PROTOCOL_CONNECTION_LOST`：直连外网地址处于关闭状态，或本机 IP 未放行。**解决**：用 `describeClusterDetail()` 看 `WanStatus`/`IsOpenPubNetAccess`；云函数默认可连直连外网（实测无需白名单），本机 IPv6-only 家庭网络连不上属正常，管理操作用 DMC/RunSql。
10. 迁移到 CynosDB 报错：CynosDB 默认 `sql_mode` 与本地 MySQL 8.4 不同。**解决**：迁移前 `SET SESSION sql_mode = '...NO_ENGINE_SUBSTITUTION'`（去掉 `NO_ZERO_DATE`）。
11. 账号授权报错（Error 1147/1141，无此 grant）：用户实际授权结构与假设不同。**解决**：先 `SHOW GRANTS`，再按实际授权 REVOKE；开发期采用单账号 `schedule_app` 妥协并记录在案。

### 4.4 CLI 与脚本

12. PowerShell 下 `--body '{"a":1}'` 引号丢失/拆参：pnpm.ps1 和 PowerShell 原生传参会处理引号。**解决**：`node node_modules/@cloudbase/cli/dist/standalone/cli.js` 直调，JSON 内引号写 `\"`；含空格 JSON 用 manager-node。
13. `tcb api` 调用 `cynosdb`/`cdn` 报权限错：子账号缺对应产品权限，且 CloudBase 托管资源不在用户 CDN 账户下。**解决**：需要时可加策略（本环境已加 `QcloudCDNFullAccess`），但默认域名仍只能走 CloudBase 上下文或控制台。
14. 函数代码上传“COS 上传超时（60秒）”：`tcb fn code update`/`fn deploy` 默认走 COS 上传不稳定。**解决**：加 `--deployMode zip`（已固化进 deploy-development.yml）。
15. `workflow_run` 触发旧提交的自动部署与手动部署竞争：concurrency 组会排队，旧 run 可能用旧 workflow 再失败。**解决**：`gh run cancel <旧run>` 后让新 run 执行。

### 4.5 账号与安全

16. “CloudBase 环境管理 - API Key”不是 CAM 密钥：登录 CLI/GitHub Actions 用 CAM 子账号的 SecretId/SecretKey（`tcb login --apiKeyId/--apiKey`）；服务端 API Key 是另一套 HTTP 接口凭据。
17. CAM 密钥不要贴进聊天：本对话已暴露过一对，**待办：完成验证后轮换**，并同步更新 GitHub Secrets。
18. GitHub Secrets 无法回读：部署失败直接在 Actions run 日志里看，不要尝试读 secret 值。

## 5. 当前方案（开发环境）

- 免费公网方案：CloudBase 直连外网 + 云函数公网出口（无需 180 元/月 VPC）；安全组/白名单无法也不需要在 TDSQL-C 控制台改。
- 单账号 `schedule_app` 全局授权（含管理权限）是开发妥协；生产必须：VPC 内网、`schedule_runtime` 类专用账号、日志表仅 SELECT/INSERT。
- 部署：Verify（build 在 typecheck/test 前）→ Deploy Development（`--deployMode zip`，健康检查 `/api/health` 200 + 首页 200）。
- 函数环境变量只在控制台/`tcb config update fn` 维护；`tcb fn code update` 不覆盖环境变量和触发器。

## 6. 待办

- 完成 Task 30 浏览器验收（登录已通过）：完善姓名 → 建群 → 排班 → 日历 → 工作流 → 刷新标记。
- 轮换 CAM 子账号密钥并更新 GitHub Secrets。
- 生产 Task 31：VPC 内网、专用运行账号、自定义域名、云存储备份适配器、正式密钥分离。
