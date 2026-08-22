# ADR-0005：手排矩阵采用四层视图层二维平移

- 状态：已接受；7×7/20×30 Android 人工验收通过
- 日期：2026-08-20

## 决策

7×7 与 20×30 手排矩阵统一使用普通 WXML `view` 裁切面和单一 WXS 触摸入口，矩阵内部不使用 `scroll-view`、`native-view`、`pan-gesture-handler`、嵌套横纵识别器或跨容器追赶。

同一个 WXS 视图层状态维护有界 X/Y：左上角固定，日期层只使用 X，人员层只使用 Y，班次主体同时使用 X/Y，顶部进度条直接使用相同 X。首次达到 2px 且某轴超过另一轴 1.2 倍后锁轴到触摸结束；横纵惯性使用 `ComponentDescriptor.requestAnimationFrame`，四层位置通过 `setStyle(transform)` 在同一回调更新。拖动和惯性期间禁止 `setData`，只在最终静止后以一次 `callMethod` 同步可访问进度摘要。

Skyline 的 WXS `requestAnimationFrame` 回调不得假设带有浏览器时间戳参数。惯性固定使用 16ms 逻辑步长与每帧乘法衰减，不读取回调参数或调用 `Math.pow`；所有坐标进入 transform 前必须保持有限数值，通用边界函数对 NaN 回退为 0。否则某一轴 NaN 会使主体二维 transform 整体失效，而日期/人员单轴层仍可能移动。

四层内容均为绝对定位，不会撑开父级；普通 WXS 触摸面显式绑定当前 `matrixViewportHeight` 像素高度，禁止只依赖绝对定位子层撑开。WXS `touchstart`/无位移 `touchend` 不返回 `false`，保留自定义班次格的点选事件；只有已锁轴移动和对应结束才阻止默认移动。

WXS 坐标保存在模块级视图状态中，不依赖可能随渲染提交失效的页面 `ComponentDescriptor.getState()`，也不长期缓存日期、人员、主体或进度条节点句柄；每帧按稳定 ID 重新取得当前渲染节点。静止后的 `callMethod` 把 X/Y 与进度一起回传，逻辑层在同一次 `setData` 中保存摘要和带 `syncRevision` 的坐标配置；WXS 属性观察器在渲染提交后重新应用同一 X/Y。若上一轮回写晚于下一次 `touchstart` 到达，观察器只更新边界，不得取消或覆盖正在进行的新手势。

矩阵热路径不为每个逻辑格创建自定义组件实例。7×7/20×30 均直接渲染视觉等价的内置 `view` 格子，复用 `ManualScheduleCell` 的完整样式与数据路径；独立可复用组件继续保留并单测，但不进入 600 格矩阵树。横向边界在页面模块初始化时用 `wx.getWindowInfo().windowWidth` 同步计算，扣除 28px 页面横向内边距与 2px 壳层边框；旋转时同步校准，不再等待 `onReady → SelectorQuery → setData` 才开放交互。

## 理由

目标 Android 已通过人工测试证明：原生横向 `scroll-view` 无论由外层 handler、simultaneous 识别器还是单一 `native-view` 代理承载，都只保留横向滚动，无法提供可用的纵向 ACTIVE。继续依赖原生滚动上下文不能实现冻结首行/首列的双轴矩阵。

四层共享坐标与电子表格渲染器一致，并适合当前最大 20×30、600 格的有界规模。它保留现有 WXML 文字和点格语义，不提前 Canvas 化。

体验版 `.27` 的 PC 模拟器已证明四层坐标可横纵流畅，但目标 Android 两轴均无输入。该结果尚不能否定四层引擎，必须先由 `pages/gesture-probe/index` 判断目标设备是否执行最小 `pan-gesture-handler` Worklet；探针结论出来前不继续修改矩阵。

2026-08-21 的独立探针结果进一步证明：目标 Android 16 上普通 `touchmove` 可持续触发且页面可滚动，但最小蓝点 Worklet 完全不移动，因此 `pan-gesture-handler` 不再作为该设备的可用输入路径。随后同一设备人工确认 WXS 黄色点横纵移动均同步跟手，证明普通内置 `view` 可通过 `touchmove + ComponentDescriptor.setStyle` 在 Skyline 视图层稳定移动；矩阵据此只替换输入与惯性实现，四层结构、尺寸、数据和回退基线保持。

## 回退

旧原生横向方案完整保留在 Git release `78e341b5ca96ab1c95e4757e75524a88fcfa8219`，其代码 checkpoint 为 `e43cf4fb907a3393107cc894d2832b31918bb06f`，微信体验版为 `0.1.0-p1.20260820.23`。

若新引擎人工验收不通过，必须使用新的 `git revert` checkpoint 撤销新引擎提交并重新上传体验版；不得 reset、改写历史或在运行包中长期保留两套互相竞争的手势实现。

本方案多轮真机诊断的精简经验与后续硬规则统一见[《Skyline 排班矩阵踩坑与后续守则》](../architecture/matrix-gesture-lessons.md)，不在 ADR 内重复维护历史日志。

## 验收

2026-08-22 用户确认 P1 通过：正常进入后横纵滚动、冻结层、进度条、点格和撤销均流畅；首入约 500ms 内立即操作的短卡接受为 P1 PoC 边界。正式业务页继续优先采用预取与就绪态，只有真机指标不达标时才单独评估成员行虚拟化。
