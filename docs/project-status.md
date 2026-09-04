# Project Status

本文档只记录当前可安全接续的事实；详细历史以 Git、`docs/audit/` 和精确 debug 日志为准。每轮先读
`docs/agent-context/pitfall-index.json`，只加载匹配坑位详情。

## 当前仓库批次（2026-09-05）

- 当前活动批次：`TOOLCHAIN-GUARDRAILS-FINAL`（Schedule Codex 依赖复用、项目内 warm pool、早期安装阻断和
  无 Hook trust 收口）。当前 canonical 根为 `E:\AItools\Schedule`；最终完整工具链验证对应代码 SHA 为
  `a505746a`，其后仅有状态/文档 checkpoint，当前主线以 Git `HEAD`/`origin/main` 为准。
- 前序 production/Mini 证据仍按各自冻结 SHA 解释；本批不接 production、不备份、不迁移数据库、不上传小程序，
  不把 Node/静态/simulate 结果写成 Xiaomi 14 原生验收。
- 根工作树 tracked 文件干净；既有未跟踪 `.agents/`、`runtime/`、`src/` 和本地表格为用户所有，未删除、覆盖、
  暂存或提交。

## 正式工具链状态

- 根 `AGENTS.md` 已在最前部声明 `DEPENDENCY_MODE=REUSE_ONLY`、conversation boundary 不使依赖失效、每个
  Schedule 任务先加载 `$schedule-project-guardrails` 并 Acquire 独占 warm slot；普通任务不得 install，无槽位
  返回 `POOL_BUSY`，正式路由为 `Acquire → ReuseOnly → Bootstrap → Targeted test`，不依赖 Hook trust。
- 正式 Skill 为 `.agents/skills/schedule-project-guardrails/SKILL.md`；description 前置声明适用范围、默认
  ReuseOnly、独占 warm、普通任务无安装权限和无 Hook 依赖。Skill validator、front matter、OpenAI YAML、Markdown
  links、PowerShell read-only AST 均通过。
- `.codex/config.toml` 只保留项目说明；`.codex/hooks.json`、`.codex/hooks/project.json`、项目 Hook 源码和
  无其他用途的 wrapper 已移除。项目有效配置没有 Schedule Hook 注册，不需要 `/hooks`、trust 或人工审核。
- `.codex/setup.ps1` 及 `schedule-project-setup.ps1` 只做 canonical/common-dir 解析、AGENTS 路由和轻量状态检查；
  它们不 Acquire、不 bootstrap、不创建 `node_modules`、不 install，非 warm managed worktree 返回
  `MANAGED_WORKTREE_NOT_WARM`。
- `.codex/rules/schedule-dependency-mutation.rules` 已用 `decision = "forbidden"` 覆盖直接 install/update/fetch/
  rebuild/prune、删除 node_modules 和 destructive `git clean`，并有 match/not_match 单元例；`codex execpolicy check`
  对 `pnpm install`、`pnpm.cmd install`、`npm ci`、`git clean -xfd` 为 forbidden，对 `pnpm test` 无匹配。
- `.pnpmfile.cjs` 加载 `scripts/codex/install-tripwire.cjs`。未授权直接 install 的实测为 exit code 1、493ms、
  `EXIT_BEFORE_IMPORT=true`、import 0、node_modules/lockfile/store 均未变；错误明确指向
  `scripts/codex/dependency-maintenance.ps1`。唯一维护入口使用精确授权、frozen lockfile、offline、项目内 store、
  最长 30 分钟、单次 nonce，成功后才写 fingerprint，失败清理授权且不写成功 marker。

## 依赖、槽位和 bootstrap

- 正式 store：`E:\AItools\Schedule\runtime\pnpm-store`；旧 `E:\.pnpm-store\v11` 因可能被其他项目使用而保留，
  但 Schedule 的正式 root/pool `.modules.yaml` 均指向项目内 `runtime/pnpm-store\v11`，不再依赖旧 store；未启用
  GVS，未改变 nodeLinker，未删除或 prune store。
