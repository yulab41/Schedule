# 小程序 Web 语义对齐与功能补全计划

> 批准日期：2026-08-13
> 权威顺序：现行 API / Contracts 与安全约束 → 已验证的 Web 业务语义 → 小程序 UI 适配。

进度：P0.1–P0.3、日历可靠性 C1–C3、事件班次过滤 D1、客户端核心运行时 D2 与日历读取契约 D3 已完成；下一批为 D4 日历共享逻辑与交互对齐。后续只按 `docs/project-status.md` 的 Active Batch 每轮实施 1–3 项。

## 总体原则

- 从 `ca6141b` / D2 继续；已完成的手动排班、日历可靠性、跨群上下文和事件班次过滤作为回归基线，不重复重写。
- `apps/web/**` 全程只读，包含源码、样式和测试；每个检查点要求 `git diff -- apps/web` 为空。Web 只用于交互、业务语义、现有测试向量和截图对照。
- 已确认的 Web 漂移（旧 `/groups/claim`、错误操作者 ID、缺版本写入等）不复制。
- 纯逻辑进入无 Vue、DOM、`wx`、`fetch` 的核心包；小程序只保留 WXML/WXSS、生命周期、导航、请求和移动端副作用适配。
- 所有新增 API 字段保持旧客户端兼容：请求字段可选，响应字段可选或使用新增端点。Web 不接入新逻辑。
- 每个复杂域独立检查点，遵守每轮 1–3 项任务：红测 → 实现 → 语义审计 → 文档更新 → 显式暂存 → commit → push。
- 不读取、修改、格式化或暂存用户/DevTools 未跟踪目录 `apps/miniprogram/minitest/`。

## 实施顺序

### D2 客户端核心运行时

- 新建 `packages/client-core`，提供端点描述器、查询映射器和严格轻量解码器。
- 同源输出浏览器 ESM 与小程序 CommonJS，但当前仅小程序消费；Web 保持只读。首个纵向切片为事件列表。
- Mini 的 malformed 2xx 统一转为本地 `INVALID_RESPONSE`，不得进入 controller、session 或缓存。
- Mini 产物上限 20KB、目标 10KB，禁止包含 Zod、Contracts runtime、Node/DOM/`wx`/`fetch` 全局。

### D3 日历读取契约

- 迁移 calendar、guest calendar 与 holiday 的端点描述器和解码器，保证解码先于缓存。
- 保留节假日失败非阻断、SWR、403/409 不回退敏感缓存、跨群清理和三月内存上限。
- event detail 的 descriptor/decoder 在紧邻的事件读取切片完成，不与日历缓存状态机混改。

### D4 日历共享逻辑与交互对齐

- 新建零运行时依赖的 `calendar-core`，承载日期/月周运算、筛选、排序、网格、列表、事件展示和空态逻辑；Web 仅作 golden baseline。
- 岗位、班种、成员改为可搜索多选 Sheet，支持全选、清空和显式应用。
- 增加“今天”“本周”和年月直达；导航和视图切换在 loading/error 时仍可操作。
- 补齐月/周/列表空态、完整日期和值班详情、缓存提示聚合。
- 月格继续保留已批准的单字班种和两字节假日密度，完整名称、时间和岗位在可触达详情中无损展示。

### D5 工作流写入可靠性

- 请假、换班、加扣班统一拆为 `submitting → committed → reconciling → reconcile-error`。
- 2xx 后立即认定提交成功；刷新失败只允许重试刷新，绝不重放 mutation。
- 按用户、群组、动作、对象、版本和规范化表单指纹保存稳定 `operationId`；未知网络结果重试复用同一 ID，表单或上下文变化才换 ID。
- 补候选真值表、请求去重分区、显式预览与确认、撤销原因、完整 409 摘要。
- `CreateLeaveRequest` 增加可选 `operationId`，旧 Web 请求继续走兼容路径。

### D6 邀请可恢复性

- `AcceptInviteRequest` 增加可选 `operationId`；Mini 持久保存 token、确认姓名和 operationId，直到成功或用户明确放弃。
- 数据库记录最终接收用户和接受 operationId；同用户、同操作重放返回权威群组，不同操作或身份仍返回 `INVITE_USED`。
- 账号合并后响应丢失时，通过重新微信登录并重放同一操作恢复，不在通用幂等表保存 JWT。
- 邀请创建使用专用加密回执支持同 operationId 重放；密文在使用、撤销或过期后清理，绝不保存明文 token。

### D7 岗位允许班种模型

- 新增软删除的 `schedule_role_shift_types` 关联表及审计/version 字段。
- 迁移时建立“所有启用岗位 × 所有启用班种”；新岗位默认关联全部现有班种，新班种默认关联全部现有岗位。
- `ScheduleRole` 增加可选 `allowedShiftTypeIds`；新增 `PUT /groups/:groupId/schedule-roles/:roleId/shift-types`。
- 停用班种保留关系但不可新填；删除关系不改历史排班。当前默认轮值班种若将被移除则返回 409。

### D8 岗位班种全链路防线与配置 UI

- 在模板保存/更新、模板应用预览/应用、草稿生成、补录和发布事务中统一校验“允许且启用”；发布是最终防线。
- 已发布历史保持可读；旧模板或草稿中的禁用/不允许班种继续显示快照和 stale 警告，但阻止保存、应用和发布。
- 手动排班 palette 固定为“所选岗位允许班种 ∩ 启用班种”，网格解析仍使用全量班种。
- 补完整排班配置页面：岗位、成员、允许班种、轮值顺序、轮值规则、班种管理和版本冲突处理。
- 继续锁定手排原始验收：返回键、岗位选择、成员多选、开始日期、1–31 天周期、新建/重置模板、下一可用开始日、跨年节假日和创建后转更新。

