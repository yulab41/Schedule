# CloudBase 开发环境部署手册

本文档对应实施计划任务 30：把 `main` 分支部署到独立 CloudBase 开发环境 `schedule-dev-d1geh4w1l4af7359d`，前端与 API 使用同一开发域名，`/api` 通过 CloudBase HTTP 访问服务路由到云函数。

## 架构

- Web 静态资源：CloudBase 静态网站托管（Vue history 模式，错误页配置为 `index.html`）。
- API：事件型云函数 `schedule-api`，通过 HTTP 访问服务以 `SCF` 资源类型挂在开发域名 `/api` 触发路径下，开启路径透传；网关把登录态注入 `x-cloudbase-context`，业务层只信任该上下文（实测事件型函数必须选 `SCF`，选 `WEB_SCF` 会返回 400；`WEB_SCF` 仅用于 Web/HTTP 型函数）。
- 定时任务：事件型云函数 `schedule-jobs`，由控制台定时触发器调用，按触发器名称分发到 `database-backup`、`duty-reminders`、`export-jobs`、`group-recycle`、`holiday-alerts`、`notification-retry`、`statistics-rebuild`。
- 数据库：CloudBase MySQL（腾讯云数据库 MySQL），云函数通过私有网络/VPC 连接；`schedule_events` 与 `audit_logs` 只授予 `SELECT`/`INSERT`。
- 部署：GitHub Actions 在 `main` 分支验证通过后自动部署；密钥只在 GitHub 环境级 Secret 与 CloudBase 控制台环境变量中，不进入仓库。

## 前置条件

- 腾讯云账号已完成实名认证，CloudBase 开发环境已存在（环境 ID：`schedule-dev-d1geh4w1l4af7359d`）。
- 本机可运行 Node.js 24、pnpm 11、Docker（本地迁移和验证用）。
- GitHub 仓库 `yulab41/Schedule` 已连接 `origin`。

## 一、CloudBase 控制台一次性准备

以下步骤需要 CloudBase 控制台权限，是任务 30 的用户协调部分；仓库代码不包含任何控制台凭据。

### 1. 数据库

在 CloudBase 控制台创建/关联云数据库 MySQL，记录连接地址、端口、数据库名和账号。生产/正式环境应开启云函数“高级配置/私有网络”，选择 MySQL 所在的 VPC 与子网，通过内网地址连接（VPC 需要付费）。开发环境实测走“免费公网”方案：临时开启 MySQL 外网访问，在安全组入站规则放通 `0.0.0.0/0`（TCP 外网端口），云函数默认即具备公网出口、无需 VPC；开发期可接受，生产必须收回。

业务账号按最小权限创建。`schedule_events` 和 `audit_logs` 是追加式日志表，运行账号不能拥有 `UPDATE`/`DELETE`：

```sql
CREATE DATABASE IF NOT EXISTS schedule_dev
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'schedule_app'@'%' IDENTIFIED BY '<强密码>';
GRANT SELECT, INSERT, UPDATE, DELETE ON schedule_dev.* TO 'schedule_app'@'%';
-- 两条追加式日志表只保留读取和写入，禁止 UPDATE/DELETE：
REVOKE UPDATE, DELETE ON schedule_dev.schedule_events FROM 'schedule_app'@'%';
REVOKE UPDATE, DELETE ON schedule_dev.audit_logs FROM 'schedule_app'@'%';
FLUSH PRIVILEGES;
```

云函数环境变量中的 `MYSQL_*` 使用该内网地址与账号。

### 2. 身份认证

1. 云开发控制台 → 身份认证 → 登录方式，启用“用户名密码”。
2. 在用户管理中由管理员创建测试账号（产品策略为管理员预置账号，Web 端不提供自助注册；账号小写）。
3. 控制台 → 环境配置 → 安全域名，把开发域名加入 Web 安全域名，否则浏览器 JS SDK 无法调用认证服务。

### 3. 静态网站托管与 HTTP 访问服务

1. 部署 Web 构建产物（可由下方 CI 完成，或本地执行 `tcb hosting deploy ../../apps/web/dist -e <envId>`）。
2. 静态网站托管设置页把“错误页面”配置为 `index.html`（Vue history 模式刷新路由必需）。
3. HTTP 访问服务中，把开发默认域名关联两类资源：
   - 静态网站托管：应用模式，触发路径 `/`；
   - 云函数 `schedule-api`：资源类型选择 云函数（`SCF`，事件型函数；不要选 Web 云函数 `WEB_SCF`），触发路径 `/api`，开启路径透传；网关鉴权保持关闭，由 API 自身按 `x-cloudbase-context` 校验登录态（这样 `/api/health` 可匿名探测，业务路由仍返回 401）。

