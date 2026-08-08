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

| 优先级 | 编号      | 问题                                            | 原严重度     | 风险 | 收益                       | 备注                                                                                    |
| ------ | --------- | ----------------------------------------------- | ------------ | ---- | -------------------------- | --------------------------------------------------------------------------------------- |
| ✅     | #3.1      | starts_at 环境补丁散落 12 处                    | 严重         | 中   | 极高（防线上数据损坏复发） | 已完成（轮次 1）：统一助手 + 锁定测试，见第 7 节                                        |
| ✅     | #4.1      | swap/duty 服务复制（loadMembers/loadRoleNames） | 严重         | 中   | 极高                       | 已完成（轮次 2）：共享 GroupMemberReader + 锁定测试，见第 7 节                          |
| ✅     | #7.3      | 中国时区算法在 9 个文件重复                     | 严重         | 中低 | 高（时区事故反复出现）     | 已完成（轮次 3）：统一到 scheduling-domain 并机械替换，见第 7 节                        |
| ✅     | #3.2      | 日志/审计脱敏清单双份且已漂移                   | 严重         | 低   | 高（安全控制）             | 已完成（轮次 4）：合并为共享脱敏模块，见第 7 节                                         |
| ✅     | #1.1      | 文档过期/自相矛盾（待办、轮次、415）            | 轻微         | 零   | 中                         | 已完成（轮次 5）：重写待办/下一步与轮次表述，见第 7 节                                  |
| ✅     | #3.3      | 任务分派默认分支静默落到导出任务                | 轻微         | 极低 | 中                         | 已完成（轮次 6）：`Record<JobName, Factory>` 穷举映射 + 锁定测试，见第 7 节             |
| ✅     | #3.4      | AUTH_DEV_MODE 无 NODE_ENV 防线                  | 轻微         | 低   | 中（安全）                 | 已完成（轮次 7）：显式双条件 + env schema，见第 7 节                                    |
| ✅     | #7.5      | event-timeline 死代码（含 spec 续命）           | 轻微         | 极低 | 中                         | 已完成（轮次 8）：删函数/字段/样式并同步 spec，见第 7 节                                |
| ✅     | #2.1      | ui-tokens CSS/TS 双份维护                       | 严重         | 低   | 中高                       | 已完成（轮次 9）：TS 单一来源 + 生成器 + 锁定测试，见第 7 节                            |
| ✅     | #2.2      | 数据库客户端使用 mysql2 内部属性并异步设时区    | 轻微         | 低   | 中（防时区事故）           | 已完成（轮次 37）：公开 connection 事件 + 顺序保证注释与锁定测试，见第 7 节             |
| ✅     | #7.1      | client.ts 2200 行手写校验器 + 重复请求函数      | 严重         | 高   | 极高                       | 已完成（轮次 12–22）：子步骤 1–3 全部完成，113 个读模型守卫替换为契约 schema，见第 7 节 |
| ✅     | #7.2      | 客户端错误码表与契约联合类型双份维护            | 轻微         | 低   | 中                         | 已完成（轮次 11）：契约运行时列表单一来源 + 客户端锁定测试，见第 7 节                   |
| ✅     | #7.4      | 前端 swap/duty 候选与 isFutureAssignment 重复   | 轻微         | 低   | 中                         | 已完成（轮次 23）：合并共享 workflow 逻辑，见第 7 节                                    |
| ✅     | #8.1      | 15 个页面重复错误文案模板                       | 轻微         | 低   | 中低                       | 已完成（轮次 24）：抽共享 toUserMessage，见第 7 节                                      |
| ✅     | #8.2      | 视图层再次裸写时区/日期魔法数                   | 轻微         | 零   | 中                         | 已随 #7.3（轮次 3）一并替换为领域工具                                                   |
| ✅     | #3.7      | 框架 4xx 全部归一化为 VALIDATION_FAILED         | 轻微         | 低   | 中                         | 已完成（轮次 25）：按状态码映射，见第 7 节                                              |
| ✅     | #4.2      | 冲突断言双轨（swap/duty 各自“预检 + 断言”）     | 轻微         | 高   | 高                         | 已完成（轮次 26）：统一为共享 `assertNoWorkflowConflicts`，见第 7 节                    |
| ✅     | #4.3      | 三服务“上帝对象”状态机                          | 轻微         | 高   | 高                         | 已完成（轮次 27–30）：入口骨架 + 依赖容器 + 全部入口迁移，见第 7 节                     |
| ✅     | #4.5      | 发布/生成缺少“仅未来日期”限制                   | 严重（缺口） | 低   | 中                         | 已完成（轮次 31，用户确认方案 1）：整段已过月份拒绝，见第 7 节                          |
| ✅     | #7.6      | manual-adjustment“调”标记半移除                 | 轻微         | 低   | 中低                       | 已完成（轮次 31，用户确认方案 A）：移除渲染、保留事件数据，见第 7 节                    |
| ✅     | #3.5      | idempotency 宽 catch 当重复键                   | 轻微         | 低   | 低                         | 已完成（轮次 32）：仅重复键走查重路径，见第 7 节                                        |
| ✅     | #3.6      | CloudBase 处理器惰性单例竞态                    | 轻微         | 低   | 低中                       | 随平台弃用清理（轮次 39）：cloudbase-handler 已删除，见第 7 节                          |
| ✅     | #9.2      | 云函数入口跨目录相对导入                        | 轻微         | 低中 | 中                         | 随平台弃用清理（轮次 39）：infra/cloudbase 已删除，见第 7 节                            |
| ✅     | #9.1      | cloudbaserc 未声明 env，环境不可复现            | 轻微         | 低   | 中                         | 随平台弃用清理（轮次 39）：cloudbaserc/部署工作流已删除，见第 7 节                      |
| ✅     | #6.1/#6.2 | 迁移 0030/0031 复制 + 序列一致性无校验          | 轻微         | 低   | 低中                       | 已完成（轮次 36）：合并回填 + 校验迁移与测试，见第 7 节                                 |
| ✅     | #5.1      | notification-retry 的 skipped 恒为 0            | 轻微         | 低   | 低                         | 已完成（轮次 33）：返回三态并如实计数，见第 7 节                                        |
| ✅     | #5.2      | group-recycle 27 条裸 SQL 手写级联              | 轻微         | 低中 | 低中                       | 已完成（轮次 34）：外键元数据锁定测试 + scanned 语义修正，见第 7 节                     |
| ✅     | #5.3      | 统计重建静默吞错                                | 轻微         | 低   | 低                         | 已完成（轮次 35）：失败上下文写入 summary 与运行日志，见第 7 节                         |
| ✅     | #4.4      | 两个软删除函数几乎相同                          | 轻微         | 低   | 低                         | 已完成（轮次 30）：合并带可选截止日期，见第 7 节                                        |
| ✅     | #1.2      | .env.example 缺开发模式开关                     | 轻微         | 零   | 低                         | 已完成（轮次 7）：随 #3.4 一并补两个开关项，见第 7 节                                   |
| ✅     | #1.3      | 工作区残留（空目录/日志/构建产物）              | 轻微         | 零   | 低                         | 已完成（轮次 38）：清理空目录/日志/CloudBase 打包产物，见第 7 节                        |
| ✅     | #9.3      | 加载/安全测试直写 DB 与 stub 认证               | 轻微         | 低   | 低                         | 已完成（轮次 38）：共享认证桩与 resetDatabase 收敛到 test-fixtures，见第 7 节           |

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

> 完成情况（轮次 38，2026-08-07）：已删除空目录 `cloudfunctions/auth-identity-probe`、全部 `local-api*/local-web*` 日志（16 个文件）与两份 CloudBase 打包产物（`schedule-api/index.js`、`schedule-jobs/index.js`，约 6.9MB）；node_modules 与各包 dist 保留为本地工具链功能依赖（删除会使本地运行/测试需先重建，CI 场景仍由 `pnpm install`/`pnpm build` 生成）。本轮不做仓库改动，无需提交。

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

> 完成情况（轮次 37，2026-08-07）：改用公开 API——`createPool` 取自回调版 `mysql2`，注册公开 `pool.on('connection', ...)`（不再触碰 `pool.pool` 私有对象），`SET time_zone='+00:00'` 在事件回调中同步入队，`pool.promise()` 交给 drizzle；注释说明 mysql2 连接建立事件先于出借触发、单连接命令 FIFO 串行，故首个业务查询必在 SET 完成后执行，SET 失败则销毁连接；新增 `client.test.ts` 2 条锁定测试（并发双连接 + 事务连接首次查询前会话已是 UTC）。本条目中的行号为审查时快照，修改后已过期。

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

> 完成情况（轮次 39，2026-08-07）：用户决定弃用 CloudBase，`cloudbase-handler.ts` 与其测试已删除；本地/ECS 部署使用常驻 `local-server.js`（进程启动时创建一次 Fastify 实例），不存在每请求惰性创建问题。本条目中的行号为审查时快照，文件已删除。

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

> 完成情况（轮次 35，2026-08-07）：`StatisticsRebuildJob` 的 catch 现记录 `{ businessMonth, groupId, error }` 到结果 `failures`，经 `recordJobRun` 自动写入 `platform_job_runs.summary`（计数在前、失败列表在后，500 字符截断不丢计数；`run-job`/`cloudbase-runner` 的完整结果日志保留全量上下文）；新增可注入 `statisticsRefresher` 测试接缝（与 NotificationRetryJob 注入 dispatcher 同模式）；先写 1 条集成回归测试（旧代码 completed=1 失败）再实现；`pnpm verify` 588/588 通过（73 个测试文件，隔离 MySQL），定向集成 platform-admin 8/8 通过，`pnpm smoke:check-core` 通过（未涉及 Web 核心链路）。本条目中的行号为审查时快照，修改后已过期。

### 6. migrations

**6.1 0030/0031 两份回填 SQL 逐行复制**
位置：[0030_backfill_swap_workflow_sequence.sql (line 1)](E:/AItools/Schedule/migrations/0030_backfill_swap_workflow_sequence.sql:1)、[0031_backfill_duty_adjustment_workflow_sequence.sql (line 1)](E:/AItools/Schedule/migrations/0031_backfill_duty_adjustment_workflow_sequence.sql:1)
原则：①不打补丁
问题：两份 SQL 只差 UPDATE 目标表，排名字查询完全一样；0030 与 0031 各自从全量联合查询重新计算排名，若未来再追加同类表，需要第三份复制品。
严重等级：轻微
建议：合并为一次 `UPDATE ... JOIN` 双表更新（或生成脚本），并注明排序必须与分配器一致。

> 完成情况（轮次 36，2026-08-07）：0030 改为“临时排名表计算一次 ROW_NUMBER → 分别 UPDATE swap/duty”的合并回填，头注释写明排序必须与 `allocateWorkflowSequence` 单调语义一致；0029 播种补 `ORDER BY created_at ASC, workflow_kind ASC, id ASC`，与回填排序显式一致。本条目中的行号为审查时快照，修改后已过期。

**6.2 序列分配表与回填值无显式一致性校验**
位置：[workflow-sequence-allocator.ts (line 5)](E:/AItools/Schedule/apps/api/src/modules/workflows/workflow-sequence-allocator.ts:5)；[0029_seed_workflow_sequence_allocations.sql (line 1)](E:/AItools/Schedule/migrations/0029_seed_workflow_sequence_allocations.sql:1)
原则：①不打补丁
问题：运行时序列来自自增 ID，历史回填却来自 `ROW_NUMBER()`，两者靠“恰好都按创建顺序”保持一致，迁移里没有断言（例如 `MAX(workflow_sequence) < LAST_INSERT_ID()`）。
严重等级：轻微
建议：在 0031 末尾加一条校验迁移或测试，确认新旧序列空间不重叠。

> 完成情况（轮次 36，2026-08-07）：0031 保留文件名（兼容已发布 journal），内容改为一致性校验迁移——回填最大值超过播种分配区间上限或序列重复时，向临时校验表插入 0 触发 CHECK 约束失败，使迁移报错；`migrations.test.ts` 新增 2 条行为测试（排序/区间锁定 + 越界拒绝，旧 0031 无校验时红）。本条目中的行号为审查时快照，修改后已过期。

### 7. apps/web 基础层（API 客户端 / PWA / 路由）

**7.1 手工响应校验器 2200 行 + 三个重复请求函数**
位置：[client.ts (line 1903)](E:/AItools/Schedule/apps/web/src/api/client.ts:1903)（1903–1942、1944–2002、2004–2057 三个几乎相同的请求函数；2059–4201 约 113 个手写 `isX` 守卫；4203–4205 定义了从未使用的 `isUndefined`）
原则：①不打补丁 ②代码自解释
问题：`client.ts` 共 4221 行，其中约 51% 是手写类型守卫样板。契约层加字段、改字段时，这里必须人工同步，否则线上表现为“服务返回了无效资料”（本项目已多次出现该提示）；三个请求函数也只是复制后微调。这是整个代码库最大的“复制粘贴后微调参数”实例。
严重等级：严重
建议：从 `@schedule/contracts` 或共享 zod schema 生成类型守卫（或改为 zod `.parse` 统一校验），删除 `isUndefined` 等死代码。

