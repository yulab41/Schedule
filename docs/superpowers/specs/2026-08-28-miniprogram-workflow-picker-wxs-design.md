# 小程序年月滚轮 WXS 单引擎与真机门禁设计规格

- 日期：2026-08-28
- 基线：`main@a50b423b`
- 状态：阶段 A 已获目标 Android 明确通过；阶段 B 已批准、待生产接入
- 范围：年月双滚轮、复用滚轮列原语、诊断探针与对应自动/实体测试
- 稳定回退点：`.51@99006ba` / `99006bad`

## 背景与根因

`.51` 恢复了 `.49` 的可用滚轮，但仍把一个滚动动作拆给四条路径：原生 `scroll-view`
处理手势和惯性、CSS `scroll-snap` 尝试吸附、逻辑层在空闲 100ms 后再次设置
`scroll-top`、每个 `bindscroll` 又为 11/12 行重建字号/透明度/缩放并执行 `setData`。
慢速逐格反向会遇到位置所有权竞争；程序化 320ms 吸附也会把逻辑线程和渲染提交抖动放大成
跳帧。

`.50` 删除了逐帧 `setData` 和 JS 吸附，但把连续视觉与索引同步全部押在
`worklet:onscrollupdate + applyAnimatedStyle`。官方编译和静态审计通过，目标 Android 上却同时
缺少吸附、字号变化和透明度变化，证明编译成功不能代表该设备执行了 Worklet。更早的排班矩阵
探针也已在同一目标 Android 上得到相同结论：Pan Worklet 不执行，而 WXS 普通触摸与
`ComponentDescriptor.setStyle` 可以持续跟手，并已通过 7×7/20×30 实体测试。

微信官方 `picker-view` 能稳定拥有滚动与吸附，但只公开值变化、开始和结束等离散事件；
`immediate-change` 只把 change 提前到松手时，未公开连续像素偏移。因此它可以作为稳定回退，
不能单独满足逐像素字号插值。Android `SnapHelper` 和 iOS `targetContentOffset` 能同时实现原生
跟手、连续视觉与吸附，是因为偏移和停止目标属于同一原生滚动系统；小程序必须用一个已在目标
运行时证明可用的视图层引擎建立同样的单一所有权。

## 决策

采用“两阶段、失败关闭”的 WXS 单引擎方案：

1. 先增加一个可复用 `UiWheelColumn` 候选和诊断页单列探针，不修改生产年月滚轮。
2. 候选只由一个 WXS 状态拥有手指位移、投影目标、吸附动画和逐像素样式；高频路径不经过
   `scroll-view`、Worklet、逻辑层 `setData` 或 timer。
3. 目标 Android 实体探针明确通过后，才让生产年月选择器组合两个 `UiWheelColumn`。
4. 若探针失败，停止自绘引擎并前向实现官方 `picker-view` 稳定回退；不再叠加第三套 Worklet、
   CSS snap 或 JS `scroll-top` 补丁。

生产组件在探针通过前保持 `.51` 字节语义；任何体验候选只包含一套实际滚动所有者。

## 目标

- 慢速向下一格后立即向上一格，年/月两列连续 20 次均不漏方向、不出现手指移动而内容静止。
- 新触摸在第一次有效 `touchmove` 即中断上一轮吸附并从当前可见位置继续。
- 松手后只经过一段连续减速到达最近合法行，不出现惯性结束后第二次回拉。
- 数字视觉尺寸、父项缩放和透明度随像素连续变化，静止端点与 `.51` 一致。
- 拖动和吸附每帧只写 `transform`/`opacity`；不布局字号、不重建 item 数组、不调用 `setData`。
- 打开、点行、取消和完成语义不变：完成只发一次最终 `YYYY-MM`，取消零次业务 emit。
- 保留 44px 行高、188px 视口、中心双轨、上下遮罩、年月范围和现有 Sheet 视觉。

## 非目标

- 不修改日期日历、普通 selector、工作流 API、权限、幂等、错误映射或业务写入。
- 不恢复 `.50` 的 Worklet 实现，也不把模拟器/CI 编译当成真机能力证据。
- 不引入 TDesign、WebView、H5、第三方滚轮或 Android/iOS 原生插件。
- 不在本批重做 Sheet 信息层级、配色、尺寸或 Web 黄金。
- 不提交微信审核或正式发布；体验上传和生产 checkpoint 仍按现有发布规则独立执行。

## 组件边界

新增主包原生组件：

```text
apps/miniprogram/src/components/ui/ui-wheel-column/
  index.json
  index.ts
  index.wxml
  index.wxss
  wheel-gesture.wxs
```

