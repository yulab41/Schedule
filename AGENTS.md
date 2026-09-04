# Project Agent Rules

<!-- schedule-project-runtime-route:start -->
Schedule repository work must load `$schedule-project-guardrails`.

- Default `DEPENDENCY_MODE=REUSE_ONLY`; a new or resumed conversation is not dependency invalidation.
- Do not install or update dependencies without separate authorization in the current message.
- Parallel tasks use one exclusive healthy warm worktree each; never share writable `node_modules`.
- Branch/SHA changes, `origin/main` movement, business-source changes, or missing workspace output do not authorize installation.
- If no reusable environment exists, fail closed; use the configured machine-local warm pool and return `POOL_BUSY` when exhausted.

Detailed rules live in the repository Skill references; the local pool path is machine configuration and is never committed.
<!-- schedule-project-runtime-route:end -->

These instructions apply to the entire repository.

For Schedule repository changes, debugging, builds, Mini Program uploads, release candidates, or
production work, use the repository-local `$schedule-project-guardrails` skill first; it routes to
the existing rules and does not replace their fact sources.

## Cross-Conversation Continuity

Do not rely on prior chat history when starting or resuming implementation.

At the beginning of every implementation conversation:

1. Read `docs/project-status.md` completely.
2. Read `docs/agent-context/pitfall-index.json`, match the request/planned commands/expected paths, and read only the matching pitfall detail files. Re-run matching if the diff expands.
3. Inspect the Git state and recent history as required below.
4. Read the exact active task sections in `docs/superpowers/plans/2026-08-01-medical-staff-scheduling-system-implementation-plan.md`.
5. Read the design sections linked or implicated by those tasks in `docs/superpowers/specs/2026-08-01-medical-staff-scheduling-system-design.md`.
6. Confirm that the active batch in `docs/project-status.md` matches the code and Git history before editing.

Read only the matching pitfall detail files, not every detail “for awareness.” If a guard fails or a `staleWhen` condition matches, treat the recorded fix as a hypothesis and re-investigate. Do not read `docs/debug/debug-feedback-log.md` completely; use `rg` with an exact pitfall ID, commit, route, or error and read only the necessary bounded section.

Use coherent, independently verifiable checkpoints, but do not impose a fixed task-count limit per conversation. Keep the active batch explicit in `docs/project-status.md`; do not begin unrelated work merely because context remains available.

When PowerShell runs more than one native command in sequence, set both `$ErrorActionPreference = 'Stop'` and `$PSNativeCommandUseErrorActionPreference = $true`, or split the commands into separate tool calls. Never rely on `$ErrorActionPreference` alone to propagate non-zero exits from `node`, `pnpm`, `git`, or other native programs.

Before each task checkpoint commit, update `docs/project-status.md` with:

- Completed task numbers and outcomes.
- Validation commands and results.
- Commit hash if already known from the preceding checkpoint, otherwise the commit message that will identify the checkpoint.
- Decisions, deviations, blockers, and external console state needed by the next conversation.
- The exact next active batch and its stop condition.

Keep `docs/project-status.md` concise and current rather than turning it into a full historical log. Git history is the durable history. A new conversation should be able to resume safely from the repository alone.

## Git and GitHub Checkpoints

At the beginning of every new task or conversation that may change repository files:

1. Inspect `git status --short --branch`, the current branch, recent commits, and configured remotes.
2. Treat pre-existing uncommitted changes as user-owned. Do not discard, rewrite, stage, or commit unrelated changes.
3. Work on the current branch unless the user explicitly requests another branch.

At the end of each task, decide whether the work forms a safe version checkpoint.

Create a Git commit when all of the following are true:

- The task changed repository files and the requested unit of work is complete.
- Relevant validation has passed, or the change is an approved documentation-only update that has been reviewed for consistency.
- The staged diff contains only files belonging to the completed task.
- No credentials, secrets, local environment files, generated caches, or unrelated user changes are included.

Do not create a commit when the task is read-only, work is incomplete, validation has a relevant failure, merge conflicts exist, or the diff cannot be safely separated from unrelated user changes. Report the reason instead.

Before committing:

1. Review `git diff` and `git diff --cached`.
2. Stage explicit task-related paths rather than staging the whole repository blindly.
3. Use a concise commit message that describes one coherent version checkpoint.

After creating a commit, push the current branch to its configured GitHub upstream when all of the following are true:

- An `origin` remote and upstream branch are configured.
- The user has not asked to keep the commit local.
- The push is a normal fast-forward push and does not require force.
- Authentication and network access are available.

