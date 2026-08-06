# 修复进度与待完成清单（Web 1.0 合规审查后）

> 本文件由 2026-08-06 全库合规审查报告整理生成，是新对话的唯一切入点。
> 上一轮审查报告与每个问题的完整证据（文件、行号、描述）见对话记录；本文件只保留可执行清单。

## 0. 基线

- 分支：`main`，与 `origin/main` 同步，`git status` 干净。
- 当前测试基线：`pnpm verify` 428/428（63 个测试文件，隔离 MySQL，轮次 3 后）。
- 审查结论：致命问题 0 项；严重 6 项；轻微约 20 项；健康度 6.5/10。

## 1. 修复任务约束协议（每轮必须遵守）

### 核心原则
1. **分批修复**：每轮对话只解决一个问题簇（本文件编号，如 #3.1 或 #7.3）。不允许擅自扩大范围。
2. **测试先行**：每轮开始前先跑基线测试确认通过；对严重问题（尤其 #3.1、#4.1）先写“锁定当前行为”的测试，确认它能通过后再重构。
3. **小步提交**：每次修改后用 `git diff --stat` 展示变更清单；不要一次性提交大量改动。
4. **本地进度日志**：每轮结束更新本文件“轮次记录”并追加到对话回复末尾。
5. **Git checkpoint**：每个问题簇完成后按 AGENTS.md 规则 commit 并 push；改炸了就丢弃分支，零成本回滚，绝不强行修复。

### 四项铁律
- ①不打补丁：禁止临时性、环境特判代码；修复必须永久、可解释。
- ②代码自解释：命名清晰；注释只写“为什么”，不写“是什么”。
- ③不留残渣：删除死代码、过期文档、无用导出、注释块、console.log、未使用变量。
- ④部署一致：环境变量同步 `.env.example` 与文档；路径/构建产物可复现。

### 每轮执行流程
1. 确认基线：`pnpm verify`（本项目无 `migrate:check` 脚本；涉及迁移时用现有 `pnpm --filter @schedule/api migrate` + `packages/database/tests/migrations.test.ts` 代替）。
2. 理解目标：读本文件对应编号的问题描述，明确文件与预期行为。
3. 制定方案：不超过 5 句话说明修改计划。
4. 执行修改：只改目标问题；**发现其他问题不要顺手改**，记入本文件“第 6 节 TODO（新发现）”回报。
5. 验证回归：`pnpm verify` 全通过；测试失败时不得改测试来掩盖，要报告失败详情。
6. 更新本文件“轮次记录”，格式见第 5 节模板。
7. 回复末尾：列出本次最不确定的 1–3 个点（如果出错会表现为什么症状）。

### 硬性约束
- 禁止 `any` / `as any`；类型严格推导（现有 `as unknown as` 遗留按所属问题簇逐步清理）。
- 涉及环境变量：必须同步 `.env.example` 和相关文档。
- 涉及数据库迁移：修改前后跑迁移验证。
- 拿不定主意（多选/产品规则冲突）时停下来问用户，不要自作主张。

## 2. 待完成清单（按风险/收益比排序）

优先级说明：P0 = 用户点名且防数据损坏/事故复发；P1 = 收益高、风险可控或零风险；P2 = 收益中等；P3 = 低收益或需先确认产品决策。每个编号先做“锁定行为测试”，再重构。

| 优先级 | 编号 | 问题 | 原严重度 | 风险 | 收益 | 备注 |
|---|---|---|---|---|---|---|
| ✅ | #3.1 | starts_at 环境补丁散落 12 处 | 严重 | 中 | 极高（防线上数据损坏复发） | 已完成（轮次 1）：统一助手 + 锁定测试，见第 7 节 |
| ✅ | #4.1 | swap/duty 服务复制（loadMembers/loadRoleNames） | 严重 | 中 | 极高 | 已完成（轮次 2）：共享 GroupMemberReader + 锁定测试，见第 7 节 |
| ✅ | #7.3 | 中国时区算法在 9 个文件重复 | 严重 | 中低 | 高（时区事故反复出现） | 已完成（轮次 3）：统一到 scheduling-domain 并机械替换，见第 7 节 |
| P1 | #3.2 | 日志/审计脱敏清单双份且已漂移 | 严重 | 低 | 高（安全控制） | 合并为共享脱敏模块 |
| P1 | #1.1 | 文档过期/自相矛盾（待办、轮次、415） | 轻微 | 零 | 中 | 零风险热身轮，为后续轮次提供正确上下文 |
| P1 | #3.3 | 任务分派默认分支静默落到导出任务 | 轻微 | 极低 | 中 | switch 穷举 + default 抛错 |
| P1 | #3.4 | AUTH_DEV_MODE 无 NODE_ENV 防线 | 轻微 | 低 | 中（安全） | 显式双条件 + env schema |
| P1 | #7.5 | event-timeline 死代码（含 spec 续命） | 轻微 | 极低 | 中 | 删函数/字段/样式并同步 spec |
| P1 | #2.1 | ui-tokens CSS/TS 双份维护 | 严重 | 低 | 中高 | 单一来源生成 |
| P2 | #7.1 | client.ts 2200 行手写校验器 + 重复请求函数 | 严重 | 高 | 极高 | 必须拆子步骤，见第 4 节 |
| P2 | #7.4 | 前端 swap/duty 候选与 isFutureAssignment 重复 | 轻微 | 低 | 中 | 合并 feature 逻辑 |
| P2 | #8.1 | 15 个页面重复错误文案模板 | 轻微 | 低 | 中低 | 抽 toUserMessage |
| ✅ | #8.2 | 视图层再次裸写时区/日期魔法数 | 轻微 | 零 | 中 | 已随 #7.3（轮次 3）一并替换为领域工具 |
| P2 | #3.7 | 框架 4xx 全部归一化为 VALIDATION_FAILED | 轻微 | 低 | 中 | 按状态码映射并补测试 |
| P2 | #4.2/#4.3 | 冲突断言双轨 + 三服务“上帝对象”状态机 | 轻微 | 高 | 高 | 必须在 #4.1 之后做，拆多轮 |
| P3 | #4.5 | 发布/生成缺少“仅未来日期”限制 | 严重（缺口） | 低 | 中 | **需用户确认规则**（今天能否发布/跨月行为） |
| P3 | #7.6 | manual-adjustment“调”标记半移除 | 轻微 | 低 | 中低 | **需用户确认**：保留旧数据兼容还是彻底移除 |
| P3 | #3.5 | idempotency 宽 catch 当重复键 | 轻微 | 低 | 低 | 检查 1062 错误码 |
| P3 | #3.6 | CloudBase 处理器惰性单例竞态 | 轻微 | 低 | 低中 | 顶层创建或 Promise 单例 |
| P3 | #9.2 | 云函数入口跨目录相对导入 | 轻微 | 低中 | 中 | API 包暴露 cloudbase 入口 |
| P3 | #9.1 | cloudbaserc 未声明 env，环境不可复现 | 轻微 | 低 | 中 | 需与控制台协调 |
| P3 | #6.1/#6.2 | 迁移 0030/0031 复制 + 序列一致性无校验 | 轻微 | 低 | 低中 | 合并 SQL + 加校验迁移 |
| P3 | #5.1 | notification-retry 的 skipped 恒为 0 | 轻微 | 低 | 低 | 返回三态并如实计数 |
| P3 | #5.2 | group-recycle 27 条裸 SQL 手写级联 | 轻微 | 低中 | 低中 | schema 元数据生成或外键级联 |
| P3 | #5.3 | 统计重建静默吞错 | 轻微 | 低 | 低 | 记录失败上下文 |
| P3 | #4.4 | 两个软删除函数几乎相同 | 轻微 | 低 | 低 | 合并带可选截止日期 |
| P3 | #1.2 | .env.example 缺开发模式开关 | 轻微 | 零 | 低 | 随 #3.4 一并做 |
| P3 | #1.3 | 工作区残留（空目录/日志/构建产物） | 轻微 | 零 | 低 | 清理命令，不入库 |
| P3 | #9.3 | 加载/安全测试直写 DB 与 stub 认证 | 轻微 | 低 | 低 | 复用 database schema 与 API 入口 |

