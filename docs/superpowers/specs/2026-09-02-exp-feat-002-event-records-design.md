# EXP-FEAT-002 小程序班次事件记录对齐设计

## 目标与范围

本批次修复小程序工作台班次详情中的“事件记录”点击无真实动作问题，并与 Web 班次事件记录语义对齐。基线为执行时最新的 `origin/main@359966f7240d2f557b24dd0c1ac61979d6bb8298`，实现位于独立 worktree `runtime/external-project-worktrees/exp-feat-002-event-records`。

本批次只处理班次事件记录：入口、班次筛选读取、共享 bottom-sheet、事件时间线、状态反馈、权限边界和异步清理。不处理日期选择器、图标系统或 `MINI-G1-004`，不改变服务端 API 合同、数据库结构或业务写请求。

## 根因证据

Web 的 `SelectedDateDutyDetails.vue` 将事件按钮发出 `open-events`，`CalendarView.vue` 清空当前记录并打开 `ResponsiveSheet`，再调用 `api.getGroupEvents(group.id, { pageSize: 100, shiftId: assignment.id })`。sheet 内按 loading、事件时间线和空记录分支渲染 `EventTimeline`。

小程序工作台的两处班次详情模板虽然显示同一路径的 History SVG 和“事件记录”，但都绑定到 `handleUnavailable`。该处理器只更新“功能将在后续阶段开放”的公告，没有 assignment ID、事件 client、sheet 或真实数据请求。引入点由 `git log -S`/`git blame` 定位到 P4 详情迁移提交 `4fe1b5e78`/`d9296df06`；该阶段记录也明确说明事件记录仍停留在 P9 阶段提示。

小程序已有的 `InsightsReadClient.listEvents` 和 `insights.events` endpoint 已支持 `shiftId`、`pageSize`、Bearer transport、compact decoder 与 `insights` capability。它是本批唯一数据入口，不新增一套 API。

## Web → 小程序对齐矩阵

| 能力                | Web 基准                                                                              | 当前小程序                                                | 本批目标                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 点击入口            | `SelectedDateDutyDetails` 的 `open-events` 按钮                                       | 两处详情行调用 `handleUnavailable`                        | 两处详情行携带真实 assignment ID，行和 History SVG 共用 `handleOpenShiftEvents`                      |
| 请求                | `getGroupEvents(groupId, { pageSize: 100, shiftId })`                                 | 已有 `InsightsReadClient.listEvents`，但班次详情未调用    | 复用 `listEvents(groupId, { pageSize: 100, shiftId })`                                               |
| 权限                | API Bearer route 要求 `viewScheduleConfiguration`；成员、管理员、群主可见，访客被拒绝 | More 入口使用 `toolAccess.insights`；详情入口当前无 guard | UI 使用同一 `toolAccess.insights` 关闭无权入口；API 继续做最终 `viewScheduleConfiguration` 校验      |
| 外壳                | `ResponsiveSheet`，标题“班次事件记录”                                                 | 已有共享 `ui-sheet`，fixed/z400/safe-area/顶部拖动区      | 直接复用 `ui-sheet`，不复制 sheet 外壳                                                               |
| 元数据              | `businessDate shiftTypeName · scheduleRoleName`                                       | 详情行已有这些字段但未进入事件界面                        | sheet 显示相同班次元数据                                                                             |
| 顺序                | API 返回倒序；`EventTimeline` 通过 `buildEventTimelineItems` 按时间升序展示           | 事件与统计页使用共享 `buildEventDateGroups`               | 班次 sheet 复用 `buildEventTimelineItems`，同 Web 从旧到新展示                                       |
| 类型/状态/时间      | `getEventTypeLabel`、`eventStatus`、`formatEventTime`；事件类型通过 badge/叙事展示    | 事件与统计页已复用共享事件 presentation                   | 班次 sheet 复用同一 presentation-core 函数，不复制标签表                                             |
| 发起人              | Web 仅在事件叙事可安全取得 `initiatorMemberName` 时显示“由…发起”；不展示 user ID      | 班次详情没有事件内容                                      | 保留 Web 叙事和已提供的成员名；不把 initiated/operator user ID 转成页面内容                          |
| 变更内容            | `buildEventNarrative`、`extractEventChanges`、原因字段；不默认展示原始 payload        | 未展示                                                    | 映射为脱敏展示模型，展示 Web 同源叙事、原因和可安全提取的 before/after 变更                          |
| loading/empty/error | loading；暂无记录；请求失败时可重新进入/错误提示                                      | 无真实状态                                                | sheet 内明确 loading、空记录、错误和重试                                                             |
| 关闭/返回           | ResponsiveSheet 关闭；日历仍在原位置                                                  | 无事件 sheet                                              | 共享 `ui-sheet` 的完成、遮罩、下滑关闭；关闭使请求序号失效并清空数据，系统返回继续由工作台页面栈处理 |
| 跨班次/群组         | Web 打开新 assignment 会先清空旧列表                                                  | 无状态                                                    | 每次打开先清空；assignment/group/serial 均校验，旧响应不得覆盖新 sheet                               |
| 写入                | 只读 GET                                                                              | 无事件请求                                                | 只读 GET；不新增 POST/PUT/PATCH/DELETE                                                               |

