# Skyline 3.17.2 年月/日期弹窗托管体验版 143 交付

2026-09-16 用户在当前消息中明确授权「上传并放行」。本轮只交付小程序源码与体验版，未部署生产应用、
未备份或迁移数据库、未提审、未正式发布、未发送真实通知。

- 源码提交 `e7cda4d45d59087d2ccd654abf3462449273bcad`（分支
  `codex/runtime-3172-picker-overlay-host-20260916`，已推送 origin）。实现与根因见
  [runtime-ui-compatibility-picker-host-dialog-20260916.md](runtime-ui-compatibility-picker-host-dialog-20260916.md)。
- 血缘：`origin/main`（`4179f05a`）与最新累计体验版来源 `8988afe6`（`.142`）都是候选祖先。
- 体验版 `0.1.0-p10.20260916.143`，说明「Skyline 3.17.2 picker host dialog e7cda4d」，
  production/clean，Manifest `76a6e7e80a97788f42742e18ba6db53e0e2c387f56ada458bfcd153ebca3c49e`。
  版本由独占分配器在锁内选择；候选前置与上传后版本绑定检查均 `RESULT=PASS`
  （`ready-clean-detached`、`MINIPROGRAM_PROFILE=production-clean`、`VERSION_LOCAL=absent`）。
- 回执与分配记录位于 ignored `runtime/audit/miniprogram-trials/0.1.0-p10.20260916.143.*`，
  远端不可变 tag `miniprogram-trial/0.1.0-p10.20260916.143` 与「版本 + SHA + Manifest」一致。
- 门禁：定向 23 项、Mini 完整 174 文件 1211 项通过/16 跳过；typecheck、production build（366 文件）、
  source/package/determinism（manifest `c13f7cb9…4515c`）、`pnpm format:check`、`pnpm lint` 通过；
  主包 1743699B、总包 4616396B，无新增依赖。
- 放行：可信 `schedule-client-version-allowlist ensure 0.1.0-p10.20260916.143` 只追加 1 个版本并保留
  `.142` 等旧版；独立 allowlist verify 与 `/usr/local/lib/schedule/ecs-verify.sh` 通过，
  生产 release 仍为 `44034fcc…d276df9`，无应用部署、数据库备份或迁移。
- 放行后独立 HTTPS 策略：`.143=200`（global/core/workflows/organization/insights/externalMessages/guest
  全为 true）、`.142=200`、动态未知版本 `=426`。
- 唯一下一任务：小米 14 双实例核对 `.143/e7cda4d`——3.17.2 复核换班与请假的月份/日期弹窗能独立滚动、
  点弹窗外关闭、选月选日生效，页头与下拉仍正常；3.17.3 复核页头与四类选择器与 `.136` 一致。
  自动化与生产验证都不构成原生验收，本轮不宣称真机通过。

文档检查点：`docs(release): record Skyline 3.17.2 picker host dialog trial 143 delivery`。该提交只含
`apps/miniprogram/**` 与文档，按仓库例外不触发生产部署或服务器 release 标识同步。
