# Project Status

本文档只记录当前可安全接续的事实；详细历史以 Git、`docs/audit/` 和精确 debug 日志为准。每轮先读
`docs/agent-context/pitfall-index.json`，只加载匹配坑位详情。

## 当前仓库批次（2026-09-03）

- 当前活动批次：`MINI-G1-004` 第二阶段补证（production 脱敏聚合、体验版运行时适用性和 Xiaomi 14 人工验收
  准备）。调查结论仍为“证据仍不足，保留 P3”，不进入分页、分批、懒加载或虚拟列表修复。
- 本轮冻结基线：`MAIN_HEAD=78d0424e19cfc81be142da7e0f5367110f1fc8f2`；体验版
  `0.1.0-p10.20260903.84@8e6a4a320a69fee9f1ca0471d8f9b140e3d4dd39`；live server release
  `48488019171924701054354e8f707b08eb4d12fe`；冻结时间 `2026-09-03T22:05:18.4095188+08:00`。
- 冻结后发现主线 `76a572a3378bb452b23db30eb5d850c3d705cd93` 仅补入 guardrail Skill、根 `AGENTS.md`、
  `.gitignore` 和状态文档；MINI-G1-004 相关运行时路径无差异。按冻结规则，本轮证据仍归属于 `78d0424e…`，
  不切换候选、不重跑 production 聚合。
- 调查原始 tip：`e7ec0617716d37326f84ced01337da5adf941b82`；本次补证没有改变主线代码。
- 执行 worktree：`runtime/external-project-worktrees/mini-g1-004-evidence-audit-20260902`；主工作区的
  用户自有脏改动、其他 worktree 和其内容未修改、清理、暂存或借用。依赖沿用该 clean worktree，未重新链接
  1,459 个依赖。
- 本轮只做 Git/上传记录/allowlist 状态的只读复核、一次 production 聚合读取、既有 synthetic probe 和审计文档
  记录；未上传新体验版、未部署 production、未修改 allowlist，未重跑阶段 0。

## MINI-G1-004 调查成果

- `GET /platform-admin/users`、`GET /groups/:groupId/members`、`GET /groups/:groupId/contacts` 返回完整数组；
  未发现服务端 `limit`、cursor、offset、pageSize 或自然总量上限。页面没有搜索、筛选、懒加载或渲染窗口。
- scale probe 只使用 synthetic 占位数据，标准 Mini 测试可发现，不进入生产运行时，不包含姓名、手机号、账号或
  真实群组 ID。`N=1/25/100` 显示 platform 行节点估算 `8N`、group member 行估算 `12N`；1→100 时 ready
  bytes 为 `341→19,000`、`1,068→34,728`，setData 次数固定为 4、6，payload 随 N 增长。
- 冻结 live release 下的 production 只读聚合为：`/platform-admin/users` 有效返回 35 条；活动群组 2 个，
  匿名成员最终有效行数为 17、6，pending 非重复均为 0，contacts endpoint 行数为 17、6。群组规模统计（最终
  members 行数）为最小 6、最大 17、中位数 11.5；2 个群组时 P90/P95 不具统计意义。最大列表来自 platform
  accounts（35）。
- 桌面 Node wall-clock 只作可重复性记录，不能外推 Xiaomi 14 卡顿；没有匹配构建的原生首绘、节点、滚动或
  bridge 证据。

## 主线既有结论（合并时保留）

- `origin/main` 的 `EXP-UX-001`、`EXP-UX-002`、`EXP-FEAT-002`、`EXP-CALENDAR-003` 代码、设计、审计和
  自动化结论均保留；最新 `EXP-CALENDAR-003` 状态仍按主线记录为“已完成（含运行验证）→ 待用户复核”。
- `EXP-UX-001` 的 production release/schema/目录查询保留事实仍有效；历史 release tip 为
  `3897581e7a8d5734ef5910e2dd8854a92c246062`，`.80` 体验与 production 记录不因本次调查改变。
- 主线新增的代码、测试、`docs/audit/exp-feat-002-event-records.md` 及相关设计/计划文件未被本次整合回退。

## 验证证据与边界

- 已执行两次 `git fetch origin`，冻结前确认 `.84` 与当前主线的 MINI-G1-004 相关路径无差异；trial/main 相关
  blob 清单哈希均为 `37943122c24e7ddd1772b686b1324f777b0efe4473c1e0c5914c89591bead0e6`。live release 与主线
  的相关 API/contract scope 也无差异，双方清单哈希均为 `ab3be6b4f52e7a801e72d93da2c201d05ce335c904e3243701d684f87ce07654`。
- 复用 clean G1 worktree 执行既有 probe：`pnpm --filter @schedule/miniprogram exec vitest run
scripts/mini-g1-004-scale-probe.test.mjs --fileParallelism=false`，1 file / 1 test 通过（855ms）。本轮未
  重跑阶段 0 或 Mini 全量测试。
- production 查询窗口为 `2026-09-03T14:12:44Z`，前后 release 一致；首次 SQL 文本在解析阶段因 `groups`
  保留字停止、未读取数据，修正后才执行有效的只读聚合。未调用微信开发者工具 GUI/CLI、模拟器、
  Console/Network、截图或上传；Xiaomi 14 原生首绘、节点、滚动和 bridge 结果仍待用户提供。
- 文档校验：`git diff --check` 通过；`docs/audit/STATUS.md` 和本文件按仓库 Prettier 规则通过。审计长报告
  基线本身不是 Prettier clean，本轮未为格式重排历史全文。
- 决策/偏差：production 聚合首次 SQL 仅在数据库解析阶段因保留字停止，未读取数据；修正后的唯一有效查询
  前后 release 一致。未取得原生节点或 bridge 指标，不把 synthetic 估算写成真机结果。
- 前一文档 evidence checkpoint `cc5fd98a51dd4117205614bb1e36d8596c0b7fed`（`docs(audit): record
MINI-G1-004 second-stage evidence`）已普通 fast-forward 推送；其父提交 `76a572a3…` 是冻结后才发现的
  guardrail-only 主线更新，未改变本轮证据身份。
- 本轮按仓库政策未调用微信开发者工具 GUI/CLI、模拟器、Console/Network；Node、静态和 simulate 结果不代替
  微信原生或 Xiaomi 14 验收。
- 只更新本轮证据记录文档；不修改业务运行时代码、API、数据库、权限、路由、锁文件、dist 或其他生成物。根
  工作区既有未跟踪 `.agents/`、`runtime/`、`src/` 和本地表格保持原样。

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

- 唯一下一任务：用户在冻结的 `0.1.0-p10.20260903.84@8e6a4a32` 上完成 Xiaomi 14“更多 → 测试工具”环境
  抄录和两个页面的只读首屏/滚动录屏反馈；若版本或 SHA 不匹配，停止测试并只回传实际环境信息。
- 本批停止条件：当前补证结果已记录，等待匹配构建的 Xiaomi 14 反馈；不进入业务修复，不上传，不部署。最终状态
  保持 `MINI-G1-004：证据仍不足，保留 P3，等待匹配构建的 Xiaomi 14 反馈。`
- 本次 post-freeze guardrail 说明的 checkpoint commit message：`docs(audit): note post-freeze guardrail
baseline`；提交后继续以冻结 evidence baseline 作为身份，不把文档提交 SHA 当成体验版源码 SHA。
