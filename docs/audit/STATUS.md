# 微信小程序审计状态

- 当前阶段：test-tools Skyline Warning 语义回归已向前修复、验证并上传 `.76@a2cdd06`；任务完成关闭
- 本轮起始基线：`89cafa28ce3b5bc0e3805ac163491738f3d89b49`；独立 worktree/分支
  `codex/finalize-test-tools-skyline-semantic`，用户脏主工作树未修改
- 当前源码 checkpoint：`a2cdd0651783538a0aa6a566d30922391752d528`，消息
  `fix(miniprogram): restore test tools Skyline compatibility`
- 提交关系：历史 `d23a78a9` 与主线 `a9021c4e` 的 merge-base 均为 `a2326618`；`a9021c4e` 是当前
  主线祖先，`d23a78a9` 是历史验收侧枝。主线保留通讯录纠偏并由本轮最小向前修复恢复兼容不变量。
- `.72@5fff288`、`.73@c7c142e`：历史已上传版本
- `.74@d23a78a`：历史 test-tools 清理体验版，用户已在小米 14 按清单确认入口、按钮、长文本、
  滚动和顶部胶囊附近操作无异常；该真机结论只属于 `.74@d23a78a`，不是当前主线实机结论
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
- 小米 14 证据：5 条均完成且与 production request log 逐一匹配；页面会话首次搜索 10,016ms，
  后续 4 次中位 471ms。首次服务端 9,942ms、主查询 9,696ms；后续中位分别 404.5/209.5ms。
- 首次主查询占总耗时 96.8%，响应后到下一渲染周期 21ms，服务端外首字节差值 40ms；诊断序列化
  0ms。API `cold=false`，`instanceAge=600000ms` 是客户端上限，表示实例至少存活 10 分钟而非恰好 10 分钟。
- 首批真机证据文档 checkpoint 以 `docs(audit): record .75 first-search evidence` 识别；不触发外部状态
- 第二批 5 条 request ID 亦全部匹配 production HTTP 200；新 App 启动首搜 685ms、服务端 617ms、
  主查询 412ms，较首批异常分别低 93.2%/93.8%/95.8%。响应后 21ms、服务端外首字节差值 32ms。
- 第二批 `#4` 虽为“页面会话首次”，但与 `#5` 共存于同一内存报告，App 启动累计时间从 5,949ms
  增至 17,863ms；它是同一 App 运行会话内第二次通讯录挂载，不是第二个独立 `App.onLaunch` 样本。
- 第二批真机证据文档 checkpoint 以 `docs(audit): record .75 first-search repeat` 识别；不触发外部状态
- 第三次独立启动报告仅 1 条记录，request ID 匹配 production HTTP 200/705.3ms；总计 799ms、
  TTFB 741ms、服务端 705ms、主查询 505ms、服务端外 36ms、响应后 44ms、诊断序列化 0ms。
- 三次独立 App 首搜为 10,016/685/799ms；中位 total/TTFB/server/main 为 799/741/705/505ms。
  两次连续复测均亚秒，首批 10 秒只保留为一次偶发服务端 rows/main-query 长尾，不启动优化。
- 第三批收口文档 checkpoint 以 `docs(audit): close .75 first-search sampling` 识别；不触发外部状态
- 用户已在小米 14 上确认半屏高度、横条下滑关闭与短拖回弹、列表滚动不误关、固定“清除全部筛选”
  四项全部通过；半屏真机收口 checkpoint 以 `docs(audit): close .75 Xiaomi half-sheet acceptance` 识别
- `.76@a2cdd06`：2026-09-01 从 exact clean 源码经标准 `pnpm miniprogram:upload-experience` 上传成功；
  描述 `p10-test-tools-skyline-a2cdd06`，`buildDirty=false`，191 code files、ZIP 2,446,002 B、manifest
  `e50d001d…f027`；未提审、未正式发布、未改 allowlist、production、数据库或服务器 release

## test-tools Skyline 语义收口

- 当前主线在 `a9021c4e` 轨道保留通讯录启动诊断，但其 test-tools 文件仍继承 `a2326618` 的旧 Grid、
  `overflow-wrap:anywhere` 和 `:last-of-type`；本轮判定为明确语义回归，不回退通讯录功能。
- 最小向前修复：四处改为 `word-break:break-all`；报告按钮与场景操作改为可换行 Flex；报告按钮
  `flex:1;min-width:0`，链接区 `flex:1;min-width:0`，正常/异常固定 54px；320px 链接与报告按钮换行；
  截图文本恢复明确 `.scenario-screenshot`。
- 页面仍为 `disableScroll:false`；正常/异常继续绑定 `handleScenarioResult`，动态测试确认 `passed/issue`
  即时更新。通讯录新增的下次启动标记、诊断字段、隐私上限和复制逻辑均保留。
- 当前源码和 production dist 中 `display:grid`、`grid-template-columns`、`overflow-wrap:anywhere`、
  `:last-of-type` 均为 0；四处长文本兼容换行规则均存在。
- 当前 SHA 的真实开发者工具为 Stable `2.02.2608040`、基础库 3.17.1、Skyline、develop；390px
  页面显示 `.76@a2cdd06`，fresh Console 及截图后 Console 均无应用 error，目标 9 条页面级 Warning 为 0。
  仅两条 `tagNameStyleIsolation` 环境提示保留，基础库环境/线上最低基础库提示仍是独立项目。
- 已知 `getPageMetaByWebviewId(...)=null` 属开发者工具 automator/inspectee 环境问题；本轮未复现，
  也不作为源码修复目标。320/390/412、长文本、点击合同、纵向滚动与无横溢由当前静态/Node 自动化覆盖。

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
| test-tools 收口  | 红灯 15/16→定向 17/17；Mini 111 files/580 tests；TypeScript/build/verify/dry-run/Console 均通过          |

## 历史措辞纠正

- 阶段 A 代码曾提交并推送；当时 production 只同步 release 元数据，API/Web 制品和容器未变化。
- `.72`、`.73` 是历史体验上传，不代表本轮代码已部署给体验用户。
- 小程序、文档与 API/Web production 是独立轨道；纯小程序/文档 checkpoint 不自动触发生产操作。

## 验收边界与唯一下一任务

- 历史 `.74@d23a78a` 小米 14 test-tools 验收与 `.75@24a847f` 半屏验收均只适用于各自 SHA；当前
  `.76@a2cdd06` 的结论是“保留已真机验收的不变量，并通过当前 SHA 自动化及开发者工具回归”，不得写成
  “当前 SHA 已完成小米 14 实机测试”。
- 三个独立启动首搜已有 1 次 10 秒异常、2 次连续亚秒复测；样本不足以估算长尾发生率，但足以拒绝
  “每次首次搜索必慢”和立即改索引/缓存。以后若 total >2,000ms 或 server main query >1,500ms，
  再复制单条记录并升级调查。
- 主包 1.5 MiB 提示进入包体积审计；1445/1506 节点提示进入“页面状态、异步链路与列表性能”问题组；
  既有冷构建固定时限波动不直接等同用户侧性能；绑定状态 503 仅在再次复现并取得直接证据时调查。
- 本轮到 docs-only 收口 checkpoint 后停止。唯一下一任务是从最终 `origin/main` SHA 开始“静态审计
  第 1 组：页面状态、异步链路与列表性能”；本轮不执行该组，不再次上传或操作外部状态。
