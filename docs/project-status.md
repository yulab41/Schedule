# Project Status

本文档只记录当前可安全接续的事实；详细历史以 Git、`docs/audit/` 和精确 debug 日志为准。每轮先读
`docs/agent-context/pitfall-index.json`，只加载匹配坑位详情。

## 当前仓库批次（2026-09-04）

- 当前活动批次：用户已明确批准的 `EXP-ICON-004-LINEAGE-B1` 已先红后绿实现；正在形成 checkpoint 并合并
  执行期间前进的最新主线。本批不修改生产图标，不创建真实 trial tag，不上传体验版，不操作 allowlist 或
  production。
- 实施/完整验证基线为 `origin/main@a1bba5710cfd5c94b5fd5148898e4f17e45faab9`。worktree 创建于
  `78d0424e`，发现主线前进后已 fast-forward 纳入 `76a572a3`、`cc5fd98a`、`a1bba571`，再人工合并
  本轮状态文档；结束前 fetch 又发现 `origin/main@75cc0d3b82dbe03fa1923e0c091b805872603ff8`，包含新 Skill
  lifecycle 和 `.85` 上传/放行事实，须在 B1 checkpoint 后人工合并并复核。
- 执行 worktree：`runtime/external-project-worktrees/exp-icon-004-lineage-b12-20260903`；分支
  `codex/exp-icon-004-lineage-b12-20260903`。未借用主工作区脏改动或其他 worktree 制品。
- 本批修改 Mini release helper、历史/policy、测试、runbook、审计和状态文档；未修改生产图标、业务页面、API、
  权限、路由、数据库、依赖、锁文件或 generated dist；未重跑阶段 0。

## 已确认根因与影响

- 当前用户所见 `.84` 的 exact clean production profile 为
  `0.1.0-p10.20260903.84@8e6a4a3`，不包含图标分支的 `1ffab10c` 和 `5285dd17`；`.84` 相对
  `.83@5285dd1` 是 Git 血缘回退。
- `.84` 源码仍有 25 个不同的 `web-*.svg` 名称、85 次生产引用和 CSS/WXML 手绘几何；图标分支为 0 次
  `web-*`、46 个不同 generated `ui-*` 资产、127 次生产引用。
- `.75@24a847ff` 曾未严格包含 `.74@d23a78a`；`.76@a2cdd065` 已重新调查并更完整恢复该行为。当前
  test-tools 三个关键 blob 与 `.76` 完全一致，所以不 cherry-pick 旧 `.74` 支线。
- `.74` 曾出现末尾序号多 SHA，`.81/.82` 出现同一完整版本多 SHA；旧 upload helper 只检查通用 semver，
  不检查 central reservation、clean SHA、`origin/main`、前序 trial 或 required checkpoints。
- B1 实施期间并行 G1-004 任务又通过旧流程上传并放行 `.85@a1bba57`；tracked history 和 bootstrap floor
  已追加到 85，不追补真实 tag，避免未来重新选择 `.85`。
- 当前 `origin/main` 包含 `.75–.82` 主线及 G1-004 调查，但缺图标 `1ffab10c`、`5285dd17`。当前主线与
  图标分支生产代码无重叠，只有三份状态/审计文档重叠。

## 设计决策

- 推荐采用远端不可变 `miniprogram-trial/<version>` tag 原子占用版本；同 SHA 可幂等重试，不同 SHA 必须拒绝，
  上传失败也不回收版本。
- 累积候选必须包含执行时最新 `origin/main`、latest cumulative trial 和 policy 的 required checkpoints；
  bootstrap floor 为执行期间最新 `.85`，且至少要求 `5285dd17`。紧急回滚使用最新 tip 上的 revert commit，
  不给旧 SHA 新版本号。
- geometry、context size/stroke/color 和 motion 分别由 `packages/ui-icons` 的 catalog/context/motion 保存；
  Web/Mini CSS 由同一 motion 数据生成。Mini 只保留 selector、transform-origin、part asset 和能力降级。
- B1.2 必须补齐底部五项、顶部 bell/user、通讯录模式、calendar filter/locate 和更多页 context；不重新绘制 path，
  不新增动画 runtime。

## 保留的主线事实

- `MINI-G1-004` 第二阶段在冻结 `78d0424e` / `.84@8e6a4a32` 下得到 production 脱敏规模：平台账号 35，
  两个群组 members 17/6、contacts 17/6、pending 0；该证据只说明 G1 页面规模，不证明图标候选正确。
- 并行任务已从 `a1bba571` 上传并放行 `0.1.0-p10.20260903.85@a1bba57`，用于 G1-004 小米 14 人工补证；
  该候选仍不含 `5285dd17`，不能作为 EXP-ICON-004 图标修复候选。
- G1-004 仍为“证据不足，保留 P3”，缺 Xiaomi 14 原生首绘、节点、滚动和 bridge 数据；详细状态已在
  `cc5fd98a`、`a1bba571` 和主审计报告保存。本轮用户任务优先级覆盖其人工补证下一步，但不改写结论。
- `schedule-project-guardrails` 已由 `76a572a3` 进入主线；本轮 L2 inspector 通过，匹配
  `mini-test-discovery-clock` 和 `client-version-allowlist`。

## 证据与预算

- `.84@8e6a4a3` package audit：total `5,152,789 B`、main `1,716,235 B`；既有主包 1.5 MiB 内部 warning。
- `.83@5285dd1` 既有 exact clean 记录：total `5,170,583 B`、main `1,732,195 B`。二者构建元数据/源码不同，
  只作独立测量，不宣称严格性能 delta。
- B1.2 预算：同口径总包 ≤+64 KiB、B1.2 自身 ≤+16 KiB、generated adapter ≤+12 KiB；不新增 runtime
  dependency。冷启动/帧率/内存当前工具无法测量，暂未验证。
- B1 失败先行：旧实现运行新增测试因缺 `trial-lineage.mjs` 以 `ERR_MODULE_NOT_FOUND` 退出 1；实现后定向
  lineage 12/12、CI helper 6/6，完整 Mini 120 files/655 tests 通过。首轮完整测试的 2 个收集失败来自 clean
  worktree 缺 workspace producer dist，按新 Skill lifecycle 只构建对应 producer 后同命令通过。
- Mini typecheck/source/trial policy/production verify/package/performance/determinism/CI dry-run、全仓 format/lint、
  agent-context 3/3、`git diff --check` 与 `smoke:check-core` 通过；未涉及 Web core，无需 browser smoke。
- production package total `5,151,892 B`、main `1,715,718 B`，与 B1 前同口径基线相同；只有既有 warning。
- 未调用微信开发者工具 GUI/CLI；未取得新候选的 Xiaomi 14 证据，不能声称原生验收通过。

## 文档入口

- 血缘、全图标对照、严重程度、迁移分类、包体、批次、第一批精确 Prompt 和真机清单：
  `docs/audit/exp-icon-004-trial-lineage-and-b12.md`。
- 方案比较、单一来源、平台 adapter、trial tag/preflight 和验收设计：
  `docs/superpowers/specs/2026-09-03-exp-icon-004-b12-and-trial-lineage-design.md`。

## 唯一下一任务与停止条件

- 唯一下一任务：以 `fix(miniprogram): enforce cumulative trial lineage` 形成 B1 checkpoint，再合并执行时最新
  `origin/main@75cc0d3b`，人工保留双方状态和 `.85` 事实，重跑相称门禁后普通推送调查分支。
- 当前停止条件：最新主线整合、B1 checkpoint/merge、验证和推送完成即停止；不自动进入 B2 图标分支集成、L3
  上传或 L4 production 操作。
