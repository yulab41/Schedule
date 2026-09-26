# 小程序包体精简（2026-09-26）

## 范围与结论

从正式路由删除独立“我的 / 通讯录 / 换班”和基础控件演示、手势探针、测试工具共六页；工作台内五标签及其共用业务组件保留。后三页及专用 `diagnostics-access.ts` 的源码和单元测试继续留在仓库，正式构建按固定路径排除。底层网络、通讯录、通知与错误记录链路未改。当前正式路由由 24 减至 18。

同一独占 warm worktree、同一 Node/pnpm/esbuild 工具链、同一 production 构建命令及相同测试版本/描述的前后测量如下。基线为 `ae42aed` 干净源码，候选为该源码加本轮未提交修改；构建时间和 dirty 字段仍有少数字节差异，最终上传 ZIP 以微信 CI 结果为准。原始产物统计包括 `build-manifest.json`。

| 包           |  修改前 B |  修改后 B |  减少 B |
| ------------ | --------: | --------: | ------: |
| 主包         | 1,835,334 | 1,616,037 | 219,297 |
| scheduling   |   428,760 |   428,760 |       0 |
| organization |   854,478 |   849,269 |   5,209 |
| workflows    |   687,785 |   533,416 | 154,369 |
| insights     |   898,599 |   898,599 |       0 |
| diagnostics  |   114,202 |         0 | 114,202 |
| 合计         | 4,819,158 | 4,326,081 | 493,077 |

主包和总包减量分别超过 170,000 B、400,000 B 停止阈值。本地 PowerShell `Compress-Archive -CompressionLevel Optimal` 的同口径 ZIP 代理从 1,029,755 B 到 910,357 B，减少 119,398 B；它不是微信 CI 上传 ZIP 的实际大小。原始命令、包分类和 ZIP 证据在 ignored `runtime/audit/mini-slim-20260926/`。

## 安全门禁与验证层级

- 源码审计确认三页及专用访问模块仍存在，正式路由均不注册；产物审计确认对应目录、模块和旧独立包装页均不在 `dist`。上传前对实际文件清单和路由再次审计，注入测试工具文件时拒绝上传。
- 受影响 27 个测试文件 222 项通过；完整 Mini 测试 1,273 通过、18 跳过。`miniprogram:verify` 的类型、源码、构建、包体、性能和确定性门禁通过；本地 production 构建警告仅为主包 1.5 MB 内部预警和既有手排 600 格节点最佳实践提示。
- 根仓库 lint/build/typecheck/icon parity、`pnpm test`（1,307 通过、452 跳过）、`pnpm smoke:check-core`、Mini CI dry-run 和 trial-lineage 均通过。`pnpm format:check` 在本轮未改的五个文件上失败（`schedule-calendar-preview/model.ts`、`backfill/index.ts`、`past-schedules.ts` 及 presentation-core backfill 源码/测试）；不把跨包格式调整混入本轮。已格式化并检查本轮改动文件。
- 开发者工具 CLI 状态为已登录且版本兼容。工作台日历、通讯录、换班、我的、更多五个处理器调用后 `activeWorkspace` 逐项匹配；登录、工作台、访客及 scheduling/organization/workflows/insights 代表页面的 WXML、工作台 WXSS 编译成功。访客页缺有效链接，直接打开后自动化运行时读取超时，业务场景暂未验证。以上是开发者工具证据，不是小米 14 真机验收。

## 发布与后续边界

应用检查点 `e6ef714b`（`fix(miniprogram): exclude unused pages from production package`）已推送。首次上传在分配版本前因 `5285dd1` 的工作台精确 blob 证明过期而停止；未占用新版本。`git log -S` 和 `git blame` 将旧证明 `e0f48e5b` 定位到 `a3eccb49`，本轮工作台 blob 为 `951cf5f6`。源码对比确认本轮只删除测试工具权限订阅、入口处理器及相关状态，图标、日历导航/swiper/定位/滚动实现未改。新增红绿血缘测试并刷新证明，17 项血缘测试与账本审计通过；证明检查点 `5b12c724` 已推送。随后 Git tag 读取遇到一次瞬时网络错误，仍未分配新版本；重试同一候选成功。

动态分配并上传的正式体验版是 `0.1.0-p10.20260926.202@5b12c724`，说明 `Mini package slim 5b12c72`，production 干净构建，Manifest `bdb22991a43ecdf3d9c5f22064a8125a244564d6e4c2e9a688fb6ccddabe61f7`。微信 CI 报告上传 ZIP 为 2,360,179 B；此前没有同工具链、同参数的基线微信 CI ZIP，因此不能据此计算实际 ZIP 减量。该次上传的原始 `dist` 为 4,326,154 B、主包 1,616,076 B，均只比同口径比较候选多几十字节。远端 tag 指向同一完整 SHA，ignored receipt 和 Manifest 匹配；构建后的 330 个文件再次通过审计，诊断页、专用模块和已删除独立包装页均不存在。

当前未连接生产服务器，未做备份、部署、版本放行、提审或正式发布。生产允许版本清单属于单独的生产操作，本轮上传不等于服务端放行。小米 14 正常业务验收需要同一体验版的版本/SHA、WebView、基础库和微信版本证据。
