# ADR-0007: 小程序改为请求 WebView 渲染器（试行）

- 状态：Accepted（2026-09-18 试用，2026-09-19 定为唯一渲染器）——**取代 ADR-0001-native-skyline-only.md 的"仅 Skyline"限制**
- 背景：3.17.2 与其后灰度的 3.17.3 所带的 Skyline 1.4.23 存在 Grid 双列 8px 回归以及一批布局差异，需要一整套兼容分支；真机 A/B 显示 WebView 侧没有该回归（同一构建、同账号：WebView `Grid 双列 同行双列 0px`、Skyline `已退化 8px`），界面也一直以 WebView 表现为准。
- 决定：`src/app.json` 与全部页面 JSON 的 `renderer` 为 `webview`，作为唯一渲染器；`rendererOptions.skyline` 已删除。Skyline 3.17.2 兼容层（分页器孪生、滚轮孪生、宿主对话框、`.is-skyline-3172-ui` 布局修正、`src/platform/runtime-ui-compatibility.ts` 及其门禁测试）已整体删除，不再保留"默认不执行"的死代码。
- 影响：所有用户落到同一个布局引擎，界面不再随基础库灰度整体回退；主包因此减少约 39 KB，且不存在渲染器/基础库版本分支。
- 回滚：回滚需要一个提交（`git revert` 删除兼容层的提交）恢复兼容层，并把 `renderer` 与页面 JSON 改回 `skyline`。
- 待原生复核（不代替）：手工排班矩阵的滚动同步、日历/滚轮/选择器交互、首屏性能（`foreground-ready`/`core-ready`）需在小米 14 体验版上确认。
- 相关：ADR-0005-worklet-matrix-engine.md（矩阵仍用其四层 WXS 方案；其中"Skyline 提供 UI 线程手势/SharedValue"的前提已作废）。
- 2026-09-19 收尾：仓库内最后一个 `wx.worklet` 使用点（`pages/gesture-probe` A 区 Pan Worklet 探针）与 `src/types/build-env.d.ts` 的 Worklet 类型声明一并删除；`app.json` 的 `rendererOptions.skyline` 与构建校验同时删除。现在源码里没有任何渲染器或基础库版本分支。