> 子步骤拆分（2026-08-06 轮次 10 补订；原“必须拆子步骤，见第 4 节”的引用在第 4 节无对应内容，以此处为准）：
>
> 1. ✅（轮次 10）把三个几乎相同的请求函数收敛为一个共享请求管道（`requestWithOnline` + `parseJsonResponse`/`parseTextResponse`），行为由 `client.test.ts` 26 条测试锁定。经复核，`isUndefined` 实际被 7 个响应守卫引用，并非死代码，审查快照已过期，不删除。
> 2. ✅（轮次 11）`ApiErrorCode` 联合类型改为由契约运行时列表 `apiErrorCodes` 派生；`knownApiErrorCodes` 直接引用该列表，`isApiErrorResponse` 删除 `as ApiErrorCode` 强转；#7.2 一并完成，新增 3 条锁定测试。
> 3. 从 `@schedule/contracts` 引入运行时 schema（zod），按读模型分批替换 113 个手写 `isX` 守卫；每批先写锁定测试再替换，禁止一次性大改；随守卫移除同步删除不再使用的 `isUndefined` 等死代码。
>    完成情况（子步骤 1，2026-08-06）：已删 `requestPublicJsonWithOnline`/`requestJsonWithOnline`/`requestTextWithOnline`，新增共享 `requestWithOnline`（统一离线检查、可选会话、网络错误与 fetch 发起）与 `parseJsonResponse`/`parseTextResponse`（JSON 校验/文本与错误解析），`createApiClient` 内新增 `requestPublicJson` 包装，4 个公开端点改用；新增 2 条锁定测试（公开请求不带 Authorization、文本下载 404 映射为类型化错误）；`pnpm verify` 442/442 通过。本条目中的行号为审查时快照，重构后已过期。
>    完成情况（子步骤 2，2026-08-06）：`packages/contracts/src/errors.ts` 新增运行时 `apiErrorCodes` 列表作为错误码唯一来源，`ApiErrorCode` 联合类型改为由它派生；`apps/web/src/api/client.ts` 的 `knownApiErrorCodes` 改为 `new Set(apiErrorCodes)`，删除本地字面量表与 `as ApiErrorCode` 强转；新增 3 条锁定测试（契约列表完整且无重复、全部错误码映射为类型化客户端错误、未知码回退通用 HTTP 文案）；`pnpm verify` 445/445 通过。本条目中的行号为审查时快照，重构后已过期。
>    完成情况（子步骤 3 · 批次 1，2026-08-07）：`packages/contracts` 新增 `zod` 依赖；`calendar.ts` 新增 `calendarChangeMarkerSchema`/`calendarDutyAssignmentSchema`/`calendarDutyMemberSchema`/`calendarRoleSummarySchema`/`calendarShiftTypeSummarySchema`/`calendarReadModelSchema`/`guestCalendarReadModelSchema`/`guestGroupSummarySchema`/`guestGroupSummaryListSchema` 9 个运行时 schema，8 个读模型类型改为由 schema 派生（约束与旧守卫一致：日期/月份/颜色/时间正则、非空字符串、整数 ≥1、枚举标记、可选字段、`passthrough()` 保留未知字段）；`apps/web/src/api/client.ts` 新增通用 `JsonSchema` + `isResponseBodyFromSchema` 桥接，`getCalendar`/`getSchedulePeriodCalendar`/`getGuestCalendar`/`getGuestGroupCalendar`/`listGuestGroups` 5 处调用点改用 schema，删除 `isCalendarReadModel`/`isGuestCalendarReadModel`/`isGuestGroupSummaryList`/`isCalendarDutyAssignment`/`isCalendarChangeMarker`/`isCalendarDutyMember`/`isCalendarRoleSummary`/`isCalendarShiftTypeSummary` 8 个手写守卫；`client.test.ts` 先新增 6 条锁定测试（未知变动标记、业务月份格式、空姓名、非法颜色、访客日历缺群名、访客群组列表缺名称）再替换，28 → 34 条；`pnpm verify` 451/451 通过。本条目中的行号为审查时快照，重构后已过期。

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

> 完成情况（轮次 39，2026-08-07）：用户决定弃用 CloudBase，`infra/cloudbase/` 与 `deploy-development.yml` 已删除；ECS 部署以 `infra/docker/compose.prod.yml` 显式声明全部环境变量（见阿里云部署审计结论）。本条目中的行号为审查时快照，文件已删除。

**9.2 云函数入口通过相对路径跨目录引用应用源码**
位置：[schedule-api/src/main.js (line 1)](E:/AItools/Schedule/infra/cloudbase/functions/schedule-api/src/main.js:1)、[schedule-jobs/src/main.js (line 1)](E:/AItools/Schedule/infra/cloudbase/functions/schedule-jobs/src/main.js:1)
原则：④部署一致
问题：`import ... from '../../../../../apps/api/src/...'` 让 infra 隐式依赖 apps 源码路径，esbuild 打包后才能运行；目录一旦调整，部署静默失败。这是跨模块隐式耦合。
严重等级：轻微
建议：给 `@schedule/api` 暴露明确的 cloudbase 入口导出，函数包只依赖包名。

> 完成情况（轮次 39，2026-08-07）：用户决定弃用 CloudBase，`infra/cloudbase/functions/` 已删除；ECS 部署只运行已构建的 `apps/api/dist/local-server.js`，无跨目录源码导入。本条目中的行号为审查时快照，文件已删除。

**9.3 加载/安全测试内的数据库直写与 stub 认证重复业务规则**
位置：[run-load-test.ts (line 524)](E:/AItools/Schedule/tests/load/run-load-test.ts:524)（524 行起）；[security.integration.test.ts (line 273)](E:/AItools/Schedule/tests/security/security.integration.test.ts:273)
原则：①不打补丁
问题：加载测试自带一套建表/直插逻辑（`AnyInsertTable`）和 `load-token-*` 认证桩，与生产 repository 逻辑各自演化，属于测试侧“第二套实现”。
严重等级：轻微
建议：复用 `@schedule/database` schema 与 API 入口构造测试数据，减少直写 SQL。

> 完成情况（轮次 38，2026-08-07）：确认加载/安全测试已复用 `@schedule/database` schema 与 `createApp` API 入口（直写 SQL 仅剩 resetDatabase 的 DROP TABLE）；剩余重复收敛为 `@schedule/test-fixtures` 的 `createFakeAuthPort(resolveCloudbaseUid)` 与 `resetDatabase(client)`，加载测试的 `load-token-*` 解析器与安全测试的 token 表均改为传入解析函数，删除各自本地副本；`test-fixtures/tsconfig.build.json` 补 `paths: {}`（与其他包构建配置一致）；新增 `auth.test.ts` 1 条锁定测试；tests/load、tests/security 增加 `@schedule/test-fixtures` workspace 依赖并更新锁文件。本条目中的行号为审查时快照，修改后已过期。

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

> 2026-08-07 第二轮全库复审（处女原则）新发现问题 N1–N14。除 N1 已在轮次 41 修复、N2 已在轮次 42 部署但轮次 46 撤除外，其余一律先登记、等用户安排轮次，不顺手改。

- **N1 ✅（轮次 41 已修复）** `infra/docker/compose.prod.yml` 第 32/43 行重复 `NODE_ENV` 键，`docker compose config` 解析失败，阿里云部署路径不可复现（引入点 16aea99）。修复：删除旧 `NODE_ENV: production`，保留试用期 `NODE_ENV: development`；`verify.yml` 新增 `docker compose config --quiet` 校验。
- **N2 ➖（轮次 42 部署、轮次 46 撤除）** 公网试用机 `8.148.183.46` 以 `NODE_ENV=development + AUTH_DEV_MODE=true` 运行，任意 Bearer token 可冒充任意 UID（含管理员）。轮次 42 按用户决策加 Nginx 浏览器密码门禁，但实测发现该门禁（HTTP Basic Auth）与网页登录携带的 Bearer 身份令牌在同一 `Authorization` 头冲突，登录请求反复弹密码框；用户决策（2026-08-08，方案 4）撤除门禁，正式账号/微信登录落地前不再启用。当前公网入口恢复为开发模式认证（风险已登记，见 production-readiness.md）。
- **N3 ✅（轮次 44 已修复）** `apps/api/src/jobs/run-job.ts` 的 `getJobName` 手写 7 项任务名单，与 runner 穷举映射重复维护（#3.3 同类残留）。修复：`runner.ts` 导出 `isJobName`（基于 `jobRunners` 键判断），`run-job.ts` 改用 `jobNames`/`isJobName` 生成用法与解析，删除手写名单。
- **N4 ✅（轮次 45 已修复）** `apps/api/src/modules/notifications/notification-dispatcher.ts` 的 `NoopPushDispatcher` 仍是死类（#7.5 残留）。修复：删除该类；`createPushDispatcher` 始终返回 `WebPushDispatcher`，全库无引用。
- **N5 ✅（轮次 46 已修复）** `apps/api/src/plugins/idempotency.ts` “读无→再插”窗口内并发重复键仍会原样抛 500，而非 409。修复：重试插入再次撞唯一键时捕获并返回 409“相同请求正在处理中，请稍后重试。”，新增确定性单测。
- **N6 ✅（轮次 49 决策：不重命名）** `cloudbaseUid` 字段/列名在平台弃用后保留（已登记），重命名需数据库迁移。决策：该字段实际承担“外部稳定 UID”职责（认证端口、用户服务、平台管理员/节假日管理员均依赖），不是 CloudBase 专属残留；保留现名，等自建/微信认证落地时如需中性命名再随认证迁移一起改。
- **N7 ✅（轮次 43 已修复）** #7.3 只统一了时区常量，前端 7 个文件仍各自手写“偏移 + toISOString 截取”转换（event-timeline/calendar-logic/calendar-views/swap-logic/duty-adjustment-logic/leave-logic/manual-schedule-logic；N7 原文写 8 个，rg 全量核对实际命中 7 个），已由领域包 `formatChinaStandardTime`/`formatChinaDateTime` 纯函数统一替换。
- **N8 ✅（轮次 47/50 已完成）** contracts zod schema 保留 `z.custom(() => true)`（leaves.ts 146–154、groups.ts 121）与大量 `.passthrough()`，校验强度低于类型声明，需逐步收紧。第一批（轮次 47）：消除全部 `z.custom(() => true)`，groups status 收紧为枚举；第二批（轮次 50）：99 处 `.passthrough()` 全部改为 `.strict()`，未知键现在拒绝，客户端旧“接受未知字段”测试反转为拒绝。
- **N9 ✅（轮次 48 已修复）** `package.json` format:check/format 不覆盖 `scripts/*.mjs` 与 `packages/*/scripts/*.mjs`（smoke-browser、generate-tokens-css 无格式门禁）；`.prettierignore` 仍残留 CloudBase 条目。修复：两个脚本追加 mjs glob，删除 `.prettierignore`，并格式化 `scripts/smoke-browser.mjs`。
- **N10 ✅（轮次 49 已修复）** `.env.example` 把 `VITE_API_PROXY_TARGET` 写进环境文件说明，但 vite.config 只读 `process.env`，写入 `.env` 不生效（需 `loadEnv` 或改文档为“shell 环境变量”）。修复：`vite.config.ts` 改用 `loadEnv` 从根目录 `.env` 读取，`.env.example` 注释同步。
- **N11 ✅（轮次 49 已修复）** 文档滞后：project-status PWA 缓存 v5/v6 矛盾、CHANGELOG 仍以 CloudBase 为当前栈、fix-progress.md 已膨胀至 179KB（建议归档逐轮明细）。修复：project-status 统一为 v6；CHANGELOG 新增 Unreleased 当前栈说明；fix-progress 归档评估后暂不执行（仍是唯一切入点，Git 历史为持久记录）。
- **N12 ✅（轮次 49/50 已完成）** 工作区残留：空 `cloudfunctions/` 目录已清理（轮次 49）；`logs/` 4 个日志文件在轮次 50 停止本地服务后已移动到系统临时目录，服务已按原命令重启，日志目录不再存在。
- **N13 ✅（轮次 50 已完成）** `vite build` 主 chunk 1.89MB 超 500KB 警告，建议代码分割。已完成：路由组件全部改为懒加载 + vendor 手动分包（vue/vue-router/pinia、tdesign-vue-next、@tanstack/vue-query）；入口主包降至约 122KB，HomeView 约 212KB 独立路由块；剩余 `vendor-tdesign` 约 1.27MB 属 TDesign 整包引入，按需引入另排可选优化。
- **N14 ✅（轮次 50 已完成）** `infra/docker/compose.test.yml` 测试库 512MB tmpfs 顶满崩溃；已把 tmpfs 提到 1g 并加 `command: ["--disable-log-bin"]`，重置后全量 `pnpm verify` 596/596 通过，未再崩溃；`docker compose config --quiet` 通过。
- **N15 ⏳ 待新对话全修（用户方案 C，2026-08-08 记录）** TDesign 严格类型暴露的模板类型问题——11 个文件在启用组件类型声明后会产生 TS2322/TS2379/TS4104 报错；当前 `vite.config.ts` 的 `Components({ dts: false })` 保持构建通过，属于“被宽松类型掩盖”的存量问题。详细病症与复现方式见下方“N15 待修清单”。

#### N15 待修清单（TDesign 严格类型模板问题）

复现方式：把 `apps/web/vite.config.ts` 中 `Components({ dts: false, ... })` 改为 `Components({ dts: 'src/components.d.ts', ... })`，运行 `pnpm --filter @schedule/web build`，即可看到以下 11 个文件的类型错误；修完后可保留 `dts` 生成声明（若决定启用严格类型）。

1. `apps/web/src/features/duty-adjustments/DutyAdjustmentPanel.vue`（441/450/500/509）：`<t-select>` 的 `@change` 处理函数参数类型比 TDesign `SelectValue` 窄（TDesign 允许 `bigint`），TS2322。
2. `apps/web/src/features/exports/ExportDialog.vue`（148/156）：`modelValue` 可能是 `undefined`，TDesign Select 不接受，TS2379。
3. `apps/web/src/features/groups/GroupSwitcher.vue`（39/43）：`value` 可能是 `undefined`，且 `@change` 处理函数类型不匹配，TS2379/TS2322。
4. `apps/web/src/features/leaves/LeaveApprovalDialog.vue`（218）：`<t-select>` `@change` 处理函数类型不匹配，TS2322。
5. `apps/web/src/features/leaves/LeavePanel.vue`（313/316）：`value` 可能是 `undefined`，`@change` 处理函数类型不匹配，TS2379/TS2322。
6. `apps/web/src/features/notifications/NotificationSettingsPanel.vue`（203）：`<t-switch>` 的 `@change` 参数是 `SwitchValue`（可为字符串/数字），当前处理函数只接受 `boolean`，TS2322。
7. `apps/web/src/features/swaps/SwapPanel.vue`（534/543/552/599/608/617/626）：共 7 处 `<t-select>` `@change` 处理函数类型不匹配，TS2322。
8. `apps/web/src/views/events/EventCenterView.vue`（221）：只读 `SelectOption[]` 传给 TDesign Select（期望可变数组），TS4104；运行时数组实际可改，未产生用户可见问题。
9. `apps/web/src/views/schedules/ManualScheduleView.vue`（875/880）：2 处 `<t-select>` `@change` 处理函数类型不匹配，TS2322。
10. `apps/web/src/views/schedules/PastScheduleView.vue`（304）：1 处 `<t-select>` `@change` 处理函数类型不匹配，TS2322。
11. `apps/web/src/views/statistics/StatisticsView.vue`（163/170/182/194）：TDesign Table 单元格渲染函数参数类型不匹配，且只读 `TableRowData[]` 传给 Table，TS2322/TS4104；当前页面正常，属类型声明与运行时实际值不一致。

修复目标：所有 11 个文件在启用 `dts` 后 `pnpm --filter @schedule/web build` 通过；`pnpm verify` 596/596、`pnpm smoke:browser`、`pnpm smoke:check-core` 全部通过；浏览器语义检查（登录/工作台/访客 TDesign 组件渲染）通过。
- **N13 ⏳ 轻微** `vite build` 主 chunk 1.89MB 超 500KB 警告，建议代码分割（Vue Router 懒加载/手动分包）。
- **N14 ⏳ 轻微（环境）** `infra/docker/compose.test.yml` 测试库数据目录为 512MB tmpfs，完整套件 + binlog 会顶满后 MySQL 以 `binlog_error_action=ABORT_SERVER` 崩溃（2026-08-07 验证时实测崩溃，清理 Docker Build Cache 56.9GB 并 `down --volumes` 重置后恢复）；建议提高 tmpfs 上限或关闭 binlog，并记录“全量 verify 前先重置测试库”。

