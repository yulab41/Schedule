# Project Status

## 当前批次：WebView-only 收口——删除全部 Skyline 兼容层

- 核对结论：生产源码里**只有一处**按基础库版本分叉（`platform/runtime-ui-compatibility.ts` 的"请求 Skyline 且 SDK=3.17.2"），其余 `SDKVersion` 只用于诊断页展示；按 ADR-0007 把渲染器定为 WebView 后，把只为 Skyline 写的整层补丁删除（宿主对话框、原生滚动孪生、`.is-skyline-3172-ui` 样式、`rendererOptions.skyline`、兼容层模块与其 16 项门禁测试）。
- 批次 2 收尾：删除最后一个 Skyline 专用面（`pages/gesture-probe` A 区 Pan Worklet 探针 + `build-env.d.ts` 的 `worklet` 类型声明），并把迁移计划冻结边界、ADR-0001/0005 状态、架构/设计/测试计划/审计快照中的 Skyline 表述改为 WebView-only；`rendererOptions.skyline` 与对应构建校验已在批次 1 删除。
- 验证：typecheck、format:check、lint、smoke:check-core 通过；Mini **1205 通过 / 16 跳过**；determinism `b485ae09…`；package 总 **4612161 B**（清理前基线 4653854 B，**−41693 B**；主包 1735085 B）。
- 未验证（不代替真机验收）：小米 14 的日历、换班/请假选择器、页头群组名与下拉箭头、详情卡排版。
- 保留项（有证据，非待办）：`pages/manual-matrix-poc/matrix-gesture.wxs` 被生产页 `subpackages/scheduling/pages/manual/index.wxml` import，不能整体删除；`calendar-poc`/`manual-matrix-poc` 已无 worklet 且仍可从开发入口页与"更多 → 测试入口"到达。
- 回滚：`git revert` 本批次并把 `renderer` 与页面 JSON 改回 `skyline`；只改 `renderer` 不是有效回滚（兼容层已不存在）。
- 详情见 `docs/audit/webview-only-cleanup-20260919.md`、`docs/audit/STATUS.md`、`apps/miniprogram/docs/decisions/ADR-0007-webview-renderer.md`。
- 唯一下一任务与停止条件：小米 14 打开 `.169` 复核两台设备的上述界面；无回归即停止，出现回归以 `.168` 为对照。

## 上一批次：渲染器改 WebView（ADR-0007），体验版168已放行

- 交付：`1f2dcf61` + `64788ee4` 已推送；候选在独占 `general-5` 冻结（前后 `RESULT=PASS`）；`0.1.0-p10.20260918.168` 上传成功（Manifest `1edea299…100e`，收据齐全），可信 ensure 追加并保留 `.167`，`ecs-verify.sh` `[verify] complete`；公网 `.168=200`/`.167=200`/未知 `=426`。细节/回滚见 `apps/miniprogram/docs/decisions/ADR-0007-webview-renderer.md`、`docs/audit/STATUS.md`、`docs/debug/debug-feedback-log.md`。上传路由：GitHub 走进程代理、微信 CI 直连 IPv4（`.165`/`.166` 因 IPv6 出口烧号）。

## 上一批次：保住可见面板 + 高度同步（体验版167）

- 用户回传 `.164`：滑动比 `.163` 顺滑 ✓；仍**轻微横向抖动**；高度**仍慢半拍**（要跟滑动同时结束）；**定位是生硬跳转无动画**，且跳转后单元格"正确本月内容 → 闪一下 → 又是正确本月内容"（= 节点重建，不是别的月份）；不方便录屏。
- 定位"无动画"澄清：从别的月份定位**确实有 364px 轨道滑动**；当前月就是本月时走 `applyTodayLocation` 直接重渲染（无动画），这是"生硬跳转"的来源。
- 修法（3.17.3 swiper 分支逐字未改）：①**重做"保住可见面板"**——`.163` 失败因标志被任意 `panels` 更新提前消费，现在只在真提交（`delta !== 0`）时消费，提交出 `[prev,cur,cur]`、轨道**下一 tick 归零**（两面板同一对象，可见帧不变）；②兼容分支高度过渡改 **200ms**（滑动 240ms），让两者同时结束；③**手势不再在拖动中重排**：高度改写从"拖动中逐次"改为"结算时一次"（用户接受的单变量试验）。
- 验证（3.17.2 模拟器）：连按 **6 次 → 6 次归零**、月份 Sep→2027-03 逐月推进、结束态 `cleanup=false`/`track=''`/`viewportHeight==gridHeight`（证明标志修复后不再假死/悬停）；一次切月轨道 -351→-641.8→-714.6 与高度 372→322.5→310.1 并行；从 2026-11 定位到 2026-09 有完整轨道滑动（left -351→≈13→-351，约 250ms）。
- 门禁：typecheck、Mini **1224 项通过/16 跳过**、package 总 **4650981B**、determinism `889cfc96…`、format、lint、smoke:check-core 全通过；新断言在旧源码上先失败（RED）。未改 `workbench/index.ts`，血缘证明无需刷新。
- 交付：检查点 `03587690` 已推送；候选在独占 `general-5` 冻结（`check-worktree-safety` 前后 `RESULT=PASS`）；`.165`/`.166` 因**上传时出口走 IPv6 被微信 CI 拒绝**（`invalid ip: 2409:8a55:…`）而烧号、无收据；改用进程级直连 IPv4（清 `HTTPS_PROXY/HTTP_PROXY` + `NODE_OPTIONS=--dns-result-order=ipv4first`）后 **`0.1.0-p10.20260918.167` 上传成功**（Manifest `74cd9485…acf4`）。可信 `ensure` 追加 `.167` 并保留 `.164`；`ecs-verify.sh` `[verify] complete`；公网 `.167=200`/`.164=200`/未知 `=426`。未部署应用制品、未备份或迁移数据库、未提审、未正式发布。
- 唯一下一任务：小米14 打开 `.167` 复核 ①箭头/定位是否不再闪动（定位若从本月出发无动画属预期）；②高度是否与滑动**同时**结束；③手势横向抖动是否消失；④连按是否仍不假死。详情见 `docs/audit/runtime-ui-compatibility-period-pager-20260917.md`。

## 上一批次：分页提交期保住可见面板（体验版163，已撤回）

- `76712d29` 试做"提交后下一 tick 再归零轨道"+高度提前一帧，真机回传更卡、高度约 1 秒后才落、快速切月内容假死；判定为延迟归零标志被提前消费导致的回归，`.164` 已撤回该做法。

## 历史批次（135–162，已并入本批次删除的 Skyline 兼容层）

- 这些批次记录的是当时的 Skyline 3.17.2 兼容层修复；该层已在本批次整体删除，结论与证据保留在 `docs/audit/STATUS.md`、`docs/audit/runtime-ui-compatibility-*.md` 与 Git 提交历史中，不再常驻本文件。
