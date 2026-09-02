# Project Status

本文档只记录当前可安全接续的事实；详细历史以 Git、`docs/audit/wechat-miniprogram-audit.md` 和精确
debug 日志为准。每轮先读 `docs/agent-context/pitfall-index.json`，只加载匹配坑位详情。

## 当前仓库批次（2026-09-02）

- 已完成主线批次：`MINI-G1-001`、`MINI-G1-002`、`MINI-G1-003`，当前基线为
  `origin/main@07decdbbf8bd4eaf7c34077392aea3b1fbc4eac2`。
- 当前活动批次：`EXP-UX-001`；用户已批准设计，书面 spec 已写入，当前等待书面 spec 复核，尚未改
  业务源码或测试合同。
- 修复分支/worktree：`codex/fix-exp-ux-001` /
  `runtime/external-project-worktrees/exp-ux-001`；worktree 从最新 `origin/main` 创建且初始 clean。
- 设计 checkpoint：`docs(superpowers): design EXP-UX-001 experience fixes`（提交前识别信息）。
- 用户主工作区和其他 worktree 的既有内容未修改、清理、暂存或借用；不重跑阶段 0，不执行
  `MINI-G1-004`。

## 当前设计与证据

- 书面设计：`docs/superpowers/specs/2026-09-02-exp-ux-001-design.md`。已完成占位符、范围、内部一致性
  和验证边界自审。
- 真实小米 14 证据包含：工作台换班 sheet 被底栏覆盖、同一空下拉再次点击仍打开、通讯录筛选 sheet
  正常、请假/加扣班直达页遗留底栏；用户另确认删除所有页面右上角 P 阶段标签。
- 静态根因已定位：换班 panel 使用局部 `absolute/z40` sheet，而工作台底栏是页面级 fixed 导航层；
  picker 的 `handleOpen` 缺少自身 open toggle；三个 workflow panel 同时拥有同一遗留 bottom-nav；
  13 个 header `phase-chip` P5/P7/P8/P9 节点来自 WXML 静态文本。

## 设计 checkpoint 验证与边界

- 已执行 `git diff --check`，设计文档无格式错误；尚未运行业务测试、构建、verify 或包体测量。
- 计划先新增 `EXP-UX-001` 永久合同并在旧实现上确认红灯，再改共享 sheet/picker/page shell/标签源码。
- 保留 buildLabel、SHA/版本编译变量、测试工具内部 metadata 和 P1 左侧诊断说明；导出页 CSV 将改用
  `format-chip`，不保留 phase 样式链路。
- 未调用微信开发者工具 GUI/CLI，未上传体验版，未部署 production，未创建生产备份。

## 唯一下一任务与停止条件

- 下一任务：用户复核并确认书面 spec；确认后只新增永久回归合同，在旧源码上记录红灯。
- spec 复核前停止业务实现；实现后需在同一最终 tip 完成用户指定全量验证、更新审计/debug/状态文档，
  再 fetch 最新主线并处理普通漂移。
- 主线只做一次最终普通 fast-forward 推送，不 force push；不上传体验版、不部署 production。完成主线收口
  后停止，不开始事件记录、日期组件或图标任务。
