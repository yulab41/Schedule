# Project Status

本文件是 Web 1.0 的唯一当前状态和交接入口；历史细节以 Git 提交为准。

## 当前状态（2026-08-13）

- 分支：`main`，上游：`origin/main`。
- 产品基线：Web、API、认证、契约、数据库、排班规则、PWA 和阿里云 ECS 部署。
- 文档基线：保留 10 个精简 Web 入口，另保留 `AGENTS.md` 项目规则。
- 本轮：收敛为 Web-only，删除微信小程序产品线、仅供小程序使用的共享包与专属工具链，并清理本地依赖、构建、运行时和调试产物；不修改业务逻辑、数据库或生产部署配置。

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

本轮额外通过 Markdown Prettier、Markdown 本地链接和 Web-only 关键词审计；源码目录无差异。

## 本轮结果（2026-08-13）

- 已删除 `apps/miniprogram/`、`packages/calendar-core/`、`packages/client-core/` 及 `scripts/miniprogram-*.mjs`；根脚本、锁文件、ESLint 和 Vitest 配置已同步收敛为 Web-only。
- 已清理根及 workspace 的 `node_modules/`、`.pnpm-store/`、`dist/`、`runtime/`、smoke/preview 临时目录和 `debug.log`；`.env` 保留为本地运行配置。
- 验证：`pnpm install --frozen-lockfile`、`pnpm verify`、`pnpm smoke:browser`、`pnpm smoke:check-core`、`git diff --check` 均通过。
- `pnpm verify`：54 个测试文件通过，420 个测试通过；29 个数据库/集成测试文件共 249 个测试因本地 MySQL 安全门禁跳过。
- 当前状态：已完成，待用户复核。Windows 微信开发者工具仍占用一个空的 `apps/miniprogram/` 目录；关闭相关工具后可删除该空目录，不影响 Git 内容或 Web 运行。

## 下一批次

- 用户复核 Web-only 清理结果；如需重新开发，执行 `pnpm install --frozen-lockfile`。
- 停止条件：确认目录内仅保留 Web/API/共享 Web 包、部署、迁移、测试和当前文档入口。

## 后续规则

- 新会话先读本文件，再读取主实施计划和主设计中与当前任务相关的短节。
- 新事实只更新当前状态，不追加逐轮历史或完整终端输出。
- 生产部署、数据库迁移和正式发布需要单独明确授权。
