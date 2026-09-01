# 微信小程序审计报告

- 审计阶段：test-tools Skyline 语义回归最终收口；起始主线为 clean `89cafa28ce3b5bc0e3805ac163491738f3d89b49`
- 更新时间：2026-09-01（Asia/Hong_Kong）
- 当前源码 checkpoint：`a2cdd0651783538a0aa6a566d30922391752d528`；前驱通讯录纠偏
  `a9021c4ebc0398b42c99a23a06a0db8b7dcc3dd4` 保持在主线
- 历史体验构建：`.72@5fff288`、`.73@c7c142e`、`.74@d23a78a`、`.75@24a847f`
- 当前体验构建：`.76@a2cdd06`，描述 `p10-test-tools-skyline-a2cdd06`，已上传
- 本轮上传源码：`24a847ffdeec5899ab7c9d505c740b715df3ef6e`；`.75@24a847f` 已用仓库标准 CLI
  重传，开发版即体验版，无额外网页设置
- 本批性质：独立 worktree 的纯小程序/文档纠偏；代码阶段不操作 API、数据库、production 或用户脏主树；
  上传后仅按用户单独授权追加 `.75` production allowlist

## 2026-09-01 test-tools Skyline 修复语义核验与最终收口

### 提交关系与结论

- 历史真机验收源码 `d23a78a9d0f9769102957ecefd6f6781a37f06d2` 与通讯录纠偏提交
  `a9021c4ebc0398b42c99a23a06a0db8b7dcc3dd4` 的 merge-base 均为 `a2326618`；`a9021c4e`
  已进入主线，`d23a78a9` 未进入主线，只保留为 `.74` 历史验收证据。
- `a9021c4e` 的通讯录诊断功能本身继续保留，但其 test-tools 文件仍继承旧基线：四处
  `overflow-wrap:anywhere`、两组 Grid/四处 `grid-template-columns`、一处 `:last-of-type` 及缺失的
  兼容回归合同均存在。因此当前实现属于“本轮重新向前修复”，不是回退通讯录，也不是整体覆盖旧文件。
- 当前源码 checkpoint 为 `a2cdd0651783538a0aa6a566d30922391752d528`：仅修改 test-tools WXML、
  WXSS 和直接测试；通讯录下次启动标记、诊断字段、隐私上限、复制报告和目录 controller 保持不变。

### 当前不变量与自动证据

- 四处长文本使用 `word-break:break-all`；目标 Grid 与 `grid-template-columns` 成对清除；截图文字使用
  `.scenario-screenshot`。报告按钮为可换行 Flex 且各 `flex:1;min-width:0`；场景链接
  `flex:1;min-width:0`，正常/异常固定 54px；320px 下报告按钮纵向、链接独占一行。
- 定向测试先在当前主线得到 15/16 红灯，修复后 17/17；动态调用确认同一
  `handleScenarioResult` 对 `passed/issue` 立即更新，WXML 事件绑定、`disableScroll:false` 和页面纵向
  滚动架构不变。320/390/412 宽度、固定按钮余量、长文本和无横溢由当前合同测试覆盖。
- 当前 SHA：Mini 111 files/580 tests、TypeScript、276-file production build、Mini verify、CI dry-run、
  ESLint/Prettier/core smoke 均通过。verify：package 5,114,546 B，Worklet 2/2，矩阵 1445/1506，
  manifest `65494ddc…80d0`；dry-run manifest `1b91f003…d473`。
- 当前源码和新 dist 对 `display:grid|grid-template-columns|overflow-wrap:anywhere|:last-of-type` 扫描均
  为 0，四处 `word-break:break-all` 均存在。构建标识
  `0.1.0-p10.20260901.76@a2cdd06`、描述 `p10-test-tools-skyline-a2cdd06`、`buildDirty=false`。

### 开发者工具、上传和证据边界

- 当前 SHA 在真实微信开发者工具 Stable `2.02.2608040`、基础库 3.17.1、Skyline、develop 下编译并
  打开 test-tools；390px 截图显示 `.76@a2cdd06`。fresh Console 与截图后 Console 的应用 error 均为
  0，目标 9 条页面级 Warning 为 0；仅两条独立 `tagNameStyleIsolation` 环境提示。
- 已知 `getPageMetaByWebviewId(...)=null` 是 automator/inspectee 环境问题，不是源码故障；本轮未重复
  触发，也未据此修改业务代码。基础库灰度/线上最低版本提示继续作为独立环境事项。
- `.76@a2cdd06` 已从 exact clean 源码经标准 `pnpm miniprogram:upload-experience` 上传：191 code files、
  ZIP 2,446,002 B、manifest `e50d001d…f027`。未提交审核、未正式发布、未灰度、未改 production、
  allowlist、数据库、备份或服务器 release。
- 历史 `.74@d23a78a` 已由用户在小米 14 按 test-tools 清单确认无异常；该真机证据不能改写为当前
  `.76@a2cdd06` 已真机验证。当前准确结论是：主线已重新向前恢复历史真机验收的不变量，并通过当前
  SHA 的自动化与真实开发者工具回归。
- 后续 docs-only 收口提交 SHA 与体验版源码 SHA 必然不同；docs-only 提交只记录证据，不得描述为
  `.76` 体验版源码，也不触发再次上传或任何 production 操作。

### 留待后续问题组

