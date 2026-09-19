# Skyline 3.17.2 弹窗层定位修复（`inset` 兼容，2026-09-16）

## 结论（有真机-同类模拟器证据）

用户反馈的两点在 3.17.2 上仍未起效：年月/日期选择器点开后没有弹窗；换班等 sheet 点外部不关闭。
用**开发者工具（基础库 3.17.2、Skyline、同一提交 `d526252b`）**复现后确认：**根因是覆盖层使用了
`inset: 0`（以及 `max(...)`/`env(...)` 组合），而该渲染器不解析它们**，于是：

- `.workflow-picker-layer`（弹窗层）没有偏移量 → 被排到视口之外 → DOM 存在于渲染树、但**完全不绘制**
  （用 `automation_element_action --action outerWxml` 能看到 layer/scrim/sheet 节点，截图却什么都没有）；
- `.ui-sheet__scrim`（弹窗遮罩）同样没有偏移量 → 点"弹窗外"的灰色区域其实落在页面上，遮罩的
  `bindtap="handleBackdropClose"` 从不触发 → sheet 点外部关不掉。

诊断过程（全部在开发者工具内，属用户当次授权的只读调试）：登录测试账号 → 进入请假/换班 →
命中 DOM 与数据（`open: true`、`dialogOnly: true`、草稿 `2026年9月16日`）但不绘制 → 逐项排除
`z-index`（改成 2000 无效）与组件查找（`selectComponent('#workflow-picker-host')` 实际返回实例，
`selectAllComponents` 在该运行时对自定义组件返回 0）→ 最终用"把 `inset` 换成显式
`top/right/bottom/left`"的最小改动，让弹窗层**立刻正常绘制**（截图：选择月份卡片 + 滚轮可见）。

## 修复

- `components/ui/ui-date-picker/index.wxss`：`.workflow-picker-layer`、`.workflow-picker-scrim`、
  `.workflow-picker-wheel-mask` 增加显式 `top/right/bottom/left: 0`；`.workflow-picker-sheet` 的
  安全区定位保留 `bottom: max(12px, env(safe-area-inset-bottom))` 但**先给 `bottom: 12px` 回退**。
- `components/ui/ui-selector/index.wxss`：`.workflow-picker-selector-backdrop` 同样改为显式偏移。
- `components/ui/ui-sheet/index.wxss`：`.ui-sheet__scrim` 改为显式偏移（这一条修好"点外部关闭"）。
- 新增回归断言：三个覆盖层文件必须同时含 `top/right/bottom/left: 0`，且安全区必须保留 `bottom: 12px` 回退。

这些改动在所有版本上语义等价（显式四向偏移与 `inset` 在支持的引擎上一致），因此不新增版本分支，
也不改变 3.17.3 的几何与交互。

## 验证与边界

### 追加修复：3.17.2 弹窗内点击会误关弹窗（体验版 147 真机反馈）

用户真机复核 `.147` 报告：3.17.2 的请假日期弹窗能打开、能左右滑动日历，但点击"定位今天"、左右切月、
具体日期或弹窗内外任何位置（非滑动）都会**关闭弹窗**，因此选不了日期。

原因：3.17.2 的弹窗由**页面根层的宿主**渲染（3.17.3 的弹窗在 `ui-sheet` 内部，被面板的 `catchtap`
挡住），而页面根节点绑定了 `bindtap="handlePanelBackgroundTap"`（其中包含关闭宿主弹窗的分支）。
弹窗卡片内的点击没有在组件边界内被拦下，冒泡到页面根后即触发关闭。

修复（1 行）：`.workflow-picker-layer` 增加 `catchtap="handleInternalTap"`（复用组件内已有的 no-op
处理器），使弹窗自己消费卡片内的点击：卡片上的按钮/日期/滚轮照常响应，点遮罩仍然关闭弹窗，
而点击不再冒泡到页面根。3.17.3 路径不受影响（其弹窗本来就在 sheet 内）。
若"年月滚轮不能滚动"部分仍有残留（滚轮拖动被当作点击并冒泡），该修复同样会消除其冒泡关闭路径；
真机复测若仍不能滚动，则问题在滚轮 WXS 的样式通道，另开一轮定位。

- 门禁：Mini 完整 174 文件 1214 项通过/16 跳过；typecheck、production build（366 文件）、
  package audit、determinism（`d3ad253f…035e1c`）、`pnpm format:check`、`pnpm lint` 通过；
  主包 1744003B、总包 4618408B。
- 开发者工具内已完成完整交互链验证（基础库 3.17.2、Skyline、提交 `c9ad7c0` + 本修复）：
  请假页 `state=ready` → 打开"新建请假"sheet → 触发开始日期选择器 → **弹窗正常出现**
  （全屏遮罩 + 底部"选择日期 2026年9月16日"卡片 + 日历 + 取消/完成，截图为证）；
  调用遮罩关闭处理器 → `pickerDialog.open=false`、sheet 保持打开；调用 sheet 遮罩关闭处理器 →
  `formVisible=false`（即"点弹窗外关闭"的处理器链可用，且修复后遮罩铺满视口，点击才会落在遮罩上）。
  随后把基础库切到 **3.17.3** 重复同一流程，弹窗外观与 3.17.2 修复后逐像素一致（3.17.3 未受影响）。
  说明：该验证通过"自动化执行与 tap 同一个处理器"完成（自动化引擎无法选中组件作用域内的节点，
  故临时使用了未提交的探针；探针已还原，工作树停留在修复提交）。
- 仍须由小米 14 上的同版本体验版做最终的原生验收（触控/滚动/安全区等只能在真机确认）。
- 本轮未上传体验版、未放行、未部署生产；上传与放行按政策须先取得当次授权。
