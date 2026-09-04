# EXP-ICON-004-B1.1 日历与人员图标动效一致性实施计划

## 范围

基于调查分支 `codex/exp-icon-004-full-20260903` 的 B1 checkpoint，修复用户在体验版
`0.1.0-p10.20260903.81` 发现的日历与通讯录人员模式图标差异。只调整共享视觉数据和平台渲染适配，
不修改业务行为，不重跑阶段 0，不自动进入体验版上传或 production。

## Task 1：失败先行的精确契约

1. 扩展 Mini icon parity contract，读取 shared motion、Web adapter、Mini WXML/WXSS/TS 和生成 SVG。
2. 固定日历 active-only、duration/easing/opacity、无点击弹跳、双色同源资产的断言。
3. 固定人员 `1.8` stroke、未选中 token、520ms/46%/位移和 destination-only 断言。
4. 在未修改生产实现前运行测试并保留实际失败证据。

停止条件：测试不能由当前已定位差异触发，或必须依赖微信开发者工具才能形成可重复证据。

## Task 2：最小共享来源修复

1. 在 `packages/ui-tokens` 增加通讯录模式未选中色 token，并让 Web/Mini 样式消费它。
2. 扩展 Mini asset entry 的 stroke override；manifest 增加日历 secondary variants，并把通讯录模式资产设为 1.8。
3. 由生成器重建 SVG，不手改生成文件。
4. 删除 Mini 日历私有点击动效和状态；把 active 循环降级层收敛为 canonical opacity，不再缩放几何。
5. 保持人员 motion 数值、切换条件以及日历重复点击的滚动复位调用次数不变。

停止条件：需要复制 path、引入运行时依赖、Canvas/逐帧 `setData`、改变路由/API/数据/权限或扩大为页面改版。

## Task 3：同口径复测与审计更新

1. 运行新增契约、原 B1 定向测试、共享包与 Web/Mini 类型检查。
2. 运行相关 Web tests、Mini 全量 tests、production build、source/package/performance/determinism/verify。
3. 比较 B1 候选 `5,168,783B` total / `1,730,788B` main 与本批结果，记录真实增量。
4. 运行格式、lint、`smoke:check-core`、`git diff --check`，逐行审查行为变化。
5. 更新项目状态、EXP 审计和 debug 日志，明确静态证据与 Xiaomi 14 待验收边界。

## Task 4：调查分支 checkpoint

1. 只暂存本批相关文件，创建一个可独立验证的修复提交。
2. 普通 fast-forward 推送 `codex/exp-icon-004-full-20260903`。
3. 报告候选 SHA、测试结果和建议的下一 trial 版本；停止在上传门禁前。

停止条件：工作树包含无法分离的用户改动、验证失败、包体超预算、远端非 fast-forward，或没有匹配 commit 的候选。
