# Project Status

本文档只记录当前可安全接续的事实；详细历史以 Git、`docs/audit/` 和精确 debug 日志为准。每轮先读
`docs/agent-context/pitfall-index.json`，只加载匹配坑位详情。

## 当前仓库批次（2026-09-03）

- 当前活动批次：`EXP-CALENDAR-003`；状态为“已完成（含运行验证）→ 待用户复核”。本轮只处理请假日期选择器
  的月份横滑、定位今天和选中态颜色，不处理图标系统、`MINI-G1-004`、月份滚轮、API、数据库或业务规则。
- 执行 worktree：`runtime/external-project-worktrees/exp-calendar-003-20260902`；分支
  `codex/exp-calendar-003-20260902`。代码基线为在实现前 rebase 到执行时最新 `origin/main@0792ed01`；根工作区
  的用户自有脏改动未接管。
- 设计规格：`docs/superpowers/specs/2026-09-02-miniprogram-exp-calendar-003-design.md`。共享
  `calendar-period-pager` 统一三槽 ring、active/target/queued 状态、取消/提交边界、240ms 和 easeOutCubic；
  首页月历与请假日期 swiper 仍保留各自渲染，月份滚轮 WXS/Worklet 未改动。
- 根因已由 `git log -S`/`git blame` 定位：日期模式旧 `handleDateSwiperChange` 在原生 change 中立即重建整窗并复位
  中心槽（`b5603189`）；today 旧路径只重建整月并依赖 `0975b2d1` 的图标 timer。修复后 change 只预锁，
  animationfinish 才提交；循环面板用稳定物理 `slot` key，相隔多月的 today 按相邻月逐步走同一管线。
- 视觉合同：选中日期使用既有 `--ui-color-today-marker`，文字为 `--ui-color-near-black`；未选中 today 用黄色
  内描边，today+selected 用 near-black 内描边，周末/红色规则在选中规则之前，disabled/首页主蓝保持不变。
- 不调用微信开发者工具、不上传体验版、不提交审核、不部署 production。自动化和构建只能证明状态、数据预置及动画
  调度，不能证明 Xiaomi 14 的实际跟手帧率或“丝滑度”。

## 本批基线与验证证据

- 初始主工作区含用户自有未提交改动；独立 worktree 初建后因 `origin/main` 前进，在代码修改前安全 rebase 到
  `0792ed01`。Node `v24.14.0`、pnpm `11.9.0`；完整 `pnpm install --frozen-lockfile --ignore-scripts` 通过。
- 测试先行：共享状态机、日期控制器和视觉合同在旧实现上先红；实现后日期/状态定向 6 files/63 tests 通过，Mini
  全量 `118 files / 642 tests` 通过。既有月份滚轮 WXS 集成测试仍通过。
- 最终 `pnpm verify` 通过：根格式、ESLint、workspace build/typecheck、Mini 全量及根 `246 passed / 37 skipped`，
  `1170 passed / 364 skipped`。Mini production build `282 files`；Mini verify/source/package/determinism 通过。
- 最终 Mini package `5,151,892` bytes，main `1,715,718` bytes；主包 1.5M 和两个 600-cell 矩阵节点 warning
  为既有阈值类别，Web build 的大 chunk warning 也未新增类别。
- `pnpm smoke:check-core` 通过并确认未涉及 Web 核心链路，无需浏览器冒烟；未取得微信原生运行时或 Xiaomi 14 证据，
  该层统一记录为“当前工具无法测量，暂未验证”。

## 已完成的历史批次

- `EXP-UX-001`：换班/工作流共享 sheet、picker 生命周期、direct Page 导航和 phase 标签收口；历史发布/包体/生产
  证据见 `docs/audit/wechat-miniprogram-audit.md` 第 11 节及对应 debug 条目。
- `EXP-UX-002`：请假/加扣班弹窗改用共享 `ui-sheet`，完成后仍需按其状态记录做 Xiaomi 14 原生复核；本批不改其代码。

## 状态策略与唯一下一任务

- 当前问题状态：实现、静态检查、Node 自动化和构建已完成，进入“待用户复核”；不得写成 Xiaomi 14 真机通过。
- 唯一下一任务：用户在与最终主线 SHA 匹配的构建上按最终回复的 4 步路径复核 Xiaomi 14 的跟手、阈值、回弹、
  today、跨年和关闭重开；本轮不上传、不部署，用户复核前不开始其他日期/图标任务。
- Checkpoint commit：`4e5cb461 fix(miniprogram): smooth EXP-CALENDAR-003 leave date picker`；本地提交已完成，本批
  只允许一次普通 fast-forward 推送主线，完成后停止。
- 主线收口规则：重新确认最新远端主线后，只做一次普通 fast-forward 推送到 `main`，不 force push、不上传体验版、
  不部署 production；推送完成后停止。
