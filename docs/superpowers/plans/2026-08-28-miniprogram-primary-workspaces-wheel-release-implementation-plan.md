# 小程序一级页面预挂载、测试中心与 WXS 年月滚轮生产接入实施计划

- 日期：2026-08-28
- 基线：`main@1cd4dc13`
- 状态：Checkpoint A 自动门禁已通过；待 checkpoint/体验上传与生产同步
- 设计：[`../specs/2026-08-28-miniprogram-primary-workspaces-wheel-release-design.md`](../specs/2026-08-28-miniprogram-primary-workspaces-wheel-release-design.md)
- WXS 依据：[`../specs/2026-08-28-miniprogram-workflow-picker-wxs-design.md`](../specs/2026-08-28-miniprogram-workflow-picker-wxs-design.md)
- 复杂度：两个可独立回滚的 Mini 代码 checkpoint

`writing-plans` 技能在当前环境不可用；本文件按仓库既有 plan 格式提供等价的测试先行执行清单。

## 用户工作树边界

以下路径为用户内容，不得删除、覆盖、暂存或格式化：

- `apps/miniprogram/project.config.json`
- `apps/miniprogram/scripts/group-settings-page.test.mjs`
- `apps/miniprogram/src/subpackages/organization/components/group-settings-panel/index.wxml`
- `.agents/`、Web UI2 草稿、根 `src/`、`runtime/` 历史证据与工作簿

所有 Git 操作显式列出本计划路径；不得使用全仓 `git add`。release 必须从
`runtime/release-worktree` 的精确 clean commit 构建。

## Checkpoint A：一级页面预挂载、Skyline 布局与测试中心

### Task 1：冻结 click-time 白屏红灯

扩展：

- `apps/miniprogram/scripts/workbench-navigation.test.mjs`
- `apps/miniprogram/scripts/workbench-runtime.test.mjs`
- `apps/miniprogram/scripts/p7-native-feedback.test.mjs`

旧树必须稳定失败于：

1. workbench WXML 的 directory/profile wrapper 仍有 `wx:if`。
2. `handleDirectoryNav/handleProfileNav` 仍写 `directoryMounted/profileMounted`。
3. 初始 data 没有 `directoryPanelReady/profilePanelReady`，组件也没有 `panelready` 边界。
4. ready 前没有可读加载层，空 placeholder 可直接成为活动 workspace。
5. 测试中心入口不存在，或被角色/capability 条件包围。

红灯命令：

```powershell
pnpm --filter @schedule/miniprogram exec vitest run `
  scripts/workbench-navigation.test.mjs `
  scripts/workbench-runtime.test.mjs `
  scripts/p7-native-feedback.test.mjs `
  --fileParallelism=false
```

### Task 2：实现静态预挂载与统一测试入口

修改：

- `apps/miniprogram/src/platform/build-info.ts`
- `apps/miniprogram/src/pages/workbench/index.ts`
- `apps/miniprogram/src/pages/workbench/index.wxml`
- `apps/miniprogram/src/pages/workbench/index.wxss`
- `apps/miniprogram/src/pages/workbench/index.json`
- `apps/miniprogram/src/components/profile-panel/index.ts`
- `apps/miniprogram/src/subpackages/organization/components/directory-panel/controller.ts`

实现：

1. 删除 directory/profile 的 mounted data 和两处 `wx:if`，保留 wrapper `hidden` 常驻切换。
2. 两个点击 handler 只切 `activeWorkspace`、关闭弹层和更新图标动画。
3. 组件 attached 的首个确定渲染 callback 触发一次 `panelready`；不携带业务字段。
4. workbench ready 前显示固定加载层；ready 后只显示真实 component。
5. `buildInfo.testCenterEnabled=true` 是唯一入口开关；“更多 → 测试与诊断 → 测试中心”对所有
   已登录账号显示并 `navigateTo('/pages/gesture-probe/index')`。
6. 空 groupId 不发 Profile 概览或通讯录请求；群组 observer 到值后按原 serial 预热。

行为审计：预挂载只提前既有只读请求；点击零新请求；业务写、Bearer、权限矩阵、缓存、离线、
Promise/catch、空值和 receiver 不变。

### Task 3：冻结 Skyline 布局红灯

扩展：

