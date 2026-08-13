# 医护排班系统 Web 1.0 详细实施计划

- 文档日期：2026-08-01
- 当前状态：用户已批准，等待从任务 1 开始执行
- 依据规格：`docs/superpowers/specs/2026-08-01-medical-staff-scheduling-system-design.md`
- 实施范围：医生排班 Web 1.0
- 提交策略：每个完整且验证通过的任务形成独立 Git 版本节点，并按 `AGENTS.md` 判断是否推送 GitHub

## 0. 跨对话实施批次

为降低长上下文带来的遗漏和误判，每轮新对话只实施 1-2个任务：

1. 新对话先完整读取 `AGENTS.md` 和 `docs/project-status.md`。
2. 只读取当前批次对应的实施计划章节和相关设计章节，不依赖上一轮聊天记忆。
3. 领域算法、并发、安全、部署等复杂任务原则上一轮只完成一个。
4. 普通且紧密依赖的小任务可以一轮完成两个，最多不得超过三个。
5. 每个任务仍独立验证并形成版本节点，不能因同一对话而合并未经验证的任务。
6. 每个任务提交前更新 `docs/project-status.md`；状态文件记录完成项、验证、外部状态和下一批任务。
7. 达到当前批次停止条件后即结束该轮，不提前开始下一批。

`docs/project-status.md` 是跨对话当前状态入口；设计规格、实施计划和 Git 历史分别是需求、步骤和已完成工作的权威记录。

## 1. 执行原则

1. 严格按任务顺序实施，后续任务不得绕过前置验收。
2. 先为排班、统计、并发等高风险逻辑编写失败测试，再实现功能。
3. 一个任务只解决一个清晰目标，不混入无关重构。
4. 所有核心写操作通过 API 和数据库事务完成，前端不直接写业务表。
5. 每次提交前运行该任务的定向测试，再运行当前阶段的完整检查。
6. 仅显式暂存当前任务文件，检查缓存区差异后提交。
7. 不提交 `.env`、CloudBase 密钥、数据库文件、日志、浏览器缓存和本地生成文件。
8. 规格变更先修改设计文档和本实施计划，获批后再改代码。

## 2. 计划采用的工程组件

在正式安装时选择当日受支持的稳定版本，并由锁文件固定：

- 工作区：pnpm workspace。
- Web：Vue 3、Vite、TypeScript、Vue Router、Pinia、TDesign Vue Next。
- 服务端状态：TanStack Query for Vue，用于缓存、失效和冲突刷新。
- PWA：Vite PWA 插件及 Service Worker。
- API：Fastify、TypeScript、Zod。
- 数据访问：Drizzle ORM、MySQL2、SQL 迁移文件。
- 云端身份：CloudBase Web SDK 和服务端 SDK，通过适配器隔离。
- 测试：Vitest、Playwright、本地 Docker MySQL 集成测试。
- 代码质量：ESLint、Prettier、TypeScript 严格模式。
- CI：GitHub Actions。

选择 Fastify 和 Drizzle 的目的，是保持服务轻量、类型清晰并减少 CloudBase 云函数冷启动负担。排班领域模块不能直接依赖 Fastify、Vue 或 CloudBase SDK。

## 3. 目标目录结构

```text
Schedule/
├─ AGENTS.md
├─ apps/
│  ├─ api/
│  │  ├─ src/
│  │  │  ├─ adapters/
│  │  │  ├─ modules/
│  │  │  ├─ jobs/
│  │  │  ├─ app.ts
│  │  │  ├─ local-server.ts
│  │  │  └─ cloudbase-handler.ts
│  │  └─ tests/
│  └─ web/
│     ├─ src/
│     │  ├─ api/
│     │  ├─ components/
│     │  ├─ features/
│     │  ├─ layouts/
│     │  ├─ router/
│     │  ├─ stores/
│     │  └─ views/
│     └─ tests/
├─ packages/
│  ├─ contracts/
│  ├─ database/
│  ├─ scheduling-domain/
│  ├─ test-fixtures/
│  └─ ui-tokens/
├─ infra/
│  ├─ docker/
│  ├─ cloudbase/
│  └─ scripts/
├─ migrations/
├─ docs/
└─ .github/workflows/
```

目录在任务实施时创建，不预先生成空文件。

## 4. 通用验证命令

项目建立后统一提供以下根命令：

- `pnpm lint`：代码规范检查。
- `pnpm format:check`：格式检查。
- `pnpm typecheck`：所有工作区类型检查。
- `pnpm test`：单元测试。
- `pnpm test:integration`：MySQL 和 API 集成测试。
- `pnpm test:e2e`：浏览器端到端测试。
- `pnpm build`：正式构建。
- `pnpm verify`：按顺序执行适合日常提交的完整检查。

## 5. 阶段零：工程基础

### 任务 1：初始化 TypeScript 工作区

目标：建立可安装、可检查、可测试、可构建的最小工作区。

主要文件：

- `package.json`
- `pnpm-workspace.yaml`
- `tsconfig.base.json`
- `eslint.config.js`
- `.prettierrc.json`
- `.editorconfig`
- `.gitignore`
- `apps/api/package.json`
- `apps/web/package.json`
- `packages/contracts/package.json`
- `packages/database/package.json`
- `packages/scheduling-domain/package.json`

