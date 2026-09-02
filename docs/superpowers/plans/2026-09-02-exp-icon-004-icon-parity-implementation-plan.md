# EXP-ICON-004 图标一致性迁移实施计划

- 计划日期：2026-09-02
- 当前计划状态：B0 审计/设计已完成；B1 仅在用户明确批准后启动
- 基线：`origin/main@359966f7240d2f557b24dd0c1ac61979d6bb8298`
- 设计：[2026-09-02-exp-icon-004-icon-parity-design.md](../specs/2026-09-02-exp-icon-004-icon-parity-design.md)
- 审计：[exp-icon-004-icon-parity-audit.md](../../audit/exp-icon-004-icon-parity-audit.md)

## 目标与边界

目标是让 Web 与微信小程序从同一份几何、语义颜色和 motion specification 生成各自平台产物。共享的是
纯视觉数据，不是 Vue/React/DOM/WXSS 运行时代码；小程序只负责 image/WXML/WXSS 兼容渲染。

本计划不授权在 B0 批量修改生产 icon，不授权重新临摹 path，不授权上传体验版或部署 production。每一批必须
独立可回滚；旧资产在对应页面完成构建、自动化和真机确认前保留。

## 当前基线与预算

| 范围         |  B0 bytes | 实施门槛                                        |
| ------------ | --------: | ----------------------------------------------- |
| main         | 1,677,999 | B1–B3 不超过 1,682,095；不跨入 1.8MiB block     |
| scheduling   |   425,318 | 单批不超过 B0 + 4KiB                            |
| organization | 1,053,334 | 单批不超过 B0 + 4KiB；优先承接 org-only assets  |
| workflows    |   832,966 | 单批不超过 B0 + 4KiB                            |
| insights     | 1,071,781 | 单批不超过 B0 + 4KiB                            |
| diagnostics  |    52,021 | 单批不超过 B0 + 4KiB                            |
| total        | 5,113,419 | B1–B3 不超过 5,121,611；不新增 warning category |

当前 26 个 Mini SVG 共 7,218B，均落在 main `assets/icons`；通讯录专用资源约 1,974B。icon source package
必须是 build-time 数据，Mini runtime 不应引入大型依赖、canvas、逐帧 setData 或网络请求。

## 批次

### B0：本轮审计与设计（已完成）

- 读取项目状态、审计主计划、Mini 迁移边界、Web/Mini source、token、TDesign path 和引入历史。
- 从 `origin/main` 建立独立干净 worktree `runtime/external-project-worktrees/exp-icon-004-audit`。
- 完成 Web/Mini 对照、静态属性与动效参数、重复来源、包体和真机验收清单。
- 仅更新审计/设计/计划/状态文档；不改生产 icon，不调用 DevTools，不上传，不部署。

停止条件：文档 checkpoint 推送后停止，等待 B1 批准。

### B1：纯数据 source foundation（下一唯一实施批次）

范围：

- 新建 `packages/ui-icons` pure-data catalog、source/license/checksum 字段、motion schema、token role/context。
- 录入当前 Web production 的 canonical path；用已核对的 TDesign/Mini path 做 exact checksum fixture。
- 新建 deterministic Mini SVG generator；只生成测试/明确的 generated artifact，不改现有生产 consumer。
- 增加 catalog 完整性、重复 key、source checksum、motion schema、生成确定性和字节预算测试。

不做：

- 不替换 `WorkbenchNavIcon.vue`、`LucideMinimalActionIcon.vue` 或 Mini WXML/WXSS 引用。
- 不删除现有 `web-*.svg`，不修改路由、handler、页面布局、TDesign 依赖。
- 不实现 canvas/path renderer，不引入 runtime dependency。

完成条件：纯数据/生成测试通过，Mini build/source/package/performance 通过，包体在门槛内，git diff 只含 B1
文件。任一 source 未追溯、生成不确定、需要生产 consumer 改动或超预算即停止并报告。

### B2：底部导航与顶部动作（高可见）

- calendar/check、directory、swap parts、profile/user、more parts、bell 迁移至 catalog consumers。
- 保持现有业务 handler/route；只替换几何/asset 来源、size context、semantic color 和 adapter state。
- 统一 Web active-only loop 与 Mini active-only class；统一 more part delay 100/200ms。
- 记录 Mini external image 对内部 dash draw 的兼容降级，不改变 spec 数值。

完成条件：Web Storybook/组件测试、Mini 静态合同、build/package/performance 通过；用户批准体验上传后，
才建立同 SHA trial；小米 14 复核通过后才能删除旧 source。

### B3：日历与通讯录动作

- chevron、locate、filter、search、close、filter-clear、department、people、star、phone。
- 统一 size contexts（calendar locate 16/20 的场景差异要记录）、cap/join、token color 和动作 motion。
- 生成 common asset 与 organization-only asset 的合理边界，避免 26 个源文件继续全进 main。

完成条件：日期/筛选/定位业务行为不变；通讯录搜索、清除、收藏、拨号不变；滚动、重复点击、reduced motion
和外部 image actor 由同构建 Xiaomi 14 evidence 确认。

### B4：更多工作区真实语义与事件入口