- 正式 warm 槽位为 `runtime/wt/general-1` 至 `general-6`，均为 Git detached、clean、独立 writable
  `node_modules`、`.modules.yaml`、`dist`、独立 `.tsbuildinfo` 和 fingerprint；当前统一 HEAD=`a505746a`，依赖 fingerprint
  为 `94dd306036825788f466207a97a06a54d85c3b5b02f1b1f3e38568083c4516e4`，注册 profile 为 `root`。
- 6 个槽位逐一 `ReuseOnly`=`READY_REUSE`、root bootstrap=`READY_BOOTSTRAP`，每槽位 `built=0,reused=7`；6/6
  最小定向测试通过。pool 并发演练为 6/6 distinct；第 7 个返回 `POOL_BUSY`、无 install、无 worktree 创建。
- SHA 切换演练在 `general-2` 的 `b076d542 ↔ 7f407038` 间复用同一 fingerprint，install=0、bootstrap reuse、
  build=0，最终 clean。
- 本轮实际一次性维护 install 数量及成功/失败分解保存在 ignored `runtime/codex/state`；没有联网下载，没有
  `--force`，没有 lockfile 或依赖版本变更。

## worktree、恢复和历史 overlay

- 初始 Git worktree 盘点为 43 个；旧 `E:\ScheduleWT\general-1` 已 Git-aware move 到项目 pool，旧路径无真实
  worktree data；无关 stale worktree 已先建立 recovery ref/patch/manifest 后按 clean、进程、lease、唯一提交和
  用户文件条件处理。成功删除 13 个，Windows 长路径/dirty/唯一提交项保留恢复证据；不做递归强删。
- `runtime/codex/recovery` 中保留恢复 manifest/patch；两个无 Git metadata 的 `runtime/audit/preupload-*` 物理目录
  作为 invalid physical worktree 保留，未删除可能的用户生成数据。当前项目外 Schedule 实际 worktree data=0，未建
  兼容 junction；`runtime/release-worktree` 仅有项目内未注册候选产物，因历史任务状态保留待后续明确清理。
- retained historical worktree overlay 由 `scripts/codex/sync-legacy-worktree-overlays.ps1` 生成，使用 canonical
  Skill tree hash `e7c83c77f4e19c4b28c033f253d4e31b5e36cc40c2d912f9ff8240e80c2cedd0`，全部本地 Git exclude。新历史
  session 演练已输出 `LEGACY_OVERLAY_PRESENT=true`、`DEPENDENCY_MODE=REUSE_ONLY`、`INSTALL_INVOKED=false`、
  `TASK_STATUS=MANAGED_WORKTREE_NOT_WARM`。

## 验证与安全边界

- 静态验证：Skill validator、Markdown/links、PS5.1/PS7 AST、Node syntax、`git diff --check`、project-local
  layout/ignore/pool/tripwire Node tests 均通过；工具链 Node tests 当前为 18/18。
- 新 canonical Codex 子 session 演练已从项目根读取 AGENTS/Skill、inspector=`RESULT=PASS`、Acquire formal slot、
  ReuseOnly、root bootstrap reuse、最小测试、Release；输出 `NEW_SESSION_AGENTS_LOADED=true`、
  `PROJECT_SKILL_AVAILABLE=true`、`DEPENDENCIES_REUSED=true`、`INSTALL_INVOKED=false`、`HOOK_TRUST_PROMPT=false`。
- 完整 `pnpm verify` 在最终 `a505746a` formal warm slot 通过：format、lint、packages/apps build、typecheck、
  Mini 119 files/643 tests，以及 root Vitest 246 files/1171 tests passed；37 个数据库集成文件/364 tests 因无外部
  数据库环境 skip。日志为 ignored `runtime/codex/state/final-verify-a505746a.log`。
