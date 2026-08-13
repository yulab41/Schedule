# Web / 微信小程序业务与交互对齐修复计划

> 批准日期：2026-08-13
> 权威顺序：当前 API integration / contracts / 安全决议 > 经测试验证的 Web 业务语义 > 小程序平台 UI 适配。

进度：P0.1–P0.3 已于 2026-08-13 完成首个安全基础检查点并进入用户真机复核；后续批次仍冻结，须按 `docs/project-status.md` 的 Active Batch 每轮实施 1–3 项。

## 1. 目标与边界

本计划纠正 V3-1 至 V3-4 中因复制实现、缩减页面或平台适配而产生的业务漂移。Vue SFC、DOM、TDesign Vue、浏览器生命周期和 `fetch` 不直接运行于微信小程序；日期、筛选、状态机、权限矩阵、候选规则、请求描述、事件叙述、运行时契约和保存请求构造应抽为无 Vue/DOM/wx 依赖的共享 TypeScript 内核，两端只保留渲染与平台副作用 adapter。

“对齐 Web”不等于复制已知陈旧 Web 行为。已确认的例外包括 Web Event Center 操作者 ID 类型漂移、Web profile PATCH 缺 version，以及已经删除的 `/groups/claim`；这些以当前 API、contracts 和安全决议为准，并在共享内核落地时同时修正两端。

不读取、修改、格式化或暂存用户/DevTools 未跟踪目录 `apps/miniprogram/minitest/`。每轮只完成 1–3 个任务，并形成独立检查点。

## 2. 已批准的产品决策

### 2.1 岗位允许班种映射

- 新增显式 `scheduleRole ↔ shiftType` 多对多关系、契约、API、配置 UI 与保存校验。
- 迁移时，现有每个未删除岗位关联现有每个未删除班种。
- 新建岗位默认关联全部未删除班种；新建班种默认关联全部未删除岗位。
- 停用班种可保留关联但不可新填；历史已发布班次继续使用快照。
- 删除关联不改写历史发布记录；模板或草稿中的旧引用显示 stale 警告，并在修正前阻止保存/应用/发布。
- 手动排班 palette 取“当前岗位允许且启用”的交集；网格解析继续保留全量班种和快照。

### 2.2 移动端密度

- 月格保留已批准的单字班种与最多两字节假日策略。
- 日期/值班/事件详情必须无损显示完整岗位、班种全称/简称、时间、人员和事件语义。
- 多选、清空、错误/空态、权限、并发和业务后果不得以移动端适配为由降级。

## 3. 分批实施

### Task P0.1：移除生产 fixture 与敏感样本

1. 先用失败测试证明普通 `develop` 会启用 fixture、生产页面静态引用黄金样本，且样本含明文电话/生产样式标识。
2. 普通 develop/release/trial 均默认走真实 session 与 API；fixture 只允许测试注入或明确的非生产测试入口。
3. 从小程序生产页面依赖图移除 `calendar-golden-data.ts`；测试继续通过测试侧 fixture 注入。
4. 将仓库样本改为完全合成、匿名数据，并增加发布依赖图/PII 扫描门禁。

停止条件：生产页面与配置不再引用 fixture；默认 develop 走真实 API；fixture 测试仍可运行；扫描不再命中旧号码或生产样式标识。

### Task P0.2：群组上下文与无群组旅程

1. 先用页面行为测试证明点击群组 B 的日历/通知必须先成功设置 B，再导航；未知或不可用群组不导航。
2. 所有 group-scoped 工作台入口使用同一上下文切换路径，并显示当前群组/角色选中态。
3. 零群组用户看到全局“群组与账号”区，可进入现有群组中心发现/加入群组或处理邀请，并可进入账号资料，不再落入空白工作台；群组创建和完整邀请管理仍属于后续功能面批次。
4. profile 只有 `activeGroup.role === 'guest'` 时进入访客最小模式；无群组的正常已认证账号仍可编辑账号资料。

停止条件：owner/administrator/member/guest/group-less/platform-only 导航矩阵通过；跨群 tab 不再读取旧群组。

### Task P0.3：邀请逃生与会话软依赖

1. 邀请解析失败、过期、撤销、姓名不符或网络错误时保留错误原因，并提供“暂不加入/放弃邀请”；该动作只清本地 pending token 并回工作台。
2. 接受邀请的服务端提交与上下文 reconciliation 分相位：accept 2xx 后绝不再显示“接受失败”或重提 accept；profile/groups 刷新失败显示“已加入，资料刷新失败”，只重试刷新。
3. replacement token 必须在清 pending token 前保存。
4. `/platform/me` 为辅助能力；非 401 失败降级 `isPlatformAdmin=false`，不阻断 profile/groups 会话。401 仍执行既有精确清理。

停止条件：有效/过期/撤销/姓名不符/响应后刷新失败矩阵通过；同一次邀请最多提交一次 accept；平台辅助接口故障不阻断普通登录。

### 后续批次（冻结，须在上一检查点后重新读代码展开）

1. 日历可靠性：holiday 非阻断、前台 stale-while-revalidate、跨月周精确错误、三月有界缓存、上下文切换清敏感 Sheet、事件 `shiftId` 服务端过滤。
2. 共享运行时：双目标 `calendar-core`、`client-core`、统一 endpoint descriptor/runtime decoder，并由 Web 与小程序共同消费 parity corpus。
3. 日历交互：三类多选、今天/本周/年月直达、常驻导航、列表空态、完整详情和事件 display VM。
4. 工作流可靠性：mutation commit/reconciliation 分离、稳定 operationId ledger、候选真值表、preview/confirm、409 摘要、请求分区去重。
5. 群组/邀请 API：邀请接受幂等恢复、一次性写 operationId、event operator facets、缺失 `addGroupMembers` wrapper 和需要的邀请管理元数据。
6. 岗位允许班种：数据库迁移、contracts/API/service/integration、Web 与小程序配置/编辑器接入、stale 迁移与阻断。
7. 完成功能面：补录、事件中心、统计/导出、成员/邀请、排班配置、群组默认通知；平台运维作为独立管理面批次。
8. 双端与设备验收：共享 corpus、Web 浏览器、DevTools、Skyline/WebView、低端 Android/iOS、包体/性能/隐私扫描。

## 4. 通用测试与提交门禁

- 每个回归先运行 `git log -S` 与 `git blame` 定位引入点，再写旧代码失败、新代码通过的测试。
- 所有异步修改审计接收者绑定、catch 范围、空值语义、generation/single-flight、副作用与调用次数。
- 触及认证、路由、API、contracts、Web 核心链路时运行 `pnpm smoke:browser`，随后运行 `pnpm smoke:check-core`。
- 小程序至少运行定向测试、完整 `pnpm vitest run apps/miniprogram`、config audit、typecheck、lint、Prettier、`git diff --check` 和 DevTools 构建/路由 smoke（若运行环境可用）。
- 每个 checkpoint 更新 `docs/project-status.md` 与 `docs/debug/debug-feedback-log.md`，显式暂存相关文件并正常快进推送。