- `apps/miniprogram/scripts/p10-directory-native.test.mjs`
- `apps/miniprogram/scripts/p10-profile-native.test.mjs`
- `apps/miniprogram/scripts/workbench-navigation.test.mjs`
- `apps/miniprogram/scripts/thin-page-boundary.test.mjs`

旧树必须失败于：

1. directory/profile touched WXSS 仍含 `display: grid`。
2. directory `.directory-mode-swiper` 仍含 `height: 0`。
3. 两个面板纵向 `scroll-view` 缺少 `type`。
4. `/pages/profile/index.json` 未声明 Skyline Page/`ui-sheet`，WXSS 没有确定 page 高度。
5. 工作台主组件 entry 或独立 Page 静态 include/import 任一被错误移除。

红灯命令：

```powershell
pnpm --filter @schedule/miniprogram exec vitest run `
  scripts/p10-directory-native.test.mjs `
  scripts/p10-profile-native.test.mjs `
  scripts/workbench-navigation.test.mjs `
  scripts/thin-page-boundary.test.mjs `
  --fileParallelism=false
```

### Task 4：实现 Skyline 支持布局

修改：

- `apps/miniprogram/src/components/profile-panel/index.wxml`
- `apps/miniprogram/src/components/profile-panel/index.wxss`
- `apps/miniprogram/src/pages/profile/index.json`
- `apps/miniprogram/src/pages/profile/index.wxss`
- `apps/miniprogram/src/subpackages/organization/components/directory-panel/index.wxml`
- `apps/miniprogram/src/subpackages/organization/components/directory-panel/index.wxss`

实现：

1. Grid 单列改 column flex；多列改 flex-wrap 与确定 width；图标居中改双轴 flex。
2. Profile stat/trend 保持顺序、390/320/大字号与深蓝下一班卡；不重做视觉层级。
3. directory 模式栏、ribbon、搜索、结果和筛选层改 flex 等价结构。
4. 纵向 `scroll-view` 添加合适 `type`；directory swiper 在固定 flex shell 中取得非零空间，
   `swiper-item/scroll-view` 仍为 100% 高度。
5. Profile Page 声明 `disableScroll/navigationStyle/renderer/ui-sheet` 和 `page height:100%`；继续
   static include/import，不能改成 panel 注入薄壳。

### Task 5：Checkpoint A 验证与发布

定向：

```powershell
pnpm --filter @schedule/miniprogram exec vitest run `
  scripts/workbench-navigation.test.mjs `
  scripts/workbench-runtime.test.mjs `
  scripts/p7-native-feedback.test.mjs `
  scripts/p10-directory-native.test.mjs `
  scripts/p10-directory-controller.test.mjs `
  scripts/p10-profile-native.test.mjs `
  scripts/profile-panel-controller.test.mjs `
  scripts/thin-page-boundary.test.mjs `
  --fileParallelism=false
```

完整门禁：

```powershell
pnpm miniprogram:test
pnpm --filter @schedule/miniprogram typecheck
pnpm --filter @schedule/miniprogram verify
pnpm --filter @schedule/miniprogram check:determinism
pnpm miniprogram:package-audit
pnpm miniprogram:ci:dry-run
pnpm build
pnpm typecheck
pnpm test
pnpm smoke:check-core
```

另运行任务文件 Prettier/ESLint、`git diff --check`、source/output/package/secret 审计。逐行列出行为
变化并显式暂存。checkpoint 识别消息：

```text
fix(miniprogram): preload primary workspaces on Skyline
```

推送后从 clean checkpoint 上传 `.63` 之后的下一单调 production-profile 体验版；创建生产备份，
按制品哈希选择完整部署或 trusted reuse，执行 allowlist ensure/verify、七维 capability、unknown=426、
带公网 IP full verifier 和远端临时清理。此 checkpoint 不提审、不正式发布。

## Checkpoint B：WXS 年月滚轮生产接入

### Task 6：冻结生产 picker 单引擎红灯

新增或扩展：

- `apps/miniprogram/scripts/workflow-picker-wxs-integration.test.mjs`
- `apps/miniprogram/scripts/workflow-picker-controller.test.mjs`
- `apps/miniprogram/scripts/p7-native-feedback.test.mjs`
- `apps/miniprogram/scripts/ui-wheel-column.test.mjs`
- `apps/miniprogram/scripts/ui-wheel-column-simulate.test.mjs`

旧树必须失败于：

