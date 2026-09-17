# Skyline 3.17.2 弹窗点击误关修复体验版 148 交付

2026-09-16 用户在当前消息中授权「上传并放行」，并重申原则：最小改动、不重复造轮子、不堆屎山。
本轮只交付小程序源码与体验版；未部署生产应用、未备份或迁移数据库、未提审、未正式发布。

- 源码提交 `c5f06e501617fd37820ddc496ba77b51bf4905c4`（分支
  `codex/runtime-3172-overlay-verify-20260916`，已推送）。血缘含 `origin/main` 与 `.147` 来源
  `18ed6f69`；本修复位于其之上。
- 修复内容（1 行 + 1 条断言）：`.workflow-picker-layer` 增加 `catchtap="handleInternalTap"`（复用组件内
  现有的 no-op 处理器），使 3.17.2 页面根层的宿主弹窗自己消费卡片内的点击，不再冒泡到页面根的
  `handlePanelBackgroundTap` 关闭分支；点遮罩仍然关闭弹窗，3.17.3 路径不变。RED 1 失败 → GREEN 15/15。
- 体验版 `0.1.0-p10.20260916.148`，说明「Skyline 3.17.2 dialog tap fix c5f06e5」，production/clean，
  Manifest `1f64d19520e06a72707ce7f88b879de3a05f1c9b589ee245c3ba572fccd6f9e7`；版本由独占分配器
  在锁内选择；候选前置与上传后版本绑定检查均 `RESULT=PASS`。
- 门禁：Mini 完整套件通过；typecheck、production build（366 文件）、package、determinism
  （`4410f7fb…127a5c`）、`pnpm format:check`、`pnpm lint` 通过；主包 1744039B、总包 4618444B。
- 放行：可信 ensure 只追加 1 个版本并保留 `.147` 等旧版；独立 allowlist verify 与
  `/usr/local/lib/schedule/ecs-verify.sh` 通过，生产 release 仍 `44034fcc…d276df9`，无应用部署、
  数据库备份或迁移。放行后独立 HTTPS：`.148=200`、`.147=200`、动态未知版本 `=426`。
- 唯一下一任务：小米 14 3.17.2 复核——日期弹窗内点"定位今天"/左右切月/具体日期不再关闭并可选中；
  年月滚轮能否滚动（若仍不能，请反馈"轮子不动 / 整页滚动 / 一滑就关"，据此选择下一轮方向：
  轮子不动属 WXS 样式通道，改用逻辑层数据驱动 transform）；3.17.3 与之前一致。

文档检查点：`docs(release): record Skyline 3.17.2 dialog tap fix trial 148 delivery`。该提交只含
`apps/miniprogram/**` 与文档，按仓库例外不触发生产部署或服务器 release 标识同步。
