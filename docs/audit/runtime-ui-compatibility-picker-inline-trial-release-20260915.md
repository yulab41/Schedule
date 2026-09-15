# Skyline 3.17.2 选择器就地展开体验版 142 交付

2026-09-15 用户在当前消息中明确授权「授权上传并放行」，并提示最新版本已到 `.140`、要求避免冲突。
本轮只交付小程序源码与体验版，未部署生产应用、未备份或迁移数据库、未提审、未正式发布、
未发送真实通知、未修改微信平台配置。

- 源码提交 `8988afe6428861d3cf6bc7e1714b6289c2ef0838`（分支
  `codex/runtime-3172-picker-inline-comment-fix-20260915` 与
  `codex/runtime-3172-picker-inline-final-20260915`），已推送 origin。
- 血缘：候选等于本轮就地展开修复叠加在 `.140` 来源 `c6cbb6a6`（其祖先为我方 `.138` 的
  `09c100d5`）之上，通过合并提交 `46eee448` 达成；`origin/main`（`4179f05a`）仍是祖先。
  因此 `.139`（访客周视图分页）与 `.140`（过日期灰底）两项修复也包含在本体验版内。
- 体验版 `0.1.0-p10.20260915.142`，说明「Skyline 3.17.2 picker inline 8988afe」，
  production/clean，构建 `2026-09-15T15:51:53.949Z`、上传成功 `2026-09-15T15:52:59.780Z`，
  `robot=1`，Manifest `2b8d0f3fe2994469a4063aa3ec3e569ddac023cbaad2ed8ceb0a06a61bd4317a`。
  版本由正式独占分配器在锁内选择，未使用人工指定值；候选前置与上传后版本绑定检查均
  `RESULT=PASS`（`ready-clean-detached`、`MINIPROGRAM_PROFILE=production-clean`、`VERSION_LOCAL=absent`）。
- **`.141` 的一次失败尝试已如实记录**：候选 `46eee448` 已分配 `.141` 并创建远端 tag，但微信官方
  `summer-wxss` 编译器拒绝 WXSS 中的 `//` 行注释（`Unexpected '/'`，code 10037），上传未完成。
  按仓库规则该号码永久占用、不复用，本轮顺序取到 `.142`；随后修复为 `/* */` 注释，并在
  `scripts/build-tools.mjs` 的 `validateWxss` 增加本地守卫与单元用例，使同类问题在
  `check:source`/测试阶段失败，而不是等到上传阶段才发现。
- 冻结包、回执与分配记录位于 ignored `runtime/audit/miniprogram-trials/0.1.0-p10.20260915.142.{json,manifest.json,allocation.json}`；
  远端不可变 tag `miniprogram-trial/0.1.0-p10.20260915.142` 与「版本 + SHA + Manifest」一致。
  构建 366 文件，主包 1742411B、总包 4610065B，保留既有主包 1.5M 内部预警，无新增依赖。
- 门禁：Mini 完整 174 文件 1211 项通过、16 项跳过（合并 `.140` 后复测）；`tsc --noEmit`、
  production build、source audit、package audit、determinism（manifest
  `c301e781b9b6dfd86eced5ad3d7119ae8a6196d63e3ba3ad720640a04c932386`）、`pnpm format:check`、
  `pnpm lint`、`pnpm smoke:check-core` 通过。合并只触及 `apps/miniprogram/**` 与文档
  （`git diff --stat` 对 app 目录外为空），因此根套件沿用本轮早些时候在未合并候选上的
  `270 文件 / 1273 项 / 444 跳过` 结果，不重复无变化的根检查。
- 放行：可信 `schedule-client-version-allowlist ensure 0.1.0-p10.20260915.142` 只追加 1 个版本并
  保留 `.140` 等旧版（容器重建期间预期中的 502 后恢复）；独立
  `schedule-client-version-allowlist verify` 与 `/usr/local/lib/schedule/ecs-verify.sh` 通过，
  生产 release 仍为 `44034fcc…d276df9`，无应用部署、数据库备份或迁移。
- 放行后独立 HTTPS 策略：`.142=200`（global/core/workflows/organization/insights/externalMessages/guest
  全为 true）、`.140=200`、`.141=426`（失败候选从未放行）、动态未知版本 `=426`。
- 网络与主机身份沿用本会话已验证路线：正式域名双 DoH 与系统解析一致、`known_hosts` 唯一公钥候选、
  TLS/健康 `http=200 / tls=0`、SSH 保持 `HostKeyAlias` 与 `StrictHostKeyChecking=yes`。
  未更改系统 hosts/VPN/DNS，未削弱证书或主机密钥校验。
- 唯一下一任务：小米 14 双实例同时核对 `.142/8988afe`——3.17.2 实例复核页头箭头位置、班次/人员
  下拉就地展开并可选、月份与日期面板就地出现并可选择确认，以及 `.139/.140` 的访客周分页与
  月视图过日期灰底；3.17.3 实例确认页头与四类选择器与 `.136` 一致。自动化与生产验证都不构成
  原生验收，本轮不宣称真机通过。

文档检查点：`docs(release): record Skyline 3.17.2 picker inline trial 142 delivery`。该提交只含
`apps/miniprogram/**` 与文档，按仓库例外不触发生产部署或服务器 release 标识同步。