## 3. 问题簇详情（执行时按此卡片理解目标）

### 1. 根目录 / 工程配置与文档

**1.1 文档自相矛盾、重复记录已修复事项**
位置：[docs/debug/debug-feedback-log.md (line 660)](E:/AItools/Schedule/docs/debug/debug-feedback-log.md:660)（第 660、663 行）；[docs/project-status.md (line 17)](E:/AItools/Schedule/docs/project-status.md:17)（第 17、31 行）
原则：③不留残渣
问题：待办清单仍写“只允许发布未来日期排班，以及既往排班模块”，但既往排班模块（轮次 47）已实现；“Fastify 415 待排查”在轮次 56 已修复却仍列在待办；project-status 仍写“轮次 1–49”，实际已完成 56 轮。文档是交接入口，过期信息会让下一轮会话按错误前提开工。
严重等级：轻微
建议：以当前代码和 Git 历史为准重写“待办/下一步”，删除已解决条目。

**1.2 `.env.example` 缺少开发模式开关**
位置：[.env.example (line 1)](E:/AItools/Schedule/.env.example:1)（全文）；[.env (line 1)](E:/AItools/Schedule/.env:1)（gitignored）
原则：④部署一致
问题：本地 `.env` 使用 `AUTH_DEV_MODE=true` / `VITE_AUTH_DEV_MODE=true`，但 `.env.example` 没有任何说明，新环境无法复现本地开发配置；而 `AUTH_DEV_MODE` 又没有进后端 `env.ts` 的 schema（见 3.4），属于“只存在于运行时魔法字符串”的配置。
严重等级：轻微
建议：在 `.env.example` 补两个开关项，并在 `env.ts` 中用 `z.literal`/`z.enum` 声明它。

**1.3 工作区残留产物（未入库）**
位置：`cloudfunctions/auth-identity-probe`（空目录）；`infra/cloudbase/functions/*/index.js`（约 10 万行/5 万行打包产物）；`local-api*.log`、`local-web*.log`；`tests/load/node_modules`、`tests/security/node_modules`、`infra/scripts/node_modules`、`packages/database/dist` 等
原则：③不留残渣
问题：这些均被 `.gitignore`/`infra/cloudbase/.gitignore` 忽略、未污染仓库，但工作区里残留着空目录、构建产物、日志和嵌套依赖，任何“全库扫描”都会先撞上它们。
严重等级：轻微
建议：清理空目录与日志（构建产物交给 CI 生成），或在根目录补一条清理脚本。

### 2. packages（契约 / 数据库 / 领域 / 设计令牌）

**2.1 设计令牌双份维护（CSS + TS）**
位置：[tokens.css (line 1)](E:/AItools/Schedule/packages/ui-tokens/src/tokens.css:1)（1–56 行）；[index.ts (line 3)](E:/AITools/Schedule/packages/ui-tokens/src/index.ts:3)（3–70 行）
原则：①不打补丁 ③不留残渣
问题：同一组颜色/间距/字号同时存在于 CSS 自定义属性和 TS 常量两份文件，靠人工保持一致；没有生成器或单一来源。
严重等级：严重
建议：从一份 token 定义（如 JSON/TS）生成 `.css` 与 TS 导出，或删除其一。

**2.2 数据库客户端使用 mysql2 内部属性并异步设时区**
位置：[client.ts (line 23)](E:/AItools/Schedule/packages/database/src/client.ts:23)（23–41 行）
原则：①不打补丁
问题：`pool.pool.on(...)` 依赖 mysql2/promise 的私有底层对象；`SET time_zone='+00:00'` 在连接事件里异步执行，未等待完成，早发的查询可能落在服务器默认时区上，造成 NOW()/CURRENT_TIMESTAMP 不一致（本项目已经历过时区/时间戳类事故）。
严重等级：轻微
建议：在连接建立回调中同步完成时区设置（或用 drizzle 连接初始化选项），并加注释说明动机。

