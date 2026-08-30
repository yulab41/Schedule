# 小程序工作台无外层滑动宿主修复设计

- 日期：2026-08-30
- 基线：`main@11a5a217`，体验版 `.66@4fe1b5e`
- 状态：用户已确认设计，待书面复核后实施
- 不包含：API、数据库、权限、年月滚轮、微信审核或正式发布变化

## 1. 问题与目标

`.66` 虽把 `primaryWorkspaceSwipeEnabled` 固定为 `false`，并用
`horizontal-drag-gesture-handler` 拒绝外层手势，但真机仍可推动工作台原生 `swiper`。此时
`handleWorkspaceSwiperChange` 因开关关闭而拒绝更新 `activeWorkspace`；新显示的 `swiper-item`
又因 `hidden="{{activeWorkspace !== ...}}"` 隐藏内容，最终形成可横滑但滑后白屏的矛盾状态。

目标是从结构上删除全局横向位移能力，而不是继续修补手势拦截。五入口只能由底栏点击切换；
通讯录内部“科室/人员通讯录”原生左右滑动继续保留。

## 2. 方案比较

### A. 移除外层原生 `swiper`，改为五个常驻内容槽（采用）

外层没有可横向滚动的原生节点，因此不同 Android/iOS 运行时都不存在漏接管后的位移路径。现有
`activeWorkspace`、串行挂载、ready 队列和底栏事件可以原样保留，改动局限在展示宿主。

### B. 给外层 `swiper` 增加 `disable-touch`（不采用）

代码较少，但仍保留一个原生横滑状态机，并继续依赖目标基础库、Skyline 与真机对属性的统一实现。
本轮问题正是静态和开发者工具结果不能代表目标真机，因此不再保留这一风险面。

### C. 改用动态 `should-response-on-move` 拦截（不采用）

可继续调节手势协商，但产品已经明确不需要全局横滑。增加 UI 线程协商只会扩大与通讯录内部
`swiper` 的手势所有权和设备差异风险。

## 3. 结构与状态

工作台保持三段常驻结构：单一顶部栏、确定高度的 `workspace-host`、单一底部栏。中间宿主包含
日历、通讯录、换班、我的、更多五个兄弟内容槽，不包含外层 `swiper`、`swiper-item` 或全局
`horizontal-drag-gesture-handler`。

- `activeWorkspace` 决定五个内容槽中唯一可见的一项。
- `activeWorkspaceIndex` 保留用于底栏映射和测试中心诊断，不再驱动原生位移。
- `workspaceMounted` 与 `workspaceReady` 继续控制串行首次挂载和骨架状态。
- 日历与轻量“更多”按现有首屏策略建立；通讯录、我的、换班仍在 core-ready 后串行预载。
- 首次挂载后的 workspace 不因切换销毁，滚动、输入和选择状态继续保留。
- 用户提前点击未挂载入口时，继续复用现有优先级提升与明确骨架屏。

底栏继续调用现有 `activatePrimaryWorkspace`，一次提交 workspace、index、mounted 和附带关闭弹层
状态。重复点击当前入口保持现有幂等/定位行为，不新增动画。

## 4. 手势所有权

删除外层 `horizontal-drag-gesture-handler`、外层 `swiper` 的 `bindchange` 以及只服务于它的
`shouldPrimaryWorkspaceRespond`/`handleWorkspaceSwiperChange`。普通区域横拖不会改变入口，也不会产生
空白中间态。

通讯录组件及其 `directory-mode-swiper` 不作修改；当通讯录为活动入口时，它仍独占科室与人员
通讯录之间的原生左右滑动。日历、换班和 picker 内已有的局部 `swiper` 同样不受外层竞争。

## 5. 生命周期与业务等价边界

本修复只更换展示宿主，不修改账号、群组、权限、capability、Bearer、请求参数、Promise/catch、
空值规则、陈旧响应保护或业务写入次数。Profile、通讯录和换班组件的 attached/ready/active/group
契约保持不变；隐藏内容仍留在同一个 Page 组件树中。

群组角色变化时，无权限入口仍在原位置显示说明且零业务请求；不会因移除外层 `swiper` 强制跳页。
Sheet、picker 和菜单的现有锁状态可以保留作诊断，但不再承担阻止全局横滑的安全职责。

## 6. 回归与真机门禁

测试先在旧代码上失败，冻结以下契约：

1. 工作台不存在外层原生 `swiper`、`swiper-item`、全局横拖 handler 或外层 change 回调；
2. 顶部栏、`workspace-host`、底部栏各只有一个，五个常驻内容槽顺序固定；
3. 底栏点击仍同步 active workspace/index，组件只首次挂载一次并保留状态；
4. 未 ready 入口显示骨架，无权限入口零请求；
5. `directory-mode-swiper` 仍存在并能在通讯录活动时切换两种模式；
6. 年月滚轮 source/output SHA 与 `.66` 完全一致。

用户明确禁止使用微信开发者工具作本轮验证。自动门禁改为结构/运行回归、生产构建、确定性和包体
检查；交互结论只由 Android 与 iOS `.68` 体验版确认：普通区域无全局位移或白屏，五入口点击正常，
通讯录内部左右滑动正常。

实现通过定向、Mini 全量、typecheck、production verify、determinism、source/package/performance/CI、
根 build/typecheck/test 与 core smoke 后创建新体验候选 `.68`；`.67` 继续作为已取消版本，不创建、
不上传。不提交审核、不正式发布。