## 组件与数据流

不创建新的页面或 API。`pages/workbench/index.ts` 增加班次事件 sheet 的受控状态和独立 request serial；`index.wxml` 在现有 `ui-sheet` 中渲染班次元数据、状态卡和 timeline cards；`index.wxss` 只增加该 sheet 的局部样式。

页面从详情行得到 `assignmentId`，在当前日历私有字段中找到完整 `CalendarDutyAssignment`，用于 Web 同源叙事所需的计划/实际人员上下文。读取结果通过现有 `createRuntimeInsightsReadClient` 发送到 `/groups/:groupId/events?shiftId=...&pageSize=100`。响应先经过已存在的 compact decoder，再由 `buildEventTimelineItems` 排序；每条事件只转换为页面需要的 `eventTypeLabel`、tone、status、时间、叙事、原因、发起人显示和变更摘要，不把原始 event payload、操作编号、用户 ID 或 token 放入 `data`。

## 权限与错误处理

入口 handler 在发起请求前检查当前群组的 `toolAccess.insights`。该矩阵对普通成员、管理员和群主在 `insights` capability 开启时允许读取，对访客或能力关闭时拒绝；服务端 `viewScheduleConfiguration` 仍是不可绕过的权威判断。能力关闭、403、网络错误、解码错误都停留在明确错误状态或关闭，不渲染旧事件数据；重试只重新执行同一个 GET。

打开、重试、关闭、切换群组、退后台和卸载分别推进事件 request serial。结果提交前同时检查 serial、groupId、assignmentId、sheet 是否仍打开以及页面可见上下文。关闭和群组切换清空 cards、meta、error 和 selected assignment；下一班次打开从空状态开始，保证旧响应和旧记录不能残留。

## 永久回归合同

先新增能在旧源码上失败的 Mini 合同，确认两处入口不再绑定占位处理器、拥有 assignment ID、挂载事件 sheet，并通过运行时 mock 证明点击会调用既有 `listEvents`。合同覆盖：

- 成员允许读取时，准确传入当前 groupId、assignmentId/shiftId 和 pageSize 100；不产生写请求。
- 事件按 Web 时间线顺序映射，包含类型、状态、时间、叙事/发起人和变更内容；不暴露 raw payload、操作编号或 user ID。
- loading、空记录、错误、重试和能力/权限拒绝状态。
- 关闭后旧 promise 不得写回；不同班次和不同群组不能显示前一批事件。
- 共享 `ui-sheet` 的标题、关闭事件和页面配置边界保持有效。

## 明确剩余差异

本批班次 sheet 只实现 Web 日历班次详情对应的事件列表，不搬运 Web 事件中心的全局日期折叠、筛选、分页和“关联链”详情按钮；这些属于事件中心能力，不是本入口的班次记录合同。小程序继续遵守隐私边界，只展示 Web 叙事已允许的成员名和变更摘要，不展示原始 payload、操作编号或完整 user ID。Web 当前对访客保留入口后由服务端返回 403；小程序沿既有 More 工具策略在客户端先关闭无权入口，但服务端权限语义不变。

## 验证与交付边界

本批运行相关 Mini 定向测试、Mini 全量、TypeScript、production build、`miniprogram:verify`、Prettier、ESLint、`git diff --check`、状态策略和 `pnpm smoke:check-core`。不调用微信开发者工具，不上传体验版，不部署 production。自动化结果不等同于小米 14 原生验收；最终仅交付下一版体验版的最小人工步骤。
