# 小程序年月滚轮 UI 线程设计规格

- 日期：2026-08-27
- 基线：`main@1cbcf755`
- 状态：已实现、上传并发布，待实体 Android 复核
- 范围：`apps/miniprogram/src/subpackages/workflows/components/workflow-picker`

## 背景与结论

实体 Android 已证明 `.48` 修复了“旧 JS 吸附动画不让新触摸接管”的主要竞争，但慢速逐格下滑后立即逐格上滑仍偶发不跟手，自动吸附也有可见跳帧。当前实现同时存在两个滚动位置所有者：

1. `scroll-snap-type: y mandatory` 驱动原生惯性与吸附。
2. 逻辑层在 `scrollend` 后再次用 `scroll-top + scroll-with-animation + 320ms timer` 发起受控吸附。

此外，每个 `bindscroll` 都通过 `setWheelProgress` 重建 11/12 个 item 对象并执行 `setData`；程序化吸附的每一帧也走同一路径。用户输入、逻辑线程、渲染提交和第二次吸附因此互相竞争。

本轮采用 UI-thread Worklet 方案：原生 `scroll-view` 是用户滚动与自动吸附的唯一位置所有者；逐像素字号、透明度和缩放全部由 UI 线程根据实时 `scrollTop` 计算；逻辑层只在跨越一行或最终停止时接收离散索引。

## 目标

- 慢速逐格下滑后立即反向逐格上滑，年份和月份两列都持续跟手，不丢失方向变化。
- 原生惯性和吸附期间没有逐帧 `setData`，没有 JS timer 参与滚动位置控制。
- 保留现有逐像素视觉：数字从 19px 视觉尺寸连续过渡到 24px，父项缩放从 0.94 连续到 1，透明度从 0.58 连续到 1。
- 静止外观、44px 行高、188px 视口、中心双轨、上下遮罩、完成/取消语义与 Web parity 不变。
- 用户点击“完成”仍只发出一次最终 `YYYY-MM`；取消仍零次 emit。

## 非目标

- 不改日期日历、普通 selector、工作流 API、权限、幂等、错误映射或业务写入。
- 不恢复此前实体反馈淘汰的 `picker-view`。
- 不新增 WebView fallback，不降低 Skyline 3.3.0 最低版本。
- 不在本轮重做年月选择器视觉或扩大年份范围。

## 架构

### 1. 单一滚动所有权

- 保留 enhanced vertical `scroll-view`、原生惯性和 CSS `scroll-snap-type: y mandatory`。
- 删除用户滚动结束后的 `scheduleWheelSnap`、`snapWheel`、`completeWheelSnap`、`wheelSnapAnimating`、320ms animation timer 和双列共享 animation owner。
- `scrollend` 不再命令滚轮移动，只提交原生最终位置对应的索引。
- 显式设置 `scroll-anchoring="false"`，避免离散摘要/选中态更新反向修正当前滚动位置。
- 不添加 `scroll-snap-stop: always`，保留自然惯性跨越多行。

打开组件和点击可见行仍允许一次性设置目标 `scroll-top`。该操作不建立 JS animation 状态，也不屏蔽后续滚动事件；用户新触摸由原生滚动立即接管。最终 `scrollend` 把受控 `scroll-top` 摘要同步到真实行，防止后续点击因 data 中仍是旧值而失效。

### 2. UI 线程逐像素插值

每列拥有独立 `SharedValue<number>`，值为实时 `scrollTop / 44`。`worklet:onscrollupdate` 只更新对应 SharedValue，不调用 `setData`。

年月项在第一次打开该实例时建立稳定 ID，并通过 `applyAnimatedStyle(..., { flush: 'sync' })` 绑定两层样式：

- item 父层：`scale = 0.94 + 0.06p`，`opacity = 0.58 + 0.42p`。
- 数字子层：真实 `font-size` 固定为 24px，`scale = (19 + 5p) / 24`。

其中：

```text
distance  = abs(itemIndex - scrollPosition)
p         = clamp(1 - distance, 0, 1)
```

父层与数字子层的组合视觉尺寸严格等价于当前公式：

```text
(19 + 5p) × (0.94 + 0.06p)
```

因此保留现有逐像素观感，同时避免每帧修改真实 `font-size` 所触发的文字重新布局/栅格化。单位文字继续只跟随父层 0.94→1 缩放，与当前表现一致。

### 3. 稳定节点生命周期

- 月份模式第一次打开时设置 `wheelMounted=true`，等待渲染回调后只绑定一次 animated styles。
- 绑定后月份滚轮子树在组件实例内保持 mounted；关闭时使用 `hidden`/`aria-hidden` 隐藏，不销毁节点句柄。
- 日期模式和 selector 继续按现有方式挂载，不因本方案常驻。
- 再次打开时只重设 SharedValue、离散草稿和初始 `scroll-top`，不得重复注册 animated style。
- `detached` 后依赖组件实例回收 SharedValue/animated style；不保留模块级滚轮状态。

仓库当前共有 6 个 month-mode picker 实例位置，但只有实际打开过的实例建立 23 行节点与 46 个简单 updater，避免首屏一次性挂载全部滚轮。

### 4. 低频逻辑层同步

Worklet 根据位置计算最近索引。只有最近索引发生变化时，才用预绑定的 `runOnJS` callback 将以下数据发送到逻辑层：

```text
kind + index + generation + sequence
```

