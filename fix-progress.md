# 修复进度与待完成清单（Web 1.0 合规审查后）

> 本文件由 2026-08-06 全库合规审查报告整理生成，是新对话的唯一切入点。
> 上一轮审查报告与每个问题的完整证据（文件、行号、描述）见对话记录；本文件只保留可执行清单。

## 0. 基线

- 分支：`main`，与 `origin/main` 同步，无已跟踪改动（用户未跟踪文件见下）。
- 当前测试基线：`pnpm verify` 451/451（68 个测试文件，隔离 MySQL，轮次 12 后）。
- 工作区原未跟踪的 `.dockerignore`、`docs/deployment/aliyun-ecs.md`、`infra/docker/*` 已于 2026-08-06 由用户提交 7de6d6e（阿里云 ECS Docker 部署）纳入仓库，不属于 fix-progress 轮次任务。
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
2. 理解目标：读本文件对应编号的问题描述，明确文件与预期行为；对“回归/修复”按上方“防回归约束”先定位引入点（`git log -S`/`git blame`）。
3. 制定方案：不超过 5 句话说明修改计划；涉及重构必须声明“行为等价”，并给出逐调用点语义审计结论。
4. 先写失败测试：能复现旧代码失败、或锁定新行为的测试先行（TDD）。
5. 执行修改：只改目标问题；**发现其他问题不要顺手改**，记入本文件“第 6 节 TODO（新发现）”回报。
6. 验证回归：`pnpm verify` 全通过；涉及核心链路（API client、认证/会话、路由、PWA/离线）追加 `pnpm smoke:browser` 浏览器冒烟验证，并把命令与结果写入本轮记录；提交前运行 `pnpm smoke:check-core`；测试失败时不得改测试来掩盖，要报告失败详情。
7. 更新本文件“轮次记录”，格式见第 5 节模板（含引入点、测试盲区、浏览器验证、状态三态）。
8. 回复末尾：列出本次最不确定的 1–3 个点（如果出错会表现为什么症状）。

### 硬性约束
- 禁止 `any` / `as any`；类型严格推导（现有 `as unknown as` 遗留按所属问题簇逐步清理）。
- 涉及环境变量：必须同步 `.env.example` 和相关文档。
- 涉及数据库迁移：修改前后跑迁移验证。
- 拿不定主意（多选/产品规则冲突）时停下来问用户，不要自作主张。

### 防回归约束（2026-08-07 轮次 57 教训后新增，适用于所有后续轮次）

背景：轮次 10（`dd9981f`）把 `fetchImplementation(url, init)` 收敛为 `options.fetchImplementation(url, init)`，改变了原生 fetch 的 `this` 接收者，浏览器直接抛 `Illegal invocation`；Node 单测不校验接收者，`pnpm verify` 全绿仍导致登录按钮无法进入页面。教训：**单测通过 ≠ 行为等价**，重构必须做语义等价审计 + 真实运行环境验证。

1. **定位引入点（回归必做）**：修改前对每个变更调用点执行 `git log -S '<关键表达式>' -- <文件>` 与 `git blame`，确认该行为从哪个提交/轮次开始；把引入点写入轮次记录。
2. **语义等价审计（重构必做）**：逐调用点对比修改前后的 `this`/接收者绑定（成员调用 vs 裸调用、bind/call/apply）、异步与错误路径（promise 拒绝、catch 范围）、空值语义（`??`/`||`/`?.`）、类型收窄与副作用/调用次数。只要任一项不同，该修改就不是“重构”，必须拆成独立提交，并按“测试先行”先写能复现旧代码失败的回归测试。
3. **先写失败测试再改**：回归测试必须在旧代码上失败、新代码上通过；不得用“改测试来掩盖”代替。
4. **真实运行环境验证（强制命令）**：涉及 API client、认证/会话、路由、PWA/离线等核心链路时，单测之外必须运行 `pnpm smoke:browser`（自动用无头 Edge/Chrome 走登录/管理员/成员/访客/工作台全流程并收集浏览器错误），并把命令与结果写入轮次记录；提交前必须运行 `pnpm smoke:check-core` 复核记录；未执行浏览器验证的轮次只能标“已实现待浏览器复核”，不得标“已完成”。
5. **完成状态三态口径**：`已实现待浏览器复核`（单测通过、缺运行验证）→ `已完成`（含浏览器/运行验证）→ `待用户复核`（需用户强刷/验收）。`docs/project-status.md` 与 debug 日志沿用同一口径，避免下一轮对话误判完成。
6. **提交前自查**：`git diff` 逐行过一遍，列出行为变化清单（哪怕“预期等价”也列出）；发现无关改动一律拆出或回退，不“顺手改”。
7. **记录必填项**：轮次记录与 debug 日志必须写明引入点、为什么现有测试没拦住（覆盖盲区）、验证命令与结果（含浏览器）、状态。

## 2. 待完成清单（按风险/收益比排序）

优先级说明：P0 = 用户点名且防数据损坏/事故复发；P1 = 收益高、风险可控或零风险；P2 = 收益中等；P3 = 低收益或需先确认产品决策。每个编号先做“锁定行为测试”，再重构。

| 优先级 | 编号 | 问题 | 原严重度 | 风险 | 收益 | 备注 |
|---|---|---|---|---|---|---|
| ✅ | #3.1 | starts_at 环境补丁散落 12 处 | 严重 | 中 | 极高（防线上数据损坏复发） | 已完成（轮次 1）：统一助手 + 锁定测试，见第 7 节 |
| ✅ | #4.1 | swap/duty 服务复制（loadMembers/loadRoleNames） | 严重 | 中 | 极高 | 已完成（轮次 2）：共享 GroupMemberReader + 锁定测试，见第 7 节 |
| ✅ | #7.3 | 中国时区算法在 9 个文件重复 | 严重 | 中低 | 高（时区事故反复出现） | 已完成（轮次 3）：统一到 scheduling-domain 并机械替换，见第 7 节 |
| ✅ | #3.2 | 日志/审计脱敏清单双份且已漂移 | 严重 | 低 | 高（安全控制） | 已完成（轮次 4）：合并为共享脱敏模块，见第 7 节 |
| ✅ | #1.1 | 文档过期/自相矛盾（待办、轮次、415） | 轻微 | 零 | 中 | 已完成（轮次 5）：重写待办/下一步与轮次表述，见第 7 节 |
| ✅ | #3.3 | 任务分派默认分支静默落到导出任务 | 轻微 | 极低 | 中 | 已完成（轮次 6）：`Record<JobName, Factory>` 穷举映射 + 锁定测试，见第 7 节 |
| ✅ | #3.4 | AUTH_DEV_MODE 无 NODE_ENV 防线 | 轻微 | 低 | 中（安全） | 已完成（轮次 7）：显式双条件 + env schema，见第 7 节 |
| ✅ | #7.5 | event-timeline 死代码（含 spec 续命） | 轻微 | 极低 | 中 | 已完成（轮次 8）：删函数/字段/样式并同步 spec，见第 7 节 |
| ✅ | #2.1 | ui-tokens CSS/TS 双份维护 | 严重 | 低 | 中高 | 已完成（轮次 9）：TS 单一来源 + 生成器 + 锁定测试，见第 7 节 |
| ✅ | #7.1 | client.ts 2200 行手写校验器 + 重复请求函数 | 严重 | 高 | 极高 | 已完成（轮次 12–22）：子步骤 1–3 全部完成，113 个读模型守卫替换为契约 schema，见第 7 节 |
| ✅ | #7.2 | 客户端错误码表与契约联合类型双份维护 | 轻微 | 低 | 中 | 已完成（轮次 11）：契约运行时列表单一来源 + 客户端锁定测试，见第 7 节 |
| ✅ | #7.4 | 前端 swap/duty 候选与 isFutureAssignment 重复 | 轻微 | 低 | 中 | 已完成（轮次 23）：合并共享 workflow 逻辑，见第 7 节 |
| ✅ | #8.1 | 15 个页面重复错误文案模板 | 轻微 | 低 | 中低 | 已完成（轮次 24）：抽共享 toUserMessage，见第 7 节 |
| ✅ | #8.2 | 视图层再次裸写时区/日期魔法数 | 轻微 | 零 | 中 | 已随 #7.3（轮次 3）一并替换为领域工具 |
| ✅ | #3.7 | 框架 4xx 全部归一化为 VALIDATION_FAILED | 轻微 | 低 | 中 | 已完成（轮次 25）：按状态码映射，见第 7 节 |
| ✅ | #4.2 | 冲突断言双轨（swap/duty 各自“预检 + 断言”） | 轻微 | 高 | 高 | 已完成（轮次 26）：统一为共享 `assertNoWorkflowConflicts`，见第 7 节 |
| P2 | #4.3 | 三服务“上帝对象”状态机 | 轻微 | 高 | 高 | 进行中（轮次 27：入口骨架已抽，swap/duty 13 个入口迁移；依赖容器/leave 待续） |
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
| ✅ | #1.2 | .env.example 缺开发模式开关 | 轻微 | 零 | 低 | 已完成（轮次 7）：随 #3.4 一并补两个开关项，见第 7 节 |
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

> 完成情况（轮次 5，2026-08-06）：已按当前代码与 Git 历史重写 `docs/debug/debug-feedback-log.md`“待办 / 下一步”与 `docs/project-status.md` 的轮次/批次表述；删除已解决条目（既往排班模块已实现、Fastify 415 已修复、上线迁移与部署状态更新），“仅未来日期发布”精确规则保留登记为 #4.5（需用户确认）；纯文档修改，`pnpm verify` 434/434 通过。本条目中的行号为审查时快照，修改后已过期。

**1.2 `.env.example` 缺少开发模式开关**
位置：[.env.example (line 1)](E:/AItools/Schedule/.env.example:1)（全文）；[.env (line 1)](E:/AItools/Schedule/.env:1)（gitignored）
原则：④部署一致
问题：本地 `.env` 使用 `AUTH_DEV_MODE=true` / `VITE_AUTH_DEV_MODE=true`，但 `.env.example` 没有任何说明，新环境无法复现本地开发配置；而 `AUTH_DEV_MODE` 又没有进后端 `env.ts` 的 schema（见 3.4），属于“只存在于运行时魔法字符串”的配置。
严重等级：轻微
建议：在 `.env.example` 补两个开关项，并在 `env.ts` 中用 `z.literal`/`z.enum` 声明它。
> 完成情况（轮次 7，2026-08-06）：已在 `.env.example` 补 `VITE_AUTH_DEV_MODE=false` / `AUTH_DEV_MODE=false` 两个开关项并注明本地专用、禁止上线；`docs/development/local-setup.md` 增加本地开发认证说明；后端 `AUTH_DEV_MODE` 已纳入 `env.ts` schema（见 3.4）。本条目中的行号为审查时快照，修改后已过期。

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
> 完成情况（轮次 9，2026-08-06）：已将 8 组令牌收敛为 `packages/ui-tokens/src/tokens.ts` 单一来源（含 `tokenGroups` 前缀/格式元数据），`src/index.ts` 改为显式 re-export（公共 API 不变）；新增 `scripts/generate-tokens-css.mjs` 从该来源生成 `tokens.css`（`pnpm tokens:generate`），并新增 `tokens-css.test.ts` 锁定“已提交 CSS 必须与生成器输出逐字节一致”；`pnpm verify` 440/440 通过。本条目中的行号为审查时快照，重构后已过期。

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
> 完成情况（轮次 4，2026-08-06）：已抽为 `apps/api/src/security/redact.ts` 的 `redactSensitiveFields` 共享模块，敏感字段清单合并双份差异（日志补上 `telephone`），`logRedactionPaths` 由同一清单派生；`app.ts` 与 `audit-writer.ts` 删除各自清单与递归实现；新增 6 条共享模块单元测试，并扩展日志（`telephone`）与审计（全字段）一致性测试；`pnpm verify` 434/434 通过。本条目中的行号为审查时快照，重构后已过期。

