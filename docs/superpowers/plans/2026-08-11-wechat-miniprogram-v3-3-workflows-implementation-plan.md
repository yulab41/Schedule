# 微信小程序 V3-3 工作流实施计划

> **执行限制：** 本文档使用 checkbox 记录实施步骤，但当前状态是“待用户复核”。用户明确批准本计划前，不得执行 Task 9 的任何代码步骤。Task 10 本轮只冻结范围，不是可执行计划。

**目标：** 在 V3-2 检查点上实现请假、换班、加扣班及审批工作流（Task 9），严格同步当前共享契约、API 事务语义和 Web 已完成的交互修复；同时冻结通知、个人、群组、访客、会话和导航范围（Task 10）。只有 Task 9.3 最终检查点和 Task 9 运行/人工复核全部完成后，才能另写并另行批准 Task 10 文件级计划。

**架构：** V3-3 使用“领域纯逻辑 + 页面控制器 + 展示组件”分层。小程序端点只做真实 API 的类型化封装；纯逻辑负责全天日期、候选班次、动作矩阵、预览指纹、单飞和冲突摘要；控制器负责群组/角色上下文、generation、权威刷新和精确缓存失效；WXML 只消费可序列化 view model。请假、换班、加扣班保留各自真实流程，不用一个虚构的通用 preview/reason/operationId 模板抹平差异。

**技术栈：** Node.js 24、pnpm 11、TypeScript 5.9、Vitest 3、微信小程序基础库 3.16.2、WebView 工作流分包页面、现有原生组件与 bottom-sheet、当前 `@schedule/contracts` 编译期类型、现有 API/数据库事务；不新增运行时依赖。

---

## 1. 计划权威、前置门禁与状态

### 1.1 当前检查点

本计划基于 2026-08-11 的真实仓库状态编写：

- `HEAD = origin/main = 9629454`（`test(miniprogram): couple bottom-sheet height guard`）。
- V3-2 Task 6 → Task 7 → Task 8 及后续 UI 修复链均已推送。
- 自动门禁已复跑通过：小程序 `23` 文件 / `105` 测试、config audit、typecheck、lint、`pnpm smoke:check-core`、契约/API 空 diff 和 `git diff --check`。
- 唯一未跟踪路径是用户/DevTools 产物 `apps/miniprogram/minitest/`；必须保留，禁止读取为需求、修改、暂存或提交。
- V3-2 的 Web 对照、WebView fallback、低端 Android/iOS 性能证据经用户确认延后到 V3-6；这不阻塞 V3-3，但不得在状态文档中伪称已经完成。

Task 9 开始前必须重新确认以上事实。若代码、Git 或用户未提交改动已经变化，先重新审计并修订本计划，不能按记忆适配。

### 1.2 行为权威顺序

冲突时按以下顺序解释：

1. 当前共享契约、API 路由/服务、数据库事务和 integration tests：决定字段、权限、状态、版本与并发语义。
2. 当前 Web 运行代码和用户确认的 Web 交互：决定移动端需要同步的业务分支与反馈顺序。
3. 本计划与同步修订后的 V3 设计第 7 节：决定小程序页面分层、触控适配和专项增强。
4. 路线图只决定阶段范围与停止条件，不能覆盖上述接口事实。

旧文档中的“所有写操作都有 preview/operationId”“管理员直办原因必填”“直办受群组审批设置限制”“客户端提供归档动作”均已被后续实现和调试记录覆盖，不得再作为实现依据。

### 1.3 Task 9 范围

Task 9 只实现：

- 全天请假创建、受影响班次提示、列表、取消和撤销。
- 管理员请假审批列表、完整重排预览、批准与驳回。
- 普通换班申请、管理员直办换班、接受/审批/驳回/取消/撤销。
- 普通加扣班申请、管理员直办加扣班、接受/审批/驳回/取消/撤销。
- 三类流程设置的读取/修改入口，以及成员共用的自动接受设置。
- 工作流申请/审批入口、角色动作矩阵、409 权威刷新、generation 防旧响应和实际排班变更后的精确日历缓存失效。

### 1.4 明确禁止

- 不修改 `packages/contracts/**`、`apps/api/**`、`packages/database/**` 或 Web 业务代码来迁就小程序。
- 不给真实合同没有的动作新增 preview、reason、operationId、archive、状态或版本字段。
- 不恢复 V1/V2 页面或复制旧小程序流程代码。
- 不在运行时把 `@schedule/contracts`/Zod 打进小程序包；使用编译期类型和本地 WXML-safe 结构转换/守卫。
- 不实现离线写入、自动重试队列或 409 自动重放。
- 不在 Task 9 请求微信订阅授权；该用户手势流程属于 Task 10。
- guest 不加载工作流端点；platform admin 身份本身不提升群组工作流权限。
- 不执行 Task 10 页面代码、会话改造或访客 API 修改。

## 2. Web 回归基线与纠偏台账

Task 9 必须把 Web 后续修复当成回归基线，而不是只参照早期 V3 摘要。

