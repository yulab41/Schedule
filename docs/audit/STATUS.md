# 微信小程序审计状态

## 当前阶段

- 当前批次：`EXP-ICON-004`；已完成 Web/微信小程序图标与图标动效静态审计、单一来源设计和实施分批；状态为
  “已完成静态/构建证据 → 待用户审阅并批准 B1”。
- 起始基线：`origin/main@359966f7240d2f557b24dd0c1ac61979d6bb8298`；执行分支/worktree 为
  `codex/exp-icon-004-audit` / `runtime/external-project-worktrees/exp-icon-004-audit`。
- 范围：底部导航、顶部通知/个人、日历、通讯录、换班/加扣班/请假入口、事件记录、chevron/close/filter、
  其他现有图标与动效的 source、属性、差异、包体和迁移边界。
- 本轮只更新审计、设计、计划和状态文档；不重跑阶段 0，不修改生产图标实现，不调用微信开发者工具，
  不上传体验版，不部署 production。

## 已验证事实

- Web 生产 icon source 由 `WorkbenchNavIcon.vue` 的 inline SVG、`LucideMinimalActionIcon.vue` 的 inline/
  TDesign 混合实现、TDesign direct imports、少量 CSS 几何和 PWA PNG 组成；未发现 sprite 或 icon font。
- Mini 生产源码有 26 个静态 SVG、7,218B 源字节，以及 CSS/WXML 手绘形状和文本 glyph；26 个 SVG 当前因 root
  `assets/icons` 路径全部进入 main。
- 多组 path 已与 Web/TDesign exact，但没有 `packages/ui-icons`、machine-readable source/checksum 或 motion
  manifest。主要 P1 是底部 nav 的组合/loop/actor 不一致、更多入口语义 icon 复用错误、外部 `<image>` 无法
  驱动内部 path draw；主要 P2 是 token/cap/size/geometry 漂移和主包重复 asset。
- clean production build `276 files`；Mini source audit、package audit、performance budget 均通过。包体为
  main `1,677,999B`、scheduling `425,318B`、organization `1,053,334B`、workflows `832,966B`、
  insights `1,071,781B`、diagnostics `52,021B`、total `5,113,419B`；main 已处内部 1.5MiB warning。
- 根因已由 `git log -S`/`git blame` 取证：Web 导航 motion `5b9542a2`，Mini SVG/页面阶段性迁移
  `3fc41610` 等，Mini WXSS 对齐与 motion `733e3af6`；两端是分别演进的 source，不能仅凭文件名合并。

## 验证与边界

- 实际运行：`node apps/miniprogram/scripts/build.mjs --profile=production`（276 files）、
  `node apps/miniprogram/scripts/source-audit.mjs`（passed）、`node apps/miniprogram/scripts/package-audit.mjs`
  （passed，5,113,419B）、`node apps/miniprogram/scripts/performance-budget.mjs`（passed，tapCellPaths=2）。
- 当前没有生产代码 diff，因此未运行浏览器 smoke、Mini 全量回归或体验上传流程；没有把本轮文档审计写成
  Web 浏览器、微信原生或 Xiaomi 14 验收。
- 微信开发者工具 GUI/CLI、真实冷启动、Skyline/WebView image 内部 path 动效、reduced-motion 客户端行为、
  Xiaomi 14 手势与视觉均为“当前工具无法测量，暂未验证”。未来若上传，必须先取得当次明确批准并核对短
  SHA、`trial`、renderer、基础库、微信版本和构建时间。

## 唯一下一任务与停止条件

- 唯一下一任务：用户审阅 `docs/audit/exp-icon-004-icon-parity-audit.md`、设计/计划文档及其中的 B1 精确
  Prompt；如批准，下一轮只执行 B1 source catalog/generator/tests，不自动进入 B2 图标替换。
- 本轮调查分支文档 checkpoint 推送后停止；保持“待用户审阅”。不上传体验版、不部署 production，不进入
  全量图标实现或后续真机批次。
