# EXP-ICON-004 图标与图标动效单一来源设计

## 设计状态

- 日期：2026-09-02
- 基线：`origin/main@359966f7240d2f557b24dd0c1ac61979d6bb8298`
- 设计对象：Web 生产 UI 与微信小程序生产 UI 的图标几何、语义 token、动效规格和平台渲染适配
- 本轮决策：只审计和设计；不修改生产 icon consumer，不上传体验版，不部署 production
- 完整证据：[`docs/audit/exp-icon-004-icon-parity-audit.md`](../../audit/exp-icon-004-icon-parity-audit.md)

## 1. 背景与问题定义

目前 Web 与小程序的图标并非两套完全独立的视觉语言；很多 path 已经相同，例如 TDesign 的
`Search`、`Filter`、`Close`、`History`、`Star`、`Call`、`User`，以及 Web Workbench 的 calendar/swap/duty
等局部几何。但这些 path 被分别写在 Vue inline SVG、TDesign component、Mini SVG 文件和 CSS/WXML shape 中。
因此“文件看起来接近”不能证明“来源相同”，也不能保证 stroke、cap、颜色、size、actor 组合和动效触发一致。

动效有同样的问题：Web 以 Vue `motionKey`/active state 驱动 CSS；小程序以 WXML class、WXSS keyframes、
controller boolean 和 timer 驱动 image wrapper。相同的 620ms/520ms 数字并不能让 `<image>` 内部 path
执行 Web 的 dash draw，也不能自动得到相同的 active-only loop 和 part delay。

设计目标是“共享视觉数据，平台适配渲染”，而不是共享平台代码：

1. 一份可追溯的 geometry/source catalog 是静态 SVG、Web inline SVG 和未来 Mini 产物的源。
2. 一份平台无关的 motion specification 是 Web CSS 和 Mini compatibility adapter 的源。
3. 颜色、尺寸和状态来自共享语义 token/context；不能把 Web `currentColor` 原样假定为 Mini image 能力。
4. 小程序只实现运行时兼容层，不重新设计关键帧，不引入动画 runtime 或逐帧 JS。
5. 旧资源在所有引用迁移、构建/包体/自动化/真机证据完成前保留，保证可回滚。

## 2. 非目标与硬约束

- 不在本轮批量改 Web 或 Mini 图标，不改页面路由、handler、API、数据库、业务语义和布局。
- 不把 React、Vue、DOM、TDesign component、浏览器 CSS selector 或 CSS animation runtime 放入共享包。
- 不把 Web Storybook 的 Ui2 草稿、PWA PNG、POC phone 或 status 文本 glyph 反向当作生产 source。
- 不因为“全量统一”删除 TDesign；TDesign 是 Web adapter/legacy source，逐项核对后再迁移。
- 不以 Mini 当前 `web-*` 文件名推断 Web source；每个 key 必须有 sourceRef/licenseRef/checksum。
- 不为内部 path animation 引入 canvas、大型依赖、逐帧 `setData`、WXS worklet 或新的网络资源。
- 不执行微信开发者工具 GUI/CLI，不上传体验版，不部署 production；真机要求只列验收清单。

## 3. Source catalog 设计

建议新增（下一实施批次，不是本轮已创建）的纯数据包：

```text
packages/ui-icons/
  src/catalog.ts
  src/geometry/workbench.ts
  src/geometry/actions.ts
  src/geometry/controls.ts
  src/motion/navigation.ts
  src/motion/actions.ts
  src/tokens.ts
  scripts/generate-miniprogram-assets.mjs
  tests/catalog.test.mjs
  tests/generated-assets.test.mjs
  docs/source-map.md
```

### 3.1 几何定义

每个 semantic key 由一个 definition 表示，建议字段如下：

```ts
type IconPart =
  | {
      kind: 'path';
      key: string;
      d: string;
      pathLength?: number;
      fill?: FillRole;
      stroke?: StrokeRole;
    }
  | {
      kind: 'circle';
      key: string;
      cx: number;
      cy: number;
      r: number;
      fill?: FillRole;
      stroke?: StrokeRole;
    }
  | {
      kind: 'rect';
      key: string;
      x: number;
      y: number;
      width: number;
      height: number;
      rx?: number;
      fill?: FillRole;
      stroke?: StrokeRole;
    };

type IconDefinition = {
  key: string;
  aliases: string[];
  viewBox: '0 0 24 24';
  parts: IconPart[];
  strokeWidth: number;
  lineCap: 'round' | 'square' | 'butt';
  lineJoin: 'round' | 'miter' | 'bevel';
  sourceRef: string;
  licenseRef: string;
  sourceSha: string;
  capabilities: { externalImageInternalPathAnimation: false };
};
```