| 提交                            | 已验证语义                                 | Task 9 约束                                         |
| ------------------------------- | ------------------------------------------ | --------------------------------------------------- |
| `6452fa9`                       | 管理员直换与默认设置                       | 直换必须提供；先 preview；无 reason；直接 completed |
| `5d8b205`                       | 成对加扣班流程                             | 普通加扣班按真实 pair 模型和服务端 next status      |
| `cbe2e89`                       | 直代/撤销原因改为选填                      | 管理员直代不要求原因，空值不发送                    |
| `f28d983`                       | 换班撤销原因选填                           | 不在 UI 或本地校验中强制填写                        |
| `d00f86b`                       | 请假原因选填、辅助提示非阻塞、审批快捷入口 | 创建与审批分成两条不同流程                          |
| `0609cb5`                       | 全天请假与首尾包含 UI                      | UI 日期包含，API 结束边界排他                       |
| `49f492a`                       | 排他结束日的受影响班次修复                 | 结束日次日班次不能误计入                            |
| `77c3490`                       | 请假取消/撤销                              | 使用真实 mutation result，刷新后不虚构列表状态      |
| `e8ab017`                       | preview 显示活动工作流 blocker             | 不只显示排班冲突摘要                                |
| `772f40f`                       | 409 刷新后保留原消息                       | 固定“捕获 → 刷新 → 发布原错误”顺序                  |
| `4540e13`、`d14a4ff`、`11094e3` | 今天可操作、共享候选逻辑与候选标签         | 按中国业务日期，不按 `startsAt > now`               |
| `de3acab`                       | 多管理员已处理状态                         | 刷新后显示 `decidedByMemberName`，隐藏过期待办动作  |
| `f65a57d`、`3b0b4a7`、`5689671` | 可撤销、自愈归档、工作流顺序               | 只消费 `isRevocable`/阻塞原因，不推算或提供 archive |
| `b423807`                       | 统一冲突与 `latestData`                    | 安全解析已知字段，未知结构回退原 message            |
| `3199991`、`370bb87`            | operationId 并发与错误分类                 | 只在合同支持的动作发送；同键回归由 API tests 锁定   |
| `b9ab3d3`                       | 历史请求快照                               | 历史卡片消费服务端快照，不从当前日历反拼            |
| `1c5d2c5`                       | fetch receiver 绑定回归                    | 平台方法保持成员调用，不抽取未绑定方法              |
| `c39b793`                       | direct 事件真实操作者                      | 展示服务端操作者，不用当前用户猜测                  |

相关人工调试证据集中在 `docs/debug/debug-feedback-log.md` 的管理员直办（162–170）、原因选填（501–533）、请假非阻塞与审批快捷入口（522–569）、preview/create 409（609–631）、冲突摘要（710–716）、operationId/请假例外（720–779）和候选班次（1054–1078）。实现者必须在每个领域任务开始时阅读当前 Web 组件和这些记录，不允许只读取本表。

## 3. 逐动作业务矩阵（规范）

| 动作                              | 提交前信息                                                          | reason         | operationId / 版本                                   | 最终语义                                                                                     |
| --------------------------------- | ------------------------------------------------------------------- | -------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 新建请假                          | 无正式 preview；受影响班次查询可失败且非阻塞                        | 选填，空值省略 | 当前创建合同无 operationId                           | 创建后刷新申请列表                                                                           |
| 批准请假                          | 必须使用审批 preview；策略变化重取                                  | 无新增 reason  | preview 返回的申请/规则/期间版本 + operationId       | 服务端事务重排或仅记录请假                                                                   |
| 驳回请假                          | 专属确认，不 preview                                                | 无             | expectedVersion + operationId                        | 刷新待办/历史                                                                                |
| 取消 pending 请假                 | 专属确认，不 preview                                                | 无             | expectedVersion + operationId                        | 成功后记录不再出现在真实三状态列表中                                                         |
| 撤销 approved 请假                | 专属确认，不 preview                                                | 无             | expectedVersion + operationId                        | 不自动恢复审批时已重排的班表                                                                 |
| 普通换班                          | 必须 preview；字段变化失效                                          | 合同无字段     | operationId；事务最终重验                            | 状态完全使用服务端 `nextStatus`                                                              |
| 管理员直换                        | 必须 preview；字段变化失效                                          | 合同无字段     | operationId；需 `manageSwaps`                        | 直接 completed，绕过对方接受和群组审批                                                       |
| 普通加扣班                        | 必须 preview；字段变化失效                                          | 选填，空值省略 | operationId；事务最终重验                            | 状态完全使用服务端 `nextStatus`                                                              |
| 管理员直代                        | 当前 Web 直办不调用 preview；API 无 direct 专用 preview，写接口校验 | 选填，空值省略 | operationId；需 `manageDutyAdjustments`              | 直接 completed，绕过目标成员接受和群组审批                                                   |
| 换班/加扣班接受、批准、驳回、取消 | 展示服务端已保存摘要；无专用 preview                                | 无             | 对应 mutation input 的 expectedVersion + operationId | 服务端事务重新校验，刷新权威列表                                                             |
| 换班/加扣班撤销                   | 专属确认；无 preview                                                | 选填，空值省略 | 对应 revoke input + operationId                      | 只按服务端可撤销结果和阻塞原因                                                               |
| 自动归档展示                      | 无写动作                                                            | 不适用         | 不适用                                               | `request.status === 'completed' && request.isRevocable === false`，没有 archive 按钮或新状态 |

### 3.1 全天请假日期

- 页面只收开始业务日期、结束业务日期、类型和选填原因，不提供半天/时分输入。
- UI 按首尾包含计算天数；发送 `startsAt = 开始日 00:00 CST`，`endsAt = 结束日次日 00:00 CST`，形成半开区间。
- 受影响班次按中国业务日期和该半开区间判断；不得直接用 UTC 零点或把结束日次日班次算进去。
- 受影响班次接口是辅助提示：失败时显示“暂时无法获取影响明细”，但保留提交；存在空缺/未覆盖班次时显示建议和明细，也不阻止提交。明确区分“查询失败”和“确实没有已发布班次”是小程序专项增强，不能称为当前 Web 已有表现。
- `resolutionMode` 不作为创建前必填 UI；完整策略、冲突和版本快照只在审批 preview 中出现。

### 3.2 普通申请状态

普通换班/加扣班均不由客户端重算 next status：

| 对方自动接受 | 对应群组审批开关 | 服务端预期状态     |
| ------------ | ---------------- | ------------------ |
| `false`      | 任意             | `pending_target`   |
| `true`       | `true`           | `pending_approval` |
| `true`       | `false`          | `completed`        |

成员自动接受使用当前服务端共享设置。管理员 direct 是独立特权路径，不受该表控制，不得因 `requiresApproval=true` 隐藏或禁用。

### 3.3 候选班次与历史快照

- 候选班次允许中国业务日期“今天及以后”，即使今天班次已经开始；昨天及更早不可选。
- 跨日班归属开始业务日期；当前实际成员使用 `actualMembershipId ?? plannedMembershipId`。
- 标签固定为“日期 班次全名（星期）· 成员”，周末星期使用语义色，不重复展示班种简称。
- 历史请求优先消费服务端内嵌日期、班次、成员、处理人和撤销阻塞快照；软删除班次或期间不能让卡片失效。

### 3.4 409、单飞与刷新顺序

