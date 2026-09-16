# Skyline 3.17.2 弹窗宿主按 id 定位与点外部关闭（体验版 145 交付）

2026-09-16 用户授权“上传并放行”。本轮只交付小程序源码与体验版；未部署生产应用、未备份或迁移数据库、未提审、未正式发布。

- 源码 `6e31eed8e79531fbc4b953ad0bd293e72d59b79b`（分支 `codex/runtime-3172-picker-host-id-dismiss-20260916`，已推送）。
- 血缘：`origin/main` 与最新累计体验版来源 `e7cda4d4`（.143）都是候选祖先。
- 体验版 `0.1.0-p10.20260916.145`，说明“Skyline 3.17.2 picker host dismiss 6e31eed”，production/clean，
  Manifest `4a9a312d0e2d30721c5a704b6a82421e033286845e3ce48fa7bc9612279aa130`；候选前置与上传后版本绑定检查 `RESULT=PASS`。
- 首次上传尝试在分配版本前失败，按规则未占号；重试顺序取得 .145（.144 已被同机其他任务占用）。
- 修复两处：宿主组件改用 `id="workflow-picker-host"` 与 `selectComponent('#workflow-picker-host')`（class 选择器在 Skyline 上不可靠，导致 .143 弹窗静默不显示）；`ui-sheet` 新增 `requestCloseFromParent()`，由面板/页面根节点在 3.17.2 承接“点外部”并复用既有 `bind:close` 关闭 sheet（该实例的遮罩画得出来但收不到点击）。3.17.3 路径未改。
- 验证：Mini 完整 174 文件 1211 项通过/16 跳过；typecheck、production build（366 文件）、determinism、`pnpm format:check`、`pnpm lint` 通过。
- 放行：`ensure 0.1.0-p10.20260916.145` 只追加并保留旧版；独立 allowlist verify 与 `ecs-verify.sh` 通过，release 仍 `44034fcc`，无应用部署/数据库操作。公网 `.145=200`、`.143=200`、动态未知 `=426`。
- 唯一下一任务：小米 14 双实例复核 .145/6e31eed —— 3.17.2 月份/日期弹窗可弹出、滚轮独立滚动、点弹窗外关闭、sheet 点外部可关闭；3.17.3 不变。