**3.3 任务分派默认分支静默落到导出任务**
位置：[runner.ts (line 38)](E:/AItools/Schedule/apps/api/src/jobs/runner.ts:38)（38–59 行）
原则：①不打补丁 ②代码自解释
问题：`JobName` 联合类型有 7 个值，if 链覆盖 6 个，最后一个 `return new ExportJobProcessor(client).run()` 作为“兜底”。未来新增任务类型时，忘记加分支会静默执行导出任务而不是报错。
严重等级：轻微
建议：改为 `switch` 穷举并在 `default` 抛错，或用映射表 `Record<JobName, Factory>`。
> 完成情况（轮次 6，2026-08-06）：已把 if 链 + 导出兜底改为 `Record<JobName, JobRunner>` 穷举映射表，新增 `JobName` 时 TypeScript 会在映射表强制补充分支，运行时不再存在静默兜底路径；`jobNames` 改为从映射表派生（单一运行时来源）；新增 `runner.spec.ts` 2 条“映射覆盖全部任务名、每个名字都有工厂”的锁定测试；`pnpm verify` 436/436 通过。本条目中的行号为审查时快照，重构后已过期。

**3.4 开发认证开关无环境防线**
位置：[runtime.ts (line 30)](E:/AItools/Schedule/apps/api/src/runtime.ts:30)（30–33 行）；[dev-auth.ts (line 1)](E:/AItools/Schedule/apps/api/src/adapters/auth/dev-auth.ts:1)
原则：④部署一致
问题：`process.env.AUTH_DEV_MODE === 'true'` 直接选择“任意 Bearer token 即身份”的认证端口，没有 `NODE_ENV !== 'production'` 防线，也没有 schema 校验。当前 CloudBase 网关路径恰好绕开了它，但这是一个“一旦重构路由就可能上线”的隐形后门。
严重等级：轻微
建议：显式加 `NODE_ENV === 'development'` 双条件，并把该变量纳入 `env.ts` 校验。
> 完成情况（轮次 7，2026-08-06）：已在 `env.ts` 的正式/测试 schema 增加 `AUTH_DEV_MODE: z.enum(['true', 'false']).default('false')`；`runtime.ts` 新增 `isDevAuthEnabled` 显式双条件（`NODE_ENV === 'development' && AUTH_DEV_MODE === 'true'`），`createRuntimeApp` 只读校验后的环境值，不再直接碰 `process.env`；新增 1 条 schema 严格布尔字符串校验 + 3 条防线锁定测试（缺省/关闭不开、production/test 即使开启也不开）；`pnpm verify` 440/440 通过。本条目中的行号为审查时快照，修改后已过期。

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
> 子步骤拆分（2026-08-06 轮次 10 补订；原“必须拆子步骤，见第 4 节”的引用在第 4 节无对应内容，以此处为准）：
> 1. ✅（轮次 10）把三个几乎相同的请求函数收敛为一个共享请求管道（`requestWithOnline` + `parseJsonResponse`/`parseTextResponse`），行为由 `client.test.ts` 26 条测试锁定。经复核，`isUndefined` 实际被 7 个响应守卫引用，并非死代码，审查快照已过期，不删除。
> 2. ✅（轮次 11）`ApiErrorCode` 联合类型改为由契约运行时列表 `apiErrorCodes` 派生；`knownApiErrorCodes` 直接引用该列表，`isApiErrorResponse` 删除 `as ApiErrorCode` 强转；#7.2 一并完成，新增 3 条锁定测试。
> 3. 从 `@schedule/contracts` 引入运行时 schema（zod），按读模型分批替换 113 个手写 `isX` 守卫；每批先写锁定测试再替换，禁止一次性大改；随守卫移除同步删除不再使用的 `isUndefined` 等死代码。
> 完成情况（子步骤 1，2026-08-06）：已删 `requestPublicJsonWithOnline`/`requestJsonWithOnline`/`requestTextWithOnline`，新增共享 `requestWithOnline`（统一离线检查、可选会话、网络错误与 fetch 发起）与 `parseJsonResponse`/`parseTextResponse`（JSON 校验/文本与错误解析），`createApiClient` 内新增 `requestPublicJson` 包装，4 个公开端点改用；新增 2 条锁定测试（公开请求不带 Authorization、文本下载 404 映射为类型化错误）；`pnpm verify` 442/442 通过。本条目中的行号为审查时快照，重构后已过期。
> 完成情况（子步骤 2，2026-08-06）：`packages/contracts/src/errors.ts` 新增运行时 `apiErrorCodes` 列表作为错误码唯一来源，`ApiErrorCode` 联合类型改为由它派生；`apps/web/src/api/client.ts` 的 `knownApiErrorCodes` 改为 `new Set(apiErrorCodes)`，删除本地字面量表与 `as ApiErrorCode` 强转；新增 3 条锁定测试（契约列表完整且无重复、全部错误码映射为类型化客户端错误、未知码回退通用 HTTP 文案）；`pnpm verify` 445/445 通过。本条目中的行号为审查时快照，重构后已过期。
> 完成情况（子步骤 3 · 批次 1，2026-08-07）：`packages/contracts` 新增 `zod` 依赖；`calendar.ts` 新增 `calendarChangeMarkerSchema`/`calendarDutyAssignmentSchema`/`calendarDutyMemberSchema`/`calendarRoleSummarySchema`/`calendarShiftTypeSummarySchema`/`calendarReadModelSchema`/`guestCalendarReadModelSchema`/`guestGroupSummarySchema`/`guestGroupSummaryListSchema` 9 个运行时 schema，8 个读模型类型改为由 schema 派生（约束与旧守卫一致：日期/月份/颜色/时间正则、非空字符串、整数 ≥1、枚举标记、可选字段、`passthrough()` 保留未知字段）；`apps/web/src/api/client.ts` 新增通用 `JsonSchema` + `isResponseBodyFromSchema` 桥接，`getCalendar`/`getSchedulePeriodCalendar`/`getGuestCalendar`/`getGuestGroupCalendar`/`listGuestGroups` 5 处调用点改用 schema，删除 `isCalendarReadModel`/`isGuestCalendarReadModel`/`isGuestGroupSummaryList`/`isCalendarDutyAssignment`/`isCalendarChangeMarker`/`isCalendarDutyMember`/`isCalendarRoleSummary`/`isCalendarShiftTypeSummary` 8 个手写守卫；`client.test.ts` 先新增 6 条锁定测试（未知变动标记、业务月份格式、空姓名、非法颜色、访客日历缺群名、访客群组列表缺名称）再替换，28 → 34 条；`pnpm verify` 451/451 通过。本条目中的行号为审查时快照，重构后已过期。

**7.2 客户端错误码表与契约联合类型双份维护**
位置：[client.ts (line 435)](E:/AItools/Schedule/apps/web/src/api/client.ts:435)（435–443 行）；[errors.ts (line 1)](E:/AItools/Schedule/packages/contracts/src/errors.ts:1)
原则：①不打补丁
问题：`knownApiErrorCodes` 用字面量重建了 `ApiErrorCode` 联合类型；契约新增错误码时，漏改这里会让合法错误被当成未知响应。
严重等级：轻微
建议：用 `z.enum`/运行时 schema 从 contracts 直接派生，或加一个编译期一致性测试。
> 完成情况（轮次 11，2026-08-06）：已改为从 `@schedule/contracts` 的 `apiErrorCodes` 运行时列表直接派生 `ApiErrorCode`，客户端 `knownApiErrorCodes` 不再重建字面量表，`isApiErrorResponse` 去掉强转；新增契约列表完整/无重复与客户端全码映射/未知码回退锁定测试共 3 条；`pnpm verify` 445/445 通过。本条目中的行号为审查时快照，重构后已过期。

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
> 完成情况（轮次 8，2026-08-06）：已删除 `getEventRelationLabel`/`buildSwapChainSummary`/`buildDutyAdjustmentChainSummary` 三个仅 spec 引用的导出与 `EventTimelineItem.isCorrection` 字段，`getEventMarker` 改为模块私有（`buildEventTimelineItems` 仍内部使用）；`EventTimeline.vue` 删除 `.entry-relation`/`.entry-relation.correction` 样式；`event-timeline.spec.ts` 删除对应导入与 2 条死代码测试，并用 `buildEventTimelineItems` 补 1 条日历标记映射测试保持行为覆盖；`pnpm verify` 439/439 通过。本条目中的行号为审查时快照，删除后已过期。

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
- “只允许发布未来日期排班”未实现：本次审查确认发布/生成入口仍缺校验（见 4.5，需用户确认规则）；debug 日志“待办 / 下一步”中的过期标注已随轮次 5（#1.1）清理。
- CAM 密钥轮换 TODO：[project-status.md (line 89)](E:/AItools/Schedule/docs/project-status.md:89)、[production-readiness.md (line 52)](E:/AItools/Schedule/docs/deployment/production-readiness.md:52) 已标记为安全 TODO；属于运维残留，非代码。
- CloudBase 余额不足导致 `/api/health` 不可用：外部阻塞，已在状态文档登记。
- “Fastify 415”已在轮次 56 修复；待办清单中的“待排查”残留已随轮次 5（#1.1）清理。

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

引入点（若为回归）：commit/轮次 + 一句话说明该行为如何被改变

为什么现有测试没拦住：覆盖盲区说明（如“Node 单测不校验浏览器原生 fetch 的接收者”）

修改文件：...

测试结果：xxx/xxx ✅ / ❌（失败详情）

运行/浏览器验证：命令 + 结果（未执行则状态=已实现待浏览器复核）

状态：已实现待浏览器复核 / 已完成 / 待用户复核

提交：commit 短哈希 + 推送结果

不确定点：1–3 条（含“如果出错会表现为什么症状”）

下次计划：#编号

## 6. TODO（新发现问题登记处）

> 修复过程中发现的其他问题一律记在这里回报用户，不顺手改。初始为空。

- `past-schedule-service.ts`（259/387）与 `workflow-invalidation-service.ts`（143）对 `shift_assignments` 的更新未走统一助手、也未显式保留 `starts_at`。若线上 CynosDB 在迁移 0018 后仍存在隐式 `ON UPDATE`（可用 information_schema 复核），这 3 处是潜在时间漂移点；建议后续轮次评估并入 `updateShiftAssignments`。
- `apps/web/src/features/manual-schedule/manual-schedule-logic.ts`（143 行）仍裸写 `8 * 60 * 60 * 1000`，不在审查清单的 9 个文件内；`apps/web/src/features/leaves/leave-logic.ts` 的 `parseLocalDateStart` 用 `T00:00:00+08:00` 字面量表达同一“业务日期→中国零时 UTC”换算。建议后续轮次统一并入领域包（可复用 `toChinaStandardTimeUtcTimestamp`），本轮未动。
- `.github/workflows/verify.yml` 把 `pnpm build` 与 `pnpm test` 并行启动，而 CI 是全新检出（dist 不入库），测试可能先于构建完成解析 `@schedule/database`/`@schedule/scheduling-domain` 等包入口而失败——2026-08-06 轮次 8/9 前后多个 Verify 失败的根因（`gh run view <id> --log-failed` 可复现，报 `Failed to resolve entry for package`）。建议后续轮次改为 build 完成后再启动 test；本轮未动。

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

提交：7a16c85，推送成功（origin/main，aaf955e..7a16c85）

不确定点：
1. `@schedule/scheduling-domain` 的 dist 是 Vite 运行时解析路径（web 依赖包 exports），TS 走 tsconfig paths 指向 src；若未来只跑 `pnpm dev:web` 而未先构建领域包，浏览器会拿到旧 dist——症状是新增导出缺失导致页面构建报错。当前 `pnpm dev`/`verify` 都会先构建领域包，已覆盖。
2. `toChinaStandardTimeUtcTimestamp` 使用固定 +08:00 偏移（沿用领域包既有实现）；若未来引入历史夏令时等极端场景需重审，当前项目所有业务日期都按现代中国标准时间处理——出错症状是所有跨零点换算同时偏移 1 小时。
3. `calendar-logic.ts`/`calendar-views.ts` 保留薄包装（re-export/委托）以维持十余个 Vue 文件与测试的既有导入面；若后续希望彻底删除包装、所有调用点直连领域包，需再开一轮机械替换。

下次计划：#3.2（日志/审计脱敏清单双份维护，合并为共享脱敏模块）

### 轮次 4 – 2026-08-06

目标：#3.2 把日志/审计两套敏感字段清单与脱敏实现合并为单一共享模块，消除清单漂移。