实际 TypeScript 类型可按仓库 lint/编译约定调整，但语义不能丢失：原始 path 字符串、part key、viewBox、
stroke/fill、cap/join、来源、许可和 checksum 是审计字段，不是可选注释。数字精度和 path 顺序不应被格式化
工具偷偷改变。

首批 source map 以 Web 生产事实为准：`WorkbenchNavIcon.vue` 的 calendar/directory/groups/manual/backfill/
leave/duty/events/statistics/config/notifications/profile/swap/more 等 path；`LucideMinimalActionIcon.vue`
的 bell/filter/locate/department/people 与经核对的 TDesign path；TDesign direct imports 中的 controls、
history、stars、phone、lock 等。Mini 已 exact 的文件只能作为校验样本，不作为第二 source。

### 3.2 语义 token 与 context

`packages/ui-icons` 消费 `@schedule/ui-tokens` 的语义色，不复制颜色字面量。第一版可将已有 token 映射为：

| icon role       | 基础 token                                | 用途                                    |
| --------------- | ----------------------------------------- | --------------------------------------- |
| `iconPrimary`   | `primary`                                 | 主导航、主要动作                        |
| `iconSecondary` | `textSecondary` / 当前既有 secondary 语义 | 次级导航/工作区                         |
| `iconMuted`     | `textMuted`                               | 搜索、未选中、辅助                      |
| `iconSuccess`   | `success`                                 | 日历拨号等既有成功动作上下文            |
| `iconFavorite`  | `warning` 或现有 favorite 语义            | filled star；最终值需与产品 token 决定  |
| `iconDanger`    | `danger`                                  | 仅显式危险动作，不把文本 glyph 自动染色 |

size 不写在 geometry 内；由 `navigation`, `topAction`, `calendarControl`, `directoryControl`, `listAction`,
`identity` 等 context 提供 16/17/18/20/21/23/24px。这样同一个 `phone/call` path 可以按工作台绿色动作和
通讯录蓝色动作生成不同 semantic color，而不产生两份 path source。

## 4. Motion specification 设计

motion 是数据，不是 Web selector：

```ts
type MotionSpec = {
  key: string;
  trigger: 'activate' | 'click' | 'open' | 'toggle' | 'navigate';
  parts: Array<{
    partKey: string;
    keyframes: Array<{
      offset: number;
      transform?: string;
      opacity?: number;
      strokeDashoffset?: number;
    }>;
    delayMs?: number;
  }>;
  durationMs: number;
  easing: string;
  iterationCount: number | 'infinite';
  direction: 'normal' | 'reverse' | 'alternate';
  fillMode: 'none' | 'forwards' | 'both';
  reducedMotion: 'none' | 'opacity-only' | 'allow-press-feedback';
};
```

第一版的 canonical 数值必须从当前 Web 生产实现录入：bell 620ms、profile 480ms、filter/locate/people
520ms、department 500ms、phone/export 620ms、导航默认 1800ms infinite、more part delay 100/200ms、
GroupSwitcher fast 120ms。Mini 当前的 80/160ms more delay、常驻 calendar loop、CSS filter 13/8/4 bar 等
先作为差异记录，不能反过来覆盖 canonical spec。

trigger 是视觉语义，不是业务事件名。例如 `open-notification` 由 Web/Mini 页面各自绑定到现有打开通知
handler；shared package 不知道通知 API。`looping` 由 adapter 接收 active state，必须是 active-only；静态
页面图标不得因复用 component 而自动进入 infinite loop。

## 5. 平台适配器

### 5.1 Web adapter

- 保持 inline SVG，因其能继承 `currentColor`、CSS var，并选择内部 `data-part`。
- `WorkbenchNavIcon.vue` / `LucideMinimalActionIcon.vue` 以后读取 catalog definition 和 motion spec；保留
  当前 public prop/semantic interface，业务调用不改。
- CSS keyframes 可由 spec 生成或集中注册；不让每个组件复制一套数字。
- `motionKey`、`looping`、`previewMotion`、reduced-motion 仍是 adapter concern；shared package 只输出 spec。
- TDesign direct icon 在未迁移前继续工作。迁移某个 TDesign path 时，先做 source checksum 与截图/Storybook
  对照，再把 TDesign component 变成同一 catalog 的 Web backend；不强迫所有 TDesign 状态图标一次性替换。

### 5.2 Mini adapter

