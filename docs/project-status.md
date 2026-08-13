# Project Status

本文件只记录 Web 1.0 当前阶段、检查点和下一步，不保留已移除的其他客户端实施文档。

## Current Position

- 日期：2026-08-13
- 分支：`main` / 上游：`origin/main`
- Web 1.0：API、认证、契约、数据库、排班规则、部署和 PWA 继续作为唯一产品基线。
- 当前状态：文档已收敛为 Web-only；本轮不修改其他源码。

## Completed Batch

### Web-only 文档基线（2026-08-13）

- 删除不再作为产品依据的独立客户端计划与设计文档。
- 从 Web 设计、实施计划、部署说明、项目状态和调试日志中移除其他客户端分支，保留 Web 语义、接口、数据、安全与运维内容。
- 未修改 `apps/web/**`、API、Contracts、数据库和部署代码；未触碰用户保留的未跟踪测试配置文件。

## Validation

- 文档关键词审计：通过，`docs` 不再包含已移除客户端计划/设计关键词。
- 文档格式：通过，保留文档均通过 Prettier 检查。
- Web 构建与浏览器冒烟：`pnpm --filter @schedule/web build`、`pnpm smoke:browser`（7/7）和 `pnpm smoke:check-core` 通过。
- Web 文档与代码边界：`apps/web/**` 未修改。
- Web 验证：`pnpm --filter @schedule/web build`、`pnpm smoke:browser`（7/7）、`pnpm smoke:check-core` 和 `git diff --check` 通过。

## Decisions and Deviations

- Web 文档是唯一产品语义基线；其他源码不在本轮删除范围内。
- 不读取、修改、格式化或暂存用户保留的未跟踪测试目录。
- 不执行生产部署、数据库迁移或远程历史改写。

## Active Batch

1. 本轮 Web-only 文档清理与构建验证已完成。
2. 停止条件已满足：文档不再包含已移除客户端计划/设计内容；Web 与客户端构建验证结果已记录；只提交本轮相关文档变更。

## Handoff Requirements

- 后续任务从 Web 代码和本文件恢复，不依赖已删除的客户端计划或设计文档。
- 提交前检查 `git diff`、`git diff --cached`、`git diff --check`，并显式确认未跟踪文件未被纳入提交。