修改文件：新增 `apps/api/src/security/redact.ts`（唯一敏感字段清单 + `logRedactionPaths` + 递归脱敏）与 `redact.test.ts`（6 条单元测试）；`app.ts` 删除本地 `sensitiveLogFields`/`normalizeLogFieldName`/递归实现并改用共享模块；`audit-writer.ts` 删除本地 `sensitiveFields`/`redactValue`/`normalizeFieldName` 并改用共享模块；`app.test.ts` 日志测试补充 `telephone`；`events.integration.test.ts` 审计测试扩展到完整敏感字段并作为一致性测试；同步更新 `docs/project-status.md` 与 `fix-progress.md`。

测试结果：`pnpm verify` 434/434 ✅（64 个测试文件，隔离 MySQL；新增 6 条共享模块单元测试）

提交：207a4f9，推送结果见对话回复

不确定点：
1. 合并清单以审计侧为准补上 `telephone`，日志行为因此扩大脱敏范围（之前日志不会屏蔽 `telephone` 字段）；如果出错，症状是日志中 `telephone` 值不再出现，属于预期收紧。
2. 共享脱敏只递归普通对象/数组，非普通对象（如 Date）原样保留；若未来日志参数里出现需要脱敏的类实例字段，需要先序列化——症状是类实例内的敏感字段出现在日志中。
3. `logRedactionPaths` 仍限定 4 层以内的 Pino 静态路径，更深的嵌套由 `redactSensitiveFields` 兜底；若未来 Pino 输出链路绕过 logMethod 钩子，深层脱敏依赖不变。

下次计划：#1.1（文档过期/自相矛盾，以当前代码与 Git 历史为准重写待办/下一步）

### 轮次 5 – 2026-08-06

目标：#1.1 以当前代码与 Git 历史为准重写“待办 / 下一步”，删除已解决条目，消除文档自相矛盾。

修改文件：`docs/debug/debug-feedback-log.md`（重写“待办 / 下一步”：删除“原规划仍待处理：只允许发布未来日期排班，以及既往排班模块”与“Fastify 415 待排查”，上线状态改为“迁移 0026–0031 与部署已执行、仅剩 CloudBase 余额阻塞”，既往排班模块标注已完成，“仅未来日期发布”转登记 #4.5）；`docs/project-status.md`（轮次 1–49 → 1–56，Current Position/Active Batch/下一步更新为轮次 5 完成、轮次 6 目标 #3.3）；`fix-progress.md`（#1.1 标记完成并补完成情况）。

测试结果：`pnpm verify` 434/434 ✅（64 个测试文件，隔离 MySQL；纯文档修改，回归通过）

提交：205d08a，推送结果见对话回复

不确定点：
1. “只允许发布未来日期排班”并未断言为已实现：当前实现是模板应用/重排从今天起、已过日期移入既往并锁定；发布入口的“仅未来日期”精确规则仍留在 #4.5 等用户确认（今天能否发布、跨已过月份行为）——若用户误以为此规则已完成，症状是发布含既往日期的排班时仍会按既往锁定处理而非直接拒绝。
2. 待办清单中的“用户强刷后复核”条目全部保留，未做任何判断；这些是等待用户验收项，若用户已验收，后续轮次按反馈收敛。

下次计划：#3.3（任务分派默认分支静默落到导出任务，switch 穷举 + default 抛错）

### 轮次 6 – 2026-08-06

目标：#3.3 把任务分派的 if 链 + 导出兜底改为 `Record<JobName, Factory>` 穷举映射，消除“新任务名被静默当作导出任务执行”的路径。

修改文件：`apps/api/src/jobs/runner.ts`（`jobRunners` 穷举映射表：7 个 `JobName` 各自对应处理器工厂，新增任务名时 TypeScript 强制补充分支；`jobNames` 改为从映射表派生，删除手写重复数组；`runJob` 只做映射查找，删除静默兜底）；新增 `apps/api/src/jobs/runner.spec.ts`（2 条锁定测试：映射键与 `jobNames` 完全一致、每个任务名都有工厂函数）；同步更新 `docs/project-status.md` 与 `fix-progress.md`。

测试结果：`pnpm verify` 436/436 ✅（65 个测试文件，隔离 MySQL；新增 2 条分派映射锁定测试）

提交：8d54076，推送结果见对话回复

不确定点：
1. 采用审计建议中的“映射表”方案而非 switch+default：编译期由 `Record<JobName, JobRunner>` 保证穷举，若未来绕过类型系统（如把字符串强转后传入），会以 `undefined is not a function` 快速失败而不是静默跑导出任务——症状是任务直接报错而非产生错误导出。
2. `jobNames` 现在是 `Object.keys(jobRunners)` 派生数组，顺序与映射表插入顺序一致；若未来平台管理页依赖 `jobNames` 顺序，需以映射表顺序为准。
3. 映射工厂在 `runJob` 调用时才构造处理器（与旧 if 链一致，惰性构造不变）；新增需要不同构造参数的任务时，只需扩展 `JobRunner` 签名与该任务的分支。

下次计划：#3.4（AUTH_DEV_MODE 无 NODE_ENV 防线，显式双条件 + env schema；`#1.2` 的 `.env.example` 开发模式开关随本轮一并做）

### 轮次 7 – 2026-08-06

目标：#3.4 给 AUTH_DEV_MODE 加 `NODE_ENV=development` 显式防线并纳入 env schema；随带 #1.2 补 `.env.example` 开发模式开关。

修改文件：`apps/api/src/config/env.ts`（`environmentSchema`/`testEnvironmentSchema` 新增 `AUTH_DEV_MODE: z.enum(['true', 'false']).default('false')`，测试分支同步返回）；`apps/api/src/runtime.ts`（新增 `isDevAuthEnabled` 纯函数：`NODE_ENV === 'development' && AUTH_DEV_MODE === 'true'`，替换裸 `process.env` 检查）；新增 `apps/api/src/runtime.spec.ts`（3 条防线锁定测试：development+true 开启、缺省/关闭不开、production/test 即使开启也不开）；`apps/api/src/config/env.test.ts`（新增 1 条 schema 严格布尔字符串校验）；`.env.example`（补 `VITE_AUTH_DEV_MODE=false`/`AUTH_DEV_MODE=false` 并注明本地专用、禁止上线）；`docs/development/local-setup.md`（新增本地开发认证说明）；同步更新 `docs/project-status.md` 与 `fix-progress.md`。

测试结果：`pnpm verify` 440/440 ✅（66 个测试文件，隔离 MySQL；新增 4 条：1 条 env schema + 3 条防线）

提交：3ab05a6，推送结果见对话回复

不确定点：
1. 防线采用审计建议的严格 `NODE_ENV === 'development'`（而非 `!== 'production'`）：若未来需要在 `NODE_ENV=test` 的本地验收进程里使用开发认证，需要显式放开——出错症状是 test 模式下本地登录按钮仍出现但 API 返回 401（被 CloudBase 认证端口拒绝）。
2. `AUTH_DEV_MODE` 已进入 `testEnvironmentSchema` 且默认 false：测试进程即使误设 true 也不会启用开发认证，符合防线语义；若未来测试需要它，需改防线本身。
3. `.env.example` 仅作文档/模板，Vite 与 API 只读 `.env`；新环境从模板复制后不会自动获得 true 开关——出错症状是新本地环境没有“本地管理员/本地成员”按钮，属预期默认安全。

下次计划：#7.5（event-timeline 死代码，删函数/字段/样式并同步 spec）

### 轮次 8 – 2026-08-06

目标：#7.5 删除 event-timeline 中仅被 spec 引用的死函数/字段/样式，同步改写 spec。

修改文件：`apps/web/src/features/events/event-timeline.ts`（删除 `getEventRelationLabel`、`buildSwapChainSummary`、`buildDutyAdjustmentChainSummary` 三个导出与 `EventTimelineItem.isCorrection` 字段；`getEventMarker` 改为模块私有，仅 `buildEventTimelineItems` 内部使用）；`EventTimeline.vue`（删除未使用的 `.entry-relation`/`.entry-relation.correction` 样式）；`event-timeline.spec.ts`（删除对应导入与 2 条死代码测试，新增 1 条经 `buildEventTimelineItems` 的标记映射测试保持行为覆盖）；同步更新 `docs/project-status.md` 与 `fix-progress.md`。

测试结果：`pnpm verify` 439/439 ✅（66 个测试文件，隔离 MySQL；事件时间线 spec 16 → 15 条：删 2 条 + 加 1 条标记映射）

提交：22f1434，推送结果见对话回复

不确定点：
1. `getEventMarker` 保留为模块私有函数，因为 `buildEventTimelineItems` 仍在生产路径使用；若未来需要独立于时间线的标记查询，需重新导出——出错症状是其他模块无法直接获取标记映射（编译期可见）。
2. 删除 `buildSwapChainSummary`/`buildDutyAdjustmentChainSummary` 后，合并链 `buildChangeChainSummary` 保留（生产“人员变更链”折叠区在用），其内部复用的两个提取助手不受影响——出错症状是合并链行为不变，纯删除不改语义。
3. 测试总数从 440 减到 439 是预期净减（删 2 条死代码测试 + 加 1 条替代测试）；若用户预期测试数只增不减，这是行为覆盖保持下的有意收缩。

下次计划：#2.1（ui-tokens CSS/TS 双份维护，单一来源生成）

### 轮次 9 – 2026-08-06

目标：#2.1 把 ui-tokens 的 CSS/TS 双份令牌收敛为单一来源，`tokens.css` 改为生成物并加锁定测试。

修改文件：新增 `packages/ui-tokens/src/tokens.ts`（8 组令牌唯一来源 + `tokenGroups` 前缀/格式元数据）；`src/index.ts` 改为从 `tokens.ts` 显式 re-export（公共 API 不变）；新增 `packages/ui-tokens/scripts/generate-tokens-css.mjs` 与包脚本 `generate`/根脚本 `tokens:generate`；新增 `src/tokens-css.test.ts`（1 条锁定测试：已提交 `tokens.css` 必须与生成器 `--stdout` 输出逐字节一致）；`tokens.css` 由生成器重写（仅补一处组间空行，全部值不变）；同步更新 `docs/project-status.md` 与 `fix-progress.md`。

测试结果：`pnpm verify` 440/440 ✅（66 个测试文件，隔离 MySQL；新增 1 条生成锁定测试）

提交：28f6987，推送成功（origin/main，5488ab9..28f6987）

不确定点：
1. 生成器用 Node 24 原生 TS 类型剥离导入 `tokens.ts`（.mjs → .ts），CI 已固定 Node 24 且本地验证通过；若未来 Node 版本下调或类型剥离行为变化，生成器会直接报错——症状是 `tokens:generate` 与锁定测试失败。
2. `tokens.css` 是入库生成物，修改令牌后必须重跑 `pnpm tokens:generate`；锁定测试会在忘记重跑时失败——症状是 verify 中 `tokens-css.test.ts` 失败。
3. 令牌组顺序/前缀/格式元数据集中在 `tokens.ts` 的 `tokenGroups`；新增令牌组若漏登记到该表，CSS 不会自动包含它，而现有锁定测试只对比“已登记组”的输出——症状是新增令牌只在 TS 可用、对应 CSS 变量缺失。

下次计划：#7.1（client.ts 2200 行手写校验器 + 重复请求函数，P2 高风险高收益，按第 4 节拆子步骤）

### 轮次 10 – 2026-08-06

目标：#7.1 子步骤 1 —— 把 client.ts 三个几乎相同的请求函数收敛为一个共享请求管道，消除复制粘贴样板。

修改文件：`apps/web/src/api/client.ts`（新增 `requestWithOnline`：统一离线检查、可选会话获取、网络错误与 fetch 发起；新增 `parseJsonResponse`/`parseTextResponse`：JSON 校验/文本与错误解析；删除 `requestPublicJsonWithOnline`/`requestJsonWithOnline`/`requestTextWithOnline` 三个复制函数；`createApiClient` 内新增 `requestPublicJson` 包装，`listGuestGroups`/`getGuestCalendar`/`getGuestGroupCalendar`/`getGuestHolidays` 4 个公开端点改用；`isUndefined` 经复核被 7 个守卫使用，非死代码，未删）；`apps/web/src/api/client.test.ts`（新增 2 条锁定测试：公开请求不带 Authorization / 认证文本下载带 token；文本下载 404 错误体映射为 `ApiClientError`）；同步更新 `docs/project-status.md` 与 `fix-progress.md`（补订 #7.1 子步骤拆分并纠正 `isUndefined` 死代码结论）。

