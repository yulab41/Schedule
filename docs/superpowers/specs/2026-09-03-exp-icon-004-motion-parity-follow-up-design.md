# EXP-ICON-004-B1.1 日历与人员图标动效一致性修复设计

## 背景与结论

用户在 Xiaomi 14 体验版 `0.1.0-p10.20260903.81` 指出：日历动效图标和通讯录人员模式按钮与 Web
不一致。静态追踪、`git log -S`、`git blame` 和现有测试复核表明，这不是 path 被重新临摹，而是平台适配层
遗漏了视觉规格：

- 日历：Web 只在日历工作区激活时循环播放 `navigation` motion；小程序除循环外还保留了一个 Web 不存在的
  420ms 点击弹跳，并用 `scaleX(.35)` 模拟 Web 的 `stroke-dashoffset` 描边绘制。小程序的日历外链 SVG
  还固定为 primary 色，未激活态无法继承 Web 的 secondary 色。
- 人员：Web 与小程序的 520ms、easing、位移、触发目的状态和循环次数已经一致；实际观感差异来自生成资产
  使用 catalog 默认 `stroke-width="2"`，而 Web 模式按钮为 `1.8`，以及小程序未选中资产使用
  `textMuted #6B7785`，Web 使用 `#586678`。
- 现有 parity contract 只验证来源、资产和 selector 存在，未验证 stroke、颜色、关键帧数值和触发排他性，
  因而未能阻止本次回归。

## 视觉真值与不变量

1. `packages/ui-icons/src/catalog.ts` 继续是图形几何唯一来源，不修改日历或人员 path。
2. `packages/ui-icons/src/motion.ts` 继续是 duration、easing、iteration 和关键帧数值唯一规格；平台层不得另创
   点击弹跳或不同位移。
3. `packages/ui-tokens` 增加通讯录模式按钮未选中色语义 token；Web CSS、小程序 CSS 和生成资产消费同一值。
4. 小程序资产 manifest 允许对同一几何声明渲染所需的 `strokeWidth`，以匹配具体 Web 组件规格；override
   属于渲染元数据，不复制 path。
5. 日历只在 `activeWorkspace === 'calendar'` 时循环；重复点击已激活日历仍只执行原有滚动复位，不另播动效。
6. 人员动效只在切换进入 employee 模式时播放一次；重复点击已激活模式不重播。
7. 不改变 API、路由、权限、数据结构、异步错误路径、业务状态或分包边界。

## 平台渲染适配

### 日历

Web SVG DOM 可以选中 `[data-part='check']` 并执行 `stroke-dashoffset: 1 → 0 → 1`。小程序通过
`<image>` 加载外部 SVG，页面 WXSS 不能可靠选中 SVG 内部 path；当前仓库又禁止在未取得原生能力证据前引入
Canvas、逐帧 `setData` 或页面私有 inline SVG。

因此本轮采用保守兼容层：

- 保留真实 calendar-base/calendar-check 几何和 Web 的 `1800ms ease-in-out infinite`、active-only 触发；
- check 外层只复现 canonical opacity `0.3 → 1 → 0.3`，删除会改变几何宽度的 `scaleX`；
- 删除小程序独有的 420ms 点击弹跳及对应状态；
- 生成 primary/secondary 两套同源色彩资产，未激活态使用 `textSecondary`；
- 将内部 dash 绘制明确标记为小程序外链 SVG 的兼容限制，交由 Xiaomi 14 观察透明度循环是否达到可接受一致性，
  不虚构“完全等同”。

### 通讯录人员模式

- 继续叠放 `people-primary` 与 `people-secondary` 两个同 viewBox 的同源 part asset；
- 两层资产都生成 `stroke-width="1.8"`；
- 未选中态使用共享 `directoryModeInactive #586678`，选中态继续使用 primary；
- 保持 `520ms cubic-bezier(0.2, 0, 0, 1)`、46% 时 `-0.75px/+1px` 和 destination-only 触发不变。

## 回归契约

先在旧实现上建立会失败的精确测试，再实施修改。测试必须同时验证：

- 日历不存在 `calendarNavAnimating`、`click-nav-calendar` 或 `scaleX` 兼容关键帧；
- 日历 active-only、1800ms、ease-in-out、infinite 和 0.3/1/0.3 opacity 与 shared motion 一致；
- 日历 primary/secondary 资产均来自相同 catalog source；
- 人员资产 linecap、linejoin、viewBox、path、`stroke-width="1.8"` 与未选中语义色正确；
- 人员 Mini 关键帧与 `iconMotionSpecs.people` 的 duration/easing/offset/位移一致；
- 不出现 Canvas、计时器驱动逐帧渲染或页面私有几何。

## 验收与停止条件

- 自动化：共享包、Web、Mini 的定向测试和类型检查通过；Mini 全量测试、production build、source/package/
  performance/determinism/verify 通过；`smoke:check-core`、格式和 diff 门禁通过。
- 包体：总包相对 B1 候选增量不超过 16 KiB；生成资产增量不超过 8 KiB；超过即停止并重新设计。
- 真机：必须在与修复 commit 匹配的新体验版上确认日历激活/未激活/重复点击、人员切换/重复点击、颜色、线宽、
  动效节奏与 reduced-motion。自动化结果不能写成 Xiaomi 14 已通过。
- 本轮只形成修复 checkpoint 并推送调查分支；没有新的精确候选批准时不上传体验版，不提交审核、不正式发布、
  不连接或部署 production。
