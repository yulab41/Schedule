# 滚轮通道探针 体验版 152 交付

2026-09-17 用户在当前消息授权「上传体验版并放行」。本轮只交付小程序源码与体验版；未部署生产应用、
未备份或迁移数据库、未提审、未正式发布。

- 源码提交 `61e81e07e92fdfce771525e7e6ff985953ca79a8`（分支
  `codex/runtime-3172-wheel-and-pager-20260916`，已推送）。血缘含最新 `origin/main@4179f05a`
  与 `.151@d33da54b`；候选前置与上传后版本绑定检查均 `RESULT=PASS`
  （`ready-clean-detached`、`production-clean`、`VERSION_LOCAL=absent`）。
- 内容：`更多 → 测试工具` 新增二级卡片"滚轮通道探针"（页面级 WXS 拖动方块 + 真实 `ui-wheel-column`
  + 组件作用域/页面作用域实测 + 一键复制），用于一次性判定页面级 WXS 样式通道、滚轮 WXS 手势与回报通道、
  渲染器是否真的应用 WXS 样式、以及组件作用域查询是否可用。详见
  `runtime-ui-compatibility-wheel-channel-probe-20260917.md`。
- 体验版 `0.1.0-p10.20260917.152`，说明「Skyline 3.17.2 wheel channel probe 61e81e0」，
  production/clean，Manifest `e02b6f6c83f4a1de90b6d9851e59ac3cde6c54900230a985ac81952379904545`；
  版本由独占分配器在锁内选择（构建 `05:13:52Z`、上传 `05:14:48Z`），
  远端不可变轻量 tag `miniprogram-trial/0.1.0-p10.20260917.152` 指向同一 SHA。
- 门禁：定向 `test-tools` 23 项、Mini 完整 174 文件 1220 项通过/16 跳过；typecheck、production build
  （367 文件）、package（主包 1746707B / 总包 4632789B）、determinism（`677e0ed7…760a5`）、
  `pnpm format:check`、`pnpm lint`、`pnpm smoke:check-core` 通过；`pnpm miniprogram:verify` 仍只被
  既有未改的手排矩阵节点预算 `1507>1506` 阻断。
- 放行：可信 `schedule-client-version-allowlist ensure` 只追加 `.152`（白名单 48 项，保留 `.151` 等旧版），
  独立 `verify` 与 `/usr/local/lib/schedule/ecs-verify.sh` 通过；公网 HTTPS `.152=200`、`.151=200`、
  动态未知版本 `=426`。未部署应用制品、未备份或迁移数据库，也未声明 production live release
  （`LIVE_RELEASE_VERIFIED=false`）。
- 唯一下一任务：小米 14 打开 `.152`，进 `更多 → 测试工具` → 「滚轮通道探针」按三步操作
  （拖方块 → 拖滚轮 → 采集）并把复制内容发回；再复核单位显示、选中放大、能否滚到年 2031 / 月 12月、
  关掉重开是否仍正常，以及 3.17.3 不变。

文档检查点：`docs(release): record wheel channel probe trial 152 delivery`。该提交只含 `docs/**`，
按仓库例外不触发生产部署或服务器 release 标识同步。
