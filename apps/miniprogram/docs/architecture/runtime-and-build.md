# 原生运行时与构建

## 运行时基线

| 项目           | 决策                                                                         |
| -------------- | ---------------------------------------------------------------------------- |
| 模板/样式/逻辑 | WXML、WXSS、TypeScript、JSON                                                 |
| 渲染           | 所有页面 Skyline                                                             |
| 组件框架       | `glass-easel`                                                                |
| 最低基础库     | `3.3.0`                                                                      |
| 回退           | 不提供 WebView 回退                                                          |
| Skyline 发布   | `disableABTest: true`，`sdkVersionBegin: 3.3.0`，`sdkVersionEnd: 15.255.255` |

`project.config.json` 的 `miniprogramRoot` 固定为 `dist/`。正式发布前将实际 Stable 编译基础库和微信客户端范围记录进 release 证据。

## 构建形态

源码位于 `src/`，构建产物位于 ignored `dist/`。P1 工具链必须提供：

1. 确定性复制 WXML、WXSS、JSON、字体和图像等静态文件。
2. 用 esbuild 打包普通共享 TypeScript；不得把 workspace symlink 留入产物。
3. 对包含 Worklet 的模块使用能够原样保留函数指令的编译路径。
4. 独立执行 `tsc --noEmit`，不得依赖已生成的共享包 `dist` 才能完成类型检查。
5. 构建后扫描 Worklet，验证 `'worklet'` 仍为函数第一条语句。
6. 扫描 Node built-in、DOM、数据库包、Zod、密钥、绝对本机路径和 source map 泄漏。
7. 对相同输入连续构建两次，以文件清单和 SHA‑256 证明确定性。
8. 审计主包、单分包和总包体积。

## 环境隔离

- staging 与 production 是两个编译期 profile，应用中没有隐藏环境切换入口。
- base URL 只能来自受审构建配置；AppSecret、Bearer、上传私钥和本地会话不得成为编译输入。
- CI 可以运行 build、simulate、包体和静态门禁；`miniprogram-ci` 可以生成预览/上传开发或体验版本。
- LLM 不得调用本地微信开发者工具 GUI 或 CLI。用户人工打开 GUI 只用于诊断，不构成自动验证链路。

## 当前 P0/P1 状态

- 外部 Skyline 模板已经过逐文件 SHA‑256 校验迁入。
- 正式 AppID 保留在 `project.config.json`；私有配置保留但被 Git 忽略。
- 默认模板首页和 navigation-bar 已移除，以无业务外观的技术 bootstrap 取代。
- `src → dist` 编译、源码/产物边界、包体、Worklet 指令、双构建确定性和无凭证 CI dry-run 门禁已完成。
- P1 基础控件批次新增从 `@schedule/ui-tokens` 单源生成并复制到 `dist/styles/tokens.wxss` 的路径；`app.wxss` 必须显式导入该文件，缺失或漂移由测试/产物审计阻断。
- P1 月历按 Web 的实际 5/6 周高度生成三个面板，并使用 Skyline 原生 `swiper` 统一 Android 触控、PC 鼠标和程序翻页，不再维护一套仅在部分运行时生效的自定义 Pan Worklet。
- P1 手排矩阵沿用 Web 的单一滚动上下文：一个 `scroll-view type=list` 只负责横向滚动，日期/节假日表头作为同一内容树的首个直接子节点，班次行作为后续直接子节点；不再创建独立日期或人员 `scroll-view`，也不在每帧通过 JS/`ScrollViewContext.scrollTo()` 追赶表头。20×30 的矩阵高度按 `82 + rows × 44` 计算（最大 962px），交给页面整体纵向滚动；左侧人员列和左上角只作为同一矩阵壳层内的静态覆盖层，随页面纵向移动、横向保持冻结。这样日期表头和主体列由同一个原生 compositor scroll offset 驱动，避免真机上已观察到的延迟和黏滞。
- `worklet:onscrollupdate` 只更新 SharedValue 进度，`applyAnimatedStyle` 在 UI 线程更新顶部进度条；普通 `bindscroll` 仅作为不支持 Worklet 回调设备的进度提示兜底，不再执行任何表头同步或滚动控制。`worklet:onscrollend` 通过 `runOnJS` 更新停止后的提示文本。该 API 要求基础库 3.3.0；20×30 仅 600 个逻辑格，保持浅层单元格和 `type=list` 直接子节点即可，不押注二维 `grid-builder`。

官方依据：[`scroll-view`](https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view.html)、[`Skyline Worklet`](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/worklet.html)、[`Skyline 发布上线`](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/migration/release.html)；微信官方维护的 [Skyline Skills scroll-view 指南](https://github.com/wechat-miniprogram/skyline-skills/tree/main/skills/skyline-components/references/scroll) 和 [Skyline Worklet 指南](https://github.com/wechat-miniprogram/skyline-skills/tree/main/skills/skyline-worklet) 进一步说明 `type`、直接子节点按需渲染、UI 线程滚动回调与 SharedValue 的使用边界。官方 [skylint 规则](https://github.com/wechat-miniprogram/skylint) 也明确 Skyline 不支持同一 `scroll-view` 同时水平和垂直滚动，因此本页不再使用 `scroll-x + scroll-y` 双轴容器。
