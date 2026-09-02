# Project Status

本文档只记录当前可安全接续的事实；详细历史以 Git、`docs/audit/` 和精确 debug 日志为准。每轮先读
`docs/agent-context/pitfall-index.json`，只加载匹配坑位详情。

## 当前仓库批次（2026-09-02）

- 已完成主线批次：`MINI-G1-001`、`MINI-G1-002`、`MINI-G1-003`、`EXP-UX-001`、`EXP-UX-002`；EXP-UX-002
  的请假/加扣班共享 sheet 迁移已由主线 `48488019` 收口，原生 Xiaomi 14 复核仍按其状态记录处理。
- 当前活动批次：`EXP-FEAT-002`；事件记录代码与自动化验证已完成，当前状态为“已完成（含运行验证）→ 待用户复核”。
- 执行基线：创建 worktree 时最新 `origin/main@359966f7240d2f557b24dd0c1ac61979d6bb8298`；收口前已安全
  rebase 至 `origin/main@48488019`。修复分支/worktree 为 `codex/exp-feat-002-event-records` /
  `runtime/external-project-worktrees/exp-feat-002-event-records`。
- 设计与计划：`docs/superpowers/specs/2026-09-02-exp-feat-002-event-records-design.md`、
  `docs/superpowers/plans/2026-09-02-exp-feat-002-event-records-implementation-plan.md`；Web→Mini 对齐矩阵与
  小米 14 验收清单见 `docs/audit/exp-feat-002-event-records.md`。
- 本批只处理班次详情事件记录：入口、既有事件 GET、共享 `ui-sheet`、状态、权限和异步隔离；不处理
  `MINI-G1-004`、日期选择器、图标系统、API/数据库合同或业务写请求。
- 不调用微信开发者工具、不上传体验版、不提交审核、不部署 production；自动化结果不替代下一版 Xiaomi 14 原生验收。

## 本批基线与验证证据

- worktree 创建时基线 SHA `359966f7`、初始状态 clean；Node `v24.14.0`、pnpm `11.9.0`。
- `pnpm install --frozen-lockfile --offline` 通过 lockfile 供应链校验，1459 个包链接完成，耗时约 42 分 53 秒；依赖
  目录为 ignored 产物。修改前永久红灯检查实际返回 0 个真实处理器、退出码 1。
- 定向事件测试 5/5；Mini 全量 115 files/626 tests；根测试 246 passed/37 skipped（1170 passed/364 skipped）。
- Mini/根 TypeScript、Mini production build（281 files）、根 production build、`miniprogram:verify`、source/package
  audit、determinism、credential-free CI dry-run、全仓 Prettier、ESLint、`git diff --check`、状态策略和
  `pnpm smoke:check-core` 均通过。最终 packageBytes `5,143,838`，main `1,712,119`；既有主包/矩阵及 Web 大
  chunk warning 未新增类别。
- 首轮冷安装期间全量 Mini 测试出现 7 个无关超时/页面 WXSS 预算失败；事件样式拆分到叶子组件后复跑清零，未保留
  无关改动。完整根因、请求隔离、权限和剩余差异见 audit/debug 文档。

## 已完成的历史批次

- `EXP-UX-001`：换班/工作流共享 sheet、picker 生命周期、direct Page 导航和 phase 标签收口；历史发布/包体/生产
  证据见 `docs/audit/wechat-miniprogram-audit.md` 第 11 节及对应 debug 条目。
- `EXP-UX-002`：请假/加扣班弹窗改用共享 `ui-sheet`，完成后仍需按其状态记录做 Xiaomi 14 原生复核；本批不改其代码。

## 状态策略与唯一下一任务

- 当前问题状态：代码、静态检查、Node 自动化和构建已完成，转为“待用户复核”；微信开发者工具与 Xiaomi 14 原生
  证据当前工具无法测量，不能写成真机通过。
- 唯一下一任务：下一版 Xiaomi 14 按 `docs/audit/exp-feat-002-event-records.md` 的 5 步最小验收核对匹配短 SHA、
  真实 sheet、loading/empty/error/retry、关闭/切班次隔离和无权边界；用户复核完成前不开始新的事件/日期/图标任务。
- Checkpoint commit：`fix(miniprogram): align shift event records with Web`；提交内容仅包含本批事件入口、共享
  sheet 内容、测试、对齐文档、黄金清单和状态记录。
- 主线收口规则：在最新远端主线确认后只做一次普通 fast-forward 推送到 main，不 force push、不上传体验版、不部署
  production；推送完成后停止。