测试结果：`pnpm verify` 442/442 ✅（67 个测试文件，隔离 MySQL；`client.test.ts` 24 → 26 条）

提交：dd9981f，推送结果见对话回复

不确定点：
1. `requestWithOnline` 合并了公开/认证两条请求路径，错误与校验顺序沿用原实现（先读 body、非 2xx 先抛错误、再校验）；若后续有人调整 `parseJsonResponse` 顺序（先校验后判错），公开端点 4xx 会变成“服务返回了无效资料”——症状是公开错误提示丢失原始错误码。
2. 文本下载错误映射依赖错误体包含 `requestId`（`isApiErrorResponse` 既有契约），测试按真实错误体补 `requestId`；若未来错误响应缺 `requestId`，文本下载错误会回退通用 HTTP 文案——症状是 404 显示“服务暂时不可用”而非具体原因，属既有行为非本轮引入。
3. `isUndefined` 在审查快照中标注为“从未使用”，但当前 7 处响应守卫引用它；本轮未删除以免破坏编译，待子步骤 3 引入 schema 后随守卫移除一并清理。

下次计划：#7.1 子步骤 2（`knownApiErrorCodes`/`isApiErrorResponse` 与契约错误码单一来源，随带评估 #7.2）

### 轮次 11 – 2026-08-06

目标：#7.1 子步骤 2（随带 #7.2）—— 把客户端 `knownApiErrorCodes`/`isApiErrorResponse` 与契约错误码收敛为单一来源，消除双份字面量表。

修改文件：`packages/contracts/src/errors.ts`（新增运行时 `apiErrorCodes` 列表作为错误码唯一来源，`ApiErrorCode` 联合类型改为由它派生）；新增 `packages/contracts/src/errors.test.ts`（1 条契约列表完整且无重复锁定测试）；`apps/web/src/api/client.ts`（`knownApiErrorCodes` 改为 `new Set(apiErrorCodes)`，删除本地字面量表与 `as ApiErrorCode` 强转）；`apps/web/src/api/client.test.ts`（新增 2 条：全部契约错误码映射为类型化客户端错误、未知码回退通用 HTTP 文案；26 → 28 条）；同步更新 `docs/project-status.md` 与 `fix-progress.md`。

测试结果：`pnpm verify` 445/445 ✅（68 个测试文件，隔离 MySQL；新增 3 条：contracts 1 条 + client 2 条）

提交：5ba3993，推送结果见对话回复

备注：本轮开始时仓库存在用户本地提交 7de6d6e（阿里云 ECS Docker 部署配置与文档，含 project-status 的 Deployment 段），非本轮任务，保留并在本轮推送时一并上传。

不确定点：
1. `apiErrorCodes` 以 `as const` 数组导出，运行时仍是可变数组；若未来有代码误 push 进新值，契约与客户端会同时漂移，但 `errors.test.ts` 的完整列表断言会在 CI 失败——症状是新增错误码必须先过测试才能入库。
2. 客户端 `knownApiErrorCodes` 改为 `Set<string>` 后行为与旧 `Set<ApiErrorCode>` 完全一致；契约新增错误码后客户端无需任何改动即自动识别——症状是新增合法错误码被正确映射为类型化错误，而非回退通用 HTTP 文案。
3. `ApiErrorCode` 由显式联合改为数组派生，类型值完全一致，API 层 `error-handler.ts` 仅用类型不受影响；若未来需要给错误码附加元数据（如 HTTP 状态映射），可在此单一来源扩展。

下次计划：#7.1 子步骤 3（从 `@schedule/contracts` 引入运行时 schema，按读模型分批替换 113 个手写 `isX` 守卫；每批先写锁定测试再替换，禁止一次性大改）

### 轮次 12 – 2026-08-07

目标：#7.1 子步骤 3 批次 1 —— 从 `@schedule/contracts` 引入 zod 运行时 schema，把日历读模型族 8 个手写 `isX` 守卫替换为 schema 解析；先写锁定测试再替换。

修改文件：`packages/contracts/package.json`（新增 `zod` 依赖）；`packages/contracts/src/calendar.ts`（新增 9 个 schema：`calendarChangeMarkerSchema`/`calendarDutyAssignmentSchema`/`calendarDutyMemberSchema`/`calendarRoleSummarySchema`/`calendarShiftTypeSummarySchema`/`calendarReadModelSchema`/`guestCalendarReadModelSchema`/`guestGroupSummarySchema`/`guestGroupSummaryListSchema`，8 个读模型类型改为由 schema 派生，约束与旧守卫一致：日期/月份/颜色/时间正则、非空字符串、整数 ≥1、枚举标记、可选字段、`passthrough()` 保留未知字段）；`apps/web/src/api/client.ts`（新增通用 `JsonSchema` + `isResponseBodyFromSchema` 桥接，`getCalendar`/`getSchedulePeriodCalendar`/`getGuestCalendar`/`getGuestGroupCalendar`/`listGuestGroups` 5 处调用点改用 schema，删除 `isCalendarReadModel`/`isGuestCalendarReadModel`/`isGuestGroupSummaryList`/`isCalendarDutyAssignment`/`isCalendarChangeMarker`/`isCalendarDutyMember`/`isCalendarRoleSummary`/`isCalendarShiftTypeSummary` 8 个手写守卫）；`apps/web/src/api/client.test.ts`（先新增 6 条锁定测试再替换：未知变动标记、业务月份格式、空姓名、非法颜色、访客日历缺群名、访客群组列表缺名称；28 → 34 条）；`pnpm-lock.yaml`（pnpm 11 重排 + contracts importer 新增 zod）；同步更新 `docs/project-status.md` 与 `fix-progress.md`。

测试结果：`pnpm verify` 451/451 ✅（68 个测试文件，隔离 MySQL；新增 6 条 client 锁定测试）

提交：32cc513，推送结果见对话回复

不确定点：
1. schema 使用 `passthrough()` 保留未知字段，与旧守卫“不拒绝额外字段”一致；若未来要捕获契约漂移（API 新增字段而 schema 未同步），需要改为默认 strip 或 strict 并显式断言——症状是未知字段继续透传而非报“服务返回了无效资料”。
2. 日历读模型类型由 `z.infer` 派生（接口 → 类型别名），结构兼容且 API/Web 类型检查均通过；若未来有代码依赖“接口可声明合并”，需要改用 `z.interface()` 或保留显式接口——症状是扩展同名接口时报 TS 重复标识符错误。
3. `isUndefined` 仍被 7 个非日历守卫引用，本轮未删除；后续批次替换完对应守卫后一并清理——症状是死代码留存但不破坏编译。

下次计划：#7.1 子步骤 3 批次 2（holidays 读模型：`isHolidayReadModel`/`isConfirmedHolidayDate` 先写锁定测试再替换；随后按读模型族推进 groups/membership、schedules、swaps/duty 等剩余守卫）

### 轮次 13 – 2026-08-07

目标：#7.1 子步骤 3 批次 2 —— 从 `@schedule/contracts` 引入 zod 运行时 schema，把 holidays 读模型手写守卫替换为 schema 解析；先写锁定测试再替换。

修改文件：`packages/contracts/src/holidays.ts`（新增 `confirmedHolidayDateSchema`/`holidayReadModelSchema` 2 个 schema，`ConfirmedHolidayDate`/`HolidayReadModel` 类型改为由 schema 派生，约束与旧守卫一致：布尔/整数/字符串字段，`passthrough()` 保留未知字段；旧守卫只查 `typeof string`，故日期与名称不额外加格式/非空限制）；`apps/web/src/api/client.ts`（`getHolidays`/`getGuestHolidays` 2 处调用点改用 `isResponseBodyFromSchema(holidayReadModelSchema)`，删除 `isHolidayReadModel` 手写守卫）；`apps/web/src/api/client.test.ts`（先新增 7 条锁定测试再替换：未知字段透传、非整数 year、confirmed 非布尔、缺 dates 数组、日期条目缺 holidayName、isOffDay 非布尔、date 非字符串；34 → 41 条）；同步更新 `docs/project-status.md` 与 `fix-progress.md`。

测试结果：`pnpm verify` 458/458 ✅（68 个测试文件，隔离 MySQL；新增 7 条 client 锁定测试）

提交：0c352f1，推送结果见对话回复

不确定点：
1. 旧守卫只校验字段类型不校验内容，schema 因此对 `date`/`holidayName` 仅用 `z.string()` 不加格式/非空约束——若未来想让非法日期格式在客户端直接暴露，需另加 regex，出错症状是格式异常的日期仍能通过读模型。
2. `isConfirmedHolidayDate` 没有独立守卫（校验内嵌于 `isHolidayReadModel.dates.every`），本轮按实际代码以 `confirmedHolidayDateSchema` 收敛内嵌校验，未产生额外导出守卫。
3. `passthrough()` 保留未知字段与旧守卫一致；若未来要捕获 API 契约漂移，需改为 strip/strict 并显式断言——症状是未知字段继续透传而非报“服务返回了无效资料”。

下次计划：#7.1 子步骤 3 批次 3（groups/membership 读模型：按读模型族先写锁定测试再替换剩余 `isX` 守卫；随后推进 schedules、swaps/duty 等）

### 轮次 14 – 2026-08-07

目标：#7.1 子步骤 3 批次 3 —— 从 `@schedule/contracts` 引入 zod 运行时 schema，把 groups/membership 读模型族 15 个手写守卫替换为 schema 解析；先写锁定测试再替换。

修改文件：`packages/contracts/src/groups.ts`（新增 `groupRoleSchema` 与 `groupSummarySchema`/`addRosterEntriesResponseSchema`/`convertPendingRosterResponseSchema`/`claimGroupResponseSchema`/`groupMemberSchema`/`membershipClaimLookupEntrySchema`/`membershipClaimLookupResponseSchema`/`membershipClaimRequestSchema`/`membershipClaimRequestListSchema`/`createMembershipClaimResponseSchema`/`groupMemberContactSchema`/`groupMemberContactListSchema`/`groupMemberListSchema`/`groupSummaryListSchema`，11 个读模型类型改为由 schema 派生；`claimGroupResponseSchema` 的 `request_created` 分支用 `.strict()` 保持旧守卫“仅 status 一个键”的精确检查，`membershipClaimRequestSchema.status` 用 `z.custom<MembershipClaimRequestStatus>` 保持“任意字符串通过”的旧行为同时保留枚举类型）；`packages/contracts/src/schedules.ts`（新增 `groupSchedulePublishModeSchema`，`GroupSchedulePublishMode` 类型改为派生）；`apps/web/src/api/client.ts`（16 处调用点改用 `isResponseBodyFromSchema`，删除 `isGroupSummary`/`isGroupSummaryList`/`isAddRosterEntriesResponse`/`isConvertPendingRosterResponse`/`isClaimGroupResponse`/`isMembershipClaimLookupEntry`/`isMembershipClaimLookupResponse`/`isMembershipClaimRequest`/`isMembershipClaimRequestList`/`isCreateMembershipClaimResponse`/`isGroupMember`/`isGroupMemberContact`/`isGroupMemberContactList`/`isGroupMemberList`/`isGroupSchedulePublishMode` 15 个手写守卫）；`apps/web/src/api/client.test.ts`（先新增 14 条锁定测试再替换：非正 added、负 skipped、claimed 缺 group、认领查询非法角色、未知 status 放行、非数字 version、direct 响应带 request、非 direct 响应缺 request、成员可选字段、空 realName、负版本联系方式、非法群组码、未知角色、未知发布模式；41 → 55 条）；同步更新 `docs/project-status.md` 与 `fix-progress.md`。

测试结果：`pnpm verify` 472/472 ✅（68 个测试文件，隔离 MySQL；新增 14 条 client 锁定测试）

提交：5b590a3，推送结果见对话回复

不确定点：
1. `membershipClaimRequestSchema.status` 用 `z.custom<MembershipClaimRequestStatus>` 保持旧守卫“仅校验字符串”的行为，导出类型仍为枚举；若未来想收紧为运行时枚举校验，需改成 `z.enum`——出错症状是未知状态仍能通过读模型（与旧行为一致）。
2. `claimGroupResponseSchema` 的 `request_created` 分支用 `.strict()` 复刻旧守卫“仅 status 一个键”的精确检查，`claimed` 分支 `passthrough()` 允许额外字段；若 API 未来给 `request_created` 响应增加字段，客户端会开始拒绝——症状是认领返回“服务返回了无效资料”。
3. 除 status 外的类型均由 `z.infer` 派生，`passthrough()` 使派生类型带 `[x: string]: unknown` 索引签名，构造侧更宽松；若未来要捕获契约漂移需改 strip/strict——症状是未知字段继续透传而非报“服务返回了无效资料”。