1. 捕获并保存原始 API 错误、message 和未知 `latestData`。
2. 立即废弃当前 preview，保留用户表单。
3. 刷新工作流列表、审批待办和需要的日历权威状态。
4. 刷新完成或失败后，再发布原始 message；刷新错误不得替换原 409。
5. 仅从 `latestData` 安全提取白名单字段摘要；未知结构只显示原 message。
6. 不自动重放写入，不拿旧 preview 强行提交。

每个写动作使用单飞：同一页面上下文的快速重复点击复用在途 Promise/禁用按钮。与当前 Web 保持一致，支持 operationId 的动作在每次新的明确用户提交时生成新 UUID；本阶段不持久化“网络结果未知时同 ID 手动重试”的客户端状态机。请假创建没有 operationId，只能由客户端单飞防重复。

API integration tests 必须按真实幂等 scope 断言：同一 actor、同一 scope、同一 operationId 且相同 fingerprint 不产生第二条记录；同一 actor/scope/ID 但 fingerprint 不同才返回 409。跨 scope 可以复用相同 UUID。当前 swap revoke fingerprint 不包含选填 reason，仅改变该 reason 不触发 fingerprint 409；计划记录这个既有例外，不把它误写成通用“不同 payload 必 409”。

### 3.5 业务关系与动作资格

动作 VM 的测试维度固定为 `groupRole × requestStatus × actorRelation × isRevocable`。`GroupSummary` 没有当前 `membershipId`，控制器必须通过 `listGroupMembers(groupId)` 中唯一的 `isCurrentUser` 记录解析；不得按姓名匹配。

- 请假申请人：pending 可取消，approved 可撤销；管理员对 pending 批准/驳回、对 approved 可撤销，不额外暴露“代申请人取消”。
- 换班目标成员：`pending_target` 接受/驳回；发起人：`pending_target`/`pending_approval` 取消；管理员：`pending_approval` 批准/驳回。
- 加扣班目标加班成员：`pending_target` 接受/驳回；扣班/发起成员：`pending_target`/`pending_approval` 取消；管理员：`pending_approval` 批准/驳回。
- completed 换班/加扣班只对双方成员或管理员显示撤销，且 `isRevocable === true` 或为兼容旧读模型的 `undefined`；`false` 严格分类为不可撤销/自动归档。
- API 可能允许管理员执行当前 Web 未暴露的额外 cancel/reject；Task 9 不展示这些扩展。若未来要展示，必须作为单独产品决策，不能称为 Web parity。

## 4. 文件职责图

实际编码前先用 `rg --files` 重新验证路径。允许在不改变职责的前提下调整组件拆分，但不得把领域规则塞进 WXML/page handler。

| 路径                                                                   | Task             | 单一职责                                                                         |
| ---------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------- |
| `apps/miniprogram/api/endpoints.ts`                                    | 9.1              | 对齐现有工作流端点、input/output 类型和设置封装                                  |
| `apps/miniprogram/api/endpoints.test.ts`                               | 9.1 新建         | 锁定 URL、method、payload、返回类型边界和 receiver-safe 调用                     |
| `apps/miniprogram/features/workflows/workflow-operation.ts`            | 9.1 新建         | mutation 单飞、preview 指纹、generation/context、409 捕获/安全摘要               |
| `apps/miniprogram/features/workflows/workflow-operation.test.ts`       | 9.1 新建         | 单飞、过期响应、刷新顺序、错误保留、无自动重放                                   |
| `apps/miniprogram/features/workflows/workflow-time.ts`                 | 9.1 新建         | CST 全天半开区间、今天可操作、跨日归属、候选标签                                 |
| `apps/miniprogram/features/workflows/workflow-time.test.ts`            | 9.1 新建         | 日期边界、时区、actual/planned、周末与标签回归                                   |
| `apps/miniprogram/features/workflows/workflow-actions.ts`              | 9.1 新建         | 三领域 role/status/actorRelation/isRevocable 动作矩阵和归档分类                  |
| `apps/miniprogram/features/workflows/workflow-actions.test.ts`         | 9.1 新建         | 四种群角色 × platform 标志 × 业务关系 × 状态 × 可撤销三态表驱动测试              |
| `apps/miniprogram/subpackages/workflows/pages/requests/index.*`        | 9.1/9.2/9.3 新建 | 我的申请/审批待办/历史容器、刷新与领域页路由                                     |
| `scripts/miniprogram-workflows-boundary.test.mjs`                      | 9.1 新建         | manifest 分包、VM-only WXML、无运行时 contracts/Zod、无 guest 入口               |
| `apps/miniprogram/features/workflows/leave-workflow.ts`                | 9.2 新建         | 请假创建/影响提示/审批 preview/动作控制器与 view model                           |
| `apps/miniprogram/features/workflows/leave-workflow.test.ts`           | 9.2 新建         | 全天日期、非阻塞提示、策略重预览、版本与动作回归                                 |
| `apps/miniprogram/subpackages/workflows/pages/leave/index.*`           | 9.2 新建         | 全天请假创建页面                                                                 |
| `apps/miniprogram/components/leave-approval-sheet/index.*`             | 9.2 新建         | 审批 preview、硬 workflow blocker、conflict/vacancy 确认和批准/驳回展示          |
| `apps/miniprogram/features/workflows/swap-workflow.ts`                 | 9.3 新建         | 普通/直办换班 preview、提交与后续动作控制器                                      |
| `apps/miniprogram/features/workflows/swap-workflow.test.ts`            | 9.3 新建         | preview、direct、状态、409、历史/撤销回归                                        |
| `apps/miniprogram/features/workflows/duty-adjustment-workflow.ts`      | 9.3 新建         | 普通加扣班 preview、直代无 preview、提交与后续动作控制器                         |
| `apps/miniprogram/features/workflows/duty-adjustment-workflow.test.ts` | 9.3 新建         | 选填原因、direct、状态、409、历史/撤销回归                                       |
| `apps/miniprogram/subpackages/workflows/pages/swap/index.*`            | 9.3 新建         | 普通/管理员换班页面                                                              |
| `apps/miniprogram/subpackages/workflows/pages/duty-adjustment/index.*` | 9.3 新建         | 普通/管理员加扣班页面                                                            |
| `apps/miniprogram/components/workflow-request-card/index.*`            | 9.2/9.3 新建     | 服务端快照卡片和领域动作事件，不推算权限                                         |
| `apps/miniprogram/components/workflow-preview-sheet/index.*`           | 9.3 新建         | 普通 swap/duty 与 direct swap 的适用 preview 展示                                |
| `apps/miniprogram/components/workflow-conflict-summary/index.*`        | 9.2/9.3 新建     | 原始 409 message 与安全 `latestData` 摘要                                        |
| `apps/miniprogram/store/calendar-cache.ts`                             | 9.1 修改         | 增加已知 context 下的群组+月份精确失效；不做全局清理                             |
| `apps/miniprogram/store/calendar-cache.test.ts`                        | 9.1 修改         | 锁定受影响月份失效和其他用户/群组隔离                                            |
| `apps/miniprogram/store/calendar-cache-runtime.ts`                     | 9.1 新建         | 给日历页和工作流控制器提供同一个 runtime cache adapter；Task 10 再扩展按用户清理 |
| `apps/miniprogram/store/calendar-invalidation.ts`                      | 9.1 新建         | 跨页记录 user/group/month invalidation epoch，让已加载内存 slot 下次 onShow 强刷 |
| `apps/miniprogram/store/calendar-invalidation.test.ts`                 | 9.1 新建         | 锁定写入/消费、跨月、身份隔离和重复 onShow                                       |
| `apps/miniprogram/features/calendar/calendar-page-controller.ts`       | 9.1 修改         | 支持按 context/month 丢弃 ready slot 并强制重取                                  |
| `apps/miniprogram/features/calendar/calendar-page-controller.test.ts`  | 9.1 修改         | 证明 storage 删除后 ready 内存槽也不会继续发布旧排班                             |
| `apps/miniprogram/pages/calendar/index.ts`                             | 9.1 修改         | `onShow` 消费 invalidation epoch，失效内存槽后 force load                        |
| `apps/miniprogram/features/navigation/workbench-navigation.ts`         | 9.1 修改         | 按真实群组角色提供工作流入口                                                     |
| `apps/miniprogram/features/navigation/workbench-navigation.test.ts`    | 9.1 修改         | 角色矩阵和 guest/platform admin 不越权                                           |
| `apps/miniprogram/pages/workbench/index.*`                             | 9.1 修改         | 路由到工作流分包，不承载领域规则                                                 |
| `apps/miniprogram/app.json`                                            | 9.1 修改         | 注册 workflows 分包，不改变四个 tab                                              |
| `apps/web/**`、`apps/api/**`、`packages/contracts/**`                  | 全程只读         | 业务基准与回归验证，不随 Task 9 修改                                             |

