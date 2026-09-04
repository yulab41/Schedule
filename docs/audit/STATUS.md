# 微信小程序审计状态

## 当前阶段

- 当前批次：用户明确批准的 `EXP-ICON-004-LINEAGE-B1` 已先红后绿实现，`c027abcd` 为 B1 实现 checkpoint；
  执行期间前进的 `origin/main@75cc0d3b` 已合入，合并后复核通过，正在创建 merge checkpoint 并推送。
- 独立 worktree：`runtime/external-project-worktrees/exp-icon-004-lineage-b12-20260903`；当前分支
  `codex/exp-icon-004-lineage-b12-20260903`。
- 本批不修改生产图标，不创建真实 tag，不上传体验版，不操作 allowlist，不连接或部署 production。
- 详细血缘/图标结论见 `docs/audit/exp-icon-004-trial-lineage-and-b12.md`；设计见
  `docs/superpowers/specs/2026-09-03-exp-icon-004-b12-and-trial-lineage-design.md`。

## EXP-ICON-004 已验证事实

- `.84@8e6a4a3` 不是 `.83@5285dd1` 的后继，缺少 `1ffab10c` 和 `5285dd17`；用户截图所见不是图标修复
  候选。`.75` 也曾不含原 `.74` 支线，但 `.76` 已重新调查并取代其最终行为。
- `.74` 出现末尾序号多 SHA，`.81/.82` 出现同一完整版本多 SHA。旧 upload helper 没有中央版本占用或
  ancestor gate，allowlist 又只识别版本字符串，无法发现同号 payload 覆盖。
- B1 实施期间并行 G1-004 任务通过旧流程上传并放行 `0.1.0-p10.20260903.85@a1bba57`；history/policy 已把
  该事实和 bootstrap floor 追加到 85，不追补真实 tag。`.85` 不含 `5285dd17`，不能用于图标验收。
- B1 新增 `.74–.85` tracked history/policy、纯 Node helper 和永久 Vitest，并接入 `upload-experience`：
  clean production、fresh main/latest trial/required ancestor、description short SHA、exact build metadata、
  immutable lightweight tag 和 ignored receipt 均 fail closed；preview/dry-run 不触发 trial 外部状态。
- `.84` 有 25 个不同 `web-*` 名称/85 次引用；图标分支有 0 次 `web-*`、46 个不同 `ui-*`/127 次引用。
  图标分支仍需 B1.2：底部多项双色/active-only motion、顶部 profile geometry/尺寸、23px nav、0.98 press、
  filter stroke、locate/more context 以及 motion codegen 尚未全部完成。

## 保留的 MINI-G1-004 事实

- G1-004 冻结 production 规模为 platform accounts 35、两个群组 members/contacts 17/6、pending 0；结论仍为
  “证据不足，保留 P3”。synthetic probe 和 Node 构建不能替代 Xiaomi 14 原生首绘、节点、滚动或 bridge 证据。
- `.85@a1bba57` 已上传并放行，Manifest
  `7ae30753e7fc6437826a802df30d1062016a7192f5d494baba50ab9c8be5f63b`，包体 `5,153,449 B`；allowlist
  保留 `.81–.84` 并新增 `.85`。未提审、未正式发布、未执行 ECS deploy 或数据库操作。
- G1-004 仍等待用户在匹配 `.85@a1bba57` 的 Xiaomi 14 上完成“更多 → 测试工具”环境抄录，以及 platform
  accounts/group settings 的只读首屏与滚动反馈；版本/SHA 不匹配时停止。该人工待办不改变本轮 B1 停止条件。

## 验证与边界

- 旧实现红灯为缺少 `trial-lineage.mjs` 的 `ERR_MODULE_NOT_FOUND`；新实现定向 lineage 12/12、CI helper 6/6，
  临时远端竞态、same/different SHA retry、stale main、dirty/staging/local/missing-ancestor、exact build、失败无
  receipt 和 preview/dry-run 隔离均有覆盖。
- 完整 Mini 首轮 118 files/652 tests 通过，2 suite 因 clean worktree 缺 producer dist 收集失败；只构建
  `contracts`/`scheduling-domain`/`presentation-core` 后同一命令为 120/120 files、655/655 tests。
- 合并后 Mini 120 files/655 tests、typecheck/production verify/package/trial policy/determinism/CI dry-run、全仓
  format/lint、Skill validation、agent-context 3/3、diff check 和 core smoke 均通过；合并前 source/performance
  结果继续有效。package total/main 为 `5,151,892/1,715,718 B`，与 B1 前基线相同。
- 更新后的 `schedule-project-guardrails` 已重新读取；L2 inspector
  `SKILL_HASH=1fce818e78639b1aec964802e9b06cadd0fc7896960ce11946387e0b41c65f68` 返回 PASS。未调用微信开发者
  工具 GUI/CLI；没有新图标候选的 Xiaomi 14 证据，不能声称原生验收通过。

## 唯一下一任务与停止条件

- 唯一下一任务：创建 `merge: integrate latest main into trial lineage guard` merge checkpoint 并普通推送调查分支。
- 当前停止条件：推送成功即停止；不自动进入 B2、B3、L3 上传或 L4 服务器操作。