- groups、manual、backfill、leave/leave-minus、duty、config、events、statistics、export、visitor/invite/access。
- 逐入口建立 semantic source map；不得继续用 profile/calendar/history/bell 作为近似代用品。
- 事件记录 action 的不可用 handler 另列业务任务；icon migration 不得顺手开启或修改功能。

完成条件：每个入口都有真实 source key、文字语义和状态；没有 source 的项保留现状并标记，不强行迁移。

### B5：身份、状态和清理收口

- identity user/lock、logout/status、workflow/picker close/arrow。
- 清理被确认无引用的旧 CSS shape、孤立 asset 和重复 manifest；清理前做 `rg` 引用证明。
- 完成最终包体、Web bundle、Mini tests、source/package/performance 和真机矩阵。

完成条件：旧资源无引用且有可回滚 checkpoint；用户/真机证据与当前 SHA 一致；状态推进为“待用户复核”。

## B1 精确执行 Prompt

```text
执行 EXP-ICON-004-B1「canonical icon source foundation」。基线必须是执行时最新 origin/main；先读取
docs/project-status.md、docs/audit/STATUS.md、docs/audit/exp-icon-004-icon-parity-audit.md、
docs/superpowers/specs/2026-09-02-exp-icon-004-icon-parity-design.md 和本计划。

目标：建立纯数据的 packages/ui-icons，让未来 Web 与微信小程序从同一 geometry/motion source 生成各自
渲染产物。本批只建立 source catalog、生成器、校验和，不替换生产页面的 icon consumer，不改变路由、API、
业务状态、WXML handler、页面布局、TDesign 依赖或用户可见结果。

必须覆盖：calendar、calendar-check、directory、groups、swap-left、swap-right、profile/user、bell、
phone/call、chevron-left、chevron-right、locate、filter、search、close、filter-clear、history、star、
star-filled、duty、leave、leave-minus、more-primary、more-secondary、more-tertiary、manual、backfill、
events、statistics、config、export、lock。

要求：
1. packages/ui-icons/src 只能放纯 TypeScript/JSON-like geometry、parts、viewBox、strokeWidth、linecap、
   linejoin、fill/stroke semantic role、sourceRef、licenseRef、sourceSha、alias；禁止 import Vue/React/DOM/
   WXML/WXSS/TDesign runtime/动画库，禁止凭视觉重新临摹 path。
2. motion spec 只放 part key、offset、transform/opacity/dashOffset（若适用）、duration、delay、easing、
   iteration、direction、fillMode、trigger、reducedMotion，并以当前 Web 生产值为 canonical。不得把 Mini
   <image> 的限制偷偷改成另一套关键帧。
3. 提供 deterministic Mini SVG generator 和 generated-output 校验；颜色只能来自 @schedule/ui-tokens
   semantic role；生成文件标记 generated。先不要删除、改写或替换 apps/miniprogram/src/assets/icons 既有
   文件，也不要编辑 dist。
4. 提供测试：catalog key/source/license 完整、path/source checksum、viewBox/属性、motion schema、重复
   key/alias、生成结果 deterministic、Mini asset size 预算。至少一个 source/checksum 或 duplicate-key
   回归断言必须先在旧/错误 fixture 上失败，再在实现上通过；不能改测试掩盖。
5. 写出 capability map：Mini external image 不支持内部 path selector/currentColor/stroke-dashoffset；只
   记录兼容能力，不引入 canvas、逐帧 setData、WXS worklet 或新依赖。
6. 逐项记录 Web/TDesign/Mini path 是否 exact；不确定的 geometry 标 needs-review，不自动合并为同一 key。

验证：PowerShell 若连续运行多个 native command，必须同时设置
$ErrorActionPreference='Stop' 和 $PSNativeCommandUseErrorActionPreference=$true。运行 git diff --check、
相关纯数据测试、node apps/miniprogram/scripts/build.mjs --profile=production、
node apps/miniprogram/scripts/source-audit.mjs、node apps/miniprogram/scripts/package-audit.mjs、
node apps/miniprogram/scripts/performance-budget.mjs；记录 B1 前后 main/各分包/total bytes、最大文件和
未测量的原生冷启动/真机项。若 B1 不改 Web core consumer，不需浏览器 smoke；若实际触及 apps/web core icon
consumer，必须补跑 pnpm smoke:browser 和提交前 pnpm smoke:check-core。

停止条件：需要改变 path 语义、引入 runtime/canvas、包体超预算、生成器不 deterministic、source/license
不可追溯，或需要修改生产 consumer 时，停止并报告，不扩展到 B2。不得调用微信开发者工具，不上传体验版，
不部署 production。完成后只提交 B1 范围内文件，等待 B2 的明确批准。
```

## 复核顺序

1. 审阅审计报告中的 P1/P2 对照与“更多”语义映射。
2. 审阅 source catalog 的 Web canonical 选择、TDesign exact path 处理和 Mini capability 限制。
3. 审阅 B1 Prompt 与包体门槛；批准后另开实施 checkpoint。
4. B2/B3 需要体验版时，先提供修改内容、短 SHA、脏树状态、测试页面并取得当次明确授权；本计划本身不构成
   上传或部署授权。
