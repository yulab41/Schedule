# Skyline 3.17.2 访客周视图分页对齐（2026-09-15）

## 结论与范围

用户在 `.137@09e63980` 上复核后报告：3.17.2 实例的**访客页面**周视图滑动时乱跳、切到非本周后
点单元格没有反应；同实例月视图正常，成员页面周视图正常，3.17.3 全正常。本轮只修访客页面的周
视图分页，不改月视图、列表视图、成员页面、数据、权限、API 或动画时长。

## 根因

成员页面的周视图在 `.135@c7025b93` 已统一复用月视图同款的 `calendar-period-pager` 三槽环形
状态机；访客页面当时没有同步，仍在用被废弃的“动画后强制归中”方案：

```text
startPeriodSwiper: weekSwiperCurrent = 1 → 0 或 2（260ms）
commitPeriodShift: weekSwiperCurrent = 1，periodSwiperDuration = 0（0ms 回跳）
```

基础库 3.17.2 对这次 0ms 回跳的处理与 3.17.3 不同：它会产生反向动画或补发
`animationfinish`，于是出现“乱跳”。同一次回跳还会让**原生 swiper 停在 2 号页、数据却写着
`current = 1`**。此后渲染把 `relative: 0` 的当前周放回数据上的 1 号位置，原生可见页却仍是 2 号
（内容是下一周），用户点击的单元格属于另一周，选中态落在不可见面板上，表现为“点单元格没反应”。

访客页面渲染时也固定读取 `weekPanels[1]` 作为标题与星期行，与该错位叠加，进一步放大症状。

## 修复

访客页面现在直接导入成员页面同一个 `components/calendar/calendar-period-pager.js`，不再维护
第二套分页实现：

- 新增 `weekRingSlot`/`weekShiftTargetSlot`，用 `requestCalendarPeriodShift`、
  `commitCalendarPeriodSwipe`、`finishCalendarPeriodShift`、`takeQueuedCalendarPeriodShift`、
  `cancelCalendarPeriodShift`、`prepareCalendarPeriodChange` 驱动槽位；
- `renderCalendar` 用 `mapCalendarPeriodRing(view.weekPanels, page.weekRingSlot)` 输出按槽位索引的
  面板；提交后把 `weekSwiperCurrent` 设为当时的 `weekRingSlot`，**不再回到 1 号页**；
- 模板增加 `circular="{{true}}"` 与 `bindchange="handleWeekSwiperChange"`，标题、星期行改为读取
  `weekPanels[weekSwiperCurrent]`，与成员页面契约一致；
- 切换视图与“定位到今天”会重置 `weekRingSlot = 1`、清空队列和待提交槽位，避免跨视图残留。

保留不变：周视图 260ms + `easeOutCubic`、有界队列（±6）、提交锁、月视图/列表视图机制、
成员页面全部实现、3.17.3 与无法读取版本的分页取值与外观。

## RED / GREEN 与验证

- RED：新增 2 项回归（模板环形契约、环形分页行为，覆盖 3.17.2 与正常两种运行时）在旧实现上
  失败——模板缺 `circular`，且提交后 `weekSwiperCurrent` 回到 1 而不是目标槽位。
- GREEN：访客运行时 20 项、联合定向 73 项通过；Mini 完整 174 文件 1203 项通过、16 项跳过；
  根套件 270 文件 1273 项通过、444 项跳过。
- TypeScript、production build（366 文件）、source audit、package audit、determinism、format、
  lint、`smoke:check-core` 通过。主包 1,739,401 B、总包 4,607,055 B，较 `.137` 增加 2,337 B。
- `pnpm --filter @schedule/miniprogram verify` 仍只被本轮未修改的手排模板节点预算
  `1507 > 1506` 阻断，与上一轮基线一致。

## 验收边界

以上都是静态、Node 与构建证据。原生 swiper 的动画与点击位置仍只能由实体微信验证。唯一下一
任务：在 3.17.2 与 3.17.3 两个实例上复核访客页面周视图滑动不再乱跳、切到其它周后点单元格
立即选中，并确认月视图、列表视图与成员页面零回归。本轮尚未上传，需用户对该检查点的当次
明确授权。
