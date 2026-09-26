# 日历定位按钮位置统一（首页 / 访客：月 · 周 · 列表）

日期：2026-09-26
代码检查点：`287691ff9138d2415ec5bccf451ac2e01ced34ee`
体验版：`0.1.0-p10.20260926.201`（Manifest `72e7f32900c6f1550514d82300983bf5d39e24667748868f05783ccad9439060`）

## 用户范围

- 日历首页的定位按钮在月视图与周视图位置不一致，**周视图偏左**，以月视图的位置为准。
- 首页、访客等所有页面设计的定位按钮都要检查并统一。
- 只改这一件事，禁止改动其他无关内容；修改后直接提交并放行。

## 事实与基线（先测量）

同一个“定位到今天”准星在两套实现里各写了一份按钮盒：

- 参考实现＝共享组件 `components/calendar/calendar-month`（首页/访客月视图，补录与手排预览也复用它）：`.locate-button { width: 40px; height: 44px; flex: none }`（引入点 `1f715c96`）。16px 准星在盒内居中，距卡片右内边 20px，即距卡片右外沿 71px。
- 首页/访客的周视图与列表视图是页面内联工具栏：`.calendar-step, .calendar-locator { width: 44px; … }` 加 `.calendar-locator { margin-left: 4px }`（引入点 `ad4cfb2c`，`50c6d1ed`、`3fc41610` 后续保留）。准星距盒右内边 22px → 比月视图偏左 2px。

两条独立测量都指向同一个 2px：

1. `.198` production 构建 + 真实排班 + 开发者工具模拟器截图（`runtime/audit/week-arc-20260925/devtools-month-home.png` 与 `fixed-home-left.png`）：月视图准星 x=[433..453]（中心 443），周视图 x=[430..450]（中心 440）；左右换期 chevron 两次完全一致（中心 59 / 503.5）。即周视图准星偏左 3 图像像素 ≈ 2 CSS px。
2. 真实 WXSS 无头几何复现（390px，`runtime/audit/locate-align-20260926/measure-toolbar.mjs`）：月卡片准星中心距卡片右外沿 **70.00px**，修复前周视图 **72.00px**，列表视图 26.00px（列表槽位不同，见下）。

## 修改

`apps/miniprogram/src/pages/workbench/index.wxss`：

```diff
 .calendar-locator {
-  width: 44px;
-  margin-left: 4px;
+  width: 40px;
   color: var(--ui-color-primary);
 }
```

行为变化清单（逐条）：

- 首页与访客页周视图、列表视图的定位按钮盒由 44px 改为 40px（与月视图参考盒一致），准星因此右移 2px 到与月视图完全相同的位置；按钮右沿位置不变（仍在换期 chevron 左侧、距卡片右内边 50px）。
- `margin-left: 4px` 删除。该值在 `flex: 1` 的标题旁不发生布局作用，删除只为让盒子与月视图参考完全一致。
- `.calendar-step`（上一期/下一期）、`.calendar-heading`、`.list-calendar-heading`、按压/hover 时间、定位动效、`handleLocateToday` 与列表 `scroll-into-view` 定位路径均未改动。
- 列表视图仍按 Web 金标准把定位按钮放在工具栏最右槽位（与 `apps/web/src/views/calendar/CalendarView.vue` 的 `list-month-bar` 一致）：本轮只统一按钮盒，不搬迁槽位。
- 访客页不单独定义定位按钮：`pages/guest/guest.wxss` 以 `@import '../workbench/index.wxss'` 复用同一套规则，`guest.wxml` 使用同一段 `.calendar-locator` 结构，因此同批生效。

## 验证

- 测试先行：`apps/miniprogram/scripts/workbench.test.mjs` 新增“月/周/列表共用同一个定位按钮盒”断言，旧实现 1 failed（`44px` ≠ `40px`），修复后该文件 27 passed。
- Mini 全量：`183 passed | 2 skipped`（`1282 passed | 18 skipped`），比上一轮多 1 项即本轮新增断言。
- `pnpm --filter @schedule/miniprogram verify`（production）：通过，总包 4,817,890 B、manifest `40f35b70e93f890d6adfd88d020ae67a9f03e778867962f0ce9ad766a679025a`。
- `pnpm typecheck`、`pnpm lint`、`prettier --check`（改动文件）、`pnpm icon:parity:check`（errors 为空）、`pnpm smoke:check-core`（变更仅 2 个小程序文件，未触及核心链路）均通过。
- 开发者工具（Agent 操作；`.201` production 版本绑定构建、真实排班、390px 模拟器、WebView 渲染器）：同名准星 `boundingClientRect` 月视图 left=299.6 / 周视图 left=299.6（卡片右沿均为 378.4，距右外沿 70.8），两侧换期 chevron 同样为 left=339.6 与 30.8；列表视图准星 left=343.6（最右槽位 26.8）。视图切换由 `handleViewChange` 程序化触发，因为本轮模拟器元素 tap 未改变视图。
- 证据层级声明：无头几何复现＝Node/浏览器代理；`boundingClientRect`＝Agent 操作的开发者工具；`runtime/` 下截图与脚本为 ignored 证据。**以上都不是实体设备验收。**

## 未验证

- 访客页的模拟器实测：需要有效访客链接，本轮未取；由共享 `@import` 样式与同结构模板断言覆盖。
- 模拟器截图接口本轮只返回 35×75，无法出图，几何结论取自上表 `boundingClientRect`。
- 小米 14 同构建 `trial` 未验证：需用户用 `.201@287691ff` 复核首页/访客的月、周、列表定位按钮位置是否一致。

## 交付

- 检查点 `287691ff`（`fix(miniprogram): align the locate button with the month toolbar`）已推送 `main`。
- 体验版 `0.1.0-p10.20260926.201`：239 个代码文件、ZIP 2,703,186 B、description `align locate button 287691f`、production/clean、manifest `72e7f329…9060`；远端不可变 tag、allocation、manifest 与 receipt 绑定同一 SHA。
- 放行：可信 add-only `schedule-client-version-allowlist ensure 0.1.0-p10.20260926.201` 只追加 `.201` 并保留 `.200`（内部健康与七维能力策略验证通过），独立 `verify`、完整 `ecs-verify.sh`（live release 仍 `833a11e4`、schema 64 未变）、公网探针 `.201=200`、`.200=200`、未知版本 `=426` 均通过。
- 本轮为小程序 + 文档范围：未部署生产应用、未备份或迁移生产数据库、未提交审核、未正式发布、未退役旧版本。