下次计划：#7.1 子步骤 3 批次 4（scheduling-config 读模型：`isSchedulingConfig`/`isScheduleRole`/`isScheduleRoleMember`/`isRotationRule`/`isShiftType`/`isSchedulingGroupMember` 先写锁定测试再替换；随后推进 schedules/past-schedules、swaps/duty 等）

### 轮次 15 – 2026-08-07

目标：#7.1 子步骤 3 批次 4 —— 从 `@schedule/contracts` 引入 zod 运行时 schema，把 scheduling-config 读模型族 6 个手写守卫替换为 schema 解析；先写锁定测试再替换。

修改文件：`packages/contracts/src/scheduling-config.ts`（新增 `schedulingGroupMemberSchema`/`scheduleRoleMemberSchema`/`rotationRuleSchema`/`scheduleRoleSchema`/`shiftTypeSchema`/`schedulingConfigSchema` 6 个 schema，6 个读模型类型改为由 schema 派生，约束与旧守卫一致：非空字符串、整数、position/currentPosition/requiredMembersPerDay ≥1、颜色/时间正则、可选 startDate/startTime/endTime、`passthrough()`；`rulesVersion` 因旧守卫不校验而用 `z.custom<number>(() => true).optional()` 保持缺省/任意值放行，导出类型用交叉类型保持必填 number）；`apps/web/src/api/client.ts`（`createScheduleRole`/`createShiftType`/`getSchedulingConfig`/`reorderRotationMembers`/`replaceScheduleRoleMembers`/`updateRotationRule`/`updateShiftType` 7 处调用点改用 schema，删除 `isScheduleRole`/`isScheduleRoleMember`/`isRotationRule`/`isSchedulingConfig`/`isSchedulingGroupMember`/`isShiftType` 6 个手写守卫；`getSchedulingConfig` 用 `isSchedulingConfigResponse` 轻量谓词包装，使 schema 允许缺省 rulesVersion 而导出类型保持必填）；`apps/web/src/api/client.test.ts`（先新增 8 条锁定测试再替换：缺 rulesVersion 放行、roles 非数组、组员空姓名、角色非整数 version、成员 position 0、轮值 requiredMembersPerDay 0、班种非法颜色、班种非法 startTime；55 → 63 条）；同步更新 `docs/project-status.md` 与 `fix-progress.md`。

测试结果：`pnpm verify` 480/480 ✅（68 个测试文件，隔离 MySQL；新增 8 条 client 锁定测试）

提交：57c43b7，推送结果见对话回复

不确定点：
1. `rulesVersion` 用 `z.custom<number>(() => true).optional()` 保持旧守卫“完全不校验”的宽松行为，导出类型仍为必填 number；若未来想真正校验该字段，需改成 `z.number().int()`——出错症状是缺省或异常 rulesVersion 仍能通过读模型（与旧行为一致）。
2. `getSchedulingConfig` 使用 `isSchedulingConfigResponse` 类型谓词包装 schema，因为 schema 推断类型允许缺省 rulesVersion 而导出类型要求必填；若未来 schema 改为必填，可删掉包装直接使用 `isResponseBodyFromSchema`。
3. 派生类型带 `passthrough()` 索引签名，构造侧更宽松；若未来要捕获契约漂移需改 strip/strict——症状是未知字段继续透传而非报“服务返回了无效资料”。

下次计划：#7.1 子步骤 3 批次 5（schedules/past-schedules 读模型：`isSchedulePeriodSummary`/`isScheduleDraftSummary`/`isScheduleDraftSummaryList`/`isSchedulePeriodHistoryItem`/`isSchedulePeriodHistoryItemList`/`isPastSchedulePeriod`/`isPastSchedulePeriodList`/`isPastScheduleAssignment`/`isPastScheduleAssignmentList`/`isPastScheduleBackfillRecord` 等先写锁定测试再替换；随后推进 swaps/duty 等）

### 轮次 16 – 2026-08-07

目标：#7.1 子步骤 3 批次 5 —— 从 `@schedule/contracts` 引入 zod 运行时 schema，把 schedules/past-schedules 读模型族 18 个手写守卫替换为 schema 解析；先写锁定测试再替换。

修改文件：`packages/contracts/src/schedules.ts`（新增 `schedulePreviewAssignmentSchema`/`schedulePeriodSummarySchema`/`scheduleDraftSummarySchema`（+List）/`schedulePeriodHistoryItemSchema`（+List）/`scheduleWorkflowImpactSchema`/`scheduleChangeImpactPreviewSchema`/`scheduleGenerationPreviewSchema`/`schedulePeriodMutationResultSchema`/`publishSchedulePeriodBatchResultSchema`/`publishSchedulePeriodResultSchema`，8 个读模型类型改为 schema 派生或显式契约别名；旧守卫忽略的必填字段用 `z.custom(...).optional()` 保持宽松、导出类型保留必填；嵌套数组用 `z.readonly` 保持接口 readonly 语义）；`packages/contracts/src/past-schedules.ts`（新增 `pastSchedulePeriodSchema`（+List）/`pastScheduleAssignmentSchema`（+List）/`pastScheduleBackfillRecordSchema`（+List）/`updatePastScheduleAssignmentResultSchema`，4 个读模型类型由 schema 派生）；`apps/web/src/api/client.ts`（12 处调用点改用 schema：7 处 `isResponseBodyFromSchema`、5 处新增 `isResponseBodyMatching<T>` 类型化桥接；删除 `isSchedulePeriodSummary`/`isScheduleDraftSummaryList`/`isSchedulePeriodHistoryItemList`/`isPastSchedulePeriodList`/`isPastSchedulePeriod`/`isPastScheduleAssignmentList`/`isPastScheduleBackfillRecordList`/`isPastScheduleBackfillRecord`/`isPastScheduleAssignment`/`isUpdatePastScheduleAssignmentResult`/`isSchedulePeriodHistoryItem`/`isScheduleGenerationPreview`/`isScheduleDraftSummary`/`isPublishSchedulePeriodResult`/`isScheduleWorkflowImpact`/`isScheduleChangeImpactPreview`/`isSchedulePeriodMutationResult`/`isPublishSchedulePeriodBatchResult` 18 个手写守卫；`isAppliedManualScheduleTemplateResult` 复用 `schedulePeriodSummarySchema` 校验 periods，避免保留重复助手）；`apps/web/src/api/client.test.ts`（先新增 12 条锁定测试再替换：草稿缺未校验字段放行、非整数 revision、历史未知状态、预览 scheduleRoleIds 非数组、变更预览未知 action、发布结果 workflowImpacts 非数组、批量发布 period status 空、变更结果 period 缺 id、既往期间月份格式、既往班次 slotPosition 非整数、补录日期格式、更新结果 eventId 空；63 → 75 条）；同步更新 `docs/project-status.md` 与 `fix-progress.md`。

测试结果：`pnpm verify` 492/492 ✅（68 个测试文件，隔离 MySQL；新增 12 条 client 锁定测试）

提交：1c7d1fb，推送结果见对话回复

不确定点：
1. `publishSchedulePeriodResultSchema` 的 preview 复用完整 `scheduleGenerationPreviewSchema`，而旧 publish 守卫只检查 preview 的 businessMonth 为字符串与 statistics 为对象——若未来 API 在 publish 结果里返回不完整 preview，客户端会比旧版更早拒绝。
2. `SchedulePeriodSummary`/`ScheduleGenerationPreview` 等“旧守卫忽略必填字段”的类型使用显式契约别名而非 `z.infer`，schema 只校验旧检查过的字段；若未来想收紧（缺字段即拒绝），需把这些字段改为必填 zod 校验并改回派生类型。
3. `isResponseBodyMatching<T>` 用显式类型参数表达契约类型，schema 推断类型更宽松；若调用点传错类型参数，编译期由方法返回类型兜底，但谓词本身不再由 schema 推断保证一致。

下次计划：#7.1 子步骤 3 批次 6（swaps/duty 读模型：`isSwapAssignmentSummary`/`isSwapPreview`/`isSwapConflict`/`isSwapRequest`/`isSwapRequestStatus`/`isSwapRequestList`/`isGroupSwapSettings`/`isMemberSwapSettings`/`isDutyAdjustmentAssignmentSummary`/`isDutyAdjustmentConflict`/`isDutyAdjustmentPreview`/`isDutyAdjustmentRequestStatus`/`isDutyAdjustmentRequest`/`isDutyAdjustmentRequestList`/`isGroupDutyAdjustmentSettings` 先写锁定测试再替换；随后推进 leaves、manual-schedules 等）

### 轮次 17 – 2026-08-07

目标：#7.1 子步骤 3 批次 6 —— 从 `@schedule/contracts` 引入 zod 运行时 schema，把 swaps/duty 读模型族 15 个手写守卫替换为 schema 解析；先写锁定测试再替换。

修改文件：`packages/contracts/src/swaps.ts`（新增 `swapRequestStatusSchema`/`swapConflictCodeSchema`/`swapAssignmentSummarySchema`/`swapConflictSchema`/`swapPreviewSchema`/`swapRequestSchema`（+List）/`groupSwapSettingsSchema`/`memberSwapSettingsSchema`，8 个读模型类型由 schema 派生，约束与旧守卫一致：状态/冲突码枚举、日期/颜色正则、整数 ≥1、可选字段、`passthrough()`、嵌套数组 `z.readonly`）；`packages/contracts/src/duty-adjustments.ts`（新增 `dutyAdjustmentStatusSchema`/`dutyAdjustmentConflictCodeSchema`/`dutyAdjustmentAssignmentSummarySchema`/`dutyAdjustmentConflictSchema`/`dutyAdjustmentPreviewSchema`/`dutyAdjustmentRequestSchema`（+List）/`groupDutyAdjustmentSettingsSchema`，7 个读模型类型由 schema 派生）；`apps/web/src/api/client.ts`（27 处调用点改用 `isResponseBodyFromSchema`，删除 `isSwapAssignmentSummary`/`isSwapPreview`/`isSwapConflict`/`isSwapRequest`/`isSwapRequestStatus`/`isSwapRequestList`/`isGroupSwapSettings`/`isMemberSwapSettings`/`isDutyAdjustmentAssignmentSummary`/`isDutyAdjustmentConflict`/`isDutyAdjustmentPreview`/`isDutyAdjustmentRequestStatus`/`isDutyAdjustmentRequest`/`isDutyAdjustmentRequestList`/`isGroupDutyAdjustmentSettings` 15 个手写守卫）；`apps/web/src/api/client.test.ts`（先新增 12 条锁定测试再替换：换班预览未知冲突码、非整数 version、非法班种颜色、未知状态、空 targetAssignmentId、群换班设置非布尔、个人换班设置非布尔、加扣班预览未知状态、未知冲突码、非整数 assignmentVersion、slotPosition 0、群加扣班设置非布尔；75 → 87 条）；同步更新 `docs/project-status.md` 与 `fix-progress.md`。

测试结果：`pnpm verify` 504/504 ✅（68 个测试文件，隔离 MySQL；新增 12 条 client 锁定测试）

提交：d8e0655，推送结果见对话回复

不确定点：
1. swap/duty 的 assignment summary 中 `scheduleRoleName` 旧守卫只校验字符串不校验非空，schema 保持 `z.string()`（无 min）；若未来想收紧需加 `.min(1)`——出错症状是空 scheduleRoleName 仍能通过读模型（与旧行为一致）。
2. `swapRequestSchema`/`dutyAdjustmentRequestSchema` 补充了旧守卫未检查的可选字段（`decidedByMemberName`/`isRevocable`/`revocationBlockedReason`），按接口类型校验；若未来这些字段的服务器值类型变化，客户端会比旧版更早拒绝。
3. 状态/冲突码用 `z.enum` 派生联合类型，与旧守卫枚举一致；若未来新增合法状态而未同步契约，客户端会拒绝——出错症状是新增状态被当作“服务返回了无效资料”。