`UiWheelColumn` 只负责一列滚轮：

- 输入：`items`、`unit`、`selectedIndex`、`runtimeKey`、`generation`、`commandRevision`、
  `animateCommand`。
- 低频输出：`previewchange`（跨行/投影目标变化）、`settle`（最终静止）。
- 可见替代操作：每一行保持 44px 点按区域；点行通过新的 `commandRevision` 命令同一 WXS
  引擎定位，不创建第二套滚动逻辑。
- 不读取年月业务规则，不拼接 `YYYY-MM`，不直接触发业务 `change`。

诊断页与生产选择器复用同一个组件和同一个 WXS 文件，避免“探针通过、产品另写一套”的证据
断裂。探针阶段只在 `pages/gesture-probe` 使用该组件；生产 `workflow-picker` 的两列接入必须等待
实体探针通过。

## 单一 WXS 运动状态

每列状态按 `runtimeKey` 隔离，至少包含：

```text
animationToken
generation / sequence
tracking / moved / axis
offset / originOffset / targetOffset
startX / startY / lastY / lastTime
velocityY
lastPreviewIndex / lastStyledIndices
commandRevision
```

- `runtimeKey` 由组件实例和 `year|month` 组成；新 generation 会重置旧手势和旧回调。
- 任一 `touchstart` 先递增 `animationToken`，从当前 `offset` 接管，再记录触点；旧 RAF 看到 token
  不一致立即退出。
- 不长期缓存 `ComponentDescriptor`。每帧按稳定 ID 获取 track、相邻 item 和 number 节点，兼容
  逻辑层低频渲染后节点句柄变化。
- config observer 在 `tracking=true` 时只更新边界/版本，禁止用延迟 `setData` 覆盖当前手势；只有
  新 `commandRevision` 且未触摸时才执行打开或点行定位。
- 所有坐标、速度和索引在进入 transform 前检查有限性并钳制；异常值回到最近稳定 offset，不允许
  NaN 进入样式。

## 手势、投影与单段吸附

### 直接拖动

- 2px 以内保持未决状态，避免轻触被识别为拖动。
- 纵向距离超过横向距离 `1.2×` 后锁定纵轴；明确横向意图时放弃本轮滚轮接管。
- 锁定后 `offset = clamp(originOffset + deltaY, minOffset, 0)`，内容严格跟随手指。
- touch event 时间只用于估计最近速度；RAF 不读取浏览器式时间戳，统一按 16ms 逻辑帧推进。
- 速度只接受 0–80ms 的有效采样并钳制在 `[-3, 3] px/ms`。

### 松手目标

松手时一次性计算目标，不先跑一段自由惯性再二次吸附：

```text
projectedOffset = clamp(offset + velocityY × 160ms, minOffset, 0)
targetIndex     = clamp(round(-projectedOffset / 44), 0, itemCount - 1)
targetOffset    = -targetIndex × 44
```

低速逐格以当前位置的最近行结算；快速 flick 可投影跨越多行。目标确定时立即发送一次带
generation/sequence 的 `previewchange`，因此吸附尚未结束时点击“完成”仍提交当前动画目标。

### 单段动画

- 从当前 offset 到 targetOffset 只运行一段可中断 cubic-out RAF。
- 帧数按 `clamp(round(abs(targetOffset - offset) / 8) + 8, 8, 18)` 在 8–18 帧间钳制；每帧进度
  `1 - (1 - t) × (1 - t) × (1 - t)`，最后一帧强制写入精确 44px 行坐标。
- 新触摸、关闭、generation 改变或新 command 均递增 token，旧动画不依赖 `animationend` 收口。
- 动画结束只发一次 `settle`；边界触底/触顶同样走这一条结束路径。
- 直接手势和必要的短距离归位属于功能反馈，不增加弹跳、装饰性 overscroll 或额外震动。

## 逐像素视觉

track 只做 `translateY(offset)`。每帧计算：

```text
position  = -offset / 44
distance  = abs(itemIndex - position)
p         = clamp(1 - distance, 0, 1)
rowScale  = 0.94 + 0.06 × p
opacity   = 0.58 + 0.42 × p
numScale  = (19 + 5 × p) / 24
```

- 数字真实字号固定 24px，数字子层使用 `numScale`；父行使用 `rowScale` 和 `opacity`。
- 组合视觉尺寸继续等价 `(19 + 5p) × (0.94 + 0.06p)`，单位只继承父行缩放。
- 只更新 `floor(position)` 两侧可能具有 `p > 0` 的行，并复位上一帧离开窗口的行；每列每帧最多
  一次 track 写和少量相邻节点 `transform/opacity` 写。