### 轮次 41 – 2026-08-07

目标：#N1 —— 修复 compose.prod.yml 重复 `NODE_ENV` 导致的部署文件解析失败，并在 CI 增加 `docker compose config` 校验。

引入点：`git blame` 确认第 43 行 `NODE_ENV: development` 由 16aea99（轮次 39，CloudBase 清理时“修复认证配置不一致”）新增，第 32 行旧 `NODE_ENV: production`（7de6d6e 引入）未删除，形成重复 mapping key。

为什么现有测试没拦住：`pnpm verify` 与 `pnpm smoke:check-core` 均不覆盖 `infra/docker/**`，也没有任何 compose 解析校验；轮次 39 改完未执行 `docker compose config`。先失败证据：修复前 `docker compose -f infra/docker/compose.prod.yml config --quiet` 退出码 1，报 `mapping key "NODE_ENV" already defined at line 32`；修复后退出码 0。

修改文件：`infra/docker/compose.prod.yml`（删除重复的 `NODE_ENV: production`，保留试用期 `NODE_ENV: development + AUTH_DEV_MODE=true` 及其注释）；`.github/workflows/verify.yml`（新增 “Validate Docker Compose production configuration” 步骤：`docker compose --env-file .env.production.example -f infra/docker/compose.prod.yml config --quiet`）。

语义等价审计与行为变化清单：修复前文件无法被 compose 解析（无有效配置）；修复后生效值为 `NODE_ENV=development + AUTH_DEV_MODE=true`（与轮次 39 意图一致）。CI 步骤仅新增解析校验，不改变任何测试/构建行为。

测试结果：基线 `pnpm verify` 584/584 ✅（72 测试文件）；修复后 `pnpm verify` 584/584 ✅（72 测试文件）；`docker compose config --quiet` 修复前 exit=1 → 修复后 exit=0；`prettier --check` 两个改动 yml 通过。

运行/浏览器验证：未涉及 Web 核心链路（改动为 infra/compose 与 CI 工作流）；`pnpm smoke:check-core` 通过（无核心链路变更）。

状态：N1 ✅（已完成；部署文件可解析，CI 防回归已加）。

提交：c2b850d（`fix(deploy): remove duplicate NODE_ENV from prod compose and validate in CI`）；docs checkpoint 提交见 `docs(fix-progress): record round 41 checkpoint hash`，推送结果见对话回复。

不确定点：1. `compose.prod.yml` 中 `api` 服务仍保留 `build:` 且无 `image:`，而部署文档称“服务器不做编译”——部署路径（镜像来源）仍未在仓库内闭环，建议部署前人工确认 ECS 上的镜像/挂载方式（登记入 N1 后续项）。2. 验证期间隔离测试库因 512MB tmpfs 顶满崩溃（N14），重置后全绿；全量 verify 需在重置后的测试库上执行。3. CI 的 compose 校验使用 `.env.production.example` 占位值，若未来该示例缺少 compose 引用的变量（非 `:-` 默认），校验会以 unset 变量告警但不会失败——正式环境变量完整性仍需部署脚本保证。

下次计划：N2（公网开发认证防护，需用户确认方案）→ N7（#7.3 收尾）→ N3/N4 等快速清理项；同时按阿里云部署路径推进自建认证。

### 轮次 42 – 2026-08-07

目标：#N2 —— 公网试用期开发认证防护。用户决策（2026-08-07）：选择方案二“浏览器密码提示”（Nginx Basic Auth）；并明确该门禁仅限非正式测试阶段，微信小程序上线、网页改用微信账号登录后必须取消。

引入点：N2 由 2026-08-07 第二轮全库复审（处女原则）登记；根因是轮次 39（16aea99）把试用期认证改为 `NODE_ENV=development + AUTH_DEV_MODE=true` 后，公网请求可构造任意 Bearer token 冒充任意 UID（含管理员）。

为什么现有测试没拦住：`pnpm verify` 与 `pnpm smoke:check-core` 均不覆盖 Nginx 容器行为/部署文件，单测也无法验证浏览器端 Basic Auth 交互；因此用真实 `nginx:1.27-alpine` 容器 + 无头 Edge 浏览器补运行验证。

修改文件：`infra/docker/nginx.prod.conf` → `nginx.prod.conf.template`（server 级新增 `auth_basic ${NGINX_BASIC_AUTH_REALM};` 与 `auth_basic_user_file ${NGINX_BASIC_AUTH_USER_FILE};`，由官方 nginx 镜像模板机制渲染，注释标明临时门禁与移除时机）；`infra/docker/compose.prod.yml`（web 服务新增两个环境变量，挂载改为 `/etc/nginx/templates/default.conf.template`，新增 `./.htpasswd:/etc/nginx/.htpasswd:ro`）；`.env.production.example`（新增 `NGINX_BASIC_AUTH_REALM=Trial_access` 及临时性说明）；`.gitignore`（忽略 `infra/docker/.htpasswd`）；`infra/docker/Dockerfile.web`（拷贝模板到 templates 目录，镜像默认 `NGINX_BASIC_AUTH_REALM=off`）；`docs/deployment/aliyun-ecs.md`（新增“试用期临时门禁”启用/关闭步骤，健康检查补带凭据示例）；`docs/deployment/production-readiness.md`（认证现状表与升级清单同步门禁及移除要求）。

语义等价审计与行为变化清单：`NGINX_BASIC_AUTH_REALM=off` 时与旧配置行为等价（`auth_basic off`，站点全放行；实测无 `.htpasswd` 文件也能正常启动）；非 `off` 时新增 401 门禁（静态页、`/api/*`、`/health` 全部受保护，浏览器先弹用户名/密码提示）。模板机制只替换显式声明的两个环境变量，`$host/$uri/$remote_addr` 等 nginx 运行时变量不受影响（实测渲染结果正确）。Dockerfile 镜像默认 off，仅 compose 试用环境按 `.env` 开启。

测试结果：改动前基线 `pnpm verify` 584/584 ✅（72 测试文件，隔离 MySQL）；改动后 `docker compose --env-file .env.production.example -f infra/docker/compose.prod.yml config --quiet` ✅；改动后 `pnpm verify` 584/584 ✅（72 测试文件）；`pnpm exec prettier --check ".github/**/*.yml" "docs/deployment/**/*.md"` ✅；`pnpm smoke:check-core` ✅（未涉及 Web 核心链路）。

运行/浏览器验证：真实 nginx:1.27-alpine 容器实测——开启门禁：无凭据 `curl` → 401 + `WWW-Authenticate: Basic realm="Trial_access"`，带凭据 → 200；关闭门禁（容器内无 `.htpasswd` 文件）→ 200 正常启动。无头 Edge（playwright-core）实测——开启门禁无凭据访问被浏览器拒绝（`net::ERR_INVALID_AUTH_CREDENTIALS`，页面内容不可见），带凭据 → 200 显示页面；关闭门禁无凭据 → 200。已于同日直接部署到 ECS 并启用：公网 `http://8.148.183.46/` 无凭据 401、带凭据 200，`/api/health` 无凭据 401/带凭据 200，真实浏览器（无头 Edge）无凭据被拒、带凭据进入登录页。

状态：#N2 ✅（已完成：已在 ECS 启用门禁并通过公网/浏览器实测；凭据仅存于服务器 `.htpasswd`，待用户浏览器复核）。

提交：7d78fe6（`feat(deploy): add temporary basic auth gate to trial nginx`）；docs checkpoint 提交见下方（推送结果见对话回复）。

不确定点：1. `infra/docker/.htpasswd` 必须先创建且权限必须让容器内 nginx 用户可读（`chmod 644`；`600` 会因 bind mount 保留宿主属主导致 nginx 读取时 `Permission denied`，带凭据请求 500）；compose 对不存在的挂载源会生成目录，忘记创建同样 5xx。2. nginx 在启动/重载时读取密码文件，修改 `.htpasswd` 后必须重建 web 容器才生效。3. Basic Auth 的用户名/密码是共用凭据，仅适合可信测试人员；微信登录落地后若未及时移除，用户会先被密码框拦住。

下次计划：N7（#7.3 时区转换收尾：领域包补 `formatChinaStandardTime`/`formatChinaDateTime` 纯函数并替换 8 个前端文件）→ N3/N4 等快速清理项；同时按阿里云部署路径推进自建/微信认证。

### 轮次 43 – 2026-08-07

目标：#N7 —— #7.3 时区转换收尾：领域包补 `formatChinaStandardTime`/`formatChinaDateTime` 纯函数，替换前端 7 个文件手写“偏移 + toISOString 截取”转换（N7 原文写 8 个，rg 全量核对实际命中 7 个）。

引入点：轮次 3（7a16c85）统一时区常量后，各功能文件仍保留各自“+8h → toISOString → slice”写法；这些写法分别随日历（ab25064）、请假（0d5ec55）、加扣班（5d8b205）、换班（b20ff9b）、事件中心（7ac2a07a）、响应式 PWA（db35a77）、请假全天化（0609cb5）、手动排班（b1ce5c7）引入，轮次 3/40 只统一了常量与部分字面量。

为什么现有测试没拦住：现有单测只锁定部分输出（event/leave/manual），swap/duty 时间格式与 calendar 班次时间范围没有行为锁定测试；纯 Node 单测也无法覆盖浏览器运行路径。

修改文件：`packages/scheduling-domain/src/time.ts` 新增 `formatChinaStandardTime`（HH:mm）与 `formatChinaDateTime`（可选 `includeSeconds`/`includeYear`），`getChinaStandardTimeBusinessDate` 改经新助手实现（行为等价）；`index.ts` 导出两个函数与选项类型。前端替换：`event-timeline.ts`（`formatEventTime`）、`calendar-logic.ts`（`formatShiftTimeRange`，删除本地 HH:mm 函数）、`calendar-views.ts`（`minutesInChinaStandardTime`，经格式化解析分钟数）、`swap-logic.ts`/`duty-adjustment-logic.ts`（`formatXShiftTime`，删除本地 MM-DD HH:mm 函数）、`leave-logic.ts`（`toChinaDate`/`formatCstDateTime`）、`manual-schedule-logic.ts`（`formatScheduleDraftCode`，用 `includeSeconds` 后压缩为草稿编号）；删除 7 个本地私有函数与全部前端 `chinaStandardTimeOffsetMilliseconds` 导入。新增锁定测试：领域 1 条（含 HH:mm/完整日期时间/含秒/不含年/无效拒绝断言），swap/duty 各 1 条时间范围，calendar 1 条班次时间范围。

语义等价审计与行为变化清单：所有有效输入输出逐字符等价（event/leave/manual 原测试与新增 swap/duty/calendar 锁定测试验证）；无效时间戳行为由 `toISOString()` 的 RangeError 变为统一 `The timestamp must be valid.` Error（调用方均为有效 API 数据，无实际影响）；`getChinaStandardTimeBusinessDate` 错误文案与输出不变；`minutesInChinaStandardTime` 对有效输入等值。

测试结果：基线 `pnpm verify` 584/584 ✅（72 测试文件，隔离 MySQL）；修改后 `pnpm verify` 588/588 ✅（72 测试文件，隔离 MySQL；新增 4 条：domain time 3→4、swap 4→5、duty 4→5、current-month-calendar 10→11）。

运行/浏览器验证：pnpm smoke:browser 通过（登录/管理员/成员/访客全流程无浏览器错误）；pnpm smoke:check-core 通过（未涉及 Web 核心链路，本次仍已执行浏览器冒烟）。

状态：#N7 ✅（已完成；纯显示层收敛，无用户界面文案变化，待用户强刷复核相关页面时间显示）。

提交：c356193（`refactor(domain): add China Standard Time formatting helpers`）；docs checkpoint 提交见下方（推送结果见对话回复）。

不确定点：1. `formatChinaDateTime` 的 `includeYear`/`includeSeconds` 是显示层选项；若未来需要其他格式（如带星期、12 小时制），应在领域包继续扩展而不是在各页面重写。2. swap/duty `formatXShiftTime` 保留了旧实现中的双空格样式（`08-02  00:00– 08:00`），本轮只收敛不修样式；若属文案瑕疵需另开轮。3. 无效时间戳错误类型统一为自定义 Error，未来若有人给这些格式化函数传无效值，错误文案与旧 `RangeError` 不同。

下次计划：N3（run-job 任务名单与 runner 映射收敛）→ N4（NoopPushDispatcher 死类清理）等快速清理项；同时按阿里云部署路径推进自建/微信认证。

### 轮次 44 – 2026-08-08

目标：#N3 —— run-job CLI 手写 7 项任务名单与 runner 穷举映射重复维护，改为单一来源。

引入点：`getJobName` 名单随任务功能在 52e9e1f/a837586 等提交中逐项累积；轮次 6（#3.3，8d54076）把 runner 收敛为 `Record<JobName, JobRunner>` 穷举映射后，CLI 名单未同步。

为什么现有测试没拦住：`runner.spec.ts` 只校验映射表内部一致性，不覆盖 CLI 解析；`getJobName` 与 `jobRunners` 之间没有编译期或运行时关联。

修改文件：`runner.ts` 新增并导出 `isJobName`（用 `Object.hasOwn(jobRunners, value)` 判断，不新增第二份名单）；`run-job.ts` 导入 `isJobName`/`jobNames`，Usage 文案改为 `jobNames.join('|')` 生成，`getJobName` 委托 `isJobName`；`runner.spec.ts` 新增 1 条锁定测试（全部 `jobNames` 均识别、未知/空值拒绝）。

语义等价审计与行为变化清单：合法任务名集合与拒绝路径不变；唯一行为变化是 Usage 文案顺序从旧手写顺序变为映射表插入顺序（7 个名字完整保留），不影响解析。

测试结果：N3 定向 `runner.spec.ts` 3/3 ✅；与 N4 一起全量 `pnpm verify` 589/589 ✅（72 测试文件，隔离 MySQL；runner.spec 2→3）。

运行/浏览器验证：`node apps/api/dist/jobs/run-job.js` 无参/未知任务均 exit=1，Usage 由映射表生成 7 个任务名；pnpm smoke:browser 通过（登录/管理员/成员/访客无浏览器错误）；pnpm smoke:check-core 通过（未涉及 Web 核心链路）。

状态：#N3 ✅（已完成，CLI 无用户界面变化）。

提交：8cf121f（`refactor(jobs): derive CLI job names from runner mapping`）；docs checkpoint 提交见下方（推送结果见对话回复）。

