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

构建同时注入 `buildVersion` 与七位 Git commit：体验上传显示 `WECHAT_CI_VERSION@commit`，本地编译显示 `local@commit`。基础控件、月历、矩阵和诊断页均可见显示同一个 `buildLabel`；`dist/build-profile.json` 同步记录两字段，禁止手工维护页面版本文案。

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
- P1 手排矩阵采用固定四层 WXS 视图层坐标模型，不在触摸期间重排 WXML：左上角固定；日期层只读取 X；人员层只读取 Y；班次主体同时读取 X/Y；进度条直接使用相同 X。矩阵内部没有 `scroll-view`、`native-view`、`pan-gesture-handler`、第二个表头容器或 `ScrollViewContext.scrollTo()` 追赶。
- 矩阵壳层固定为 `82px` 表头加 7 个 `44px` 人员行，共 390px；不再按窗口高度、矩阵顶部或安全区动态覆写。7×7 完整显示，20×30 固定显示 7 行并在壳层内纵向浏览，常规手机尺寸下不会因运行时测量把矩阵延伸到页面外。
- 普通视图上的唯一 WXS 入口在视图层读取 `touchstart/touchmove/touchend/touchcancel`，达到 2px 且某轴超过另一轴 1.2 倍后锁轴。横向在一次回调更新日期/主体/进度条，纵向更新人员/主体；松手惯性使用 `ComponentDescriptor.requestAnimationFrame` 且有界。零位移不返回 `false`，保留班次格 tap；移动和惯性全程不调用 `setData`，最终静止才以一次 `callMethod` 更新逻辑层摘要。独立矩阵页继续声明 `disableScroll: true`。
- WXS 惯性不读取 `requestAnimationFrame` 回调参数：目标 Skyline 可能不提供浏览器式时间戳。每帧使用固定 16ms 位移和 `velocity *= 0.92` 衰减，避免第二帧计算产生 NaN；边界函数对 NaN 防御性归零。快速滑动和慢速滑动因此共用同一有限坐标状态，惯性结束后可立即同轴或换轴。
- WXS 使用模块级坐标状态并在每次 transform 前按 ID 获取当前四层节点，不缓存跨渲染提交的 `ComponentDescriptor`。静止回写会把 X/Y、进度和递增 `syncRevision` 作为一个数据批次保存；`change:matrix-config` 在渲染后恢复相同 transform，避免松手回零。相同模式的普通同步不会重置轴或 tracking；若回写晚于下一次触摸，只更新边界并保留新手势。
- 顶部进度条由 WXS 直接读取 X/maxX 并随横向惯性更新；逻辑线程只在触摸最终静止或尺寸变化时更新 ARIA/提示文字。20×30 只有 600 个逻辑格，保持浅层单元格和裁切视口即可，不押注二维 `grid-builder`。旧实现与回退规则见 [ADR-0005](../decisions/ADR-0005-worklet-matrix-engine.md)。
- `pages/gesture-probe/index` 是 diagnostic-only 最小页：A 区验证 Pan Worklet 蓝点，D 区验证 WXS 黄色点，B 区计数普通逻辑层触摸，C 区显示设备运行信息。目标 Android 已确认黄色点横纵同步跟手，矩阵因此使用同一 WXS 原语；探针仍不属于产品 UI。

官方依据：[`WXS 响应事件`](https://developers.weixin.qq.com/miniprogram/dev/framework/view/interactive-animation.html)、[`scroll-view`](https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view.html)、[`Skyline Worklet`](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/worklet.html)、[`Skyline 手势`](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/gesture.html)、[`Skyline 发布上线`](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/migration/release.html)。WXS 官方 `ComponentDescriptor` 明确提供 `setStyle`、`callMethod`、`requestAnimationFrame` 及 Skyline 异步 `getBoundingClientRect`；本实现只用前三项，尺寸仍由逻辑层低频测量。官方 [skylint 规则](https://github.com/wechat-miniprogram/skylint) 也明确 Skyline 不支持同一 `scroll-view` 同时水平和垂直滚动，因此本页不使用 `scroll-x + scroll-y` 双轴容器。
