# Project Agent Rules

These instructions apply to the entire repository.

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

## Project-Local Generated Artifacts

All project-related worktrees, release packages, smoke screenshots, logs, debug output, and build scratch data must stay under this repository, normally in the ignored `runtime/` tree. Do not create sibling `Schedule-*` directories or persistent `schedule-*` items in the operating-system temporary directory. Keep only the latest reusable release worktree at `runtime/release-worktree`; remove superseded release/test/debug copies after confirming they are landed or disposable. Unlanded development worktrees must remain intact under `runtime/external-project-worktrees/`. Credentials, upload private keys, and production secrets are the only required exception and must remain outside the repository.

## 防回归与运行验证（所有修复/重构轮次必须遵守）

1. 定位引入点：回归修复前，对被改动调用点执行 `git log -S '<关键表达式>' -- <文件>` 与 `git blame`，确认该行为从哪个提交/轮次开始，并把引入点写入轮次记录与调试日志。
2. 语义等价审计：任何“重构”必须逐调用点证明行为等价——`this`/接收者绑定（成员调用 vs 裸调用、bind/call/apply）、异步与错误路径（promise 拒绝、catch 范围）、空值语义（`??`/`||`/`?.`）、类型收窄、副作用与调用次数。任一项不同即不是重构，必须拆成独立提交，并先写能在旧代码上失败、新代码上通过的回归测试。
3. 测试先行：回归测试先失败后通过；禁止用“改测试来掩盖”代替。
4. 浏览器冒烟强制：改动触及核心链路（`apps/web/src/api|auth|router|pwa|stores/session.ts|App.vue|main.ts|layouts`、`packages/contracts/src`、`apps/web/vite.config.ts`、`.env.example`）时，必须运行 `pnpm smoke:browser`，并在 `fix-progress.md` 轮次记录或 `docs/debug/debug-feedback-log.md` 写入“运行/浏览器验证：pnpm smoke:browser …”及结果；提交前必须运行 `pnpm smoke:check-core`，若核心链路有改动且未记录则校验失败、禁止提交。
5. 完成状态三态：`已实现待浏览器复核` → `已完成`（含运行验证）→ `待用户复核`（需用户强刷/验收）。单测通过不等于已完成，`docs/project-status.md` 与调试日志沿用同一口径。
6. 提交前自查：`git diff` 逐行过一遍并列出行为变化清单（哪怕“预期等价”也列出）；发现无关改动一律拆出或回退，不“顺手改”。
