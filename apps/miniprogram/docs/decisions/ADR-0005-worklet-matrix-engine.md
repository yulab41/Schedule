# ADR-0005：手排矩阵采用四层纯 Worklet 二维平移

- 状态：已接受，待 Android 人工验收
- 日期：2026-08-20

## 决策

7×7 与 20×30 手排矩阵统一使用普通 WXML `view` 裁切面和单一 `pan-gesture-handler`，矩阵内部不使用 `scroll-view`、`native-view`、嵌套横纵识别器或跨容器追赶。

同一个 UI 线程手势维护有界的 X/Y SharedValue：左上角固定，日期层只使用 X，人员层只使用 Y，班次主体同时使用 X/Y。首次明确方向后锁轴到 END/CANCELLED；横纵惯性均使用 Worklet `decay`。手势 ACTIVE 期间禁止 `setData`。

## 理由

目标 Android 已通过人工测试证明：原生横向 `scroll-view` 无论由外层 handler、simultaneous 识别器还是单一 `native-view` 代理承载，都只保留横向滚动，无法提供可用的纵向 ACTIVE。继续依赖原生滚动上下文不能实现冻结首行/首列的双轴矩阵。

四层共享坐标与电子表格渲染器一致，并适合当前最大 20×30、600 格的有界规模。它保留现有 WXML 文字和点格语义，不提前 Canvas 化。

## 回退

旧原生横向方案完整保留在 Git release `78e341b5ca96ab1c95e4757e75524a88fcfa8219`，其代码 checkpoint 为 `e43cf4fb907a3393107cc894d2832b31918bb06f`，微信体验版为 `0.1.0-p1.20260820.23`。

若新引擎人工验收不通过，必须使用新的 `git revert` checkpoint 撤销新引擎提交并重新上传体验版；不得 reset、改写历史或在运行包中长期保留两套互相竞争的手势实现。
