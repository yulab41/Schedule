# ADR-0002：日常预览不依赖本地微信开发者工具

- 状态：执行边界部分已被 [ADR-0006](ADR-0006-agent-devtools-automation.md) 取代；其余部分仍有效
- 日期：2026-08-18

## 决策

日常循环使用 Web Storybook、`miniprogram-simulate` 和 Node 版 `miniprogram-ci`。不使用 MiniTest/Minium 云测。日常主循环仍不依赖本地微信开发者工具（见下方理由）；Agent 的开发者工具调用权限由 [ADR-0006](ADR-0006-agent-devtools-automation.md) 规定。原生验收仍由用户在实体设备完成。

## 理由与后果

本机工具在无人操作后由自动化唤醒时可能假死，不能成为可靠的 vibe-coding 主循环。Storybook/simulate/CI 分别覆盖设计、状态和编译，但都不等于微信运行时；因此原生验收由用户人工操作 GUI 和实体设备完成。用户反馈“通过”是进入下一阶段的唯一人工门槛，截图比较器只用于失败诊断或用户主动提供截图时的辅助量化。