下次计划：#7.1 子步骤 3 批次 7（leaves 读模型：`isLeaveRequest`/`isLeaveRequestList`/`isLeaveAffectedShiftList`/`isLeaveWorkflowBlocker`/`isLeaveAffectedAssignment`/`isLeaveReflowConflict`/`isLeaveStatisticsDelta`/`isLeaveReflowPreview`/`isGroupLeaveReflowStrategy`/`isApprovedLeaveRequestResult`/`isRejectedLeaveRequestResult`/`isLeaveRequestMutationResult` 先写锁定测试再替换；随后推进 manual-schedules、events/notifications 等）

### 轮次 18 – 2026-08-07

目标：#7.1 子步骤 3 批次 7 —— 从 `@schedule/contracts` 引入 zod 运行时 schema，把 leaves 读模型族 12 个手写守卫替换为 schema 解析；先写锁定测试再替换。

修改文件：`packages/contracts/src/leaves.ts`（新增 `leaveRequestTypeSchema`/`leaveRequestStatusSchema`/`leaveReflowStrategySchema`/`leaveAffectedShiftSchema`（+List）/`leaveRequestSchema`（+List）/`leaveAffectedAssignmentSchema`/`leaveReflowConflictSchema`/`leaveWorkflowBlockerSchema`/`leaveMemberStatisticsDeltaSchema`/`leaveStatisticsDeltaSchema`/`leaveReflowPreviewSchema`/`approvedLeaveRequestResultSchema`/`rejectedLeaveRequestResultSchema`/`leaveRequestMutationResultSchema`/`groupLeaveReflowStrategySchema`，13 个读模型类型由 schema 派生或显式契约别名；`leaveReflowPreviewSchema` 对旧守卫忽略的 `affectedShiftCount`/`affectedShifts`/`overlapsUnpublishedPeriod` 保持宽松、导出类型保留必填，`periodVersions` 用 `z.custom` 复刻“对象且值全为 number”检查）；`packages/contracts/src/schedules.ts`（新增 `scheduleGenerationWarningSchema`/`scheduleGenerationVacancySchema` 供 reflow preview 复用）；`apps/web/src/api/client.ts`（11 处调用点改用 schema：9 处 `isResponseBodyFromSchema`、2 处 `isResponseBodyMatching<T>`（approve 结果与 reflow preview），删除 `isLeaveRequest`/`isLeaveRequestList`/`isLeaveAffectedShiftList`/`isGroupLeaveReflowStrategy`/`isLeaveReflowPreview`/`isLeaveWorkflowBlocker`/`isLeaveAffectedAssignment`/`isLeaveReflowConflict`/`isLeaveStatisticsDelta`/`isApprovedLeaveRequestResult`/`isRejectedLeaveRequestResult`/`isLeaveRequestMutationResult` 12 个手写守卫及随之无引用的 `isStringNumberRecord`）；`apps/web/src/api/client.test.ts`（先新增 13 条锁定测试再替换：未知状态、未知 leaveType、非整数 version、受影响班次 isCovered 非布尔、reflow preview 缺未校验字段放行、conflicts 非数组、periodVersions 值非数字、workflow blocker 空消息、affected assignment 非法颜色、statistics 总数非数字、群策略未知值、approved 结果状态错误、mutation 结果状态错误；87 → 100 条）；同步更新 `docs/project-status.md` 与 `fix-progress.md`。

测试结果：`pnpm verify` 517/517 ✅（68 个测试文件，隔离 MySQL；新增 13 条 client 锁定测试）

提交：cf6a61d，推送结果见对话回复

不确定点：
1. `leaveReflowPreviewSchema` 对 `affectedShiftCount`/`affectedShifts`/`overlapsUnpublishedPeriod` 保持旧守卫的宽松（`z.custom(...).optional()`），导出类型保留必填；若未来想收紧需改为必填校验——出错症状是缺字段仍能通过读模型（与旧行为一致）。
2. `scheduleGenerationWarningSchema`/`scheduleGenerationVacancySchema` 新增在 schedules.ts 并先被 leave reflow preview 使用；client 里 `isContinuousDutyWarning`/`isScheduleGenerationVacancy` 仍被 manual-apply 预览使用，待 manual-schedules 批次替换后清理——出错症状是两处校验并存但不冲突。
3. `approvedLeaveRequestResultSchema`/`leaveReflowPreviewSchema` 的推断类型比导出契约类型宽松，调用点用 `isResponseBodyMatching<T>` 桥接；若调用点传错类型参数，编译期由方法返回类型兜底。

下次计划：#7.1 子步骤 3 批次 8（manual-schedules 读模型：`isManualApplyPreview`/`isManualApplyAssignment`/`isManualApplyConflict`/`isContinuousDutyWarning`/`isManualScheduleTemplate`/`isManualScheduleTemplateMember`/`isManualScheduleTemplateCell`/`isManualScheduleTemplateList`/`isAppliedManualScheduleTemplateResult`/`isScheduleGenerationVacancy`/`isScheduleGenerationStatistics`/`isRoleCount`/`isShiftTypeCount` 先写锁定测试再替换；随后推进 events/notifications、statistics 等）

### 轮次 19 – 2026-08-07

目标：#7.1 子步骤 3 批次 8 —— 从 `@schedule/contracts` 引入 zod 运行时 schema，把 manual-schedules 读模型族 13 个手写守卫替换为 schema 解析；先写锁定测试再替换。

修改文件：`packages/contracts/src/manual-schedules.ts`（新增 `manualScheduleTemplateMemberSchema`/`manualScheduleTemplateCellSchema`/`manualScheduleTemplateSchema`（+List）/`manualApplyConflictSchema`/`manualApplyAssignmentSchema`/`manualApplyPreviewSchema`/`appliedManualScheduleTemplateResultSchema`，3+1 个读模型类型由 schema 派生，`ManualApplyPreview`/`AppliedManualScheduleTemplateResult` 用显式契约别名；`manualApplyAssignmentSchema` 按旧守卫要求 `scheduleRoleName` 非空）；`packages/contracts/src/schedules.ts`（新增 `scheduleGenerationRoleCountSchema`/`scheduleGenerationShiftTypeCountSchema`/`scheduleGenerationStatisticsSchema`，对旧守卫忽略的统计分项字段保持宽松）；`apps/web/src/api/client.ts`（5 处调用点改用 schema：3 处 `isResponseBodyFromSchema`、2 处 `isResponseBodyMatching<T>`（manual apply preview 与 applied 结果），删除 `isAppliedManualScheduleTemplateResult`/`isManualApplyPreview`/`isManualApplyAssignment`/`isManualApplyConflict`/`isContinuousDutyWarning`/`isScheduleGenerationVacancy`/`isScheduleGenerationStatistics`/`isRoleCount`/`isShiftTypeCount`/`isManualScheduleTemplate`/`isManualScheduleTemplateMember`/`isManualScheduleTemplateCell`/`isManualScheduleTemplateList` 13 个手写守卫；至此上一轮遗留的 `isContinuousDutyWarning`/`isScheduleGenerationVacancy` 助手随本批一并清理，`schedulePeriodSummarySchema` 不再被 client.ts 直接引用）；`apps/web/src/api/client.test.ts`（先新增 11 条锁定测试再替换：applyStartDate 格式、cycleDays 非整数、assignment 颜色、冲突码、vacancies 非数组、统计计数非整数、cycleDays 32、member 版本 0、cell cycleDay 0、applied 状态错误、templateVersion 非整数；100 → 111 条）；同步更新 `docs/project-status.md` 与 `fix-progress.md`。

测试结果：`pnpm verify` 528/528 ✅（68 个测试文件，隔离 MySQL；新增 11 条 client 锁定测试）

提交：570c814，推送结果见对话回复

不确定点：
1. `manualApplyAssignmentSchema` 按旧守卫把 `scheduleRoleName` 当作非空必填，而 `SchedulePreviewAssignment` 接口该字段是可选的；schema 推断类型比契约类型更严，导出类型未改动——出错症状是缺 scheduleRoleName 的预览赋值会被拒绝（与旧行为一致）。
2. `scheduleGenerationRoleCountSchema`/`scheduleGenerationShiftTypeCountSchema` 对旧守卫未校验的字段保持宽松（`z.custom(...).optional()`），但导出接口仍要求这些字段；`ManualApplyPreview`/`AppliedManualScheduleTemplateResult` 用显式契约别名 + `isResponseBodyMatching<T>` 桥接——若调用点传错类型参数，编译期由方法返回类型兜底。
3. `isContinuousDutyWarning`/`isScheduleGenerationVacancy` 等共享助手已随本批删除，契约侧 `scheduleGenerationWarningSchema`/`scheduleGenerationVacancySchema` 成为唯一校验来源；若未来手动排班预览与排班生成预览的字段约束分化，需分别在契约层扩展。

下次计划：#7.1 子步骤 3 批次 9（events/notifications 读模型：`isScheduleEvent`/`isScheduleEventPage`/`isScheduleEventDetail`/`isNotificationRecord`/`isNotificationPage`/`isUnreadCountResult`/`isReadAllResult`/`isSavedResult`/`isDeletedResult`/`isGroupNotificationSettings`/`isMemberNotificationPreferences`/`isPushConfiguration` 先写锁定测试再替换；随后推进 statistics、exports/platform 等）

### 轮次 20 – 2026-08-07

目标：#7.1 子步骤 3 批次 9 —— 从 `@schedule/contracts` 引入 zod 运行时 schema，把 events/notifications 读模型族 13 个手写守卫替换为 schema 解析；先写锁定测试再替换。

修改文件：`packages/contracts/src/events.ts`（新增 `scheduleEventSchema`/`scheduleEventPageSchema`/`scheduleEventDetailSchema`，3 个读模型类型由 schema 派生，JsonObject 可选字段用 `z.custom` 复刻“对象且非数组”检查）；`packages/contracts/src/notifications.ts`（新增 `notificationRecordSchema`/`notificationPageSchema`/`unreadCountResultSchema`/`readAllResultSchema`/`savedResultSchema`/`deletedResultSchema`/`groupNotificationSettingsSchema`/`memberNotificationPreferencesSchema`/`pushConfigurationSchema`，5 个读模型类型由 schema 派生；`dutyReminderHours` 保持整数 ≥1、可空联合按接口）；`apps/web/src/api/client.ts`（13 处调用点改用 `isResponseBodyFromSchema`，删除 `isJsonObjectValue`/`isScheduleEvent`/`isScheduleEventPage`/`isScheduleEventDetail`/`isNotificationRecord`/`isNotificationPage`/`isUnreadCountResult`/`isReadAllResult`/`isSavedResult`/`isDeletedResult`/`isGroupNotificationSettings`/`isMemberNotificationPreferences`/`isPushConfiguration` 13 个手写守卫）；`apps/web/src/api/client.test.ts`（先新增 13 条锁定测试再替换：事件 affectedShiftIds 非数组、afterData 为数组、页 nextCursor 非字符串、详情 related event 缺 id、通知空标题、页 unreadCount 非整数、未读数非整数、已读数非整数、saved 非布尔、deleted 非布尔、群设置提醒小时非整数、个人偏好提醒小时 0、推送配置 vapid 键非 null/字符串；111 → 124 条）；同步更新 `docs/project-status.md` 与 `fix-progress.md`。

测试结果：`pnpm verify` 541/541 ✅（68 个测试文件，隔离 MySQL；新增 13 条 client 锁定测试）

提交：5e271f2，推送结果见对话回复

不确定点：
1. `scheduleEventSchema`/`notificationRecordSchema` 的 JsonObject 可选字段用 `z.custom` 复刻旧 `isJsonObjectValue`（对象且非数组），若未来要校验字段内容需换 `z.record`/自定义细化——出错症状是任意对象仍通过（与旧行为一致）。
2. `memberNotificationPreferencesSchema` 的 `dutyReminderHours` 用 `z.union([z.null(), z.readonly(z.array(...))])`，缺失或 undefined 会拒绝（与旧守卫一致）；若未来接口允许省略该字段，需改 optional。
3. 未读数/已读数/保存/删除四个小结果 schema 未派生导出类型（方法签名内联 `{ readonly count: number }` 等），schema 推断类型可赋值；若未来要统一导出，可在 notifications.ts 增加类型别名。

