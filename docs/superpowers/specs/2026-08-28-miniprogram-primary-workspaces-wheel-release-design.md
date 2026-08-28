# 小程序一级页面预挂载、测试中心与 WXS 年月滚轮生产接入设计

- 日期：2026-08-28
- 基线：`main@bfe579ca`
- 状态：用户已确认设计；WXS E 区已在目标 Android 明确通过
- 范围：工作台“通讯录/我的”、统一测试入口、年月滚轮生产接入及对应验证/发布
- 不包含：微信审核、正式发布、Web/API/数据库业务行为变化
- 后继修正：本设计第 2–3 节的“初始树静态预挂载”已由同环境 `.63/.64/.65` A/B 证实会阻断
  workbench 启动；加载边界以后继 `2026-08-28-miniprogram-workbench-post-ready-preload-design.md`
  为准，Skyline 布局、测试中心与 WXS 部分不变。

## 1. 反馈、证据与根因

目标体验版中，从工作台打开“通讯录”和“我的”会得到白屏。Git 索引没有未解决项，相关文件没有
冲突标记；通讯录代码 `6b5b30fb` 后，Profile 代码 `a50b423b` 顺序落地，因此不是并行任务发生文本
覆盖。`.63@57e10cd` 只新增 `UiWheelColumn` 与 `gesture-probe E`，未修改两个业务页面。

共同引入点是 `79a0ae90`：工作台把两个一级页面改成 `wx:if` 首次点击才创建，同时又为组件配置
空白 `view` placeholder；点击 handler 在同一次 `setData` 中先隐藏日历、切换 workspace 并开始注入
业务组件。组件未就绪时，用户只能看到白色 workspace。通讯录匿名边界遥测已证明 controller
`attached` 成功且没有运行时异常，故 API、脚本缺失和 capability 不是白屏主因。

两个页面还机械沿用了 Web CSS。当前 Skyline 配置不支持 `display: grid`，通讯录包含 23 处、Profile
包含 7 处；两个页面的 `scroll-view` 均未声明 Skyline `type`。通讯录新增的原生 `swiper` 又显式
设为 `height: 0` 并依赖 flex 撑开，目标 Android 上存在内容视口坍缩风险。独立 Profile Page 另缺
确定 page 高度和 `ui-sheet` leaf component 声明。

年月滚轮方面，`.63` 的同一 `UiWheelColumn` 已由用户在目标 Android 确认：自动吸附、逐像素字号/
透明度变化、慢速反向接管均正常，且效果符合预期。阶段 A 的实体门槛已满足，可以进入既有 WXS
规格的阶段 B。

## 2. 方案比较与决策

### 方案 A：一级页面静态预挂载 + WXS 双列接入（采用）

工作台创建时即渲染两个业务组件，后台完成跨包注入和数据预热；点击只切换 `hidden`。页面全部使用
Skyline 支持的 flex/确定尺寸滚动布局。年月滚轮直接组合两个已通过真机的 `UiWheelColumn`，删除旧
滚动所有者。代价是工作台首屏会更早注入组件并发起只读预热请求，但这是用户明确接受的取舍。

### 方案 B：改为独立 Page 导航（不采用）

独立 Page 边界最稳、初始负载较小，但会卸载工作台一级内容、失去底栏原地切换与常驻状态，不符合
既有 Web 对等设计和用户“不能等点击再加载”的要求。

### 方案 C：只修补高度与旧滚轮 timer（不采用）

改动最少，但仍保留点击时空 placeholder、原生滚动/CSS snap/JS timer/逐帧 `setData` 多所有者以及
不受支持的 Grid，无法消除根因，也重复此前真机失败路线。

## 3. 工作台预挂载与就绪数据流

工作台 WXML 永久声明 `directory-panel` 与 `profile-panel`，删除两层 `wx:if`。两个 wrapper 继续用
`hidden` 保持一级页面常驻，点击 handler 只更新 `activeWorkspace`、关闭弹层和触发低频图标动画，
不再写 `directoryMounted/profileMounted`。

页面初始渲染即开始 Profile 主包组件注入和 directory 跨分包异步注入。组件可先收到空 `groupId`，
但不得发业务请求；工作台选定群组后，既有 property observer 才启动 Profile 概览和通讯录双 facets
预热。群组切换继续沿用当前 request serial、角色和 capability 失效语义。

为覆盖极快点击和弱网注入，工作台维护 `directoryPanelReady/profilePanelReady`。组件完成 attached 与
首个确定尺寸渲染后发一次不含业务数据的 `panelready`；ready 前 wrapper 显示明确的“正在准备…”
加载层，而不是空白。内部 API loading/error/disabled 状态仍由各面板自己负责。ready 只表示视图已
挂载，不伪装业务请求成功。

Profile 与 directory 继续常驻，返回日历后不卸载；重复进入不重新注入，也不因点击重复请求。

## 4. Skyline 布局修复

本批对两个面板逐规则替换不受支持的 Grid，不进行其他视觉重做：

- 单列卡片、筛选列表和账户明细改为纵向 flex；
- 双列/三列块改为 `flex-wrap` 与确定比例宽度；
- 图标居中改为 flex 的 `align-items/justify-content`；
- Profile 趋势列与统计块使用 flex，保持现有 390/320/大字号顺序和深蓝“下一班”视觉；
- 通讯录模式栏、导览 ribbon、搜索框、结果和筛选项使用 flex 等价布局。