- 不动画 `font-size`、`top`、`height`、`width`，避免重排与文字重新栅格化；这也符合移动端
  “拖动实时反馈、动画可中断、优先 transform/opacity”的 UX 规则。

## 逻辑层数据流与语义

```text
touch / WXS RAF
      │
      ├── setStyle(track + adjacent rows)       每帧，视图层
      │
      ├── callMethod(preview index)              仅跨行/目标变化
      │       └── UiWheelColumn triggerEvent
      │               └── workflow-picker 更新 draft，无业务 emit
      │
      └── callMethod(settle)                      每次静止一次
              └── 最终 index/offset/revision 摘要
```

`previewchange` 和 `settle` 都携带 `runtimeKey + generation + sequence + index`。TypeScript 只接受
当前 generation 且 sequence 递增的事件，避免反向手势、关闭重开或两列交替时的旧回调覆盖。

父 `workflow-picker` 只在低频边界更新 `draftYear/draftMonth/draftDisplayValue/draftIndices`。
`handleConfirm` 使用最新已投影 target；业务 `change`、receiver、Promise/catch、空值、API、权限和
写入次数保持不变。

## 生命周期与多实例

- 现有 picker registry 继续保证同一时间只有一个 workflow picker 展开，但引擎不依赖该假设保证
  正确性；所有状态仍由 `runtimeKey` 隔离。
- 打开月份模式生成新 generation，并以 `animateCommand=false` 定位当前年月，避免首开飞入。
- 点可见行生成新 commandRevision，由同一引擎以短动画定位；触摸开始可立即中断。
- 关闭、父级关闭和 detached 都使 generation 失效并停止 RAF；取消不提交业务值。
- items/range 改变时先钳制 index，再创建新 generation；不得沿用旧节点或旧边界。

## 无障碍与可操作性

- 拖动不是唯一输入：相邻可见行可直接点选，取消和完成保持明确按钮。
- 每行保留 `aria-role="option"`、可读年月标签和低频同步的 `aria-selected`；滚轮列暴露当前选择
  摘要，不用颜色或字号单独表达值。
- 44px 行高和既有操作按钮触控范围保持不变；纵向滚轮不覆盖系统侧滑返回区域。
- 上下遮罩继续只作视觉层并保持 `pointer-events: none`。
- 不增加无限动画；吸附只在用户操作后短暂发生且可被下一次输入取消。

## 诊断阶段与失败回退

### 阶段 A：真机探针

`pages/gesture-probe` 新增 E 区单列滚轮，显示 buildLabel、当前 preview index、最终 settle index 和
generation。现有蓝点 Worklet、黄色点 WXS 与设备信息继续保留，便于同一设备对照。

目标 Android 必测：

1. 慢速下一格后立即上一格，连续 20 次。
2. 停在半格两侧后反向；内容必须在第一个有效 move 跟随。
3. 吸附中反向、连续同向 flick、快速上下交替。
4. 点相邻行后立即拖动；新手势必须中断定位。
5. 顶/底边界各 10 次，关闭重开 10 次。
6. 观察逐像素字号、透明度、中心线和最终 index 一致。

只有用户明确回复该候选在目标 Android 通过，才进入生产接入；模拟器、Vitest、simulate、CI 和
上传成功均不能替代这一门槛。iOS 使用同一清单复核，最迟必须在正式审核前通过。

2026-08-28，用户通过指定 `pagePath` 的直达二维码完成 E 区复核，明确反馈自动吸附、字号/透明度
渐变与慢速反向均正常，且效果符合预期。阶段 A 的 Android 停止门槛已满足；阶段 B 与一级页面
修复的组合发布设计见
[`2026-08-28-miniprogram-primary-workspaces-wheel-release-design.md`](./2026-08-28-miniprogram-primary-workspaces-wheel-release-design.md)。

### 阶段 B：生产接入

年月两列替换为两个 `UiWheelColumn`；删除旧 `scroll-view`、CSS snap、100ms/320ms timer、
`scroll-top` animation owner、逐帧 item 数组重建和 `.50` Worklet 残留。日期/selector 不变。

### 失败回退

若阶段 A 任一核心项失败：

- 不修改生产 workflow picker，探针失败结论写入 pitfall。
- 停止 WXS 参数叠补丁；若失败来自明确且可单变量验证的实现错误，只允许一次新的最小探针。
- 仍失败则使用官方 `picker-view`：原生滚动/吸附、静态渐变遮罩、跨行或停止时离散字号变化。
- 回退明确放弃“逐像素字号”，优先保证跟手和吸附；不得让 picker-view 与自绘引擎同时运行。

