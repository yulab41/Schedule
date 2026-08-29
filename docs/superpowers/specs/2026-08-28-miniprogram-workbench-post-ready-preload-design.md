# 小程序工作台首帧后自动串行预载修复设计

- 日期：2026-08-28
- 基线：`main@9becbdf0`，运行时代码 `66952803`
- 状态：已被 2026-08-29 五入口常驻外壳设计取代；Profile post-ready 单挂载仍会冻结
- 范围：登录后进入工作台白屏、通讯录/Profile 自动预载及对应验证发布
- 保持不变：`.65` WXS 年月滚轮、业务 API、权限、登录会话、测试中心、微信审核/正式发布状态

## 1. 可重复证据与根因

实体 `.65` 先正常显示登录界面，有效会话随后快速 `wx.reLaunch('/pages/workbench/index')`，日历首页
白屏。这把故障限定在工作台 Page，而不是 App、登录 Page、会话读取或 reLaunch 发起。

在同一台开发机、同一微信开发者工具 `Stable 2.02.2608040`、同一 production profile 与默认 GPU
环境中，对精确 clean commit 做了三角 A/B：

| 版本  | 精确代码  | 登录页 | 直接打开 workbench                          |
| ----- | --------- | ------ | ------------------------------------------- |
| `.63` | `57e10cd` | 可截图 | 可截图，完整日历壳与错误态可见              |
| `.64` | `712aa4e` | 可截图 | automator 与截图同时超时，Page 无法完成启动 |
| `.65` | `6695280` | 可截图 | 与 `.64` 相同超时                           |

`.63 → .64` 的运行时代码差异由 `712aa4ee` 引入：为了消除 click-time 空 placeholder，工作台初始
WXML 无条件创建 `directory-panel` 与 `profile-panel`。在 Skyline +
`lazyCodeLoading: requiredComponents` 下，登录后的 reLaunch 必须在首帧同时建立日历、主包 Profile
与跨分包 directory 两个大型组件边界，Page 卡在 `onLoad`/首帧完成之前。

`.64` 已经稳定复现，因此 `.65` 的 `66952803` WXS 业务滚轮不是启动白屏成立的必要条件；生产 WXS
保持不动。此前的 click-time 条件创建与当前 initial-tree 双创建分别是同一问题的两个错误极端：前者
Page 能启动但点击目标出现空白，后者目标预热却阻断整个首页。

## 2. 方案比较与决策

### 方案 A：Page 首帧后自动、串行预载（采用）

工作台初始树只建立现有日历壳。`Page.onReady` 证明首帧已经提交后，自动挂载主包 Profile；Profile
发出首个确定视图提交的 `panelready` 后，再挂载跨分包 directory。两个组件一旦挂载即常驻，点击只
切 `hidden`。这同时满足“不等点击才加载”和“不阻塞工作台启动”。

### 方案 B：恢复纯 click-time 挂载

可恢复首页，但重新引入用户已经否决的首次点击加载与空 placeholder，不采用。

### 方案 C：改为两个独立 Page

Page 边界最稳，但会破坏五栏底部导航的原地切换与常驻状态，只保留为方案 A 真机失败后的退路。

## 3. 生命周期与数据流

工作台新增两个明确的宿主挂载状态，初始均为 `false`：

- `profilePanelMounted`
- `directoryPanelMounted`

现有 `profilePanelReady/directoryPanelReady` 继续只表示组件首个视图提交完成，不伪装业务请求成功。

正常流程固定为：

1. `onLoad` 保持现有性能探针、布局与日历加载，不挂载两个大型面板；
2. `onReady` 幂等启动后台预载，只设置 `profilePanelMounted=true`；
3. Profile `panelready` 同时设置 `profilePanelReady=true` 与 `directoryPanelMounted=true`；
4. directory `panelready` 只设置 `directoryPanelReady=true`；
5. 两个组件 ready 后保持挂载，日历/Profile/通讯录切换只改变 `activeWorkspace/hidden`；
6. 群组属性到达后沿用现有 observer、request serial、权限与缓存语义启动只读预热。

极快点击发生在自动预载尚未完成时，handler 立即切换 workspace 并确保目标 mounted；wrapper 显示
已有“正在准备…”loading。该优先级提升发生在 Page 已 ready 之后，不重新进入初始创建边界。

流程不使用任意毫秒 timer，只有 Page `onReady` 和组件 `panelready` 两个真实条件推进。

## 4. 错误与权限边界

- Profile 或 directory 注入失败时，日历、顶部和底栏已经存在；失败只能停留在目标 loading，不得使
  整个 workbench 白屏。
- 组件内部 API loading/error/disabled 继续由各自 controller 展示。
- directory 对无权限/访客仍接收空 `groupId`，点击权限拒绝继续零挂载、零导航、零目录请求。
- Profile 空群组仍按现有 controller 语义不发群组概览请求。
- 不新增重试 timer、离线写队列、业务写或包含业务字段的遥测。

## 5. 语义等价审计

本修复只改变两个组件的创建时点与顺序：从“Page 首帧同时创建”改为“首帧后自动串行创建”。以下
语义不变：

- `this`/receiver：Page handler 与组件 controller 的调用方式不变；
- 异步/错误：Promise/catch、request serial、群组切换失效规则不变；
- 空值：`groupId`、角色、capability 的 `''`/可选值语义不变；
- 副作用：点击零业务写，每个面板只创建一次，已有只读预热最多各一次；
- 登录：有效会话仍由 identity `wx.reLaunch` 直达 workbench；
- 滚轮：`UiWheelColumn`、WXS、generation/sequence、完成一次/取消零次全部不改。

## 6. 测试与发布门槛

先在当前 `.65` 源码上写稳定红灯：

1. 初始 data 必须有 `profilePanelMounted=false/directoryPanelMounted=false`；
2. 两个组件必须受各自 mounted `wx:if` 约束，禁止初始树无条件创建；
3. `onReady` 只自动挂载 Profile，Profile ready 后才自动挂载 directory；
4. 点击可在未完成时提升目标优先级，ready 后重复点击不重复挂载；
5. 访客 directory 继续零请求，identity reLaunch 与 receiver 保持；
6. workflow-picker WXS source/output SHA 与 `.65` 完全相同。

实现后除既有定向、Mini 全量、typecheck、production verify、determinism、source/package/performance、
CI dry-run、root build/typecheck/test、任务 Prettier/ESLint、`git diff --check` 与 core smoke 外，必须从
精确 clean commit 用开发者工具重复 A/B：登录页可截图、`pages/workbench/index` 可截图且页面栈响应。

代码 checkpoint 推送后创建生产备份并部署验证，从同一 clean commit 上传单调 `.66`，完成 allowlist
ensure/verify、七维 capability、unknown=426 与公网 full verifier；不提交审核、不正式发布。

实体 Android 停止条件：登录后 reLaunch 稳定显示日历；不点击也会完成 Profile→directory 后台预载；
首次/重复点击通讯录与我的均无白屏；业务年月滚轮保持 `.65` 已有跟手、渐变和吸附效果。
