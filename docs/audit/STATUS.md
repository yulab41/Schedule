# 微信小程序审计状态

## 当前阶段

- 当前批次：`EXP-FEAT-002`；代码与自动化验证已完成，当前状态为“已完成（含运行验证）→ 待用户复核”。
- 执行基线：创建 worktree 时最新 `origin/main@359966f7240d2f557b24dd0c1ac61979d6bb8298`；收口前已安全
  rebase 至 `origin/main@48488019`。执行分支/worktree 为 `codex/exp-feat-002-event-records` /
  `runtime/external-project-worktrees/exp-feat-002-event-records`。
- 范围：小程序工作台班次详情事件记录入口、既有事件 GET、共享 `ui-sheet`、Web 同源展示状态、权限和异步清理。
  不执行 `MINI-G1-004`、日期选择器、图标系统、API/数据库合同、业务写请求、体验上传或 production 部署。
- 设计、计划和对齐矩阵分别见 `docs/superpowers/specs/2026-09-02-exp-feat-002-event-records-design.md`、
  `docs/superpowers/plans/2026-09-02-exp-feat-002-event-records-implementation-plan.md` 和
  `docs/audit/exp-feat-002-event-records.md`。

## 已验证事实

- 上一主线批次 `EXP-UX-002` 已完成请假/加扣班五个弹窗的既有 `ui-sheet` 外壳迁移、direct Page manifest 注册、
  shared shell 自动验证；不把其 Xiaomi 14 待复核状态误写成当前事件记录验收。
- 当前根因已用 `git log -S`/`git blame` 定位：两处事件入口绑定 `handleUnavailable`，只写“功能将在后续阶段开放”
  公告，没有 shift ID、事件 GET、真实事件模型或界面；占位引入点为 `ad4cfb2c`/`4fe1b5e78`。
- 永久红灯先行实际返回 `RED: expected 2 real event handlers, found 0`、退出码 1；实现后同一入口检查找到 2 个
  真实处理器。定向事件测试 5/5，Mini 全量 115 files/626 tests，根测试 246 passed/37 skipped、1170
  passed/364 skipped。
- Mini/根 TypeScript、production build、`miniprogram:verify`、source/package audit、determinism、无凭据 CI
  dry-run、全仓 Prettier/ESLint、`git diff --check`、`pnpm smoke:check-core` 均通过。最终 production packageBytes
  `5,143,838`，main `1,712,119`；既有主包/矩阵和 Web 大 chunk warning 未新增类别。
- 本批未上传体验版、未提交审核、未部署 production；未调用微信开发者工具 GUI/CLI。Node、静态、WXS、构建和自动化
  结果不能代替 Xiaomi 14 原生触摸、安全区、Skyline 或系统返回验收。

## 唯一下一任务与停止条件

- 唯一下一任务：用户在下一版 Xiaomi 14 按 `docs/audit/exp-feat-002-event-records.md` 的 5 步清单，先核对候选短
  SHA/renderer/基础库，再复核入口点击、真实事件内容、状态/retry、关闭/切班次隔离和访客权限；在此之前不开始
  日期选择器、图标系统或其他功能。
- 当前状态保持“待用户复核”，直到收到与本轮构建匹配的用户原生证据；不以模拟器或自动化替代该证据。
- 本批最终只做一次普通 fast-forward 推送到 main；不上传体验版、不部署 production，推送完成后停止。
