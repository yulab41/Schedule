# Agent Context

这里是根级执行路由的详细上下文入口，不替代产品规格、专题 runbook 或 Git 历史。

## 阅读顺序

1. 先读根 AGENTS.md 和 docs/project-status.md。
2. 读取 pitfall-index.json，按 signals、paths、计划命令和预期 diff 选择详情；只读匹配文件。
3. 按任务级别读取 execution-handbook/ 中对应章节；不要把所有章节和技能一次性加载。
4. 需要历史证据时，对 docs/debug/debug-feedback-log.md 使用精确 rg，再读取必要的有界行段。

## 执行手册

- 总目录与级别路由：[execution-handbook/README.md](execution-handbook/README.md)
- 小程序：[execution-handbook/mini-program.md](execution-handbook/mini-program.md)
- 视觉：[execution-handbook/visual.md](execution-handbook/visual.md)
- 系统化调试：[execution-handbook/debugging.md](execution-handbook/debugging.md)
- Web/API：[execution-handbook/web-api.md](execution-handbook/web-api.md)
- 数据库：[execution-handbook/database.md](execution-handbook/database.md)
- 打包与上传：[execution-handbook/packaging-upload.md](execution-handbook/packaging-upload.md)
- production：[execution-handbook/production.md](execution-handbook/production.md)

## 状态与证据

- active：实现或生产证据仍在进行。
- blocked：外部决定、凭据或环境阻塞。
- fixed-pending-external：自动门禁已通过，等待平台或实体设备证据。
- fixed-guarded：实现、验证和回归守卫均已完成。
- superseded：仅为兼容性保留，不作为当前结论。

本机 SSH/VPN 说明和验证台账是被 Git 忽略的本地文件；若存在，只按任务需要读取：
runtime/agent-context/local-machine.md
runtime/agent-context/validation-ledger.jsonl
