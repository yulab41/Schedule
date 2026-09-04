# Project Status

本文档只记录当前可安全接续的事实；详细历史以 Git、`docs/audit/` 和精确 debug 日志为准。每轮先读
`docs/agent-context/pitfall-index.json`，只加载匹配坑位详情。

## 当前仓库批次（2026-09-04）

- 当前活动批次：用户明确批准的 `EXP-ICON-004-LINEAGE-B1` 已先红后绿实现，并已将执行期间前进的
  `origin/main@75cc0d3b82dbe03fa1923e0c091b805872603ff8` 合入当前分支；合并后复核通过，正在创建 merge
  checkpoint 并推送。
- B1 实现 checkpoint：`c027abcd`（`fix(miniprogram): enforce cumulative trial lineage`）。执行 worktree：
  `runtime/external-project-worktrees/exp-icon-004-lineage-b12-20260903`；分支
  `codex/exp-icon-004-lineage-b12-20260903`。
- 本批修改 Mini release helper、历史/policy、测试、runbook、审计和状态文档；未修改生产图标、业务页面、API、
  权限、路由、数据库、依赖、锁文件或 generated dist，未重跑阶段 0。
- 本批未创建真实 trial tag、未上传体验版、未操作 allowlist、未提审、未正式发布、未连接或部署 production。

## EXP-ICON-004 已确认根因与 B1 结果

- 用户所见 `.84` 的 exact clean production profile 为 `0.1.0-p10.20260903.84@8e6a4a3`；它不包含
  `.83@5285dd1` 的 `1ffab10c`/`5285dd17` 图标提交，因此数字前进但图标代码回退。
- `.75@24a847ff` 曾未严格包含原 `.74@d23a78a`；`.76@a2cdd065` 已重新调查并完整恢复其最终行为，当前
  test-tools 三个关键 blob 与 `.76` 相同，不移植旧 `.74` 支线。
- `.74` 出现末尾序号多 SHA，`.81/.82` 出现同一完整版本多 SHA。旧 upload helper 只检查通用 semver，
  不检查 central reservation、clean SHA、`origin/main`、前序 trial 或 required checkpoints。
- B1 实施期间并行 G1-004 任务又通过旧流程上传并放行 `0.1.0-p10.20260903.85@a1bba57`；tracked history
  已追加该事实，policy bootstrap floor 为 85，不追补真实 tag，避免未来重新选择 `.85`。
- 新 `upload-experience` 强制执行：`.74–.85` history/policy 校验、fresh `origin/main`、clean production、
  latest trial/required checkpoint ancestry、description short SHA、exact `build-profile.json`、非 force 轻量
  `miniprogram-trial/<version>` tag 占用，以及上传成功后的 ignored receipt。required checkpoint 固定包含
  `5285dd17`；preview/dry-run 不读取或改变 trial 外部状态。
- 同版本同 SHA 只允许 latest trial 幂等重试；同版本不同 SHA 拒绝。上传失败或响应不确定也不删除/改指 tag；
  回滚使用最新累积 tip 上的 revert commit 和新版本。

## 保留的主线事实

- `MINI-G1-004` 第二阶段结论仍为“证据不足，保留 P3”。冻结 production 聚合基线为
  `78d0424e`，live release 为 `48488019`；匿名规模为 platform accounts 35、两个群组 members/contacts
  17/6、pending 0。synthetic `N=1/25/100` probe 不等于 Xiaomi 14 原生性能证据。
- G1-004 已上传并放行 `.85@a1bba57`，Manifest
  `7ae30753e7fc6437826a802df30d1062016a7192f5d494baba50ab9c8be5f63b`，production 包体
  `5,153,449 B`；allowlist 保留 `.81–.84` 并新增 `.85`。该候选用于 G1 人工补证，但不含 `5285dd17`，
  不能作为 EXP-ICON-004 图标修复候选。
- G1-004 唯一待办仍是用户在 `.85@a1bba57` 的 Xiaomi 14 上抄录“更多 → 测试工具”环境并完成 platform
  accounts/group settings 只读首屏与滚动反馈；版本或 SHA 不匹配时停止。详细步骤与 TUN/allowlist 事实见
  `docs/audit/wechat-miniprogram-audit.md`。
- `schedule-project-guardrails` dependency environment lifecycle 已随 `879e98f6` 合入。本轮重新读取更新后的
  Skill 与 references，L2 inspector 以 `SKILL_HASH=1fce818e78639b1aec964802e9b06cadd0fc7896960ce11946387e0b41c65f68`
  返回 PASS。

## 验证、依赖与预算

- 失败先行：旧实现运行新增测试时因缺 `trial-lineage.mjs` 以 `ERR_MODULE_NOT_FOUND` 退出 1；实现后定向
  lineage 12/12、既有 CI helper 6/6 通过。临时 bare remote 的两个不同 SHA 并发占同一 tag 时只有一个成功；
  winner 同 SHA retry 幂等，loser 被拒；并行分支推进 main 后 stale candidate 也被拒。
- 完整 Mini 首轮有 118 files/652 tests 通过、2 suite 因 clean worktree 缺 workspace producer declarations
  收集失败；只构建 `contracts`/`scheduling-domain`/`presentation-core` 后，同一命令为 120/120 files、
  655/655 tests。后续不复制 main worktree dist，也不重复安装依赖。
- 依赖 bootstrap 在新 lifecycle 进入主线前执行过一次
  `pnpm install --frozen-lockfile --config.strictDepBuilds=false`：1,459 packages 全部复用、0 下载，tracked
  dependency inputs 无变化；新规则加载后只复用该健康 worktree 环境。
- 合并最新主线后再次执行 Mini 120 files/655 tests、typecheck/production verify/package/trial policy/
  determinism/CI dry-run、全仓 format/lint、Skill validation、agent-context 3/3、`git diff --check` 与
  `smoke:check-core`，均通过；未涉及 Web core，无需 browser smoke。合并前 source/performance 结果继续有效，
  主线新增内容只涉及 Skill 与审计文档。
- B1 production package total `5,151,892 B`、main `1,715,718 B`，与 B1 前同口径基线完全相同；只保留既有
  主包和 600 格矩阵 warning。B1 release tooling/JSON 不进入业务包。
- 图标 B1.2 预算仍为同口径总包 ≤+64 KiB、B1.2 自身 ≤+16 KiB、generated adapter ≤+12 KiB；不新增
  runtime dependency。冷启动、帧率、内存和 Skyline 合成开销当前工具无法测量，暂未验证。

## 文档入口

- 血缘、完整图标对照、严重程度、迁移分类、包体、批次和真机清单：
  `docs/audit/exp-icon-004-trial-lineage-and-b12.md`。
- 单一视觉来源、平台 adapter、trial tag/preflight 和验收设计：
  `docs/superpowers/specs/2026-09-03-exp-icon-004-b12-and-trial-lineage-design.md`。
- B1 引入点、红绿测试、行为审计和边界：`docs/debug/debug-feedback-log.md` 的
  `EXP-ICON-004-LINEAGE-B1` 条目。

## 唯一下一任务与停止条件

- 唯一下一任务：用户再次明确批准后执行 `EXP-ICON-004-B2`，从执行时最新 `origin/main`/当前累计分支合入
  `1ffab10c`、`5285dd17` 的原始提交身份，并仅人工解决已知状态文档冲突；先确认 B1 门禁仍通过。
- merge checkpoint 以 `merge: integrate latest main into trial lineage guard` 识别；普通推送成功即停止。不自动进入
  B2、B3 图标修改、L3 上传或 L4 production 操作。
