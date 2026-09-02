# EXP-CALENDAR-003 请假日期选择器设计规格

- 日期：2026-09-02
- 基线：`origin/main@0792ed01`
- 独立 worktree：`runtime/external-project-worktrees/exp-calendar-003-20260902`
- 范围：请假日期选择器的月份横向切换、回到今天和日期选中视觉
- 不处理：图标系统、`MINI-G1-004`、月份滚轮、API、数据库、生产部署和体验版上传

## 1. 反馈、证据与根因

本轮反馈为 `EXP-CALENDAR-003`：请假日期选择器左右滑动顿挫，“回到今天”跳转生硬，选中日期
仍使用蓝色光圈。当前代码和历史证据形成以下对比：

| 维度 | 首页 `calendar-month` | 请假 `workflow-picker` 日期模式 | 结论 |
| --- | --- | --- | --- |
| 视图所有者 | 原生三槽 `swiper`，`circular=true` | 三份面板但非循环 `swiper` | 日期模式缺少稳定的物理槽 |
| 手势提交 | 原生 `change` 只预锁目标，`animationfinish` 才提交 | `change` 立即重建草稿和三份面板 | 数据重建与原生动画竞争 |
| 动画 | `240ms`、`easeOutCubic`，高度另有连续过渡 | `240ms` 只写在模板中，事件后硬回到 `current=1` | 结束时容易出现回拉/跳帧 |
| 相邻数据 | `createMonthRing` 将逻辑前后月预置到相邻物理槽 | 每次 `createDateDraftPatch` 从当前月重建前中后三份 | 快速切换时没有稳定 ring |
| 快速连续操作 | 组件锁住一次提交并累计 `[-6, 6]` 队列 | 没有日期切换锁/队列 | 连续手势和按钮可能互相覆盖 |
| today | 先把目标月放入相邻槽，再复用 programmatic shift | 直接重建今天整月，只旋转图标 `520ms` | 页面替换是瞬时的，不是同一导航管线 |
| WXS/Worklet | 月份横滑不使用 WXS/Worklet | 日期横滑也不使用 WXS/Worklet；月份滚轮另有已验证 WXS | 本轮不引入第三种横滑引擎 |
| 选中视觉 | 首页今日使用 `--ui-color-today-marker` | 日期选中使用 `--ui-color-primary` 蓝色 | 应切换到既有黄色语义 token |

日期分页的首个实现由 `b5603189` 引入，today 图标 timer 由 `0975b2d1` 引入；`git blame` 已确认当前
相关代码仍来自这两轮。根因不是日期规则或业务请求，而是日期模式把原生 `swiper` 的一次横向动画
和逻辑层的整窗重建/中心槽复位放在同一个 `change` 回调中，破坏了首页已经验证的单次提交边界。

## 2. 方案比较与决策

### 方案 A：共享纯状态机与 ring 映射（采用）

新增无 UI 的 `components/calendar/calendar-period-pager.ts`，集中定义三槽状态转移、相邻槽映射、
原生动画参数、一次提交锁和快速操作队列。首页 `calendar-month` 与日期选择器保留各自 WXML 和单元格
渲染，但调用同一组状态转移函数。两个消费者的 today 入口均先预置目标槽，再调用同一 programmatic
shift 管线。

优点是行为边界只有一套，渲染差异仍被隔离；缺点是要把首页当前私有状态迁移到明确的共享契约。

### 方案 B：新增通用日历分页 UI 组件

让一个组件同时负责 `swiper`、状态机和 panel slot，再让首页和工作流传入不同内容。复用更强，但会
扩大 Skyline 组件边界、增加 slot/数据传递复杂度，并可能影响现有首页布局。

### 方案 C：只在日期选择器局部补丁

复制首页的 `circular`、回调和预置逻辑到 `workflow-picker`。改动最小，但会形成两套继续分叉的
状态机，不采用。

## 3. 共享状态机与数据流

共享模块提供以下稳定概念和参数：

