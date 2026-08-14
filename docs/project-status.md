# Project Status

本文件是 Web 1.0 的唯一当前状态和交接入口；历史细节以 Git 提交为准。

## 当前状态（2026-08-14）

- 分支：`main`，上游：`origin/main`。
- 产品基线：Web、API、认证、契约、数据库、排班规则、PWA 和阿里云 ECS 部署。
- 文档基线：保留 10 个精简 Web 入口，另保留 `AGENTS.md` 项目规则。
- 本轮：完整修复 Web Push 配置、订阅恢复和 ECS 通知调度；代码已构建并发布到 ECS，生产 VAPID 已注入，待当前浏览器授权并完成一次实际 Push 验收。

## 已完成能力

- 账号、群组、成员、角色、班种、联系方式和权限。
- 自动排班、手动模板、草稿/发布/版本、请假、换班、加扣班和并发保护。
- 月/周/列表日历、访客只读日历、事件、通知、统计和 CSV 导出。
- PWA 离线只读、节假日、备份恢复、监控和 ECS Docker 部署基础。

## 验证基线

```powershell
pnpm verify
pnpm smoke:browser
pnpm smoke:check-core
git diff --check
```

此前文档整理轮次额外通过 Markdown Prettier、Markdown 本地链接和 Web-only 关键词审计。

## 本轮结果（2026-08-14）

- 根因：`d117bb0` 保留 Web 成员认领调用，`8ab9184` 删除了对应路由和服务；`ef3d20c` 新增通知字段后，严格契约无法解析旧 API 缺字段的 200 响应。
- 已恢复 `/groups/claim`、成员匹配、认领申请审批/驳回/撤销接口及事务、权限、锁和版本保护；集成回归测试恢复为认领工作流覆盖。
- `memberNotificationPreferencesSchema` 对缺失的 `wechatNotificationsEnabled` 默认 `true`，仍拒绝错误类型；新增 Web API 回归测试。
- 静态审查：恢复的四个认领文件与 `8ab9184^` 完全一致；`git diff --check` 通过。
- 部署脚本已统一通过 Nginx 80/443 入口检查，移除 ECS 更新/核验及测试隧道对远端 8080 的错误依赖；新增一次构建产物清单、压缩包哈希、发布目录和失败回滚流程。
- 本地运行验证：`pnpm install --frozen-lockfile`、`pnpm build`、`pnpm typecheck`、`pnpm verify` 均通过；定向通知兼容测试 3/3、成员认领集成测试 4/4 通过。`pnpm verify` 汇总为 54 个测试文件通过、422 个测试通过，29 个测试文件/252 个测试因项目现有环境保护条件跳过。
- 浏览器验证：`pnpm smoke:browser` 通过；应用内浏览器本地管理员成员页实际出现成员表、通知页实际出现“我的提醒”，本地成员模式正常，控制台仅有 Vite 正常连接日志。`pnpm smoke:check-core` 和 `git diff --check` 通过。
- 线上发布：代码修复与部署保护已连续提交并推送到 `origin/main`；业务代码最终候选提交为 `a7d6da9`，本次状态提交的完整 SHA 将作为最终 release SHA。ECS 已完成数据库备份、迁移、容器重建和失败回滚材料保留。
- ECS 核验：Nginx 80/443 入口健康通过；HTTPS SNI `/api/health` 返回 200；部署清单、lockfile、Web/API/shared dist、迁移、Compose/Nginx 配置及归档哈希逐项一致；容器运行、MySQL healthy、迁移记录 34 条、无 `@cloudbase`。
- 最终备份/回滚材料：数据库备份 archive `6f6216e4-bd94-4490-8cad-0d1fcf90a1c9`，storage key `backups/daily/2026-08-13T15-51-11.210Z.backup`；上一版应用文件备份保留在 `/opt/schedule/releases/<最终 release SHA>/previous/current-files.tar.gz`。
- 公网浏览器验证：`https://hosp.schedule.eylinhome.top` 管理员登录成功；成员页出现成员表且无“请求的资源不存在”，通知页出现“我的提醒”且无“服务返回了无效资料”；控制台无异常；公网成员账号无两类旧错误。
- 当前状态：待用户复核。

## 本轮增量

- 回归定位：VAPID 判定来自 `52e9e1f` 的 `WebPushDispatcher`；ECS cron 只安装监控和备份来自 `c97879d`，未覆盖 `duty-reminders`/`notification-retry`。
- 已完成任务 1：环境契约支持 `VAPID_SUBJECT`、`VAPID_PUBLIC_KEY`、`VAPID_PRIVATE_KEY`；三项必须同时配置或同时为空；运行时和 job runner 显式传递推送配置；示例环境文件不再制造半配置状态。
- 任务 1 验证：API `tsc --noEmit`、API 构建通过；VAPID 与订阅辅助测试 3 个文件、19 项通过；完整 Vitest 通过 56 个文件、430 项，另有 29 个数据库集成文件（252 项）因本机未启动测试 MySQL 按既有保护逻辑跳过；Prettier 检查和 `git diff --check` 通过。
- 任务 1 checkpoint：已提交 `eab3ff2`（`fix(notifications): validate and propagate VAPID configuration`）。
- 任务 2/3 已完成并发布：ECS 每分钟通知调度、发布/回滚/核验接入，以及浏览器订阅重新注册 UI 均已上线；生产 VAPID 密钥在 ECS 上生成并写入，私钥未进入仓库或聊天。
- 生产发布验证：release `6487fe49898f3b0b3f9b8f39e0ed60ed51788f92`；API 健康检查 200，迁移 34 条，scheduler/cron 已安装；最近 `duty-reminders` 与 `notification-retry` 均成功执行。
- 决策：不新增常驻 scheduler 容器，使用带 `flock` 的主机 cron；不修改数据库结构；VAPID 私钥不进入仓库。
- 运行/浏览器验证：`pnpm smoke:browser` 的本地完整流程仍受测试数据库/登录环境限制；公网发布后已用浏览器登录管理员并打开通知页，页面不再显示“推送服务尚未配置”，当前设备显示“重新注册浏览器通知”，待用户授权浏览器通知并完成实际 Push。
- 本轮完整验证：`pnpm install --frozen-lockfile`、`pnpm build`、`pnpm typecheck`、`pnpm test` 均通过；Vitest 为 56 个文件/430 项通过，29 个数据库集成文件/252 项按既有保护逻辑跳过。

## 下一批次

- 当前活动批次：用户复核当前浏览器 Push 订阅。
- 停止条件：用户在通知设置页点击“重新注册浏览器通知”并允许浏览器通知权限，完成一次实际浏览器 Push 验收。

## 后续规则

- 新会话先读本文件，再读取主实施计划和主设计中与当前任务相关的短节。
- 新事实只更新当前状态，不追加逐轮历史或完整终端输出。
- 生产部署、数据库迁移和正式发布需要单独明确授权。