下次计划：#7.1 子步骤 3 批次 10（statistics 读模型：`isStatisticsRoleCount`/`isStatisticsShiftTypeCount`/`isStatisticsMemberRow`/`isStatisticsSummary`/`isMonthStatisticsSnapshot`/`isYearStatistics`/`isStatisticsRecalculateCheckResult` 先写锁定测试再替换；随后推进 exports/platform、users/profile 等收尾批次）

### 轮次 21 – 2026-08-07

目标：#7.1 子步骤 3 批次 10 —— 从 `@schedule/contracts` 引入 zod 运行时 schema，把 statistics 读模型族 7 个手写守卫替换为 schema 解析；先写锁定测试再替换。

修改文件：`packages/contracts/src/statistics.ts`（新增 `statisticsRoleCountSchema`/`statisticsShiftTypeCountSchema`/`statisticsMemberRowSchema`/`statisticsSummarySchema`/`monthStatisticsSnapshotSchema`/`yearStatisticsSchema`/`statisticsRecalculateCheckResultSchema`，7 个读模型类型由 schema 派生；`actualVsPlanned` 用 `z.custom` 保持旧守卫“仅数组”的宽松检查，其余字段按旧守卫 typeof number/string 校验）；`apps/web/src/api/client.ts`（4 处调用点改用 `isResponseBodyFromSchema`，删除 `isStatisticsRoleCount`/`isStatisticsShiftTypeCount`/`isStatisticsMemberRow`/`isStatisticsSummary`/`isMonthStatisticsSnapshot`/`isYearStatistics`/`isStatisticsRecalculateCheckResult` 7 个手写守卫）；`apps/web/src/api/client.test.ts`（先新增 12 条锁定测试再替换：actualVsPlanned 任意条目放行、月份 version 非数字、summary 缺 members、年度 months 非数组、月度 summary 缺 byRole、matched 非布尔、mismatch 非字符串、summary members 非数组、member actualVsPlanned 非数组、member realName 非字符串、role plannedCount 非数字、shiftType shiftTypeName 非字符串；124 → 136 条）；同步更新 `docs/project-status.md` 与 `fix-progress.md`。

测试结果：`pnpm verify` 553/553 ✅（68 个测试文件，隔离 MySQL；新增 12 条 client 锁定测试）

提交：0ec535c，推送结果见对话回复

不确定点：
1. `statisticsMemberRowSchema.actualVsPlanned` 用 `z.custom` 只校验数组（旧守卫行为），导出类型保留 `StatisticsActualVsPlannedEntry[]`；若未来要校验条目内容需换子 schema——出错症状是任意条目仍通过（与旧行为一致）。
2. `monthStatisticsSnapshotSchema.version`/`yearStatisticsSchema.year` 等按旧守卫只校验 number 不校验整数，schema 保持 `z.number()`；若未来想收紧需改 `.int()`。
3. statistics 家族与 schedule generation 统计（`scheduleGenerationStatisticsSchema`）是两套独立 schema，字段语义相近但分属不同读模型；若未来想合并需先统一契约。

下次计划：#7.1 子步骤 3 批次 11（exports/platform + users/profile 收尾读模型：`isScheduleExportJob`/`isUserProfile` 先写锁定测试再替换；随后 client.ts 仅剩基础设施守卫 `isApiErrorResponse`/`isUndefined`，按需另开清理轮）

### 轮次 22 – 2026-08-07

目标：#7.1 子步骤 3 批次 11 —— exports/platform + users/profile 收尾读模型 2 个手写守卫替换为 schema 解析；先写锁定测试再替换。至此 #7.1 子步骤 3 全部读模型批次完成。

修改文件：`packages/contracts/src/exports.ts`（新增 `scheduleExportTypeSchema`/`scheduleExportPeriodTypeSchema`/`scheduleExportStatusSchema`/`scheduleExportJobSchema`，`ScheduleExportJob` 及 3 个枚举类型由 schema 派生，约束与旧守卫一致：枚举、字符串、可选字段、`passthrough()`、rowCount 仅校验 number）；`packages/contracts/src/users.ts`（新增 `userProfileSchema`，`UserProfile` 类型由 schema 派生：非空 id/realName、整数 ≥1 version）；`apps/web/src/api/client.ts`（5 处调用点改用 `isResponseBodyFromSchema`，删除 `isUserProfile`/`isScheduleExportJob` 2 个手写守卫，保留 `isApiErrorResponse`/`isUndefined` 基础设施守卫）；`apps/web/src/api/client.test.ts`（先新增 7 条锁定测试再替换：导出任务未知 exportType、未知 status、period 非字符串、缺 createdAt、用户资料空 id、空 realName、非整数 version；136 → 143 条）；同步更新 `docs/project-status.md` 与 `fix-progress.md`。

测试结果：`pnpm verify` 560/560 ✅（68 个测试文件，隔离 MySQL；新增 7 条 client 锁定测试）

提交：d606cfd，推送结果见对话回复

不确定点：
1. `scheduleExportJobSchema` 的 `id`/`groupId` 按旧守卫只校验字符串不校验非空，schema 保持 `z.string()`（无 min）；若未来想收紧需加 `.min(1)`——出错症状是空 id/groupId 仍能通过读模型（与旧行为一致）。
2. `ScheduleExportJob.rowCount` 按旧守卫只校验 number 不校验整数/非负，schema 保持 `z.number()`；若未来想收紧需改 `.int().min(0)`。
3. 本批完成后 `#7.1 子步骤 3` 的读模型守卫替换全部结束，client.ts 仅剩 `isApiErrorResponse`（错误响应解析，由 `knownApiErrorCodes` 契约码表支撑）与 `isUndefined`（void 端点解析）两个基础设施守卫，不属于读模型校验器；若用户希望连它们也契约化，需另开一轮评估。

下次计划：`#7.1 子步骤 3` 全部 11 个批次已完成。后续候选按清单继续：#7.4（前端 swap/duty 候选与 isFutureAssignment 重复）、#8.1（15 个页面重复错误文案模板）、#3.7（框架 4xx 归一化）、#4.2/#4.3 等；同时等待用户充值 CloudBase 后验证上线。

### 轮次 23 – 2026-08-07

目标：#7.4 —— 合并前端 swap/duty 的 `isFutureAssignment`、候选构建、状态标签表与“下一步状态说明” switch 到共享 feature 逻辑；纯重构，语义等价。

引入点：swap 的 `isFutureAssignment` 由 `b7ec288`（轮次 14）引入，duty 的 `isFutureAssignment` 由 `3e96983`（轮次 48）引入；候选构建/状态标签/下一步说明 switch 分别源自 `b20ff9b`（feat(workflow): add member shift swaps）与 `5d8b205`（feat(workflow): add paired duty adjustments）。

修改文件：`apps/web/src/features/workflows/workflow-logic.ts`（新增共享模块：`isFutureAssignment`（可选显式时钟；生产调用经 `filter((a) => isFutureAssignment(a))` 仍逐元素取 `Date.now()`，与旧行为一致）、`filterFutureAssignments`、`buildFutureCandidateAssignments`（未来班次 + 我的班次）、`groupAssignmentsByDutyMember`（按当前值班人分组、跳过未分配）、共享状态标签表 + 参数化 `getWorkflowStatusLabel`/`getWorkflowNextStatusDescription`/`resolveNextWorkflowStatus`）；`apps/web/src/features/swaps/swap-logic.ts` 与 `apps/web/src/features/duty-adjustments/duty-adjustment-logic.ts`（候选构建、状态标签、下一步说明、next-status 解析全部委托共享模块，删除各自 `isFutureAssignment` 与状态标签表；冲突消息与格式化助手保留）；`apps/web/src/features/workflows/workflow-logic.spec.ts`（新增 7 条共享逻辑锁定测试：显式时钟未来判定、原序过滤、候选构建、按当前值班人分组且跳过未分配/actual 覆盖 planned、双文案状态标签、双文案下一步说明、四组合 next-status 解析）；`swap-logic.spec.ts`/`duty-adjustment-logic.spec.ts`（各补 2 条差异化锁定断言：`pending_target` 标签与描述分别保持“待对方接受/待加班成员接受”“目标成员/加班成员”文案）。

语义等价审计：逐调用点对比——`isFutureAssignment` 原实现 `new Date(startsAt).valueOf() > Date.now()` 逐元素取时，共享函数保持相同调用方式；候选过滤/我的班次过滤/按值班人分组的顺序与跳过逻辑逐行等价；swap 的目标成员选项与 duty 的管理班次/加班成员选项各自专属分支未改动；状态标签除 `pending_target` 外共享同一张表，`pending_target` 用参数化文案保持两模块原有差异；next-status 解析与描述字符串逐状态一致，default 均为空串；无 this/接收者、异步/错误路径、空值语义或副作用差异。

测试结果：`pnpm verify` 568/568 ✅（69 个测试文件，隔离 MySQL；新增 7 条共享逻辑测试 + 4 条差异化锁定断言）

运行/浏览器验证：pnpm smoke:browser 通过（登录/管理员/成员/访客全流程，无浏览器错误）；pnpm smoke:check-core 通过（未涉及核心链路，无需强制记录，已实际补跑）。

状态：已完成（feature 逻辑重构，单测 + 浏览器冒烟通过；待用户本地验收时强刷复核面板文案与候选行为不变）。

不确定点：1. `filterFutureAssignments` 未暴露显式时钟参数，测试用 2000/2099 远年日期避免依赖当前时间；若未来需要可注入时钟，可加可选 `now` 并在共享 builder 透传。2. 共享 `WorkflowRequestStatus = SwapRequestStatus | DutyAdjustmentStatus` 依赖两个契约状态枚举当前完全同构；若未来二者分化，需把参数化文案/映射拆回各自模块。3. swap/duty 的 `formatXAssignmentOption`、`formatXShiftTime` 与 `formatChinaStandardTime` 仍各复制一份（审计卡未列入本项范围），如需一并收敛可另开一轮。

下次计划：按清单继续 #8.1（15 个页面重复错误文案模板抽 `toUserMessage`）；同时等待用户强刷复核轮次 57 及既往排班/换班/加扣班相关验收项。

### 轮次 24 – 2026-08-07

目标：#8.1 —— 抽取共享 `toUserMessage(error, fallback)`，替换视图/组件里重复的 `error instanceof ApiClientError ? error.message : '<兜底>'` 与 `error instanceof Error && error.message.length > 0 ? ...` 模板，统一错误文案处理规则；纯重构，文案字面逐页保留。

引入点：审计驱动的重构而非回归修复；重复模板由各页面在功能开发时逐页复制产生（审计卡 #8.1，无单一引入提交），组件侧存在 `ApiClientError` 与 `Error` 两种变体，而 `stores/session.ts` 早已有共享 `getErrorMessage`（Error 语义）未被组件复用。

为什么现有测试没拦住：组件本地 `getErrorMessage` 无任何单测锁定；`pnpm verify` 只覆盖编译、契约与共享逻辑，不校验页面级文案模板。新增 `apps/web/src/utils/user-message.spec.ts` 4 条锁定测试覆盖 ApiClientError、普通 Error、空 message、非 Error 四类输入。

修改文件：新增 `apps/web/src/utils/user-message.ts`（`toUserMessage(error, fallback)` = `error instanceof Error && error.message.length > 0 ? error.message : fallback`）与 `user-message.spec.ts`；21 个调用方删除本地 `getErrorMessage`/内联三元并改用 `toUserMessage(error, '<原兜底文案>')`：GuestScheduleView（2 处内联）、HomeView、EventCenterView、PastScheduleView、CalendarView、ManualScheduleView、GroupContactForm、StatisticsView、SchedulingConfigPanel、DutyAdjustmentPanel（保留 ApiClientError 冲突判断）、GroupSetupPanel、ApplyTemplateDialog、MemberManager、LeaveApprovalDialog、LeavePanel、SwapPanel（保留 ApiClientError 冲突判断）、ExportDialog、NotificationCenterPanel、NotificationSettingsPanel、LoginView、stores/session.ts（删除导出 `getErrorMessage`，内部与登录页改用 `toUserMessage(error, '操作未完成，请稍后重试。')`）；16 个仅用 `ApiClientError` 做文案判断的文件移除该导入。