- 主包 1.5 MiB 提示进入包体积审计；矩阵节点 1445/1506 进入“页面状态、异步链路与列表性能”。
- 既有首次冷构建固定时限波动不能直接作为用户侧性能问题；绑定状态 503 只有再次复现并取得直接
  证据时才重新调查。test-tools Skyline Warning 清理在本轮完成并关闭。

## 普通用户版结论

本轮把诊断重型实现从 App 和重复的通讯录入口中移出，增加一次性的“下次 App 启动首次搜索诊断”，
并把字节估算、序列化耗时、warm resume、profile 开关和截断语义写清。诊断记录仍只在当前 App 会话
内；正式 release 清除一次性标记且不创建诊断槽。统一 transport、鉴权、capability、重试、错误映射
和请求复用保持不变。

同一 Mini 命令连续两次均为 111 files/578 tests/0 skipped。包体相对 clean 基线总包净减 165,694 B，
main 净减 1,524 B（其中 `app.js` 净减 7,977 B），organization 净减 177,993 B。用户已在
`.75@24a847f` 的小米 14 上确认半屏高度、关闭/回弹、内部滚动与固定清除入口四项原生交互通过；
仓库规则禁止代理操作微信开发者工具，因此原生 Console/Network 输出仍未采集。

### 上传结果（2026-09-01）

- 用户批准的唯一版本 `0.1.0-p10.20260901.75` 首次直接 SDK 调用虽返回成功，但用户确认平台最新
  仍为 `.74`，因此不把该响应作为有效上传。20:27:38 +08:00 从 exact clean SHA 使用仓库标准
  `pnpm miniprogram:upload-experience` 重传成功；描述 `p10-preupload-diagnostics-24a847f`，AppID
  `wx56a7a21f974fd9af`，production API 为 `hosp.schedule.eylinhome.top`。
- 上传前重新生成 `dist`，HEAD/洁净度、profile、显示标识和本地标记扫描均通过；manifest 精确为
  `be28692545891baf083dda498b4c45587e144d7e6601b4dd62f9d80f5dcf129f`。
- 标准 CLI 官方编译返回 191 code files、上传 ZIP 2,445,701 B；本地 production 包审计为
  5,114,602 B。CLI 完成行再次返回 `.75` 与批准 manifest；平台最新版本显示仍待用户刷新确认。
- `.75` 初始 capability 为 HTTP 426；用户随后单独授权可信 add-only allowlist。20:10:36 +08:00
  追加完成，API/Web 重建，首个 TLS EOF 在内置健康等待中恢复；`.75`/`.73` 公网均为 200 且七维
  全 true，动态未知版本仍为 426，可信 `verify` 通过。
- live release 保持 `a23266182122c6e2fcb5ca5aba5d8857ef781910`；未重建 MySQL、未创建生产备份、
  未同步服务器 release。未调用微信开发者工具、未提审、正式发布或开始阶段 B 优化。
- 用户确认本项目开发版即体验版，不存在额外网页“设为体验版”步骤；后续只核对平台/小程序显示的
  版本，再进入小米 14 数据采集。

### `.75@24a847f` 小米 14 首批启动诊断

- 用户回传 5 条人员模式完成记录，构建字段精确为 `.75@24a847f`；5 个 request ID 均与 production
  API 脱敏完成日志匹配并返回 HTTP 200，服务端完成时间分别为 9,942.9、365.6、405.9、632.6、
  403.9ms，与客户端 Server-Timing 一致。
- 记录按时间倒序展示，真正的页面会话首次搜索是 `#5`：总计 10,016ms、首字节 9,982ms、服务端
  9,942ms、主查询 9,696ms。后续 4 次中位为总计 471ms、首字节 438ms、服务端 404.5ms、主查询
  209.5ms；首次分别约为 21.3/22.8/24.6/46.3 倍。
- 首次主查询占总耗时 96.8%、占服务端 97.5%；计数 184ms、权限 19ms、别名 21ms、数据库连接等待
  1ms，均不是该次长尾主因。服务端外首字节差值 40ms，响应后到下一渲染周期 21ms，诊断序列化
  0ms，客户端转换/卡片/setData 不是瓶颈。
- 一次性启动标记、新 `App.onLaunch`、非 warm resume 和页面会话首次均正确记录。App 启动到搜索确认
  6,878ms，叠加搜索后约 16,894ms 才到下一渲染周期；页面加载到该周期约 14,732ms。这里是 App
  启动诊断，不宣称操作系统进程冷启动。
- API 报告 `cold=false`；`instanceAge=600000ms` 来自客户端 10 分钟安全上限，只能解释为 API 实例
  至少存活 10 分钟，不能解释为恰好 10 分钟，也不能代表数据库缓存已热。
- 当前只有 1 个独立 App 启动后的首次样本，且 5 条均为“完成结果复用否/进行中复用否”；因此证据
  高置信定位到一次服务端 rows/main-query 长尾，但尚不能区分可重复的首次查询问题、查询词选择性或
  数据库/OS 页缓存的一次性预热。下一步先重复 2 个独立启动的同查询首搜，不直接改索引或缓存。

### `.75@24a847f` 小米 14 第二批启动诊断

- 第二批 5 个 request ID 也逐一匹配 production `/employee-directory` HTTP 200，API 完成时间为
  618.4、667.7、164.4、291.2、406.2ms，与报告 Server-Timing 一致；其中 1 条被后续搜索替代，
  服务端仍完成但页面只保留 362B 诊断状态、没有提交旧结果，生命周期隔离符合设计。