页面组件名称可以在首次红测后做一次最小调整；一旦 9.1 checkpoint 建立，9.2/9.3 不再重命名公共模块，避免 Task 10 规划引用漂移。

## 5. Task 9.1：端点对齐、并发内核与路由壳

### 5.1 真实端点差异

当前 `apps/miniprogram/api/endpoints.ts` 至少存在以下已知缺口，必须先修，不能等页面类型错误暴露：

| 当前问题                                                           | 正确边界                                                                                                                                |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| swap 接受/取消误用 `LeaveRequestMutationInput`                     | 使用 `SwapRequestMutationInput`                                                                                                         |
| duty 接受/取消误用 leave input                                     | 使用 `DutyAdjustmentMutationInput`                                                                                                      |
| `approveLeaveRequest`/`rejectLeaveRequest` 声明返回 `LeaveRequest` | 分别返回 `ApprovedLeaveRequestResult` / `RejectedLeaveRequestResult`                                                                    |
| `rejectLeaveRequest` 误用 `LeaveRequestMutationInput`              | 使用语义准确的 `RejectLeaveRequestInput`                                                                                                |
| leave preview 参数被压成 strategy 字符串                           | 使用完整 `PreviewLeaveRequestInput`                                                                                                     |
| duty preview 使用匿名 input                                        | 使用 `DutyAdjustmentPairInput`                                                                                                          |
| 缺管理员直换/直代 wrapper                                          | 增加当前 `/swaps/direct`、`/duty-adjustments/direct` 封装                                                                               |
| direct payload 容易误复用普通 preview input                        | direct swap 只发两 assignment ID + operationId；direct duty 发 coveredAssignmentId、overtimeMembershipId、operationId 和非空可选 reason |
| 缺群组 swap/duty settings 与成员 settings wrapper                  | 两页面分别 GET 自己的 my-settings；唯一更新端点是 PUT `/swaps/my-settings`                                                              |
| 缺 leave reflow strategy wrapper                                   | 按当前 group leave strategy GET/PUT 封装                                                                                                |

设置 wrappers 必须逐条锁定为：

| Method | Path                                            | Input                                    | Response                      |
| ------ | ----------------------------------------------- | ---------------------------------------- | ----------------------------- |
| GET    | `/groups/:groupId/swaps/settings`               | 无                                       | `GroupSwapSettings`           |
| PUT    | `/groups/:groupId/swaps/settings`               | `UpdateGroupSwapSettingsInput`           | `GroupSwapSettings`           |
| GET    | `/groups/:groupId/duty-adjustments/settings`    | 无                                       | `GroupDutyAdjustmentSettings` |
| PUT    | `/groups/:groupId/duty-adjustments/settings`    | `UpdateGroupDutyAdjustmentSettingsInput` | `GroupDutyAdjustmentSettings` |
| GET    | `/groups/:groupId/swaps/my-settings`            | 无                                       | `MemberSwapSettings`          |
| GET    | `/groups/:groupId/duty-adjustments/my-settings` | 无                                       | `MemberSwapSettings`          |
| PUT    | `/groups/:groupId/swaps/my-settings`            | `UpdateMemberSwapSettingsInput`          | `MemberSwapSettings`          |

不存在 `PUT /duty-adjustments/my-settings`；两个 GET 对历史未显式设置成员的默认解释不同，所以必须分别请求，不能只取一次后跨领域复用。

### 5.2 测试先行步骤