Never force-push, rewrite published history, delete remote branches, or bypass branch protection unless the user explicitly requests the exact operation. If a push fails, keep the local commit intact and report the failure.

In the final response, state whether a commit was created, include its short hash and message, and state whether the GitHub push succeeded. This policy requires judgment; it does not mean every conversation must produce a commit.

## Production Deployment After Changes

After every completed repository modification checkpoint, deploy the pushed checkpoint directly to the production server and run the production verification workflow. Do not stop after a local commit or GitHub push unless deployment is genuinely blocked.

Production deployment synchronizes application code and committed migrations only. Never copy a local database, local credentials, local sessions, demo data, or generated local state to production. Preserve the server database as the authoritative business-data source, create a production backup before deployment, and report the backup identifier, deployed release, and verification result.

Documentation-only checkpoint commits must also become the production release so that the deployed release identifier matches Git `HEAD`, even when application artifacts are otherwise unchanged.

Exception for Mini Program and documentation-only scope: a checkpoint that changes only
`apps/miniprogram/**` and/or documentation must not trigger a production deployment, production database
backup, or server release-metadata synchronization unless the user gives explicit authorization for that
production operation in the current turn. A Mini Program upload is a separate operation and never proves
that API/Web artifacts or containers changed. If a later production deployment is authorized, derive the
rollback candidate from the server's current live release immediately before deployment; never substitute
an earlier application-code checkpoint.

## 微信小程序审计与小米 14 验收

本节适用于 `docs/audit/AUDIT_MASTER_PLAN.md` 管理的微信小程序审计、优化和验收；
`apps/miniprogram/AGENTS.md` 的代码、运行时和发布边界继续适用。

### 审计状态与轮次范围

- `docs/audit/AUDIT_MASTER_PLAN.md` 保存完整规范；`docs/audit/STATUS.md` 只保存当前阶段、已验证事实、
  阻塞项、唯一下一任务和停止条件。每轮在仓库连续性检查后读取两者的当前相关章节。
- `docs/project-status.md` 记录仓库级 Git、部署和活动批次；审计细节留在 `docs/audit/STATUS.md`。
  两者不得给出互相冲突的下一任务。
- 只完成当前审计批次，不因上下文仍有余量进入后续阶段。批次大小由风险、状态文件和停止条件决定。

### 工具事实与微信开发者工具边界

- 只把实际成功读取的 Skills 当作知识约束，只把实际成功调用的工具写成“已使用”；不得编造工具、
  参数、日志或验证结果。
- 本仓库的规则比通用微信 Skill 更严格：LLM 不得调用 `wechatide`，也不得启动、唤醒、重启、控制
  或自动化微信开发者工具 GUI/CLI；该禁令包含状态检查、登录、编译、模拟器、Console、Network、
  截图、预览和上传命令。因此不执行通用 `wechatide-skill` 的 CLI 就绪门禁，只能记录“知识规则已读取，
  执行面因仓库政策禁用”。
- 允许使用仓库既有 Node 静态构建、`miniprogram-ci`、`miniprogram-simulate`、测试、包体和视觉比较
  脚本，但这些结果不能代替微信原生运行时或实体设备验收。
- 每项证据必须标明来自静态检查、Node 自动化、用户人工开发者工具操作或小米 14 体验版。
  工具取不到的数据统一写“当前工具无法测量，暂未验证”，不得静默跳过或猜测。

### 先测量、后修改

- 修改业务代码前建立可复现基线，至少记录实际命令、Git SHA/工作树状态、构建状态和耗时、
  TypeScript/ESLint/测试结果、可获得的错误/警告、主包/分包/总包体积及最大文件。
- Console、Network、冷启动和页面性能只有取得真实工具输出或真机报告后才能填写；不得编造数量、
  性能数据或提升百分比。
- 每批修改后按同一口径复测，记录改善、无变化、退化或未验证；收益不明确且引入退化时回滚。
- 审计发现按主计划 P0–P3 记录，包含编号、普通解释、技术原因、文件位置、证据、影响、修复建议、
  风险、置信度、状态和验证方式。

### 修改与诊断安全

- 只自动修复高置信、低风险、可验证、可回滚的问题；没有证据时不为“代码更漂亮”而重构。
- 不擅自迁移框架或改变业务逻辑、接口、数据结构、路由、已验收视觉和用户操作结果。状态管理、
  网络层、目录、API、数据库、缓存迁移和大范围 UI 改版只形成计划，除非用户另行批准。