- `CalendarPeriodSlot = 0 | 1 | 2` 与 `CalendarPeriodRelative = -1 | 0 | 1`。
- `activeSlot`：当前可见物理槽；`targetSlot`：已由原生 change 锁定、等待完成的槽。
- `shiftPending`：父级尚未提交目标数据时阻止重复提交。
- `queuedDelta`：动画期间按钮/程序操作累计的月份位移，钳制到 `[-6, 6]`，每次结算最多继续一月。
- `CALENDAR_PERIOD_SWIPER_DURATION_MS = 240`、原生 `easeOutCubic` 和首页已有的高度缓动曲线。
- `getAdjacentCalendarPeriodSlot`、`getCalendarPeriodSlotDelta`、ring 映射和目标槽预置函数。

原生 `swiper` 负责距离/速度阈值、跟手、惯性和回弹；逻辑层不新增 `touchmove`、速度估算或
WXS/Worklet。状态机只处理原生事件报告的合法槽位：

```text
native change(target)
  └─ 若未锁定：记录 target，必要时预调高度，不重建当前窗口

native animationfinish(target)
  └─ 若 target 是相邻槽且未提交：activeSlot=target，通知父级一次
       └─ 父级把目标逻辑月写入新 ring，并在 setData 回调后 finish
            └─ 清除锁；有 queuedDelta 时继续一个 programmatic shift
```

首页 `calendar-month` 继续保留 `monthchange/monthsettled` 公共事件和既有高度过渡；仅把内部槽位、
重复事件和队列转移改由共享模块计算。首页 `createMonthRing` 的逻辑数据保持不变，避免改变 API、
节假日读取、selected date 或缓存预载。

## 4. 请假日期模式接入

`workflow-picker` 的 date mode 新增独立日期 pager 状态和 locate target，不触碰 month mode 的
`UiWheelColumn`/WXS。日期 panel 增加稳定的 `relative/slot/key` 信息，前、中、后三个月按照当前
active slot 映射到三个物理槽。

模板使用与首页相同的原生运动合同：

- `circular="{{true}}"`；
- `skip-hidden-item-layout="{{false}}"`；
- `duration` 绑定共享的 `240ms` 数据值；
- `easing-function="easeOutCubic"`；
- `bindchange` 只锁定目标，`bindanimationfinish` 才提交月份变更；
- 不出现 `scroll-top`、`bindscroll`、CSS snap、WXS/Worklet 或第二个横向手势 owner。

上一月/下一月按钮和横向手势都进入相同的 programmatic/native finish 状态机。按钮在动画期间只
累加队列，不直接重建可见窗口；每次 finish 后父级按新 active slot 重新映射逻辑前中后三月，且不
把 `dateSwiperIndex` 硬置回中心槽。日期选择仍只接受当前月份的非 muted、非 disabled 日期。

关闭或 detached 时清除日期 pager 的 pending/queue，并使旧的 finish 事件在没有新 change 锁时失效；
重新打开时以当前属性值重建初始 ring、active slot=1、无动画定位。这样不会把上一轮动画或旧月份
泄露到下一次打开。

## 5. “回到今天”导航

日期 picker 的 today 逻辑分为两条：

1. 今天与当前 draft 年月相同：只更新当前月选中日和摘要，不启动无意义的横向位移；今天超出
   `min/max` 时不改变任何日期状态。
2. 今天位于其他年月：先用同一 ring/目标槽预置今天所在月份，保存 today locate target，再调用
   与上一月/下一月完全相同的 programmatic shift。`animationfinish` 后才将 draft 年月日设为今天，
   完成/取消语义不变。跨年或相隔多月仍只使用一个已预置的相邻槽动画，和首页 `startLocateTransition`
   的导航管线一致；不逐月闪跳。

图标的现有 `520ms` 旋转反馈可以保留，但它不再承担页面定位；测试只把它作为低频反馈，不把 timer
当作月份动画完成信号。

## 6. 日期规则与视觉合同

保持以下业务和展示字段：

- 当前日期选择结果、开始/结束日期规则和 `min/max` 限制；
- 跨月、跨年、月底日期截断；
- 星期、周末/节假日颜色、muted 邻月格、disabled 状态；
- 完成只 emit 一次最终值，取消/关闭不 emit；
- 初始 `value`、重复打开和多 picker registry 互斥。

