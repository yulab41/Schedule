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

- 门禁：Mini 完整 174 文件 1214 项通过/16 跳过；typecheck、production build（366 文件）、
  package audit、determinism（`d3ad253f…035e1c`）、`pnpm format:check`、`pnpm lint` 通过；
  主包 1744003B、总包 4618408B。
- 开发者工具内已验证：修复前后弹窗层"渲染树有节点但不绘制"与"显式偏移后正常绘制"的对照；
  未能完成真机等价的"完整交互链"验证（该模拟器实例对 app 业务请求返回网络错误，无法加载换班/请假数据），
  因此**原生交互仍须由小米 14 上的同版本体验版复核**。
- 本轮未上传体验版、未放行、未部署生产；上传与放行按政策须先取得当次授权。