所有纵向 `scroll-view` 显式声明合适的 `type` 和确定视口。通讯录 `swiper` 不再使用 `height: 0`，
而是在固定高度 flex shell 中取得非零剩余空间；`swiper-item` 与内部 scroll-view 保持 100% 高度。
320px 和大字号下不得出现负高度或横向溢出。

独立 `/pages/profile/index` 补齐 Skyline Page 配置、`disableScroll`、确定 page 高度和 `ui-sheet`
声明；静态 include/import 结构继续保留，不能重新变成大型 panel 薄壳注入。

## 5. 统一测试中心

“更多”增加独立的“测试与诊断”分组和“测试中心”入口，直接进入现有
`/pages/gesture-probe/index`。测试期间入口对所有已登录账号显示，不读取群组角色、capability 或
平台管理员状态，也不发业务写请求。

入口只受一个集中布尔值 `buildInfo.testCenterEnabled` 控制，当前测试候选固定为 `true`。未来新增
真机探针统一放入该 Page，不再创建散落的临时入口。正式提交审核前必须把该值改为 `false`，重新
构建/上传无入口候选并运行发布检查；内部诊断 Page 可以保留，不能从正式 UI 到达。

测试中心不展示账号、群组、号码、排班正文或 token；现有 build/device/preview/settle 等低敏诊断
信息保持只在本页显示。

## 6. WXS 年月滚轮生产接入

生产 `workflow-picker` 的 month 模式组合两个现有 `UiWheelColumn`：年份列使用既有年份范围，月份
列固定 1–12。每列拥有独立 `runtimeKey/generation/sequence/commandRevision`，但共享已经通过实体
测试的 `wheel-gesture.wxs`，不复制第二份引擎。

父 picker 只处理低频语义：

1. 打开时创建新 generation，无动画定位当前年月；
2. `previewchange` 更新 draft 年/月和显示值；
3. `settle` 记录最终静止摘要；
4. 点行通过同一 WXS command 动画，可被下一次触摸立即中断；
5. “完成”只提交最新投影目标一次；“取消”零次业务 emit。

接入时删除旧 month wheel 的两个 `scroll-view`、`scroll-top`、CSS snap、100ms/320ms timer、animation
owner、touch/scroll/scrollend handlers、逐帧 item 数组重建和 position state。一个候选中不得同时
存在旧滚轮和 WXS 滚轮。selector 和日期日历保持不变。

## 7. 错误、权限与语义边界

- 页面预挂载只提前既有只读请求，不新增业务写、缓存或离线队列；空 groupId 零请求。
- Profile/通讯录原 receiver、Promise/catch、陈旧响应、`??`/空值和请求次数语义保持；预热后点击
  不再重复请求。
- 测试中心不经过角色工具矩阵，但只包含本地交互探针，不获得额外业务权限。
- 滚轮不修改 API、Bearer、capability、幂等或工作流 controller；完成/取消副作用次数保持。
- 任一组件注入失败必须保留加载/错误说明，不能以白色空 workspace 失败。

## 8. 测试与真机门槛

测试先行覆盖：

1. 旧工作台因 `wx:if` 和 click-time mounted state 失败；新实现静态声明两面板，点击只切 workspace。
2. 所有账号可见测试中心，入口只受集中开关控制；开关 false 时正式 UI 无可达入口。
3. 两面板 ready/loading 边界、空群组零请求、预热后点击零重复加载、群组切换隔离。
4. touched 页面无 `display:grid`、目录 swiper 无 `height:0`、scroll-view 有 type、Profile Page leaf
   components 和确定高度完整。
5. 既有 thin-page、WXML handler、controller、simulate、权限与工作台运行测试保持通过。
6. WXS 阶段 B 覆盖双列 generation/sequence、交替操作、打开、点行中断、完成一次/取消零次，以及
   生产模板不存在旧 scroll/snap/timer 引擎。

完成定向测试后运行 Mini 全量、typecheck、production verify、确定性、source/package/performance、
CI dry-run、root build/typecheck/test、任务 Prettier/ESLint、`git diff --check` 与 core smoke。由于不改
Web 核心链路，无需以 Web browser smoke 代替原生验证。

新体验候选必须在 Android 复核：工作台首次/重复进入通讯录与我的无白屏、预热状态正确；业务年月
双列重复慢速反向、吸附中反向、flick、点行和边界；字号/透明度/中心值一致。iOS 在正式审核前按
同一清单通过。

## 9. Checkpoint 与发布

实现拆为两个可独立回滚的代码 checkpoint：

1. 一级页面预挂载、Skyline 布局和测试中心；
2. WXS 年月滚轮生产接入。

每个完成的代码 checkpoint 都显式暂存自身路径、推送、创建生产备份、部署并运行 full verifier；
小程序使用同一精确 clean commit 上传单调体验版本，执行正式 allowlist ensure/verify、七维
capability 与 unknown=426。最终停止在“待用户实体 Android 业务页复核”；不提交审核、不正式发布。

## 10. 预计修改范围

- `apps/miniprogram/src/pages/workbench/**`
- `apps/miniprogram/src/pages/profile/**`
- `apps/miniprogram/src/components/profile-panel/**`
- `apps/miniprogram/src/subpackages/organization/components/directory-panel/**`
- `apps/miniprogram/src/subpackages/workflows/components/workflow-picker/**`
- `apps/miniprogram/src/components/ui/ui-wheel-column/**`（只复用/必要契约调整）
- 对应 Mini scripts、P7/P10 RC、pitfall、debug 与 project status

不修改用户 `project.config.json`、群组并行 hunk、Web UI2 草稿、根 `src/`、`runtime/` 历史证据或
工作簿。