- 新 App 启动后的真正首搜是倒序列表 `#5`：总计 685ms、首字节 649ms、服务端 617ms、主查询
  412ms；相比首批异常低 93.2%/93.5%/93.8%/95.8%，10 秒长尾没有复现。服务端外首字节差值
  32ms、响应后到下一渲染周期 21ms、诊断序列化 0ms，客户端与网络口径继续稳定。
- 当前 App 启动到首搜确认 5,949ms，到下一渲染周期约 6,634ms；通讯录页面加载到该周期约 4,590ms。
  首个通讯录页面约在 App 启动后 2,044ms 加载，与首批约 2,162ms 接近，App/页面启动本身没有 10 秒差异。
- `#4` 也是“页面会话第 1 次”，但其 App 启动累计确认时间为 17,863ms，且同一内存报告仍含 `#5`；
  它表示同一 App 运行会话中第二次挂载通讯录，而不是第二次独立 `App.onLaunch`。该页会话首搜同样
  仅 725ms（服务端 667ms、主查询 438ms）。
- 综合两批，目前只有 2 个独立 App 启动首搜样本：10,016ms 与 685ms。高置信结论从“首搜必慢”
  收敛为“一次不可重复的服务端 rows/main-query 长尾”；更像查询/数据库页缓存或偶发资源竞争，尚无
  证据支持客户端改造或立即加索引。再取 1 个独立启动同查询样本后决定停止观察或升级调查。

### `.75@24a847f` 小米 14 第三次独立启动与性能收口

- 第三次报告只有 1 条记录，满足独立运行会话判据：页面会话第 1 次、一次性标记自动开启、新
  `App.onLaunch`、非 warm resume、无完成/进行中复用。request ID 对应 production HTTP 200，API
  日志实测 705.3ms，与报告 705ms 一致。
- 该次 total/TTFB/server/main=799/741/705/505ms；服务端外差值 36ms、响应后到下一渲染周期 44ms、
  诊断序列化 0ms。服务端占总计 88.2%，主查询占总计 63.2%，仍是最大阶段但处于亚秒范围。
- App 启动到搜索确认 6,713ms、到下一渲染周期约 7,512ms；页面加载到该周期约 5,946ms。确认时间
  包含用户操作，不能当作自动首屏启动指标；本次页面约在 App 启动后 1,566ms 加载。
- 三次独立 App 首搜为 10,016/685/799ms，中位 total/TTFB/server/main=799/741/705/505ms；第三次
  相比首批异常低 92.0%/92.6%/92.9%/94.8%。两次连续复测均亚秒，10 秒事件定性为偶发服务端
  rows/main-query 长尾，不执行客户端重构、索引、查询或预热修改。
- 后续转被动观察：若同构建再出现 total >2,000ms 或 main query >1,500ms，保留最近一次脱敏记录并
  再评估查询计划/缓存；否则不继续为单个不可复现样本扩大生产范围。性能诊断项收口。

### `.75@24a847f` 小米 14 半屏原生验收

- 用户明确回报四项全部通过：弹层高度约半屏；横条下滑达到阈值可关闭且短拖未达阈值会回弹；
  列表内部滚动不会误关闭弹层；“清除全部筛选”保持固定可见。
- 该结论是当前构建在小米 14 Android 微信体验版上的原生交互证据，不以 Web 黄金图代替，也不外推为
  iOS、全部安卓或全平台兼容。代理受仓库规则限制未采集微信开发者工具 Console/Network 输出。
- 至此本轮上传前纠偏审计的真机交互项与性能采样均收口；后续仅按既定阈值被动观察长尾，不启动阶段 B
  优化，不再次上传或操作 allowlist、production、数据库备份与服务器 release。

## 2026-09-01 体验版上传前纠偏审计

- 测试数量：旧报告 561/560 的唯一差异是用户脏主树未提交测试
  `renders member rows without combining wx:else and wx:for on one element`；clean `5fff288f` 不含该项，
  也没有条件注册、环境 skip、生成文件或本任务漏提交测试造成差异。
- 架构：App 仅保留定长会话槽；删除旧 platform bridge 和 organization `search-diagnostics`。
  component/独立 Page 共同引用一个 organization controller 和一个诊断 bridge；报告、复制和截断文案
  只进入 diagnostics 分包。通用 transport 只保留可选观察钩子和通用上下文失效检查。
- 启动诊断：develop/trial 可持久化一次性 schema/armedAt/expiresAt 标记；新的 `App.onLaunch` 立即
  消费，首次 `onShow` 不记 warm，后续恢复记 warm resume。release 清除标记且不启用；记录跨页面但
  不落 storage。
- 指标与隐私：响应/setData 大小由诊断开启时的 `JSON.stringify` 估算，耗时单列，不混入卡片构建；
  setData callback 和 nextTick 分别称“数据提交完成”“下一渲染周期完成”。原始 response、header、
  profile、URL 参数和搜索内容不入仓库或报告。
- 硬上限：request/error/performance/directory 为 20/10/12/20 条，单条 4096 B，复制 24576 B，
  Header 值 4096 字符，request ID 64 个白名单字符。超限值丢弃或安全截断并标记。
