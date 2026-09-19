# Skyline 3.17.2 滚轮初始定位与重开失效 体验版 151 交付

2026-09-17 用户在当前消息授权「确认上传并放行」。本轮只交付小程序源码与体验版；未部署生产应用、
未备份或迁移数据库、未提审、未正式发布。

- 源码提交 `d33da54bb91d8cc3b8faa2c20f34da4f4126acd6`（分支
  `codex/runtime-3172-wheel-and-pager-20260916`，已推送）。血缘含最新 `origin/main@4179f05a`
  与 `.150@a0707b0c`；候选前置与上传后版本绑定检查均 `RESULT=PASS`
  （`ready-clean-detached`、`production-clean`、`VERSION_LOCAL=absent`）。
- 修复内容：初始定位改由模板承担（轨道 `style="margin-top:{{wheelLayoutOffset}}px"` = `-index*44`），
  WXS 只画增量 `translateY(offset - baseOffset)`，两者写不同属性、重渲染不再互相覆盖；手势按代际
  自我刷新（dataset 的 generation 更新时按 `data-base-index`/`data-item-count` 重新播种、按新基线落位
  并重置行样式，更旧仍忽略）。
- 体验版 `0.1.0-p10.20260917.151`，说明「Skyline 3.17.2 wheel layout base d33da54」，
  production/clean，Manifest `c837834697def927ca13d70ca9b992b874da6cf1a2eabdbacb9254d7a882e55b`；
  版本由独占分配器在锁内选择（分配 `23:58:46Z`、构建 `23:58:35Z`、上传 `23:59:32Z`），
  远端不可变轻量 tag `miniprogram-trial/0.1.0-p10.20260917.151` 指向同一 SHA。
- 门禁：Mini 完整 174 文件 1217 项通过/16 跳过；typecheck、production build（366 文件）、
  package（主包 1745352B / 总包 4619757B）、determinism（`95f7825e…390d1`）、`pnpm format:check`、
  `pnpm lint`、`pnpm smoke:check-core`、`agent-context-policy` 通过；`pnpm miniprogram:verify` 仍只被
  既有未改的手排矩阵节点预算 `1507>1506` 阻断。
- 放行：可信 `schedule-client-version-allowlist ensure` 只追加 `.151`（白名单 47 项，保留
  `.150/.149` 等旧版），独立 `verify` 与 `/usr/local/lib/schedule/ecs-verify.sh` 通过；
  公网 HTTPS `.151=200`、`.150=200`、动态未知版本 `=426`。追加期间 API/Web 容器按既有流程重建并在
  健康等待后恢复（短暂 502 属既有现象）。本轮未部署应用制品、未备份或迁移数据库，也未声明
  production live release（`LIVE_RELEASE_VERIFIED=false`）。
- 唯一下一任务：小米 14 复核——3.17.2 换班年月滚轮打开即停在当前年月并可直接滚动，关闭后重开仍可滚动；
  请假定位当日仍能一次到位。3.17.2 已知局限保持：未触摸前无大小/淡出渐变、点击单项选中仍不生效。

文档检查点：`docs(release): record Skyline 3.17.2 wheel layout base trial 151 delivery`。该提交只含
`docs/**`，按仓库例外不触发生产部署或服务器 release 标识同步。
