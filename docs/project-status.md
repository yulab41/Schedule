# Project Status

本文档只记录当前可安全接续的事实；详细历史以 Git、`docs/audit/` 和精确 debug 日志为准。每轮先读
`docs/agent-context/pitfall-index.json`，只加载匹配坑位详情。

## 当前仓库批次（2026-09-03）

- 当前活动批次：用户明确切换到 `EXP-ICON-004-LINEAGE-B0`，完成 Web/Mini 图标与 `.74–.84` 体验版
  血缘审计、单一来源方案和实施批次；按 brainstorming 书面设计门禁停在生产代码修改之前。
- 当前基线：`origin/main@a1bba5710cfd5c94b5fd5148898e4f17e45faab9`。worktree 创建于
  `78d0424e`，发现主线前进后已 fast-forward 纳入 `76a572a3`、`cc5fd98a`、`a1bba571`，再人工合并
  本轮状态文档。
- 执行 worktree：`runtime/external-project-worktrees/exp-icon-004-lineage-b12-20260903`；分支
  `codex/exp-icon-004-lineage-b12-20260903`。未借用主工作区脏改动或其他 worktree 制品。
- 本批只修改审计、设计和状态文档；未修改生产图标、业务代码、API、权限、路由、数据库、锁文件或 generated
  dist；未重跑阶段 0。

## 已确认根因与影响

- 当前用户所见 `.84` 的 exact clean production profile 为
  `0.1.0-p10.20260903.84@8e6a4a3`，不包含图标分支的 `1ffab10c` 和 `5285dd17`；`.84` 相对
  `.83@5285dd1` 是 Git 血缘回退。
- `.84` 源码仍有 25 个不同的 `web-*.svg` 名称、85 次生产引用和 CSS/WXML 手绘几何；图标分支为 0 次
  `web-*`、46 个不同 generated `ui-*` 资产、127 次生产引用。
- `.75@24a847ff` 曾未严格包含 `.74@d23a78a`；`.76@a2cdd065` 已重新调查并更完整恢复该行为。当前
  test-tools 三个关键 blob 与 `.76` 完全一致，所以不 cherry-pick 旧 `.74` 支线。
- `.74`、`.81`、`.82` 均曾出现同版本不同 SHA；现有 upload helper 只检查通用 semver，不检查 central
  reservation、clean SHA、`origin/main`、前序 trial 或 required checkpoints。
- 当前 `origin/main` 包含 `.75–.82` 主线及 G1-004 调查，但缺图标 `1ffab10c`、`5285dd17`。当前主线与
  图标分支生产代码无重叠，只有三份状态/审计文档重叠。

## 设计决策

- 推荐采用远端不可变 `miniprogram-trial/<version>` tag 原子占用版本；同 SHA 可幂等重试，不同 SHA 必须拒绝，
  上传失败也不回收版本。
- 累积候选必须包含执行时最新 `origin/main`、latest cumulative trial 和 policy 的 required checkpoints；
  bootstrap 至少要求 `5285dd17`。紧急回滚使用最新 tip 上的 revert commit，不给旧 SHA 新版本号。
- geometry、context size/stroke/color 和 motion 分别由 `packages/ui-icons` 的 catalog/context/motion 保存；
  Web/Mini CSS 由同一 motion 数据生成。Mini 只保留 selector、transform-origin、part asset 和能力降级。
- B1.2 必须补齐底部五项、顶部 bell/user、通讯录模式、calendar filter/locate 和更多页 context；不重新绘制 path，
  不新增动画 runtime。

## 保留的主线事实

- `MINI-G1-004` 第二阶段在冻结 `78d0424e` / `.84@8e6a4a32` 下得到 production 脱敏规模：平台账号 35，
  两个群组 members 17/6、contacts 17/6、pending 0；该证据只说明 G1 页面规模，不证明图标候选正确。
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
- 验证：9 组 `git merge-base --is-ancestor` 逐项复核与文档矩阵一致；当前 HEAD containment 复核只缺原
  `.74` 身份和两个图标提交。4 个文档的 Prettier、`git diff --cached --check`、无冲突标记检查以及
  `scripts/agent-context-policy.test.mjs` 3/3 通过；`pnpm smoke:check-core` 确认只改文档、未触及 Web 核心链路。
- 未调用微信开发者工具 GUI/CLI；未取得新候选的 Xiaomi 14 证据，不能声称原生验收通过。

## 文档入口

- 血缘、全图标对照、严重程度、迁移分类、包体、批次、第一批精确 Prompt 和真机清单：
  `docs/audit/exp-icon-004-trial-lineage-and-b12.md`。
- 方案比较、单一来源、平台 adapter、trial tag/preflight 和验收设计：
  `docs/superpowers/specs/2026-09-03-exp-icon-004-b12-and-trial-lineage-design.md`。

## 唯一下一任务与停止条件

- 唯一下一任务：用户审阅并明确批准上述书面设计后执行 `EXP-ICON-004-LINEAGE-B1`；先用永久红灯实现版本
  占用和累积祖先门禁，不修改生产图标、不创建真实 tag、不上传、不操作 allowlist。
- 当前停止条件：完成文档格式/一致性检查，创建 `docs(audit): design cumulative Mini icon recovery` checkpoint，
  普通推送调查分支后停止在书面设计审查门槛。
