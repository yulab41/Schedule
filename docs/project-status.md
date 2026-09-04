# Project Status

本文档只记录当前可安全接续的事实；详细历史以 Git、`docs/audit/` 和精确 debug 日志为准。每轮先读
`docs/agent-context/pitfall-index.json`，只加载匹配坑位详情。

## 当前仓库批次（2026-09-04）

- 当前活动批次：用户已明确授权 `EXP-ICON-004-B2`。图标血缘 merge checkpoint 为 `24ea709e`
  （`merge: restore EXP-ICON-004 shared icon lineage`），父提交精确包含本分支与 `5285dd17`；后者的祖先包含
  `1ffab10c`。生产图标代码无 merge conflict。
- 执行 worktree：`runtime/external-project-worktrees/exp-icon-004-lineage-b12-20260903`；分支
  `codex/exp-icon-004-lineage-b12-20260903`。验证期间 `origin/main` 从 `75cc0d3b` 经 `fa10d5ba` 前进到
  `765b5c09`；最新主线已作为 `bce96ce8` 的第二父提交合入，且对 Mini/Web/ui-icons/tokens/lockfile 的运行时
  改动数为 0。
- 主线 merge 的冲突仅为 dependency reference、release helper 和本状态文档，均已解析。最终保留
  `fa10d5ba` 官方 `scripts/codex/worktree-deps-*` 单一来源；临时 `d62f780c` checker 文件已删除，避免两套事实源。
- 最新主线整合 checkpoint：`bce96ce8`（`merge: integrate official Schedule guardrails after icon recovery`）。
  状态证据 checkpoint `ef6ed7e9` 已随完整分支普通推送成功；最终 handoff 以
  `docs(audit): close EXP-ICON-004 B2` 识别。
- 当前边界：不创建真实 trial tag、不上传体验版、不操作 allowlist、不提审、不正式发布、不连接、查询或部署
  production。此前用户对一次 frozen install 的授权已消费，不允许再次安装。

## EXP-ICON-004 根因与 B2 结果

- 用户所见 `.84@8e6a4a3` 及后续 `.85@a1bba57` 都不包含 `.83@5285dd1` 的
  `1ffab10c`/`5285dd17`，因此版本号前进但图标代码回退。这是 Git 血缘问题，不是真机缓存推测。
- B1 `c027abcd` 已加入 `.74–.85` 历史、fresh main/latest trial/required checkpoints、clean exact build、
  不可变 tag 预占和 receipt；未来候选必须动态选择大于 85 的未占用版本且包含 `5285dd17`。
- B2 恢复 `packages/ui-icons` 单一来源：Web 真实 path/TDesign 已核对 path、来源元数据、共享 motion spec；Web
  使用 `SharedIcon`/`SharedIconPart`，Mini 只保留 generated `ui-*.svg`/part asset 与平台 adapter，颜色来自
  `packages/ui-tokens`。不把 React/DOM/CSS 原样复制到小程序。
- 当前共享 package 和 46 个 Mini 生成 SVG 的树内容与 `5285dd17` 一致；旧 `web-*` 资产/引用为 0。Web 已无
  `tdesign-icons-vue-next` 直接 dependency 或生产 import；锁文件的 3 处传递引用来自保留的 `tdesign-vue-next`。
- B1.1 已删除日历 Web 不存在的 420ms 点击弹跳，保留 active-only 1800ms opacity 兼容，并把通讯录人员
  线宽/未选中色统一为 `1.8/#586678`；people 520ms motion/触发不改。Mini 外链 SVG 不能直接控制内部 path，
  日历 draw 观感仍需 Xiaomi 14 确认。
- B2 不重新设计，也不是最终 B1.2。底部 5 项 23px/双色/active-only motion、顶部 user 几何/尺寸、filter
  stroke、locate/more context 和 motion codegen 等剩余差异留给下一独立 B3。

## 依赖环境与主线守卫

- 主线到达前，临时 checker 准确报告 `apps/web → @schedule/ui-icons`、`packages/ui-icons → @schedule/ui-tokens`
  两个缺失 link。按用户单次授权执行一次 frozen install：15 workspaces、lockfile up-to-date、0 新下载、pnpm
  11.9.0 用时 1.6s；随后健康通过且无 tracked 副作用。未运行第二次 install。
- 临时 tooling checkpoint `d62f780c` 保留为历史父提交，但最终树采用 `TOOLCHAIN-GUARDRAILS-001@fa10d5ba`
  的官方 `DEPENDENCY_MODE=REUSE_ONLY`、workspace bootstrap、warm pool/lease 和 Hook 机制。release helper 也只走
  official ReuseOnly，不自动安装。
