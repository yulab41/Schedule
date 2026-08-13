# Project Status

本文件是 Web 1.0 的唯一当前状态和交接入口；历史细节以 Git 提交为准。

## 当前状态（2026-08-13）

- 分支：`main`，上游：`origin/main`。
- 产品基线：Web、API、认证、契约、数据库、排班规则、PWA 和阿里云 ECS 部署。
- 文档基线：保留 10 个精简 Web 入口，另保留 `AGENTS.md` 项目规则。
- 本轮：修复 Web 成员认领接口 404 和通知偏好响应兼容问题；恢复 API/集成覆盖并保留现有数据库与 Web 调用契约。

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

## 本轮结果（2026-08-13）

- 根因：`d117bb0` 保留 Web 成员认领调用，`8ab9184` 删除了对应路由和服务；`ef3d20c` 新增通知字段后，严格契约无法解析旧 API 缺字段的 200 响应。
- 已恢复 `/groups/claim`、成员匹配、认领申请审批/驳回/撤销接口及事务、权限、锁和版本保护；集成回归测试恢复为认领工作流覆盖。
- `memberNotificationPreferencesSchema` 对缺失的 `wechatNotificationsEnabled` 默认 `true`，仍拒绝错误类型；新增 Web API 回归测试。
- 静态审查：恢复的四个认领文件与 `8ab9184^` 完全一致；`git diff --check` 通过。
- 部署脚本已统一通过 Nginx 80/443 入口检查，移除 ECS 更新/核验及测试隧道对远端 8080 的错误依赖；新增一次构建产物清单、压缩包哈希、发布目录和失败回滚流程。
- 本地运行验证：`pnpm install --frozen-lockfile`、`pnpm build`、`pnpm typecheck`、`pnpm verify` 均通过；定向通知兼容测试 3/3、成员认领集成测试 4/4 通过。`pnpm verify` 汇总为 54 个测试文件通过、422 个测试通过，29 个测试文件/252 个测试因项目现有环境保护条件跳过。
- 浏览器验证：`pnpm smoke:browser` 通过；应用内浏览器本地管理员成员页实际出现成员表、通知页实际出现“我的提醒”，本地成员模式正常，控制台仅有 Vite 正常连接日志。`pnpm smoke:check-core` 和 `git diff --check` 通过。
- 线上发布：代码修复与部署保护已连续提交并推送到 `origin/main`；最终应用候选提交为 `a7d6da9`，其后的状态记录提交将作为最终 release SHA。ECS 已完成数据库备份、迁移、容器重建和失败回滚材料保留。
- ECS 核验：Nginx 80/443 入口健康通过；HTTPS SNI `/api/health` 返回 200；部署清单、lockfile、Web/API/shared dist、迁移、Compose/Nginx 配置及归档哈希逐项一致；容器运行、MySQL healthy、迁移记录 34 条、无 `@cloudbase`。
- 公网浏览器验证：`https://hosp.schedule.eylinhome.top` 管理员登录成功；成员页出现成员表且无“请求的资源不存在”，通知页出现“我的提醒”且无“服务返回了无效资料”；控制台无异常；公网成员账号无两类旧错误。
- 当前状态：已完成，待用户复核。

## 下一批次

- 用户强刷公网页面并复核成员、通知页面；如需继续变更，下一轮先读取本文件和 Git 历史。
- 停止条件：本轮修复、提交、推送、ECS 发布、备份/回滚材料、哈希核验和本地/公网浏览器验收均已完成。

## 后续规则

- 新会话先读本文件，再读取主实施计划和主设计中与当前任务相关的短节。
- 新事实只更新当前状态，不追加逐轮历史或完整终端输出。
- 生产部署、数据库迁移和正式发布需要单独明确授权。
