# 微信小程序审计状态

## 当前阶段

- 当前批次：用户已明确授权 dependency-guard 前置批次和后续 `EXP-ICON-004-B2`；完整 checker 已先红后绿
  实现，正在形成独立 tooling checkpoint，尚未修改或合并生产图标代码。
- 独立 worktree：`runtime/external-project-worktrees/exp-icon-004-lineage-b12-20260903`；当前分支
  `codex/exp-icon-004-lineage-b12-20260903`。
- 本批不修改生产图标，不创建真实 tag，不上传体验版，不操作 allowlist，不连接或部署 production。
- 新 checker 覆盖全部 dependency source inputs、Node/pnpm、OS/架构、pnpm layout、store path 以及
  direct/workspace links 健康；只读入口不写文件，显式 installer 仅在 `MISS` 时至多运行一次 frozen install，
  健康通过后才写 worktree 私有 marker。release-worktree 已改为复用同一契约。
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

- 旧弱 marker 的引入点为 `0d971de1`；新增测试先以缺实现模块失败，随后 dependency/release-worktree
  `18/18`、Node syntax、项目 Skill validator 和 `git diff --check` 通过。真实只读检查为
  `MISS / marker-missing / HEALTH=PASS`（exit 2），未安装依赖、未写 marker。
- 通用 Skill `quick_validate.py` 因本机 Python 缺少 `PyYAML` 未能启动；未擅自补装，仓库专用 validator 已通过。

- B2 入口 `eaac822c` clean，最新 `origin/main=75cc0d3b`。B1 lineage audit、相关 Mini 5 files/55 tests、Mini
  production verify/package 均通过，基线 total/main=`5,151,893/1,715,719 B`。
- Web clean baseline 只缺 workspace producer dist；定向构建 `ui-tokens` 和唯一缺失的 `client-core` 后，Web
  build 以 `4,242 modules` 通过（`36,900 ms`），仅有既有 chunk warning。未运行依赖安装。

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

- 唯一下一任务：提交并推送 dependency-guard checkpoint 后恢复 B2，合并 `5285dd17`，对最终依赖图运行
  checker；仅 `MISS` 时按已获授权运行一次 guarded frozen install，再执行 Web/Mini 真实构建和包体复测。
- 当前停止条件：B2 checkpoint 推送成功即停止；不进入 B3、L3 上传或 L4 服务器操作。
