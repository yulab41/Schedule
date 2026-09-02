# 微信小程序审计状态

## 当前阶段

- 当前批次：`EXP-UX-001`；用户已批准设计，书面 spec 已写入并等待用户复核，尚未修改业务源码或测试。
- 基线：`origin/main@07decdbbf8bd4eaf7c34077392aea3b1fbc4eac2`；执行分支/worktree 为
  `codex/fix-exp-ux-001` / `runtime/external-project-worktrees/exp-ux-001`。
- 本轮范围：工作流换班 sheet、共用 workflow picker、工作流直达页遗留 bottom-nav、所有页面右上角
  P5/P7/P8/P9 phase chip；不重跑阶段 0，不执行 `MINI-G1-004`、日期选择器业务、事件记录或全局图标重构。

## 已验证事实

- 小米 14 体验版真实截图已收到：换班 sheet 底部被工作台导航覆盖；同一空下拉再次点击仍保持打开；
  通讯录筛选 sheet 的 fixed/独立滚动行为可作参考；请假和加扣班非 Tab 页面仍显示遗留工作流导航。
- 静态追踪确认换班旧 sheet 为组件局部 `absolute/z40`，工作台导航为页面级 fixed 层；workflow picker
  的 `handleOpen` 没有自身 `open` 分支；leave/swap/duty 三个 panel 共享同一旧 bottom-nav；全源码有
  13 个右上角静态 P5/P7/P8/P9 phase-chip 节点。
- 现有 `ui-sheet` 已具备 fixed 层、标题/完成入口、安全区和顶部 drag WXS；工作台首页筛选器已有字段
  toggle；原生 `<picker>` 实例不复用 workflow picker 根因。

## 当前阻塞与外部边界

- 不是技术阻塞：等待用户对书面 spec 的复核后进入“先红后绿”的永久合同阶段。
- 当前工具无法替代小米 14 后续真机手势复核；未调用微信开发者工具 GUI/CLI，未上传体验版，未提审/发布，
  未部署 production 或创建生产备份。

## 唯一下一任务与停止条件

- 下一任务：书面 spec 复核通过后新增 `EXP-UX-001` 合同并在旧源码上记录红灯，之后才修改业务源码。
- 本轮最终需记录每张截图的根因、修复前后层级/高度/滚动/安全区、picker 调用者审查、旧导航删除、
  P 标签源码/产物搜索、包体实际差值、全量验证和仍需真机验证的步骤。主线只做一次普通 fast-forward，
  不上传体验版、不部署 production；完成后停止，不进入后续审计批次。