**2.3 领域层时区常量与 Web 端重复（见 8.1）**
位置：[time.ts (line 1)](E:/AItools/Schedule/packages/scheduling-domain/src/time.ts:1)（第 1 行 `8 * 60 * 60 * 1000`）
原则：①不打补丁
问题：领域包已提供 `getChinaStandardTimeBusinessDate`，但 Web 端仍各自复制常量与函数（详见 8.1），领域层这个“正确实现”没有被复用。
严重等级：严重（与 8.1 合并计）
建议：将中国时区日期工具作为唯一公共包导出给 Web 使用。

### 3. apps/api 基础层（入口 / 插件 / 认证 / 错误处理）

**3.1 环境特判补丁：显式保留 `starts_at` 散落 12 处**
位置：[schedule-repository.ts (line 770)](E:/AItools/Schedule/apps/api/src/modules/schedules/schedule-repository.ts:770)（770/824/888 行）；[swap-service.ts (line 633)](E:/AItools/Schedule/apps/api/src/modules/swaps/swap-service.ts:633)（633/642/1269/1278 行）；[duty-adjustment-service.ts (line 1097)](E:/AItools/Schedule/apps/api/src/modules/duty-adjustments/duty-adjustment-service.ts:1097)（1097/1193 行）；[leave-service.ts (line 622)](E:/AItools/Schedule/apps/api/src/modules/leaves/leave-service.ts:622)；[membership-service.ts (line 1005)](E:/AItools/Schedule/apps/api/src/modules/groups/membership-service.ts:1005)（1005/1018 行）
原则：①不打补丁 ②代码自解释
问题：为绕开 CynosDB `explicit_defaults_for_timestamp=OFF` 导致的 `ON UPDATE CURRENT_TIMESTAMP` 漂移，每个 `shift_assignments` 更新都手写 `startsAt: sql`${shiftAssignments.startsAt}``。这是环境特判补丁，且在 5 个文件 12 处重复，代码中没有任何注释——迁移 0018/0020 已修库结构，这些补丁仍然留在代码里。任何“精简”该字段的后续重构都会静默重演轮次 10/13 的线上数据损坏。
严重等级：严重
建议：收敛为一个 `updateShiftAssignmentsPreservingTimestamps` 仓储助手（或统一在 schema 层处理），并加注释与回归测试说明为何必须保留该列。
> 完成情况（轮次 1，2026-08-06）：已收敛为 `apps/api/src/modules/schedules/shift-assignment-writer.ts` 的 `updateShiftAssignments`，保留列值并统一递增 version，注释说明 CynosDB 原因；新增“批量更新不改变 starts_at（模拟 ON UPDATE）”锁定测试；`pnpm verify` 421/421 通过。本条目中的行号为审查时快照，重构后已过期。

**3.2 日志与审计脱敏清单双份维护**
位置：[app.ts (line 57)](E:/AItools/Schedule/apps/api/src/app.ts:57)（57–70、217–247 行）；[audit-writer.ts (line 6)](E:/AItools/Schedule/apps/api/src/modules/audit/audit-writer.ts:6)（6–18、44–77 行）
原则：①不打补丁 ③不留残渣
问题：`sensitiveLogFields` 与 `sensitiveFields` 是两套独立清单 + 两套几乎相同的 `normalizeFieldName`/递归脱敏实现，且清单已经不一致（审计含 `telephone`，日志不含）。任何新增敏感字段都需要同时改两处，漏改即可能造成日志泄露。
严重等级：严重
建议：把敏感字段清单与脱敏工具抽成单一共享模块（如 `packages/contracts` 或 api 内 `security/redact.ts`），日志与审计共用，并加一致性测试。

**3.3 任务分派默认分支静默落到导出任务**
位置：[runner.ts (line 38)](E:/AItools/Schedule/apps/api/src/jobs/runner.ts:38)（38–59 行）
原则：①不打补丁 ②代码自解释
问题：`JobName` 联合类型有 7 个值，if 链覆盖 6 个，最后一个 `return new ExportJobProcessor(client).run()` 作为“兜底”。未来新增任务类型时，忘记加分支会静默执行导出任务而不是报错。
严重等级：轻微
建议：改为 `switch` 穷举并在 `default` 抛错，或用映射表 `Record<JobName, Factory>`。

**3.4 开发认证开关无环境防线**
位置：[runtime.ts (line 30)](E:/AItools/Schedule/apps/api/src/runtime.ts:30)（30–33 行）；[dev-auth.ts (line 1)](E:/AItools/Schedule/apps/api/src/adapters/auth/dev-auth.ts:1)
原则：④部署一致
问题：`process.env.AUTH_DEV_MODE === 'true'` 直接选择“任意 Bearer token 即身份”的认证端口，没有 `NODE_ENV !== 'production'` 防线，也没有 schema 校验。当前 CloudBase 网关路径恰好绕开了它，但这是一个“一旦重构路由就可能上线”的隐形后门。
严重等级：轻微
建议：显式加 `NODE_ENV === 'development'` 双条件，并把该变量纳入 `env.ts` 校验。

**3.5 幂等键插入用宽泛 catch 当重复键判断**
位置：[idempotency.ts (line 34)](E:/AItools/Schedule/apps/api/src/plugins/idempotency.ts:34)（34–52 行）
原则：①不打补丁
问题：首次 insert 的任意异常都被当作“重复键”，随后再查再插。虽然异常会继续传播，但把“唯一键冲突”和“数据库故障”混为一谈，故障路径会做两次无谓的插入尝试。
严重等级：轻微
建议：捕获后先检查 MySQL 1062 错误码，或使用 `INSERT ... ON DUPLICATE KEY` 语义后再读。

**3.6 CloudBase 处理器惰性单例存在并发竞态**
位置：[cloudbase-handler.ts (line 31)](E:/AItools/Schedule/apps/api/src/cloudbase-handler.ts:31)（31–50 行）
原则：①不打补丁
问题：`runtimeApp ??= createCloudbaseRuntimeApp()` 在冷启动并发请求下可能创建多个 Fastify 实例与连接池，只有一个被保留，其余泄漏到函数实例结束。
严重等级：轻微
建议：在模块顶层同步创建一次，或对创建过程做 Promise 单例化。

