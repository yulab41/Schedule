# ADR-0002：日常预览不依赖本地微信开发者工具

- 状态：已接受
- 日期：2026-08-17

## 决策

日常循环使用 Web Storybook、`miniprogram-simulate`、Node 版 `miniprogram-ci` 和 MiniTest。LLM 永不启动、唤醒、重启或控制本地微信开发者工具 GUI/CLI；用户可人工打开 GUI 诊断。

## 理由与后果

本机工具在无人操作后由自动化唤醒时可能假死，不能成为可靠的 vibe-coding 主循环。Storybook/simulate/CI 分别覆盖设计、状态和编译，但都不等于微信运行时；因此 MiniTest 与实体机仍是原生验收硬门槛。