- 官方 Skill hash 已更新为 `ccf9dd22e612ae2142061d45b98d6da4f177d125ffff838d2d4e7b76f19c7ec7`；L2
  inspector PASS，匹配坑位为 `repeated-1459-linking`。官方 `ReuseOnly -AdoptHealthyExisting` 与随后普通
  `ReuseOnly` 均为 `READY_REUSE / DEPENDENCIES_REUSED=true / INSTALL_INVOKED=false`，fingerprint
  `3a1b7a6d…`；未执行第二次安装。
- 临时 v1 marker 的精确删除被本机安全策略拒绝，未绕过；它位于 Git-admin、没有最终代码消费者。官方只读
  `schedule-worktree-state/dependencies-v2.json`，判断不受影响。
- `TOOLCHAIN-GUARDRAILS-002@765b5c09` 的动态 Git/trial/production 身份与版本分配已随主线保留；其后续
  Hook 人工审核/重启是独立任务，本轮不开始。MINI-G1-004 仍是“证据不足，保留 P3”，`.85` 只用于既有
  Xiaomi 14 人工补证。

## 验证与预算

- B2 入口同口径 Mini total/main 为 `5,151,893/1,715,719 B`；当前为 302 files、
  `5,169,730/1,731,703 B`，即 `+17,837/+15,984 B`。低于总包 ≤64KiB 预算，只保留既有主包和矩阵 warning。
- 当前累计已通过：B1 trial history；Mini 定向 7 files/63 tests；Web/token 5 files/39 tests；临时 tooling
  2 files/18 tests；Mini 全量 122 files/663 tests；四个定向 typecheck；Web build 4,249 modules/17.42s；
  Mini verify/package/source/performance/determinism/CI dry-run。
- `pnpm verify` 的 format/lint/build/typecheck 全绿；Mini 再次 122/663，根 Vitest 247 files passed/37 skipped、
  1,178 passed/364 skipped，总耗时 303,368ms。以上证据属于 `24ea709e` checkpoint tree 与相同依赖环境；合入
  `765b5c09` 后仅复核受影响 guardrail/tooling 与依赖复用，没有重复昂贵应用 gate。
- 运行/浏览器验证：`pnpm smoke:browser` 首次因 5173 未启动失败；临时 Vite 后可打开登录页，但本地 API
  3000 未运行，管理员步骤停在 `/login?redirect=/`。Vite 已关闭；`pnpm smoke:check-core` 已通过。不宣称
  浏览器功能、Mini 原生或 Xiaomi 14 视觉通过。
- Skill Creator 通用 `quick_validate.py` 因本机 Python 缺 `PyYAML` 未启动；没有安装额外依赖。项目专用
  validator 在最新 Skill 上通过（15 files、11 Markdown/73 links、3 PowerShell read-only AST）。官方 Node
  guard tests 13/13、顶层 Vitest 17/17、4 个 Node syntax checks 和 `git diff --check` 通过。
- 首次错误地把 4 个 Node test-runner 文件交给 Vitest时，内部 13 assertions 实际通过，但 Vitest报告 4 个
  “No test suite”；按官方 `node --test` 重跑后 13/13。仓库 `pnpm format:check` 首次只指出主线
  `prepare-release-worktree.test.mjs` 与当前锁定 Prettier 不一致；机械格式化该测试后门禁和 11/11 回归通过，
  无行为变化。

## 文档入口

- 血缘、完整图标对照、严重程度、迁移分类、包体、批次和真机清单：
  `docs/audit/exp-icon-004-trial-lineage-and-b12.md`。
- 原图标单一来源审计：`docs/audit/exp-icon-004-icon-parity-audit.md`；设计/计划位于
  `docs/superpowers/specs/2026-09-03-exp-icon-004-icon-migration-implementation-design.md` 与相邻 plan。
- B1.1 motion follow-up、B1 血缘、本轮 B2 浏览器结果见相应 design/plan 与
  `docs/debug/debug-feedback-log.md`。

## 唯一下一任务与停止条件

- B2 已完成并推送；当前 `bce96ce8` 已确认 `origin/main@765b5c09`、`5285dd17`、`1ffab10c`、
  `c027abcd` 均为祖先。
- 唯一下一任务：等待用户另行明确批准 B3，再修复底部五项、顶部 user、filter/locate/more context 与 motion
  codegen 的剩余 B1.2 差异。本轮立即停止，不进入 B3、L3 体验上传、Hook 审核/重启或 L4 服务器操作。