**3.7 框架 4xx 全部归一化为 VALIDATION_FAILED**
位置：[error-handler.ts (line 75)](E:/AItools/Schedule/apps/api/src/plugins/error-handler.ts:75)（75–103 行）
原则：①不打补丁
问题：除 415 外，任何框架 4xx（400/404/429 等）一律映射为 `VALIDATION_FAILED`，丢失语义；这是轮次 56 修复时留下的“只修 415”的窄补丁。
严重等级：轻微
建议：按状态码映射到契约错误码（400→VALIDATION_FAILED、404→NOT_FOUND、429→RATE_LIMITED），并为每个映射补测试。

### 4. apps/api 业务模块（排班 / 工作流 / 换班 / 加扣班 / 请假）

**4.1 换班与加扣班服务大段复制粘贴**
位置：[swap-service.ts (line 1642)](E:/AItools/Schedule/apps/api/src/modules/swaps/swap-service.ts:1642)（loadMembers 1642–1692、loadRoleNames 1694–1711）；[duty-adjustment-service.ts (line 1425)](E:/AItools/Schedule/apps/api/src/modules/duty-adjustments/duty-adjustment-service.ts:1425)（loadMembers 1425–1475、loadRoleNames 1477–1493）
原则：①不打补丁
问题：两个文件里的 `loadMembers` 几乎逐行相同（唯一差异是 `autoAcceptSwaps` 默认值 1 vs 0），`loadRoleNames` 完全一致。该差异没有任何注释说明是刻意设计，看起来就是“复制后微调参数”；再加上两文件各 1600–1900 行的体量，任何一处修复都容易漏改另一处。
严重等级：严重
建议：把成员/角色读取提升到共享服务（`WorkflowConflictService` 旁或新 `GroupMemberReader`），差异字段用显式参数表达。
> 完成情况（轮次 2，2026-08-06）：已抽为 `apps/api/src/modules/groups/group-member-reader.ts` 的 `GroupMemberReader`，`loadMembers` 通过 `autoAcceptSwapsDefault` 显式表达 swap=1/duty=0 的差异，`loadRoleNames` 完全共享；两个服务全部调用点改用 `memberReader`，删除私有复制与重复成员行类型；新增 2 条“从未设置偏好”默认行为锁定测试 + 4 条共享读取器集成测试；`pnpm verify` 427/427 通过。本条目中的行号为审查时快照，重构后已过期。

**4.2 冲突检查后仍保留各自“预检 + 断言”双轨**
位置：[swap-service.ts (line 1590)](E:/AItools/Schedule/apps/api/src/modules/swaps/swap-service.ts:1590)（assertNoActiveWorkflowConflicts/assertNoSwapConflicts）；[duty-adjustment-service.ts (line 1381)](E:/AItools/Schedule/apps/api/src/modules/duty-adjustments/duty-adjustment-service.ts:1381)（assertNoActiveWorkflows/assertNoDutyAdjustmentConflicts）
原则：①不打补丁
问题：`WorkflowConflictService` 已统一查询逻辑，但每个服务又各自包装成“预览冲突”“事务内断言”两套入口，消息文案与结构互不相同，仍属半重构残留。
严重等级：轻微
建议：统一为一个“预检 + 提交前断言”接口，冲突消息由共享服务生成。

**4.3 换班/加扣班/请假服务全部自带 `eventWriter`/`notificationWriter`/`permissionService` 三件套**
位置：[swap-service.ts (line 87)](E:/AItools/Schedule/apps/api/src/modules/swaps/swap-service.ts:87)、[duty-adjustment-service.ts (line 81)](E:/AItools/Schedule/apps/api/src/modules/duty-adjustments/duty-adjustment-service.ts:81)、[leave-service.ts (line 128)](E:/AItools/Schedule/apps/api/src/modules/leaves/leave-service.ts:128)
原则：①不打补丁
问题：三个 1000+ 行服务各自实例化同样的依赖、各自维护 runXxx 状态机，整体呈“上帝服务”形态；事件与通知的写入参数也大量重复（换班/加扣班各 7 个事务入口）。
严重等级：轻微
建议：把状态机（创建/接受/审批/拒绝/取消/撤销）抽成可复用的工作流骨架，服务只提供领域差异。

**4.4 排班仓储内部两个软删除函数几乎相同**
位置：[schedule-repository.ts (line 749)](E:/AItools/Schedule/apps/api/src/modules/schedules/schedule-repository.ts:749)（749–779 与 801–833 行）
原则：①不打补丁
问题：`softDeleteAssignments` 与 `softDeleteAssignmentsBefore` 仅差一个 `lt(businessDate)` 条件，整段 SQL 与更新语句重复。
严重等级：轻微
建议：合并为一个带可选截止日期的函数。

**4.5 发布/自动生成缺少“仅未来日期”限制（已知遗留）**
位置：[publish-service.ts (line 1)](E:/AItools/Schedule/apps/api/src/modules/schedules/publish-service.ts:1)、[generate-service.ts (line 1)](E:/AItools/Schedule/apps/api/src/modules/schedules/generate-service.ts:1)；对比 [apply-service.ts (line 355)](E:/AItools/Schedule/apps/api/src/modules/manual-schedules/apply-service.ts:355)（355–365 行已拦截）
原则：①不打补丁
问题：手动模板应用已阻止过去起始日期，但发布与自动生成路径没有等价校验；这是 debug 日志明确标注的“原规划仍待处理”事项（见第 10 节已知问题）。
严重等级：严重（功能缺口 + 规则不一致）
建议：把“起始日期不得早于今天”收敛为共享领域断言，并在发布/生成入口复用。

### 5. apps/api 定时任务

**5.1 通知重试的 skipped 指标恒为 0**
位置：[notification-retry.ts (line 57)](E:/AItools/Schedule/apps/api/src/jobs/notification-retry.ts:57)（57–70、92–164 行）
原则：③不留残渣
问题：`processDelivery` 把“通知不存在/订阅失效/重试耗尽”全部归为 `failed`，`skipped` 只在“推送未配置”路径有值；接口却保留四个字段，运维无法区分“发送失败”与“跳过”。
严重等级：轻微
建议：让 `processDelivery` 返回 `failed | sent | skipped` 三元结果并如实计数。

