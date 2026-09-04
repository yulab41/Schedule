# Project Status

本文档只记录当前可安全接续的事实；详细历史以 Git、`docs/audit/` 和精确 debug 日志为准。每轮先读
`docs/agent-context/pitfall-index.json`，只加载匹配坑位详情。

## 当前仓库批次（2026-09-04）

- 当前活动批次：用户已明确授权 dependency-guard 前置批次及 `EXP-ICON-004-B2`。`d62f780c` 已本地提交；
  `5285dd17`（包含 `1ffab10c`）已无生产冲突合入且验证完成，准备以
  `merge: restore EXP-ICON-004 shared icon lineage` 创建 merge checkpoint。
- worktree：`runtime/external-project-worktrees/exp-icon-004-lineage-b12-20260903`；分支
  `codex/exp-icon-004-lineage-b12-20260903`。执行时最新 `origin/main=75cc0d3b` 已合入；B1 checkpoint 为
  `c027abcd`，其后的主线整合 checkpoint 为 `eaac822c`。
- merge conflict 仅有 `docs/project-status.md`、`docs/audit/STATUS.md`、`docs/debug/debug-feedback-log.md`；解析时保留
  当前 B1、G1、依赖守卫和唯一下一任务，并把原图标分支事实保留为历史证据。
- tooling checkpoint 两次普通 push 曾因 GitHub Schannel TLS 握手失败；远端现已恢复。验证期间
  `origin/main` 前进至 `fa10d5ba`，带来官方 `scripts/codex/worktree-deps-*`；B2 merge 后必须再合入该主线，
  用官方实现取代本轮临时重复 checker，再统一普通 push，不 force、不改写历史。
- 当前边界：不创建真实 trial tag、不上传体验版、不操作 allowlist、不提审、不正式发布、不连接或部署 production。

## EXP-ICON-004 根因、血缘与恢复范围

- 用户所见 `.84@8e6a4a3` 不包含 `.83@5285dd1` 的 `1ffab10c`/`5285dd17`；后续 `.85@a1bba57`
  也不含图标分支。版本号前进但 Git 祖先关系后退，是本次底部 tab、通讯录人员图标及动效仍旧的直接原因。
- `.74`、`.81`、`.82` 还发生过同末尾序号或同完整版本多 SHA。B1 `c027abcd` 已加入 `.74–.85` 历史、
  fresh main/latest trial/required checkpoints、clean exact build、不可变 tag 预占和 ignored receipt；未来候选
  必须大于 85，且包含 `5285dd17`。
- B2 恢复 `packages/ui-icons` 单一来源：Web 真实 path/TDesign 已核对 path、来源元数据、motion specification；
  Web 通过 `SharedIcon`/`SharedIconPart` 渲染，Mini 只保留 generated `ui-*.svg`/part asset 与平台动画 adapter，
  颜色来自 `packages/ui-tokens`，不把 React/DOM/CSS 原样复制到小程序。
- 原 B1 覆盖底部/顶部/更多/通讯录/日历/事件/工作流/身份等入口并删除 26 个无引用 `web-*.svg`。原 B1.1
  又删除日历私有 420ms 点击弹跳，加入 active-only 1800ms opacity 兼容，并把通讯录人员的线宽/未选中色统一为
  `1.8/#586678`；people 520ms motion/触发保持共享规格。
- B2 只恢复已审计的 B1/B1.1，不重新临摹或新增视觉。`5285dd17` 仍有 B1.2 待办：底部 5 项 23px/双色/
  active-only motion、顶部 user 几何/尺寸、filter stroke、locate/more context 与 motion codegen 等；留给 B3。

## 依赖环境守卫 checkpoint

- 旧 `prepare-release-worktree.mjs` 的弱 marker 由 `0d971de1` 引入，只比较 tracked source hash 和
  `node_modules` 目录。新实现覆盖所有 dependency source inputs、Node/pnpm、OS/架构、pnpm layout、store path，
  并验证 pnpm metadata、virtual store、direct dependency 和 workspace link。
- `node scripts/check-dependency-environment.mjs` 只读输出 `MATCH/MISS`；
  `node scripts/install-dependency-environment.mjs` 仅在任务已获安装授权且结果为 MISS 时至多执行一次现有 frozen
  install，健康通过后才在 worktree Git directory 记录 marker。release-worktree 复用同一核心。
- 行为变化：MATCH 路径仍零安装；MISS 路径仍最多一次同步安装，但安装后健康失败不写 marker，旧 marker 安全
  失效。没有 `this`、Promise/catch 范围、空值或业务调用语义变化。
