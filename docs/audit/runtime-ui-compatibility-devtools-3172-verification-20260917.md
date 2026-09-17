# 开发者工具（fullMode）复现与验证：Skyline 3.17.2 滚轮修复

日期：2026-09-17　作者：Codex　授权：用户当次消息「允许用 fullMode 重新打开项目窗口并用测试账号登录去重跑 #2」

## 目的

用微信开发者工具复现并验证 `.153`（`a18f8692` / 构建 `0.1.0-p10.20260917.153@a18f869`）对 Skyline 3.17.2 滚轮的修复，
代替“读截图推断”。本轮只做验证，不改业务代码。

## 环境

- 开发者工具 Nightly（Electron，`wechatide-skill` v0.3.11），项目以 `--window-mode fullMode` 打开，
  `winId=s1`，登录态有效（`loginExpired=false`）。
- 项目路径：`runtime/wt/general-3/apps/miniprogram`（独占 warm 槽，`DEPENDENCY_MODE=REUSE_ONLY`，无安装）。
- 模拟器基础库由 `apps/miniprogram/project.private.config.json` 的 `libVersion` 决定；本轮在同一份构建上
  在 `3.17.2` 与 `3.17.3` 之间切换（关窗 → 改文件 → 开窗 → 重新编译）。
- 设备：iPhone 12/13 (Pro)，390×844，pixelRatio 3；renderer = Skyline 1.4.23（项目固定）。
- 运行确认：`automation_runtime_info --action systemInfo` 返回 `SDKVersion` 与当前基础库一致；
  控制台 `WeChatLib: 3.17.2 (2026.9.8 20:10:23)`。

## 关键发现：模拟器“白屏/一直转圈”的真实原因

`pnpm --filter @schedule/miniprogram build` 默认把 `WECHAT_CI_VERSION` 兜底成 `local`（见
`scripts/build-tools.mjs`）。此时客户端会请求：

```
GET /api/client-capabilities?platform=miniprogram&version=local  → HTTP 400 VALIDATION_FAILED
```

因此工作台永久停在“正在读取排班”。构建时带上真实体验版号即可：

```powershell
$env:WECHAT_CI_VERSION='0.1.0-p10.20260917.153'; $env:WECHAT_CI_DESCRIPTION='Skyline 3.17.2 wheel data channel 153'
pnpm --filter @schedule/miniprogram build
```

之后 `client-capabilities` 返回 200（
`{"core":true,...,"workflows":true,"version":"0.1.0-p10.20260917.153"}`），工作台加载真实生产数据
（月历、班次、群组、换班设置等）。

对照：`.152`/`.153` 必须在放行白名单内，公众平台/服务端才放行该版本号。

## A/B 实测

同一构建、只切基础库。因为开发者工具里无法执行探针卡片的“拖方块/拖滚轮”步骤（见下“工具边界”），
本轮改为向真实 `ui-wheel-column` 注入**一次**上报，走一直可用的 `callMethod` + 模板数据通道：

```js
c.handleWheelPreview({ index: 3, offset: -132, generation: 1,
                       runtimeKey: 'diagnostics-wheel-probe', sequence: 1 })
```

| 观测项 | 3.17.2 | 3.17.3 |
| --- | --- | --- |
| `data.skyline3172UiCompatibility` | `true` | `false` |
| 上报后 `data.wheelTrackStyle` | `margin-top:0px;transform:translateY(-132px)` | `margin-top:0px` |
| 轨道 `query.in(c).select('#ui-wheel-track')` 渲染矩形 top | `11642 → 11510`（正好 −132px） | `11642 → 11642`（不变） |
| `.ui-wheel-unit` 渲染数 | 8 / 8 | — |
| 选中数字矩形高度 / 未选中 | ≈25.2px / ≈17.9px（≈1.41×） | — |
| 选中项盒子 | 127.2 × 46.64（= 44px × 1.06） | — |
| `data.internalSelectedIndex` | `3`（中间行强调随数据通道走） | `3`（同通道，但样式串不含 transform） |

结论：

1. 修复在真实 3.17.2 运行时**生效**：数据通道能把轨道真正推走 −132px、单位节点 8/8 出现、
   中间选中项按 `font-size:30px` × `scale(0.7917)` × `scale(1.06)` 变大。
2. 同一次上报在 3.17.3 上**不加入任何 transform**，轨道渲染矩形完全不变 —— 3.17.3 的外观与滚动
   仍由 WXS 独占，修复对它无副作用。

## 工具边界（必须标注）

- 开发者工具的 `fields({computedStyle})` 在 **3.17.2 与 3.17.3 上都返回空**：已用
  `display` / `color` / `transform` / `marginTop` 直接复核一个页面级节点，依旧只返回 rect。
  → 模拟器**既不能复现也不能否证**真机“3.17.2 丢弃 WXS `setStyle`”这条测量；该结论仍然是
  设备级证据（`.152` 两台实例对照）。本轮验证刻意不依赖它：`rect` 是两版本都可用的通道。
- 自动化 `automation_element_action --action trigger` 不会触发 WXS 绑定（探针“移动次数”保持 0），
  合成触摸（`touchstart/touchmove/touchend` 坐标拖拽）不能驱动 Skyline 页面滚动，
  `wx.pageScrollTo` 与 `automation_viewport_action --action pageScrollTo` 均超时。
  → 探针卡片位于页面底部（内容坐标约 11600px），模拟器内无法滚动到可视区，因此
  “拖方块/拖滚轮”两步未在模拟器执行；`preview/settle` 由上面的方法注入产生。
- 坐标点击（`--action tap --x --y`）可用，已用它切换工作台入口与“换班”工作区。
- 因此本轮结论的层级是 **DevTools/Skyline 模拟器验证**，不是小米 14 原生验收。

## 证据留存

`runtime/audit/devtools-153/`（ignored，不提交 Git）：
`01..17-*.png` 截图、`probe-3172-final.json`（3.17.2 探针剪贴板记录）、A/B 的 `--args-file` 与
`--fn-source` 副本。

## 下一任务

1. 小米 14 打开 `.153`：复核 3.17.2 滚轮按行滚动、单位出现、中间项放大、能到 2031年/12月、
   重开后仍可滚动，且 3.17.3 无变化。
2. 授权清单第 3 项：`wxa-skills-generate` → `wxa-skills-validate`（需公众平台“开发模式”+ 服务端口；
   官方要求该模式代码**不得合入正式提审版本**）。
