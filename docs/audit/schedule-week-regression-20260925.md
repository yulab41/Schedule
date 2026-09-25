# 周视图回归修复记录：2026-09-25

## 根因

- `git log -S 'calendarWeekPanelHeight'` 与 `git blame` 定位到 `e8286722`：首页 `pages/workbench/index.wxml` 从内联周格切换为 `calendar-week-panel`，`workbench-model.ts` 复用新的高度和排序模型，`index.ts` 移除首页原有的 `+20` 布局补偿。
- 新组件的周格底部留白为 `padding-bottom:24px`，选中框使用 `box-shadow` 且没有继承底角圆弧；补录周格把所有 `date < today` 映射为 `is-past`，而补录月历实际使用未来/今天禁用灰底、过去日期白底的规则。

## 修复

- 首页页面、首页视图模型和首页事件处理恢复到 `aef86299`；首页没有继续使用新的共用周组件。
- 补录/预览共用周格保留班种分组和顺序，但将高度基线恢复为实际内容高度，390px 按三字估算、320px 及以下按两字估算；选中框继承首尾底角圆弧。
- 补录周格不再把过去日期标为灰色；未来和跨月不可补录日期使用 `is-future` 灰底，过去已读取日期保持白底。预览的已有排班仍由 comparison class 灰显，本次预览保留班种色。

## 验证

- 回归用例先失败后通过：相关 Mini 定向测试 `103 passed / 1 skipped`，新增浏览器几何测试覆盖 390px/320px、高度无溢出、底部留白和底角圆弧。
- Mini 全量：`1280 passed / 18 skipped`；根全量：`1306 passed / 451 skipped`。
- `pnpm --filter @schedule/miniprogram verify` 通过；生产包 `4,817,496 B`，manifest `7882e6c9c0b522a559aeb68fc24cb2eb75821b24540dac67a319800e66aca2f0`。
- 开发者工具 `compile_wxml`/`compile_wxss` 通过：首页 WXML、周格 WXML/WXSS。首页模拟器停在“正在读取排班”，没有真实排班数据，不能作为视觉通过证据；小米 14 未验证。

## 发布状态

当前修复尚未上传、放行或部署；上一体验版 `.197@ad6c09fe` 不包含本轮修复。