- [ ] 读取 `packages/contracts/src/{leaves,swaps,duty-adjustments}.ts`、对应 API routes/services/integration tests、当前 Web client 与三个 Web panel；把真实 method/path/input/output 写入端点测试表。
- [ ] 新建 `api/endpoints.test.ts`，先观察错误 input、返回类型和缺失 direct/settings wrapper 的失败；测试通过注入/spy 当前 request 边界，不能发真实网络。
- [ ] 最小修改 `endpoints.ts` 对齐上表；不加入运行时 schema、不修改共享合同。
- [ ] 为 `workflow-operation` 先写失败测试：同 key 双击只执行一次；settle 后可重新提交；上下文/generation 变化时旧结果不发布；409 刷新先于错误发布；刷新失败仍保留原错误；不自动调用 mutation 第二次。
- [ ] 实现单飞、preview 指纹、context key 与冲突捕获。`latestData` 只允许摘要版本、状态、规则版本、期间版本、冲突/阻塞计数和服务端提供的可读原因；不得遍历并渲染任意对象。
- [ ] 为 `workflow-time` 先写失败测试：同日 1 天、8 月 24–27 日不覆盖 28 日、UTC/CST 相邻、今天已开始、昨天、跨日班、`actual ?? planned`、候选标签。
- [ ] 实现纯时间/候选 helper；所有“今天”测试注入 clock 和 China timezone，不读取本机时区猜测。
- [ ] 为 `workflow-actions` 写 `groupRole × requestStatus × actorRelation × isRevocable` 表；通过 `listGroupMembers().isCurrentUser` 解析 membershipId，实现只消费权限/服务端字段的动作 VM。
- [ ] 注册 `subPackages` workflows 请求中心壳；更新 manifest/app-shell boundary 测试，证明主包 tab 不变、分包路由可被 smoke 发现。
- [ ] 更新工作台入口：导航前把用户明确选择的 groupId/role/version 写入当前页面工作流 context，再进入请求中心；有真实 group workflow 权限的角色可进入，guest 无入口，platform admin 若无群角色也无入口。不得借 Task 9 提前实现 Task 10 的持久 last-group 生命周期。
- [ ] 先用失败测试证明“只删 storage cache”仍会让已 loaded 的 ready slot 在 `onShow` 复用旧排班；建立共享 runtime adapter 和 user/group/month invalidation epoch。工作流成功标记月份并删持久 cache；日历 `onShow` 消费标记、丢弃对应内存 slot 后 force reload。不枚举/清空其他 storage，按用户全清留给 Task 10。
- [ ] 运行 9.1 定向验证及 `pnpm smoke:browser` → `pnpm smoke:check-core`，逐行审查 diff；更新项目状态和调试日志后创建独立 checkpoint：`fix(miniprogram): align workflow endpoints and runtime`。

### 5.3 9.1 停止条件

- 端点测试锁定所有 Task 9 method/path/input/output，已知错型和缺失 wrapper 清零。
- 纯内核能够证明单飞、preview 失效、generation、CST 日期、动作权限和 409 顺序。
- 请求中心分包可从工作台按角色打开，guest/platform-admin-only 不加载端点。
- 日历页与工作流控制器共享 cache adapter/invalidation epoch；精确失效已知群组月份后，已加载的 ready slot 也会在下次 `onShow` 强制重取。
- 不包含任何实际请假/换班/加扣班提交 UI；完成 checkpoint 后只进入 9.2。

## 6. Task 9.2：全天请假与审批

### 6.1 创建流程

- [ ] 为 `leave-workflow.test.ts` 写创建红测：全天半开区间、原因空值省略、影响查询失败非阻塞、空缺非阻塞、快速双击仅一次 create、创建 payload 没有 operationId。
- [ ] 实现创建控制器：字段变化触发/废弃辅助影响查询；该查询永不伪装为正式 preview；提交只依赖表单合法性和当前群组上下文。
- [ ] 建立全天请假页：开始/结束日期、类型、选填原因、包含天数、影响明细/失败提示、提交按钮；不出现时分、半天、必填 reason 或必选 resolutionMode。
- [ ] 创建成功刷新我的申请；失败保留表单。若 409，使用统一顺序并清除旧辅助结果。

### 6.2 审批流程

- [ ] 写审批红测：进入 pending 请求后获取完整 preview；策略变化立即失效并重取；新 preview 后重置 conflicts/vacancies acknowledgement；批准 payload 使用 preview 的申请/规则/期间版本；过期 preview 禁止提交。
- [ ] 实现审批 controller/view model，完整显示受影响已发布班次、未发布期间、排班前后、统计、冲突、活动工作流 blocker、连续值班警告、空缺和对应快捷入口。
- [ ] 将 `workflowBlockers` 单独显示为不可确认绕过的硬阻塞：禁用批准或让服务端 409 原因原样显示；`conflicts`/`vacancies` 才允许管理员明确勾选 `acknowledgeBlockers`，`continuousDutyWarnings` 只作为警告展示。
- [ ] 快捷入口只路由至当前 Task 9 已实现的 swap/duty/manual 目标；若手动排班尚未实现，显示明确不可用状态，不造空路由。
- [ ] 实现批准/驳回专属确认。approve/reject 响应类型使用真实结果，不转换为通用 `LeaveRequest`。
- [ ] 实现 pending 取消、approved 撤销；成功刷新列表，不为请假列表制造 `cancelled`、`revoked` 或 `archived` 状态；撤销说明不自动恢复已重排班表。
- [ ] 批准确实改动已发布排班时，按 `preview.affectedAssignments[].businessDate` 使用 9.1 runtime 精确失效涉及月份；只记录请假而未改排班时不误清无关月份。请假撤销不恢复已重排班表，因此不因动作名为 revoke 清日历。
- [ ] 管理员读取/更新群组默认重排策略；成员只读取请求已保存策略且无更新入口。使用现有 GET/PUT `/groups/:groupId/leave-reflow-strategy`，无 operationId；更新只影响后续新申请，审批仍可单条覆盖。覆盖成功、403、失败/冲突保留和刷新测试。
- [ ] 页面 `onShow` 和每个成功 mutation 后刷新；多管理员先处理后，本端显示处理结果并移除旧操作按钮。
- [ ] 运行 9.2 定向验证，逐行审查 diff；更新状态/日志后创建 checkpoint：`feat(miniprogram): add leave workflows`。

### 6.3 9.2 停止条件

