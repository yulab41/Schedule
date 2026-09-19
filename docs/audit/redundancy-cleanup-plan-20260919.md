# 冗余清理方案：Skyline 属性、PoC 页面与夹具归属（2026-09-19）

## 背景

批次 1/2 把渲染器固定为 WebView 并删除兼容层后，还剩三类冗余：

1. `scroll-view type="list"`——Skyline 侧的性能提示属性，在 WebView 下被忽略，9 处调用点。
2. `pages/manual-matrix-poc/`、`pages/calendar-poc/` 两个开发期 PoC 页面仍在主包注册；
   它们的矩阵/月历能力已经进入生产页面（`subpackages/scheduling/pages/manual`、`components/calendar/calendar-month`）。
3. 生产资产与测试夹具放错位置：`matrix-gesture.wxs`（被生产页 import）放在 PoC 页目录；
   两个合成夹具放在 `src/testing/fixtures/`（属于 app 源码树）。

## Phase A：零功能变化的架构修正（本批次已执行）

- `matrix-gesture.wxs` 从 `src/pages/manual-matrix-poc/` 移到它唯一的消费者目录
  `src/subpackages/scheduling/pages/manual/matrix-gesture.wxs`，生产页 import 改为 `./matrix-gesture.wxs`；
  PoC 页（若保留）改为跨目录相对路径。测试/性能脚本引用同步更新。
- 9 处 `scroll-view type="list"` 全部删除（WebView 下该属性被忽略，删除不改变滚动行为）。

## Phase B：删除两个 PoC 页面（本批次执行，含证据与门禁再安置）

删除前核对（证据）：

- 生产页 `subpackages/scheduling/pages/manual/index.wxml` **已经实现完整矩阵**（matrix-shell / 四层坐标 / WXS 归一入口），
  并使用同一套 `@schedule/presentation-core` 手动排班助手（`resolveManualCellMutation` / `resolveManualSelection` / `applyManualCellMutation`）；
  PoC 页是同一交互的**第二份合成实现**。生产页的交互/撤销行为由 `manual-schedule-page.test.mjs`、
  `feedback7-manual.test.mjs`、`feedback9-manual-calendar.test.mjs`、`manual-schedule-controller.test.mjs` 覆盖。
- `calendar-poc` 的页面代码是 `calendar-month` 组件的两层包装；`calendar-poc.test.mjs` 的 10 个用例里 7 个本来就在测
  **生产组件**（读 `components/calendar/calendar-month/*`），只有 3 个测 PoC 页与它的夹具。
  生产月环由 `src/features/workbench/workbench-model.ts` 的 `createMonthRing` 生成——夹具断言改为直接测它，覆盖面更强。
- 两个 PoC 页只从开发入口页 `pages/index/index`（人工测试入口卡片）链接，不在产品导航里；`更多 → 测试工具`
  只链接 `pages/gesture-probe`（保留）。

再安置方案：

| 原位置 | 处理 | 理由 |
| ------ | ---- | ---- |
| `pages/manual-matrix-poc/matrix-gesture.wxs` | **已移到生产页目录** | 它是生产代码 |
| `pages/manual-matrix-poc/index.{ts,wxml,wxss,json}` | 删除 | 与生产矩阵重复的合成实现 |
| `pages/calendar-poc/*` | 删除 | `calendar-month` 的包装页 |
| `src/testing/fixtures/manual-matrix-poc.ts` | 改为 `scripts/fixtures/manual-matrix.mjs`（纯 JS 单源） | 让普通 Node 性能脚本与测试共用同一份合成数据，且不再放进 app 源码树 |
| `src/testing/fixtures/calendar-poc.ts` | 删除 | 断言改测生产 `createMonthRing` |
| `scripts/manual-matrix-poc.test.mjs` | 改名 `matrix-gesture.test.mjs`，保留 WXS 行为与夹具上限用例，删除页面专用用例 | WXS 是生产代码，行为守卫必须留 |
| `scripts/calendar-poc.test.mjs` | 改名 `calendar-month.test.mjs`，删除 3 个 PoC 用例，保留组件/分页器用例 | 覆盖面不降 |
| `scripts/performance-budget.mjs` | 合成 20×30 数据改由 `scripts/fixtures/manual-matrix.mjs` 提供；结构预算只保留生产编辑器条目；`tapPatchPaths` 改为测共享变更契约的写入路径数 | 不再依赖已删除页面的编译产物 |
| `MAXIMUM_MATRIX_NODE_NO_GROWTH_CEILINGS` | 去掉 PoC 条目，生产编辑器上限保持原值 | 不放松门禁 |
| `src/app.json`、`src/pages/index/index.wxml`、`src/platform/telemetry.ts` | 删除页面注册、入口卡片链接、PoC 路由映射 | 去掉悬空引用 |
| `scripts/{identity-pages,foundation-components,manual-test-plan,p6-core-rc-plan,p6-telemetry,build-version-display,gesture-probe,manual-transition-core,manual-schedule-limits}.test.mjs` | 同步更新断言与引用 | 这些断言描述的是被删除的路由 |
| `apps/miniprogram/docs/runbooks/p6-core-rc.md` 等 RC 文档 | 人工验收步骤改指生产页 | 保留可执行的验收路径 |

## 执行结果（2026-09-19）

- 删除：`pages/manual-matrix-poc/**`（≈30 KB）、`pages/calendar-poc/**`（≈6 KB）、
  `src/testing/fixtures/manual-matrix-poc.ts`、`src/testing/fixtures/calendar-poc.ts`；
  `app.json` 路由、开发入口卡片三条链接、`telemetry.ts` 的 PoC 路由映射同步移除。
- 再安置：`matrix-gesture.wxs` → `subpackages/scheduling/pages/manual/matrix-gesture.wxs`（生产唯一消费者目录）；
  合成 7×7 / 20×30 数据 → `scripts/fixtures/manual-matrix.mjs`（普通 Node 与测试共用，不再放进 app 源码树）。
- 测试：`manual-matrix-poc.test.mjs` → `matrix-gesture.test.mjs`（保留 WXS 行为 + 夹具上限，删除 7 个页面专用用例）；
  `calendar-poc.test.mjs` → `calendar-month.test.mjs`（保留组件/分页器用例，删除 2 个 PoC 用例）。
  全量 Mini **1200 通过 / 16 跳过**（原 1209，减少的 9 个全部是被删页面的专用断言）。
- 门禁：typecheck、format、lint 通过；`check:performance` 通过（`maximumViewModelBytes=171340` 与基线一致、
  `desktopMatrixLogicMs=0.62`、`tapCellPaths=2`）；`check:package` 主包 **1,678,555 B**（原 1,733,863，**−55,308 B**）、
  总包 **4,562,801 B**（原 4,609,767，**−46,966 B**；`subpackages/scheduling` +8,300 B 是 WXS 迁入该分包所致）；
  determinism `1a594b01…`。
- 20×30 结构基线重定：1,506 → **1,507**（合成输入由已删页面数据改为新夹具，同一生产模板多渲染 1 个节点；
  该条目按 runbook 要求公开警告并冻结新基线，未放宽其他阈值）。
- 设备侧变化（需知悉）：`maximum-matrix-render` 与 `tap-feedback` 两条**手工性能标记随 PoC 页删除**；
  同一指标已由 `check:performance` 自动化覆盖（模型构造耗时、共享契约的点格写入路径数），RC 文档已同步标注。
- 真机复核项：主包变小后，需确认工作台/通讯录/我的/更多与手动排班矩阵在 WebView 下滚动与矩阵拖动仍正常。