- capability/lifecycle：新增尚未初始化、加载失败、等待中卸载、等待中群组变化的组合回归；既有
  无权限零请求、相同请求共享、失败锁释放和旧响应隔离继续通过。transport 仍是最终安全门禁。
- 半屏：外层只按实时 `windowHeight × 50%`；安全区只作内部 padding，`box-sizing`、flex 收缩、
  监听解除、WXS 阈值/回弹和列表滚动边界均有静态或 Node 证据。
- 历史措辞：阶段 A 代码曾提交并推送；当时 production 只同步 release 元数据，API/Web 制品和容器
  未变化。`.72/.73` 为历史上传；纯小程序/文档变更不能通过服务器 release 同步被描述为“部署给体验用户”。
- 操作边界：本轮没有上传、production 部署、生产数据库备份或服务器 release 同步。以后若获准部署，
  rollback candidate 必须从服务器当前 live release 读取。

## 1. 基线边界与工作树

采集开始时 `HEAD=59b1f3c5`，工作台无外层滑动宿主修复已在 `fe12db53` 提交并完成既有发布流程。
以下内容是开始前已存在的用户未提交内容，本轮未覆盖、未暂存、未修复：

- `apps/miniprogram/project.config.json`
- `apps/miniprogram/scripts/group-settings-page.test.mjs`
- `apps/miniprogram/src/subpackages/organization/components/group-settings-panel/index.wxml`
- `.agents/`、Web UI2 草稿、根 `src/`、`runtime/`、工作簿等既有未跟踪内容

因此本报告的包体和自动测试反映“当前工作树”。正式发布比较必须再从指定 clean commit 重测。
阶段 0 的构建只刷新 ignored 的 `apps/miniprogram/dist/`，没有改业务源码。

## 2. 实际读取的 Skill 与可用执行面

### 已成功读取

- `miniprogram-development`：小程序结构、构建、调试/预览和发布边界。
- `previewer`：体验上传前置、结果真实性与失败处理边界；执行面由仓库规则收敛为 Node
  `miniprogram-ci`，没有调用其微信开发者工具路径。
- `wechatide-skill`、`initializer`、`compiler`、`debugger`：此前用于确认环境、编译和
  Console/Network 取证边界；仓库政策继续禁止调用执行面。

当前环境还列出了 `automator`、`project-config`、`cloudbase-operator`、`cloudbase-platform` 等相关
Skills。本项目未使用 CloudBase，也没有自动化微信开发者工具或修改公众平台配置；本轮只加载
`previewer` 的发布规则，并通过仓库 Node `miniprogram-ci` 完成已批准的体验上传。

测试工具批次新增实际读取：`brainstorming`（确认安全方案与影响）、`miniprogram-development` 及变更
安全/调试参考、`frontend-design`（设备体检单视觉方向）、`systematic-debugging`（定位 Storybook
隐藏控件、favicon 404 与状态行数门禁）和 `previewer`（上传授权与失败边界）；体验上传执行面按仓库
规则收敛为 Node `miniprogram-ci`。

### 微信开发者工具和 MCP

- 以下四项是阶段 0 当时的执行面记录，已被本文顶部 2026-09-01 当前 SHA 证据补充；不得当成
  test-tools 收口轮次的现状。
- 阶段 0 时 PATH 中可发现 `wechatide.cmd`，但未执行，也没有把“命令存在”写成“工具已就绪”。
- 阶段 0 会话没有暴露可直接调用的微信小程序/CloudBase MCP 工具，并按当时仓库政策未操作 GUI/CLI。
- 阶段 0 实际使用仓库 Node/TypeScript/Vitest/esbuild/包体脚本；后续上传使用 Node `miniprogram-ci`。

### 工具限制导致的未验证项

本段只记录阶段 0 当时的未验证项：开发者工具编译、Console/Network、页面启动/切换、真实请求数、
白屏、软键盘、原生 Skyline 布局和小米 14 体验版当时均为“当前工具无法测量，暂未验证”。当前
test-tools Console/Skyline/390px 与历史 `.74` 小米 14 证据以本文顶部收口章节为准。

## 3. 技术栈与工程结构

| 项目       | 当前事实                                                              | 证据                                      |
| ---------- | --------------------------------------------------------------------- | ----------------------------------------- |
| 技术栈     | 原生微信小程序；TypeScript、WXML、WXSS、JSON、WXS                     | `apps/miniprogram/package.json`、`src/`   |
| 小程序目录 | `apps/miniprogram`                                                    | `project.config.json`                     |
| 源码目录   | `apps/miniprogram/src/`                                               | `scripts/build-tools.mjs`                 |
| 构建目录   | ignored 的 `apps/miniprogram/dist/`                                   | `miniprogramRoot: "dist/"`                |
| 构建器     | esbuild，CJS/ES2020、压缩、tree-shake；另跑 `tsc --noEmit`            | `scripts/build-tools.mjs`                 |
| renderer   | 全局 Skyline，`disableABTest: true`，范围 3.3.0–15.255.255            | `src/app.json`                            |
| 组件框架   | `glass-easel`                                                         | `src/app.json`                            |
| WebView    | 无 fallback                                                           | `src/app.json`、小程序架构文档            |
| 懒加载     | `requiredComponents`                                                  | `src/app.json`                            |
| 导航栏     | 全局 `navigationStyle: "custom"`                                      | `src/app.json`                            |
| tabBar     | 无原生 `app.json.tabBar`；工作台自绘五入口                            | `pages/workbench/index.wxml`              |
| 后端       | 自建 Fastify + MySQL + Drizzle + Zod API                              | 根 README、`apps/api/package.json`        |
| 云开发     | 未发现 `wx.cloud`、`cloudfunctionsRoot` 或 CloudBase envId            | 小程序源码/配置搜索                       |
| 状态       | App `globalData` + Page/Component data + controller；无 Pinia/Redux   | `src/app.ts`、页面 controller             |
| 请求       | 统一 `wx.request`/`wx.downloadFile`；Bearer、401 恢复、幂等和有限重试 | `src/platform/`                           |
| 缓存       | 私有 storage；会话、群组/月度工作台缓存；24h 只读缓存，无离线写队列   | `private-storage.ts`、`workbench-read.ts` |