实施步骤：

1. 建立 pnpm workspace 和根级脚本。
2. 启用 TypeScript 严格模式，禁止隐式 `any`。
3. 配置 ESLint 和 Prettier，不加入与项目无关的复杂规则。
4. 建立最小 API、Web 和共享包入口，仅用于验证引用关系。
5. 完善 `.gitignore`，覆盖密钥、环境文件、数据库数据、构建输出和测试报告。
6. 生成并提交锁文件。

验证：

- 全新安装依赖成功。
- `pnpm lint`、`pnpm typecheck`、`pnpm test` 和 `pnpm build` 成功。

版本节点：`chore: scaffold TypeScript workspace`

### 任务 2：建立本地 Docker 与环境配置

目标：Win11 上用一条命令启动 MySQL 和本地后端依赖。

主要文件：

- `infra/docker/compose.yml`
- `infra/docker/compose.test.yml`
- `.env.example`
- `apps/api/src/config/env.ts`
- `docs/development/local-setup.md`

实施步骤：

1. 配置开发 MySQL 和独立测试 MySQL。
2. 使用命名卷保存开发数据，测试数据库每轮可重建。
3. 编写 Zod 环境变量校验；缺少必需变量时立即停止启动。
4. 建立数据库健康检查。
5. 记录 PowerShell 启动、停止、重建和查看日志步骤。
6. 确认 `.env` 不被 Git 追踪。

验证：

- Docker Compose 启动后 MySQL 健康。
- 错误密码或缺少变量时 API 给出明确启动错误。
- 测试环境重建不影响开发数据。

版本节点：`chore: add local Docker development environment`

### 任务 3：建立 GitHub 自动检查

目标：每个提交和拉取请求自动验证基础质量。

主要文件：

- `.github/workflows/verify.yml`
- `.github/dependabot.yml`
- `docs/development/ci.md`

实施步骤：

1. 在 Windows 本地验证后，配置 GitHub Actions 的稳定 Node 环境。
2. 缓存 pnpm 下载目录。
3. 执行安装、格式、Lint、类型、单元测试和构建。
4. 集成测试使用 CI MySQL 服务容器。
5. 不在普通拉取请求中暴露 CloudBase 正式密钥。
6. 配置依赖更新为低频批次，避免大量无意义提交。

验证：

- 本地复现 CI 命令成功。
- 推送后 GitHub 工作流通过。

版本节点：`ci: add repository verification workflow`

## 6. 阶段一：后端与账号基础

### 任务 4：建立 API 运行时和统一错误协议

目标：本地 Fastify 与 CloudBase HTTP 函数共用同一业务应用。

主要文件：

- `apps/api/src/app.ts`
- `apps/api/src/local-server.ts`
- `apps/api/src/cloudbase-handler.ts`
- `apps/api/src/plugins/error-handler.ts`
- `apps/api/src/plugins/request-context.ts`
- `packages/contracts/src/errors.ts`
- `apps/api/tests/health.test.ts`

实施步骤：

1. 创建不直接监听端口的 Fastify 应用工厂。
2. 本地服务器和 CloudBase 入口分别作为薄适配器。
3. 为每个请求生成关联编号。
4. 建立统一错误结构：代码、用户消息、关联编号和可选最新数据摘要。
5. 提供 `/health` 和 `/ready`。
6. 日志自动屏蔽令牌、密码和电话号码。

验证：

- 本地和函数适配器调用同一健康接口结果一致。
- 未处理异常转换为安全错误，不泄露堆栈给用户。

版本节点：`feat(api): add runtime and error contract`

### 任务 5：建立数据库连接、迁移和事务工具

目标：所有环境通过受控迁移建立一致表结构。

主要文件：

- `packages/database/src/client.ts`
- `packages/database/src/transaction.ts`
- `packages/database/src/schema/`
- `packages/database/src/migrate.ts`
- `migrations/0001_identity_and_groups.sql`
- `packages/database/tests/migrations.test.ts`

首个迁移包含：

- `users`
- `user_profiles`
- `groups`
- `roster_entries`
- `group_memberships`
- `group_member_contacts`
- `idempotency_keys`

实施步骤：

1. 建立 MySQL 连接池和测试连接工厂。
2. 提供事务辅助函数，禁止业务模块自行拼接连接生命周期。
3. 为时间统一使用 UTC 精度字段。
4. 为活动群组码和群组内待认领姓名建立唯一约束。
5. 为软删除、创建时间、更新时间和版本号建立统一字段约定。
6. 编写空数据库迁移和重复迁移测试。

验证：

- 空数据库完整迁移成功。
- 重复迁移不重复创建对象。
- 唯一群组码和群组姓名约束在数据库层生效。

版本节点：`feat(db): add identity and group schema`

### 任务 6：集成 CloudBase 身份认证

目标：完成管理员创建的用户名密码账号的登录、会话验证和业务用户映射。

主要文件：

- `apps/api/src/adapters/auth/cloudbase-auth.ts`
- `apps/api/src/adapters/auth/auth-port.ts`
- `apps/api/src/plugins/authenticate.ts`
- `apps/api/src/modules/users/user-service.ts`
- `apps/api/src/modules/users/user-routes.ts`
- `packages/contracts/src/users.ts`
- `apps/api/tests/auth.integration.test.ts`

