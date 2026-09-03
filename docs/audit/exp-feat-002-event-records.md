# EXP-FEAT-002 事件记录对齐审计

日期：2026-09-02；基线：执行时最新 `origin/main@359966f7240d2f557b24dd0c1ac61979d6bb8298`；
实现分支/worktree：`codex/exp-feat-002-event-records` /
`runtime/external-project-worktrees/exp-feat-002-event-records`

## 范围与根因

本轮只处理工作台班次详情的事件记录入口、只读读取、展示状态、权限边界和异步清理；日期选择器、图标系统和
`MINI-G1-004` 均未修改。

Web 的入口在 `apps/web/src/features/calendar/SelectedDateDutyDetails.vue`，点击整行按钮后向
`CalendarView.vue` 发出 `open-events`，打开标题为“班次事件记录”的 `ResponsiveSheet`，并使用
`api.getGroupEvents(groupId, { pageSize: 100, shiftId: assignment.id })` 读取事件。小程序原入口在
`apps/miniprogram/src/pages/workbench/index.wxml`，两处详情视图都绑定了 `handleUnavailable`；该处理器只写入
“功能将在后续阶段开放”的无障碍公告，没有班次 ID、API 调用、事件模型或真实界面。引入点已用
`git log -S`/`git blame` 复核：占位处理器来自 `ad4cfb2c`，事件入口来自 `4fe1b5e78`；Web 事件链路/API 来自
`7ac2a07a`/`7ac2a07a` 相关提交。

永久红灯在业务实现前执行：旧源码的检查结果为 `RED: expected 2 real event handlers, found 0`，退出码 1。
绿灯后同一入口检查找到 2 个真实处理器，退出码 0。

## Web → 小程序功能对齐矩阵

| 能力        | Web 事实                                                                                               | 小程序实现                                                                                                     | 对齐结论                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 点击入口    | `SelectedDateDutyDetails.vue` 的 `.event-action` 按钮发出 `open-events`                                | 两处 `.event-action` 使用 `data-assignment-id="{{row.key}}"` 和 `handleOpenShiftEvents`；图标 tap 通过父级冒泡 | 整行与图标均进入同一处理器                                 |
| 事件界面    | `CalendarView.vue` 使用 `ResponsiveSheet`，标题“班次事件记录”                                          | 工作台复用既有 `ui-sheet`，内容由 `components/shift-event-records` 承载                                        | 无平行 modal；沿用共享 bottom-sheet                        |
| API/client  | Web `api.getGroupEvents` 最终读取 `/groups/:groupId/events`                                            | `createRuntimeInsightsReadClient(...).listEvents(groupId, { pageSize: 100, shiftId: assignment.id })`          | 复用 `insights.events` GET；未新增 endpoint                |
| 数据类型    | `ScheduleEventPage`/`ScheduleEvent`，由 contracts 和事件时间线 helper 消费                             | 同一 `ScheduleEventPage`/`ScheduleEvent`，转换为不含 raw payload 的 `ShiftEventCard`                           | 不发明字段；UI 仅保存安全展示模型                          |
| 权限        | API route 对 `viewScheduleConfiguration` 执行群组权限检查                                              | 入口先使用既有 `toolAccess.insights` 守门；服务端 GET 的 `viewScheduleConfiguration` 仍是最终授权              | 访客不发请求；前端不能绕过后端 403                         |
| 顺序        | API 返回新到旧；`EventTimeline` 使用 `buildEventTimelineItems` 排为旧到新                              | 同一 `buildEventTimelineItems`，卡片按旧到新渲染                                                               | 与班次时间线一致                                           |
| loading     | `isLoadingEvents` 时显示“正在加载事件记录”                                                             | `shiftEventState === 'loading'` 使用既有 `ui-loading`                                                          | 已覆盖                                                     |
| empty       | `assignmentEvents.length === 0` 显示“该班次暂无事件记录。”                                             | `shiftEventState === 'empty'` 显示相同文案                                                                     | 已覆盖                                                     |
| error/retry | Web 捕获读取错误并显示用户错误信息；事件中心支持再次读取                                               | `shiftEventState === 'error'` 显示安全错误文案和“重新加载”，retry 仍为 GET                                     | 已覆盖；不显示 token、请求体或原始响应                     |
| 类型/时间   | Web 使用 `getEventTypeLabel`、事件 marker 和 `formatEventTime`                                         | 共享 `getEventTypeLabel`/`getEventTone`/`formatEventTime`，marker 显示为共享语义文字                           | 类型、时间和语义一致；Mini 未改图标系统                    |
| 发起人/叙述 | Web 使用 `buildEventNarrative`；换班/加扣班等已提供发起人姓名时，叙述包含“由…发起”                     | `createShiftEventCards` 传入同一 assignment 和 swap request initiatedAt 上下文                                 | 只展示 Web 已有叙述语义；没有姓名时不把 user ID 冒充发起人 |
| 变更内容    | Web 使用 `extractEventChanges`，没有 narrative 时展示 before → after；assignment sheet 不展示 raw data | 同一 `extractEventChanges` 映射为安全 change value；raw `beforeData/afterData` 不进入 WXML                     | 变更/原因保留，敏感原始 JSON 不展示                        |
| 变更链      | Web 在 assignment timeline 下显示 `buildChangeChainSummary`                                            | 使用共享 `buildChangeChainSummary`，在 sheet 底部显示人员变更链                                                | 数据与顺序一致；Mini 当前为常显，Web 为折叠 details        |
| 关闭/返回   | Web sheet 可关闭；返回由 sheet/页面路由处理                                                            | `ui-sheet` 的 button/backdrop/swipe 都触发 `handleShiftEventClose`；`onHide`/`onUnload` 清理并使请求失效       | 关闭路径不残留；系统返回离开工作台时生命周期清理           |
| 只读        | Web 对应链路只调用事件 GET                                                                             | Mini 仅调用 `listEvents`，无新的 POST/PUT/PATCH/DELETE                                                         | 满足只读合同                                               |