- `general-1..6` 已逐槽位完成 `ReuseOnly`/root bootstrap/最小定向测试；每槽 `built=0,reused=7`，并生成独立
  `.tsbuildinfo`（每个 87,810 bytes）。最终 fetch 后 `main==origin/main==a505746a`，祖先检查通过。
- 未调用微信开发者工具 GUI/CLI、模拟器、Console/Network、上传或生产；未创建 production backup，未迁移数据库。

## 已推送 checkpoint

- `bb81e723` `refactor(agent): remove manual Hook trust dependency`
- `a93d90ff` `chore(dev): complete project-local store mirror`
- `5cef3276` `fix(dev): make maintenance authorization and pool provisioning executable`
- `e8e5ecae` `hardening(dev): make maintenance cleanup and task routing deterministic`
- `3b892318` `fix(dev): accept pnpm versioned project store metadata`
- `d18dd7aa` `fix(dev): pass pool dependency parameters safely`
- `b72ca8ba` `fix(dev): avoid reserved PowerShell home variable`
- `b076d542` `test(dev): verify warm pool concurrency overflow`
- `ba1e97a7` `chore(dev): archive stale worktree recovery evidence`
- `7f407038` `fix(dev): handle bootstrap reason map output`
- `fc79762d` `fix(dev): record bootstrap profile during pool registration`
- `969f740d` `chore(test): restore release test formatting`

## TOOLCHAIN-GUARDRAILS-FINAL-013（2026-09-05）

- root Vitest 的失败根因是 Node 原生测试文件落入 Vitest 默认 glob；`vitest.config.ts` 现在把 `scripts/codex/**`
  列入 exclude，保留它们由 `node --test` 独立运行。`docs/project-status.md` 同时保持 250 行以内；配置/文档
  定向验证已通过。
- 本 checkpoint 只涉及 Vitest 测试收集边界和状态文档压缩，不涉及业务源码、依赖版本、lockfile、runtime 数据或生产。
- checkpoint message：`fix(test): isolate node toolchain tests from Vitest`。

## TOOLCHAIN-GUARDRAILS-FINAL-014（2026-09-05）

- 项目工具链本线程已完成：静态门禁、安装 tripwire、pool 溢出、SHA 切换、6 槽 ReuseOnly/bootstrap、canonical
  新 session 和 historical overlay 新 session 演练均有 ignored 证据；本轮没有生产、数据库或小程序上传操作。
- 最终状态 checkpoint 之后，6 个 formal general slot 已无安装同步到 `7bf50bd0`，逐槽 `ReuseOnly`、root bootstrap
  和最小定向测试仍通过，`built=0,reused=7`；这是 docs-only SHA 漂移，未使完整验证代码证据失效。
- Codex app 最后检查仍显示历史图标任务“收口 Web 与小程序图标一致性”和“审计图标一致性迁移方案 (2)”为 active；
  当前唯一 lease 是 `runtime/wt/icon-parity-1`，有进程/未完成上传任务，未被本线程中断、抢占或删除。故不能把
  `ALL_PREVIOUS_PARALLEL_TASKS_FINISHED` 写成 true；其余正式 general pool 不受影响且 6 个均 free。
- checkpoint message：`docs(dev): record final ReuseOnly closure evidence`。

## 唯一下一任务与停止条件

- 唯一下一任务：历史图标任务自然结束后，仅重新检查其 lease、进程、worktree 和远端是否漂移；本线程不执行任何
  上传、强制终止或接管。当前依赖复用收口已完成，停止条件为保留该外部 lease 事实且不影响 general pool。
- 停止条件：完整工具链门禁通过或明确记录不可归因/预存在失败；6 个正式槽位仍为项目内独立 clean warm；不部署
  production、不备份、不迁移数据库、不上传小程序。所有变更均显式暂存，不纳入 runtime、用户未跟踪文件或业务源码。