实施步骤：

1. 定义与 CloudBase SDK 隔离的认证接口。
2. 验证 CloudBase 用户令牌并映射稳定 UID。
3. CloudBase 登录账号由授权管理员在受控管理面创建；公开 Web 和 API 不提供账号创建接口或管理凭据。首次登录后由业务资料流程收集真实姓名。
4. 业务数据库只保存 UID 和资料，不保存密码。
5. 提供获取当前资料和修改真实姓名的受控接口。
6. 保留外部身份映射边界，避免认证实现与业务资料耦合。
7. 测试使用认证假实现，集成环境再验证真实 CloudBase 开发身份。

验证：

- 未登录请求被拒绝。
- 有效用户只能修改自己的账号资料。
- 登出和过期令牌返回明确状态。

版本节点：`feat(auth): add CloudBase username login integration`

### 任务 7：建立 Web 应用壳和登录体验

目标：管理员创建账号后的登录、恢复会话和受保护路由可用，Web 不提供自注册。

主要文件：

- `apps/web/src/main.ts`
- `apps/web/src/router/index.ts`
- `apps/web/src/stores/session.ts`
- `apps/web/src/api/client.ts`
- `apps/web/src/views/auth/LoginView.vue`
- `apps/web/src/layouts/AppLayout.vue`
- `apps/web/tests/auth.spec.ts`

实施步骤：

1. 配置 TDesign、路由、状态和服务端查询缓存。
2. 建立仅含登录账号和密码的登录表单；账号提交前去除首尾空白并转为小写，不设置密码长度或字符类型规则。
3. 移除 Web 自注册、邮箱和验证码状态；旧 `/register` 地址重定向到 `/login`。
4. 页面启动时恢复 CloudBase 会话，不保存明文密码。
5. 统一处理 401、403、409 和网络错误。
6. 受保护路由在会话确认前显示稳定加载状态，避免闪现业务数据。
7. 增加退出登录。

验证：

- 管理员创建的账号可用任意字母大小写登录并进入资料补全或应用。
- 刷新浏览器后会话恢复。
- 退出后无法访问受保护页面。
- 访问旧 `/register` 地址回到登录页，且浏览器无法触发账号创建。

版本节点：`feat(web): add registration and persistent session`

账号策略修正版本节点：`fix(web): remove self registration`

## 7. 阶段一：群组、成员和配置

### 任务 8：实现群组、群组码和加入流程

目标：用户可创建群组，成员通过四位码按真实姓名认领。

主要文件：

- `apps/api/src/modules/groups/group-service.ts`
- `apps/api/src/modules/groups/group-code-service.ts`
- `apps/api/src/modules/groups/group-routes.ts`
- `packages/contracts/src/groups.ts`
- `apps/web/src/features/groups/`
- `apps/api/tests/groups.integration.test.ts`
- `apps/web/tests/groups.spec.ts`

实施步骤：

1. 创建群组时在事务中分配随机或自定义四位码。
2. 处理群组码唯一冲突并限制猜测频率。
3. 群主批量粘贴待认领姓名。
4. 群组内拒绝重复待认领姓名。
5. 用户输入群组码后精确匹配真实姓名并自动认领。
6. 没有匹配时创建“请管理员添加人员”请求，不开放群组排班。
7. 群主可重新生成群组码，旧码失效。

验证：

- 并发创建群组不会获得相同群组码。
- 同名待认领人员被拒绝。
- 用户不能通过群组码直接读取未加入群组数据。

版本节点：`feat(groups): add group codes and roster claiming`

### 任务 9：实现群主、管理员、联系方式和群组切换

目标：完成群组权限、长短号及多群组体验。

主要文件：

- `apps/api/src/modules/groups/permission-service.ts`
- `apps/api/src/modules/groups/membership-service.ts`
- `apps/api/src/modules/groups/contact-service.ts`
- `apps/web/src/features/groups/GroupSwitcher.vue`
- `apps/web/src/features/members/MemberManager.vue`
- `apps/web/src/features/profile/GroupContactForm.vue`
- `apps/api/tests/group-permissions.integration.test.ts`

实施步骤：

1. 建立群主、管理员和普通成员权限矩阵。
2. 支持添加和移除管理员。
3. 群主转让必须由当前群主操作，并在事务中保证仍有唯一群主。
4. 长号和短号按群组保存，成员可确认或修改。
5. 联系方式仅对同群组有效成员返回。
6. 建立群组切换器，记住上次使用群组但不越权缓存数据。
7. 群组删除进入 30 天回收状态。

验证：

- 普通成员不能修改管理员或其他成员资料。
- 其他群组用户无法读取联系方式。
- 群主转让失败时不出现无群主或双群主状态。

版本节点：`feat(groups): add roles contacts and group switching`

### 任务 10：实现排班角色、班种和轮值配置

目标：管理员可配置多个独立轮值角色和班种。

主要文件：

- `migrations/0002_roles_shifts_rotations.sql`
- `packages/database/src/schema/scheduling-config.ts`
- `apps/api/src/modules/scheduling-config/`
- `packages/contracts/src/scheduling-config.ts`
- `apps/web/src/features/scheduling-config/`
- `apps/api/tests/scheduling-config.integration.test.ts`

