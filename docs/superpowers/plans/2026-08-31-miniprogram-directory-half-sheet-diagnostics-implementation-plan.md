# 小程序通讯录半屏筛选与性能诊断实施计划

- 依据：[`../specs/2026-08-31-miniprogram-directory-half-sheet-diagnostics-design.md`](../specs/2026-08-31-miniprogram-directory-half-sheet-diagnostics-design.md)
- 当前只执行阶段 A；阶段 B 以匹配体验版真实数据为前置条件。

## Task 1：半屏筛选 Sheet

1. 记录 `92vh`、搜索入口和能力等待的 `git log -S`/`git blame` 引入点。
2. 先增加动态 window/safe-area/rotation 与静态 flex 滚动红灯。
3. 用运行时 px 高度替换近全屏 CSS，成对管理 resize 监听器。
4. 保留 WXS 横条、固定头部/清除、唯一滚动区、筛选语义和滚动恢复。

停止条件：定向测试全绿，CSS 不含近全屏高度，未改变筛选业务行为。

## Task 2：通讯录性能诊断

1. 扩展现有安全诊断仓库，先红验证开关、20 条上限、清空、复制和敏感字段禁入。
2. 统一请求层只在记录中启用 profile，提取非敏感 request ID 和支持的网络阶段。
3. 在搜索现有边界记录请求前、网络、转换、卡片、`setData`、回调和下一渲染周期；不 monkey patch `setData`。
4. 测试工具增加开始/停止、清空、最近记录、复制 1/10 次和标准步骤。
5. 移除搜索 controller 的一层重复能力等待，保留 transport/executor 安全门禁。

停止条件：诊断字段完整、无原始业务内容、release 不启用 profile、未改 API/contracts/database。

## Task 3：验证、文档与 checkpoint

1. 同口径复测测试、类型、构建、包体、最大文件和静态性能，记录无数据的原生项。
2. 更新运行清单、页面黄金、审计报告/状态、项目状态和调试日志。
3. 逐行审查 diff，只显式暂存本任务文件；提交、推送、备份并部署生产 checkpoint，执行完整 verifier。
4. 体验版上传前另行报告短 SHA、版本描述、脏树和测试页面，并取得用户当次明确同意。

停止条件：production 与 Git checkpoint 一致；未获上传批准前保持“小米 14 待实测”，不进入阶段 B。