- 静态 icon 通过 generator 产出 token-colorized SVG，WXML 以 `<image>` 使用；不要在页面中复制 inline SVG
  或硬编码 `#1f5aa6`。
- 多 actor icon 由同一 source 的 parts 生成 actor assets，或由 adapter 组合少数已生成 parts；页面只传 key
  和 state。asset 是否放 main/subpackage 由 consumer graph 决定，不按源包根路径全部复制。
- `<image>` 不能让 WXSS 选择内部 path，也不能让 Web `currentColor` 穿透到 SVG 内容。因此对
  `strokeDashoffset` 只记录 unsupported capability；第一版 adapter 使用同一 spec 的 offset/easing 驱动
  支持的外层 transform/opacity，不能改写成另一组“更好看”的 keyframe。
- 不使用逐帧 JS/WXS、canvas 或新动画库。controller 只负责一次性 trigger、reset、detach/unload 清理；常驻
  active loop 由 WXSS 完成且只挂在可见 active actor。
- reduced motion 规则与 Web 分离实现，但读取同一 `reducedMotion` policy。微信版本/renderer 对媒体查询和
  image animation 的实际支持必须由 Xiaomi 14 体验版确认。

### 5.3 兼容性能力表

| 能力                      | Web                  | Mini image adapter       | 处理                         |
| ------------------------- | -------------------- | ------------------------ | ---------------------------- |
| path/circle/rect 静态几何 | 支持                 | 生成 SVG 支持            | 直接共享 definition          |
| semantic color            | currentColor/CSS var | 需生成颜色或外框层       | generator/context 适配       |
| part transform/opacity    | 支持内部 group       | 支持 actor image wrapper | 共享 spec，适配 target       |
| 内部 path dash draw       | 支持                 | 不可假定                 | 标 unsupported；不得伪称等价 |
| key remount/replay        | Vue key              | WXML boolean/timer       | adapter 处理生命周期         |
| reduced motion            | 浏览器媒体查询       | 需客户端确认             | 同 policy，分别验证          |
| static image cache        | 浏览器               | 小程序本地静态 asset     | consumer graph/包体控制      |

## 6. 迁移顺序与质量门

实施拆成 B0–B5，详见审计报告第 10 节和计划文件。原则是先有 source/checksum，再迁移最高频垂直链路：

1. B1 只建 catalog/generator/tests，生产视觉不变。
2. B2 迁移底部 nav + 顶部 bell/profile，验证 active-only 和 motion replay。
3. B3 迁移 calendar/directory actions，并把 org-only generated assets 从 main asset boundary 中分离。
4. B4 纠正“更多”入口的真实语义，不用相似 icon 填补尚未完成的业务功能。
5. B5 处理 identity/status/legacy CSS 和清理；最终才删除旧文件。

每批固定质量门：

- source path/license/checksum 可追溯；未知 source 不合并。
- 必须有旧实现失败、新实现通过的回归断言；不能用改测试掩盖。
- Mini build/source/package/performance 脚本通过；记录 main、分包、total 和最大文件。
- 触及 Web core icon consumer 时运行 `pnpm smoke:browser` 与提交前 `pnpm smoke:check-core`；本轮未触及，
  因此不运行浏览器 smoke。
- 不调用微信开发者工具，不上传，不部署；真实视觉/触摸/renderer 只能由同构建 Xiaomi 14 证据确认。

## 7. 关键设计决策与待批准项

### 已决定

- Web 生产 path/动效是第一 canonical 候选，因为用户目标是复用真实 Web 图形数据和规格。
- TDesign path 可以被核对后纳入 catalog，但 TDesign runtime 不进入 Mini。
- shared package 只放 pure data；平台 renderer 留在 apps 内。
- Mini 的 image 限制记录为 capability，而不是偷偷重新设计关键帧。
- 当前 Mini 主包 1,677,999B 已在 warning 区；第一至第三批只允许 main +4KiB、total +8KiB 的保守预算，
  并优先移动 organization-only generated assets。

### 实施前需确认

- `profile/user` 的 canonical cap 是 Web local round 还是 TDesign square；需要产品/视觉选择并更新 source map。
- `bell` 的 Workbench nav geometry 与 action bell 是否是两个 semantic variant；不可只按名称合并。
- `phone/call` 的绿色工作台与蓝色通讯录是否保留两个 color contexts；path 仍只保留一份。
- Mini 对外部 SVG 动效的真实表现，尤其 dash draw、reduced-motion、Skyline/WebView；没有真机证据不得标像素等价。
- `events` 当前小程序 handler 为 unavailable 的业务问题是否另立任务；icon batch 不得悄悄改变功能。
