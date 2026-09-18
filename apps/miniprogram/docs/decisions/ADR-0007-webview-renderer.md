# ADR-0007: 小程序改为请求 WebView 渲染器（试行）

- 状态：Accepted（试用，2026-09-18）——**取代 ADR-0001-native-skyline-only.md 的"仅 Skyline"限制**
- 背景：3.17.2 与其后灰度的 3.17.3 所带的 Skyline 1.4.23 存在 Grid 双列 8px 回归以及一批布局差异，需要一整套兼容分支；真机 A/B 显示 WebView 侧没有该回归（同一构建、同账号：WebView `Grid 双列 同行双列 0px`、Skyline `已退化 8px`），界面也一直以 WebView 表现为准。
- 决定：`src/app.json` 与全部页面 JSON 的 `renderer` 改为 `webview`；Skyline 兼容分支（分辨率分页器、滚轮孪生、`.is-skyline-3172-ui` 布局修正）只在"**请求 Skyline 且 SDK=3.17.2**"时启用，由编译期注入的 `__MINIPROGRAM_RENDERER__`（取自 `src/app.json`）判定。
- 影响：所有用户落到同一个布局引擎，界面不再随基础库灰度整体回退；兼容分支代码原样保留但默认不执行。
- 回滚：把 `renderer` 改回 `skyline` 即可（`rendererOptions.skyline` 保留、门禁同时接受两种值）。
- 待原生复核（不代替）：手工排班矩阵的滚动同步、日历/滚轮/选择器交互、首屏性能（`foreground-ready`/`core-ready`）需在小米 14 体验版上确认。
- 相关：ADR-0005-worklet-matrix-engine.md（矩阵引擎的前置假设需在 WebView 下重新确认）。