数据包括：

- `schedule_roles`
- `member_schedule_roles`
- `shift_types`
- `rotation_rules`
- `rotation_members`

实施步骤：

1. 新群组预建全天、A、N、P、NP 和办公班。
2. 全天班固定默认 08:00 至次日 08:00；其他班种启用前填写时间。
3. 班种支持名称、简称、跨日、颜色、统计开关和停用。
4. 排班角色支持多人和有序成员。
5. 使用拖动或数字调整轮值顺序，服务端验证连续顺序。
6. 已使用班种只允许停用；历史使用快照不回写。
7. 颜色选择同时计算可读文字色。

验证：

- 跨日班正确计算结束日期。
- 同一成员可属于多个排班角色。
- 停用班种不影响历史快照。

版本节点：`feat(schedule): add roles shifts and rotation settings`

## 8. 阶段二：事件和排班基础

### 任务 11：建立排班事件和安全审计基础

目标：任何后续变更都能在实现时直接接入统一事件机制。

主要文件：

- `migrations/0003_events_and_audit.sql`
- `apps/api/src/modules/events/event-writer.ts`
- `apps/api/src/modules/events/event-query.ts`
- `apps/api/src/modules/audit/audit-writer.ts`
- `packages/contracts/src/events.ts`
- `apps/api/tests/events.integration.test.ts`

实施步骤：

1. 创建只追加的 `schedule_events` 和 `audit_logs`。
2. 事件与业务事务使用同一数据库事务。
3. 保存操作者、原因、变更前后结构、影响对象和关联编号。
4. 数据库账号不授予应用更新或删除事件的普通路径。
5. 提供按群组、日期、成员和类型分页查询。
6. 安全日志对电话等敏感内容脱敏。

验证：

- 业务事务回滚时事件同时回滚。
- 已写事件不能通过业务接口修改或删除。

版本节点：`feat(events): add immutable event and audit logs`

### 任务 12：建立排班期间、班次和发布版本

目标：支持草稿、发布、替代和历史快照。

主要文件：

- `migrations/0004_schedule_periods_assignments.sql`
- `packages/database/src/schema/schedules.ts`
- `packages/scheduling-domain/src/time.ts`
- `packages/scheduling-domain/src/schedule-period.ts`
- `apps/api/src/modules/schedules/schedule-repository.ts`
- `apps/api/tests/schedule-version.integration.test.ts`

数据包括：

- `schedule_periods`
- `shift_assignments`
- 当前发布版本唯一约束和版本号。

实施步骤：

1. 用 UTC 保存起止时间，用中国标准时间计算业务日期。
2. 班次保存班种、时间和统计属性快照。
3. 支持计划人员和实际人员。
4. 建立草稿、待发布、已发布、已撤回和已替代状态机。
5. 同一群组、角色和月份只允许一个当前发布版本。
6. 发布新版本在事务中替代旧版本并生成事件。

验证：

- 全天班跨日正确。
- 发布并发时不会产生两个当前版本。
- 修改班种不改变已发布班次快照。

版本节点：`feat(schedule): add versioned periods and assignments`

### 任务 13：实现纯自动轮值引擎

目标：固定顺序、多角色和幂等生成逻辑通过纯单元测试。

主要文件：

- `packages/scheduling-domain/src/rotation/generate.ts`
- `packages/scheduling-domain/src/rotation/cursor.ts`
- `packages/scheduling-domain/src/conflicts.ts`
- `packages/scheduling-domain/src/types.ts`
- `packages/scheduling-domain/tests/rotation.test.ts`
- `packages/scheduling-domain/tests/date-boundaries.test.ts`

实施步骤：

1. 定义不含数据库实体的领域输入和输出。
2. 按起始日期、起始成员和固定顺序生成日期槽。
3. 支持每角色每天一个或多个位置。
4. 多角色分别生成，再检查同一成员时间重叠。
5. 生成稳定的班次业务键，保证相同输入结果一致。
6. 输出硬冲突、连续值班警告和待处理空缺。

测试覆盖：

- 7 天、30 天、月末、跨年和闰年。
- 08:00 边界。
- 不同起始人员。
- 成员停用。
- 多角色冲突。
- 无可用人员。
- 相同输入完全一致。

版本节点：`feat(schedule): implement deterministic rotation engine`

### 任务 14：实现自动生成、预览和发布 API

目标：领域引擎与数据库版本、事件和权限连接。

主要文件：

- `apps/api/src/modules/schedules/generate-service.ts`
- `apps/api/src/modules/schedules/publish-service.ts`
- `apps/api/src/modules/schedules/schedule-routes.ts`
- `packages/contracts/src/schedules.ts`
- `apps/api/tests/schedule-generation.integration.test.ts`

实施步骤：

1. 管理员提交月份、角色和规则版本。
2. 后端生成预览，不立即覆盖发布数据。
3. 预览返回人员、冲突、警告和统计摘要。
4. 保存草稿时使用幂等操作编号。
5. 根据群组设置保存草稿或自动发布。
6. 重生成已发布月份创建新版本。
7. 发布后触发事件和受影响成员通知任务。

验证：