不确定点：1. Usage 文案顺序随映射表顺序变化；若外部脚本按旧顺序解析文案（不会，因为只是人读帮助文本），会看到不同顺序。2. `isJobName` 依赖 `Object.hasOwn`，若未来映射表原型被污染需改 `Object.create(null)`，当前无影响。3. CLI 入口有 DB/进程副作用，未做自动单测；由 `isJobName` 单测 + 手动运行验证覆盖。

下次计划：#N4（NoopPushDispatcher 死类清理）。

### 轮次 45 – 2026-08-08

目标：#N4 —— 删除从未被引用的 `NoopPushDispatcher` 死类。

引入点：52e9e1f 引入 `NoopPushDispatcher` 后从未被引用；`createPushDispatcher` 始终返回 `WebPushDispatcher`；轮次 8（#7.5）清理死代码时遗漏该类。

为什么现有测试没拦住：导出的死类不会触发 TypeScript/vitest 错误，也没有测试断言它存在。

修改文件：`notification-dispatcher.ts` 删除 `NoopPushDispatcher` 类；rg 全库确认无任何引用。

语义等价审计与行为变化清单：纯删除未导出且无引用的类，所有调用点不变，行为无变化。

测试结果：API typecheck 通过；全量 `pnpm verify` 589/589 ✅（72 测试文件，隔离 MySQL）。

运行/浏览器验证：无 Web 核心链路；pnpm smoke:browser 通过；pnpm smoke:check-core 通过。

状态：#N4 ✅（已完成，无用户界面变化）。

提交：7dfe54a（`refactor(notifications): remove unused NoopPushDispatcher`）；docs checkpoint 提交见下方（推送结果见对话回复）。

不确定点：1. 若未来需要“未配置推送时静默跳过”语义，应显式在 `WebPushDispatcher.send` 或调用方处理，而不是重新引入死类。2. 本次为纯删除，未改变 `createPushDispatcher({})` 的返回对象（仍是 `WebPushDispatcher`，`isConfigured=false`）。

下次计划：N5（idempotency 并发重复键返回 409）→ N8/N9 等快速清理项；同时按阿里云部署路径推进自建/微信认证。

### 轮次 46 – 2026-08-08

目标：#N5 —— idempotency “读无→再插”窗口内并发重复键从 500 改为 409。

引入点：`withIdempotentOperation` 的“读无→再插”重试路径自 3a082d8 引入；轮次 32（370bb87）只收紧首次 catch 为“仅重复键走查重/重放”，未处理重试插入再次撞唯一键的情况。

为什么现有测试没拦住：集成并发测试使用不同 operationId 或乐观锁路径，未覆盖“读无→再插”第二次插入撞唯一键；插件本身没有单测。

修改文件：`idempotency.ts` 抽取 `insertIdempotencyKey`/`resolveExistingOperation`；首次重复键仍查重/重放；若查无后重试插入再次重复键，捕获并抛 409“相同请求正在处理中，请稍后重试。”；新增 `idempotency.spec.ts` 确定性单测（两次插入均重复键、select 返回空 → 409，insert 调用 2 次）。

语义等价审计与行为变化清单：正常首次插入、已存在 completed 重放、processing 409、指纹不一致 409 路径全部保持；新增仅覆盖“查无→重试插入仍重复键”的窗口，原 500 变为 409。

测试结果：基线 `pnpm verify` 589/589 ✅；修改后 `pnpm verify` 596/596 ✅（73 测试文件，隔离 MySQL；新增 1 条 idempotency 单测，client.test 144→150）。

运行/浏览器验证：N8 涉及 contracts 核心链路，pnpm smoke:browser 通过（登录/管理员/成员/访客无浏览器错误）；pnpm smoke:check-core 通过（本轮记录满足校验）。

状态：#N5 ✅（API 语义：并发重复操作返回 409，无用户界面变化）。

提交：3199991（`fix(api): return 409 when idempotency retry insert races`）；docs checkpoint 提交见下方（推送结果见对话回复）。

不确定点：1. 二次重复键直接 409，不尝试再次查重放；若首个请求恰好在两次插入之间完成，第二个请求会收到“正在处理中”而不是已完成结果——属可接受的并发语义。2. 单测用假事务覆盖确定性窗口；真实数据库时序仍由现有并发集成测试兜底。

下次计划：#N8（contracts zod 收紧第一批）。

### 轮次 47 – 2026-08-08

目标：#N8 第一批 —— 消除 contracts 全部 `z.custom(() => true)`，并把 groups status 从“任意字符串”收紧为枚举；大量 `.passthrough()` 保留，留待下一批。

引入点：轮次 12–22 引入 zod schema 时，为保持旧守卫行为大量使用 `z.custom(() => true)`（leaves.ts 的 schema 自 cf6a61d 引入）；这些字段类型声明强但运行时零校验。

为什么现有测试没拦住：旧测试明确锁定“未知 status 也接受”“缺省字段接受”，没有无效值拒绝测试；`z.custom(() => true)` 对任何值放行。

修改文件：`groups.ts`（新增 `membershipClaimRequestStatusSchema` 枚举，status 由任意字符串收紧为 pending/approved/rejected/cancelled）；`leaves.ts`（新增 `leavePreviewAffectedShiftSchema`，`affectedShiftCount`/`affectedShifts`/`overlapsUnpublishedPeriod`/`periodVersions` 改真实校验）；`scheduling-config.ts`（`rulesVersion` 改 `z.number().int().optional()`）；`schedules.ts`（新增 `scheduleGenerationConflictSchema`，shift type/role count、period summary、generation preview 的 custom 全部改真实 schema）；`client.test.ts` 更新 1 条旧锁定（未知 status 由接受改拒绝）并新增 6 条拒绝测试。

语义等价审计与行为变化清单：合法响应全部保持；缺省字段仍可选；行为收紧为非法类型/未知枚举拒绝；API 实际输出均为合法值，前端正常响应不受影响。

测试结果：`pnpm verify` 596/596 ✅（73 测试文件，隔离 MySQL；client.test 144→150）。

运行/浏览器验证：contracts 核心链路有改动，pnpm smoke:browser 通过（登录/管理员/成员/访客无浏览器错误）；pnpm smoke:check-core 通过（本轮记录满足校验）。

状态：#N8 ✅（第一批完成；剩余 `.passthrough()` 未知键放行登记下一批）。

提交：5cf8aca（`refactor(contracts): replace permissive zod customs with real schemas`）；docs checkpoint 提交见下方（推送结果见对话回复）。

不确定点：1. `.passthrough()` 仍允许未知键，下一批需逐模型评估 `.strict()`，避免误拒未来兼容字段。2. 未知 membership claim status 从接受改为拒绝，若线上曾有历史未知状态会触发前端校验失败；当前业务只产生四种状态。3. `periodVersions` 改用 `z.record(z.string(), z.number())`，键仍不校验 UUID 格式（与旧行为一致）。

下次计划：#N9（mjs 格式门禁 + 清理 .prettierignore CloudBase 残留）。

### 轮次 48 – 2026-08-08

目标：#N9 —— format/format:check 覆盖 `scripts/*.mjs` 与 `packages/*/scripts/*.mjs`；删除 `.prettierignore` 的 CloudBase 残留。

引入点：`package.json` 格式脚本自建仓起未覆盖 mjs；`.prettierignore` 是 CloudBase 部署时代遗留，CloudBase 已弃用清理。

为什么现有测试没拦住：`format:check` 本身不检查 mjs，`pnpm verify` 全绿但不覆盖脚本格式。

修改文件：`package.json` 的 format/format:check 追加 `"scripts/*.mjs"` 与 `"packages/*/scripts/*.mjs"`；删除 `.prettierignore`；按新门禁格式化 `scripts/smoke-browser.mjs`（`generate-tokens-css.mjs` 已合规）。

语义等价审计与行为变化清单：纯工具链配置，无运行时行为变化；`format:check` 现在会拦截未格式化的 mjs 脚本。

测试结果：`pnpm format:check` 通过（含两个 mjs）；`pnpm verify` 596/596 ✅（73 测试文件，隔离 MySQL）。

运行/浏览器验证：无新增 Web 核心链路（contracts 已在轮次 47 冒烟）；pnpm smoke:browser 通过；pnpm smoke:check-core 通过。

状态：#N9 ✅（mjs 已有格式门禁，CloudBase 残留已清理）。

提交：9c2c799（`chore(format): include mjs scripts in prettier checks`）；docs checkpoint 提交见下方（推送结果见对话回复）。

不确定点：1. 工作区存在未跟踪 `scripts/ecs-auth-loop-evidence.mjs`（用户/外部生成）；为通过新门禁已做格式整理但未暂存、未提交，是否保留/删除由用户决定。2. 删除 `.prettierignore` 后若未来需要忽略特定脚本，应显式重建该文件。

下次计划：N10/N11/N12 快速清理（VITE_API_PROXY_TARGET 文档、project-status/CHANGELOG 文档滞后、工作区残留）；N6（cloudbaseUid 重命名）需数据库迁移，另排。

### 轮次 49 – 2026-08-08

目标：N6 去留决策 + N10/N11/N12 快速清理。

N6 决策：`cloudbaseUid`/`users.cloudbase_uid` 虽名为 CloudBase，但实际是“外部稳定 UID”载体——认证端口 `AuthPort`、用户注册/登录、群组认领、平台管理员、节假日管理员全部依赖它；CloudBase 弃用只删除了平台代码，不改变该字段的业务职责。重命名需数据库迁移且会大范围改动，收益仅为命名中性化；决策为**保留现名、关闭 N6**，等自建/微信认证落地时如需中性命名再随认证迁移一起改。

N10：`apps/web/vite.config.ts` 从 `defineConfig({...})` 改为函数式配置，用 `loadEnv(mode, 仓库根目录, '')` 读取 `VITE_API_PROXY_TARGET`，写入根目录 `.env` 现在真正生效；`.env.example` 注释同步。验证：`pnpm verify` 596/596 ✅，pnpm smoke:browser 通过。

N11：`docs/project-status.md` Known Environment 的“PWA shell/排班缓存当前为 v5”改为 v6（与 Current Position/代码 `cache-logic.ts` 一致）；`CHANGELOG.md` 新增 Unreleased 段，记录“弃用 CloudBase、阿里云 ECS、本地开发身份会话、临时门禁、PWA v6”；fix-progress 归档评估后暂不执行——文件仍是唯一切入点且 Git 历史已是持久记录，等调试阶段结束再归档。

N12：空目录 `cloudfunctions/` 已移动到系统临时目录（可恢复）；`logs/` 4 个日志文件（api-3000.err.log/api-3000.log/web-5173.err.log/web-5173.log）被当前本地 API/Web 进程占用，Windows 拒绝移动/删除，本轮未强删；登记为待本地服务停止后清理。

测试结果：`pnpm verify` 596/596 ✅（73 测试文件，隔离 MySQL；N10 无新增测试，web build 覆盖 vite.config）。

运行/浏览器验证：vite.config/.env.example 属核心链路，pnpm smoke:browser 通过（登录/管理员/成员/访客无浏览器错误）；pnpm smoke:check-core 通过（本轮记录满足校验）。

状态：N6 ✅（决策关闭）、N10 ✅、N11 ✅、N12 ⏳ 部分完成（logs 待服务停止后清理）。

提交：5e7dd5e（`fix(web): load VITE_API_PROXY_TARGET from root env`）；docs checkpoint 提交见下方（推送结果见对话回复）。

不确定点：1. `loadEnv(..., '')` 会加载根目录 `.env` 全部变量到 Node 侧配置；Vite 仍按自身规则只暴露 `VITE_` 前缀给浏览器，不影响运行时。2. logs 文件被占用是本地开发环境状态，CI/新检出无此问题；停止本地服务后可执行 `Remove-Item logs/*.log`。3. N11 未做 fix-progress 物理归档，文件仍约 190KB；后续如需瘦身需另开一轮专门归档。

下次计划：N12 收尾（停止本地 dev 后清理 logs）→ N13（vite 分包）/N14（测试库 tmpfs 上限）等；N8 第二批（`.passthrough()` 收紧）继续排队；部署路径继续推进。

### 轮次 50 – 2026-08-08

目标：N12 收尾 + N13/N14 + N8 第二批（`.passthrough()` 收紧）。

N12：按用户授权停止本地 API/Web 服务（含 pnpm 父进程与 node 子进程），把 `logs/` 整个目录移动到系统临时目录（可恢复），再以原命令隐藏窗口重启服务；端口 3000/5173 恢复监听，`logs` 目录不再存在。

N13：`apps/web/src/router/index.ts` 将 AppLayout/HomeView/LoginView/GuestScheduleView 全部改为动态导入；`apps/web/vite.config.ts` 增加 `manualChunks`（vendor-vue/vendor-tdesign/vendor-query）。构建结果：入口主包从约 1,916KB 降至约 122KB，HomeView 约 212KB、vendor-vue 约 239KB 独立；`vendor-tdesign` 约 1.27MB 仍超 500KB（TDesign 全量引入），属已知可选项，需按需引入再拆。

N14：`infra/docker/compose.test.yml` 改为 `command: ["--disable-log-bin"]` 并把 tmpfs 从 512m 提到 1g；`docker compose --env-file .env -f infra/docker/compose.test.yml config --quiet` 通过；`down --volumes` 重置后 MySQL 健康，全量 verify 通过且未再出现 `ABORT_SERVER`。

N8 第二批：对 `packages/contracts/src` 全部 15 个文件的 99 处 `.passthrough()` 批量改为 `.strict()`；`apps/web/src/api/client.test.ts` 的“接受 holidays 未知字段”测试反转为“拒绝未知字段”（行为收紧的预期变化）；`rg` 确认 `.passthrough()` 与 `z.custom(() => true)` 均已清零。

语义等价审计与行为变化清单：合法响应（API 实际输出）保持不变；任何未在 schema 声明的未知键现在会被客户端拒绝，与类型声明严格一致；唯一旧测试锁定“接受未知字段”被反转为“拒绝”。N13/N14 为构建/测试基础设施变化，不改变业务响应。

测试结果：`pnpm verify` 596/596 ✅（73 测试文件，隔离 MySQL；测试数不变，1 条行为锁定反转）；`docker compose config --quiet` ✅。

运行/浏览器验证：contracts/vite.config 属核心链路，pnpm smoke:browser 通过（登录/管理员/成员/访客无浏览器错误）；pnpm smoke:check-core 通过（本轮记录满足校验）。

状态：N12 ✅、N13 ✅、N14 ✅、N8 ✅（第二批完成，TODO 全部收口）。

提交：1368e7a（`fix(docker): harden isolated test database limits`）/ 167c92f（`perf(web): lazy-load routes and split vendor chunks`）/ d779371（`refactor(contracts): enforce strict read model shapes`）；docs checkpoint 提交见下方（推送结果见对话回复）。

