# Skyline 3.17.2 滚轮/切月/定位当日 体验版 149 交付

2026-09-16 用户在当前消息中授权「上传并放行」，并重申原则：最小改动、不重复造轮子、不堆屎山。
本轮只交付小程序源码与体验版；未部署生产应用、未备份或迁移数据库、未提审、未正式发布。

- 源码提交 `7e215a28d7730fcf30a33504b0af6cd39583c567`（分支
  `codex/runtime-3172-wheel-and-pager-20260916`，已推送）。血缘含最新 `origin/main@4179f05a`
  与 `.148` 来源 `c5f06e50`；本修复位于其之上。候选前置与上传后版本绑定检查均 `RESULT=PASS`
  （`ready-clean-detached`、`production-clean`、`VERSION_LOCAL=absent`）。
- 修复内容（三处最小改动）：`ui-wheel-column/index.wxml` 用 `catchtouchstart/catchtouchmove`
  让滚轮自己消费纵向手势（位移仍在内层 `#ui-wheel-track`）；受影响运行时程序化切月改
  `duration: 0` 并抽出 `finishMonthSwipeAt`/`finishDateSwiperAt` 在零时长跳变后直接结算一次；
  定位当日改为把今天的月份面板作为唯一入场面板放进相邻槽位，删除逐月续走分支。
- 体验版 `0.1.0-p10.20260916.149`，说明「Skyline 3.17.2 wheel pan and month paging 7e215a2」，
  production/clean，Manifest `442f89339f4c47ad5a83cbe5ca1d28a176b96e951c330f3c93628e052f236fc8`；
  版本由独占分配器在锁内选择（分配 `14:49:18Z`、构建 `14:48:54Z`、上传 `14:50:21Z`），
  远端不可变轻量 tag `miniprogram-trial/0.1.0-p10.20260916.149` 指向同一 SHA。
- 门禁：Mini 完整 174 文件 1215 项通过/16 跳过；typecheck、production build（366 文件）、
  package（主包 1744335B / 总包 4618740B）、determinism（`2286365b…0973`）、`pnpm format:check`、
  `pnpm lint`、`pnpm smoke:check-core` 通过。`pnpm miniprogram:verify` 仍只被既有未改的手排矩阵
  节点预算 `1507>1506` 阻断，本轮未修改手排或放宽测试。
- 放行：可信 `schedule-client-version-allowlist ensure` 只追加 `.149`（白名单 45 项，保留
  `.146/.147/.148` 等旧版），独立 `verify` 与 `/usr/local/lib/schedule/ecs-verify.sh` 通过；
  公网 HTTPS `.149=200`、`.148=200`、动态未知版本 `=426`。追加期间 API/Web 容器按既有流程重建并
  在健康等待后恢复（期间短暂 502 属既有现象）。本轮未部署应用制品、未备份或迁移数据库，
  未另行查询或声明 production live release（`LIVE_RELEASE_VERIFIED=false`）。
- 唯一下一任务：小米 14 双实例复核——3.17.2 年月滚轮能否滚动、左右切月动效方向是否与 3.17.3 一致、
  请假弹窗「定位当日」是否一次到位；3.17.3 三项保持不变。若滚轮仍不能滚动，请回复
  「点滚轮中间那一项有无反应」以区分手势抢占与遮罩命中。

文档检查点：`docs(release): record Skyline 3.17.2 wheel pan trial 149 delivery`。该提交只含
`docs/**`，按仓库例外不触发生产部署或服务器 release 标识同步。