### D9 群组、成员和邀请管理

- 补 `addGroupMembers`、轮值排序/规则 Mini wrapper，以及邀请分页列表、状态、按 inviteId + version 撤销。
- 实现群组创建、改名、群组码、访客二维码/密钥轮换、解散/恢复、所有权转让、成员/名单/联系方式、岗位分配和邀请向导。
- 一次性群组写入增加兼容的 operationId 与 commit/reconcile 状态；危险操作必须明确说明后果并二次确认。
- 永久禁止恢复 `/groups/claim`；离组成员只能通过当前邀请/管理员流程恢复。

### D10 事件中心

- 新增 `EventOperatorFacet { userId, displayName }` 与事件 facets 端点；历史、离组操作者仍可显示安全名称。
- API 暂时兼容同群 membershipId 查询，但跨群 membershipId 不得映射。
- Mini 增加独立事件中心、完整筛选、cursor 分页、事件详情、关联链和访客访问日志；班次内最近 100 条行为保持不回归。

### D11 补录

- 增加原子批量端点 `POST /groups/:groupId/past-schedules/assignments/batch`，请求为 operationId 加 create/update 判别联合，事务全成功或全回滚。
- Mini 实现岗位/月选择、仅过去日期、成员/允许班种 palette、多日期暂存、原因、一次确认和最近记录。
- 禁止未来日期；已有排班更新必须携带 period/assignment 版本并遵守岗位班种映射。

### D12 统计与导出

- 补月/年统计、成员/岗位/班种折叠视图，以及管理员刷新和重算。
- 导出实现创建、轮询、后台恢复、认证下载、打开/分享降级；持久化 pending jobId，避免重复创建。
- 导出数据继续禁止手机号，并验证 completed、failed、expired 全状态。

### D13 通知与资料

- 在现有个人偏好、订阅消息和通知中心基础上补管理员群组默认提醒设置、未读 badge 和前台刷新。
- 保持 `null=继承、[]=关闭、自定义数组=覆盖` 的精确语义。
- 资料页补账号注销入口、强确认、不可注销原因以及成功后的 token、群组、日历和隐私缓存清理。

### D14 平台管理

- 新增 cursor 分页的 `/platform/users` 与 `/platform/groups` 安全发现端点，取消手填 UUID。
- 建立独立平台分包：任务、备份、回收站、用户、群组和节假日 preview/import/confirm/coverage。
- 非平台用户无入口、直达受 guard、API 保持 403；破坏性写操作只在隔离开发数据验收。

### D15 契约闭环与最终预览

- 每个域实施时同步迁移对应 JSON decoder；最后静态审计不得再有裸 `request<T>` 处理 JSON。
- 仅保留显式 `requestText`、`requestBlob`、`requestVoid` 通道。
- 所有工作台占位 toast 替换为真实路由；所有 `navigateTo` 页面使用返回导航，并在切群、退出和后台恢复时清除旧敏感状态。
- 完成全量自动化、DevTools 构建、包体/PII 扫描和最终 preview。

## 移动端 UI 约束

- 延续现有医疗排班的浅蓝、浅绿、白色和高可读性设计，不新增第二套设计语言或 UI 框架。
- 桌面多选改为底部 Sheet；桌面表格改为卡片、折叠区或可横向滚动网格；预览/暂存流程使用安全区固定操作栏。
- 可点击目标不小于 88rpx，处理键盘、安全区、长姓名、空数据和弱网。
- 日历继续是唯一 Skyline-first 页面；其他新页面保持 WebView，并完成冷启动、返回和切群验证。

## 验证与完成标准

- 每个修复先用 `git log -S`/`git blame` 定位引入点，并写旧实现失败、新实现通过的测试。
- 核心场景覆盖多群切换、0/1/100 成员、101+ 事件、跨月/跨年/闰年、停用/删除/stale 班种、重复点击、响应丢失、2xx 后刷新失败、401/403/409、前后台切换和陈旧请求隔离。
- API/数据库批次运行真实测试 MySQL integration、迁移升级测试、Contracts 测试和浏览器 smoke；不执行生产数据库迁移。
- Mini 每批只运行 Git 已跟踪测试，明确排除 `apps/miniprogram/minitest/`，并运行 config audit、typecheck、按已跟踪文件 lint、任务文件 Prettier、`smoke:check-core` 和 `git diff --check`。
- Web 只运行现有测试、build 和 browser smoke，不修改任何 Web 文件。岗位映射收窄后，Web 可能仍展示不允许班种并被后端拒绝，这是已接受的兼容边界，Mini 为权威编辑端。
- DevTools 完成全量编译、build-npm、preview、新路由冷启动/返回/切群、日历 Skyline/WebView/Auto 检查，以及 bundle 中 Zod、fixture、PII 和真实手机号扫描。
- 自动化和 DevTools preview 全绿即视为计划完成；Android/iOS 真机验证作为后续可选复核，不阻塞完成状态。
- 每个安全检查点更新 `docs/project-status.md` 和调试记录，显式暂存相关文件，提交并正常推送 `main`。
- 最终仅提交与 preview，不部署 ECS、不迁移生产数据库；生产发布需另行明确授权。