不确定点：1. N13 后仍有 `vendor-tdesign` 1.27MB 警告；若需彻底消除需改为按需引入 TDesign（unplugin-vue-components），另开轮。2. `--disable-log-bin` 仅作用于隔离测试库；开发/线上 MySQL 仍按原配置运行，不影响备份/恢复。3. `.strict()` 后若未来 API 增加兼容字段而未同步 schema，客户端会拒绝旧版本缓存；PWA 缓存升级已配合，后续加字段需同步契约。

下次计划：TODO N1–N14 已全部收口；按阿里云部署路径推进（自建/微信账号认证 → 域名/ICP/HTTPS → 定时任务 cron → 正式 MySQL/最小权限账号 → 重新生成 `runtime/api-flat` 后部署）；可选优化：TDesign 按需引入以消除 vendor 大块警告。

### 轮次 51 – 2026-08-08

目标：TDesign 按需引入（用户选择方案 A）——只打包页面实际用到的 TDesign 组件，消除 1.27MB 整包 vendor。

引入点：`main.ts` 一直通过 `use(TDesign)` 全量注册并引入全量 CSS；N13 手动分包把 `tdesign-vue-next` 整个打进 `vendor-tdesign`（1,270KB raw / 333KB gzip）。

为什么现有测试没拦住：构建体积警告不是测试失败；若生成严格组件类型声明，会暴露模板中原本被宽松类型掩盖的 Select/Switch/Table 类型问题（属既有隐患，不在本轮范围）。

修改文件：`apps/web/package.json`/`pnpm-lock.yaml`（新增 `unplugin-vue-components` devDependency）；`apps/web/vite.config.ts`（加入 `Components` 插件与 `TDesignResolver({ library: 'vue-next' })`，`dts: false`，移除 `vendor-tdesign` 强制分包）；`apps/web/src/main.ts`（删除 `import TDesign`、全量 CSS 与 `.use(TDesign)`）。

语义等价审计与行为变化清单：项目只使用 `<t-*>` 模板组件，无 MessagePlugin/DialogPlugin 等编程式 API；自动扫描会按模板出现的组件逐个引入并附带组件样式，运行时 UI 行为不变。`dts: false` 不生成全局组件类型声明，保留原有 vue-tsc 行为，避免顺手修改 10 余个模板的类型问题（处女原则）。

测试结果：`pnpm verify` 596/596 ✅（73 测试文件，隔离 MySQL）；构建产物不再有 `vendor-tdesign` 1.27MB 大包；HomeView 路由块 603.82KB raw / 159.49KB gzip（仍超 500KB 警告，但远小于原整包，属页面内容本身，可后续再拆）。

运行/浏览器验证：pnpm smoke:browser 通过（登录/管理员/成员/访客无浏览器错误）；额外浏览器语义检查——登录/工作台/访客页面 `.t-card/.t-button/.t-input/.t-loading` 等 TDesign 组件均真实渲染、无 console/page 错误；pnpm smoke:check-core 通过（本轮记录满足校验）。

状态：TDesign 按需引入 ✅（可选优化完成）。

提交：367a584（`perf(web): import TDesign components on demand`）；docs checkpoint 提交见下方（推送结果见对话回复）。

不确定点：1. `dts: false` 意味着编辑器不会自动补全 TDesign 组件类型，未来若需要严格类型，需另开轮修复模板类型并启用生成声明。2. HomeView 仍 >500KB，后续可继续按功能/面板拆路由子块。3. 自动扫描只识别模板里静态出现的 `<t-xxx>`；当前无动态字符串组件名，若有需显式导入。

下次计划：按阿里云部署路径推进（自建/微信账号认证 → 域名/ICP/HTTPS → 定时任务 cron → 正式 MySQL/最小权限账号 → 重新生成 `runtime/api-flat` 后部署）；可选：HomeView 进一步拆包、模板类型严格化。

### 轮次 52 – 2026-08-08

目标：撤除试用期 Nginx 密码门禁（用户反馈登录反复弹密码框），并把阿里云 ECS 同步到本地最新构建（用户反馈服务器版本落后、与本地不一致）。

引入点：门禁冲突引入点 = 轮次 42 部署（`nginx.prod.conf.template` 的 `auth_basic` 与前端 `client.ts` 的 `Authorization: Bearer` 冲突）；版本落后引入点 = 轮次 39–51 的代码/依赖从未部署到 ECS（服务器仍运行 8-06 构建的 API 镜像、旧 web dist、含 `@cloudbase` 依赖的旧 api-flat）。

为什么现有测试没拦住：`pnpm verify`/`smoke:check-core` 不覆盖 nginx 与浏览器 HTTP auth 的交互；真实浏览器证据——点击“本地管理员”后 `GET /api/users/me` 携带 `Authorization: Bearer local-admin`，nginx 返回 401 + `WWW-Authenticate: Basic realm="Trial_access"`，浏览器对显式 Authorization 请求不会附带缓存的 Basic 凭据，形成弹框循环。

修改文件：`infra/docker/nginx.prod.conf.template` → 恢复静态 `nginx.prod.conf`（删除 `auth_basic`）；`infra/docker/compose.prod.yml`（删除门禁环境变量/挂载，新增 API 与三个 packages dist 的宿主挂载，供试用机运行最新接口代码）；`infra/docker/Dockerfile.web`（回滚为静态配置）；`.env.production.example`/`.gitignore`（清理门禁残留）；`docs/deployment/aliyun-ecs.md`（删除门禁章节，新增“更新代码（试用机不编译）”步骤：`pnpm deploy --legacy --config.node-linker=hoisted` 生成全平铺无符号链接依赖树后上传）；`docs/deployment/production-readiness.md`（移除门禁说明，登记公网开发模式认证风险）。

服务器操作（ECS）：上传最新 web dist/api dist/packages dist；重新生成 `runtime/api-flat/node_modules`（`pnpm deploy --legacy --config.node-linker=hoisted --filter @schedule/api --prod`，产物 77 个顶层包、无 `@cloudbase`、无符号链接）；删除 `.htpasswd`/模板/备份文件；`.env.production` 移除门禁变量；重建 api/web 容器（旧产物保留为 `*.old-20260808*` 备份）。

语义等价审计与行为变化清单：移除门禁后站点恢复轮次 41/39 的无认证挑战状态（`/`、`/api/*`、`/health` 全部直接可达）；API 改为宿主挂载最新 dist + 最新平铺依赖树（与旧镜像相比：移除 CloudBase 依赖、包含轮次 39–51 全部修复）；web dist 更新为轮次 51（TDesign 按需引入）提交后的当前构建，与仓库 HEAD 一致。

测试结果：`pnpm verify` 596/596 ✅（73 测试文件，隔离 MySQL）；`docker compose --env-file .env.production.example -f infra/docker/compose.prod.yml config --quiet` ✅；prettier（github yml + deployment md）✅；`pnpm smoke:browser` ✅（登录/管理员/成员/访客全流程无浏览器错误）；`pnpm smoke:check-core` ✅（记录满足校验）。

运行/浏览器验证：ECS 实测——`/` 与 `/api/health` 200、响应无 `WWW-Authenticate`；真实浏览器（无头 Edge，公网 `http://8.148.183.46`）打开无弹框，点击“本地管理员”直接进入排班工作台（群组“头颈外科医生”、2026-08 日历、全部菜单加载正常；`/api/users/me`、通知、群组、日历、节假日请求全部 200，无认证挑战、无控制台错误）；API 容器内 `@cloudbase` 已不存在，`local-server.js` MD5 与本地构建一致（39B25A86…）。

状态：#N2 门禁 ✅ 已撤除（已完成：公网浏览器实测通过，待用户浏览器复核）；ECS 已同步本地最新构建。

提交：630289c（`revert(deploy): drop trial basic auth gate and mount current api dists`）；docs checkpoint 提交见下方（推送结果见对话回复）。

不确定点：1. 部署的 web dist 为轮次 51（TDesign 按需引入）提交后的构建，与仓库 HEAD 一致；后续前端再改动时需按 aliyun-ecs.md 重新同步。2. api-flat 改用 `node-linker=hoisted` 全平铺模式生成（旧产物为含符号链接的隔离模式，Windows 下无法正确拍平跨平台传输）；依赖变更后必须按 aliyun-ecs.md 重新生成。3. 服务器保留旧产物备份（`node_modules.old-20260808`、`dist.old-20260808b` 等），确认稳定后可清理。

下次计划：按阿里云部署路径推进（自建/微信账号认证 → 域名/ICP/HTTPS → 定时任务 cron → 正式 MySQL/最小权限账号）；前端/接口再改动时按 aliyun-ecs.md 同步 ECS。

### 轮次 53 – 2026-08-08

目标：把轮次 42/52 线上部署踩过的坑与最终解法沉淀为“下次部署必读”的规则文档，避免重复踩坑（纯文档）。

引入点：轮次 42（门禁部署）与轮次 52（撤除门禁 + ECS 同步）实战中累计的命令引号、依赖树拍平、挂载目录、认证架构、并行会话协作等问题。

修改文件：新增 `docs/deployment/ecs-deployment-pitfalls.md`（七节：命令执行铁律、api-flat 依赖树生成铁律、挂载与容器铁律、不再犯的架构坑、部署后验证清单、多会话/多轮次并行规则、环境速查）；`docs/deployment/aliyun-ecs.md` 顶部加“部署前必读”链接；`docs/project-status.md` 必读清单并入该文件并记录轮次 53；debug 日志同步。

内容要点：PowerShell→SSH 的引号吞噬/`$(...)` 本机执行/BOM 陷阱及 `bash -s` 解法；`pnpm deploy --legacy --config.node-linker=hoisted` 是唯一可靠的跨平台依赖树拍平法（junction 树 tar/cp 均会丢嵌套依赖，症状为 `Cannot find package 'mysql2'`）；替换被容器挂载的目录后必须重建容器；本应用禁止再加 Basic Auth 门禁（与 Bearer 冲突）；部署后验证清单（curl/健康检查/资源名/容器内无 @cloudbase/MD5/真实浏览器登录）。

测试结果：纯文档；`pnpm exec prettier --check "docs/deployment/**/*.md"` ✅；`pnpm smoke:check-core` ✅（未涉及核心链路）。

运行/浏览器验证：无运行时变化；不涉及 Web 核心链路。

状态：✅（规则已沉淀，下次部署必读）。

提交：见下方代码提交 + docs checkpoint 提交（推送结果见对话回复）。

不确定点：1. 规则基于 Windows 开发机 + Linux ECS 的实测；若未来换部署机（macOS/Linux 开发机），PowerShell 相关条目可归档，其余（hoisted 拍平、挂载重建、验证清单）仍然有效。2. 若未来决定重新加访问控制，必须按本文件第四节先解决 Bearer 冲突再上线。3. `runtime/api-flat` 依赖树每次生成后都要跑本地验证清单，避免把缺失包推到线上。

下次计划：按阿里云部署路径推进（自建/微信账号认证 → 域名/ICP/HTTPS → 定时任务 cron → 正式 MySQL/最小权限账号）；前端/接口再改动时按 `aliyun-ecs.md` + `ecs-deployment-pitfalls.md` 同步 ECS。

- `.github/workflows/verify.yml` 把 `pnpm build` 与 `pnpm test` 并行启动，而 CI 是全新检出（dist 不入库），测试可能先于构建完成解析 `@schedule/database`/`@schedule/scheduling-domain` 等包入口而失败——2026-08-06 轮次 8/9 前后多个 Verify 失败的根因（`gh run view <id> --log-failed` 可复现，报 `Failed to resolve entry for package`）。建议后续轮次改为 build 完成后再启动 test；本轮未动。
  > 完成情况（轮次 40）：`verify.yml` 的 Build and run tests 改为 `pnpm build` 完成后才启动 `pnpm test`（顺序执行，检查内容不变）。
- `tests/security` typecheck 因 `apps/api/src/modules/notifications/notification-dispatcher.ts` 引用的 `web-push` 缺类型声明而失败（apps/api 自身 typecheck 有 `src/types/web-push.d.ts` 覆盖；tests/security 的 tsconfig include 不含该声明；轮次 38 发现，登记于 project-status/debug 日志）。
  > 完成情况（轮次 40）：`tests/security/tsconfig.json` include 增加 `../../apps/api/src/types/**/*.d.ts`（指向唯一声明源），`pnpm --filter @schedule/security-tests typecheck` 通过。

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

### 轮次 28 – 2026-08-07

目标：#4.3 子步骤 2a —— 收敛三服务各自实例化的依赖为共享 `WorkflowServices` 容器（eventWriter/notificationWriter/permissionService/memberReader/workflowConflictService/statisticsService/workflowSelfHealingService），三服务全部改经容器引用。

引入点：三服务自功能开发起各自 `new` 同一套依赖（审计卡 #4.3 登记，无单一引入提交）。

为什么现有测试没拦住：实例化与引用方式不影响行为，单测无法感知；本轮用 swap 31 + duty 24 + leave 19 集成测试作为回归网。

修改文件：新增 `apps/api/src/modules/workflows/workflow-services.ts`（共享依赖容器，构造无副作用）；`apps/api/src/modules/swaps/swap-service.ts`、`apps/api/src/modules/duty-adjustments/duty-adjustment-service.ts`、`apps/api/src/modules/leaves/leave-service.ts` 删除各自 7/7/5 个依赖字段与构造逻辑，改为 `private readonly services = new WorkflowServices(databaseClient)`，131 处 `this.<dep>` 引用机械替换为 `this.services.<dep>`；类型导入保留（GroupMemberRow/ActiveGroup/GroupAuthorization/WorkflowConflict 等）。

语义等价审计：同一依赖类实例、同一构造参数（databaseClient），方法调用点逐一不变；leave 新增未使用的 memberReader/selfHealing 实例（构造无副作用），无行为差异；app.ts 的 `new XxxService(databaseClient)` 构造方式不变。

测试结果：`pnpm verify` 579/579 ✅（71 个测试文件，隔离 MySQL）；定向集成 swap 31/31、duty 24/24、leave 19/19（`NODE_ENV=test` + `TEST_MYSQL_*`，隔离库 3307）。

运行/浏览器验证：未涉及 Web 核心链路（web api/auth/router/pwa/session/contracts/vite 配置/.env.example 均无改动）；pnpm smoke:check-core 通过（无核心链路变更）。

状态：已完成（#4.3 子步骤 2a；#4.3 整体进行中）。

提交：65bed71（`refactor(workflows): consolidate shared workflow dependencies`），推送结果见对话回复