- 重复请求不重复插入班次。
- 非管理员不能生成或发布。
- 硬冲突存在时不能无提示发布。

版本节点：`feat(schedule): add generation preview and publishing`

## 9. 阶段二：日历与手动排班

### 任务 15：实现当前月份日历读取模型

目标：登录后一次请求即可展示当前月每天的值班人员。

主要文件：

- `apps/api/src/modules/calendar/calendar-query.ts`
- `apps/api/src/modules/calendar/calendar-routes.ts`
- `packages/contracts/src/calendar.ts`
- `apps/web/src/views/calendar/CalendarView.vue`
- `apps/web/src/features/calendar/MonthGrid.vue`
- `apps/web/src/features/calendar/DutyCell.vue`
- `apps/web/tests/current-month-calendar.spec.ts`

实施步骤：

1. API 按群组和月份返回已发布班次、人员、角色、班种和变动标记。
2. 登录完成且存在当前群组时直接路由到当前月份。
3. 日期格内直接显示值班姓名，不依赖点击加载。
4. 单日人员较多时优先保留姓名，折叠次要说明。
5. 提供今天、前后月、年月选择和筛选。
6. 点击电话图标选择长号或短号；桌面复制，手机使用拨号协议。
7. 点击班次详情才加载完整事件时间线。

验证：

- 登录后无需二次操作即可看到当前月姓名。
- 切换月份不会混入前一群组缓存。
- 无电话时不生成无效链接。

版本节点：`feat(calendar): show current month duty roster`

### 任务 16：实现手动周期模板编辑器

目标：完成指定的人员行、日期列和班种按钮交互。

主要文件：

- `migrations/0005_manual_schedule_templates.sql`
- `apps/api/src/modules/manual-schedules/template-service.ts`
- `apps/web/src/views/schedules/ManualScheduleView.vue`
- `apps/web/src/features/manual-schedule/ManualGrid.vue`
- `apps/web/src/features/manual-schedule/ShiftPalette.vue`
- `apps/web/src/features/manual-schedule/ClearActions.vue`
- `packages/contracts/src/manual-schedules.ts`
- `apps/web/tests/manual-schedule-editor.spec.ts`

实施步骤：

1. 选择排班角色、人员和本次可用班种。
2. 输入开始日期和周期天数，动态生成日期列。
3. 行为人员、列为日期，表头显示星期和节假日摘要位置。
4. 点击单元格，再点击班种按钮填入。
5. 支持清空单元格、整行和整列。
6. 清空整行或整列二次确认，并支持保存前撤销。
7. 保存模板但不创建正式班次。
8. 模板保存成员和班种引用版本。

验证：

- 7 天生成 7 列，30 天生成 30 列。
- 清空操作只影响预期范围。
- 停用班种不能新填入，但已有模板能显示失效警告。

版本节点：`feat(schedule): add manual cycle template editor`

### 任务 17：实现模板单次应用和循环应用

目标：将手动模板安全转换为草稿或已发布排班。

主要文件：

- `packages/scheduling-domain/src/manual/apply-template.ts`
- `packages/scheduling-domain/tests/manual-template.test.ts`
- `apps/api/src/modules/manual-schedules/apply-service.ts`
- `apps/api/tests/manual-apply.integration.test.ts`
- `apps/web/src/features/manual-schedule/ApplyTemplateDialog.vue`

实施步骤：

1. 支持仅应用一轮。
2. 支持重复到指定结束日期。
3. 应用前重新验证人员、班种、请假和时间冲突。
4. 生成完整预览和统计摘要。
5. 保存为新排班版本，不覆盖当前发布版本。
6. 根据群组发布设置保存草稿或直接发布。
7. 记录模板版本和应用范围事件。

验证：

- 周期重复不多生成或少生成日期。
- 结束日期落在周期中间时正确截断。
- 已离开成员导致明确阻止或空缺提示。

版本节点：`feat(schedule): apply manual templates to periods`

### 任务 18：实现并发版本保护和冲突弹窗

目标：所有核心修改执行“先到者成功，后到者刷新”。

主要文件：

- `apps/api/src/plugins/idempotency.ts`
- `apps/api/src/modules/concurrency/version-guard.ts`
- `packages/contracts/src/concurrency.ts`
- `apps/web/src/api/conflict-handler.ts`
- `apps/web/src/components/DataConflictDialog.vue`
- `apps/api/tests/concurrency.integration.test.ts`
- `apps/web/tests/concurrency-conflict.spec.ts`

实施步骤：

1. 每个可变业务对象提交预期版本号。
2. 写事务按固定顺序锁定涉及记录，减少死锁。
3. 版本不一致返回 409 和最新摘要，不写事件。
4. 请求操作编号防止网络重试重复提交。
5. Web 弹窗提示数据已变化并自动刷新当前月份和操作窗口。
6. 页面重新获得焦点、打开操作窗口和提交前检查最新版本。
7. 刷新后用户必须重新确认，不自动重放旧操作。

验证：

- 两个浏览器修改同一班次，仅一个成功。
- 第二个浏览器看到弹窗和最新人员。
- 最终只有一条有效变更事件。

版本节点：`feat(schedule): enforce optimistic concurrency control`

## 10. 阶段三：请假、换班和加扣班

