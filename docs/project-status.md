# Project Status

本文档只记录当前可安全接续的事实；详细历史以 Git、`docs/audit/wechat-miniprogram-audit.md` 和精确
debug 日志为准。每轮先读 `docs/agent-context/pitfall-index.json`，只加载匹配坑位详情。

## 当前仓库批次（2026-09-02）

- 已完成主线批次：`MINI-G1-001`、`MINI-G1-002`、`MINI-G1-003`；当前基线为
  `origin/main@07decdbbf8bd4eaf7c34077392aea3b1fbc4eac2`。
- 当前活动批次：`EXP-UX-001`；用户已批准书面设计，代码、永久合同、审计和 debug 连续性文档已完成，
  当前状态为“已完成自动化验证，待用户 Xiaomi 14 真机复核”。
- 修复分支/worktree：`codex/fix-exp-ux-001` /
  `runtime/external-project-worktrees/exp-ux-001`；用户主 worktree 和其他 worktree 未修改、清理、
  暂存或借用。
- 设计 checkpoint：`7cef75ff docs(superpowers): design EXP-UX-001 experience fixes`。
- 功能 checkpoint：`3b1cbd1b fix(miniprogram): close EXP-UX-001 experience regressions`。
- clean 包体文档 checkpoint：`f04fc56d docs(audit): record clean EXP-UX-001 verification`。
- 本次 build-time manifest 口径修正文档 checkpoint 提交信息：`docs(audit): clarify volatile build manifest`（本文件更新后提交）。
- 不重跑阶段 0，不执行 `MINI-G1-004`，不进入日期选择器、事件记录或全局图标任务。

## 已完成的 EXP-UX-001

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

## 验证证据

- 旧实现先红：EXP 合同在业务源码修改前实际 7 红/1 绿；修复后 EXP 9/9，受影响定向合同 52/52。
- Mini 全量：`pnpm miniprogram:test` 为 114 files / 621 tests passed。
- Mini：`pnpm miniprogram:build`、`pnpm --filter @schedule/miniprogram typecheck`、source audit、
  `pnpm miniprogram:verify` 均通过；clean verify packageBytes `5,113,419`。manifest 会包含每次构建时间，
  因此每次 verify 重新生成，不作为稳定 SHA/包体指标提交。
- 包体同口径从 `5,121,616` 降至 `5,113,419`，实际减少 `8,197` bytes；主包 warning 和矩阵 warning 保持
  既有类别。
- 根 production build 通过；根 TypeScript 通过；ESLint 通过；`pnpm smoke:check-core` 通过并确认未涉及
  Web 核心链路；`git diff --check` 通过；本批变更文件定向 Prettier 通过。
- 全仓 `pnpm format:check` 仍报告基线已有 12 个无关文件：`apps/miniprogram/testing/p8-organization-rc-plan.json`、
  6 个 `apps/web/src/stories/miniprogram` 文件、2 个 `packages/client-core` 文件、
  `apps/miniprogram/scripts/client-core-calendar-boundary.test.mjs`、`p10-directory-native.test.mjs`、
  `p8-organization-rc-plan.test.mjs`；本批未改动它们。
- 未调用微信开发者工具 GUI/CLI，未上传体验版，未部署 production，未创建生产备份；Node/静态/WXS 结果不
  代替原生运行时或实体设备验收。

## 状态策略与唯一下一任务

- 四类代码问题：`已完成`（根因已修复且自动化/构建验证通过）。批次总状态：`待用户复核`，原因仅为
  Xiaomi 14 的真实触摸手感、safe-area、内部滚动和系统返回尚未在当前 tip 的体验版上复核。
- 唯一下一任务：用户在明确授权上传当前最终 SHA 的体验版后，按审计第 11.6 节五步做 Xiaomi 14 最小验收；
  在此之前不上传、不部署、不开始事件记录、日期组件或图标任务。
- 主线收口规则：先 fetch 最新主线，普通漂移自行处理；最终只做一次普通 fast-forward 推送到 main，
  不 force push、不清理其他 worktree。完成主线收口后停止。
