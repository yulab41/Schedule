# 月视图已过日期灰底恢复（首页日历 + 访客日历）

## 用户反馈

- 3.17.2 与 3.17.3 两个实例的首页日历月视图、访客页面月视图都缺少“该月已过日期单元格灰底”，
  以前版本有，怀疑某次更新后丢失；要求最小改动完成首页与访客的全面修复，避免重复造轮子，
  不牵连其他外观与代码。

## 引入点

- 旧小程序（Skyline 之前）自带该特性：`1343f4c6^` 的
  `apps/miniprogram/components/calendar-grid/index.wxml` 用 `day.isPast` 输出
  `calendar-grid__day--past`，`index.wxss` 定义 `.calendar-grid__day--past { background: #f3f4f6; }`；
  首页日历 `apps/miniprogram/pages/calendar/index.wxml` 与访客页
  `apps/miniprogram/pages/guest/guest.wxml` 共用该组件，`calendar-list` / `calendar-week` 亦有 `isPast`。
- `1343f4c6`（2026-08-13）`chore: remove legacy mini-program artifacts` 删除整套旧小程序；
  `1f715c96`（2026-08-18）native calendar POC 新建
  `apps/miniprogram/src/components/calendar/calendar-month` 与 `calendar-cell`；
  `ad4cfb2c`（2026-08-23）把工作台月视图接到新组件。三处都没有携带 `isPast` 状态、类或样式。
- 周视图后来由 `50c6d1ed` 补上 `isPast`（`workbench-model.ts` 的 `businessDate < today` 与
  `.week-day.is-past`），Web 端 `apps/web/src/features/calendar/MonthGrid.vue` 一直保留
  `.day-cell.is-past { background: #f3f4f6; }`。因此只有月视图（首页与访客）呈现“某次更新后消失”。

## 根因

- 新版月视图链路根本没有这个状态：`WorkbenchCell` 无 `isPast`、`createMonthCells` 不产出、
  `calendar-month` 不转发、`calendar-cell` 无属性/类/规则。
- 不是基础库差异：日历路径没有任何 `SDKVersion` 分支，3.17.2 与 3.17.3 只是同时缺同一条样式，
  本轮没有新增第二套版本机制。
- 访客页复用 `createWorkbenchViewModel` 的 `monthPanels` 与同一个 `calendar-month` 组件，
  所以两处不是两个缺陷，一处修复即可覆盖。

## 修复

- `features/workbench/workbench-model.ts`：`WorkbenchCell` 增加 `isPast`，`createMonthCells` 产出
  `isPast: !cell.isOutsideMonth && cell.businessDate < today`（复用周视图同款比较语义，排除月外格，
  与 Web 端 `!cell.isOutsideMonth && isPastBusinessDate(...)` 一致）。
- `components/calendar/calendar-month/index.wxml`：按现有写法转发 `is-past="{{cell.isPast}}"`。
- `components/calendar/calendar-cell/index.ts` / `index.wxml` / `index.wxss`：新增 `isPast` 属性、
  `is-past` 类与 `.calendar-cell.is-past { background: #f3f4f6; }`。
- 顺序决策：灰底规则放在 `.calendar-cell.is-pressed` 之前，保留 3.17.2 刚对齐的按压反馈；
  `.calendar-cell.is-holiday` 粉底优先级不变，与旧版小程序一致；未改文字颜色、未新增色板 token
  或依赖、未引入版本分支。
- 影响面：`calendar-month` 的其他消费方（排班预览、补录、POC 页）自带模型且不传该属性，
  默认 `false`，外观与 setData 语义不变；仅首页与访客月视图新增灰底。

## 验证

- RED：`codex/runtime-3172-past-month-gray-20260915` 上新增模型断言（当月已过 `true`、
  今天/未来/月外格 `false`）、simulate 类名断言与来源合同断言后，旧代码 3 项失败 / 26 项通过
  （`runtime/audit/past-month-gray-20260915/red.log`）。
- GREEN：`.139` 基线叠加后定向 49 项通过（workbench / calendar-simulate / guest-runtime）；
  Mini 完整 174 文件 1210 项通过/16 跳过；`determinism.mjs` 通过；主包 1,741,761 B
  （`.139` 为 1,741,484 B，+277 B）；Mini verify 仍只被既有未改手排节点 `1507 > 1506` 阻断。
- 证据日志统一放在 ignored `runtime/audit/past-month-gray-20260915/`。

## 交付

- 体验版 `0.1.0-p10.20260915.140`（说明 `Skyline past-day month gray c6cbb6a`）以
  `production/clean` 上传成功，Manifest `7ae7c623…4acbc9044db`，远端 tag、allocation、Manifest
  与 receipt 一致；候选检查器在上传前与上传后均 `RESULT=PASS`。
- 可信 allowlist 只追加 `.140`，保留 `.136/.137/.138/.139`；allowlist verifier 与完整
  `ecs-verify.sh` 通过，live release 未变，公网 `.140/.139/.138/.137/.136 = 200`、
  动态未知版本 `= 426`。详见
  `runtime-ui-compatibility-past-month-gray-trial-release-20260915.md`。

## 血缘

- 实现检查点 `3a9ccca9`（分支 `codex/runtime-3172-past-month-gray-20260915`，基线 `.138` 记录 `d56ecba2`）；
  上载体把同样 7 个文件线性叠加到当前最新累积体验版 `.139@a9c3204f`（记录提交 `3c8ea88d`）之上，
  不改写并行会话分支、不创建合并提交。
