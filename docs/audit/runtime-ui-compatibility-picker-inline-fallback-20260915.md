# Skyline 3.17.2 选择器就地展开后备（2026-09-15）

## 结论与范围

用户在同版本小米 14 双实例复核体验版 `.138@09c100d` 后报告：3.17.2 实例的班次/人员下拉
已经能渲染出选项，但被后面的字段遮挡；月份/日期选择面板点按后仍不出现；3.17.3 实例正常。

| 现象 | 观察 | 归因 |
| ---- | ---- | ---- |
| 下拉选项被遮挡 | 选项文字出现在后续字段之下 | 3.17.2 不用 `z-index` 提升同级浮层 |
| 月份/日期面板不出现 | 点按后无面板 | `.138` 的“sheet 插槽内 root-portal 提升”在 3.17.2 未生效 |

`.138` 的显式高度修复本身是有效的：下拉高度不再塌成内边距，选项已经渲染出来。本轮只处理这两项
剩余差异，不修改数据、接口、权限、校验或工作流状态机，也不改变 3.17.3 与未知版本的渲染路径。

## 归因证据

- 遮挡：`.workflow-picker-selector-popover` 自 `6d0575d0` 起是 `position: absolute; z-index: 30`
  且 `left/right: 0`，`.workflow-picker-root.is-open` 也设同一 `z-index: 30`；`.136` 已记录
  3.17.2 “同层 `z-index` 不能解决真机遮挡”，本轮截图正是同一表现：后出现的字段按 DOM 顺序
  压在浮层之上。
- 面板：`.138` 把 `.workflow-picker-layer` 包进 `<root-portal enable="{{skyline3172UiCompatibility}}">`
  并加了根层令牌作用域。冻结产物逐项核对无误——`dist/components/ui/ui-date-picker/index.wxml`
  含该 `root-portal`，`index.wxss` 保留 `@import '../../../styles/ui-root-portal-tokens.wxss'`，
  `dist/styles/ui-root-portal-tokens.wxss` 提供 `--ui-z-index-dialog: 1000`。同一机制在页面级
  （群组菜单）与组件级（`ui-toast`）都被真机验证可用，唯独从 `ui-sheet` 插槽内容提升时不生效，
  因此不再继续押注 portal，也不再用“再加一层 `z-index`”掩盖。

## 实现（仅 3.17.2 生效，全部改为就地展开）

1. 下拉：`components/ui/ui-selector/options.wxml` 在下拉容器上追加
   `{{skyline3172UiCompatibility ? 'is-inline' : ''}}`，并把遮罩改为
   `wx:if="{{open && !skyline3172UiCompatibility}}"`；`index.wxss` 新增
   `.workflow-picker-selector-popover.is-inline { position: static; top/right/left: auto; margin-top: 6px }`，
   并让 `.is-inline` 覆盖 `.is-measuring` 的 `visibility: hidden` 与入场动画，避免测量回调缺失时
   选项不可见。选项数量推导的显式高度保留；`ui-selector` 与 `ui-date-picker` 都把
   `skyline3172UiCompatibility` 传入共享模板。
2. 月份/日期：`components/ui/ui-date-picker/index.wxml` 撤销 `.138` 的 `root-portal` 包装，恢复
   单层 `<view class="workflow-picker-layer {{skyline3172UiCompatibility ? 'is-inline' : ''}}">`，
   面板同样追加 `is-inline`；遮罩与拖拽把手在 3.17.2 下不渲染（`wx:if="{{!skyline3172UiCompatibility}}"`）。
   `index.wxss` 删除根层令牌导入，并新增 `.workflow-picker-layer.is-inline { position: static;
   z-index: auto; margin-top: 6px }` 与 `.workflow-picker-sheet.is-inline { position: static;
   max-height: none; border-radius: 18px; box-shadow: 0 6px 18px rgba(22, 32, 42, 0.08) }`。
3. 其余版本（3.17.3、后续版本、无法读取版本）继续使用原 `position: fixed` 覆盖层、原遮罩、
   原拖拽把手与原几何，源码结构与 `.136` 逐字相同，`is-inline` 类只在判定为真时出现。

## RED / GREEN 与语义边界

- RED：在 `.138` 基线上，兼容套件新增的 2 项断言准确失败（就地展开类与就地卡片规则）。
- GREEN：兼容套件 14 项通过；Mini 完整 174 文件 1203 项通过、16 项跳过。
  既有源码契约断言 `scripts/p7-native-feedback.test.mjs` 中“自绘面板存在”一项，随标记变化改为
  匹配 `class="workflow-picker-sheet ` 前缀，仍验证自绘面板存在，不掩盖任何行为回归。
- 门禁：`tsc --noEmit`、production build（366 文件）、source audit、package audit、determinism
  （manifest `7962c232…e4d8a`）、`pnpm format:check`、`pnpm lint`、`pnpm smoke:check-core` 通过。
- 包体：主包 1,739,791 B、总包 4,607,445 B；相对 `.138`（1,739,147 / 4,606,801 B）增加 644 B
  （约 0.014%），无新增依赖、无新增构建文件。
- 行为变化清单：3.17.2 下拉由浮层改为就地展开（位置与遮挡改变，显示内容与选中事件不变）；
  3.17.2 月份/日期面板由覆盖层改为就地卡片（入口、选项、确认/取消事件与数值语义不变，遮罩与
  拖拽把手不再渲染）；3.17.3 与未知版本的 DOM、定位方式、遮罩、几何与令牌全部保持原样；
  未修改轮播、滚轮、分页状态机、数据或接口。

## 验收边界

未调用微信开发者工具，也没有新的真机证据。就地展开是否在 3.17.2 真机可见、WXS 年月滚轮在
就地卡片中的触摸响应、选项与面板的可点按性，以及 3.17.3 外观不变，仍须由下一版体验版的同一
小米 14 双实例复核；自动化结果不构成原生验收。本轮未上传、未放行、未部署生产应用。
