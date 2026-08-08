# 设计：换班/加扣班开放当日 + 日历周末醒目样式

- 日期：2026-08-08
- 状态：用户已确认推荐方案（当日权限按“今天或之后”；周末只做颜色区分，不加“六/日”文字标识）
- 实现状态：已实现并部署到服务器自测入口（2026-08-08）

## 1. 背景与目标

当前换班与加扣班只能操作“尚未开始”的班次，导致当天已开始的班次无法操作；用户希望开放当日权限。  
同时，日历中的周六、周日与工作日视觉上没有明显区分，用户希望用樱桃红字体突出周末。

## 2. 当前行为

- 前端 `workflow-logic.ts` 的 `isFutureAssignment` 用 `startsAt > now` 判断，今天已开始的班次不会出现在换班/加扣班候选中。
- 后端换班与加扣班服务的 `assertFutureShift` 同样用 `startsAt <= now` 拒绝，今天已开始的班次无法发起。
- 日历组件 `MonthGrid`、`WeekGrid`、`ListGrid`、`ManualGrid` 均未区分周末与工作日。

## 3. 决策

### 3.1 换班/加扣班当日权限

可操作班次的判定改为“业务日期为今天或之后”：

- 今天及未来的班次允许换班/加扣班。
- 昨天及更早的班次仍然禁止，提示前往“排班补录”。
- 跨日班按开始日期归属。
- 前端候选列表与后端创建校验使用同一口径。

### 3.2 周末醒目样式

- 周六、周日的日期数字和星期文字使用偏大红 `#E03131`。
- 不新增“六/日”文字标识，避免页面臃肿。
- 今天的圆形标记改为金黄色 `#F5C518` 配深色数字，保持优先，不被周末红覆盖。
- 所有日历展示统一生效：月视图、周视图、列表视图、访客日历、排班补录日历、手动排班表头。

## 4. 改动范围

### 前端

- `apps/web/src/features/workflows/workflow-logic.ts`：将“未来班次”判定改为“可操作班次”（业务日期 >= 今天），并同步更新命名与调用点。
- `apps/web/src/features/swaps/swap-logic.ts`、`duty-adjustments/duty-adjustment-logic.ts`：跟随共享逻辑命名变化。
- `apps/web/src/features/calendar/calendar-views.ts`（或 `calendar-logic.ts`）：新增 `isWeekend(businessDate)` 纯函数。
- `apps/web/src/features/calendar/MonthGrid.vue`、`WeekGrid.vue`、`ListGrid.vue`、`features/manual-schedule/ManualGrid.vue`：周末日期/星期应用偏大红样式。
- `packages/ui-tokens/src/tokens.ts`：新增 `weekend: '#E03131'` 与 `todayMarker: '#F5C518'` 颜色令牌并重新生成 `tokens.css`。

### 后端

- `apps/api/src/modules/swaps/swap-service.ts`、`duty-adjustments/duty-adjustment-service.ts`：`assertFutureShift` 改为按业务日期判断，今天及之后允许，已过日期拒绝并提示前往“排班补录”。

## 5. 测试

- `workflow-logic.spec.ts`：显式时钟锁定“今天包含、过去排除、未来包含”。
- 日历工具测试：`isWeekend` 覆盖周六、周日、工作日。
- API 集成测试：今天业务日期的班次（即使开始时间已过）可发起换班/加扣班；已过日期仍拒绝。
- `tokens-css.test.ts`：确认 `tokens.css` 与生成器输出一致。

## 6. 浏览器验证

- `pnpm verify` 全量通过。
- `pnpm smoke:browser` 增加断言：月历中周末日期数字的计算颜色为樱桃红。
- 本地开发与服务器自测入口 `http://localhost:8080` 均跑完整冒烟。
- 部署后提醒用户强刷页面（PWA 缓存）。

## 7. 不在本次范围

- 不改变请假、手动排班、补录的日期规则。
- 不新增周末文字徽标。
- 不调整除换班/加扣班之外的“未来班次”限制。