### 任务 19：实现请假和两种重排策略

目标：精确时间请假可预览并安全调整后续排班。

主要文件：

- `migrations/0006_leave_requests.sql`
- `packages/scheduling-domain/src/leave/overlap.ts`
- `packages/scheduling-domain/src/leave/reflow.ts`
- `packages/scheduling-domain/tests/leave-reflow.test.ts`
- `apps/api/src/modules/leaves/`
- `apps/web/src/features/leaves/`
- `apps/api/tests/leaves.integration.test.ts`

实施步骤：

1. 支持类型、开始时间、结束时间、全天和原因。
2. 任意时间重叠即判定不可排。
3. 原轮值不变策略只替换受影响班次。
4. 整体顺延策略跳过请假成员并推进轮值游标。
5. 批准前生成班次、人员、冲突和统计差异。
6. 审批时可覆盖群组默认策略。
7. 生效使用事务、版本检查和事件。

验证：

- 请假覆盖全天班一部分时仍冲突。
- 请假结束后整体顺延成员重新进入轮值。
- 无替班人员时产生待处理空缺。

版本节点：`feat(workflow): add leave requests and schedule reflow`

### 任务 20：实现换班流程

目标：两个成员交换未来班次，支持自动接受和管理员审批。

主要文件：

- `migrations/0007_swap_requests.sql`
- `apps/api/src/modules/swaps/`
- `packages/contracts/src/swaps.ts`
- `apps/web/src/features/swaps/`
- `apps/api/tests/swaps.integration.test.ts`
- `apps/web/tests/swap-flow.spec.ts`

实施步骤：

1. 发起人选择自己的班次、目标成员和目标班次。
2. 打开页面和提交前刷新两个班次。
3. 检查双方角色资格、请假和时间冲突。
4. 根据目标成员的群组设置手动或自动接受。
5. 根据群组设置进入管理员审批或直接生效。
6. 在一个事务中交换实际人员、递增版本和写事件。
7. 若任一班次改变，申请失效并返回 409。

验证：

- 双方各自仍有一个实际班次，不产生加扣班。
- 自动接受不能绕过管理员审批设置。
- 并发换同一班次只有一个申请生效。

版本节点：`feat(workflow): add member shift swaps`

### 任务 21：实现加班和扣班

目标：一个班次的代值形成不可拆分的加扣班对。

主要文件：

- `migrations/0008_duty_adjustments.sql`
- `apps/api/src/modules/duty-adjustments/`
- `packages/contracts/src/duty-adjustments.ts`
- `apps/web/src/features/duty-adjustments/`
- `apps/api/tests/duty-adjustments.integration.test.ts`
- `apps/web/tests/duty-adjustment-flow.spec.ts`

实施步骤：

1. 选择被代班班次、加班成员和扣班成员。
2. 复用双方确认和管理员审批基础能力。
3. 一个事务中更新实际人员并创建成对关联记录。
4. 加扣班不移动固定轮值游标。
5. 同一班次只允许一组当前有效关系。
6. 撤销通过反向事件恢复，不删除历史。
7. 日历实际人员显示“加”，扣班成员个人事件显示“扣”。

验证：

- 加班和扣班不能单独存在。
- 先加一次后扣一次净值为零，历史仍有两条。
- 同一班次第二次代值必须先撤销或替代前一关系。

版本节点：`feat(workflow): add paired duty adjustments`

## 11. 阶段三：通知、事件页面和状态标记

### 任务 22：完成事件中心和日历变动标记

目标：用户可追踪每项排班变化和原因。

主要文件：

- `apps/api/src/modules/events/event-routes.ts`
- `apps/web/src/views/events/EventCenterView.vue`
- `apps/web/src/features/events/EventTimeline.vue`
- `apps/web/src/features/calendar/ChangeBadge.vue`
- `apps/web/tests/event-timeline.spec.ts`

实施步骤：

1. 支持按日期、成员、角色、类型和操作者筛选。
2. 事件详情显示前后人员、班种、原因和统计变化。
3. 日历显示“换、替、调、加”等标记。
4. 从班次详情跳转到关联事件。
5. 撤销操作创建反向事件并展示关联链。

验证：

- 任一已发布变化能从日历追到完整事件。
- 普通成员只能查看所属群组事件。

版本节点：`feat(events): add schedule event center`

### 任务 23：实现站内通知、浏览器通知和定时任务

目标：值班、审批和排班变化能够可靠提醒。

主要文件：

- `migrations/0009_notifications.sql`
- `apps/api/src/modules/notifications/`
- `apps/api/src/jobs/duty-reminders.ts`
- `apps/api/src/jobs/notification-retry.ts`
- `apps/web/src/features/notifications/`
- `apps/web/src/service-worker.ts`
- `apps/api/tests/notifications.integration.test.ts`

实施步骤：

1. 站内通知保存接收人、类型、关联对象和已读状态。
2. 生成排班、审批、换班、加扣班和冲突通知。
3. 值班提醒默认提前 24 小时和 2 小时。
4. 群组设置默认时间，成员可以覆盖。
5. 浏览器权限只在用户主动开启时申请。
6. 锁屏正文默认不显示姓名和原因。
7. 通知发送失败不回滚业务，进入有限次数重试。
8. 定时任务使用批次键，重复运行不重复通知。

