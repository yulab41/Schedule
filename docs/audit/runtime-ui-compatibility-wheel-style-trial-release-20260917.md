# Skyline 3.17.2 滚轮位移通道 体验版 150 交付

2026-09-17 用户在当前消息授权「上传并放行」。本轮只交付小程序源码与体验版；未部署生产应用、
未备份或迁移数据库、未提审、未正式发布。

- 源码提交 `a0707b0ce1041d0281bcaacf3acbf07bf99bf043`（分支
  `codex/runtime-3172-wheel-and-pager-20260916`，已推送）。血缘含最新 `origin/main@4179f05a`
  与 `.149@7e215a28`；候选前置与上传后版本绑定检查均 `RESULT=PASS`
  （`ready-clean-detached`、`production-clean`、`VERSION_LOCAL=absent`）。
- 修复内容：`ui-wheel-column` 删除会覆盖 WXS transform 的 `#ui-wheel-track` 内联 `style` 绑定、
  组件侧移除 `wheelInitialOffset`，并让手势在 `touchStart` 用节点 dataset
  （`data-item-count`/`data-selected-index`）自建基线；定位当日改为一步重定中心
  （`resetDatePager` + 一次 `setData`，3.17.2 仍 `duration: 0`），并删除已死的 `_dateLocateTarget`
  与 `formatMonthValue`。
- 体验版 `0.1.0-p10.20260917.150`，说明「Skyline 3.17.2 wheel track transform ownership a0707b0」，
  production/clean，Manifest `45598d45181bd0d55d5f8fced70c874a98de33c6f83fcc5552d6d4622ec90e69`；
  版本由独占分配器在锁内选择（分配 `23:27:30Z`、构建 `23:27:17Z`、上传 `23:28:41Z`），
  远端不可变轻量 tag `miniprogram-trial/0.1.0-p10.20260917.150` 指向同一 SHA。
- 门禁：Mini 完整 174 文件 1216 项通过/16 跳过；typecheck、production build（366 文件）、
  package（主包 1744556B / 总包 4618961B）、determinism（`21cae2df…3e758`）、`pnpm format:check`、
  `pnpm lint`、`pnpm smoke:check-core`、`agent-context-policy` 通过；`pnpm miniprogram:verify` 仍只被
  既有未改的手排矩阵节点预算 `1507>1506` 阻断。
- 放行：可信 `schedule-client-version-allowlist ensure` 只追加 `.150`（白名单 46 项，保留
  `.149/.148/.147` 等旧版），独立 `verify` 与 `/usr/local/lib/schedule/ecs-verify.sh` 通过；
  公网 HTTPS `.150=200`、`.149=200`、动态未知版本 `=426`。追加期间 API/Web 容器按既有流程重建并在
  健康等待后恢复（短暂 502 属既有现象）。本轮未部署应用制品、未备份或迁移数据库，也未声明
  production live release（`LIVE_RELEASE_VERIFIED=false`）。
- 唯一下一任务：小米 14 复核——3.17.2 换班年月滚轮能否跟手滚动；请假定位当日是否每次都能一次跳到
  当月当日。若滚轮仍不动，请回复「拖动时中间那一项的高亮是否跟着换」或「非中间项的数字是否比中间
  更小更淡」，以区分样式通道与事件通道。

文档检查点：`docs(release): record Skyline 3.17.2 wheel style trial 150 delivery`。该提交只含
`docs/**`，按仓库例外不触发生产部署或服务器 release 标识同步。