- 请假创建、影响提示、列表、审批 preview、策略切换、批准/驳回、取消/撤销全部按逐动作矩阵通过。
- 群组默认重排策略的管理员读写、成员只读、无 operationId 和“仅影响后续申请”通过。
- 创建无 operationId 且双击单飞；审批版本快照和 409 路径有测试。
- 只涉及未发布期间、存在 blocker/空缺、多管理员已处理和撤销不回滚班表均有明确 UI/测试。
- 完成 checkpoint 后只进入 9.3，不提前执行 Task 10。

## 7. Task 9.3：换班、加扣班、审批与缓存失效

### 7.1 换班

- [ ] 写普通换班红测：字段变化使 preview 失效；无有效 preview 时提交先 preview；服务端 `nextStatus` 原样显示；无 reason 字段；create 事务 409 保留表单并刷新。
- [ ] 写管理员直换红测：`manageSwaps` 可见；即使群组要求审批仍可用；先 preview；payload 无 reason；成功直接 completed。
- [ ] 实现候选列表、preview sheet、普通/直办切换和请求卡片。普通申请 preview 展示双方班次、冲突、服务端 nextStatus/自动接受/审批路径；管理员 direct preview 只消费双方班次和冲突，并固定说明“立即生效，无需成员同意或审批”，不得把普通 preview 的 `nextStatus` 当成 direct 结果。
- [ ] 实现接受、批准、驳回、取消、撤销专属确认；这些动作没有 preview。撤销 reason 选填，消费 `isRevocable`/`revocationBlockedReason`。

### 7.2 加扣班

- [ ] 写普通加扣班红测：必须 preview；原因选填且空值省略；服务端 `nextStatus` 原样显示；字段变化废弃 preview。
- [ ] 写管理员直代红测：`manageDutyAdjustments` 可见；群组审批开启时仍可用；不调用 preview；原因选填；直接写入并 completed。
- [ ] 实现普通/直办页面。不得为了复用换班 sheet 而给 direct duty 增加一次 preview；服务端校验错误原样进入统一错误路径。
- [ ] 实现接受、批准、驳回、取消、撤销；无专用 preview。撤销 reason 选填，空值不覆盖原申请原因；动作资格只用服务端字段。

### 7.3 设置、状态与缓存

- [ ] 读取/修改群组 swap 与 duty 审批设置。swap 页面 GET `/swaps/my-settings`，duty 页面必须单独 GET `/duty-adjustments/my-settings`（历史默认解释不同）；两者更新成员共享自动接受值都走唯一 PUT `/swaps/my-settings`。部分更新只发送改动字段，不能把未加载值覆盖为默认。
- [ ] 请求中心分别显示 `pending_target`、`pending_approval`、`completed`、`rejected`、`cancelled`、`revoked`；多管理员记录显示 `decidedByMemberName`。
- [ ] 仅将 `request.status === 'completed' && request.isRevocable === false` 分类为只读“已自动归档/不可撤销”；`true` 按身份显示撤销，`undefined` 按当前 Web 兼容为非归档。显示服务端阻塞原因，绝不生成 archive mutation。
- [ ] 复用 9.1 cache runtime/invalidation epoch，并按结果精确处理：普通 create/accept 只有返回 `completed` 才失效；accept 返回 `pending_approval` 不失效；direct/approve/成功 revoke 失效相关月份。所有成功写入都刷新工作流列表；pending 创建、驳回、取消不清日历。
- [ ] 切群、切角色、跨月份或卸载后，旧请求因 context/generation 不匹配不得发布；页面 `onShow` 重新读取权威状态。
- [ ] 运行 9.3 定向/API/全量/冒烟/DevTools/真机矩阵；更新项目状态和调试日志，创建 checkpoint：`feat(miniprogram): add swap and duty workflows`，正常 fast-forward 推送后停止。

### 7.4 9.3 与 Task 9 总停止条件

- 三领域逐动作矩阵、原因语义、适用 preview、direct、状态、权限、409 和撤销/自动归档全部通过。
- today/yesterday/cross-day、actual/planned、历史软删除快照和多管理员已处理有覆盖。
- 快速双击、陈旧响应、相同 operationId API 重放、并发 409 与缓存精确失效有证据。
- 未修改共享契约/API/Web；未新增运行时依赖；guest 未访问任何工作流端点。
- `smoke:browser` 与 `smoke:check-core` 有有效记录，DevTools 分包可编译/preview，连接态 smoke 无页面脚本错误。
- 项目状态与 Git checkpoint 一致。达到后停止，不直接实施 Task 10。

## 8. Task 9 专项验收矩阵