不确定点：1. leave 现在会构造未使用的 memberReader/selfHealing 实例（无副作用、开销可忽略）；若希望按需注入，可改为可选字段或构造参数。2. `runAuthorizedMutation` 仍为独立函数并接收 databaseClient/permissionService 参数；后续可移入容器方法进一步简化调用点。3. 三服务的 runXxx 领域逻辑仍各自保留（入口骨架已抽、依赖已收敛，状态机迁移留待后续子步骤）。

下次计划：#4.3 子步骤 2b（leave 入口迁移：骨架增加错误钩子支持 approve 冲突通知，迁移 approve/reject/cancel/revoke，评估 submit 幂等化）；同时等待用户强刷复核轮次 57、54、53、52、51、50、49、48、47、46 及 23/24 相关验收项。

### 轮次 29 – 2026-08-07

目标：#4.3 子步骤 2b —— leave approve/reject/cancel/revoke 迁移到共享入口骨架；骨架新增 `onError` 钩子支持 approve 被冲突拦截时写通知；评估 submit 幂等化。

引入点：同 #4.3 审计卡（三服务入口样板自功能开发起复制演进）。

为什么现有测试没拦住：样板重复不改变行为，单测无法感知；leave 19 条集成测试（含幂等重放、冲突拦截通知路径）作为本轮回归网。

修改文件：`apps/api/src/modules/workflows/workflow-operation.ts`（改为 `async` + try/catch，新增可选 `onError`：事务回滚后、错误重新抛出前执行）；`apps/api/src/modules/leaves/leave-service.ts`（approve 用 `onError` 承载原 catch 的 `writeConflictNotification` 逻辑，reject/cancel/revoke 迁移到骨架，删除 `withIdempotentOperation` 导入）。

语义等价审计：approve 原 catch 在 `withTransaction` 拒绝后判断 `isConflictBlockedError`、写冲突通知、再 rethrow；`onError` 在相同位置执行相同过滤与写入，错误仍 rethrow；reject/cancel/revoke 与 swap/duty 迁移同构（权限名、scope、指纹、run 回调逐一相同）；submit 保持原实现——`CreateLeaveRequestInput` 无 operationId，幂等化需改契约/路由/前端调用点，属 API 变更，评估结论为另开轮处理。

测试结果：`pnpm verify` 579/579 ✅（71 个测试文件，隔离 MySQL）；定向集成 swap 31/31、duty 24/24、leave 19/19（`NODE_ENV=test` + `TEST_MYSQL_*`，隔离库 3307）。

运行/浏览器验证：未涉及 Web 核心链路（web api/auth/router/pwa/session/contracts/vite 配置/.env.example 均无改动）；pnpm smoke:check-core 通过（无核心链路变更）。

状态：已完成（#4.3 子步骤 2b；#4.3 整体进行中，剩 swap `revokeCompleted` 与 submit 幂等化评估）。

提交：7fcd6ae（`refactor(workflows): migrate leave entries to shared mutation skeleton`），推送结果见对话回复

不确定点：1. `onError` 钩子对 swap/duty 现有调用无影响（未传则不执行），骨架改为 async 后语义不变。2. submit 幂等化需要给 `CreateLeaveRequestInput` 加 operationId（契约/路由/Web 调用点），属 API 变更，待用户/后续轮次决定。3. swap `revokeCompleted` 的前置锁定 + 角色预检仍未迁移，待骨架支持 `beforeIdempotentOperation` 钩子。

下次计划：#4.3 收尾（swap `revokeCompleted` 前置检查钩子迁移；submit 幂等化决策）；完成后再标记 #4.3 ✅，并按清单转 #4.4（两个软删除函数合并）；同时等待用户强刷复核既有轮次。

### 轮次 30 – 2026-08-07

目标：#4.3 收尾（swap `revokeCompleted` 前置检查迁移 + submit 幂等化评估）+ #4.4（两个软删除函数合并）。

引入点：#4.3 三件套/入口样板复制（审计卡）；#4.4 `softDeleteAssignmentsBefore` 与 `softDeleteAssignments` 整段复制（审计卡）。

为什么现有测试没拦住：样板与重复 SQL 不改变行为，单测无法感知；swap 31 + schedule-repository 5 集成测试作为本轮回归网。

修改文件：`apps/api/src/modules/workflows/workflow-operation.ts`（新增 `beforeIdempotentOperation` 钩子：鉴权后、幂等键写入前执行）；`apps/api/src/modules/swaps/swap-service.ts`（`revokeCompleted` 迁移到骨架，锁定请求 + 成员/管理员预检放入钩子，删除 `withIdempotentOperation` 导入——swap 全部 7 个入口完成迁移）；`apps/api/src/modules/schedules/schedule-repository.ts`（`softDeleteAssignments` 增加可选 `beforeBusinessDate` 参数并追加 `lt(businessDate, beforeBusinessDate)` 条件，删除 `softDeleteAssignmentsBefore`，3 处调用点改传第三参）。

语义等价审计：revokeCompleted 预检仍在同一事务内、幂等键写入之前执行（FORBIDDEN 先于幂等冲突的优先级不变），`runSwapRevocation` 不变；软删除合并函数在无/有 `beforeBusinessDate` 时生成的 where 分别与旧函数逐字等价，空列表提前返回与 `updateShiftAssignments` 调用不变；submit 幂等化评估——`CreateLeaveRequestInput` 无 operationId，幂等化需改契约/路由/Web 调用点（API 变更），评估结论保持现状、另开轮，本轮不改契约。

测试结果：`pnpm verify` 579/579 ✅（71 个测试文件，隔离 MySQL）；定向集成 swap 31/31、schedule-repository 5/5（`NODE_ENV=test` + `TEST_MYSQL_*`，隔离库 3307）。

运行/浏览器验证：未涉及 Web 核心链路（web api/auth/router/pwa/session/contracts/vite 配置/.env.example 均无改动）；pnpm smoke:check-core 通过（无核心链路变更）。

状态：#4.3 ✅（轮次 27–30：入口骨架、依赖容器、leave/swap 全部入口迁移完成；领域 run 函数保留为服务内差异层）；#4.4 ✅。

提交：e5608cf（`refactor(api): complete workflow entry skeleton and merge soft delete helpers`），推送结果见对话回复

不确定点：1. submit 未幂等化（契约无 operationId）；若用户希望防重复提交，需另开轮改契约与前端调用点。2. `beforeIdempotentOperation` 钩子目前仅 swap `revokeCompleted` 使用，未来其他前置检查可复用。3. 领域 runXxx 状态机主体仍在各服务内（事件/通知/实际人员更新差异大），#4.3 按“共享骨架 + 领域差异”口径完成；若后续要彻底抽状态机，需架构决策。

下次计划：按清单继续 #3.5（idempotency 宽 catch 当重复键，检查 1062 错误码）；#4.5/#7.6 待用户确认后处理；同时等待用户强刷复核轮次 57、54、53、52、51、50、49、48、47、46 及 23–30 相关验收项。

### 轮次 31 – 2026-08-07

目标：#4.5（用户确认方案 1：整月早于当前业务月才拒绝，当月/今天允许，已过日期由保留既往逻辑保护）+ #7.6（用户确认方案 A：移除“调”映射与渲染，保留历史事件数据，不做数据迁移）。

引入点：#4.5 发布/生成缺“仅未来日期”校验（审计卡，功能缺口）；#7.6 `manual-adjustment` 半移除（审计卡，调试日志宣称已移除但映射仍在）。

为什么现有测试没拦住：生成/发布测试只用当前/未来月份，未覆盖整段已过月份；日历测试锁定了旧“调”映射（断言其存在），未按“已移除”口径更新。

修改文件：#4.5——`apps/api/src/modules/schedules/shared.ts` 新增 `assertBusinessMonthNotFullyPast`（复用 domain `isPastBusinessMonth`，整月早于当前业务月 → 409 并提示前往“排班补录”），`generate-service.ts` 的 `loadGenerationContext` 与 `publish-service.ts` 的 `publishInTransaction` 接入；`schedule-generation.integration.test.ts` 新增 2 条（生成预览/保存整段已过月份 409、发布整段已过月份草稿 409）。#7.6——`packages/contracts/src/calendar.ts` 从 `calendarChangeMarkerSchema` 移除 `manual-adjustment`；`apps/api/src/modules/calendar/calendar-query.ts` 移除 `assignment_manually_updated` 的标记映射与事件类型列表；Web `calendar-logic.ts` 移除“调/人工调整”标签；`event-timeline.ts` 移除 `assignment_manually_updated`/`schedule_backfill_completed` 的标记映射（事件叙述保留）；`PastScheduleView.vue` 移除 `hide-marker-types`；`apps/web/src/pwa/cache-logic.ts` shell/schedule 缓存 v5 → v6（旧缓存含 `manual-adjustment` 标记，避免新 schema 校验拒绝）；测试更新（calendar 映射返回 undefined、client 拒绝旧标记、current-month 标记清单）。

语义等价审计与行为变化清单：#4.5 仅新增拒绝路径——整段已过月份（早于当前业务月）的生成/发布从“可执行”变为 409 并提示补录；当月/未来月份行为不变。 #7.6 行为变化——日历不再产生/显示“调”标记；旧 `assignment_manually_updated` 事件数据保留但不再渲染为“调”；事件中心的“人工调整班次/排班补录”叙述保留；客户端对含 `manual-adjustment` 的日历载荷会拒绝（配合缓存升级 v6 规避旧缓存）。

测试结果：`pnpm verify` 581/581 ✅（71 个测试文件，隔离 MySQL；新增 2 条生成/发布守卫测试）；定向集成 schedule-generation 9/9、calendar 11/11（`NODE_ENV=test` + `TEST_MYSQL_*`，隔离库 3307）。

运行/浏览器验证：pnpm smoke:browser 通过（登录/管理员/成员/访客全流程，无浏览器错误）；pnpm smoke:check-core 通过（涉及 `packages/contracts/src` 与 `apps/web/src/pwa`，记录已满足校验）。

状态：#4.5 ✅、#7.6 ✅（待用户强刷复核：PWA 缓存升级后日历不再显示“调”、生成/发布过去月份提示补录）。

提交：60d918a（`feat(schedules): reject fully past months and drop manual-adjustment marker`），推送结果见对话回复

不确定点：1. `isPastBusinessMonth` 按业务月判断：月初生成/发布当月仍允许（已过日期由保留既往逻辑保护）；若希望“新周期不得覆盖今天之前的任何日期”，需按日校验，另开轮。2. 旧 PWA 缓存若未被 v6 清理前可能短暂报错，需用户强刷/重新注册。3. 事件中心仍保留“人工调整班次/排班补录”叙述（无标记徽标）；若希望连叙述也移除需另行决策。

下次计划：按清单继续 #3.5（idempotency 宽 catch 当重复键，检查 1062 错误码）；同时等待用户强刷复核本轮与轮次 57、54、53、52、51、50、49、48、47、46 及 23–30 相关验收项。

### 轮次 32 – 2026-08-07

目标：#3.5 —— idempotency 首次 insert 的宽 catch 改为仅当 MySQL 重复键（`ER_DUP_ENTRY`）才走“查重/重放/冲突”路径，其他数据库错误立即抛出，避免故障路径做两次无谓插入尝试。

引入点：宽 catch 自 idempotency 功能引入起存在（审计卡 #3.5 登记，无单一引入提交）。

为什么现有测试没拦住：现有集成测试只覆盖重复键重放路径（真实重复键行为不变），未覆盖“非重复键错误不再被吞并重试”的断言；新增 `database-error.spec.ts` 4 条锁定 `getDatabaseErrorCode`（code/cause 链/非对象）与 `isDuplicateKeyError`。

修改文件：新增 `apps/api/src/database-error.ts`（`getDatabaseErrorCode` 沿 code/cause 链读取驱动错误码 + `isDuplicateKeyError`）与 `database-error.spec.ts`；`apps/api/src/plugins/idempotency.ts` 的 catch 改为 `if (!isDuplicateKeyError(error)) throw error;` 后再查重。

语义等价审计：重复键路径（查重、指纹冲突、completed 重放、processing 冲突、过期后重试）逐分支不变；非重复键错误从“读一次再插一次后仍抛错”变为“立即抛出”——异常最终仍会传播（与旧行为最终一致），但不再做两次无谓数据库尝试，这是本项修复的目标行为变化。

测试结果：`pnpm verify` 585/585 ✅（72 个测试文件，隔离 MySQL；新增 4 条数据库错误助手测试）；定向集成 swap 31/31（含幂等重放，`NODE_ENV=test` + `TEST_MYSQL_*`，隔离库 3307）。

运行/浏览器验证：未涉及 Web 核心链路（web api/auth/router/pwa/session/contracts/vite 配置/.env.example 均无改动）；pnpm smoke:check-core 通过（无核心链路变更）。

状态：#3.5 ✅。

提交：370bb87（`fix(api): treat only duplicate key errors as idempotency replays`），推送结果见对话回复

不确定点：1. mysql2 重复键错误码依赖驱动形态（`code='ER_DUP_ENTRY'`，可能包在 `cause` 里）；helper 已覆盖直接/包装两种形态，若未来换驱动需同步。2. group-service 私有 `getDatabaseErrorCode` 与 user-service 内联 `ER_DUP_ENTRY` 检查仍各自实现，可后续统一到本助手（未顺手改）。3. 并发双请求同时插入：一个成功、一个 ER_DUP_ENTRY 后进入 processing 冲突分支返回 409（行为不变）。

下次计划：按清单继续 #3.6（CloudBase 处理器惰性单例竞态，顶层创建或 Promise 单例化）；同时等待用户强刷复核轮次 31 及轮次 57、54、53、52、51、50、49、48、47、46 及 23–30 相关验收项。

### 轮次 33 – 2026-08-07

目标：#5.1（notification-retry 的 skipped 如实计数）+ 决策登记（CloudBase 专属项 #3.6/#9.1/#9.2 暂缓）。

用户决策（2026-08-07）：后续可能弃用 CloudBase 改用阿里云；CloudBase 专属修复暂不投入，登记为“待平台去留决策”。若最终保留 CloudBase，按原卡片继续 #3.6/#9.1/#9.2；若弃用，另开一轮清理 CloudBase 专用代码（cloudbase-handler、cloudbase 认证适配、cloudbaserc、deploy-development workflow 等）。

引入点：#5.1 skipped 计数缺失自通知重试功能引入起存在（审计卡登记）；#3.6/#9.1/#9.2 为 CloudBase 专属项。

为什么现有测试没拦住：现有集成测试只断言“未配置推送时 skipped ≥1”与失败重试路径，未覆盖“配置后通知缺失/订阅缺失应计 skipped”；新增 1 条集成测试（孤儿投递 + 有通知无订阅 → skipped=2、failed=0），旧代码上 failed=2 失败。

