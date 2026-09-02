# Project Status

本文档只记录当前可安全接续的事实；详细历史以 Git、`docs/audit/wechat-miniprogram-audit.md` 和精确
debug 日志为准。每轮先读 `docs/agent-context/pitfall-index.json`，只加载匹配坑位详情。

## 当前仓库批次（2026-09-02）

- 已完成主线批次：`MINI-G1-001`、`MINI-G1-002`、`MINI-G1-003`、`EXP-UX-001`；历史发布/真机边界保留在下方
  历史段落与 `docs/audit/STATUS.md` 的前一版记录中。
- 当前活动批次：`EXP-ICON-004`；已完成 Web/微信小程序图标与图标动效静态审计、单一来源设计和风险分批，
  当前状态为“已完成静态/构建证据 → 待用户审阅并批准 B1”。
- 起始基线：最新 `origin/main@359966f7240d2f557b24dd0c1ac61979d6bb8298`。
- 调查分支/worktree：`codex/exp-icon-004-audit` /
  `runtime/external-project-worktrees/exp-icon-004-audit`；由 `origin/main` 创建，初始工作树干净；用户主
  worktree 和其他 worktree 未修改、清理、暂存或借用。
- 本轮只更新审计、设计、计划和状态文档；没有修改 Web/Mini 生产 icon、`packages/ui-tokens`、路由、API 或
  业务逻辑；不重跑阶段 0，不调用微信开发者工具，不上传体验版，不部署 production。
- 设计/完整对照：`docs/superpowers/specs/2026-09-02-exp-icon-004-icon-parity-design.md`、
  `docs/audit/exp-icon-004-icon-parity-audit.md`；实施计划和 B1 精确 Prompt：
  `docs/superpowers/plans/2026-09-02-exp-icon-004-icon-parity-implementation-plan.md`。

## 上一批次 EXP-UX-001 历史

- 换班 request/admin/revoke 三种 sheet 改用既有 `ui-sheet`：fixed z400、78vh/max660、safe-area、
  独立滚动区、固定 footer 和顶部 drag region；首页真实 Tab 导航仍为 z50。
- 共用 `workflow-picker` 已统一同实例 toggle、A/B 互斥、空选项关闭、选择后关闭和 host dispose/unload
  清理；没有复制页面实现。
- leave/swap/duty 非 Tab 直达页的旧 bottom-nav WXML、专用 handler 和样式已源码删除；路由、左上角返回、
  系统侧滑返回保留，底部只保留必要 `16px + safe-area` 内容空间。只读审查未发现其他页面挂载同一遗留导航；
  workbench 首页导航未改。
- 13 个右上角静态 `phase-chip` P5/P7/P8/P9 节点及专用样式已删除；CSV 改为 `format-chip`。buildLabel、
  编译 SHA/版本/profile/time、测试工具 metadata 和 P1 左侧诊断说明保留。源码和 production dist 搜索无
  `phase-chip`/右上角 P 标签。
- 详细截图映射、根因、删除清单、picker 调用者、包体和真机边界见 `docs/audit/wechat-miniprogram-audit.md`
  第 11 节；连续性记录见 `docs/debug/debug-feedback-log.md` 的 2026-09-02 条目。

## 上一批次验证证据（EXP-UX-001）

- 旧实现先红：EXP 合同在业务源码修改前实际 7 红/1 绿；修复后 EXP 9/9，受影响定向合同 52/52。
- Mini 全量：`pnpm miniprogram:test` 为 114 files / 621 tests passed。
- Mini：`pnpm miniprogram:build`、`pnpm --filter @schedule/miniprogram typecheck`、source audit、
  `pnpm miniprogram:verify` 均通过；clean verify packageBytes `5,113,419`。manifest 会包含每次构建时间，
  因此每次 verify 重新生成，不作为稳定 SHA/包体指标提交。
- 包体同口径从 `5,121,616` 降至 `5,113,419`，实际减少 `8,197` bytes；主包 warning 和矩阵 warning 保持
  既有类别。
- 根 production build、TypeScript、ESLint、全仓 Prettier、`git diff --check` 均通过；合入 production 父线后
  `pnpm test` 为 246 files / 1,170 passed / 364 skipped。
- `pnpm smoke:browser` 已运行：第一次因 5173 未启动拒绝连接；按正式启动方式重试时，该 worktree 缺少本地 `.env`，
  API 无法启动，因此未进入产品断言；端口已确认无残留。该结果不替代 production verifier。
- 未调用微信开发者工具 GUI/CLI；`.80` 体验版已由官方 Node `miniprogram-ci` 上传，production 已部署并加入
  allowlist，生产数据库备份已创建。Node/静态/WXS 结果仍不代替 Xiaomi 14 原生运行时或实体设备验收。
- production 备份：`bd5f74d6-4b06-4330-878b-9c1f87c6ee9f`（55 表、206,133 行、91,326,356B）；当前 release
  `3897581e7a8d5734ef5910e2dd8854a92c246062`；allowlist 含 `0.1.0-p10.20260902.80`。

## EXP-ICON-004 审计验证证据

- 当前调查 worktree 基于最新 `origin/main@359966f7`，初始工作树干净；本轮 tracked diff 仅允许为审计/设计/
  计划/状态文档。
- 已实际运行 `node apps/miniprogram/scripts/build.mjs --profile=production`（276 files written）、
  `node apps/miniprogram/scripts/source-audit.mjs`（passed）、`node apps/miniprogram/scripts/package-audit.mjs`
  （passed，total `5,113,419B`）和 `node apps/miniprogram/scripts/performance-budget.mjs`（passed，
  `tapCellPaths=2`）。
- Mini icon 源为 26 个 SVG / `7,218B`，当前全复制到 main；包体为 main `1,677,999B`、scheduling
  `425,318B`、organization `1,053,334B`、workflows `832,966B`、insights `1,071,781B`、diagnostics
  `52,021B`、total `5,113,419B`。main 既有内部 1.5MiB warning 已记录，迁移预算为 main +4KiB、total +8KiB。
- 本 checkpoint 计划提交信息：`docs(audit): record EXP-ICON-004 icon parity design`；提交前继续确认暂存
  diff 仅含本批 6 个文档。
- 本轮未触及 Web core consumer，不运行 `pnpm smoke:browser`；没有运行微信开发者工具、体验上传、真机验收或
  production deploy。Web bundle delta、原生冷启动、微信 image 内部 path animation、renderer 与 reduced-motion
  客户端行为均为“当前工具无法测量，暂未验证”。

## 状态策略与唯一下一任务

- 当前批次状态：`已完成静态/构建证据 → 待用户审阅`；没有把单测/Node 构建写成 Web、微信原生或 Xiaomi 14
  验收通过。
- 唯一下一任务：用户审阅 `docs/audit/exp-icon-004-icon-parity-audit.md`、对应 design/plan 以及 B1 精确
  Prompt；若批准，下一轮只执行 B1 source catalog/generator/tests，不自动进入 B2 生产图标替换。
- 本轮调查分支完成文档 checkpoint 推送后停止；不上传体验版、不部署 production，不进入全量 icon 实现或后续
  真机批次。不得清理其他 worktree，不 force push，不改 main。