**5.2 群组回收用 27 条裸 SQL 手写级联删除**
位置：[group-recycle.ts (line 12)](E:/AItools/Schedule/apps/api/src/jobs/group-recycle.ts:12)（12–57 行）
原则：①不打补丁 ④部署一致
问题：所有需要级联清理的表必须人工维护在这张列表里，新增含 `group_id` 的表极容易漏加；`scanned` 实际等于 `purged`，命名与语义不符。
严重等级：轻微
建议：改用外键级联或从 schema 元数据生成删除顺序，并修正 `scanned` 语义。

**5.3 统计重建静默吞错**
位置：[statistics-rebuild.ts (line 34)](E:/AItools/Schedule/apps/api/src/jobs/statistics-rebuild.ts:34)（34–46 行）
原则：①不打补丁
问题：`catch { failed += 1 }` 不记录任何错误上下文，失败月份无法定位。
严重等级：轻微
建议：把错误写入 `platformJobRuns.summary` 或结构化日志。

### 6. migrations

**6.1 0030/0031 两份回填 SQL 逐行复制**
位置：[0030_backfill_swap_workflow_sequence.sql (line 1)](E:/AItools/Schedule/migrations/0030_backfill_swap_workflow_sequence.sql:1)、[0031_backfill_duty_adjustment_workflow_sequence.sql (line 1)](E:/AItools/Schedule/migrations/0031_backfill_duty_adjustment_workflow_sequence.sql:1)
原则：①不打补丁
问题：两份 SQL 只差 UPDATE 目标表，排名字查询完全一样；0030 与 0031 各自从全量联合查询重新计算排名，若未来再追加同类表，需要第三份复制品。
严重等级：轻微
建议：合并为一次 `UPDATE ... JOIN` 双表更新（或生成脚本），并注明排序必须与分配器一致。

**6.2 序列分配表与回填值无显式一致性校验**
位置：[workflow-sequence-allocator.ts (line 5)](E:/AItools/Schedule/apps/api/src/modules/workflows/workflow-sequence-allocator.ts:5)；[0029_seed_workflow_sequence_allocations.sql (line 1)](E:/AItools/Schedule/migrations/0029_seed_workflow_sequence_allocations.sql:1)
原则：①不打补丁
问题：运行时序列来自自增 ID，历史回填却来自 `ROW_NUMBER()`，两者靠“恰好都按创建顺序”保持一致，迁移里没有断言（例如 `MAX(workflow_sequence) < LAST_INSERT_ID()`）。
严重等级：轻微
建议：在 0031 末尾加一条校验迁移或测试，确认新旧序列空间不重叠。

### 7. apps/web 基础层（API 客户端 / PWA / 路由）

**7.1 手工响应校验器 2200 行 + 三个重复请求函数**
位置：[client.ts (line 1903)](E:/AItools/Schedule/apps/web/src/api/client.ts:1903)（1903–1942、1944–2002、2004–2057 三个几乎相同的请求函数；2059–4201 约 113 个手写 `isX` 守卫；4203–4205 定义了从未使用的 `isUndefined`）
原则：①不打补丁 ②代码自解释
问题：`client.ts` 共 4221 行，其中约 51% 是手写类型守卫样板。契约层加字段、改字段时，这里必须人工同步，否则线上表现为“服务返回了无效资料”（本项目已多次出现该提示）；三个请求函数也只是复制后微调。这是整个代码库最大的“复制粘贴后微调参数”实例。
严重等级：严重
建议：从 `@schedule/contracts` 或共享 zod schema 生成类型守卫（或改为 zod `.parse` 统一校验），删除 `isUndefined` 等死代码。

**7.2 客户端错误码表与契约联合类型双份维护**
位置：[client.ts (line 435)](E:/AItools/Schedule/apps/web/src/api/client.ts:435)（435–443 行）；[errors.ts (line 1)](E:/AItools/Schedule/packages/contracts/src/errors.ts:1)
原则：①不打补丁
问题：`knownApiErrorCodes` 用字面量重建了 `ApiErrorCode` 联合类型；契约新增错误码时，漏改这里会让合法错误被当成未知响应。
严重等级：轻微
建议：用 `z.enum`/运行时 schema 从 contracts 直接派生，或加一个编译期一致性测试。

**7.3 服务端时区常量复制到 8 个前端文件**
位置：[calendar-logic.ts (line 7)](E:/AItools/Schedule/apps/web/src/features/calendar/calendar-logic.ts:7)（第 7 行）、[calendar-views.ts (line 10)](E:/AItools/Schedule/apps/web/src/features/calendar/calendar-views.ts:10)、[swap-logic.ts (line 12)](E:/AItools/Schedule/apps/web/src/features/swaps/swap-logic.ts:12)、[duty-adjustment-logic.ts (line 12)](E:/AItools/Schedule/apps/web/src/features/duty-adjustments/duty-adjustment-logic.ts:12)、[leave-logic.ts (line 9)](E:/AItools/Schedule/apps/web/src/features/leaves/leave-logic.ts:9)、[event-timeline.ts (line 10)](E:/AItools/Schedule/apps/web/src/features/events/event-timeline.ts:10)，以及 [StatisticsView.vue (line 34)](E:/AItools/Schedule/apps/web/src/views/statistics/StatisticsView.vue:34)、[ExportDialog.vue (line 112)](E:/AItools/Schedule/apps/web/src/features/exports/ExportDialog.vue:112)、[ManualScheduleView.vue (line 855)](E:/AItools/Schedule/apps/web/src/views/schedules/ManualScheduleView.vue:855) 中裸写 `8 * 60 * 60 * 1000`
原则：①不打补丁 ②代码自解释
问题：同一“中国业务日期”算法在 9 个文件里重复，且部分写成裸 `8 * 60 * 60 * 1000` 魔法数；后端领域包已有正确实现却不被复用。轮次 12/18 的时区误判事故正是这类重复逻辑产生的。
严重等级：严重
建议：抽一个 `packages/business-time`（或让 web 依赖 scheduling-domain 的纯函数），统一替换全部调用点。
> 完成情况（轮次 3，2026-08-06）：`@schedule/scheduling-domain` 导出唯一 `chinaStandardTimeOffsetMilliseconds` 与 `toChinaStandardTimeUtcTimestamp`；web 新增领域包依赖并删除 9 个文件的重复常量/实现（calendar-logic/calendar-views 保留薄包装），三个视图的裸魔法数改为领域函数；`pnpm verify` 428/428 通过。本条目中的行号为审查时快照，重构后已过期。