开发默认域名只用于开发和内部测试；2025 年 10 月后新建环境的默认域名会保留访问提示中间页，正式环境必须走任务 31 的备案自定义域名。

### 4. 云函数环境变量

在控制台 → 云函数 → `schedule-api` / `schedule-jobs` → 函数配置 → 环境变量中填写（两个函数都需要数据库变量；`schedule-jobs` 额外需要备份与推送变量）：

| 变量                    | 说明                  | 示例/要求                                 |
| ----------------------- | --------------------- | ----------------------------------------- |
| `NODE_ENV`              | 运行模式              | `production`                              |
| `MYSQL_HOST`            | MySQL 连接地址        | 开发用外网地址；生产用 VPC 内网地址       |
| `MYSQL_PORT`            | MySQL 端口            | 开发用外网端口（如 `24819`）；生产 `3306` |
| `MYSQL_DATABASE`        | 业务库                | `schedule_dev`                            |
| `MYSQL_USER`            | 业务账号              | `schedule_app`                            |
| `MYSQL_PASSWORD`        | 业务账号密码          | 强密码，勿入仓库                          |
| `VAPID_SUBJECT`         | Web Push 联系人       | `mailto:...`                              |
| `VAPID_PUBLIC_KEY`      | Web Push 公钥         | 见下方生成命令                            |
| `VAPID_PRIVATE_KEY`     | Web Push 私钥         | 仅云函数环境变量                          |
| `HOLIDAY_ADMIN_UIDS`    | 节假日管理 UID 白名单 | 逗号分隔的 CloudBase UID                  |
| `PLATFORM_ADMIN_UIDS`   | 平台管理 UID 白名单   | 逗号分隔的 CloudBase UID                  |
| `BACKUP_DIR`            | 开发环境备份目录      | `/tmp/backups`（函数磁盘为临时盘）        |
| `BACKUP_ENCRYPTION_KEY` | 备份加密密钥          | 64 位十六进制或 base64 的 32 字节         |

VAPID 密钥生成：

```bash
node -e "const webpush=require('web-push');console.log(webpush.generateVAPIDKeys())"
```

CI 使用 `tcb fn code update` 只更新函数代码，不会覆盖控制台环境变量，因此这些值只需在控制台维护一次。

### 5. 定时任务触发器

`schedule-jobs` 函数在控制台 → 云函数 → `schedule-jobs` → 触发方式 → 定时触发中添加以下触发器（一个函数可以挂多个不同名称的定时触发器；CLI 配置文件目前只支持声明一个，所以触发器统一在控制台管理）：

| 触发器名称                    | Cron（七段，北京时间） | 任务                           |
| ----------------------------- | ---------------------- | ------------------------------ |
| `schedule_notification_retry` | `0 */5 * * * * *`      | 推送重试                       |
| `schedule_export_jobs`        | `0 */15 * * * * *`     | 导出任务处理                   |
| `schedule_database_backup`    | `0 0 2 * * * *`        | 每日备份                       |
| `schedule_group_recycle`      | `0 0 3 * * * *`        | 群组回收清理                   |
| `schedule_statistics_rebuild` | `0 30 3 * * * *`       | 统计快照重建                   |
| `schedule_duty_reminders`     | `0 0 7 * * * *`        | 值班提醒（按群设置的小时筛选） |
| `schedule_holiday_alerts`     | `0 0 9 * * * *`        | 节假日数据缺失告警             |

也可以使用 CLI 添加单个触发器：

```bash
tcb --config-file infra/cloudbase/cloudbaserc.json \
  fn trigger create schedule-jobs \
  --trigger-name schedule_notification_retry --cron "0 */5 * * * * *" \
  -e schedule-dev-d1geh4w1l4af7359d
```

## 二、数据库迁移（受控人工步骤）

迁移不会在任何自动部署流程中执行，也不在每次前端构建时触发。首次上线和每次迁移文件变更后，由操作者手动执行：

1. 先在 CloudBase 控制台或 `docs/operations/backup-and-restore.md` 流程完成迁移前备份。
2. 确保本机可以访问 CloudBase MySQL（临时开通公网直连并在用后关闭，或使用跳板机）。
3. 以 CloudBase MySQL 的连接信息临时覆盖 `.env` 中的 `MYSQL_*`（不要把值提交到仓库），然后执行：

```bash
pnpm --filter @schedule/api migrate
```

4. 确认迁移日志成功且迁移表数量与 `docs/project-status.md` 记录一致，恢复本地 `.env`。
5. 迁移后再部署新代码；部署失败时保留上一可用版本并回滚，不要在同一构建中混合迁移与发布。

## 三、GitHub 环境与密钥

