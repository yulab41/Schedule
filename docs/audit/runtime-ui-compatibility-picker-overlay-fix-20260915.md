# Skyline 3.17.2 选择器浮层与页头箭头修复（2026-09-15）

## 结论与范围

小米 14 的 3.17.2 实例复核 `.136@efda88f` 后确认三处现象，另有成员页面四项修复通过、
3.17.3 实例正常：

| 现象 | 观察 | 归因 |
| ---- | ---- | ---- |
| 页头群组箭头偏右 | 箭头与群名之间约 40px 空白，3.17.3 紧贴群名 | 本项目 `.136` 的 3.17.2 兼容规则 |
| 月份/日期选择器点按无反应 | 点“我的班次月份”后没有任何遮罩或面板 | 旧 Skyline 对 `scroll-view` 内 `position: fixed` 层的定位 |
| 班次/人员下拉只剩空框 | 触发器下方出现约 12px 高的白色空框 | 旧 Skyline 内嵌 `scroll-view` 不从内容推导高度 |

三处都不是微信基础库版本漂移造成的组件库差异：3.17.3 实例运行同一份构建时三项均正常，
且本轮全部 `is-skyline-3172-ui` 规则在此之前没有一条命中选择器组件。范围只包含显示与命中
区域，不改业务数据、接口、权限、校验或工作流状态机。

## 引入点与根因

- 箭头：`733e3af6` 引入 `.group-switcher-arrow { position: absolute; right: 5px }`，位置相对
  整个 `.group-switcher` 盒子；`47c294ba` 为 3.17.2 添加群组容器覆盖；
  `ed06031f` 把 `.group-switcher` 与触发器同时固定为 `width: 220px; max-width: none`。
  容器从 `fit-content` 变成确定 220px 后，绝对定位箭头随之贴到盒子右缘（约第 197px），
  而群名只占到约 156px，于是空出约 40px；3.17.3 没有这段覆盖，仍是 `fit-content`。
  以上由 `git log -S 'width: 220px'` 与 `git blame -L 1180,1194` 核对。
- 下拉弹层：`6d0575d0` 引入 `components/ui/ui-selector/options.wxml` 的
  `<scroll-view type="list" enhanced scroll-y>` 与 `.workflow-picker-selector-popover`
  （`position: absolute; z-index: 30; left/right: 0`，只有 `max-height: 300px`，没有高度）。
  3.17.2 不会为这个位于另一滚动容器内部的滚动容器按内容推导高度，弹层塌成 6px 上下内边距，
  真机因此只显示约 12px 的白色空框；3.17.3 按内容高度渲染，行为不变。
- 月份/日期面板：`.workflow-picker-layer { position: fixed; inset: 0;
  z-index: var(--ui-z-index-dialog) }` 自 `bc32a4f1` 的 `workflow-picker` 组件起存在，并由
  `528722f4` 迁移到 `components/ui/ui-date-picker`。它渲染在 `ui-sheet` 的
  `scroll-view` 内容内部；3.17.2 下该固定层没有按视口定位，面板落在不可见区域，点按看似
  “完全没有反应”。同页的 `ui-sheet` 本身不在滚动容器内，因此仍然正常显示。

## 实现

1. 页头箭头（仅 3.17.2）：`.is-skyline-3172-ui .group-switcher-trigger { padding-right: 0 }`
   取消为绝对定位箭头预留的 24px 槽，`.is-skyline-3172-ui .group-switcher-arrow
   { position: static; top: auto; right: auto; margin-left: 2px; flex: none }` 让箭头在
   Flex 流内紧跟群名。220px 宽度上限与 `.group-switcher-copy { max-width: calc(100% - 24px) }`
   （196px）逐字保留，群名省略阈值、展开箭头旋转、按压类和点击事件都不变。
2. 下拉弹层（仅 3.17.2）：`selector.ts` 新增 `createSelectorPopoverStyle(optionCount, compatibility)`，
   按 `30 × 选项数 + 10` 给出显式高度，空态 56px，上限 300px（与原 `max-height` 一致）；
   非 3.17.2 返回空串，保持内容自适应。`ui-selector` 与 `ui-date-picker` 在打开以及
   `options` 变化时写入 `popoverStyle`，共享模板 `options.wxml` 绑定 `style`。
3. 对话框根层（仅 3.17.2 提升）：`.workflow-picker-layer` 外层改为
   `<root-portal wx:if="{{open && mode !== 'selector'}}" enable="{{skyline3172UiCompatibility}}">`，
   层节点增加 `ui-root-portal-token-scope`，`ui-date-picker/index.wxss` 新增
   `@import '../../../styles/ui-root-portal-tokens.wxss'`（构建期由 `tokens.wxss` 按
   `page` → `.ui-root-portal-token-scope` 生成；根层节点不再继承页面级令牌）。
   3.17.3 与无法读取版本 `enable=false`，仍在原位置渲染，几何、层级与 `z-index: 1000` 不变。

## RED / GREEN 与语义边界

- RED：新增 3 项在旧实现上准确失败（箭头流内规则、弹层显式高度、根层包装），
  兼容套件 14 项中 11 通过、3 失败。
- GREEN：兼容套件 14 项通过；Mini 完整 174 文件 1203 项通过、16 项跳过；
  根套件 270 文件 1273 项通过、444 项跳过。
- 门禁：`tsc --noEmit`、production build（366 文件）、source audit、package audit、
  determinism、`pnpm format:check`、`pnpm lint`、`pnpm smoke:check-core` 通过。
- 包体：主包 1,739,147 B、总包 4,606,801 B；相对访客修复基线（1,737,064 / 4,604,718 B）
  增加 2,083 B，其中约 508 B 来自弹层块缩进，无新增依赖、无新增构建文件。
- 行为变化清单：3.17.2 下箭头由绝对定位改为流内（位置改变，事件与旋转不变）；
  3.17.2 下弹层新增显式高度（其余样式与命中行为不变）；3.17.2 下对话框层提升到根层并
  多一个令牌作用域类名；3.17.3 与未知版本的 `popoverStyle` 为空串、`enable=false`、
  箭头与触发器原规则不动，数值和几何逐字保持。

## 验收边界

未调用微信开发者工具，没有新的真机证据。`root-portal` 的原生合成、WXS 年月滚轮在根层的
触摸响应、弹层选项在真机上的实际可见高度，以及 3.17.3 的箭头与四类选择器不变，都只能由
下一版体验版的同一小米 14 双实例复核；自动化结果不构成原生验收。
本轮未上传、未放行、未部署生产应用、未修改数据库。
