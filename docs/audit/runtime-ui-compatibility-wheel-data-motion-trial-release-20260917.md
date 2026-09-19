# 3.17.2 滚轮像素通道 体验版 153 交付

2026-09-17 用户在当前消息授权「1，2，3 都做」。本轮完成第 1 项：交付滚轮像素通道修复。

- 源码提交 `a18f8692c00056cb13acd7c01d9e9c4dd9c4388a`（分支
  `codex/runtime-3172-wheel-and-pager-20260916`），核心修复提交 `cf6fbf40`（像素改走数据通道 +
  单位 `wx:if/wx:else`），其后两笔为文档/规则。
- 体验版 `0.1.0-p10.20260917.153`，说明「Skyline 3.17.2 wheel data channel a18f869」，
  production/clean，Manifest `72b7dcb41243d307f3e45f13497e83d05422a22893bc06b9001dbbb2cbda79fd`；
  候选前置与上传后绑定检查均 `RESULT=PASS`（`ready-clean-detached`、`production-clean`、
  `VERSION_LOCAL=absent`）。
- 放行：可信 ensure 只追加 `.153`（保留 `.152` 等旧版），独立 verify 与
  `/usr/local/lib/schedule/ecs-verify.sh` 通过；公网 `.153=200`、`.152=200`、动态未知 `=426`。
  未部署应用制品、未备份或迁移数据库、未声明 production live release。
- 待小米 14 复核：3.17.2 滚轮数字**按行跟着动**、"年/月"单位是否出现、中间项是否变大变粗；
  3.17.3 侧应完全不变。
- 第 2 项（修模拟器白屏后补 DevTools 验证）与第 3 项（AI 开发模式 generate→validate）需另行执行：
  前者要装官方要求的 Nightly Electron 版开发者工具；后者需在公众平台申请「开发模式」并开启
  开发者工具服务端口，且官方明确该模式代码不得合入正式提审版本。
