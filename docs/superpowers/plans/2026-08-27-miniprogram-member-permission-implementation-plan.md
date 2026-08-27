# 小程序普通成员权限与日历偏好实施计划

- 日期：2026-08-27
- 设计：[`../specs/2026-08-27-miniprogram-member-permission-design.md`](../specs/2026-08-27-miniprogram-member-permission-design.md)
- 前置：`.51@99006ba` 回滚发布已完成；等待登录、通知和通讯录重叠文件形成独立 checkpoint
- 范围：小程序 + `@schedule/client-core`，不改 Web/API/数据库

## Task 1：冻结权限与客户端红灯

- 新增纯权限矩阵测试，覆盖 member/owner/administrator/guest/developer-admin 与 capability 关闭组合。
- 扩展工作台导航/runtime 测试，证明旧实现误禁事件/通知中心、保留无权 disabled 项且点击守卫不一致。
- 新增日历偏好 client-core 严格解码和端点测试；旧实现因客户端不存在而失败。
- 扩展群组页/controller 测试，证明普通成员仍可看到或触发创建/加入及成员死按钮，并且没有日历偏好。

## Task 2：实现集中权限矩阵

- 建立无 UI 依赖的纯函数，由角色、后台管理员标记和 capability 快照生成每个工具及分组的可见性。
- 工作台加载、前台恢复和群组切换都刷新该矩阵。
- WXML 用 `wx:if` 移除无权入口与空分组；保留真实异步操作的 busy/disabled 状态。
- 所有工具 handler 在导航前检查同一矩阵；成员事件/通知中心改用成员允许路径。

## Task 3：接入日历偏好客户端

- 在 `@schedule/client-core` 新增严格 decoder、三个 endpoint、client factory 和导出。
- 在 Mini runtime factory 增加 `core` capability 的日历偏好客户端。
- 不修改 contract、API 或 Web 调用点；保持现有请求体和 `null` 语义。

## Task 4：收口群组管理页

- 增加群组生命周期角色门禁，并在请求层跳过成员无用的 catalog/dissolved 读取。
- 隐藏普通成员所有群组/成员管理控件，补齐 handler 防御门禁；保留只读资料、退出群组和手机号公开设置。
- 增加个人/群组日历偏好卡片、启用班种选择、独立加载/错误/重试与保存状态。
- 保留现有成员行 `wx:if` 用户修复，只以独立 hunk 增加本批模板和测试。

## Task 5：验证、checkpoint 与发布

- 定向运行 client-core、workbench、group-settings 和 Page boundary 测试，再运行 Mini 全量。
- 运行 Mini typecheck/production verify/determinism/source/package/CI dry-run、根 build/typecheck/test 和 `pnpm smoke:check-core`；仅在检查要求时运行 Web browser smoke。
- 用 `git log -S`/`git blame` 证据记录 `79a0ae90`、`bc32a4f1`、`70f9a98f`，逐项审计 receiver、Promise/catch、空值、副作用和请求次数。
- 显式路径与 hunk 暂存，排除全部并行用户内容；提交、推送后上传下一未占用体验版本。
- 创建生产备份，按制品哈希执行 full deploy 或 trusted reuse；完成 allowlist、七维 capability、公网 full verifier 和最终状态 checkpoint。不提审、不正式发布。

## 停止条件

Git/origin/production release、体验版本与白名单全部对齐；自动验证通过且用户并行内容保持未提交。最终状态为“已实现并自动验证 → 待实体 Android 复核”。
