# Project Status

本文档只记录当前可安全接续的事实；详细历史以 `docs/audit/` 和精确 debug 日志为准。每轮先读
`docs/agent-context/pitfall-index.json`，只加载匹配坑位详情。

## 当前仓库批次（2026-09-05）

- 当前活动批次：`ICON-PARITY-CLOSE-001`（Web/Mini 图标五层 parity、确定性门禁、版本血缘与工具链固化）。
  主工作树及其他 worktree 的用户改动均未接管。
- 本轮起始 `origin/main@bb81e723`；最新 fetch 为 `origin/main@969f740dce5179d88aa43fa8abbe6117214beb07`。
  `7f407038` 修复 bootstrap 非 JSON `reasons` map，`fc79762d` 记录 bootstrap profile，`969f740d` 恢复 release
  test formatting；这些均是文档/工具链变化，整合时不覆盖 icons、Mini/Web runtime、lineage 或 lockfile。
- 当前候选 worktree：`runtime/wt/icon-parity-1`，分支 `codex/icon-parity-current-20260904`；任务台账在
  ignored `runtime/codex/tasks/icon-parity-current.json`。当前整合提交 subject 为
  `merge: integrate latest origin/main`，状态/完整候选 SHA 以台账和 Git 为准。
- 历史关系：`8e6a4a32` 是旧日历基线；`1ffab10c`、`5285dd17`、`71110712` 的实现已进入当前 canonical
  tree，但最终 merge 采用等价整合提交而非保留三者的祖先关系；旧观察版 `.86@8caa5f20` 不作为当前源码。
  `tdesign-icons-vue-next@0.4.7` 的 search-ring 回归测试已定位并修正历史缺段。
- 当前 checkpoint tracked 变化只包含 canonical icon/catalog/context/motion、Mini 生成资产、Web gallery、
  parity/liveness gates、lineage/release helper、guardrail/reference 和状态文档；无生产数据库/凭据/runtime
  产物进入 Git。

## 图标与交付结论

- 快速 parity：55 canonical definitions；58 generated Mini SVG；138 production references / 58 unique assets；
  legacy `web-*` references 0、legacy files 0、unreferenced assets 0；production source files 116。
- 几何/语义/context：matrix 58 entries、13 contexts、14 stateful groups；Web/Mini context bindings 13/10；
  multi-part people assets 保留 primary/secondary，top user 与 bottom profile 显式区分 context。
- 状态/motion：active/inactive/pressed/disabled 矩阵完整；Web/Mini motion bindings 31/25，emitted bindings 56；
  Mini keyframes 32、orphan 0；active workspace 驱动 bottom loop，离开 active 状态停止，top action 为 one-shot。
- 构建血缘：generator 连跑 deterministic（60 generated outputs）；manifest、实际文件和生产引用双向闭合；
  页面私有图标仅保留 allowlisted `SharedIcon.vue` canonical root，未发现直接 TDesign 或旧 `web-*` 生产引用。
- 独立 gallery：`apps/web/icon-parity.html` 不需要登录/API，真实 Edge 加载 55 catalog、13 context、44 去重
  binding cards；motion stop/start 将 loop/one-shot 从 `2/1` 变为 `0/0` 再回 `2/1`，无 404/console error。

## 血缘、版本与依赖

- `trial-history.v1.json` 覆盖 `.74–.86`；已实际观察的 `.86@8caa5f20` 记录了 production、manifest、描述、tag、
  上传时间并标明旧候选。policy 要求 `1ffab10c`、`5285dd17`、`71110712`，candidate preflight 还要求 fresh
  `origin/main`、latest trial ancestor 或受 required-feature 等价证明、clean production、description short SHA、
  exact build metadata。
- 当前 candidate 与历史图标提交为等价整合而非祖先关系；三组 canonical tree-file blob proof 已接入 lineage helper，
  `pnpm --filter @schedule/miniprogram exec vitest run scripts/trial-lineage.test.mjs --fileParallelism=false`
  已通过 15/15，非 tracked 旧 trial 无 proof 时仍 fail closed。
- `allocateNextTrialVersion` 已接入正式 upload helper：没有显式版本时读取 history 与远端 immutable tags，按
  Asia/Shanghai 当前日期生成下一个序号；最终 reservation 仍以同 SHA lightweight tag 原子绑定，禁止旧源码占用高版本。
- 官方依赖最终指纹 `b392a5b881360c1aa0bac89bfdbd8f45c9e928c9d0a1ab17e6dedbaca0dbc48e`，current-message L2
  reconciliation 为一次有效 `install --frozen-lockfile --offline`，下载 0；随后 `ReuseOnly=READY_REUSE`，
  tracked tree 前后 hash 一致。五个不同指纹各一次有效 reconciliation；child invocation 9（含历史/当前
  tripwire 早停与 lockfile rejection），没有升级依赖或手工 link。
- L2 例外已固化：`dependency-maintenance.ps1 -CurrentMessageAuthorization` 仍生成短命精确授权记录供
  tripwire/core 校验，但授权来源为当前消息；ignored per-fingerprint audit 先写后装，同指纹二次有效安装 fail closed。

## 验证与边界

- post-merge 定向：Mini icon/workbench/calendar 5 files/45 tests；lineage/CI 2 files/19 tests；lineage equivalence
  15/15；guardrail Node 18/18；latest-main pool/bootstrap Node 7/7；catalog/gallery 2/2；skill validator
  `RESULT=PASS`；`pnpm smoke:check-core` 通过。
- `pnpm verify` 的上一轮成功证据属于已失效候选（完整输出和失效原因在 ignored task ledger）；候选 preflight 因主线工具链
  连续前进至 `969f740d` 而拒绝旧 HEAD，故当前整合 tree 必须只执行一次新的完整 verify，再执行未覆盖的 Mini
  package/source/determinism/safety/lineage 门禁。
- `pnpm smoke:browser` 已真实启动 Edge、打开 Web；因 API `127.0.0.1:3000` 未运行停在 `/login?redirect=/`。
  这不是 gallery 失败，也未反复跑管理员登录；未调用微信开发者工具 GUI/CLI、模拟器、Console/Network。
- Mini/Node/静态/Web gallery 结果不能证明 Xiaomi 14 原生视觉、Skyline、帧率、冷启动、内存或真机交互；当前
  Xiaomi 14 匹配候选证据为“当前工具无法测量，暂未验证”。不执行正式提审/发布、ECS/数据库/production 操作。

## 历史索引与唯一下一任务

- `MINI-G1-004` 的规模/production 聚合、`.84/.85` 旧上传、G1 人工证据和各轮 guardrail/toolchain 记录继续在
  `docs/audit/`、`docs/debug/debug-feedback-log.md` 与 Git 历史中保留；本文件不重复历史全文。
- 最新主线整合已完成，当前整合 tree 的第二父提交为 `a505746a`；唯一下一任务：在最新 exact clean SHA 上运行
  唯一一次完整 `pnpm verify`，再运行未覆盖的 Mini package/source/determinism/safety/lineage 门禁；全部通过后动态
  分配、上传体验版并验证版本/SHA/manifest/allowlist/网络路线。停止于体验版验证，不提审、不正式发布、不部署
  production。
