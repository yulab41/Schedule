# 微信小程序审计状态

- 当前阶段：阶段 B 后纠偏源码已用标准 CLI 重传，待平台可见性确认与小米 14 验收
- 基线：`a23266182122c6e2fcb5ca5aba5d8857ef781910`（核验后的最新 `origin/main`，包含阶段 B）
- 工作区：`codex/preupload-diagnostics-correction`，独立 worktree；用户脏主工作树未修改
- 代码 checkpoint：`a9021c4e fix(miniprogram): correct preupload diagnostics boundaries`，已推送并快进 `origin/main`
- `.72@5fff288`、`.73@c7c142e`：历史已上传版本
- `.75@24a847f`：首次直接 SDK 调用虽返回成功，但平台仍显示 `.74`，不作为有效上传；
  2026-09-01 20:27:38 +08:00 从 exact clean
  `24a847ffdeec5899ab7c9d505c740b715df3ef6e` 经标准 `pnpm miniprogram:upload-experience` 重传成功，
  191 code files、上传 ZIP 2,445,701 B、manifest `be286925…129f`；开发版即体验版，无网页设置步骤，
  未提审、未正式发布
- 上传状态文档 checkpoint 以 `docs(audit): record .75 diagnostics upload` 识别；它不是上传源码 SHA
- production allowlist：2026-09-01 20:10:36 +08:00 经可信 add-only 工具追加 `.75`；API/Web 重建，
  首个 TLS EOF 在内置健康等待中恢复；未重建 MySQL、未备份数据库、未同步服务器 release
- capability：`.75`/`.73` 公网均为 HTTP 200 且七维全 true，动态未知版本仍为 HTTP 426；可信
  `verify` 复核通过，live release 前后均为 `a23266182122c6e2fcb5ca5aba5d8857ef781910`
- allowlist 状态文档 checkpoint 以 `docs(audit): record .75 allowlist activation` 识别；不是上传源码 SHA
- 标准 CLI 重传文档 checkpoint 以 `docs(audit): correct .75 standard CLI upload` 识别；不是上传源码 SHA

## 已修复边界

- App 主包只保留会话内定长诊断槽、启动时间和一次性启动标记状态，不导入诊断仓库类、报告或 profile 解析。
- 删除旧 `platform/runtime-directory-diagnostics-bridge.ts` 与 organization `search-diagnostics.ts`；
  component/独立 Page 共享同一 organization controller 产物和轻量诊断 bridge。
- develop/trial 可设置“下次 App 启动首次搜索诊断”；持久化对象仅含 schema/armedAt/expiresAt，
  新 `App.onLaunch` 立即消费，release 清除且不启用。`onShow` 恢复不会消费，并能标记 warm resume。
- 记录跨“测试工具 → 通讯录 → 测试工具”停留在同一 App 会话槽，不持久化关键词、号码、工号、
  账号、群组、权限、筛选、结果或诊断记录。
- 报告使用“数据提交完成”“下一渲染周期完成”；记录 `profileEnabled`、诊断序列化耗时、字节估算和截断。
- 固定上限：请求 20、错误 10、性能 12、通讯录 20 条；单条 4096 B、复制 24576 B、Header 值
  4096 字符、request ID 64 个 `[0-9A-Za-z._:-]` 字符。原始 response/header/profile/参数即时丢弃。
- transport 保留最终 capability/上下文门禁；未恢复 controller 搜索前重复等待。等待、失败、无权限、
  卸载、上下文变化、请求复用/锁释放和旧响应隔离均有直接组合回归。
- 半屏外层只按实时 `windowHeight × 50%`；安全区只作内部 padding。监听注册前先解除旧 handler，
  detach 解除；WXS 仅绑定拖拽横条，96 px/28 px/0.65 阈值、回弹和内部 scroll-view 边界保持。

## 自动证据

| 项目             | 结果                                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| 定向回归         | controller 44、test-tools 15、transport 16、纠偏边界 6 项通过                                            |
| Mini 全量稳定性  | 同一命令连续两次均 111 files / 578 tests / 0 skipped                                                     |
| 仓库非 Mini 全量 | 242 files / 1,132 tests 通过；37 files / 355 tests 因无隔离测试数据库跳过                                |
| 旧 561/560 差异  | 唯一多项为脏主树未提交测试 `renders member rows without combining wx:else and wx:for on one element`     |
| 包体基线→clean   | total 5,280,739→5,115,045；main 1,680,271→1,678,747（app.js −7,977）；organization 1,231,973→1,053,980 B |
| 包边界           | 报告/复制只在 diagnostics；profile/header 白名单解析只在 organization bridge；App/热入口无重型报告符号   |
| 工具链           | Node 24.14.0、pnpm 11.9.0、仓库 lockfile、production profile                                             |

## 历史措辞纠正

- 阶段 A 代码曾提交并推送；当时 production 只同步 release 元数据，API/Web 制品和容器未变化。
- `.72`、`.73` 是历史体验上传，不代表本轮代码已部署给体验用户。
- 小程序、文档与 API/Web production 是独立轨道；纯小程序/文档 checkpoint 不自动触发生产操作。

## 未验证与唯一下一任务

- 仓库禁止代理调用微信开发者工具 GUI/CLI；本轮没有微信原生 Console、Network 或拖拽手感证据。
- Web/Node 证据不作为微信原生验收；capability 已放行，开发版即体验版，平台是否已显示标准 CLI
  重传的 `.75` 仍待用户刷新确认。
- 唯一下一任务：用户确认平台/小程序显示 `.75@24a847f` 后，只收集该构建的小米 14 诊断数据；数据返回前
  不开始阶段 B 优化，不再次上传、修改 allowlist、部署、备份或同步 release。