**7.4 换班/加扣班候选逻辑重复**
位置：[swap-logic.ts (line 109)](E:/AItools/Schedule/apps/web/src/features/swaps/swap-logic.ts:109)（`isFutureAssignment` 109–112 行）；[duty-adjustment-logic.ts (line 47)](E:/AItools/Schedule/apps/web/src/features/duty-adjustments/duty-adjustment-logic.ts:47)（47–50 行）
原则：①不打补丁
问题：`isFutureAssignment` 完全相同，`buildXxxCandidates` 的“过滤未来班次/按当前值班人分组”也高度相似；两文件还各自复制了状态标签表与“下一步状态说明” switch。
严重等级：轻微
建议：把“未来班次过滤 + 候选构建 + 状态说明”合并为共享 feature 逻辑。

**7.5 事件时间线遗留轮次 19/21 移除 UI 后的死代码**
位置：[event-timeline.ts (line 133)](E:/AItools/Schedule/apps/web/src/features/events/event-timeline.ts:133)（`getEventRelationLabel` 133–135；`buildSwapChainSummary` 399–429；`buildDutyAdjustmentChainSummary` 431–468；`isCorrection` 字段 20 行与 491 行）；[EventTimeline.vue (line 188)](E:/AItools/Schedule/apps/web/src/features/events/EventTimeline.vue:188)（188–200 行 `.entry-relation` 样式）
原则：③不留残渣
问题：轮次 19/21 把“更正/撤销”标签从界面移除后，相关函数、`isCorrection` 计算、`.entry-relation` 样式全部保留，仅被 spec 引用“续命”；`getEventMarker` 也只在 spec 中被直接调用。这是典型的“留一手”。
严重等级：轻微
建议：删除未被生产代码引用的导出与样式，同步删除或改写对应 spec。

**7.6 “调”标记映射与文档矛盾**
位置：[calendar-query.ts (line 33)](E:/AItools/Schedule/apps/api/src/modules/calendar/calendar-query.ts:33)（33–47 行）；[calendar-logic.ts (line 168)](E:/AItools/Schedule/apps/web/src/features/calendar/calendar-logic.ts:168)（168–190 行）；[MonthGrid.vue (line 55)](E:/AItools/Schedule/apps/web/src/features/calendar/MonthGrid.vue:55)
原则：③不留残渣
问题：`assignment_manually_updated` 事件已无任何生产者（全库搜索仅剩查询映射与测试），但日历仍保留 `manual-adjustment → '调'` 的映射、标签与渲染；调试日志却说“'调'标记从所有日历移除”。旧事件数据会继续显示“调”，新代码不再产生，属于半移除状态。
严重等级：轻微
建议：明确决策——保留旧数据兼容就在代码注释与文档中说明，否则删除映射并对旧事件做迁移。

### 8. apps/web 视图层

**8.1 大视图仍以“组件内重复错误文案”方式收尾**
位置：[ManualScheduleView.vue (line 825)](E:/AItools/Schedule/apps/web/src/views/schedules/ManualScheduleView.vue:825)（825 行）及 [CalendarView.vue (line 241)](E:/AItools/Schedule/apps/web/src/views/calendar/CalendarView.vue:241)、[SwapPanel.vue (line 494)](E:/AItools/Schedule/apps/web/src/features/swaps/SwapPanel.vue:494) 等 15 个文件
原则：①不打补丁
问题：每个页面重复 `error instanceof ApiClientError ? error.message : '...暂时无法加载，请稍后重试。'` 模板，文案高度雷同但各有微调，属于前端版“复制粘贴后微调”。
严重等级：轻微
建议：抽一个 `toUserMessage(error, fallback)` 工具并统一文案。

**8.2 时区/日期辅助在视图层再次裸写**
位置：[StatisticsView.vue (line 34)](E:/AItools/Schedule/apps/web/src/views/statistics/StatisticsView.vue:34)、[ExportDialog.vue (line 112)](E:/AItools/Schedule/apps/web/src/features/exports/ExportDialog.vue:112)、[ManualScheduleView.vue (line 855)](E:/AItools/Schedule/apps/web/src/views/schedules/ManualScheduleView.vue:855)
原则：②代码自解释
问题：`Date.now() + 8 * 60 * 60 * 1000`、`Date.UTC(...) - 8 * 60 * 60 * 1000` 魔法数直接内联，无命名常量，与 7.3 同类问题叠加。
严重等级：轻微
建议：并入 7.3 的统一时间工具。
> 完成情况（轮次 3，2026-08-06）：三处裸写已随 #7.3 一并替换为领域函数（`getCurrentBusinessMonth` / `toChinaStandardTimeUtcTimestamp`），本条视为完成。

### 9. infra / tests

**9.1 CloudBase 函数配置与仓库环境声明脱节**
位置：[cloudbaserc.json (line 1)](E:/AItools/Schedule/infra/cloudbase/cloudbaserc.json:1)（全文无 env 字段）；[deploy-development.yml (line 1)](E:/AItools/Schedule/.github/workflows/deploy-development.yml:1)
原则：④部署一致
问题：函数运行时必需的 `MYSQL_*`、`VAPID_*`、`BACKUP_*`、`HOLIDAY_ADMIN_UIDS` 等环境变量只存在于 CloudBase 控制台，仓库无法复现/审计环境配置；`cloudbaserc.json` 未声明 env，部署流程也未校验。
严重等级：轻微
建议：把非密钥配置声明进 `cloudbaserc.json`（密钥走 GitHub Secrets/控制台），并在部署前加一次环境完整性检查。

**9.2 云函数入口通过相对路径跨目录引用应用源码**
位置：[schedule-api/src/main.js (line 1)](E:/AItools/Schedule/infra/cloudbase/functions/schedule-api/src/main.js:1)、[schedule-jobs/src/main.js (line 1)](E:/AItools/Schedule/infra/cloudbase/functions/schedule-jobs/src/main.js:1)
原则：④部署一致
问题：`import ... from '../../../../../apps/api/src/...'` 让 infra 隐式依赖 apps 源码路径，esbuild 打包后才能运行；目录一旦调整，部署静默失败。这是跨模块隐式耦合。
严重等级：轻微
建议：给 `@schedule/api` 暴露明确的 cloudbase 入口导出，函数包只依赖包名。