修改文件：`apps/api/src/jobs/notification-retry.ts`（`processDelivery` 返回 `'failed' | 'sent' | 'skipped'`：投递行缺失/非 pending、通知记录不存在、推送订阅失效 → `'skipped'`；发送异常/重试耗尽仍 `'failed'`；`run()` 配置路径如实累计 skipped）；`apps/api/src/modules/notifications/notifications.integration.test.ts`（新增计数回归测试）。

语义等价审计与行为变化清单：仅改变计数器口径与 `processDelivery` 返回值；投递行状态更新（skipped/failed/sent）、重试节奏、未配置路径 `markPendingSkipped` 不变；skipped 从“仅未配置路径有值”变为“配置路径中通知/订阅缺失也如实计数”，运维可区分发送失败与跳过。

测试结果：`pnpm verify` 586/586 ✅（72 个测试文件，隔离 MySQL）；定向集成 notifications 8/8（`NODE_ENV=test` + `TEST_MYSQL_*`，隔离库 3307）。

运行/浏览器验证：未涉及 Web 核心链路（web api/auth/router/pwa/session/contracts/vite 配置/.env.example 均无改动）；pnpm smoke:check-core 通过（无核心链路变更）。

状态：#5.1 ✅；#3.6/#9.1/#9.2 暂缓（待 CloudBase 去留决策）。

提交：de07489（`fix(jobs): count missing notifications and subscriptions as skipped`），推送结果见对话回复

不确定点：1. “投递行已不存在/非 pending”归为 skipped 是语义选择（非发送失败）；若希望这类竞态行计 failed 可调整。2. CloudBase 暂缓项若最终保留 CloudBase，需按原卡片继续；若弃用则改为清理轮。3. 平台任务汇总（platformJobRuns.summary）对 skipped/failed 的展示依赖本结果字段，接口未改。

下次计划：按清单继续 #5.2（group-recycle 27 条裸 SQL 手写级联删除 + `scanned` 语义修正）；CloudBase 专属项待用户平台决策；同时等待用户强刷复核轮次 31 及轮次 57、54、53、52、51、50、49、48、47、46 及 23–30 相关验收项。

### 轮次 34 – 2026-08-07

目标：#5.2 —— 群组回收删除清单防漏加表 + 修正 `scanned` 语义。

用户决策（2026-08-07）：保留 CloudBase 备用；CloudBase 专属项（#3.6/#9.1/#9.2）不影响其他功能，统一放到最后一批一起做。

引入点：27 条裸 SQL 手写级联清单自群组回收功能引入起存在（审计卡登记）。

为什么现有测试没拦住：之前没有任何“清单是否覆盖全部 group 关联表”的校验；平台集成测试只断言 `{purged:1, scanned:1}`（与命名缺陷一致）。

修改文件：`apps/api/src/jobs/group-recycle.ts`（删除步骤改为导出的 `groupRecycleDeleteSteps`（`{ table, buildQuery }`），补充缺失的 `membership_claim_requests`——其外键引用 `group_memberships`，顺序须在它之前；`scanned` 从“等于 purged”改为“级联 DELETE 受影响行数合计”，`purged` 保持“回收群组数”）；新增 `apps/api/src/jobs/group-recycle.spec.ts`（从 drizzle schema 元数据构建外键图，断言：①所有从 groups 经外键可达的表都被清单覆盖；②子表先于父表删除（拓扑序）；③groups 最后删除；TDD 过程中该测试先后抓出缺失表与顺序错误）；`apps/api/src/modules/platform-admin/platform-admin.integration.test.ts`（断言从 `{purged:1, scanned:1}` 改为 `purged=1 且 scanned > purged`）。

语义等价审计与行为变化清单：删除行为仅新增 `membership_claim_requests` 清理（此前会漏删并可能在删除群组时触发外键阻塞）；`scanned` 语义变化（平台任务结果字段数值变大，字段本身未增删）；删除顺序经外键拓扑校验。

测试结果：`pnpm verify` 587/587 ✅（73 个测试文件，隔离 MySQL；新增 1 条删除计划锁定测试）；定向集成 platform-admin 7/7（`NODE_ENV=test` + `TEST_MYSQL_*`，隔离库 3307）。

运行/浏览器验证：未涉及 Web 核心链路（web api/auth/router/pwa/session/contracts/vite 配置/.env.example 均无改动）；pnpm smoke:check-core 通过（无核心链路变更）。

状态：#5.2 ✅；#3.6/#9.1/#9.2 暂缓至最后一批（保留 CloudBase 备用）。

提交：9e4a676（`fix(jobs): lock group recycle coverage and fix scanned semantics`），推送结果见对话回复

不确定点：1. 锁定测试基于 drizzle 外键元数据：无外键约束但按 group 清理的遗留表（如 notification_preferences）不会被“可达”断言覆盖，只能靠显式清单保留；若未来想彻底解决，可改为运行时从 information_schema 生成删除计划。2. `scanned` 改为受影响行数合计后，平台任务汇总数值会变大（不再等于群组数），属预期变化。3. 若未来新增外键引用 groups 的表而忘记加删除步骤，`group-recycle.spec.ts` 会直接失败（这正是本轮的防护目标）。

下次计划：按清单继续 #5.3（统计重建静默吞错，失败写入 `platformJobRuns.summary` 或结构化日志）；CloudBase 专属项最后一批统一处理；同时等待用户强刷复核轮次 31 及轮次 57、54、53、52、51、50、49、48、47、46 及 23–30 相关验收项。

### 轮次 35 – 2026-08-07

目标：#5.3 —— 统计重建单个月份失败时记录失败上下文（月份/群组/错误信息），不再只累计 failed 计数。

引入点：`catch { failed += 1 }` 自统计重建任务引入起存在（审计卡 #5.3 登记，无单一引入提交）。

为什么现有测试没拦住：platform-admin 集成测试只覆盖“全部成功”路径（completed=1、无失败），没有失败月份断言；新增 1 条集成回归测试（注入抛错 refresher → 旧代码 completed=1 失败）。

修改文件：`apps/api/src/jobs/statistics-rebuild.ts`（结果新增 `failures: { businessMonth, groupId, error }[]`；新增 `StatisticsRefresher` 接口与 `statisticsRefresher` 可选注入，默认仍用 `StatisticsService`；catch 记录错误并截断 500 字符，与 `platform_job_runs.summary` 上限一致）；`apps/api/src/modules/platform-admin/platform-admin.integration.test.ts`（新增失败上下文回归测试：断言 result.failures 与持久化 summary 含月份和错误信息）。

语义等价审计与行为变化清单：成功路径行为不变（completed/months 计数不变）；仅当月份刷新抛错时，结果新增 failures 列表（summary 从 `{"completed":…,"failed":…,"months":…}` 变为带 failures 的 JSON，计数仍在最前，500 字符截断不影响计数；run-job/cloudbase-runner 控制台日志将包含全量 failures）。构造函数第二参数类型由 `{ fromMonth? }` 扩展为 `StatisticsRebuildJobOptions`，现有调用 `new StatisticsRebuildJob(client)` 与 `new StatisticsRebuildJob(client, { fromMonth })` 均兼容。

测试结果：`pnpm verify` 588/588 ✅（73 个测试文件，隔离 MySQL；新增 1 条集成回归测试）；定向集成 platform-admin 8/8（`NODE_ENV=test` + `TEST_MYSQL_*`，隔离库 3307）。

运行/浏览器验证：未涉及 Web 核心链路（web api/auth/router/pwa/session/contracts/vite 配置/.env.example 均无改动）；pnpm smoke:check-core 通过（无核心链路变更）。

状态：#5.3 ✅（已完成；纯后端任务结果字段扩展，无用户界面变化，无需用户强刷）。

提交：7be3749（`fix(jobs): record statistics rebuild failure context`），推送结果见对话回复

不确定点：1. `failures` 数组未设上限，极端情况下（大量月份同时失败）summary 会被 500 字符截断但计数仍在；完整列表在 run-job/cloudbase-runner 的控制台日志中可查。2. `statisticsRefresher` 注入仅测试使用，生产路径仍由 runner 构造默认 `StatisticsService`。3. 单条错误信息截断为 500 字符（与 summary 列上限一致），超长错误（如堆栈）不会进入任务结果。

下次计划：按清单继续 #6.1/#6.2（迁移 0030/0031 复制合并 + 序列一致性校验）；CloudBase 专属项 #3.6/#9.1/#9.2 最后一批统一处理；同时等待用户强刷复核轮次 31 及轮次 57、54、53、52、51、50、49、48、47、46 及 23–34 相关验收项。

### 轮次 36 – 2026-08-07

目标：#6.1 + #6.2 —— 合并 0030/0031 两份逐行复制的工作流序列回填 SQL，并为“历史回填序列空间 vs 未来分配序列空间”补一致性校验。

引入点：0030/0031 自轮次 55（单调工作流序列）引入起即逐行复制排名字查询；0029 播种无 ORDER BY，0031 无任何校验（审计卡 #6.1/#6.2 登记）。

为什么现有测试没拦住：迁移测试只验证“空库可迁移 + 表存在”，从未在已有工作流数据上执行回填 SQL，也未断言序列区间；新增 2 条数据库行为测试（合并回填排序/区间锁定 + 播种不足时 0031 必须拒绝，旧 0031 无校验时红）。

修改文件：`migrations/0030_backfill_swap_workflow_sequence.sql`（改为临时排名表 `_workflow_sequence_ranked` 只计算一次 `ROW_NUMBER() OVER (ORDER BY created_at ASC, workflow_kind ASC, id ASC)`，再分别 UPDATE swap/duty；头注释注明排序与分配器语义一致）；`migrations/0029_seed_workflow_sequence_allocations.sql`（播种 SELECT 补显式 `ORDER BY created_at ASC, workflow_kind ASC, id ASC`）；`migrations/0031_backfill_duty_adjustment_workflow_sequence.sql`（原回填并入 0030，文件名保留以兼容 journal；内容改为校验迁移：`MAX(workflow_sequence) > MAX(workflow_sequence_allocations.id)` 或 `COUNT(DISTINCT workflow_sequence) <> COUNT(*)` 时向带 CHECK 约束的临时表插入 0，迁移报错）；`packages/database/tests/migrations.test.ts`（新增 `runMigrationFile` 辅助与 2 条测试）。

语义等价审计与行为变化清单：回填排序与结果与旧 0030+0031 逐值等价（同一 ROW_NUMBER 排序，仅计算一次）；0029 从无排序改为显式排序，播种行集合与 allocated_at 不变，仅插入物理顺序确定性化；0031 从“回填 duty”改为“校验”（duty 回填已由 0030 完成），在正常数据上不产生任何数据变更，仅在回填区间越界或序列重复时让迁移失败。已应用 0029–0031 的存量库不受影响（drizzle 按 journal 跳过，不重跑）。

测试结果：`pnpm verify` 590/590 ✅（73 个测试文件，隔离 MySQL；新增 2 条迁移行为测试）；定向 packages/database migrations 10/10（`NODE_ENV=test` + `TEST_MYSQL_*`，隔离库 3307）。

运行/浏览器验证：未涉及 Web 核心链路（web api/auth/router/pwa/session/contracts/vite 配置/.env.example 均无改动）；pnpm smoke:check-core 通过（无核心链路变更）。

状态：#6.1 ✅、#6.2 ✅（已完成；纯迁移文件与测试，无用户界面变化，无需用户强刷）。

提交：9ff2513（`refactor(migrations): merge workflow sequence backfill and add overlap validation`），推送结果见对话回复

不确定点：1. 0031 文件名仍为 `0031_backfill_duty_adjustment_workflow_sequence`，内容已改为校验（头注释说明）；若未来允许改 journal，可重命名消除歧义。2. 校验迁移只对“尚未应用 0031 的库”生效；已应用存量库靠新增测试守护，不再补 0032 迁移以免在未知线上数据上失败。3. 临时表 JOIN 使用 utf8mb4_0900_ai_ci 以匹配业务表 collation；若未来业务表改 collation 需同步。

下次计划：按清单继续 #2.2（数据库客户端 mysql2 内部属性 + 异步设时区）；#1.3/#9.3 为 P3 后续候选；CloudBase 专属项 #3.6/#9.1/#9.2 最后一批统一处理；同时等待用户强刷复核轮次 31 及轮次 57、54、53、52、51、50、49、48、47、46 及 23–35 相关验收项。

### 轮次 37 – 2026-08-07

目标：#2.2 —— 移除对 mysql2/promise 私有 `pool.pool` 的依赖，并把会话时区初始化的顺序保证显式化。

引入点：`pool.pool.on('connection', ...)` 自数据库客户端引入起存在（审计卡 #2.2 登记，无单一引入提交）。

为什么现有测试没拦住：功能上 SET time_zone 一直生效（mysql2 连接建立事件先于连接出借触发，SET 命令同步入队、单连接 FIFO 串行执行），单测无法感知私有 API 依赖与顺序保证；新增 2 条客户端锁定测试（并发双连接 + 事务连接，断言首次查询前会话已是 UTC，旧代码同样通过）。

修改文件：`packages/database/src/client.ts`（`createPool` 改为从回调版 `mysql2` 导入，注册公开 `pool.on('connection', ...)`，`pool.promise()` 交给 drizzle；注释说明为什么需要 UTC、事件先于出借触发、SET 先入队故首个业务查询必在其后、SET 失败销毁连接）；新增 `packages/database/tests/client.test.ts`（2 条锁定测试）。

语义等价审计与行为变化清单：行为不变——同一底层连接、同一 SET 语句、同一失败销毁策略；仅不再触碰私有 `pool.pool`，drizzle 拿到 `pool.promise()` 返回的同一 PromisePool 形态，close 改调 promisePool.end()（内部转发 corePool.end）。顺序保证：mysql2 BasePool 在 `connection.connect` 回调中先 `emit('connection')` 再回调出借，事件处理器同步入队 SET，单连接命令 FIFO 串行，首个业务查询必在 SET 完成后执行——与旧实现顺序等价且显式化。

测试结果：`pnpm verify` 592/592 ✅（74 个测试文件，隔离 MySQL；新增 2 条客户端锁定测试）；定向 database client 2/2、migrations 10/10（`NODE_ENV=test` + `TEST_MYSQL_*`，隔离库 3307）。

运行/浏览器验证：未涉及 Web 核心链路（web api/auth/router/pwa/session/contracts/vite 配置/.env.example 均无改动）；pnpm smoke:check-core 通过（无核心链路变更）。

状态：#2.2 ✅（已完成；无用户界面变化，无需用户强刷）。

提交：fd708c8（`refactor(database): initialize UTC session via public pool connection event`），推送结果见对话回复

不确定点：1. 顺序保证依赖 mysql2 单连接命令 FIFO 语义（已注释）；若未来换驱动需重新评估。2. promise 池的 `connection` 事件类型标为 PromisePoolConnection 而运行时是底层连接，因此改用回调池的公开事件绕开类型失真；若 mysql2 修正类型后可简化。3. 未把 SET 改为 acquire 时 await（那样需重写 pool.query/execute 路径）；当前事件入队顺序已保证业务查询在 SET 之后。

