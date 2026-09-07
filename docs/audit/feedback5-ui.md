# Feedback5 UI checkpoint

2026-09-07；基线 `2ed5035c`，独占 general-3，依赖复用、安装0。当前为已实现待真机复核；无上传、部署或业务通知。

## 修复与引入点

- 筛选图标内多余 `>` 文本节点来自 `c7f93d48`，静态DOM回归先读到 `>` 失败，再删除字符通过；三个横线及共享动画不变。
- 账户卡底padding与末行padding叠加（`a50b423b` 卡padding、`de5bc37b` 行padding），底padding8、末行底padding0，按钮仍至少44px。
- 特殊日期文案 `a50b423b` 引入长文与ellipsis，精简为“本月周末/节假”，允许换行。
- 下一班 `a50b423b` 的负字距造成紧密；恢复normal，起止时间之间增加空格，日期/时区/跨日算法不变。
- 共享四月趋势源于 `9e42057c`，本次不改共享包或Web；Mini独立计算含当前月滚动12月，复用当前年并按需增加上一年请求（最多2年）。自然年累计不变，缺失月显示—及说明，真实0显示0且不绘制伪高度柱。

## 验证

- 修改前 `pnpm --filter @schedule/miniprogram exec vitest run scripts/profile-panel-controller.test.mjs scripts/profile-identity-layout.test.mjs`：15通过/13视觉条件skip，11.97秒；生产build+package audit通过，组合耗时3.26秒。
- 红测：新图标测试实际得到 `>`；controller实际4柱而期待12；精简文案不存在。随后绿测。
- 最终相关测试35通过（含17项实际Edge布局代理）；覆盖历史年失败不影响当月及下一班、跨年12月窗口、十二月仅一年度请求、缺失与零区别、原有群组切换迟到响应、390/320及大字号几何。Mini verify、typecheck、icon parity、smoke:check-core通过；后者确认未改Web核心链路。
- Edge截图/geometry在 ignored `runtime/codex/feedback5-ui-layout`，已视觉检查320大字号。属于浏览器布局代理，不能代表Skyline/小米14。
- 同口径静态包：主包1693649→1697935（+4286），总5062991→5067277（+4286），文件332→333；其他分包不变。主包原有1.5M内部warning仍在，包硬门禁通过；矩阵节点1445/1506既有warning不变。
- 原生Console/Network、真机性能和本次UI真机验收当前工具无法测量，暂未验证。

## 下一步

完整 `pnpm miniprogram:test`：144文件通过/1条件skip，895测试通过/15条件skip，110.22秒。单独启用浏览器布局代理的17测试全通过，不将默认skip计作原生证据。

通知胶囊与微信诊断、首次查询方案核验由主任务继续；当前线上观察仍为bfd1fbbd/.94，本checkpoint不部署不上传。