**9.3 加载/安全测试内的数据库直写与 stub 认证重复业务规则**
位置：[run-load-test.ts (line 524)](E:/AItools/Schedule/tests/load/run-load-test.ts:524)（524 行起）；[security.integration.test.ts (line 273)](E:/AItools/Schedule/tests/security/security.integration.test.ts:273)
原则：①不打补丁
问题：加载测试自带一套建表/直插逻辑（`AnyInsertTable`）和 `load-token-*` 认证桩，与生产 repository 逻辑各自演化，属于测试侧“第二套实现”。
严重等级：轻微
建议：复用 `@schedule/database` schema 与 API 入口构造测试数据，减少直写 SQL。

### 10. debug 阶段已标记的已知问题（报告内注明）

- 草稿过期提醒（设计 16.2）未实现：[project-status.md (line 107)](E:/AItools/Schedule/docs/project-status.md:107) 已标记“留待后续轮次”；代码中无对应实现。
- “只允许发布未来日期排班”未实现：[debug-feedback-log.md (line 660)](E:/AItools/Schedule/docs/debug/debug-feedback-log.md:660) 已标记；本次审查确认发布/生成入口仍缺校验（见 4.5）。
- CAM 密钥轮换 TODO：[project-status.md (line 89)](E:/AItools/Schedule/docs/project-status.md:89)、[production-readiness.md (line 52)](E:/AItools/Schedule/docs/deployment/production-readiness.md:52) 已标记为安全 TODO；属于运维残留，非代码。
- CloudBase 余额不足导致 `/api/health` 不可用：外部阻塞，已在状态文档登记。
- “Fastify 415”已在轮次 56 修复，但待办清单仍列为待排查（见 1.1，文档残留而非代码问题）。

### 11. 严重等级汇总

致命（0 项）：未发现会在当前部署路径上直接导致数据丢失或未授权访问的问题。

严重（6 项）：

1. 4.1 换班/加扣班服务复制粘贴（loadMembers/loadRoleNames）
2. 7.1 API 客户端 2200 行手写校验器 + 三个重复请求函数
3. 7.3 中国时区算法在 9 个文件重复
4. 3.1 starts_at 环境补丁散落 12 处且无注释
5. 3.2 日志/审计脱敏清单双份维护且已漂移
6. 4.5 发布/生成缺少“仅未来日期”限制（已知遗留）

轻微（约 20 项）：文档过期、死代码（事件链旧函数、NoopPushDispatcher、isUndefined、manual-adjustment 残留）、runner 默认分支、idempotency 宽 catch、CloudBase 惰性单例竞态、任务指标语义、迁移复制、工作区残留、配置声明缺失等，详见上文各模块。

### 12. 总体健康度评分

**6.5 / 10**

理由：架构分层清晰（contracts / database / domain / api / web）、类型与 lint 极严、420 个测试覆盖了大量事务与回归，Git 纪律良好，没有已提交密钥。但代码库存在明显的“赶进度妥协”痕迹：同类业务以复制粘贴演进（API 服务、前端校验器、时区工具），环境特判补丁散落且无注释，死代码与过期文档并存。这些问题不会立刻让系统崩溃，但每一次迭代都会放大维护成本，并已多次表现为“服务返回了无效资料”和线上数据漂移事故。

### 最值得优先修复的前 5 个问题

1. **统一成员/角色读取与工作流状态机**：把 swap/duty-adjustment/leave 三个服务共用的 `loadMembers`、`loadRoleNames`、冲突断言与事件/通知写入抽到共享层，消除“复制后微调参数”的最大源头。
2. **收敛 `starts_at` 环境补丁**：封装统一的 `shift_assignments` 更新助手并加注释与回归测试，防止线上时间戳漂移事故复发（轮次 10/13 事故的根因）。
3. **用生成/共享 schema 替换 client.ts 的 2200 行手写守卫**：从 contracts 派生运行时校验，消除前后端契约漂移导致的“无效资料”类问题。
4. **统一中国业务日期/时区工具**：删除 9 个文件里的重复常量与裸魔法数，全部走单一实现。
5. **清理死代码与过期文档**：删除事件时间线遗留函数/样式、`NoopPushDispatcher`、`isUndefined`、`manual-adjustment` 残留映射，修正 runner 默认分支与 debug 日志待办，让“不留残渣”原则真正落地。

## 4. 需要用户确认后再动手的问题

- #4.5：“仅未来日期发布”的精确规则（起始日=今天是否允许、跨已过月份的发布如何处理、与补录页边界）。
- #7.6：旧 `assignment_manually_updated` 事件的“调”标记是保留兼容还是彻底移除（移除需数据迁移方案）。
- #5.2：group-recycle 是否允许改成外键级联（影响历史数据与线上库结构）。

## 5. 轮次记录模板
轮次 N – YYYY-MM-DD

目标：#编号 一句话

修改文件：...

测试结果：xxx/xxx ✅ / ❌（失败详情）

提交：commit 短哈希 + 推送结果

不确定点：1–3 条（含“如果出错会表现为什么症状”）

下次计划：#编号

## 6. TODO（新发现问题登记处）

> 修复过程中发现的其他问题一律记在这里回报用户，不顺手改。初始为空。

- `past-schedule-service.ts`（259/387）与 `workflow-invalidation-service.ts`（143）对 `shift_assignments` 的更新未走统一助手、也未显式保留 `starts_at`。若线上 CynosDB 在迁移 0018 后仍存在隐式 `ON UPDATE`（可用 information_schema 复核），这 3 处是潜在时间漂移点；建议后续轮次评估并入 `updateShiftAssignments`。
- `apps/web/src/features/manual-schedule/manual-schedule-logic.ts`（143 行）仍裸写 `8 * 60 * 60 * 1000`，不在审查清单的 9 个文件内；`apps/web/src/features/leaves/leave-logic.ts` 的 `parseLocalDateStart` 用 `T00:00:00+08:00` 字面量表达同一“业务日期→中国零时 UTC”换算。建议后续轮次统一并入领域包（可复用 `toChinaStandardTimeUtcTimestamp`），本轮未动。