下次计划：P3 批次 #1.3（工作区残留清理，不入库）+ #9.3（加载/安全测试直写 DB 与 stub 认证）；CloudBase 专属项 #3.6/#9.1/#9.2 最后一批统一处理；同时等待用户强刷复核轮次 31 及轮次 57、54、53、52、51、50、49、48、47、46 及 23–36 相关验收项。

### 轮次 38 – 2026-08-07

目标：#1.3 + #9.3 —— 清理工作区残留（不入库），并消除加载/安全测试中重复维护的 DB 重置与认证桩实现。

引入点：#1.3 残留产物自开发期累积（无单一引入提交）；#9.3 的 `createFakeAuthPort`/`resetDatabase` 在各测试文件复制演进（审计卡 #9.3 登记）。

为什么现有测试没拦住：残留产物不入库，单测不感知；认证桩/重置函数行为一致，复制不改变行为；新增 `packages/test-fixtures/src/auth.test.ts` 1 条锁定测试（token → uid 映射、未知/缺失 token 返回 undefined），安全集成 4 条作为 resetDatabase 回归网。

修改文件：`packages/test-fixtures/src/auth.ts`（新增 `createFakeAuthPort(resolveCloudbaseUid)` 结构型认证桩）、`reset-database.ts`（新增通用 DROP 全部表助手，代码与旧副本一致）、`auth.test.ts`（锁定测试）；`tests/load/run-load-test.ts` 与 `tests/security/security.integration.test.ts` 删除本地副本并复用共享助手（load 的 `load-token-*` 解析器抽为 `resolveLoadToken`，security 的 token 表改为解析函数）；`test-fixtures/tsconfig.build.json` 补 `paths: {}`（构建时按 dist 解析 workspace 依赖，与其他包一致）；`tests/load/package.json`、`tests/security/package.json`、`packages/test-fixtures/package.json` 增补 workspace 依赖，`pnpm-lock.yaml` 更新。工作区清理（#1.3，不入库）：删除 `cloudfunctions/auth-identity-probe` 空目录、16 个 `local-api*/local-web*` 日志、2 份 CloudBase 打包产物（约 6.9MB）；node_modules/dist 保留为本地工具链功能依赖。

语义等价审计与行为变化清单：`createFakeAuthPort` 与旧实现逐分支等价（Bearer 解析、未知 token/缺失 authorization → undefined、已知 token → `{ cloudbaseUid }`）；load 的 `resolveLoadToken` 与旧 `createFakeAuthPort()` 内部逻辑逐字等价；`resetDatabase` 与两处旧副本逐字等价（FK 开关、information_schema 枚举、反引号转义）；测试包依赖与锁文件更新，生产代码零改动。

测试结果：`pnpm verify` 593/593 ✅（75 个测试文件，隔离 MySQL；新增 1 条 auth 锁定测试）；定向 security 4/4、holidays 7/7、auth 1/1（`NODE_ENV=test` + `TEST_MYSQL_*`，隔离库 3307）；`pnpm --filter @schedule/load-tests build` 通过（tsc 全量类型检查）。

运行/浏览器验证：未涉及 Web 核心链路（web api/auth/router/pwa/session/contracts/vite 配置/.env.example 均无改动）；pnpm smoke:check-core 通过（无核心链路变更）。

状态：#1.3 ✅（已清理，不入库）、#9.3 ✅（已完成；测试基础设施，无用户界面变化，无需用户强刷）。

提交：0046de1（`refactor(tests): share fake auth port and database reset fixtures`），推送结果见对话回复

不确定点：1. #1.3 未删除 node_modules 与 dist（本地工具链功能依赖）；如需彻底清空可另行执行 `pnpm install` 后重建。2. `createFakeAuthPort` 目前只被 load/security 使用，其余集成测试仍各有本地副本；后续可逐步收敛（未顺手改）。3. 发现存量问题：`pnpm --filter @schedule/security-tests typecheck` 因 `apps/api/src/modules/notifications/notification-dispatcher.ts` 引用的 `web-push` 缺类型声明而失败（apps/api 自己的 typecheck 有 `src/types/web-push.d.ts` 覆盖，tests/security 的 tsconfig include 不含该声明；非本轮引入，未顺手改，记入 TODO）。

下次计划：CloudBase 专属项 #3.6/#9.1/#9.2 最后一批统一处理（保留 CloudBase 备用决策）；非 CloudBase 合规项已全部完成；新发现 TODO（tests/security typecheck 的 web-push 声明缺失）待后续清理；同时等待用户强刷复核轮次 31 及轮次 57、54、53、52、51、50、49、48、47、46 及 23–37 相关验收项。

### 轮次 39 – 2026-08-07

目标：按用户决策弃用并清理 CloudBase（代码/依赖/部署文件/文档），部署目标固定为阿里云 ECS；同时检查阿里云部署是否存在与 CloudBase 同类的问题（惰性单例竞态、跨目录相对导入、环境声明脱节）。

引入点：CloudBase 足迹自上线起累积（#3.6/#9.1/#9.2 审计卡登记并暂缓）；2026-08-07 用户明确“CloudBase 不保留，可清理掉，后续以阿里云服务器做部署”。

为什么现有测试没拦住：清理是删除性变更，原测试覆盖 CloudBase 行为（删除后测试数减少 12 条）；新增/保留的验证是本地认证客户端锁定测试（auth.test.ts 1 条）与全量回归；浏览器冒烟覆盖登录/管理员/成员/访客全流程。

修改文件（删除）：`apps/api/src/cloudbase-handler.ts`(+test)、`adapters/auth/cloudbase-auth.ts`(+test)、`jobs/cloudbase-runner.ts`(+spec)、`apps/web/src/auth/cloudbase.ts`、`infra/cloudbase/`（含 gitignored cloudbaserc.local.json）、`.github/workflows/deploy-development.yml`、`docs/deployment/cloudbase-development.md`、`cloudbase-ops-notes.md`；依赖 `@cloudbase/cli`、`@cloudbase/node-sdk`、`@cloudbase/js-sdk`。
修改文件（替换/更新）：`apps/api/src/runtime.ts`（无 CloudBase 适配器；未配置 authPort 且非开发模式时启动即报错）、`auth-port.ts`/`plugins/authenticate.ts`/`app.ts`（移除 trustedCloudbaseContext 链路）、`apps/web/src/auth/local-auth.ts`（本地认证客户端：dev identity 会话，密码登录返回“尚未实现”）、20 个视图/`stores/session.ts`/`api/client.ts` 改引 localAuth、三个 web 测试移除 SDK mock、`package.json`/`apps/*/package.json`（依赖与脚本）、`.env.example`/`Dockerfile.web`/`compose.prod.yml`/`verify.yml`、README 与部署/设计文档（阿里云方案）。

语义等价审计与行为变化清单：认证链路——dev 模式下 `setDevIdentity`/`getSession`/`signOut` 与旧 cloudbaseAuth 的 dev 分支逐字等价；密码登录从“走 CloudBase SDK”变为返回“账号密码登录尚未实现”（自建认证落地前的明确占位）；API 生产环境不再静默回退 CloudBase SDK，未显式提供 authPort 且非开发模式时启动失败（显式化，避免隐藏依赖）。业务字段 `cloudbaseUid`/`users.cloudbase_uid` 与测试夹具中的 cloudbase-* 字符串保留（数据库列与无关夹具，不属平台代码）。阿里云部署审计：①发现并修复认证配置不一致——原 `AUTH_DEV_MODE=true + NODE_ENV=production` 使开发认证失效并回退 CloudBase 适配器，现 `compose.prod.yml` 试用期显式 `NODE_ENV=development + AUTH_DEV_MODE=true`；②无惰性单例竞态（常驻进程启动时创建一次 app）；③无跨目录源码导入（运行 dist）；④环境变量由 compose 显式声明（优于 cloudbaserc）；⑤遗留：定时任务未配置 cron、api 容器无 healthcheck 依赖、`runtime/api-flat` 需在移除 CloudBase 依赖后重新生成、自建认证未实现。

测试结果：`pnpm verify` 582/582 ✅（72 个测试文件，隔离 MySQL；删除 12 条 CloudBase 专属测试）；定向 web client 144、session 7、conflict-handler 3、app 10、runtime 3、test-fixtures auth 1 全通过；`pnpm --filter @schedule/api typecheck`、`@schedule/web typecheck` 通过。

运行/浏览器验证：pnpm smoke:browser 通过（本地认证替换后管理员/成员/访客全流程，无浏览器错误；临时 3002/5175 服务已关闭）；pnpm smoke:check-core 通过（核心链路 auth/session/client 有改动，记录已满足校验）。

状态：#3.6/#9.1/#9.2 ✅（随 CloudBase 弃用清理）；CloudBase 平台清理完成，部署目标固定阿里云 ECS（已完成，待用户后续部署/验收）。

提交：16aea99（`refactor!: remove CloudBase platform and switch web auth to local auth`），推送结果见对话回复

不确定点：1. 密码登录在自建认证落地前不可用（登录页仍显示账号密码表单，提交会提示“尚未实现”）；若需要可先行隐藏表单。2. `cloudbaseUid` 字段名/列名保留（业务持久化），重命名需数据库迁移，另开轮。3. `runtime/api-flat`（阿里云依赖树挂载件）未在本次重建，下次部署前需重新生成（已移除 @cloudbase 依赖）。

下次计划：按阿里云部署路径推进（自建认证 → 域名/备案/HTTPS → 定时任务 → 正式 MySQL）；等待用户部署/验收本轮清理；同时保留用户强刷复核轮次 31 及轮次 57、54、53、52、51、50、49、48、47、46 及 23–38 相关验收项。

### 轮次 40 – 2026-08-07

目标：清理第 6 节 TODO 三条（starts_at 漂移点评估、前端时区字面量并入领域包、CI build/test 并行），并修复 project-status/debug 日志登记的 tests/security web-push 声明缺失。

引入点：`workflow-invalidation-service.ts` 的 shift_assignments 更新自 `7c783c7`（publication lifecycle）引入后一直未显式保留 starts_at；`past-schedule-service.ts` 两处更新自 `0bcc39f`（current-state backfill）引入，更新时显式写 startsAt/endsAt。前端两处字面量是轮次 3（#7.3）统一时区工具后的遗漏点。`verify.yml` build/test 并行自 CI 建立起存在，是 2026-08-06 轮次 8/9 前后 Verify 失败的根因。web-push 声明缺失：security 测试直接 import apps/api 源码，tsconfig include 不含 `apps/api/src/types/web-push.d.ts`（轮次 38 发现）。

为什么现有测试没拦住：starts_at 漂移依赖 CynosDB 的隐式 ON UPDATE，本地 MySQL 8.4 默认 `explicit_defaults_for_timestamp=ON`，不模拟就不会漂移；新回归测试先 ALTER 模拟隐患，旧代码在更新时因 `shift_assignments_slot_unique`（period+starts_at+slot）重复键直接报错，新代码通过。前端字面量与领域包常量/助手逐值等价，旧测试（D20260803-140708、2026-07-31T16:00:00.000Z）已锁定正常输出；仅无效日历日期行为不同，新增测试锁定拒绝。CI 并行是全新检出时序问题，本地有构建产物时无法复现，改为顺序执行。web-push 不在 `pnpm verify` 的 typecheck 范围（只覆盖 packages/apps），所以全绿但该 typecheck 一直失败。

修改文件：`workflow-invalidation-service.ts`（改走 `updateShiftAssignments`，version+1 保留、显式 pin starts_at）；`schedule-repository.integration.test.ts`（新增 1 条模拟隐式 ON UPDATE 的回归测试）；`manual-schedule-logic.ts`（`chinaStandardTimeOffsetMilliseconds` 替换裸 `8 * 60 * 60 * 1000`）；`leave-logic.ts`（`parseLocalDateStart` 改用 `toChinaStandardTimeUtcTimestamp(date, '00:00')`，catch 后仍抛原中文文案）；`leave-logic.spec.ts`（新增无效日期拒绝测试）；`.github/workflows/verify.yml`（build 完成后才 test）；`tests/security/tsconfig.json`（include 增加 `../../apps/api/src/types/**/*.d.ts`）。

语义等价审计与行为变化清单：TODO1——与旧实现相比仅新增 `starts_at = starts_at` 显式回写（正常 MySQL 无差异；CynosDB 隐式 ON UPDATE 下防漂移并避免唯一键冲突），version+1、actual 字段重置、where 条件逐项一致，调用点仅此一处；past-schedule 两处因有意改班次时间保留直写，登记评估结论。TODO2——有效日期输出逐毫秒等价（已有测试锁定）；行为收紧：日历无效日期从“静默滚动”变为抛错，文案不变；manual-schedule 常量替换输出不变。TODO3——仅执行顺序变化，检查内容不变。web-push——tsconfig 仅多包含一个 .d.ts（唯一声明源），无运行时影响。

测试结果：`pnpm verify` 584/584 ✅（72 个测试文件，隔离 MySQL；新增 2 条：schedule-repository 6/6、leave-logic 7/7）；定向 `pnpm --filter @schedule/security-tests typecheck` 通过；`pnpm exec prettier --check ".github/**/*.yml"` 通过。

运行/浏览器验证：未涉及 Web 核心链路（web 改动在 features 逻辑，API 改动在 schedules 模块，未触碰 api/auth/router/pwa/session/contracts/vite/.env.example）；pnpm smoke:check-core 通过（无核心链路变更，无需浏览器冒烟）。

状态：第 6 节 TODO 三条 ✅；web-push 声明缺失 ✅（均无用户界面变化，无需用户强刷）。

提交：0762083（`fix(schedules): pin starts_at when invalidating workflow assignments`）、89587eb（`refactor(web): reuse scheduling-domain China time helpers`）、d4224d5（`ci: build before running tests in verify workflow`）、2c321bb（`fix(security-tests): include web-push ambient declaration`）；推送结果见对话回复

不确定点：1. 无效日历日期（2026-02-30）由“滚动到 3 月 2 日”变为“拒绝”，属收紧；日期选择器不会产生该输入，若未来出现兼容诉求需另开轮。2. `tests/security/tsconfig.json` 通过 include 引用 API 的声明文件；若声明文件迁移位置需同步此 include。3. past-schedule 两处更新仍直写，未并入统一助手（有意为之，评估结论已登记）。

下次计划：按阿里云部署路径推进（自建认证 → 域名/备案/HTTPS → 定时任务 → 正式 MySQL）；等待用户部署/验收；同时保留用户强刷复核轮次 31 及轮次 57、54、53、52、51、50、49、48、47、46 及 23–39 相关验收项。
