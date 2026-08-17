# ADR-0001：采用原生 Skyline 且不提供 WebView 回退

- 状态：已接受
- 日期：2026-08-17

## 决策

小程序统一使用原生 WXML/WXSS/TypeScript/JSON、Skyline 和 glass-easel，最低基础库 3.0.2。正式关闭 Skyline AB，目标版本上限 `15.255.255`，不维护 WebView fallback。

## 理由与后果

原生自定义组件能够复刻现有 Web 自绘 UI，并让月历手势、冻结矩阵和 UI 线程 Worklet 获得稳定实现边界。代价是不能机械复制 Vue/DOM/CSS，必须重写视图并提高最低客户端要求；所有核心页面必须同时经过 Android/iOS 原生验证。
