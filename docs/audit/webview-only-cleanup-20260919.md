# WebView-only 收口：删除全部 Skyline 兼容层（2026-09-19）

## 结论（普通读者版）

之前那一批"界面回退"不是基础库版本造成的，而是**渲染引擎**造成的：同一构建、同一账号，WebView 侧正常，Skyline 侧退化。
所以上一轮把小程序固定为 WebView 请求（ADR-0007）；这一轮把只为 Skyline 写的那套补丁**整段删掉**，
让代码里不再存在"按引擎或按基础库版本分叉"的分支。主包因此减少约 39 KB，界面按既有 WebView 表现为准，没有功能变化。

## 事实核对：仓库里到底有几处按基础库版本分叉

| 检查项 | 结果 |
| ------ | ---- |
| 生产源码里按 `SDKVersion` 改变行为的代码 | **只有一处**：`src/platform/runtime-ui-compatibility.ts`（`请求 Skyline && SDKVersion === '3.17.2'`）及其调用点 |
| 其它 `wx.getAppBaseInfo().SDKVersion` 用法 | 仅诊断页 `subpackages/diagnostics/pages/test-tools` 与 `pages/gesture-probe` 的**展示**，不改变行为 |
| `wx.canIUse` / 版本比较工具 | 仓库内无使用 |
| `rendererOptions.skyline` | 只在"请求 Skyline"时生效；`renderer: "webview"` 下是死配置 |

结论：删除兼容层即可让"渲染器/基础库版本"不再影响任何代码路径，不需要再逐个清理版本判断。

## 删除清单（均为 WebView 下不可达的死代码）

- `src/platform/runtime-ui-compatibility.ts` 及其门禁测试 `scripts/runtime-ui-compatibility.test.mjs`（16 项）。
- `.is-skyline-3172-ui` 样式规则 25 条，分布在 `ui-toast`、`pages/workbench`、`insights-dashboard-panel`、
  `directory-entry-card`、`platform-accounts-panel`、`scheduling-config-panel` 六个 WXSS。
- `ui-wheel-column`：原生 `scroll-view` 孪生分支、`compatFrame`/`paintCompatFrame`/`snapCompat` 等数据通道与快照定时器。
- `calendar-month` / `ui-date-picker`：原生横向分页器孪生、分页度量与清理定时器、`_compat*`/`_dateCompat*` 状态、
  `.calendar-motion-frame` 包装层与 `is-compat` 样式。
- 工作流宿主对话框：`workflow-picker-host` 隐藏宿主、`host-key`、`dialog-only`、`openFromParent`/`forwardHosted*`、
  `needsHostedDialog`/`findHostedTrigger`，以及"面板根节点代理点击外部关闭 sheet"的兜底（`ui-sheet.requestCloseFromParent`）。
- 其它内联/描边分支：`ui-toast` 的 `ui-toast__accent`、`ui-selector`/`ui-date-picker` 的 `is-inline` 与固定高度弹层、
  `ui-loading` 与工作流原生 spinner 的 SVG 回退、`runtimePressedFeedbackCompatibility`（含 `calendar-cell` 属性）。
- `calendar-period-pager`：`mergeCalendarPeriodScrollMetrics`、`nearestCalendarPeriodScrollSlot`、
  `createCalendarPeriodPaneId`、`measureCalendarPeriodPaneWidth` 及 `*_SETTLE_MS`/`PROGRAMMATIC_FALLBACK_MS`/`HEIGHT_TRANSITION` 常量。
- 配置与资源：`src/app.json` 的 `rendererOptions.skyline`、`build-tools.mjs` 的 Skyline 选项校验、
  `assets/icons/ui-loading-primary.svg`、`assets/icons/ui-loading-muted.svg`。

删除方式：脚本按"选择器/行级"机械匹配 + 逐文件人工复核；WXSS 首轮曾把多行选择器合并成一行，已用从 `HEAD` 重新推导的方式
修订（`git diff -- '*.wxss'` 现为纯删除 129 行、0 新增）。

## 验证（本仓库自动化，均在本轮工作树内执行）

| 门禁 | 结果 |
| ---- | ---- |
| `pnpm --filter @schedule/miniprogram typecheck` | 通过 |
| `pnpm --filter @schedule/miniprogram test` | **1205 通过 / 16 跳过**（删除 19 项已失效的兼容契约断言：16 + 2 + 1 变体） |
| `pnpm --filter @schedule/miniprogram check:package` | 总 **4614093 B**；主包 **1737017 B**（基线 4653854 B → **−39761 B**） |
| `pnpm --filter @schedule/miniprogram check:determinism` | 通过，manifest `743c22d2b1c81e2e73bbab4b49e18b01d8cbac52bfc2f74f04675995bc4cb865` |
| `pnpm format:check` / `pnpm lint` / `pnpm smoke:check-core` | 通过 |

未验证（不得当作通过）：小米 14 真机的日历、换班/请假选择器、页头与详情卡排版；模拟器与自动化结果不能代替真机验收。

## 保留项（本轮不动，需单独审计）

`pages/gesture-probe`、`pages/calendar-poc`、`pages/manual-matrix-poc` 三个诊断/PoC 页面仍在主包注册，
其中 `wx.worklet` / `worklet:ongesture` 在 WebView 下不会执行。删除已发布页面是产品可见变更，
需要单独确认这些页面的入口是否仍在使用，再决定是否移除。

## 回滚

回滚 = `git revert` 本批次提交（恢复兼容层）并把 `renderer` 与页面 JSON 改回 `skyline`。
**不要**只改 `renderer` 就当作回滚：兼容层已不存在，Skyline 下会缺少已修复的布局分支。