1. workflow-picker JSON 未声明 `ui-wheel-column`。
2. month WXML 仍使用两个 `scroll-view/scroll-top/bindscroll/bindscrollend`。
3. TS 仍有 wheel snap timer、animation owner、latestTop/touching、逐帧 item/position state。
4. WXSS 仍有 month wheel `scroll-snap-type/scroll-snap-align`。
5. 没有 year/month 独立 generation/sequence、preview/settle stale-event guard。
6. 完成目标、取消零 emit、打开重置和多实例隔离未通过新组件路径。

红灯命令：

```powershell
pnpm --filter @schedule/miniprogram exec vitest run `
  scripts/workflow-picker-wxs-integration.test.mjs `
  scripts/workflow-picker-controller.test.mjs `
  scripts/p7-native-feedback.test.mjs `
  scripts/ui-wheel-column.test.mjs `
  scripts/ui-wheel-column-simulate.test.mjs `
  --fileParallelism=false
```

### Task 7：组合两个已验证 UiWheelColumn

修改：

- `apps/miniprogram/src/subpackages/workflows/components/workflow-picker/index.json`
- `apps/miniprogram/src/subpackages/workflows/components/workflow-picker/index.ts`
- `apps/miniprogram/src/subpackages/workflows/components/workflow-picker/index.wxml`
- `apps/miniprogram/src/subpackages/workflows/components/workflow-picker/index.wxss`
- `apps/miniprogram/src/components/ui/ui-wheel-column/**`（只允许契约必要调整）

实现：

1. year/month 分别传 items、unit、selectedIndex、runtimeKey、generation、commandRevision。
2. 打开 month mode 递增 generation 并无动画定位；关闭/detached 使旧 generation 失效。
3. 当前 generation 且 sequence 递增的 preview 更新 draft；settle 只记最终摘要。
4. 完成读取最新 preview target 并只 emit 一次；取消零 emit；selector/date 行为不变。
5. 删除旧两个 scroll-view、CSS snap、100ms/320ms timer、scroll handlers、position/item 重建和
   animation owner；不得留下并行滚动所有者。
6. 多 picker 继续依赖 registry 控制可见性，但正确性由 runtimeKey/generation 自身隔离。

逐调用点审计 receiver、同步/异步路径、Promise/catch、空值、类型收窄、副作用次数；任何差异单独
记录，不伪装成重构。

### Task 8：Checkpoint B 验证与发布

定向运行 Task 6 命令，并增加：

```powershell
pnpm --filter @schedule/miniprogram exec vitest run `
  scripts/gesture-probe.test.mjs `
  scripts/manual-matrix-poc.test.mjs `
  scripts/performance-budget.test.mjs `
  --fileParallelism=false
```

随后完整重跑 Checkpoint A 的全部门禁、任务 Prettier/ESLint、WXS source/output SHA、热路径、
package size、determinism、CI dry-run、root build/typecheck/test、core smoke 与 `git diff --check`。

checkpoint 识别消息：

```text
fix(miniprogram): ship single-owner WXS month wheel
```

推送、备份、部署、体验上传、allowlist/capability/unknown/full verifier 与清理规则同 Checkpoint A，
使用下一单调版本；不审核、不正式发布。

## Task 9：状态收口与实体业务页 RC

更新：

- `apps/miniprogram/docs/runbooks/p7-workflow-rc.md`
- `apps/miniprogram/docs/runbooks/p10-directory-rc.md`
- `apps/miniprogram/docs/runbooks/p10-profile-rc.md`
- `docs/agent-context/pitfall-index.json`
- `docs/agent-context/pitfalls/mini-page-boundary.md`
- `docs/agent-context/pitfalls/mini-workflow-wheel-snap-interruption.md`
- `docs/debug/debug-feedback-log.md`
- `docs/project-status.md`

最终 Android 清单：

1. 冷启动后立刻和等待后分别打开通讯录/我的；首次与重复进入均非白屏。
2. 群组切换、访客/无群组、错误/重试、返回日历后重入保持正确。
3. 所有账号在“更多”看到测试中心；入口关闭开关有自动契约。
4. 业务年月双列各做慢速下→上、半格反向、吸附中反向、flick、点行、顶底边界。
5. 核对完成一次值、取消零值、字号/透明度/中心值一致。

状态停止在 `已完成自动验证与体验上传 → 待用户实体 Android 业务页复核`。iOS 最迟在正式审核前
执行同一清单；审核和正式发布需用户另行明确批准。