| ID      | 场景                                             | 必须结果                                                                                          |
| ------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| T9-W01  | 同日请假                                         | 显示 1 天，发送全天半开区间                                                                       |
| T9-W02  | 8 月 24–27 日请假，28 日有班                     | 28 日不计入影响班次                                                                               |
| T9-W03  | UTC 零点与中国日期相邻                           | 不误伤相邻业务日                                                                                  |
| T9-W04  | 影响班次接口失败                                 | 仍可提交，不声称完整 preview                                                                      |
| T9-W05  | 存在空缺                                         | 展示建议和明细，不阻止创建                                                                        |
| T9-W06  | 审批切换策略                                     | 旧 preview/ack 失效并重新请求                                                                     |
| T9-W07a | preview 含 workflowBlockers                      | 作为硬阻塞，acknowledge 也不能批准，服务端 409 原因保留                                           |
| T9-W07b | preview 含 conflicts/vacancies                   | 未确认时阻断；明确确认后按合同允许批准                                                            |
| T9-W08  | 只涉及未发布期间                                 | 明确提示；批准仅记录请假                                                                          |
| T9-W09  | 普通 swap/duty 无 preview 点提交                 | 先自动 preview；失败不写入                                                                        |
| T9-W10  | 管理员直换                                       | 先 preview、无 reason；即使普通 preview 为 pending/requiresApproval，仍明确 direct 立即 completed |
| T9-W11  | 管理员直代                                       | 不 preview、reason 可空、绕过接受/审批                                                            |
| T9-W12  | 群组 requiresApproval=true                       | 普通申请遵循 nextStatus；direct 仍可用                                                            |
| T9-W13  | 今天已开始班次                                   | 仍是候选                                                                                          |
| T9-W14  | 昨天班次                                         | 不进入候选；服务端拒绝保留原原因                                                                  |
| T9-W15  | 跨日班                                           | 按开始业务日期判断                                                                                |
| T9-W16  | 候选标签                                         | “日期 班次全名（星期）· 成员”，不重复简称                                                         |
| T9-W17  | 已有活动工作流                                   | preview 显示 blocker；事务仍最终校验                                                              |
| T9-W18  | 409 后刷新                                       | 表单保留、preview 清除、原 message 不被刷新覆盖                                                   |
| T9-W19  | 409 含未知 latestData                            | 只显示安全白名单摘要，否则回退 message                                                            |
| T9-W20  | 快速双击支持 opId 的动作                         | 单飞只写一次，不自动重放                                                                          |
| T9-W21  | 快速双击请假创建                                 | 仅客户端单飞，不宣称服务端幂等                                                                    |
| T9-W22  | 同 actor/scope/operationId/fingerprint API 重放  | 返回既有结果，无第二事件/审计                                                                     |
| T9-W23  | 同 actor/scope/operationId 且 fingerprint 不同   | 409，不换 ID 自动重放；swap revoke 仅改 reason 是既有 fingerprint 例外                            |
| T9-W24  | 多管理员抢同一待办                               | 刷新后显示处理人，不再可操作                                                                      |
| T9-W25  | completed 的 isRevocable 为 false/true/undefined | 仅 false 自动归档；true/undefined 按身份可撤销兼容，无 archive 动作                               |
| T9-W26  | 撤销早期工作流但有后续流程                       | 显示服务端阻塞原因，不改变状态                                                                    |
| T9-W27  | 历史请求引用软删除班次                           | 使用服务端快照正常显示                                                                            |
| T9-W28  | accept/approve 时数据已变                        | 409、刷新、旧摘要不可继续提交                                                                     |
| T9-W29  | 实际排班改变且日历已有 ready slot                | 删除持久缓存、标记 epoch；下次 onShow 强制重取相关群组/月并刷新列表                               |
| T9-W30  | 仅 pending/驳回/取消                             | 只刷新工作流，不误清日历缓存                                                                      |
| T9-W31  | guest/platform-admin-only                        | 无入口且不调用工作流端点                                                                          |
| T9-W32  | 切群/角色/月或卸载后旧请求完成                   | context/generation 不匹配，不发布                                                                 |
| T9-W33  | 同角色但不是发起人/目标/参与方                   | 不显示 accept/cancel/revoke；当前 membership 由 `isCurrentUser` ID 解析                           |

并发强度参考现有证据：20 路同班次换班只有 1 成功、19 个 409（`docs/testing/performance-report.md`）；陈旧请假审批 409 且不写批准事件（`docs/testing/security-checklist.md`）；Web 1.0 工作流验收见 `docs/releases/web-1.0-acceptance.md`。

## 9. 验证与提交门禁

### 9.1 每个 checkpoint

- 定向运行当前新增测试和受影响的现有测试。
- `pnpm vitest run apps/miniprogram`。
- `pnpm miniprogram:config:audit`。
- `pnpm miniprogram:typecheck`。
- `pnpm miniprogram:lint`。
- `pnpm exec prettier --check <本任务明确文件>`。
- manifest/app-shell/workflows boundary tests。
- `git diff --check`、逐行 `git diff`、明确行为变化清单。
- 显式暂存当前任务路径；`apps/miniprogram/minitest/` 永不暂存。

### 9.2 Task 9 最终回归

以下 API integration tests 必须连接真实测试数据库环境运行；若因环境缺失被 skip，不得记为通过：

- `pnpm vitest run apps/api/src/modules/leaves/leaves.integration.test.ts`。
- `pnpm vitest run apps/api/src/modules/swaps/swaps.integration.test.ts`。
- `pnpm vitest run apps/api/src/modules/duty-adjustments/duty-adjustments.integration.test.ts`。

同时只读运行 Web 基准：

```powershell
pnpm vitest run apps/web/src/features/leaves/leave-logic.spec.ts apps/web/src/features/swaps/swap-logic.spec.ts apps/web/src/features/duty-adjustments/duty-adjustment-logic.spec.ts apps/web/src/features/workflows/workflow-logic.spec.ts apps/web/src/features/workflows/assignment-option.spec.ts
```

这些测试不得修改 Web 快照或生产代码。

由于 Task 9 修改 `apps/miniprogram/api/endpoints.ts` 和核心路由链：

1. 必须运行 `pnpm smoke:browser`，把结果写入 `docs/debug/debug-feedback-log.md`。
2. 随后必须运行 `pnpm smoke:check-core`；没有前一项有效记录时禁止提交。
3. 运行 DevTools build-npm、preview 和连接态 `pnpm miniprogram:smoke`，确认所有分包路由可打开且无脚本错误。
4. 真机至少覆盖 owner/admin/member/guest：全天日期、普通申请、两类 direct、双击、409、多管理员已处理、今天/昨天候选、撤销阻塞、切群陈旧响应和日历刷新。

### 9.3 Git

三个任务形成三个独立 checkpoint。每次提交前更新 `docs/project-status.md` 与调试日志；正常 fast-forward 推送当前 `main` 上游，不 force-push。若有用户未提交改动与任务路径重叠，停止并请求处理；不丢弃或混入提交。

## 10. Task 10 范围冻结（不可执行）

Task 10 的用户结果、权限和安全边界现在冻结；文件级计划、组件复用、测试清单及 checkpoint 拆分必须在 Task 9.3 最终 checkpoint 且 Task 9 运行/人工复核完成后按真实代码重新生成，并由用户另行批准。本节永不构成 Task 10 实施授权。

### 10.1 固定范围

- 通知：列表、分页、未读数、单条/全部已读、未知类型兜底、个人提醒偏好、微信订阅授权入口。
- 个人：真实姓名、本人联系方式与确认、通知偏好、运行版本、登出。
- 群组：切换、访客加入、离组、邀请回流、原群主在 30 天内恢复已解散群组。
- 访客：已登录 guest 和二维码 `visitorKey` 匿名访问；只允许群组入口与只读月历。
- 会话：群组上下文刷新、按用户隔离 active group/月历缓存、精确登出清理。
- 导航：四种群组角色（owner/administrator/member/guest）× 独立 platform-admin 标志的显式矩阵；平台管理员身份不提升群组权限。

