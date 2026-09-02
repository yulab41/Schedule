# EXP-FEAT-002 小程序班次事件记录实施计划

依据 [`../specs/2026-09-02-exp-feat-002-event-records-design.md`](../specs/2026-09-02-exp-feat-002-event-records-design.md) 实施，基于 `origin/main@359966f7` 的独立 worktree，保持用户主工作树不变。

1. 记录 clean baseline：Mini 测试、Mini typecheck/build/verify、根 typecheck/lint/format/test、包体与现有 warning；不调用微信开发者工具。
2. 新增 `EXP-FEAT-002` 永久红灯，覆盖旧 `handleUnavailable` 入口、真实 `assignmentId`、共享 sheet、既有 `InsightsReadClient.listEvents` 调用和只读权限边界；在未改业务源码时运行并确认失败。
3. 复用 `ui-sheet` 与 `InsightsReadClient`，在 workbench 接入班次事件状态、Web 同源 presentation-core 映射、loading/empty/error/retry 和 serial/context 隔离。
4. 运行定向合同并确认旧请求、旧事件和跨班次响应不会污染页面；逐调用点审计 receiver、Promise/catch、空值、权限和业务写次数。
5. 运行 Mini 全量、TypeScript、production build、`miniprogram:verify`、Prettier、ESLint、`git diff --check`、状态策略和 `pnpm smoke:check-core`；不运行微信 DevTools，不上传体验版，不部署 production。
6. 更新根状态、审计状态、调试日志和对齐文档，显式审查 diff 后一次性提交并将最终 tip 普通 fast-forward 推送 main，随后停止。
