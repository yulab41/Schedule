# Skyline 3.17.2 滚轮手势、切月动效与定位当日（2026-09-16）

## 用户真机反馈（复核体验版 `.148`）

1. 3.17.2 换班年月选择已不再误关弹窗，但**年月滚轮仍无法滚动**。
2. 3.17.2 点击左右切月按钮（换班弹窗与日历页月历都有）会播放**方向相反**的滑动动效，最终月份正确；3.17.3 正常。
3. 请假弹窗的年月日选择器点“定位当日”会**逐月**回退到当月（3.17.2 与 3.17.3 都有）；日历页的定位当日一次到位。

## 根因

- A 滚轮滚动：`ui-wheel-column` 用 `touch-action: none` 争夺纵向手势，3.17.2 的 Skyline 不按该属性判定手势归属，
  纵向拖动被祖先容器拿走，滚轮自身拿不到拖动（3.17.3 正常）。同款组件与同款遮罩此前在 gesture-probe 页面
  真机验证可用，说明“遮罩 `pointer-events: none` 吞掉触摸”与“WXS 子节点取样式通道 `selectComponent`”不是元凶；
  同一现象在更早的 sheet 内版本表现为“滚动带动整个弹窗”，也符合手势被祖先抢占。
- B 动效反向：三槽环形 swiper 在 3.17.2 上按“最近的等价逻辑槽位”归一 `current`，环形 0↔2 的跳变被渲染成反向的一步滑动
  （落点面板正确，所以最终月份对）；3.17.3 已修。这是渲染器差异，不是本项目状态机错误。
- C 定位当日：`_dateLocateTarget` 旧实现每次结算只前进一步并递归续走，于是屏幕上逐月回放；日历页则把目标月面板
  一次性放进相邻槽位，所以一步到位。

## 修复（最小改动）

- `components/ui/ui-wheel-column/index.wxml`：位移样式保留在内层 `#ui-wheel-track`（写在会裁剪自身的列容器上，整体
  位移不会产生滚动效果）；列根节点由 `bindtouchstart/bindtouchmove` 改为 `catchtouchstart/catchtouchmove`，让滚轮自己
  消费纵向手势，不再被祖先滚动容器抢占。`touch-action: none` 保留，3.17.3 行为不变。
- `components/calendar/calendar-month/index.ts` 与 `components/ui/ui-date-picker/index.ts`：受影响运行时（`SDKVersion === 3.17.2`）
  的程序化切月使用 `duration: 0`，与仓库既有的工作台月份列表“回中 `duration: 0`”先例一致；3.17.3 仍为 240ms 动画。
  同时把结算逻辑抽成 `finishMonthSwipeAt` / `finishDateSwiperAt`，零时长跳变后**直接结算一次**，避免“零时长不触发
  `animationfinish`”把 pager 卡在待结算状态；结算函数幂等，事件随后到达即早退。
- `components/ui/ui-date-picker/index.ts`：定位当日按日历页语义改为“把今天的月份面板作为唯一入场面板放到相邻槽位”，
  一次结算即落在当天，删除逐月续走分支；同月时仍走原来的直接定位快速路径。

## 验证层级

- 静态/Node：定向 53 项、Mini 完整 174 文件 1215 项通过/16 跳过；typecheck、production build（366 文件）、
  package audit（主包 1744335B / 总包 4618740B）、determinism（`2286365b…0973`）、`pnpm format:check`、`pnpm lint`、
  `pnpm smoke:check-core` 通过。
- 开发者工具（基础库 3.17.2、Skyline、本提交）：宿主管弹窗经页面方法可打开（`pickerDialog.open=true`、`hostKey=leave-start-date`）
  且无异常；**该渲染器下元素/组件自动化不可用**（`querySelectorAll` 对页面与组件节点均返回空；`callMethod` 指向组件方法报
  `this.handleDateNavigate is not a function`），因此触摸级滚动与动效方向无法在模拟器取证。
- 未验证：A 的拖动、B 的动效方向、C 的一次到位，均需小米 14 上同版本体验版复核。

## 边界与下一步

- 本轮未上传体验版、未放行、未部署生产，未读取账号或凭证。
- 唯一下一任务：取得当次上传授权后交付体验版并 add-only 放行，由小米 14 双实例复核 A/B/C。
  若滚轮仍不能滚动，请反馈“点滚轮中间那一项是否有反应”：有反应说明是手势抢占（需继续收紧捕获范围），
  完全无反应说明是遮罩命中（需改为不让装饰层参与命中）。