### 10.2 已锁定决策

- `/groups/claim` 保持删除；加入只指 `/join-guest` 和邀请接受。
- 二维码匿名入口保持 `pages/guest/guest`，使用无登录、无 tabBar 的单群只读页面；不恢复公开群组目录，不强制先登录。
- guest/anonymous 响应只包含 confirmed 号码；未确认号码字段省略，不存在访客 copy 动作。这是 API 层安全收紧，不再称为完全 Web parity。
- 访客不得看到事件、审批、通知、管理、change markers 或写动作。
- authenticated guest 必须仍有明确登出动作，但不得读取通知/工作流/管理数据。当前静态原生 tabBar 暴露“通知/我的”，Task 10 详细计划必须选择 guest 专用 shell、隐藏 tabBar 加 route guard 或等价机制，并证明直接 `switchTab`、分享链接和手工路由也不会加载越权端点；只隐藏工作台入口不算完成。
- 微信订阅只由明确用户手势触发；当前只承诺实际支持的 `dutyReminder`。服务端偏好开启不等于微信已 accept，必须分别呈现 accept/reject/ban。
- `notificationType` 是开放字符串；未知类型有 fallback。Task 10 不承诺通用对象深链，只有 Task 9 后明确且有测试的 requests 路由才可映射。
- 通知偏好保持 `null=系统默认`、`[]=关闭`、非空数组=自定义；小程序更新不能覆盖 browser-only 字段。
- Task 10 只实现个人通知覆盖和有效值展示；群组通知默认值的管理员编辑归入 Task 14，不能在本阶段顺手扩大。
- 资料更新携带 `UserProfile.version`；409 显示最新状态，不自动覆盖/重放。
- 本人可确认联系方式；管理员改他人号码后重置确认。
- owner 禁止 leave；member 离组保留历史占位；guest 软失活；仅原 owner 可在 30 天内 restore。
- `left-member` 只能提示“需管理员邀请重新加入”，不得提供 `join-guest` 或 claim 动作；邀请接受是现有回流路径。
- 邀请接受保持现有顺序和单飞：先保存 replacement token，再清 pending invite，随后刷新群组上下文。
- active group key 必须 user-scoped，恢复时重新验证成员关系。
- 联系方式按 `(groupId, membershipId)` 定位，不能按姓名；通知偏好也按群组/成员身份隔离。
- 登出先使在途请求失效，再清 token、当前用户 active-group 和月历缓存；禁止 `wx.clearStorageSync()`；必须保留 `pendingInviteToken`。清缓存异常不能阻止 token/state 清除，A 用户登出不得删除 B 用户缓存。
- 显示微信运行环境版本，不能与资料并发控制 version 混淆。
- 除访客泄露或共享契约阻断外，不顺手清理 Web 的陈旧封装。

### 10.3 Task 10 详细计划入口门禁

只有以下条件全部满足，才编写 Task 10 文件级计划：

- Task 9.3 最终 checkpoint 已完成，Task 9 达到字段、状态、preview、冲突、权限、运行和人工复核停止条件。
- 项目状态、代码和 Git checkpoint 一致。
- Task 9 定向测试、typecheck、`smoke:browser`、`smoke:check-core` 均有有效记录。
- 重新审计实际改过的 endpoints、manifest、requests 路由、navigation、session/cache 和通知类型。
- 没有与 Task 10 重叠的用户未提交改动。

详细计划必须重新决定：页面/controller/component/adapter 文件、通知可支持的 requests 深链、匿名月历复用方式、authenticated guest 的 tabBar/route-guard/登出机制、last-group/cache key registry、错误文案和 1–3 个 checkpoint 的实际拆分。当前文档不授权实现这些细节。

### 10.4 Task 10 最终停止条件（供后续规划）

- 四种群组角色 × platform-admin 标志导航矩阵通过；匿名 QR 可不登录进入无 tabBar 的只读月历，authenticated guest 有登出但直接路由也不能加载越权数据。
- 通知可刷新、分页、已读和更新偏好；订阅授权不伪造发送成功。
- 群组切换、访客加入、离组、邀请回流和恢复后会话/active group 确定更新。
- 资料版本冲突、号码确认、运行版本和精确登出有回归测试。
- 登出后迟到请求不回填，当前用户缓存已清，pending invite 仍可消费。
- Guest/anonymous API 不返回未确认号码。
- 真实数据库环境下 `apps/api/src/modules/calendar/calendar.integration.test.ts` 与 `apps/api/src/modules/calendar/visitor-access.integration.test.ts` 非 skip 通过，覆盖 authenticated guest、anonymous visitor、confirmed/unconfirmed 号码和 marker 隔离。
- 小程序测试、config audit、typecheck、lint、manifest/app-shell、两项 smoke、DevTools/连接态 smoke 及真机 QR/订阅/登出复核均通过并记录。
- 形成后续 Task 10 checkpoint 后停止，不进入 V3-4。

## 11. 本计划复核清单

- [x] 用户确认管理员直换“先 preview、无 reason、绕过审批”和管理员直代“无 preview、reason 选填、绕过审批”。
- [x] 用户确认请假创建无 operationId、影响查询非阻塞，完整 preview 仅在审批阶段。
- [x] 用户确认严格 Web parity：新的明确重试生成新 operationId，本阶段不做持久化同 ID 重试 UI。
- [x] 用户确认 409 的小程序增强仅限安全 `latestData` 摘要，核心仍是刷新后保留原 message。
- [ ] 用户确认小程序专项增强：受影响班次查询失败与“确实没有已发布班次”使用不同提示，同时均不阻止请假提交。
- [x] 文件职责、三个 checkpoint、验证命令和 Task 10 规划门可由下一对话从仓库独立恢复。
- [x] 路线图、V3 设计、Web 设计、V3-2 状态、项目状态和调试日志已同步，不再互相矛盾。

计划批准后的唯一下一批：**Task 9.1**。停止条件是端点类型/封装、工作流纯内核、角色路由壳和 9.1 checkpoint 全部通过；不得同轮进入 9.2。