阶段 0 当时本地配置显示基础库 3.17.1，但含用户未提交变化，因此当时不能作为 clean Git 或实体机
证据。当前收口轮次已由 clean worktree 的临时 private 配置和真实 Console 独立确认基础库 3.17.1。

## 4. 主包、分包与页面

主包 9 页，`app.json.pages` 首项 `pages/identity/index` 是默认启动页：

- identity、profile、workbench、index
- calendar PoC、manual-matrix PoC、gesture probe
- identity/unbind、admin-bind/preview

五个普通分包共 16 页，均未设置 `independent`，因此没有独立分包：

| 分包                       | 页面                                                                            |
| -------------------------- | ------------------------------------------------------------------------------- |
| `subpackages/scheduling`   | manual、backfill                                                                |
| `subpackages/organization` | group-settings、scheduling-config、invite-visitor、platform-accounts、directory |
| `subpackages/workflows`    | leave、swap、duty                                                               |
| `subpackages/insights`     | visitor-access、insights、notifications、exports、notification-settings         |
| `subpackages/diagnostics`  | test-tools（develop/trial；release 失败关闭）                                   |

## 5. 修改前编译、错误和警告基线

| 检查                     | 结果         | 耗时/数量                                     | 说明                                                                                                |
| ------------------------ | ------------ | --------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `pnpm miniprogram:build` | 通过         | 2.60s；268 files                              | production 静态构建；esbuild 配置为 silent，命令未输出 error/warning，但不能推断 DevTools Console=0 |
| Mini TypeScript          | 通过         | 3.57s；0 error                                | `pnpm --filter @schedule/miniprogram typecheck`                                                     |
| Mini 自动测试            | 通过         | Vitest 80.11s；107 files/517 tests；0 failure | `pnpm miniprogram:test`                                                                             |
| Mini 完整静态验证        | 通过并有预警 | 7.10s；3 个预警                               | `pnpm miniprogram:verify`                                                                           |
| 根 workspace TypeScript  | 通过         | 19.48s；10 projects                           | `pnpm typecheck`                                                                                    |
| ESLint                   | 未通过       | 约 30.0s；1 error/0 warning                   | `wx-request-executor.ts:141:9` 的 `prefer-const`；阶段 0 未修复                                     |
| Prettier format check    | 未通过       | 16.30s；387 files                             | 既有全仓格式差异；未运行写格式化                                                                    |
| DevTools Console         | 暂未验证     | error/warning 均无数据                        | 仓库禁止代理调用开发者工具 GUI/CLI                                                                  |

Mini 静态验证的 3 个预警：

1. 主包超过内部 1.5 MiB 预警线，但未到 1.8 MiB 阻断线或官方 2 MiB 硬限制。
2. manual-matrix PoC 展开宿主 1,445 nodes，目标 `<1000`。
3. `subpackages/scheduling/pages/manual` 展开宿主 1,506 nodes，目标 `<1000`；600 个逻辑格场景目前按 best-effort 记录。

验证还确认 Worklet source/output 为 2/2，构建确定性 manifest 为
`9fb6e50e376c19305618790f9ea9055cdf6bc541ed89c8e5cd66a5d9986003f4`。桌面逻辑测得
matrix ViewModel 171,340 bytes、构建 0.49ms、tap 0.23ms；这些只代表桌面逻辑计时，不能当作小米 14
渲染或点击性能。

## 6. 包体积基线

命令：`pnpm miniprogram:package-audit`，exit 0，1.42s。

| 范围         |     bytes | MiB（约） | 门禁状态         |
| ------------ | --------: | --------: | ---------------- |
| 主包         | 1,636,609 |     1.561 | 内部预警；未阻断 |
| scheduling   |   420,884 |     0.401 | 通过             |
| organization | 1,171,597 |     1.117 | 通过             |
| workflows    |   821,914 |     0.784 | 通过             |
| insights     | 1,056,800 |     1.008 | 通过             |
| 总包         | 5,107,804 |     4.871 | 通过             |

按扩展名聚合：JS 4,356,322 bytes（67 个）、WXML 343,219（55）、WXSS 314,588（58）、JSON
60,159（59）、WXS 26,298（4）、SVG 7,218（26）；产物中没有 PNG/JPG/font 文件。

### 最大的 20 个构建文件

