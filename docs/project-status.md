# Project Status

本文档只记录当前可安全接续的事实；详细历史以 Git、`docs/audit/` 和精确 debug 日志为准。每轮先读
`docs/agent-context/pitfall-index.json`，只加载匹配坑位详情。

## 当前仓库批次（2026-09-04）

- 当前活动批次：`MINI-G1-004` 第二阶段补证（体验版上传/放行后的 Xiaomi 14 人工验收准备）。调查结论仍为
  “证据仍不足，保留 P3”，不进入分页、分批、懒加载或虚拟列表修复。
- 前序 production 聚合冻结基线：`MAIN_HEAD=78d0424e19cfc81be142da7e0f5367110f1fc8f2`；体验版
  `0.1.0-p10.20260903.84@8e6a4a320a69fee9f1ca0471d8f9b140e3d4dd39`；live server release
  `48488019171924701054354e8f707b08eb4d12fe`；冻结时间 `2026-09-03T22:05:18.4095188+08:00`。
- 前序冻结后发现主线 `76a572a3378bb452b23db30eb5d850c3d705cd93` 仅补入 guardrail Skill、根 `AGENTS.md`、
  `.gitignore` 和状态文档；MINI-G1-004 相关运行时路径无差异。前序 production 聚合证据仍归属于
  `78d0424e…`，本轮不重跑 production 聚合；上传候选另按当前主线建立独立的 `.85` evidence baseline。
- 调查原始 tip：`e7ec0617716d37326f84ced01337da5adf941b82`；本次补证没有改变主线代码。
- 执行 worktree：`runtime/external-project-worktrees/mini-g1-004-evidence-audit-20260902`；主工作区的
  用户自有脏改动、其他 worktree 和其内容未修改、清理、暂存或借用。依赖沿用该 clean worktree，未重新链接
  1,459 个依赖。
- 上传前再次 fetch 并复核后，当前 MINI-G1-004 运行时证据基线为：
  `EVIDENCE_MAIN_SHA=a1bba5710cfd5c94b5fd5148898e4f17e45faab9`；选定唯一未占用体验版
  `EVIDENCE_TRIAL_VERSION=0.1.0-p10.20260903.85`、
  `EVIDENCE_TRIAL_SHA=a1bba5710cfd5c94b5fd5148898e4f17e45faab9`、
  `EVIDENCE_TRIAL_MANIFEST=7ae30753e7fc6437826a802df30d1062016a7192f5d494baba50ab9c8be5f63b`；
  profile 为 `production`，clean 标记为 `production-clean`，包体 `5,153,449 bytes`。上传日志起始时间为
  `2026-09-04T07:42:13.616+08:00`，服务器实际 release 仍为
  `EVIDENCE_SERVER_RELEASE=48488019171924701054354e8f707b08eb4d12fe`。
- 服务器 allowlist 复核显示此前 `.81`、`.82`、`.83`、`.84` 均保留，本轮只追加 `.85`，没有覆盖或遗漏历史
  体验版；allowlist verify 和完整 production verifier 均通过。未提审、未正式发布、未执行 ECS 部署、数据库
  迁移或备份，未重跑阶段 0。

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
- `.85` 与 `.84` 及当前主线的 MINI-G1-004 相关运行时 scope 等价；候选 build safety 为
  `ready-clean-detached`，源码相对 `.84` 的差异仅为调查 probe/构建记录等非运行时内容。`.85` 可作为当前
  Xiaomi 14 人工验收候选，但 production 聚合仍归属于已冻结的 live release，不把体验版上传写成 production
  发布。
- 桌面 Node wall-clock 只作可重复性记录，不能外推 Xiaomi 14 卡顿；没有匹配构建的原生首绘、节点、滚动或
  bridge 证据。

## 主线既有结论（合并时保留）

- `origin/main` 的 `EXP-UX-001`、`EXP-UX-002`、`EXP-FEAT-002`、`EXP-CALENDAR-003` 代码、设计、审计和
  自动化结论均保留；最新 `EXP-CALENDAR-003` 状态仍按主线记录为“已完成（含运行验证）→ 待用户复核”。
- `EXP-UX-001` 的 production release/schema/目录查询保留事实仍有效；历史 release tip 为
  `3897581e7a8d5734ef5910e2dd8854a92c246062`，`.80` 体验与 production 记录不因本次调查改变。
- 主线新增的代码、测试、`docs/audit/exp-feat-002-event-records.md` 及相关设计/计划文件未被本次整合回退。

## 验证证据与边界

- 已执行本轮 fetch 和上传前复核；`.85` 与 `.84`/主线的 MINI-G1-004 相关运行时 scope blob 清单哈希均为
  `37943122c24e7ddd1772b686b1324f777b0efe4473c1e0c5914c89591bead0e6`。live release 与主线的相关
  API/contract scope 也无差异，双方清单哈希均为 `ab3be6b4f52e7a801e72d93da2c201d05ce335c904e3243701d684f87ce07654`。
