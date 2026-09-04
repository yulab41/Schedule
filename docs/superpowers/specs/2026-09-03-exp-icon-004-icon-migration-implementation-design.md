# EXP-ICON-004 图标同源迁移实施设计

## 设计目标

Web 与微信小程序不再各自维护“相似图标”。同一个产品语义只有一份几何、来源、许可证和 motion
specification；平台代码只负责把这份视觉数据渲染到 SVG DOM 或小程序静态资源。

本设计沿用当前 Web 已验收的 path，不重新临摹，不引入新的图标运行时，不改变业务交互。

## 边界与不变量

1. `packages/ui-icons/src/catalog.ts` 是 path/circle/rect/group、viewBox、stroke、fill rule、来源和许可证的唯一来源。
2. `packages/ui-icons/src/motion.ts` 是 duration、delay、easing、iteration、direction、fill mode、关键帧和 reduced-motion 规则的唯一规格。
3. `packages/ui-tokens` 是颜色角色来源；小程序颜色变化只能选择同一 sourceKey 的 token variant。
4. Web 只能经 `SharedIcon.vue`/`SharedIconPart.vue` 消费 catalog；业务 Web 组件保留原有 props、事件和触发条件。
5. 小程序只能消费生成的 `apps/miniprogram/src/assets/icons/ui-*.svg`；生成器可清理自己生成但已从 manifest 移除的文件。
6. 禁止把 Web 的 React、DOM、`:deep`、浏览器 selector、WebView 或 CSS runtime 直接放入小程序。
7. 任何 path 变化必须先更新 sourceRef/sourceSha 和 parity contract；任何 motion 数值变化必须先更新 motion spec 和对应测试。
8. 本批不修改 API、数据结构、权限、路由、分包策略和业务状态。

## 组件边界

```text
catalog.ts / motion.ts / types.ts
          │
          ├── Web: SharedIcon → SharedIconPart → SVG DOM + data-part CSS adapter
          │
          └── Mini: generate-miniprogram-assets.mjs → ui-*.svg → WXML image/wrapper adapter
```

`SharedIcon` 负责 root viewBox 和 stroke metadata，`SharedIconPart` 只负责递归绘制节点；二者不
包含页面状态和动画触发。`WorkbenchNavIcon`、`LucideMinimalActionIcon`、页面按钮和小程序页面
仍负责状态/事件，但不保存第二份 path。

## 几何数据模型

- `IconDefinition`：`key`、`aliases`、`viewBox`、`nodes`、`strokeWidth`、`lineCap`、`lineJoin`、
  `sourceRef`、`licenseRef`、`sourceSha`。
- `IconNode`：只允许 `path`、`circle`、`rect`、`group`；动画对象通过 `part` 标识，不把平台 class
  写入几何数据。
- `MiniAssetEntry`：`fileKey`、`sourceKey`、`colorRole`；用于生成 primary/secondary/muted/success/
  favorite variants 和 filter part assets。
- 生成 SVG 保留 `sourceSha` 与 nodes content hash，保证从资产可以回溯 catalog revision；hash 不参与运行时逻辑。

## 动效适配

Web 直接对 `data-part` group/path 应用 catalog 中同名 motion 的关键帧。Mini 外部 `<image>` 无法
可靠选择内部 path，因此按能力分层：

- filter：三个同源 part asset 叠放，分别应用原 bar keyframe。
- calendar draw：check asset 使用外层兼容动画；保留 duration/easing，dash 细节受 image 限制。
- phone/bell/profile/department/people：使用 image 或 wrapper；不得新增一套关键帧数值。
- navigation/more：小程序只在 active workspace 触发，more 使用 1800ms、100/200ms stagger，与 Web active loop 对齐。
- reduced-motion：Web `prefers-reduced-motion` 和小程序对应规则均关闭兼容动画；不关闭业务事件。

## 实施验收

- 先红：`icon-parity-contract.test.mjs` 必须在旧实现上检测不到 catalog、adapter 和 semantic assets。
- 绿：Web/Mini TypeScript、相关 Web tests、Mini 全量 scripts tests、Web build、Mini production build、
  source/package/performance/determinism/verify、Prettier、ESLint 和 `git diff --check` 通过。
- 包体：总包相对基线增量 ≤64 KiB；generated icon 静态资产增量 ≤24 KiB；若超过预算，先减少非首屏 variant，
  不复制页面私有图标。
- 运行证据：`pnpm smoke:browser` 必须执行；没有 API 服务时如实记录失败，不能用静态结果替代。核心链路改动必须使
  `pnpm smoke:check-core` 通过。
- 真机：候选版本必须在 Xiaomi 14 Android 微信体验版确认图形、颜色、动效、安全区和 reduced-motion；本批不声称 iOS 或全平台通过。