|   # | `dist/` 相对路径                                                |   bytes |
| --: | --------------------------------------------------------------- | ------: |
|   1 | `pages/workbench/index.js`                                      | 201,817 |
|   2 | `subpackages/scheduling/pages/manual/index.js`                  | 185,201 |
|   3 | `subpackages/organization/pages/group-settings/index.js`        | 184,669 |
|   4 | `subpackages/workflows/pages/swap/index.js`                     | 179,511 |
|   5 | `subpackages/workflows/components/workflow-swap-panel/index.js` | 179,152 |
|   6 | `subpackages/workflows/pages/duty/index.js`                     | 176,165 |
|   7 | `subpackages/workflows/pages/leave/index.js`                    | 175,637 |
|   8 | `components/profile-workspace/index.js`                         | 173,568 |
|   9 | `pages/profile/index.js`                                        | 171,325 |
|  10 | `subpackages/organization/pages/directory/index.js`             | 169,054 |
|  11 | `subpackages/organization/components/directory-panel/index.js`  | 168,738 |
|  12 | `subpackages/organization/pages/scheduling-config/index.js`     | 168,138 |
|  13 | `subpackages/scheduling/pages/backfill/index.js`                | 166,207 |
|  14 | `subpackages/insights/pages/notification-settings/index.js`     | 165,159 |
|  15 | `subpackages/insights/pages/notifications/index.js`             | 165,156 |
|  16 | `subpackages/insights/components/notifications-panel/index.js`  | 164,840 |
|  17 | `subpackages/insights/pages/insights/index.js`                  | 161,285 |
|  18 | `subpackages/insights/pages/exports/index.js`                   | 159,470 |
|  19 | `subpackages/organization/pages/invite-visitor/index.js`        | 158,830 |
|  20 | `subpackages/organization/pages/platform-accounts/index.js`     | 155,505 |

精确内容重复扫描只发现很小的 JSON/WXML/WXSS 组，最大单组可节省 1,056 bytes；未发现完全相同的
大型 JS 或图片重复。esbuild metafile 中累计输入贡献最大的是生成的 `calendar-schemas.ts`，跨多个入口
合计 2,579,338 bytesInOutput；这是跨入口重复打包贡献指标，不是一个实际物理文件的大小。是否优化需在
后续专项审计中结合依赖图证明，本阶段不下结论、不修改。

## 7. 测试与验收方式

- Vitest：Mini 唯一全量入口 `vitest run --dir scripts --fileParallelism=false`。
- `miniprogram-simulate`：组件树、props、events、state；不能证明原生视觉或手感。
- `tsc --noEmit`、WXML/WXSS/JSON/source/output、Worklet、页面边界、handler、确定性、包体和静态性能门禁。
- PNG + mask 自有视觉比较器；只有真实截图时才有验收意义。
- 未采用 Minium 或 MiniTest。
- 微信开发者工具由用户人工操作；小米 14 体验版是主真机标准。

## 8. 当前问题清单

### MINI-DIR-001（P1）：筛选可在 facets 未就绪时打开为空，完整选项树长期进入视图状态

- 普通解释：用户点筛选会看到没有任何内容的弹层；数据加载完成后，页面又会把科室和人员两套完整筛选树长期留在视图层，增加传输和渲染负担。
- 技术原因：`handleOpenFilters` 没有 facets 就绪门禁；`syncFilterSections` 在双模式加载后立即生成完整 options 并写入 page data，关闭弹层不释放。
- 位置：`apps/miniprogram/src/subpackages/organization/components/directory-panel/controller.ts`、`index.wxml`。
- 证据：`git log -S`/`git blame` 指向 `1de042b5`/`6b5b30fb`；固定 fixture 初始 `setData` 13,386 B、最大 5,495 B，开弹层 5,560 B，关闭后驻留 72 选项，重复确认新增 1 请求。
- 影响：筛选主流程不可用；双模式完整树和重复请求可能放大低端/繁忙设备卡顿，但真实帧率当前无法测量。
- 修复建议：按已批准的通讯录专项设计拆分逻辑/视图状态、查询键和活动弹层，先红测试后实现。
- 风险：中等；涉及异步竞态、分页复用、滚动恢复和权限上下文，禁止无测试的大范围重构。
- 置信度：高。
- 状态：已实现、自动验证并同步 production release；待小米 14 匹配体验版验证。
- 验证：定向/全量自动测试、固定性能 fixture、Web Storybook 黄金；小米 14 匹配体验版仍需人工验收。

修复后固定 fixture 初始 `setData` 为 6 次/4,053 B、最大 1,206 B，分别是旧版 30.3%/21.9%；
关闭驻留选项和重复确认请求均为 0。首次打开中位数 0.31 ms（旧版 0.30 ms），主体建立 1.49 ms
（旧版 2.61 ms）。Mini 全量 108 files/539 tests、Web 通讯录黄金 10 files/51 tests 通过；原生
Console/Network/帧率与小米 14 仍无当前构建证据，不能据此宣称真机通过。

### MINI-DIR-002（P1）：拨号返回清空结果、筛选头部不可固定且工号数字尾部不可检索

