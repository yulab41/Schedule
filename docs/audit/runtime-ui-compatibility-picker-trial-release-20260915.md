# Skyline 3.17.2 选择器浮层与页头箭头体验版 138 交付

2026-09-15 用户在当前消息中明确授权「上传并放行」。本轮只交付小程序源码修改与体验版，
未部署生产应用、未备份或迁移数据库、未提审、未正式发布、未发送真实通知。

- 源码提交 `09c100d5f2d2797c2980d4c60dfa28d0bb1c8b1d`，分支
  `codex/runtime-3172-picker-overlay-20260915`，已推送 origin。基线为访客页面修复
  `09e63980`，`origin/main`（`4179f05a`）仍是候选祖先（上传前重新 fetch 复核）。
- 实现、引入点与行为变化清单见
  [runtime-ui-compatibility-picker-overlay-fix-20260915.md](runtime-ui-compatibility-picker-overlay-fix-20260915.md)。
  三处修改都只在 `skyline3172UiCompatibility === true` 时生效。
- 体验版 `0.1.0-p10.20260915.138`，说明「Skyline 3.17.2 picker overlays 09c100d」，
  production/clean，构建时间 `2026-09-15T13:52:36.805Z`、上传成功
  `2026-09-15T13:54:26.399Z`，`robot=1`，Manifest
  `1eb3d61b6bd36e0898cdb2486ea227b92c6e7ac203e24524835838aafa17e40a`。
- 版本由正式独占分配器在锁内选择，未使用人工指定值；`.137` 已由同机另一任务的实现提交占用，
  本轮顺序取得 `.138`。`dist/build-profile.json` 的 commit `09c100d`、version、description、
  `buildDirty=false`、`profile=production` 与候选逐字段一致，无 `version=local` 回退。
- 候选前置与上传后版本绑定检查：`STATE=ready-clean-detached`、
  `PURPOSE=upload`、`MINIPROGRAM_PROFILE=production-clean`、`VERSION_LOCAL=absent`，均 `RESULT=PASS`。
- 冻结包、回执与分配记录位于 ignored `runtime/audit/miniprogram-trials/0.1.0-p10.20260915.138.{json,manifest.json,allocation.json}`；
  远端不可变 tag `miniprogram-trial/0.1.0-p10.20260915.138` 与「版本 + SHA + Manifest」一致。
  构建为 366 文件，主包 1739147B、总包 4606801B，保留既有主包 1.5M 内部预警，无新增依赖。
- 放行：可信 `schedule-client-version-allowlist ensure 0.1.0-p10.20260915.138` 只追加 1 个版本并
  保留 `.137` 等旧版；容器重建后健康等待首 5 次出现预期中的 502，随后通过；独立
  `schedule-client-version-allowlist verify` 与服务器 `/usr/local/lib/schedule/ecs-verify.sh` 通过，
  生产 release 仍为 `44034fcc…d276df9`，本轮没有应用部署、数据库备份或迁移。
- 网络与主机身份：正式域名 `hosp.schedule.eylinhome.top` 的 DNS 由两个独立 DoH 提供者与系统解析
  一致确认，`known_hosts` 中与该域名公钥精确匹配的公网 IPv4 候选唯一；TLS/健康探针
  `http=200 / tls=0`；SSH 使用 `HostKeyAlias`、`StrictHostKeyChecking=yes`、`BatchMode=yes`、
  `IdentitiesOnly=yes`。未更改系统 hosts/VPN/DNS，未削弱证书或主机密钥校验。
- 放行后独立 HTTPS 策略：`.138=200`（global/core/workflows/organization/insights/externalMessages/guest
  全为 true）、`.137=200`、动态未知版本 `=426`。未执行 replace 或版本退役。
- 唯一下一任务：小米 14 双实例同时核对 `.138/09c100d`——3.17.2 实例复核页头箭头位置、
  班次/人员下拉可展开并可见选项、月份与日期面板可弹出选择；3.17.3 实例确认页头与四类选择器
  与 `.136` 一致。自动化与生产验证都不构成原生验收，本轮不宣称真机通过。

文档检查点：`docs(release): record Skyline 3.17.2 picker trial 138 delivery`。该提交只含
`apps/miniprogram/**` 与文档，按仓库例外不触发生产部署或服务器 release 标识同步。
