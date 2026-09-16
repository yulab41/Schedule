# Skyline 3.17.2 弹窗层 `inset` 兼容修复体验版 147 交付

2026-09-16 用户在当前消息中授权「上传并放行」，并重申原则：最小改动、不重复造轮子、不堆屎山。
本轮只交付小程序源码与体验版；未部署生产应用、未备份或迁移数据库、未提审、未正式发布。

- 源码提交 `18ed6f694f1fa853e95f01cd61a68d67d8cca4f9`（修复提交 `c9ad7c0e` + 验证记录），
  分支 `codex/runtime-3172-overlay-verify-20260916`，已推送。血缘：`origin/main` 与最新累计体验版
  来源 `d526252b`（`.146`）都是候选祖先。
- 改动就是最小面：`ui-date-picker`(layer/scrim/wheel-mask)、`ui-selector`(backdrop)、`ui-sheet`(scrim)
  把不兼容的 `inset: 0` 换成等价的显式 `top/right/bottom/left: 0`，安全区 `max(...)`/`env(...)` 前置
  `bottom: 12px` 回退；新增 1 条回归断言。未新增组件、未引入第二套机制、未改动 3.17.3 路径。
- 体验版 `0.1.0-p10.20260916.147`，说明「Skyline 3.17.2 overlay inset fix 18ed6f6」，
  production/clean，Manifest `d818c348d06d1510f1c4044bfa401cb49f81ca3b4cebaba9d46cad3e70527644`；
  版本由独占分配器在锁内选择；候选前置与上传后版本绑定检查均 `RESULT=PASS`。
- 放行：可信 `schedule-client-version-allowlist ensure 0.1.0-p10.20260916.147` 只追加 1 个版本并保留
  `.146` 等旧版；独立 allowlist verify 与 `/usr/local/lib/schedule/ecs-verify.sh` 通过，生产 release
  仍为 `44034fcc…d276df9`，无应用部署、数据库备份或迁移。
- 放行后独立 HTTPS 策略：`.147=200`、`.146=200`、动态未知版本 `=426`。
- 开发者工具（基础库 3.17.2）已实测：修复前弹窗层"渲染树有节点但不绘制"；修复后弹窗正常出现，
  遮罩关闭弹窗、sheet 遮罩关闭表单均可用；切 3.17.3 复测外观一致。详见
  [runtime-ui-compatibility-overlay-inset-20260916.md](runtime-ui-compatibility-overlay-inset-20260916.md)。
- 唯一下一任务：小米 14 双实例核对 `.147/18ed6f6`——3.17.2 复核月份/日期弹窗能弹出、滚轮独立滚动、
  选完生效、点弹窗外关闭、点 sheet 外部关闭表单；3.17.3 确认与之前一致。真机结论仍由用户给出。

文档检查点：`docs(release): record Skyline 3.17.2 overlay inset fix trial 147 delivery`。该提交只含
`apps/miniprogram/**` 与文档，按仓库例外不触发生产部署或服务器 release 标识同步。