日期 cell 增加 `isToday` 标识，使 today、selected、disabled 可同时表达：

- 选中日期圆形背景：`var(--ui-color-today-marker)`；
- 选中文字：`var(--ui-color-near-black)`，保证黄色背景上可读；
- 选中规则位于周末/红色日期规则之后，选中周末或节假日不保留红色文字；
- 未选中的今天使用黄色语义 token 的内描边；今天同时被选中时使用 near-black 内描边，和普通选中
  的实心黄色区分；
- disabled 继续通过整体透明度表达，且不改变黄色 token、周末色或首页主蓝主题。

不新增近似黄色，不修改首页 `calendar-cell`、Web 主蓝或图标资源。

## 7. 测试先行与验证边界

在业务实现前先新增/扩展红灯合同：

1. 共享状态机：change/finish 单次提交、重复 finish 忽略、动画中队列、相邻方向、边界和 ring 槽
   映射；确认未 finish 前不提交逻辑月。
2. 首页回归：现有三槽 circular、`240ms/easeOutCubic`、预加载目标槽、today programmatic shift 和
   queued shift 继续成立。
3. 日期控制器：用户横滑、按钮和 today 共用状态机；目标月先进入相邻槽；跨年、快速交替、关闭
   重开旧 finish 隔离；日期选择/禁用/完成/取消和开始结束规则保持。
4. 视觉合同：选中态只使用 `--ui-color-today-marker`，文字为 `--ui-color-near-black`；today
   标识、周末/节假日、disabled 和 selected 组合不产生红色选中文字；模板无旧 center reset 路径。
5. Mini 全量和构建合同：日期相关定向测试、`pnpm miniprogram:test`、Mini typecheck/build/verify、
   source/package/determinism/CI dry-run、根 build/typecheck/test、Prettier、ESLint、diff 和 core
   smoke。未触及 Web 核心链路时仍记录 `pnpm smoke:check-core`，不以 browser smoke 替代原生证据。

自动化只证明事件状态、数据预置、动画调度和静态视觉合同；它不能证明 Xiaomi 14 的真实跟手帧率、
滑动阻尼或“丝滑度”。体验验收必须由用户在与最终 SHA 一致的 Xiaomi 14 体验版上完成。

## 8. 交付、回滚与停止条件

- 本轮只提交本规格、共享 pager、首页适配、workflow picker 日期适配、日期相关测试及必要的状态/
  debug 连续性记录；不接管并行用户文件。
- 不上传体验版、不部署 production；最终只将完成验证的 tip 以一次普通 fast-forward 推送到主线。
- 若共享状态机或日期接入出现无法通过的同一根因三次，停止增量修补，回到状态机边界重新评估。
- 完成自动化后状态为“已完成自动验证 → 待 Xiaomi 14 复核”，并提供用户 3–5 步验收路径；不把
  自动化结果写成真机通过。

## 9. 预计修改范围

- `apps/miniprogram/src/components/calendar/calendar-period-pager.ts`
- `apps/miniprogram/src/components/calendar/calendar-month/index.ts`
- `apps/miniprogram/src/components/calendar/calendar-month/index.wxml`（仅共享参数合同必要调整）
- `apps/miniprogram/src/subpackages/workflows/components/workflow-picker/index.ts`
- `apps/miniprogram/src/subpackages/workflows/components/workflow-picker/index.wxml`
- `apps/miniprogram/src/subpackages/workflows/components/workflow-picker/index.wxss`
- `apps/miniprogram/scripts/calendar-poc.test.mjs`
- `apps/miniprogram/scripts/workflow-picker-controller.test.mjs`
- 新增日期分页/视觉合同定向测试
- `docs/project-status.md`、`docs/debug/debug-feedback-log.md` 和匹配 pitfall 的本任务记录

不修改 `apps/miniprogram/src/components/ui/ui-wheel-column/**`、`ui-sheet`、图标资源、API、数据库、
Web 页面、`MINI-G1-004` 或生产/体验发布脚本。
