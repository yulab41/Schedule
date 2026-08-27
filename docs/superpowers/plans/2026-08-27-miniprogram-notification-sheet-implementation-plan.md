# 小程序顶部通知 Sheet 实施计划

依据 [`../specs/2026-08-27-miniprogram-notification-sheet-design.md`](../specs/2026-08-27-miniprogram-notification-sheet-design.md)实施，不改工作流滚轮、登录会话或用户并行脏树。

1. 用双群组 API 集成用例、Client Core 编码用例、通知控制器/工作台运行时用例和 UiSheet WXS 用例固定旧实现失败。
2. 为未读计数接口和 `P9InsightsActionsClient` 增加可选 `groupId`，并让带群组筛选的列表返回同范围计数。
3. 实现无业务依赖的 `UiSheet`、WXS 下拉和语义关闭事件；用静态、控制器和 WXS VM 测试验证。
4. 给通知面板增加嵌入式 Web 卡片呈现和 `unreadchanged`，恢复构建产物中重新可达的组件 `index.js`，再将 Sheet、当前群组轮询、红点与生命周期接入工作台。
5. 用生产 Web 组件和确定 fixture 建立 390/320/大字号 Storybook 黄金，更新页面黄金与组件清单。
6. 运行定向与全量测试、Mini typecheck/verify/determinism/package/CI dry-run、Web/Storybook build、根 build/typecheck/test、浏览器 smoke 与 core smoke，并逐行审计行为变化。
7. 显式暂存、提交并推送通知文件；先备份并完整部署 API，再上传下一单调微信体验版、执行 allowlist ensure/verify 和 full verifier。不提交审核或正式发布。