## 7. 轮次记录

### 轮次 1 – 2026-08-06

目标：#3.1 把散落在 5 个文件 12 处的 starts_at 保留补丁收敛为统一仓储助手。

修改文件：新增 `apps/api/src/modules/schedules/shift-assignment-writer.ts`；重构 `schedule-repository.ts`、`swap-service.ts`、`duty-adjustment-service.ts`、`leave-service.ts`、`membership-service.ts` 共 12 处调用；`schedule-repository.integration.test.ts` 新增锁定测试；同步更新 `docs/project-status.md` 与 `fix-progress.md`。

测试结果：`pnpm verify` 421/421 ✅（62 个测试文件，隔离 MySQL；含新增 1 条锁定测试）

提交：1f37298，推送成功（origin/main，5706c87..1f37298）

不确定点：
1. 本地/CI 的 MySQL 8.4 默认 `explicit_defaults_for_timestamp=ON`，锁定测试靠 ALTER 模拟线上 CynosDB 隐患；若线上库结构已完全无 ON UPDATE，该保留逻辑属于防御性收敛而非必须——出错症状是测试在模拟环境下失效，不会直接影响线上。
2. `updateShiftAssignments` 现在强制递增 version，与全部 12 处原行为一致；若未来出现“不递增版本”的批量更新，需要另行设计参数，否则版本号会多跳 1。
3. past-schedule 与 workflow-invalidation 的 3 处更新未纳入助手（见第 6 节 TODO），若线上 CynosDB 仍会隐式 ON UPDATE，这 3 处是残余漂移源；症状是补录/排班失效操作把 starts_at 改写为当前时间。

下次计划：#4.1（swap/duty 服务 loadMembers/loadRoleNames 复制收敛，先写锁定测试）

### 轮次 2 – 2026-08-06

目标：#4.1 把 swap/duty 两个服务复制的 loadMembers/loadRoleNames 收敛为共享 GroupMemberReader，差异字段用显式参数表达。

修改文件：新增 `apps/api/src/modules/groups/group-member-reader.ts`（共享成员/角色读取器）；新增 `group-member-reader.integration.test.ts`（4 条共享读取器测试）；重构 `swap-service.ts`、`duty-adjustment-service.ts`（删除私有 loadMembers/loadRoleNames 与重复成员行类型，全部调用点改用 `memberReader`，显式传 `{ autoAcceptSwapsDefault: 1 | 0 }`）；`swaps.integration.test.ts` 与 `duty-adjustments.integration.test.ts` 各新增 1 条“从未设置偏好”默认行为锁定测试；同步更新 `docs/project-status.md` 与 `fix-progress.md`。

测试结果：`pnpm verify` 427/427 ✅（63 个测试文件，隔离 MySQL；新增 6 条：2 条锁定 + 4 条共享读取器）

提交：da042b5，推送成功（origin/main，b3cddb1..da042b5）

不确定点：
1. `autoAcceptSwapsDefault` 语义（换班默认接受 1、加扣班默认不自动接受 0）是现有产品行为，已用共享参数显式表达并注释；若产品后续希望两流程默认一致，只改调用点参数即可——出错症状是“从未设置偏好”的成员自动接受状态与预期不符，但已有锁定测试兜底。
2. 共享读取器放在 `apps/api/src/modules/groups/` 下，与 `GroupPermissionService` 同模块；若后续 leave 服务也要读成员/角色，直接复用即可。
3. 新集成测试以裸 SQL 造数（沿用各测试文件的 `resetDatabase` 模式）；若未来 schema 字段变更，测试种子 SQL 需要同步——症状是该测试文件建数据失败，不影响生产代码。

下次计划：#7.3（中国时区算法在 9 个文件重复，抽单一工具后机械替换）

### 轮次 3 – 2026-08-06

目标：#7.3 把 9 个前端文件重复的中国时区算法收敛到 `@schedule/scheduling-domain`，统一替换全部调用点。

修改文件：`packages/scheduling-domain/src/time.ts`（导出唯一 `chinaStandardTimeOffsetMilliseconds` 与 `toChinaStandardTimeUtcTimestamp`，内部转换改走常量）与 `index.ts`；`time.test.ts` 新增 1 条 UTC 换算锁定测试；`apps/web/package.json` 新增 `@schedule/scheduling-domain` 依赖（含 pnpm-lock）；6 个 feature 逻辑文件删除各自重复常量并改为领域导入（`calendar-logic.ts` 的 `getCurrentBusinessMonth` 改为 re-export、`calendar-views.ts` 的 `getBusinessDate` 改为委托）；`StatisticsView.vue`/`ExportDialog.vue` 删除本地 `getCurrentCstMonth` 并改用 `getCurrentBusinessMonth`；`ManualScheduleView.vue` 零点刷新计算改用 `toChinaStandardTimeUtcTimestamp`；#8.2 的三个视图裸写随本轮一并处理；同步更新 `docs/project-status.md` 与 `fix-progress.md`。

测试结果：`pnpm verify` 428/428 ✅（63 个测试文件，隔离 MySQL；含新增 1 条领域换算测试）

提交：待填写

不确定点：
1. `@schedule/scheduling-domain` 的 dist 是 Vite 运行时解析路径（web 依赖包 exports），TS 走 tsconfig paths 指向 src；若未来只跑 `pnpm dev:web` 而未先构建领域包，浏览器会拿到旧 dist——症状是新增导出缺失导致页面构建报错。当前 `pnpm dev`/`verify` 都会先构建领域包，已覆盖。
2. `toChinaStandardTimeUtcTimestamp` 使用固定 +08:00 偏移（沿用领域包既有实现）；若未来引入历史夏令时等极端场景需重审，当前项目所有业务日期都按现代中国标准时间处理——出错症状是所有跨零点换算同时偏移 1 小时。
3. `calendar-logic.ts`/`calendar-views.ts` 保留薄包装（re-export/委托）以维持十余个 Vue 文件与测试的既有导入面；若后续希望彻底删除包装、所有调用点直连领域包，需再开一轮机械替换。

下次计划：#3.2（日志/审计脱敏清单双份维护，合并为共享脱敏模块）
