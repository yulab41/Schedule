# Skyline 3.17.2 滚轮位移通道与定位当日一次到位（2026-09-17）

## 用户真机复核（体验版 `.149`）

1. 换班年月滚轮**仍无法滚动**；上一轮的 `catchtouchstart/catchtouchmove` 没有解决，说明手势不是被祖先滚动容器拿走。
2. 请假年月日选择左右切月**不再乱跳**（`.149` 的程序化切月 `duration: 0` + 直接结算生效）。
3. 定位到当月当日**偶尔点了没反应**，月份离当月越远越容易遇到（例如从 2028 回到 2026-09）。

## 根因

- A 滚轮：`ui-wheel-column` 的位移由 WXS 写在 `#ui-wheel-track` 的 `transform` 上，而同一个节点在 WXML 里还挂着内联
  `style="transform:translateY({{wheelInitialOffset}}px)"`。拖动时 WXS 每帧 `callMethod('handleWheelPreview')` → 组件
  `setData({ internalSelectedIndex })` → 该模板节点重渲染；3.17.2 会把内联样式整条重新下发，于是 WXS 刚写入的 transform
  被覆盖回初始位移，像素不再移动（内部 offset、选中高亮与 `settle` 仍正常）。3.17.3 对未变化的样式做 diff，所以看起来正常。
  这也解释了旧版本"滚轮在网页渲染器/旧基础库可用、3.17.2 不可用"的差异。
- C 定位当日：`.149` 的实现是"把今天的月份面板作为唯一入场面板放进相邻槽位，等共享 pager 结算"。只要还有未结算的位移
  （连续点箭头、快速连点、上一次动画的 `animationfinish` 尚未到达），开头的守卫就会直接 `return`，表现为"点了没反应"；
  月份越远、点得越多，越容易撞上这个窗口。

## 修复（保持最小）

- A：删除 `#ui-wheel-track` 的内联 `style` 绑定，位移完全由 WXS 拥有（符合既有架构约定"WXS 独占像素样式"）；组件侧不再
  计算 `wheelInitialOffset`。另外，为避免"运行时根本没把 config observer 交给 WXS"时滚轮直接失效，手势在 `touchStart`
  用节点自身 dataset（新增 `data-item-count`、`data-selected-index`）自建基线并立即应用一次样式。
- C：定位当日改为一步重定中心——`resetDatePager()` + 一次 `setData({...createDateDraftPatch(today), dateSwiperDuration})`，
  不再依赖任何待结算状态；受影响运行时仍为 `duration: 0`。随之删除已死的 `_dateLocateTarget` 机制与 `formatMonthValue`。

## 验证

- RED：把 WXS 回退到 `.149` 后，新用例 `seeds its own baseline when the config observer never reaches the wheel` 失败
  （`expected undefined to be 'translateY(-264px)'`），证明缺少 config observer 时滚轮完全没有位移通道。
- GREEN：定向 53 项 + 新增用例通过；Mini 完整 174 文件 1216 项通过/16 跳过；typecheck、production build（366 文件）、
  package（主包 1744556B / 总包 4618961B）、determinism（`21cae2df…3e758`）、`pnpm format:check`、`pnpm lint`、
  `pnpm smoke:check-core`、`agent-context-policy` 通过。`pnpm miniprogram:verify` 仍只被既有未改的手排矩阵节点预算
  `1507>1506` 阻断。
- 未验证：真机拖动与定位灵敏度只能由小米 14 复核；本轮**未上传体验版**（当前消息未包含上传授权）。

## 若真机仍不滚动，需要的新信息（二选一即可定位）

1. 拖动时**中间那一项的高亮/加粗是否跟着换**（说明 WXS 收到手势，问题只在样式通道）；
2. 滚轮**中间项以外的数字是否比中间的小且更淡**（说明 WXS 的样式通道本身是否生效）。

若两者都无，则 3.17.2 上 WXS 的事件与样式通道整体不可用，需要按架构级讨论换实现，不再靠单点猜测。
