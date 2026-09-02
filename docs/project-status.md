# Project Status

本文档只记录当前可安全接续的事实；详细历史以 Git、`docs/audit/wechat-miniprogram-audit.md` 和精确
debug 日志为准。每轮先读 `docs/agent-context/pitfall-index.json`，只加载匹配坑位详情。

## 当前仓库批次（2026-09-02）

- 已完成主线批次：`MINI-G1-001`、`MINI-G1-002`、`MINI-G1-003`；本批起始基线为
  `origin/main@07decdbbf8bd4eaf7c34077392aea3b1fbc4eac2`。
- 当前活动批次：`EXP-UX-002`；用户已批准并复核本轮请假/加扣班弹窗外壳设计，当前处于“实现与自动验证完成，
  待 Xiaomi 14 真机复核”状态。上一批 `EXP-UX-001` 的 `.80` 体验版和 production release 仍只作为历史参考，
  本批不自动上传或部署。
- 修复分支/worktree：`codex/fix-exp-ux-002` /
  `runtime/external-project-worktrees/exp-ux-002`；起始基线为最新 `origin/main@359966f7`。用户主 worktree
  和其他 worktree 未修改、清理、暂存或借用。
- 本轮设计 checkpoint：书面规格 `docs/superpowers/specs/2026-09-02-exp-ux-002-design.md`，提交信息为
  `docs(superpowers): design EXP-UX-002 workflow sheets`，commit `ef3e06cf`。
- 本轮功能 checkpoint：请假/加扣班五个弹窗迁移到既有 `ui-sheet`，计划提交信息为
  `fix(miniprogram): align workflow sheets with shared shell`；代码与最终状态文档待在本 checkpoint 一并提交。
- 设计 checkpoint：`7cef75ff docs(superpowers): design EXP-UX-001 experience fixes`。
- 功能 checkpoint：`3b1cbd1b fix(miniprogram): close EXP-UX-001 experience regressions`。
- clean 包体文档 checkpoint：`f04fc56d docs(audit): record clean EXP-UX-001 verification`。
- 本次 build-time manifest 口径修正文档 checkpoint 提交信息：`docs(audit): clarify volatile build manifest`（本文件更新后提交）。
- 为保留当前 production `50ac2d07` 的 schema 53/目录查询能力，最终源码 tip 为
  `3897581e7a8d5734ef5910e2dd8854a92c246062`，其第一父为 EXP tip `d1594d09`、第二父为当前 production release；
  production 使用该 tip 的 hash-identical trusted reuse。
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

- 上一批 `EXP-UX-001` 的历史证据仍见审计第 11 节；本批新合同在业务源码修改前实际 4/4 红，修复后 4/4；
  当前受影响定向运行 5 files / 33 tests passed。
- Mini 全量：`pnpm miniprogram:test` 为 115 files / 625 tests passed；Mini TypeScript 通过。
- Mini：`pnpm miniprogram:build` 写入 276 files，source audit、`pnpm miniprogram:verify` 均通过；当前
  production packageBytes `5,109,717`。同口径上一批 clean `5,113,419`，实际减少 `3,702` bytes（workflows
  减少 `3,701` bytes）。manifest 会包含每次构建时间，不作为稳定 hash 指标。
- 本批 package audit 的主包 warning 与矩阵 `1445/1505` warning 保持既有类别，无新增类别；根 Prettier、ESLint、
  `git diff --check` 与 `pnpm smoke:check-core` 均通过。
- 根 production build、TypeScript、ESLint、全仓 Prettier、`git diff --check` 均通过；合入 production 父线后
  `pnpm test` 为 246 files / 1,170 passed / 364 skipped。
- `pnpm smoke:browser` 已运行：第一次因 5173 未启动拒绝连接；按正式启动方式重试时，该 worktree 缺少本地 `.env`，
  API 无法启动，因此未进入产品断言；端口已确认无残留。该结果不替代 production verifier。
- 未调用微信开发者工具 GUI/CLI；`.80` 体验版已由官方 Node `miniprogram-ci` 上传，production 已部署并加入
  allowlist，生产数据库备份已创建。Node/静态/WXS 结果仍不代替 Xiaomi 14 原生运行时或实体设备验收。
- production 备份：`bd5f74d6-4b06-4330-878b-9c1f87c6ee9f`（55 表、206,133 行、91,326,356B）；当前 release
  `3897581e7a8d5734ef5910e2dd8854a92c246062`；allowlist 含 `0.1.0-p10.20260902.80`。

## 状态策略与唯一下一任务

- 本轮状态：`已批准设计 → 规格复核通过 → 测试先行（旧 4/4 红）→ 实现 → 自动验证 → 待 Xiaomi 14 真机复核`；
  自动测试通过不等于已完成真机触摸验收。
- 唯一下一任务：用与最终 checkpoint 一致的体验版，在 Xiaomi 14 上复核请假/加扣班五个 sheet 的高度、safe-area、
  独立滚动、顶部拖动阈值/回弹、busy 保护和系统返回。继续不进入日期选择器、事件记录或图标任务；本批未上传体验版、
  未部署 production。
- 主线收口规则：先 fetch 最新主线，普通漂移自行处理；最终只做一次普通 fast-forward 推送到 main，
  不 force push、不清理其他 worktree。完成主线收口后停止。
