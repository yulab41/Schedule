# 测试工具新增"滚轮通道探针"（2026-09-17）

用户建议把排查所需的事实做成测试工具里的二级探针，避免反复靠推理。本轮在
`更多 → 测试工具` 增加一张卡片 **"滚轮通道探针"**（在"微信提醒诊断"之后、报告卡片之前），
由用户在真机上操作一次、复制结果发回即可定位。

## 卡片内容与操作

1. 左侧一个页面级 WXS 拖动方块（`.wheel-drag-probe` + `#wheel-drag-probe-dot`，由新增的
   `wheel-probe.wxs` 用 `ownerInstance.selectComponent(...).setStyle(...)` 驱动，并用
   `ownerInstance.callMethod(...)` 把移动次数/偏移/是否取到节点回报给页面）。
2. 右侧一个真实 `ui-wheel-column`（8 项、`unit="号"`、固定 `runtime-key="diagnostics-wheel-probe"`），
   `bindpreviewchange`/`bindsettle` 把 WXS 上报的 index/offset/sequence/generation/runtimeKey 累计到页面。
3. 两个按钮：【采集滚轮探针】（测量 + 拼报告 + 复制）、【重置探针】（换代际、清计数）。

## 报告字段（复制内容）

- `[页级 WXS 通道]`：移动次数、WXS 计算偏移、WXS 是否取到目标节点 —— 判断"页面级 WXS 的 setStyle
  是否到达渲染器"。
- `[滚轮 WXS 上报]`：preview/settle 次数与最后 index/offset/sequence/generation/runtimeKey ——
  判断"滚轮 WXS 是否收到手势、是否回报到逻辑层"。
- `[渲染器实测]`：`createSelectorQuery` 对页面节点与 **组件作用域**（`query.in(selectComponent(...))`）
  测得的 `computedStyle.transform/marginTop/fontSize` 与 rect —— 判断"WXS 写出的样式是否真的落到节点上"，
  以及组件作用域查询在该版本是否可用（取不到会显式写"未取得滚轮实例/空"）。
- `dataset 期望值`：本轮期望渲染器应持有的 `baseIndex`/`itemCount`，与实测对照即可判断数据通道。

报告不含身份、联系方式、群组、排班、请求正文或凭证；只含固定环境字段、通道状态与偏移量。

## 验证

- 定向 `scripts/test-tools.test.mjs` 23 项通过（含新增的探针接线契约：WXS 模块、页面级拖动绑定、
  真实滚轮绑定与回调、组件作用域查询、复制调用、`touch-action: none`）。
- Mini 完整 174 文件 1220 项通过/16 跳过；typecheck、production build（367 文件，新增 `wheel-probe.wxs`）、
  package（主包 1746707B / 总包 4632789B，diagnostics 分包 114031B）、determinism（`677e0ed7…760a5`）、
  `pnpm format:check`、`pnpm lint`、`pnpm smoke:check-core` 通过。

## 边界

本轮未上传体验版、未放行、未部署（当前消息未包含上传授权）。探针只读，不写业务数据、不改排班/权限。
