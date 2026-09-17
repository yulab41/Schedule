# 3.17.2 丢弃 WXS 样式写入：像素改走数据通道（2026-09-17）

## 真机测量结论（体验版 `.152` 滚轮通道探针，两台实例对照）

| 观测项 | 3.17.2 | 3.17.3 |
| --- | --- | --- |
| 页级 WXS 是否取到节点 | 是 | 是 |
| WXS `callMethod` 上报 | 正常（preview 19 / settle 8，index 7，offset −308） | 正常（18 / 3，index 7，offset −308） |
| 页级探针节点实测样式 | **没有 `transform` 字段** | `"transform":"matrix(1, 0, 0, 1, 0, -88)"` |
| 组件作用域 track 实测 | 只有 rect，**没有 computedStyle** | `transform -308`、`marginTop 0px` |
| 组件作用域查询 | 可用（`.ui-wheel-number` 返回 8 项） | 可用 |

结论（测量而非推断）：**3.17.2 丢弃 WXS 的 `setStyle` 写入，且 `fields({computedStyle})` 不可用**；
`callMethod` 与模板数据通道正常。因此"数字不动、无选中放大、无渐变"是同一原因——该版本像素只能由模板/数据驱动。
此前关于"手势被抢占 / 观察器 / 作用域查询"的假设均被这次测量排除。

## 修复（只改受影响运行时的像素通道）

- 轨道位移改由**组件自身 data** 承载：新增 `wheelTrackOffset` / `wheelTrackStyle`，在每次 WXS 上报
  （preview/settle，按行触发）与换代/重开时更新；轨道样式改为 `style="{{wheelTrackStyle}}"`。
- `wheelTrackStyle` 只在 `SDKVersion === 3.17.2` 时包含 `transform: translateY(...)`；3.17.3 仍只写
  `margin-top`，像素继续由 WXS 平滑驱动，外观与动画不变。
- 单位改为 `wx:if="{{item.unit}}"` + `wx:else` 回退组件属性（不再用 `||` 表达式）。
- 3.17.2 的滚动是**按行推进**（每次上报一步），这是该版本唯一可用通道；若要逐像素跟手，需按既有约定
  另开一轮架构讨论（例如 native `scroll-view` 回退），本轮不做。

## 验证

定向 65 项、Mini 完整 174 文件 1220 项通过/16 跳过；typecheck、production build（367 文件）、
package（主包 1747172B / 总包 4633254B）、determinism（`51bc6941…4321`）、`pnpm format:check`、
`pnpm lint`、`pnpm smoke:check-core` 通过。

## 边界

本轮未上传体验版、未放行、未部署。3.17.2 仍未解决：未触摸前的渐变（拿不到 WXS 样式，只能按行近似）、
点击单项直接选中。