验证：

- 拒绝浏览器权限后站内通知仍可用。
- 重复定时任务不发送重复提醒。
- 只通知受影响成员。

版本节点：`feat(notifications): add duty and workflow reminders`

## 12. 阶段四：节假日和统计

### 任务 24：实现官方节假日数据管理

目标：法定节假日和调休工作日使用本地版本化数据。

主要文件：

- `migrations/0010_holiday_calendar.sql`
- `apps/api/src/modules/holidays/`
- `infra/scripts/import-holidays.ts`
- `packages/test-fixtures/src/holidays.ts`
- `apps/api/tests/holidays.integration.test.ts`

实施步骤：

1. 建立日期、节日名、放假、调休工作日、年份和版本字段。
2. 只允许平台管理员导入经核对的官方数据。
3. 导入前生成差异预览，避免覆盖历史版本。
4. 未录入下一年度时发出平台告警。
5. 日历和统计只读取已确认版本。

验证：

- 法定节假日与调休工作日正确区分。
- 旧年度数据不被新版本修改。

版本节点：`feat(holidays): add versioned official calendar`

### 任务 25：实现月度、年度和变更影响统计

目标：统计实际值班、周末、法定节假日和加扣班净值。

主要文件：

- `migrations/0011_statistics_snapshots.sql`
- `packages/scheduling-domain/src/statistics/calculate.ts`
- `packages/scheduling-domain/tests/statistics.test.ts`
- `apps/api/src/modules/statistics/`
- `apps/web/src/views/statistics/StatisticsView.vue`
- `apps/web/tests/statistics.spec.ts`

实施步骤：

1. 统计计划班次和实际值班数。
2. 按角色和班种分类。
3. 法定节假日优先，和周末互斥。
4. 跨日班按开始日期分类。
5. 计算换班次数、加班、扣班和净值。
6. 从事件计算请假、换班、加扣班和人工调整影响。
7. 发布或变更后增量刷新快照。
8. 提供按月重算并比对快照的校验入口。

验证：

- 周末与法定节假日不重复计数。
- 一次加班和一次扣班净值为零。
- 草稿和撤回版本不进入正式统计。

版本节点：`feat(statistics): add duty and adjustment reports`

### 任务 26：实现安全数据导出

目标：管理员导出排班和统计，但默认不泄露电话号码。

主要文件：

- `apps/api/src/modules/exports/`
- `packages/contracts/src/exports.ts`
- `apps/web/src/features/exports/ExportDialog.vue`
- `apps/api/tests/exports.integration.test.ts`

实施步骤：

1. 提供按月份、年份、角色和成员导出 CSV。
2. 默认字段不包含长号、短号和内部审计内容。
3. 权限校验和导出范围在服务端执行。
4. 大导出采用异步任务和短期下载链接。
5. 每次导出写入安全审计。

验证：

- 普通成员不能导出全群组数据。
- 默认文件不出现电话号码。

版本节点：`feat(exports): add audited schedule exports`

## 13. 阶段四：运维、安全和正式体验

### 任务 27：完成 PWA、响应式和可访问性

目标：电脑、手机和主流内置浏览器均可快速查看排班。

主要文件：

- `apps/web/vite.config.ts`
- `apps/web/src/styles/tokens.css`
- `packages/ui-tokens/`
- `apps/web/src/manifest.ts`
- `apps/web/tests/responsive.spec.ts`
- `apps/web/tests/accessibility.spec.ts`

实施步骤：

1. 电脑侧边导航和手机底部导航。
2. 当前月、周视图和列表视图响应式适配。
3. 静态资源和最近排班只读缓存。
4. 离线状态禁止提交并解释原因。
5. 班种颜色同时显示文字或图标。
6. 验证字号、对比度、键盘和焦点顺序。

验证：

- 手机首屏能直接看到当天和值班姓名。
- 离线提交不会进入等待队列后静默重放。

版本节点：`feat(web): add responsive PWA experience`

### 任务 28：实现备份、恢复、软删除和平台运维

目标：正式数据可恢复，关键任务可监控。

主要文件：

- `apps/api/src/jobs/database-backup.ts`
- `apps/api/src/jobs/statistics-rebuild.ts`
- `apps/api/src/modules/platform-admin/`
- `infra/scripts/restore-backup.ts`
- `docs/operations/backup-and-restore.md`
- `docs/operations/incident-response.md`

实施步骤：

1. 每日导出加密备份到受限云存储。
2. 保留 30 个每日和 12 个每月备份。
3. 建立恢复到隔离数据库的演练脚本。
4. 群组删除进入 30 天回收期。
5. 账号注销解除身份和电话，保留历史姓名快照。
6. 平台管理员管理节假日、封禁和任务状态。
7. 所有平台操作写审计。

验证：

- 从备份恢复后关键表数量和校验值一致。
- 软删除群组在回收期内可恢复。

版本节点：`feat(ops): add backup recovery and platform controls`

### 任务 29：执行完整并发、性能和安全验证

目标：达到 100 群组、2000 用户和 100 并发测试目标。

主要文件：

- `tests/load/`
- `tests/security/`
- `docs/testing/performance-report.md`
- `docs/testing/security-checklist.md`