- 普通解释：筛选弹层只能点按钮关闭，清除入口会被滚走；拨号返回后搜索视图消失；完整工号可搜，省略字母前缀或前导零不可搜。
- 技术原因：顶部横条没有手势，清除节点位于 `scroll-view`；`c2a57441` 把每次前台刷新序号纳入通讯录上下文签名，无真实上下文变化也重置运行态；纯数字搜索分支只查电话。
- 位置：Mini `directory-panel` 的 `index.wxml/index.wxss/controller.ts/filter-sheet-drag.wxs`，API `directory-query.ts`，导入 `directory-import-core.ts`。
- 证据：旧实现新增 Mini 场景 5 红、导入 1 红、API 2 红；生产发布批次只读验证 `D0468/d0468/0468/468` 均命中目标各 1 条。
- 影响：拨号主流程丢失用户上下文；长筛选列表清除入口不可达；员工按常用数字尾号检索失败。
- 修复：专用横条 WXS 下拉/回弹且与完成共用关闭路径，固定标题和清除区；前台只后台复核 facets，版本未变零视图写入；用现有工号列/alias 索引支持 3 位以上数字尾部。
- 风险：中等；涉及原生手势、前台生命周期和数字查询排序，但没有新增 API/contracts/迁移，权限、批次、稳定排序和游标条件不变。
- 置信度：高。
- 状态：代码 `7952f1d1` 已推送并完成生产备份/部署；`.71@7952f1d` 已上传并通过 allowlist/full verifier，小米 14 待验证。
- 验证：exact-clean Mini 110 files/554 tests、root 244 files/1,139 tests；MySQL 集成因本机数据库不可用跳过。数据库查询路径中位数 50.12→48.36ms（-3.5%），P95 62.17→57.34ms；端到端 HTTP、原生动画和小米 14 当前工具无法测量。

### MINI-DIR-003（P1）：筛选接近全屏，首次搜索缺少可复制的端到端分段证据

- 普通解释：筛选弹层太高，不利于单手操作；人员第一次搜索慢，但原先只能看到“慢”，不能判断时间花在请求前、网络、服务端、转换还是显示。
- 技术原因：`6b5b30fb` 引入 `92vh/840px` 的近全屏 Sheet；搜索链路只有通用请求摘要，没有搜索确认、上下文等待、卡片、`setData` 回调和下一渲染周期的关联记录。代码审计另确认 controller 在调用已受保护的 transport 前重复等待一次 `organization` capability。
- 位置：Mini `directory-panel` 的 `controller.ts/index.wxml/index.wxss/search-diagnostics.ts`，平台 `client-core-calendar.ts/wx-request-executor.ts/runtime-diagnostics*.ts`，测试工具页与对应 Web 辅助黄金。
- 证据：修改前 production 包 5,213,637 B；筛选 CSS 固定为 `92vh`、最大 840px。代码确认无筛选纯关键词搜索不等待完整 facets，进行中请求和已完成同查询已有会话复用；服务端、真机网络和渲染占比当前无证据。
- 影响：筛选单手体验不佳；没有阶段证据时，任何搜索链路大改、服务端预热或索引修改都有误判风险。
- 修复：按真实 `windowHeight/screenHeight/safeArea` 计算约半屏高度并监听横竖屏变化；保留横条、固定头部/清除、单一滚动区和滚动恢复。测试工具新增默认停止、最多 20 条、可复制 1/10 次的隐私安全诊断；profile 仅在记录中开启。只删除 controller 的一层明确重复能力等待，transport/executor 门禁保留。
- 风险：低到中；诊断只写 App 内存，不改变 API/contracts/数据库/索引/搜索排序/筛选语义。请求 profile 和额外计时在停止记录时关闭。
- 置信度：半屏实现与小米 14 当前构建交互验收高；首次搜索长尾归因中等，按阈值继续被动观察。
- 状态：阶段 A 代码 `73811f1f` 已提交并推送；当时 production 只同步 release 元数据，API/Web 制品和容器没有变化。用户登记 `38.190.176.204` 后，同一 `.72@5fff288` 重试成功并通过正式 allowlist、七维 capability、unknown=426 与公网 full verifier；`.72` 现为历史上传版本。
- 验证：历史阶段 A Mini 110 files/561 tests；production verify/source/package/performance/determinism/CI dry-run、全端 build/typecheck、Web 辅助黄金和 core smoke 通过。后续 `.75@24a847f` 已取得小米 14 半屏四项原生交互通过及三次独立启动诊断；这些结论不外推到其他设备或平台。

### 阶段 0 保留输入

阶段 0 只记录基线，不执行完整静态审计，因此尚未把发现扩展为 P0～P3 问题清单。已知的 lint error、
格式检查失败、主包预警和两个节点数预警保留为下一阶段输入，不在本轮修复，也不据此推断用户实际卡顿。

启动、首页、关键页面、网络竞态、生命周期和交互体验都需要后续按范围取证；拿不到数据时继续标记
“当前工具无法测量，暂未验证”。

## 9. 本轮变更边界

- 新增测试工具分包、构建元数据、环境门禁、只读内存摘要、报告生成、环境矩阵回归与 Web 辅助黄金。
- 旧手势探针未删除；从测试工具“交互检查”进入，同时给旧直达路径增加 release 失败关闭。
- 统一请求函数只增加异常吞掉的摘要调用；重试条件/次数、认证恢复、Header/body、返回、异常和时序不变。
- 既有 App 错误/Promise 错误入口只在 develop/trial 把固定码和 SHA-256 指纹写入有界内存；未新增监听。
- 未新增依赖，未修改 API、contracts、数据库、权限、认证、业务 `setData` 或无关业务页面。
- 未处理既有全仓 lint/format；未调用微信开发者工具；本批体验版已上传，但未提审、未正式发布。
- 实现 checkpoint `18498a8b` 以显式路径提交并推送；既有无关用户内容保持排除。
- 生产备份 `68902f0f-a5eb-4a56-963a-e78829862086` 后按哈希可信复用同步同一 release；完整 verifier 通过。
- `.70` 已原子追加客户端白名单；预热一次 TLS EOF/一次 502 自动恢复，随后 allowlist verify、未知版本 426、七维能力和公网完整 verifier 通过。