1. GitHub 仓库 → Settings → Environments，创建 `development` 环境；可按需开启“必需审查者”保护。
2. 在该环境中配置变量（非密钥）：
   - `CLOUDBASE_DEV_ENV_ID`：`schedule-dev-d1geh4w1l4af7359d`
   - `CLOUDBASE_DEV_DOMAIN`：开发域名，如 `https://schedule-dev-d1geh4w1l4af7359d.tcloudbaseapp.com`
3. 在该环境中配置 Secrets：
   - `TENCENT_SECRET_ID` / `TENCENT_SECRET_KEY`：CAM 子账号密钥，仅授予部署所需 CloudBase/TCB 权限（最小权限、专人保管）。
4. 拉取请求无法读取环境级 Secret；`Deploy Development` 只由 `main` 分支上成功的 `Verify` 工作流触发。

## 四、自动部署流程

`main` 分支推送 → `Verify` 工作流（格式化、Lint、类型、测试、构建）成功 → `Deploy Development` 工作流：

1. 检出该提交并冻结安装依赖；
2. 以 `VITE_CLOUDBASE_ENV_ID`、`VITE_API_BASE_URL=/api` 构建 Web，并执行 `pnpm cloudbase:build` 把 API 与任务函数打成自包含 CommonJS 包；
3. `tcb login --apiKeyId/--apiKey` 非交互登录；
4. `schedule-api`、`schedule-jobs` 已存在则 `tcb fn code update`（只更新代码，不触碰环境变量与触发器），不存在则 `tcb fn deploy`；
5. `tcb hosting deploy` 上传 `apps/web/dist`；
6. 轮询 `https://<域名>/api/health` 与首页，确认 200 后结束。

本地等价命令：

```bash
pnpm build
pnpm cloudbase:build
pnpm exec tcb --config-file infra/cloudbase/cloudbaserc.json fn code update schedule-api
pnpm exec tcb --config-file infra/cloudbase/cloudbaserc.json hosting deploy apps/web/dist
```

## 五、部署后验证

- 匿名健康检查：`curl -i https://<开发域名>/api/health` 返回 200 且带 `x-request-id`。
- 未登录业务请求：`curl -i https://<开发域名>/api/users/me` 返回 401。
- 签名浏览器流程（任务 30 停止条件）：在开发域名完成 登录 → 完善姓名 → 创建/加入测试群组 → 查看当前月日历 → 完成一个工作流往返（如请假提交并审批，或换班）→ 刷新后日历出现对应标记。
- 通知面板确认 VAPID 配置后不再显示“未配置”警告（未配置时应用内通知仍可用）。

## 六、日志关联编号

- 每次 HTTP 响应带 `x-request-id`；云函数日志中可按该值检索同一请求的全部日志。
- 每个定时任务在 `platform_job_runs` 记录 `runId`（UUID），`schedule-jobs` 完成日志输出 `{"event":"cloudbase_job_completed","job":...,"runId":...}`，失败日志输出 `cloudbase_job_failed`；控制台日志查询可按 `runId` 或任务名关联。
- 控制台日志与 `tcb logs search` 均覆盖云函数日志；审计事件与业务事件通过 `correlationId`/`operationId` 继续关联业务对象。

## 七、回滚与故障排查

- 回滚：把 `main` 恢复到上一可用提交并推送（或手动 `tcb fn code update` 上传上一构建包）；数据库回滚遵循迁移前备份流程，禁止直接删除已发布迁移。
- 函数 500/超时：先查环境变量是否缺失（控制台 → 函数配置），再查 MySQL 内网连通性与 VPC 配置；`MYSQL_*` 缺失时 `/ready` 会失败。
- `/api` 404：确认 HTTP 访问服务触发路径为 `/api` 且开启路径透传；处理器兼容带/不带 `/api` 前缀两种路径。
- 登录失败：确认用户名密码登录已启用、账号为管理员预置且小写、开发域名已加入 Web 安全域名。
- 默认域名出现访问提示中间页：属 CloudBase 默认域名软性提醒，开发阶段可接受；正式环境按任务 31 绑定备案自定义域名。
- 部署后环境变量丢失：确认 CI 走 `tcb fn code update`（不是 `tcb fn deploy --force`），环境变量只在控制台维护。

## 八、与后续任务的关系

- 生产 CloudBase 环境、备案域名、费用告警和正式密钥分离：任务 31。
- 云存储备份适配器：当前 `BackupStorage` 接口已隔离，开发环境使用 `BACKUP_DIR` 临时盘；任务 31 在生产环境接入 CloudBase 云存储（上传 `cloudPath`、`fileID` 语义需在真实环境验证）。
- 最终发布验收与正式冒烟：任务 32。