- 测试先因实现模块不存在失败；实现后 dependency/release-worktree `18/18`、Node syntax、Prettier、ESLint、
  项目 Skill validator、`git diff --check` 通过。真实只读检查为
  `MISS / marker-missing / HEALTH=PASS`（exit 2），前后 marker 均不存在；尚未安装。
- Skill Creator 通用 `quick_validate.py` 因本机 Python 缺 `PyYAML` 无法启动；未安装额外依赖。仓库专用
  `validate-project-skill.ps1` 已通过。
- 上述临时实现曾在主线官方 helper 到达前解除门禁并提供安装证据；最终树不会保留两套 checker。合入
  `fa10d5ba` 时保留官方 REUSE_ONLY/maintenance-authorization 设计，删除临时 CLI/core，且不再次安装。

## 验证、依赖与预算

- B2 入口基线：Mini 5 files/55 tests 通过；production verify/package 为
  `5,151,893/1,715,719 B`（total/main）。只构建缺失 producer dist 后 Web build 以 4,242 modules、36,900ms
  通过，只有既有 >500KiB chunk warning；没有为基线重复安装依赖。
- 最终依赖图准确返回两个缺失 workspace link 的 MISS；一次授权 frozen install 后 MATCH，15 workspaces、
  lockfile up-to-date、0 新下载、1.6s，tracked 无副作用。未运行第二次 install。
- 当前累计 Mini 定向 7 files/63、Web/token 5 files/39、tooling 2 files/18、Mini 全量 122 files/663 tests
  均通过；四个定向 typecheck 通过。Web production build 4,249 modules/17.42s，仅既有 chunk warning。
- Mini verify/package/source/performance/determinism/CI dry-run 全绿：302 files，total/main
  `5,169,730/1,731,703 B`，相对入口 `+17,837/+15,984 B`，未新增 warning 类别。
- `pnpm verify` format/lint/build/typecheck 全绿；Mini 再次 122/663，根 Vitest 247 files passed/37 skipped、
  1,178 passed/364 skipped，总耗时 303,368ms。`pnpm smoke:check-core` 通过；浏览器 smoke 在临时 Vite 下因
  本地 API 3000 未运行停在 `/login?redirect=/`，不宣称功能或视觉通过。
- B1.2 预算仍为同口径总包 ≤+64 KiB、B1.2 自身 ≤+16 KiB、generated adapter ≤+12 KiB；不新增 Mini
  runtime dependency。冷启动、帧率、内存和 Skyline 合成开销当前工具无法测量，必须保留为未验证。

## 保留的主线事实

- `MINI-G1-004` 结论仍为“证据不足，保留 P3”。`.85@a1bba57` 已上传并放行、但不含图标分支，只用于原
  platform accounts/group settings 的 Xiaomi 14 人工补证，不是 EXP-ICON-004 候选。
- `EXP-CALENDAR-003`、`EXP-FEAT-002`、`EXP-UX-001/002` 的既有实现与待真机复核状态不因本次 merge 改变；
  详细事实保留在 `docs/audit/wechat-miniprogram-audit.md` 和 debug 日志。

## 文档入口

- 血缘、完整图标对照、严重程度、迁移分类、包体、批次和真机清单：
  `docs/audit/exp-icon-004-trial-lineage-and-b12.md`。
- 原图标单一来源审计：`docs/audit/exp-icon-004-icon-parity-audit.md`；对应设计/计划位于
  `docs/superpowers/specs/2026-09-03-exp-icon-004-icon-migration-implementation-design.md` 与
  `docs/superpowers/plans/2026-09-03-exp-icon-004-icon-migration-implementation-plan.md`。
- B1.1 动效修复设计/计划位于同目录的 `motion-parity-follow-up` 文件；B1 血缘和依赖守卫引入点见
  `docs/debug/debug-feedback-log.md`。

## 唯一下一任务与停止条件

- 唯一下一任务：创建已验证的 `merge: restore EXP-ICON-004 shared icon lineage` checkpoint，再合入执行时最新
  `origin/main@fa10d5ba`；冲突处保留官方 dependency lifecycle、删除临时重复 checker，用官方 `ReuseOnly`
  健康检查和受影响工具测试复核，绝不再次安装。
- 最新主线整合完成后更新状态并普通推送。推送成功即停止；不进入 B3、L3 体验上传或 L4 服务器操作。
