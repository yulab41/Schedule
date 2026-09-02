# 微信小程序审计状态

## 当前阶段

- 当前批次：`EXP-UX-002`；用户已批准请假/加扣班弹窗外壳设计，书面设计已完成，代码尚未修改，自动化尚未
  重跑；当前状态为“书面规格待用户复核”。
- 起始基线：`origin/main@359966f7240d2f557b24dd0c1ac61979d6bb829`；执行分支/worktree 为
  `codex/fix-exp-ux-002` / `runtime/external-project-worktrees/exp-ux-002`。
- 设计文件：`docs/superpowers/specs/2026-09-02-exp-ux-002-design.md`；本批不上传体验版、不部署 production，
  也不调用微信开发者工具。
- 为保留 production `50ac2d07a3412c6d76a3494b1150868276f4781c` 的 schema 53 与目录查询能力，最终源码
  release tip 为 `3897581e7a8d5734ef5910e2dd8854a92c246062`（第一父 `d1594d09`，第二父为 production release）。
- 范围：换班 sheet、共用 workflow picker、leave/swap/duty 非 Tab 遗留底栏、所有页面右上角 P5/P7/P8/P9
  标签；不重跑阶段 0，不执行 `MINI-G1-004`、日期选择器业务、事件记录或全局图标重构。

## 已验证事实

- 用户五张 Xiaomi 14 截图映射为：#1 换班 sheet 被首页底栏遮挡，#2 同一空下拉复点不关闭，#3 通讯录筛选
  sheet 为 fixed/独立滚动参考，#4 请假直达页遗留底栏，#5 加扣班直达页遗留底栏。截图构建身份字段当前
  工具无法读取，不能写成当前修复 tip 的真机验收。
- 旧根因已用 `git log -S`/`git blame` 定位：swap native sheet `80ddadf0`，P7 panel nav/picker path
  `bc32a4f1`，export phase chip `de710eaf`。旧合同先红 7 项，修复后 EXP 9/9、定向 52/52、Mini 全量
  114 files / 621 tests 通过。
- 新换班 sheet 使用既有 `ui-sheet` fixed z400、78vh/max660、safe-area，正文 scroll 与 footer 分离，拖动
  仅由顶部 drag region 所有；picker 统一 toggle/互斥/卸载清理。
- leave/swap/duty 旧 bottom-nav 节点、handler、专用样式和 64px 底栏预留已源码删除；direct Page JSON
  没有旧导航专用 usingComponents，路由/back/system side-swipe 保留；真正 workbench Tab 未改。
- 13 个 `phase-chip` P 标签节点及样式已删除，CSV 改为 `format-chip`，build identity、测试工具 metadata、
  P1 左侧诊断说明保留；源码/dist 搜索无 phase chip。clean production 包体 `5,121,616 → 5,113,419`，
  减少 `8,197` bytes；manifest 为每次 build-time 生成值，不作为稳定包体指标。

## 验证与边界

- `pnpm miniprogram:test` 为 114 files / 621 tests；Mini typecheck/build/source/verify、根 build/typecheck/lint、
  `pnpm test`（246 files / 1,170 passed / 364 skipped）、全仓 Prettier、`git diff --check` 均通过。
- `pnpm smoke:browser` 已运行但未进入产品断言：初次 5173 未监听；按正式启动方式重试时该 worktree 缺少本地
  `.env`，API 无法启动；端口已确认无残留。`pnpm smoke:check-core` 在补记该结果后通过。
- 当前工具按仓库政策未调用微信开发者工具 GUI/CLI。`.80` 已从 production profile 上传（191 code files、ZIP
  `2,451,857B`、upload manifest `a0b6a3ce…4deaf`）；production release 已切换并完成 allowlist。
  生产备份为 `bd5f74d6-4b06-4330-878b-9c1f87c6ee9f`（55 表、206,133 行、91,326,356B）。
- allowlist `0.1.0-p10.20260902.80` 的 ensure/verify、七维 capability、未知版本 426、带公网 IP full verifier
  均通过；Node、WXS、静态层级和包体证据不能代替 Xiaomi 14 原生手势、安全区、Skyline 渲染或系统返回验收。

## 唯一下一任务与停止条件

- 唯一下一任务：用户复核本批书面规格后，在旧请假/加扣班弹窗源码上运行新增失败合同，记录红灯，再进入最小
  `ui-sheet` 迁移；最终补写本批根因、前后层级/高度/安全区/滚动区和真机待验收清单。
- 本批完成主线普通 fast-forward 收口后停止；不进入事件记录、日期组件或图标任务。未验证项在下一版实体设备
  证据到达前保持“待用户复核”。