若阶段 B 真机失败，创建新的前向 revert checkpoint 恢复 `.51` 运行语义并重新上传体验版；不
reset、不改写历史。

## 自动测试设计

阶段 A 先红后绿：

1. `UiWheelColumn` 结构/WXS 契约：普通 `view` 触摸入口、稳定节点 ID、无 `scroll-view`/Worklet。
2. VM WXS harness 覆盖慢速 `7 → 7.25 → 7.51 → 7.49 → 7`、低速半格、快速投影、上下边界。
3. 吸附中反向证明旧 token 停止，下一 move 从当前 offset 连续接管。
4. 两个 runtimeKey、关闭重开和延迟旧 sequence 不得交叉污染。
5. 同一行内 100 个像素 update 期间逻辑层 `setData` 为 0；跨越 N 行时草稿 `setData` 不超过 N
   次，`callMethod` 只发生在跨行/目标变化和最终 settle。
6. 所有 transform/opacity 有限，视觉端点和中点公式精确；离开相邻窗口的行恢复基线。
7. 点行、轻触未移动、touchcancel、顶底边界、动画硬收口和一次 settle。
8. probe 页面保留 build/device 信息，production build 必须复制 `.wxs` 并通过 WXS 热路径审计。

阶段 B 继续增加：

1. 年/月独立 generation/sequence、交替操作和多 picker 实例隔离。
2. 打开无动画定位、点行定位可中断、完成一次 emit、取消零次 emit。
3. receiver、Promise/catch、空值、类型收窄、API/权限/幂等和业务写次数逐调用点等价审计。
4. 320px、390px、大字号、中心轨道、遮罩、44px 行与无横向溢出视觉契约。
5. Mini 全量、typecheck、production verify、WXS/Worklet/source/package/determinism、simulate、
   CI dry-run、root build/typecheck/test、任务 Prettier/ESLint、`git diff --check` 与 core smoke。

## 交付与 checkpoint

1. 规格 checkpoint：只提交本规格、project status/debug 的本任务 hunk；不接管并行 Profile、登录、
   通讯录、权限或用户工作树。
2. 探针 checkpoint：测试先行实现 `UiWheelColumn + gesture-probe E`，完成自动门禁、Git push、生产
   备份/ECS 同步和单调体验上传；状态只能是“已实现待实体 Android 探针复核”。
3. 用户通过探针后，生产接入作为独立 checkpoint，重新执行完整门禁、体验上传与 Android 复核。
4. iOS 清单在正式审核前完成；审核和正式发布仍需用户另行明确批准。

## 预计修改范围

- `apps/miniprogram/src/components/ui/ui-wheel-column/**`
- `apps/miniprogram/src/pages/gesture-probe/**`
- `apps/miniprogram/src/subpackages/workflows/components/workflow-picker/**`（仅阶段 B）
- `apps/miniprogram/scripts/gesture-probe.test.mjs`
- 新增 `apps/miniprogram/scripts/ui-wheel-column.test.mjs`
- `apps/miniprogram/scripts/workflow-picker-controller.test.mjs`（仅阶段 B）
- `apps/miniprogram/scripts/p7-native-feedback.test.mjs`（仅阶段 B）
- `apps/miniprogram/docs/runbooks/p7-workflow-rc.md`
- `docs/agent-context/pitfalls/mini-workflow-wheel-snap-interruption.md`
- `docs/debug/debug-feedback-log.md`
- `docs/project-status.md`

不修改 Web、API、数据库、contracts、其他工作流 controller 或并行用户文件。

## 参考

- [微信小程序 `picker-view`](https://developers.weixin.qq.com/miniprogram/dev/component/picker-view.html)
- [微信小程序 `scroll-view`](https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view.html)
- [微信 Skyline Worklet](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/worklet.html)
- [微信 WXS 响应事件](https://developers.weixin.qq.com/miniprogram/dev/framework/view/interactive-animation.html)
- [Android `SnapHelper`](https://developer.android.com/reference/androidx/recyclerview/widget/SnapHelper)
- [Apple `targetContentOffset`](https://developer.apple.com/documentation/uikit/uicollectionviewlayout/targetcontentoffset%28forproposedcontentoffset%3Awithscrollingvelocity%3A%29)
- [`ADR-0005-worklet-matrix-engine.md`](../../../apps/miniprogram/docs/decisions/ADR-0005-worklet-matrix-engine.md)
- [`matrix-gesture-lessons.md`](../../../apps/miniprogram/docs/architecture/matrix-gesture-lessons.md)
- [`mini-workflow-wheel-snap-interruption.md`](../../agent-context/pitfalls/mini-workflow-wheel-snap-interruption.md)