实施步骤：

1. 生成虚构的 100 群组和 2000 用户数据。
2. 模拟 100 用户查看月份、提交申请和审批。
3. 并发执行同班次换班、请假和人工调整。
4. 生成单群组 100 人连续 12 个月排班。
5. 检查越权、群组码猜测、重复提交和敏感日志。
6. 记录冷启动、常规响应和数据库指标。
7. 只修复与验收目标直接相关的问题。

验收：

- 不存在丢失更新、重复班次和部分事务。
- 越权请求不返回其他群组信息。
- 报告记录测试条件、结果和容量建议。

版本节点：`test: validate concurrency performance and security`

## 14. CloudBase 部署与发布

### 任务 30：部署开发环境

目标：GitHub 主分支可部署到独立 CloudBase 开发环境。

主要文件：

- `infra/cloudbase/`
- `.github/workflows/deploy-development.yml`
- `docs/deployment/cloudbase-development.md`

实施步骤：

1. 在控制台建立开发环境、MySQL、认证和 HTTP 访问服务。
2. 在 CloudBase 中配置用户名密码认证。
3. 配置 Web 测试域名和 `/api` 路由。
4. 配置数据库迁移为受控人工步骤，不在每次前端构建时自动执行。
5. GitHub 使用环境级密钥，拉取请求不能读取正式密钥。
6. 主分支验证通过后自动部署开发环境。
7. 部署后运行健康和基础页面检查。

验证：

- 开发域名可注册、登录并查看测试群组。
- 云函数和定时任务日志可追踪关联编号。

版本节点：`deploy: add CloudBase development pipeline`

### 任务 31：准备正式域名、备案和生产环境

目标：完成正式发布所需的外部前置条件和配置记录。

主要文件：

- `docs/deployment/production-readiness.md`
- `docs/deployment/icp-checklist.md`
- `docs/deployment/dns-and-https.md`
- `docs/operations/monitoring.md`

实施步骤：

1. 核对域名实名认证和备案主体。
2. 购买满足备案要求的腾讯云资源。
3. 完成 ICP 或接入备案。
4. 配置正式 CloudBase 环境、MySQL、认证和存储。
5. 绑定自定义域名、CNAME、HTTPS 和同域 `/api`。
6. 设置调用、流量和费用 70%、85%、100% 告警。
7. 设置证书、备份和定时任务告警。
8. 按适用要求记录公安联网备案后续步骤。

此任务包含需要用户在腾讯云和备案系统完成的操作；代理只在获得明确授权后操作外部控制台。

验收：

- IPv4 网络通过 HTTPS 正式域名访问。
- 默认测试域名不作为正式入口。
- 生产和开发环境数据完全分离。

版本节点：`docs: add production deployment runbook`

### 任务 32：Web 1.0 发布验收

目标：依据设计规格完成最终用户验收和首个正式版本。

主要文件：

- `docs/releases/web-1.0-acceptance.md`
- `CHANGELOG.md`
- `README.md`

验收场景：

1. 新用户注册、填写真实姓名并保持登录。
2. 管理员创建群组、人员、角色和班种。
3. 成员通过群组码自动认领。
4. 自动生成固定顺序排班。
5. 手动建立 7 天模板并重复到指定日期。
6. 登录后直接看到当前月份每天值班姓名。
7. 手机拨打长号和短号。
8. 请假分别使用两种重排策略。
9. 完成换班和加扣班。
10. 两个浏览器并发修改同一班次，第二个被阻止并刷新。
11. 查看事件和统计影响。
12. 验证通知、备份、恢复和监控。
13. 访客从公开群组列表选择群组，直接查看当天所在月份的只读月历；显示节假日、当天标记和联系电话快速拨号，不显示换班/加扣班等事件标记、事件记录或管理入口。

发布步骤：

1. 完成所有自动检查。
2. 创建正式数据库备份。
3. 在开发环境进行一次完整验收。
4. 手动批准生产部署。
5. 运行生产冒烟测试。
6. 用户在发布时再次明确批准后，创建语义化 Web 1.0 Git 标签和 GitHub Release。

版本节点：`release: web scheduling system 1.0`

## 15. 每阶段检查点

阶段零完成后：

- 本地环境和 CI 稳定。
- 工作区无业务功能，但基础检查全部通过。

阶段一完成后：

- 用户、群组、人员认领、权限、电话、角色和班种可用。

阶段二完成后：

- 自动与手动排班、版本、发布、当前月日历和并发保护可用。

阶段三完成后：

- 请假、换班、加扣班、事件和通知可用。

阶段四完成后：

- 节假日、统计、导出、PWA、备份、性能和安全达到上线条件。

CloudBase 发布完成后：

- 正式域名、备案、IPv4 访问、监控和恢复流程有效。

## 16. 实施开始条件

开始任务 1 前必须满足：

1. 用户已审阅并批准本实施计划。
2. 当前 Git 工作区没有无法区分归属的未提交修改。
3. 本机可运行 Docker Desktop、Git、Node.js 和 pnpm。
4. 用户同意在需要真实 CloudBase 集成时提供或亲自完成腾讯云开发环境配置。

满足以上条件后，从任务 1 开始，每完成一个任务即验证、判断提交并推送，不跨任务批量实现。