## 实现与安全边界

- `index.wxml` 只负责入口和共享 sheet；`components/shift-event-records` 负责 loading、空、错误、retry、卡片和
  变更链展示。
- `features/workbench/shift-event-model.ts` 只复用 `@schedule/presentation-core/event` 的时间线、标签、叙述、
  变更和变更链规则；事件 ID 仅作为不可见列表 key，raw JSON、token 和权限字段不渲染。
- 每次打开都先清空卡片和变更链，再以 `groupId + assignment.id + shiftEventRequestSerial + isVisible + sheetOpen`
  校验异步响应。关闭、隐藏、卸载、切群组、能力收缩都会递增 serial 并清空 private assignment。
- 入口和 retry 都使用 `toolAccess.insights`；guest 不会向事件 API 发起读取。即便前端状态被篡改，API route 仍按
  `viewScheduleConfiguration` 拒绝未授权访问。

## 剩余差异与验证边界

- Web assignment `EventTimeline` 的“人员变更链”使用原生 `details` 折叠，Mini 目前在共享 sheet 中常显；这是本轮
  有意保留的最小小程序适配差异，不改变数据或权限语义。
- Web 使用 `ChangeBadge` 图形 marker，Mini 使用共享 marker label 文本；本轮没有改动图标系统。
- 当前没有调用微信开发者工具，也没有上传体验版、提交审核或部署 production；Node/静态/构建结果不能代替微信
  原生运行时。下一版 Xiaomi 14 验收步骤见本文最终交付说明和 `docs/audit/STATUS.md`。

## 代码验证证据

- 定向事件测试：`5 tests passed`。
- Mini 全量：`115 files / 626 tests passed`。
- Mini TypeScript、根 TypeScript：通过。
- Mini production build：`281 files written to dist/`。
- `miniprogram:verify`：通过；production `packageBytes=5,143,838`，现有主包/矩阵 warning 保持原类别。
- package audit：通过；total `5,143,838` bytes，main `1,712,119` bytes。
- source audit、determinism、credential-free `miniprogram:ci:dry-run`：通过。
- 全仓 Prettier、ESLint、`git diff --check`、`pnpm smoke:check-core`：通过；未触及 Web 核心链路，未运行产品浏览器冒烟。

## 下一版 Xiaomi 14 最小验收

1. 先核对体验版短 SHA、`trial`、renderer、基础库、微信版本和构建时间与本轮候选一致；不一致的截图或日志不作
   当前版本证据。
2. 登录有权查看排班的成员账号，进入工作台，在月视图或周视图展开一个有变更标记的班次；分别点击“事件记录”文字
   和历史图标，均应打开“班次事件记录”共享半屏 sheet，先出现加载态，再出现真实事件或空记录。
3. 对照 Web 同一班次，核对事件从旧到新、事件类型、北京时间、叙述中的发起人、原因、变更内容和人员变更链；不应
   出现原始 JSON、操作编号、token 或上一个班次的数据。
4. 关闭 sheet 后打开另一个班次，确认旧列表不闪现；在网络失败时确认错误态和“重新加载”能恢复；用遮罩、完成按钮和
   下滑分别关闭，确认页面返回后再次进入不会保留旧请求。
5. 用访客/无权账号验证“事件记录”不会发出事件读取且服务端不会返回事件；记录页面、时间、短 SHA、renderer 和结论。

以上为用户人工 Xiaomi 14 原生验收步骤，完成前状态保持“待用户复核”，不能由 Node 或模拟器结果代替。