- 年/月各有独立 generation 和递增 sequence，逻辑层只接受同 generation 且 sequence 更新的事件。
- 反向滚动会生成新的更大 sequence；先前延迟到达的同向事件不能覆盖。
- 逻辑层仍复用 `applyMonthWheelDraft`，但每跨一行最多执行一次，不按像素执行。
- 非 Worklet `bindscrollend` 保留为最终正确性边界：读取最终 `scrollTop`、提交最近索引并同步对应 `yearWheelTop/monthWheelTop`；它不启动动画。
- `handleConfirm` 在 emit 前以最新 SharedValue/settled index 做一次最终归一，保证滚轮仍有余速时点击完成也提交可见值。

### 5. 静态选中态与无障碍

- `draftIndices` 继续驱动 `is-selected`、文本颜色、字重和 `aria-selected`，但这些只在半行阈值跨越时更新。
- Worklet 负责连续的尺寸、透明度和父层缩放；逻辑层不再维护 `fontSize/opacity/scale` item 字段。
- 居中轨道、标题摘要和屏幕阅读器读取的是同一个离散最近索引。
- `prefers-reduced-motion` 不关闭手指直接驱动的尺寸反馈；它只继续关闭非必要的弹层/装饰动画。原生滚动行为不伪造另一套减速曲线。

## 数据流

```text
手指/原生惯性/CSS snap
          │
          ▼
scroll-view UI thread scrollTop
          │
          ├── worklet:onscrollupdate ──► SharedValue
          │                                  │
          │                                  ├── item scale/opacity（每帧，UI thread）
          │                                  └── 最近索引变化 ──► runOnJS（每行最多一次）
          │
          └── bindscrollend ──► 最终索引与 scrollTop 摘要（一次）
                                             │
                                             ▼
                                  draftYear/draftMonth/标题/完成值
```

## 失败关闭与回退

- Worklet 函数第一条语句必须是 `'worklet'`，production build 和上传继续强制 `compileWorklet: true`。
- Worklet source/output 数量、SharedValue、animated style 和 `runOnJS` 边界均纳入静态与 bundle audit。
- 若 animated style 初始化失败，静态 `is-selected` 样式和最终 `bindscrollend` 仍保证可选择与可提交；不得回退到逐帧 `bindscroll → setData`。
- 若目标 Android 证明 CSS snap 单独仍不能可靠中断，下一架构只能二选一：删除 CSS snap，改由 UI-thread `scrollViewContext` 单独吸附；禁止重新同时启用两套位置所有者。

## 测试设计

### 自动回归

1. 旧源码结构测试先失败：禁止滚轮路径保留 JS snap timer、animation owner、逐帧 `setWheelProgress` 和动态 `wheelSnapAnimating`。
2. Worklet 公式覆盖位置为整数、半行、相邻行、边界外和非有限值；所有 transform/opacity 必须有限且端点精确。
3. 慢速序列覆盖 `7 → 7.25 → 7.51 → 7.49 → 7`，证明下移一格后反向一格均被识别。
4. sequence/generation 覆盖延迟旧事件、关闭重开、年份与月份交叉操作，旧事件不得覆盖新手势。
5. 100 个像素级 update 期间 `setData` 为 0；只在离散索引变化和最终 settle 时允许逻辑更新。
6. 自动吸附、点击行和新触摸打断期间没有 timer；完成一次 emit、取消零次 emit。
7. 首次打开只绑定一次 46 个 updater，再开不重复；关闭后隐藏节点不响应点击或无障碍遍历。
8. Mini source/output Worklet audit、typecheck、production verify、determinism、package、simulate 和 CI dry-run 全部通过。

### 实体 Android

年份和月份两列分别执行：

- 慢速逐格下移一格后立即逐格上移一格，连续 20 次。
- 慢速停在半格附近后反向；不得出现手指移动但内容静止。
- 快速滑动、原生吸附尚未结束时反向接管、交替操作年/月两列。
- 点击可见非中心行后立即拖动；新触摸必须中断程序定位。
- 打开/关闭同一 picker 10 次，位置、渐变和完成值一致。

验收标准：无漏识别方向、无第二次位置回拉、无可感知连续跳帧；静止后单行居中；完成只提交当前可见年月一次。

### iOS 与边界

- 正式发布前补一次实体 iOS 年/月慢速反向和原生弹性边界复核。
- 320px、390px、默认字号和至少一个大字号档确认无裁切、重叠或横向溢出。

## 预计修改范围

- `apps/miniprogram/src/subpackages/workflows/components/workflow-picker/index.ts`
- `apps/miniprogram/src/subpackages/workflows/components/workflow-picker/index.wxml`
- `apps/miniprogram/src/subpackages/workflows/components/workflow-picker/index.wxss`
- `apps/miniprogram/scripts/workflow-picker-controller.test.mjs`
- 新增或扩展 picker Worklet/static audit 测试
- 必要时只补充 `apps/miniprogram/src/types/build-env.d.ts` 的官方事件字段类型
- `docs/agent-context/pitfalls/mini-workflow-wheel-snap-interruption.md`
- `docs/debug/debug-feedback-log.md` 与 `docs/project-status.md`

不修改 Web、API、数据库、contracts、其他工作流 controller 或用户现有未提交文件。

## 参考

- [微信小程序 `scroll-view`](https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view.html)
- [微信 Skyline Worklet](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/worklet.html)
- [Apple Pickers HIG](https://developer.apple.com/design/human-interface-guidelines/pickers)
- `apps/web/src/components/TemporalPicker.vue`：单一 CSS snap、逐帧最近值跟踪与无 JS 二次吸附的 Web 参考实现
