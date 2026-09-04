# Project Status

本文档只记录当前可安全接续的事实；详细历史以 Git、`docs/audit/` 和精确 debug 日志为准。每轮先读
`docs/agent-context/pitfall-index.json`，只加载匹配坑位详情。

## 当前仓库批次（2026-09-04）

- 当前活动批次：用户已明确批准 `EXP-ICON-004-B3`，并在当前消息授权完成后上传新的微信体验版及把该精确版本
  加入服务端客户端版本白名单。没有授权提交审核、正式发布、Web/API production 部署、数据库变更或备份。
- 执行 worktree：`runtime/external-project-worktrees/exp-icon-004-lineage-b12-20260903`；分支
  `codex/exp-icon-004-lineage-b12-20260903`。B3 开始前已连续 fetch 并合入最新
  `origin/main@4602120b`；其两次主线更新只涉及 Schedule guardrail、Hook、worktree/dependency/release helper
  和文档，Mini/Web/ui-icons/tokens/lockfile 没有业务运行时改动。合并冲突只发生在本状态文档，按当前 B3
  批次重写并保留主线安全规则。
- 图标血缘 merge checkpoint 为 `24ea709e`，父提交包含 `5285dd17`，后者祖先包含 `1ffab10c`；B2 收口
  checkpoint 为 `b480899d`。当前候选必须继续包含 `c027abcd` 的累计体验版血缘门禁。
- 前序最新体验版为 `0.1.0-p10.20260903.85@a1bba571`；服务端 allowlist 已确认保留 `.81–.85`。B3 必须在最终
  clean SHA 和完整门禁后动态分配大于 85 的唯一未占用版本，不能复用或预猜版本号。
- 依赖模式固定为 `DEPENDENCY_MODE=REUSE_ONLY`；既有一次 frozen install 授权已消费，本轮不得安装依赖。

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
- `TOOLCHAIN-GUARDRAILS-003@8a3157e8` 已随最新主线合入：Mini 修改必须组合 Mini safety capsule 与对应级别
  testing/evidence reference；validator 会固定检查 clean target SHA、独立 worktree、Mini/production 分离、
  `version=local`、Xiaomi 14 验收和同环境父/新 SHA 对比。

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

## TOOLCHAIN-GUARDRAILS-003（2026-09-04）

- 审计确认用户给出的五条 Mini 避坑边界已分别由 `miniprogram.md`、`testing-and-evidence.md`、根/子目录
  `AGENTS.md` 和既有 runbook 保存；不再把整段复制进 `SKILL.md` 或每轮 Prompt。
- `SKILL.md` 只增加条件说明：Mini 修改自动组合 Mini reference 与级别所需 testing/evidence reference；非 Mini
  L1 dry-run 不加载 Mini reference。`miniprogram.md` 仅增加胶囊路由说明，不复制事实规则。
- validator 现在固定检查 clean target SHA/独立 worktree、禁止主树混合 `dist`、`version=local`、Mini 不自动
  production/备份、Xiaomi 14 最终验收、同环境父/新 SHA 对比和诊断包体语义。定向红绿先捕获缺少胶囊路由，
  补齐后 Skill 结构/front matter、11 个 Markdown/74 个链接、3 个 PowerShell 只读 AST 和 Node YAML 解析
  通过；`quick_validate.py` 仍因缺 PyYAML 无法启动，遵守禁装依赖边界未补装。
 - 本批不改业务代码，不安装依赖，不构建或运行全仓测试，不上传小程序，不连接/查询/备份/部署 production。
  checkpoint 以 `docs(agent): route Mini safety capsule` 识别。

## TOOLCHAIN-GUARDRAILS-INTERNAL-001（2026-09-04）

- 方向纠正：正式 Skill、根路由、项目 Hook、配置、指纹、bootstrap、租约、状态、池和未来 store 目标统一
  收敛到 canonical project home 下的 `.agents/`、`.codex/`、`scripts/codex/` 和 `runtime/`；不再新增项目外
  Schedule 写入。既有项目外 worktree、旧 store 和此前全局临时内容只按遗留状态保护，未移动活动环境。
- 从方向纠正时的最新 `origin/main` tip 建立项目内 `runtime/wt/guardrails-integrate` 集成 worktree；集成 worktree
  没有 `node_modules`，本轮没有 install/fetch/rebuild/prune，也没有创建冷依赖环境。项目内 ReuseOnly 演练
  应保持 `BLOCKED_NO_REUSABLE_DEPENDENCY_ENV`，不得借用遗留外部 warm 槽位。
- 已完成项目内路径门禁改造：精确 ignore `runtime/codex/`、`runtime/wt/`、`runtime/pnpm-store/`；
  Hook 配置使用相对路径；指纹/bootstrap 状态不再进入 Git admin；pool 只接受 runtime/wt 直接子 worktree，
  使用 runtime/codex 原子租约并将 `NESTED_WORKTREE_CREATION=false` 固定为硬门禁。
- 候选审计、日期漂移归属和前一 checkpoint 的旧证据保留在开发记录；前一外部集成提交不被重写，最终只从
  最新主线选择性提交本项目内布局修正版。
- 当前工作树轻量验证：项目 Skill 校验 `RESULT=PASS`；项目 Hook/指纹/bootstrap/池/布局 Node 定向测试
  `17/17`；项目内 ReuseOnly 和 Mini bootstrap 均 fail-closed 且 `INSTALL_INVOKED=false`；项目外遗留登记
  仅写入被忽略的 `runtime/codex/state`，没有移动或修改遗留 worktree/store。远端期间新增的动态身份与 Mini
  安全胶囊提交已审计并保留，本分支已在最新 tip 上正常重放。
- checkpoint message：`fix(agent): keep Schedule Codex guardrails project-local`。已逐文件审阅并显式暂存工具链
  路径；不得触碰业务源码、依赖、锁文件、生产、数据库或小程序上传。

## 唯一下一任务与停止条件

- B3 已获批准：先用失败测试锁定底部五项、顶部 user、filter/locate/more context 与 motion codegen 的 B1.2
  差异，再完成最小同源修复和同口径验证。
- 验证通过后提交并普通推送调查分支；再从最终精确 clean SHA 建立 `runtime/release-worktree`，独占分配唯一
  版本、完成 version-bound build 与体验版上传，并只把该精确版本追加到服务端 allowlist 后 verify。
- 收到上传成功回执、记录版本/SHA/manifest、allowlist ensure/verify 通过并更新审计状态后停止。不提审、不
  正式发布、不部署 production 应用或数据库。
