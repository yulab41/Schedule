# Project Status

本文档只记录当前可安全接续的事实；详细历史以 Git、`docs/audit/` 和精确 debug 日志为准。每轮先读
`docs/agent-context/pitfall-index.json`，只加载匹配坑位详情。

## 当前仓库批次（2026-09-03）

- 当前活动批次：`MINI-G1-004` 调查成果主线整合与 Git 收口。调查结论仍为“证据仍不足，保留 P3”，不进入
  分页、分批、懒加载或虚拟列表修复。
- 调查原始 tip：`e7ec0617716d37326f84ced01337da5adf941b82`；本次整合前最新主线为
  `origin/main@8e6a4a320a69fee9f1ca0471d8f9b140e3d4dd39`。
- 执行 worktree：`runtime/external-project-worktrees/mini-g1-004-evidence-audit-20260902`；主工作区的
  用户自有脏改动、其他 worktree 和其内容未修改、清理、暂存或借用。依赖沿用该 clean worktree，未重新链接
  1,459 个依赖。
- 本轮只合并四个调查成果文件，不采集 production 数据、不上传体验版、不操作 allowlist、不部署 production；
  未重跑阶段 0。

## MINI-G1-004 调查成果

- `GET /platform-admin/users`、`GET /groups/:groupId/members`、`GET /groups/:groupId/contacts` 返回完整数组；
  未发现服务端 `limit`、cursor、offset、pageSize 或自然总量上限。页面没有搜索、筛选、懒加载或渲染窗口。
- scale probe 只使用 synthetic 占位数据，标准 Mini 测试可发现，不进入生产运行时，不包含姓名、手机号、账号或
  真实群组 ID。`N=1/25/100` 显示 platform 行节点估算 `8N`、group member 行估算 `12N`；1→100 时 ready
  bytes 为 `341→19,000`、`1,068→34,728`，setData 次数固定为 4、6，payload 随 N 增长。
- 现有生产资料仅有 2026-08-25 聚合参考（活动群组 2、owner/admin/member 合计 2/3/21、pending 0、活动
  用户 35），没有当前 release 的逐页最大 N/分布；既有 P8 测试只有 1 个账号/成员，不能证明已形成用户影响。
- 桌面 Node wall-clock 只作可重复性记录，不能外推 Xiaomi 14 卡顿；没有匹配构建的原生首绘、节点、滚动或
  bridge 证据。

## 主线既有结论（合并时保留）

- `origin/main` 的 `EXP-UX-001`、`EXP-UX-002`、`EXP-FEAT-002`、`EXP-CALENDAR-003` 代码、设计、审计和
  自动化结论均保留；最新 `EXP-CALENDAR-003` 状态仍按主线记录为“已完成（含运行验证）→ 待用户复核”。
- `EXP-UX-001` 的 production release/schema/目录查询保留事实仍有效；历史 release tip 为
  `3897581e7a8d5734ef5910e2dd8854a92c246062`，`.80` 体验与 production 记录不因本次调查改变。
- 主线新增的代码、测试、`docs/audit/exp-feat-002-event-records.md` 及相关设计/计划文件未被本次整合回退。

## 验证证据与边界

- 复用同一 clean worktree 的既有依赖和 workspace dist，未重新链接 1,459 个依赖。本轮主线发生变化且触及 Mini
  测试路径，合并后 `pnpm miniprogram:test` 通过 119 files / 643 tests（91.46s）。
- 合并后 probe 所在的相关 7 files / 31 tests、`pnpm exec vitest run scripts/test-discovery-policy.test.mjs`
  的 1 file / 3 tests、Prettier、ESLint、`git diff --check` 与状态策略检查均通过；`pnpm smoke:check-core`
  确认未涉及 Web 核心链路。
- 本轮按仓库政策未调用微信开发者工具 GUI/CLI、模拟器、Console/Network；Node、静态和 simulate 结果不代替
  微信原生或 Xiaomi 14 验收。
- 不修改业务运行时代码、API、数据库、权限、路由、锁文件、dist 或其他生成物；最终候选只增加 probe 和更新
  三份状态/审计文档。

## 仓库级 Skill 发现修复（2026-09-03）

- `schedule-project-guardrails` 原只存在于专用分支/worktree，当前 `main` 因不含该提交而无法发现；现从
  自包含 checkpoint `411399e7` 精确移植 13 个 Skill 文件，并补根 `AGENTS.md` 短路由和 `runtime/local/` 忽略。
- 未采用 `5c45236d` 的依赖生命周期扩展，因为其引用的 `scripts/codex/*` helper 与 pitfall 尚未进入当前主线；
  不把不完整规则或该提交的无关 23 文件一起带入。
- 结构/front matter、9 个 Markdown/62 个链接、YAML、Windows PowerShell 5.1、只读 dry-run、失败关闭、
  Prettier、core-route 与 diff 检查通过。checkpoint 以 `fix(agent): make Schedule guardrails discoverable on main` 识别。
- 本批不改应用/数据库/迁移/构建产物，不安装依赖、不上传、不创建 production 备份或连接服务器；并行的
  `docs/audit/STATUS.md`/审计报告改动保持用户所有且不暂存，本 checkpoint 不接管其下一任务或停止条件。

## 唯一下一任务与停止条件

- 唯一下一任务：补“当前 release 脱敏规模 + 匹配构建的小米 14”证据，包括逐页规模/分布、SHA/trial、renderer、
  基础库、微信版本、首屏/节点/滚动结果；补证前保持 `MINI-G1-004` P3。
- 本批停止条件：合并后相称门禁、四文件清单和 Git 状态确认完成，以普通非强制方式推送 `origin/main` 后停止；
  不进入业务修复、不上传、不部署。
- 计划 checkpoint commit message：`merge: integrate MINI-G1-004 evidence audit`；提交后以最终主线 SHA 作为
  可接续身份。