- 复用 clean G1 worktree 执行既有 probe：`pnpm --filter @schedule/miniprogram exec vitest run
scripts/mini-g1-004-scale-probe.test.mjs --fileParallelism=false`，1 file / 1 test 通过（855ms）。候选 clean
  release worktree 的 Mini 全量门禁为 119 files / 643 tests 通过；`verify`、source/package、determinism、
  CI dry-run 和 safety 均通过。本轮未重跑阶段 0。
- production 查询窗口为 `2026-09-03T14:12:44Z`，前后 release 一致；首次 SQL 文本在解析阶段因 `groups`
  保留字停止、未读取数据，修正后才执行有效的只读聚合。未调用微信开发者工具 GUI/CLI、模拟器、
  Console/Network、截图或模拟器；上传使用 TUN 保持开启时的进程级 `servicewechat.com` IPv4 DNS route，
  未修改系统 TUN、hosts、系统 DNS 或业务实现。Xiaomi 14 原生首绘、节点、滚动和 bridge 结果仍待用户提供。
- 文档校验：`git diff --check` 通过；`docs/audit/STATUS.md` 和本文件按仓库 Prettier 规则通过。审计长报告
  基线本身不是 Prettier clean，本轮未为格式重排历史全文。
- 决策/偏差：production 聚合首次 SQL 仅在数据库解析阶段因保留字停止，未读取数据；修正后的唯一有效查询
  前后 release 一致。未取得原生节点或 bridge 指标，不把 synthetic 估算写成真机结果。
- 前一文档 evidence checkpoint `cc5fd98a51dd4117205614bb1e36d8596c0b7fed`（`docs(audit): record
MINI-G1-004 second-stage evidence`）已普通 fast-forward 推送；其父提交 `76a572a3…` 是冻结后才发现的
  guardrail-only 主线更新，未改变本轮证据身份。
- 本轮按仓库政策未调用微信开发者工具 GUI/CLI、模拟器、Console/Network；Node、静态和 simulate 结果不代替
  微信原生或 Xiaomi 14 验收。此前普通 TUN/代理上传尝试收到微信 `-10008 invalid ip` 且没有成功回执；随后
  使用仅对本次 Node 进程生效的 DNS override 后成功，临时 helper 已删除。
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

## 仓库级 Skill 依赖环境生命周期（2026-09-04）

- 已把用户批准的 dependency environment lifecycle 完整写入按需加载的 `worktree-and-bootstrap.md`；短
  `SKILL.md` 只增加安装前路由和复用硬门禁，未复制整章规范。
- Skill 校验器现固定检查 conversation/branch/SHA 不自动失效、完整指纹维度、健康 `node_modules` 复用、
  worktree 池持久化、禁止 `git clean -xfd`、禁止跨 worktree 共享可写依赖以及 workspace 输出独立指纹。
- 当前 `main` 只有 release worktree 的 tracked-input marker，没有专用分支 `5c45236d` 中完整的通用
  `scripts/codex/*` 池化 helper；本批不移植该提交或声称已有完整 checker。适用 helper 不能覆盖全部维度时必须
  停止并报告，不能用重装代替检查。
- 定向红绿校验先捕获缺少 lifecycle 路由，补齐后通过：结构 13 文件、front matter、YAML、9 个 Markdown/64
  个链接、3 个 PowerShell 语法和只读 AST、context dry-run、Prettier、`pnpm smoke:check-core` 与
  `git diff --check` 均通过；未触发核心浏览器 smoke。
- 本批不修改业务功能、依赖、锁文件、构建产物或生产状态；未运行 `pnpm install`、全仓 verify、production
  build、包体审计、微信上传、production SSH/备份/部署。checkpoint 以
  `docs(agent): preserve dependency environments across conversations` 识别。

## 唯一下一任务与停止条件

- 唯一下一任务：用户在已放行的 `0.1.0-p10.20260903.85@a1bba57` 上完成 Xiaomi 14“更多 → 测试工具”环境
  抄录和两个页面的只读首屏/滚动录屏反馈；若版本或 SHA 不匹配，停止测试并只回传实际环境信息。
- 本批停止条件：体验版上传/放行已完成，等待匹配构建的 Xiaomi 14 反馈；不进入业务修复，不提审、不正式发布、
  不部署。最终状态保持 `MINI-G1-004：证据仍不足，保留 P3，等待匹配构建的 Xiaomi 14 反馈。`
- 本 checkpoint commit message：`docs(audit): record MINI-G1-004 experience upload`；提交后的文档 SHA 不替代
  `EVIDENCE_MAIN_SHA` 或体验版源码 SHA。
