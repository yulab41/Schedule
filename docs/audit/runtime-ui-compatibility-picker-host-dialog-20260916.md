# Skyline 3.17.2 年月/日期选择器改回真弹窗（2026-09-16）

## 结论

用户复核 `.142@8988afe` 后指出两点：3.17.2 的年月选择器变成就地展开且滚轮无法滚动（滚动会带动
整个换班弹窗）、请假弹窗的日期选择器被挤进两列布局；同时 3.17.2 点弹窗外不会关闭弹窗，而
3.17.3 会。两点都成立，第二点正是上一轮“就地展开、去掉遮罩”方案直接造成的。

根因回顾：3.17.2 不能把 `scroll-view` 内的浮层抬到内容之上（`.136` 已记录），而 `.138` 尝试的
“从 `ui-sheet` 插槽内容 `root-portal` 到根层”在该实例同样不生效；就地展开虽然可见，却同时带来
滚轮被外层滚动抢占、两列布局挤压、没有遮罩（因此点外面不关闭）三个副作用。

本轮的结论是：**不再让弹窗待在 sheet 的滚动容器里**，改为由面板把弹窗挂在面板根层
（`.swap-page`/`.leave-page` 直属于面板、与 `ui-sheet` 同级）——这一层在 3.17.2 上已被真机验证
可用（换班/请假弹窗本身就是这一层的 `position: fixed` 覆盖层）。

## 实现（仅 3.17.2 走新路径，3.17.3 保持原路径）

- `components/ui/ui-date-picker`：新增属性 `dialog-only`（只渲染弹窗、不渲染触发器）与
  `host-key`（触发器与宿主配对的键）。当触发器被标记为“宿主托管”（`host-key` 非空且判定为
  3.17.2）时，它不再本地渲染弹窗，而是把 `mode/value/min/max/title` 随 `pickerrequestopen`
  上抛；面板调用宿主的 `openFromParent()` 打开弹窗，弹窗确认后由 `forwardHostedChange()` 通过
  模块内实例表找回原触发器并调用其 `applyChange()`，于是仍由原组件抛出 `change`，面板上既有的
  `bindchange` 处理器一行未改。取消/关闭走 `forwardHostedClose()`。
- `subpackages/workflows/components/controller-host.ts`：面板与直连页面宿主都增加
  `pickerDialog` 状态与四个处理器（`handlePickerRequestOpen` 扩展、`handleHostedPickerChange`、
  `handleHostedPickerClose`、`handlePanelBackgroundTap`）；宿主通过 `.workflow-picker-host` 选择。
- 三个工作流面板：在面板根层各加一个 `<workflow-picker dialog-only host-key="{{pickerDialog.hostKey}}" …>`
  宿主（`wx:if="{{skyline3172UiCompatibility}}"`），并给 8 个月/日期触发器加上 `host-key`
  （换班 4 个、请假 2 个、加扣班 2 个）。
- 弹窗仍是原来的 `position: fixed` 覆盖层 + 遮罩（3.17.3 视觉与行为不变）；3.17.2 由根层宿主
  渲染，因此滚轮独立滚动、遮罩可点击关闭（第 2 点修复）。就地展开只保留给未接宿主的调用点
  （手排页、导出页等的下拉/日期），后续可同样接入宿主。

## 验证与边界

- RED/GREEN：兼容套件改为断言宿主契约（`dialog-only`、`host-key`、宿主选择器、`hostedLocally`
  分支），定向 23 项通过；Mini 完整 174 文件 1211 项通过、16 项跳过；typecheck、production build
  366 文件、source/package/determinism（manifest `c13f7cb9…4515c`）、`pnpm format:check`、`pnpm lint`
  通过。主包 1743699B、总包 4616396B。
- 边界：未调用微信开发者工具，没有新的真机证据；根层宿主的原生合成、滚轮在 3.17.2 的独立滚动、
  遮罩点击关闭与 3.17.3 不变仍需下一版体验版的小米 14 双实例复核。本轮未上传、未放行、未部署。