- 不手改生成目录，不删除用途未确认的代码/资源，不为少量代码引入大型依赖。新增依赖先说明必要性、
  主包/总包影响和轻量替代。
- 不执行真实支付、正式发布、生产数据库破坏性写入、删除云资源、真实通知或其他不可逆操作。
- 诊断、报告和截图不得包含 token、Cookie、Authorization、手机号、身份证号、openid、session_key、
  完整请求/响应或生产数据。

### 体验版与实体设备验收

- 模拟器只作辅助，不是最终视觉或交互依据。当前主验收环境是小米 14 Android 微信客户端体验版。
  只有用户提供与当前构建一致的真实证据后，才允许写“小米 14 体验版验收通过”。
- 分析真机证据前核对 Git 短 SHA、`trial`、renderer、基础库、微信版本和构建时间。版本不一致的证据
  不能用于判断当前修改。未经验证不得声称 iOS、所有安卓、全平台或跨端兼容通过。
- 审计计划范围内，体验版上传必须先说明修改内容、短 SHA、版本描述、脏树状态和测试页面，并取得
  用户当次明确同意；这项门禁优先于其他自动上传规则。提交审核和正式发布始终需要明确批准。
- 真机截图、二维码和运行日志放在 ignored `runtime/audit/`，不提交 Git；跟踪文档只记录页面、时间、
  SHA、环境、renderer 和结论。

### 面向初学者的交付

- 先说明发生了什么、是否严重、是否需要处理，再解释技术原因，最后给明确下一步。
- 首次出现术语时用一句话解释；用户操作每轮尽量 3–5 步，写清点击路径、预期结果、截图或复制内容。
- 不倾倒大段原始日志；提炼重点，同时保留定位所需的最小原始错误。
- 每轮结束更新审计报告和 `docs/audit/STATUS.md`，明确验证层级、未验证项、阻塞项和唯一建议下一任务。

## Project-Local Generated Artifacts

All project-related worktrees, release packages, smoke screenshots, logs, debug output, and build scratch data must stay under this repository, normally in the ignored `runtime/` tree. Do not create sibling `Schedule-*` directories or persistent `schedule-*` items in the operating-system temporary directory. Keep only the latest reusable release worktree at `runtime/release-worktree`; remove superseded release/test/debug copies after confirming they are landed or disposable. Unlanded development worktrees must remain intact under `runtime/external-project-worktrees/`. Credentials, upload private keys, and production secrets are the only required exception and must remain outside the repository.

The Schedule dependency-reuse guardrail has one additional machine-local exception: the configured
same-volume persistent warm pool is operated only by `scripts/codex/manage-worktree-pool.ps1` and its
lease checks. It is not a scratch, release, log, or credential directory and its absolute path is never
committed.

## 防回归与运行验证（所有修复/重构轮次必须遵守）

1. 定位引入点：回归修复前，对被改动调用点执行 `git log -S '<关键表达式>' -- <文件>` 与 `git blame`，确认该行为从哪个提交/轮次开始，并把引入点写入轮次记录与调试日志。
2. 语义等价审计：任何“重构”必须逐调用点证明行为等价——`this`/接收者绑定（成员调用 vs 裸调用、bind/call/apply）、异步与错误路径（promise 拒绝、catch 范围）、空值语义（`??`/`||`/`?.`）、类型收窄、副作用与调用次数。任一项不同即不是重构，必须拆成独立提交，并先写能在旧代码上失败、新代码上通过的回归测试。
3. 测试先行：回归测试先失败后通过；禁止用“改测试来掩盖”代替。
4. 浏览器冒烟强制：改动触及核心链路（`apps/web/src/api|auth|router|pwa|stores/session.ts|App.vue|main.ts|layouts`、`packages/contracts/src`、`apps/web/vite.config.ts`、`.env.example`）时，必须运行 `pnpm smoke:browser`，并在 `fix-progress.md` 轮次记录或 `docs/debug/debug-feedback-log.md` 写入“运行/浏览器验证：pnpm smoke:browser …”及结果；提交前必须运行 `pnpm smoke:check-core`，若核心链路有改动且未记录则校验失败、禁止提交。
5. 完成状态三态：`已实现待浏览器复核` → `已完成`（含运行验证）→ `待用户复核`（需用户强刷/验收）。单测通过不等于已完成，`docs/project-status.md` 与调试日志沿用同一口径。
6. 提交前自查：`git diff` 逐行过一遍并列出行为变化清单（哪怕“预期等价”也列出）；发现无关改动一律拆出或回退，不“顺手改”。