语义等价审计：逐调用点对比——原 15 个 ApiClientError 模板仅在 `ApiClientError` 时返回 message；新统一规则对任何 `Error`（含 ApiClientError）返回非空 message，否则兜底。行为变化清单：①非 ApiClientError 的 Error 在原先只判 ApiClientError 的页面从“显示兜底”变为“显示其 message”，与 session store/登录页既有行为一致（有意的统一）；②message 为空的 ApiClientError 从返回空串变为显示兜底；③ExportDialog/NotificationCenterPanel/NotificationSettingsPanel/session/LoginView 语义完全不变；④兜底文案逐页保留原值（参数化）；纯同步纯函数，无 this/接收者、异步/错误路径、空值或副作用差异，调用次数 1:1。

测试结果：`pnpm verify` 572/572 ✅（70 个测试文件，隔离 MySQL；新增 4 条 toUserMessage 锁定测试）。

运行/浏览器验证：pnpm smoke:browser 通过（登录/管理员/成员/访客全流程，无浏览器错误）；pnpm smoke:check-core 通过（本轮涉及核心链路 `stores/session.ts`，记录已满足校验）。

状态：已完成（单测 + 浏览器冒烟通过；待用户本地验收时强刷复核各页面 API 错误提示不变）。

提交：2c60b59（`refactor(web): extract shared toUserMessage for error copy`），推送结果见对话回复

不确定点：1. 统一为 Error 语义后，原先只显示 ApiClientError 的页面若捕获到非 ApiClientError 的 Error，会显示其原始 message 而非兜底文案——出错症状是用户看到技术性英文/异常文本；如不希望暴露，可改为只接受 ApiClientError 并把 session 登录错误单独保留。2. GuestScheduleView 的两处兜底（群组/排班）与其他页面的“数据/日历/记录”措辞不同，本次按参数保留原值；若后续要彻底统一字面，需产品确认。3. 非 Error 实例但带 message 的普通对象仍走兜底（与旧行为一致），本轮未扩展。

下次计划：按清单继续 #3.7（框架 4xx 全部归一化为 VALIDATION_FAILED，按状态码映射并补测试）；同时等待用户强刷复核轮次 57、54、53、52、51、50、49、48、47、46 及 23/24 相关验收项。

### 轮次 25 – 2026-08-07

目标：#3.7 —— 框架级 4xx 按状态码映射到契约错误码：400→VALIDATION_FAILED、404→NOT_FOUND、415→UNSUPPORTED_MEDIA_TYPE（既有）、429→RATE_LIMITED；未列入的状态码保留 VALIDATION_FAILED 兜底，并为每个映射补测试。

引入点：轮次 56（`fix(api): map unsupported content types to 415 instead of 500`）只修了 415，留下“除 415 外框架 4xx 一律 VALIDATION_FAILED”的窄补丁；审计卡 #3.7 登记。

为什么现有测试没拦住：`app.test.ts` 只有 415/400/500/ApiError 透传断言，没有 404/429/未列 4xx 的框架错误注入测试；本次先新增 3 条（404→NOT_FOUND、429→RATE_LIMITED、405 兜底 VALIDATION_FAILED），旧代码上 404/429 两条失败、兜底条通过，实现后全部通过。

修改文件：`apps/api/src/plugins/error-handler.ts`（新增 `notFoundErrorMessage`/`rateLimitedErrorMessage` 常量与 `frameworkErrorMappings` 状态码→`{code, message}` 映射表；`setNotFoundHandler` 复用 `notFoundErrorMessage`；`toApiError` 从“415 特判”改为查表，未命中保持 VALIDATION_FAILED）；`apps/api/src/app.test.ts`（新增 3 条框架 4xx 注入测试，8 → 11 条）。

语义等价审计：仅改变框架级 4xx 的 code/message 输出；ApiError 透传、500 兜底、Fastify schema 校验（400）行为不变；404 框架错误此前几乎不会到达错误处理器（路由未命中由 `setNotFoundHandler` 处理），映射后语义正确；客户端 `knownApiErrorCodes` 已含 NOT_FOUND/RATE_LIMITED，无需改动。

测试结果：`pnpm verify` 575/575 ✅（70 个测试文件，隔离 MySQL；新增 3 条 app 框架 4xx 映射测试）。

运行/浏览器验证：未涉及 Web 核心链路（web api/auth/router/pwa/session/contracts/vite 配置/.env.example 均无改动）；pnpm smoke:check-core 通过（无核心链路变更）。

状态：已完成（单测通过；接口错误码语义化，用户界面无直接变化）。

提交：bcecee7（`fix(api): map framework 4xx errors to contract codes`），推送结果见对话回复

不确定点：1. 401/403/409 等框架级 4xx 仍映射为 VALIDATION_FAILED（业务层均通过 ApiError 显式抛出对应码）；若未来引入会产生裸 401/403/409 的框架插件，需再扩展映射表——出错症状是这类错误仍显示“请求数据不符合要求”。2. 测试用 `Object.assign(new Error(...), { statusCode })` 近似 Fastify 错误形态，真实框架错误字段更多但读取路径只依赖 statusCode，已覆盖。3. 404 通常由 `setNotFoundHandler` 提前处理，错误处理器内的 404 分支属防御性映射，实际触发场景少。

下次计划：按清单继续 #4.2/#4.3（冲突断言双轨 + 三服务“上帝对象”状态机，需拆多轮，先从 #4.2 统一冲突断言入口）；同时等待用户强刷复核轮次 57、54、53、52、51、50、49、48、47、46 及 23/24 相关验收项。

### 轮次 26 – 2026-08-07

目标：#4.2 —— 把 swap/duty 各自的“预检冲突 + 事务内断言”双轨收敛为 `WorkflowConflictService.assertNoWorkflowConflicts` 单一接口，冲突消息由共享服务生成。

引入点：半重构残留源自统一冲突查询落地时（`WorkflowConflictService` 引入，对应 #4.1 相关轮次），各服务仍保留私有断言包装；审计卡 #4.2 登记。

为什么现有测试没拦住：旧实现逻辑分散在两个服务内，无共享断言单测；集成测试只覆盖最终 409 响应与 `latestData.conflicts` 数组，未锁定 swap 资格冲突的通用文案。新增 `workflow-conflict-service.spec.ts` 4 条锁定测试（空列表不抛、资格冲突 message 拼接、活动工作流 message、资格优先）。

修改文件：`apps/api/src/modules/workflows/workflow-conflict-service.ts`（新增 `assertNoWorkflowConflicts`：先查资格冲突再查活动工作流，`userMessage` 统一为冲突 message 拼接，`latestData` = 调用方上下文 + `conflicts`）；`apps/api/src/modules/swaps/swap-service.ts`（创建/直接换班传两类冲突，accept/approve 只传资格冲突——`findSwapAssignmentConflicts` 无排除参数会把当前请求自身算作冲突，注释说明并沿用旧行为；删除 `assertNoSwapConflicts`/`assertNoActiveWorkflowConflicts`）；`apps/api/src/modules/duty-adjustments/duty-adjustment-service.ts`（4 个入口全部传两类冲突，`findDutyAdjustmentAssignmentConflicts` 本就有排除参数；删除 `assertNoDutyAdjustmentConflicts`/`assertNoActiveWorkflows`）。

语义等价审计与行为变化清单：①swap 资格冲突 userMessage 从通用文案“换班预检发现资格、请假或时间冲突，无法继续。”改为具体冲突 message 拼接（与 duty 一致，有意的统一）；②duty 活动工作流冲突 latestData 增加 `coveredAssignment`（原只有 `conflicts`，结构统一）；③swap accept/approve 仍只重查资格冲突（旧行为，否则当前请求自身会被算作冲突）；duty accept/approve 经排除参数重查两类（旧行为一致）；④资格冲突优先于活动工作流冲突，与两服务旧顺序一致；⑤状态码 409、`latestData.conflicts` 内容、事务内抛出回滚路径不变。

测试结果：`pnpm verify` 579/579 ✅（71 个测试文件，隔离 MySQL；新增 4 条共享断言单测）；定向集成验证 swap 31/31、duty 24/24（`NODE_ENV=test` + `TEST_MYSQL_*`，隔离测试库 3307）。

运行/浏览器验证：未涉及 Web 核心链路（web api/auth/router/pwa/session/contracts/vite 配置/.env.example 均无改动）；pnpm smoke:check-core 通过（无核心链路变更）。

状态：已完成（单测 + 集成测试通过；API 冲突响应文案/结构统一，用户界面无直接变化）。

提交：b423807（`refactor(workflows): unify swap and duty conflict assertions`），推送结果见对话回复

不确定点：1. swap accept/approve 的“只查资格冲突”依赖 `findSwapAssignmentConflicts` 无排除参数这一现状；若未来给 swap 查询加排除参数，可让 accept/approve 也重查活动工作流（与 duty 对齐）——出错症状是 accept/approve 误报“已有待处理换班/加扣班”409。2. swap 资格冲突文案从通用改为具体拼接，提交失败提示更长更具体；若希望保留简短通用文案，需把 message 生成改为参数化。3. leave 的 `workflowBlockers` 断言仍是独立实现（latestData 结构不同），未纳入本次范围，留待 #4.3 状态机骨架时评估。

下次计划：按清单继续 #4.3（三服务 `eventWriter`/`notificationWriter`/`permissionService` 三件套与 runXxx 状态机抽骨架，拆多轮）；同时等待用户强刷复核轮次 57、54、53、52、51、50、49、48、47、46 及 23/24 相关验收项。

### 轮次 27 – 2026-08-07

目标：#4.3 子步骤 1 —— 抽取共享“开事务 → 鉴权 → 幂等执行”入口骨架 `runAuthorizedMutation`，迁移 swap 6 个 + duty 7 个事务入口，消除 13 处重复样板。

引入点：三服务各自维护 runXxx 入口样板自功能开发起复制演进（审计卡 #4.3 登记，无单一引入提交）。

为什么现有测试没拦住：样板重复不改变行为，单测无法感知；集成测试（swap 31、duty 24）覆盖全部入口与幂等重放，作为本轮回归网。

修改文件：新增 `apps/api/src/modules/workflows/workflow-operation.ts`（`runAuthorizedMutation`：`withTransaction` → `requirePermission` → `withIdempotentOperation`，参数化 permission/scope/fingerprint/run）；`apps/api/src/modules/swaps/swap-service.ts` 6 个入口（create/createDirect/accept/approve/reject/cancel）与 `apps/api/src/modules/duty-adjustments/duty-adjustment-service.ts` 7 个入口（create/createDirect/accept/approve/reject/cancel/revoke）改调共享骨架；duty 删除 `withIdempotentOperation` 导入；swap 保留该导入（`revokeCompleted` 在幂等操作前有“锁定请求 + 成员/管理员角色预检”，未迁移）。

语义等价审计：逐入口对比——事务边界（骨架仍用 `withTransaction`）、鉴权顺序与权限名、幂等 scope/operationId/requestFingerprint/actorUserId、run 回调参数（reject/cancel 额外捕获 identity）逐一相同；无 this/接收者、异步/错误路径、空值或副作用差异；swap `revokeCompleted` 保持原实现，避免把幂等键插入移到角色预检之前改变错误优先级。

测试结果：`pnpm verify` 579/579 ✅（71 个测试文件，隔离 MySQL）；定向集成 swap 31/31、duty 24/24（`NODE_ENV=test` + `TEST_MYSQL_*`，隔离库 3307）。

运行/浏览器验证：未涉及 Web 核心链路（web api/auth/router/pwa/session/contracts/vite 配置/.env.example 均无改动）；pnpm smoke:check-core 通过（无核心链路变更）。

状态：已完成（#4.3 子步骤 1；#4.3 整体进行中）。

提交：beae8e8（`refactor(workflows): extract authorized mutation entry skeleton`），推送结果见对话回复

不确定点：1. swap `revokeCompleted` 仍未迁移（幂等前有锁定 + 角色预检），若未来给骨架加 `beforeIdempotentOperation` 钩子可一并迁移——出错症状是维持现状，无行为变化。2. leave 的 approve 带“冲突通知”catch 包装、submit 无外部 operationId，入口形态不同，留待子步骤 2 单独处理。3. 三服务各自实例化的依赖（eventWriter/notificationWriter/permissionService 等）本轮未合并为共享容器，属 #4.3 后续子步骤。

下次计划：#4.3 子步骤 2（leave 入口迁移 + 三服务依赖容器收敛）；同时等待用户强刷复核轮次 57、54、53、52、51、50、49、48、47、46 及 23/24 相关验收项。