## 10. 测试工具批次证据

### 10.1 环境、安全与运行时边界

`git log -S` 和 `git blame` 确认 `712aa4ee` 在 2026-08-28 引入写死的
`testCenterEnabled: true` 和直达旧手势探针。新回归对旧 HEAD 明确红灯，当前环境矩阵如下：

| 环境    | “更多”入口 | 直接测试工具页 | 旧手势探针 | App 诊断仓库 |
| ------- | ---------- | -------------- | ---------- | ------------ |
| develop | 显示       | 允许           | 允许       | 创建         |
| trial   | 显示       | 允许           | 允许       | 创建         |
| release | 隐藏       | 返回工作台     | 返回工作台 | 不创建       |

请求摘要最多 20 条、错误 10 条、性能 12 条，只在 App 内存中存在。没有新增
`onNetworkStatusChange`、`onMemoryWarning` 或其他监听，没有 monkey patch `wx.request`/`setData`。
请求函数继续按原条件执行 capability、401 恢复、GET/幂等写重试、状态返回和异常传播；现有
`wx-json-transport`、遥测、工作台和全量回归保持通过。

诊断分包产物经过额外敏感模式扫描：未发现 Bearer、Authorization 赋值、Cookie/openid/session_key
赋值、11 位手机号、UUID 或凭证模式。页面不读取 storage value；报告仅使用固定构建字段、设备/屏幕、
脱敏路由、耗时/状态、错误指纹和用户结构化勾选。

### 10.2 修改前后包体

同一用户工作树、production profile、同一包体脚本结果：

| 范围         | 修改前 bytes | 修改后 bytes | 变化 bytes | 结果                          |
| ------------ | -----------: | -----------: | ---------: | ----------------------------- |
| 主包         |    1,637,688 |    1,658,098 |    +20,410 | 保留既有 1.5 MiB 预警，未阻断 |
| scheduling   |      420,884 |      422,480 |     +1,596 | 通过                          |
| organization |    1,197,103 |    1,201,891 |     +4,788 | 通过                          |
| workflows    |      821,914 |      825,106 |     +3,192 | 通过                          |
| insights     |    1,056,800 |    1,061,589 |     +4,789 | 通过                          |
| diagnostics  |            0 |       35,710 |    +35,710 | 新增非首屏普通分包            |
| 总包         |    5,134,389 |    5,204,874 |    +70,485 | 通过                          |

主包只保留环境门禁、App 有界仓库和极小调用桥；报告格式化、设备卡片和交互清单在 diagnostics
分包。没有把旧手势探针迁移或复制进新分包，因此避免重复其 Worklet/WXS 产物。
最终上传追踪标签写入后的 clean dist 为 main 1,658,565、scheduling 422,516、organization
1,201,939、workflows 825,178、insights 1,061,697、diagnostics 35,728、total 5,205,623 B；
相对同口径复测多出的 749 B 仅是版本、提交和上传说明元数据。

### 10.3 自动验证与视觉辅助

| 检查                                                          | 结果                                                                |
| ------------------------------------------------------------- | ------------------------------------------------------------------- |
| 定向安全/环境/请求/工作台/手势/构建                           | 8 files / 65 tests 通过                                             |
| Mini 全量                                                     | 109 files / 548 tests 通过                                          |
| 根测试                                                        | 243 files / 1,137 tests 通过；37 files / 355 tests 无数据库环境跳过 |
| 全端 typecheck/build                                          | 通过                                                                |
| Mini verify/source/performance/package/determinism/CI dry-run | 通过；clean 2/2 Worklet；总包 5,204,815 B                           |
| Storybook build 与黄金回归                                    | 通过；390/320/大字号无横向溢出，页面内按钮均 ≥44px                  |
| 任务 ESLint/Prettier                                          | 通过；既有 `prefer-const` 按用户要求不修改                          |
| `pnpm smoke:check-core`                                       | 通过；未涉及 Web 核心链路                                           |

390/320/大字号截图保存在 ignored `runtime/audit/test-tools-golden/`。首次视觉脚本误把 Storybook
注入的 0px 隐藏控件当成页面按钮，并记录 Storybook 外壳 `/favicon.ico` 404；限定到页面根节点并保留
favicon 证据后复测，实际页面 6 个按钮均 ≥44px、页面错误为 0。该黄金只能证明 Web 辅助布局与文案，
不能证明 WXML/WXSS、Skyline、微信客户端或小米 14 真机表现。

### 10.4 未验证与人工证据

本段是 `.70@18498a8` 当时的边界记录：当轮 DevTools/Console/原生截图尚未验证。其后
`.74@d23a78a` 已由用户完成小米 14 test-tools 验收；当前 `.76@a2cdd06` 已完成自动化与真实
DevTools 回归但未被描述为当前 SHA 真机通过。各 SHA 的证据不得互换。

后续唯一建议任务见 `docs/audit/STATUS.md`。
