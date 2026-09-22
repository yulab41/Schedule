# 微信小程序审计状态

## 当前批次：联系方式弹窗文字稳定与键盘收起回底（体验版已上传放行，待小米 14 复核）

- 小米 14 `.187@adccba36` 暴露 input 文字在弹窗打开后延迟上移，以及键盘关闭后 sheet 偶尔保留旧高度。引入链为 `5fabb855` 同帧打开/聚焦与 `adccba36` 后到高度回调二次移动；Android 输入法关闭时 input 局部高度事件并非总是可靠归零。
- 现在先渲染 sheet、回调后再保持一次点击自动聚焦；input 使用明确 46px 行高。局部和全局键盘高度事件共用归一化函数，高度 0 立即贴底；blur 有可取消的 100ms 兜底，focus、close、save、unload 均清理残留状态，全局监听成对注销。
- RED 3 失败/18 通过；GREEN 定向 21/21、Mini 全量 1244/1244（另 16 跳过）。typecheck、production verify/package/source/determinism、Prettier/ESLint、`smoke:check-core`、diff check 通过；总包 4,567,652 B（较 `.187` +2,510 B）。
- 开发者工具门禁通过，WXML/WXSS 编译、模拟器刷新和 console 错误过滤通过；模拟器无成员身份，不能替代真机键盘验收。
- checkpoint `83eb80c33f38c63fe1b7c2b51a85cac18f54c423` 已推送；体验版 `0.1.0-p10.20260922.188` 从干净 production 候选上传，232 文件、ZIP 2,648,723 B、Manifest `a306e0a91627c52b54855951e8f3f077c262e28fef3a953041f8cd9c014f0bf4`，远端 tag/allocation/manifest/receipt 一致。
- 正式 allowlist 只追加 `.188`、保留 `.187`；verify、完整 `ecs-verify.sh`、公网 `.188/.187=200`、未知版 `=426` 通过。生产 release 仍为 `cfa934d1`/schema 63；未部署应用、操作数据库、提审或正式发布。
- 唯一下一任务：小米 14 打开 `.188@83eb80c`，复核文字不跳、键盘不遮挡、收起回底、重新聚焦、取消和保存。取得证据前不写原生通过。完整上下文见 [审计记录](profile-qr-visitor-audit-20260921.md)。

- 前序 `.186` 已补齐联系方式 controller 转发和 SVG 箭头；`.185` 的二维码/访客审计、原顶部导航和 40px 二维码字段保持不变。
- 已实现手机号/短号整行单字段弹窗、账号级短号及跨群同步、管理员全局短号更新、冲突刷新；新增环境唯一的成员绑定码/访客码接口和严格 POST 访客读取；访客审计新增 OpenID（非微信号）、设备/微信/基础库/窗口/网络上下文与完整 IP/请求 ID 展开详情。
- 按用户最新决定不保留旧正式版兼容：邀请生成/解析/接受/撤销/分享、旧双码接口、群组码服务/权限/响应字段已从运行时删除；schema 63 直接删除 `invite_tokens`、`group_code_attempts`、群组码列/索引和成员旧短号列。旧正式版调用这些能力将立即不可用，这是已获授权的行为变化。
- 自动化：累计 Mini 1241 通过/16 跳过；根 Vitest 1296 通过/441 跳过；真实 MySQL 工作流 94/94、Task10 106/106、迁移 32/32；schema 63 发布/回滚门禁 52/52；typecheck、lint、format、build、Storybook、生成契约、浏览器 smoke、`smoke:check-core` 和累计 CI dry-run 通过。开发者工具状态/登录有效，模拟器刷新、Console 错误检查及二维码组件原生编译通过；视觉比较缺成对夹具，不记为通过。
- 累计包体相对前序实现总量 −15,247 B、主包 −4,056 B、organization −5,263 B；实现 `f42d3edb` 与发布门禁 `cfa934d1` 已推送，累计 CI dry-run Manifest=`2486df9a35d62b2e8cdeb9af73569d49a355719e0744f89b2d878b0cff536ba4`。
- 生产备份 `9e20efab-b355-45e6-ba82-f45745687a8c` 已核对，live=`cfa934d1749ccf92c8b316065e5a17193c4f5a91`、schema 63，完整 verifier 与新旧路由探针通过。
- 首次上传在分配版本前因候选未包含最新 `.184@91b19bcf` 而停止、未占号；现已合并 `.184` 的共享 selector、滚动安全区和相关测试，二维码面板绑定对象同步迁移，累计门禁通过且未恢复邀请能力。
- 累积 checkpoint `b45bbbe0` 与等价证明 checkpoint `cbe19af5` 已推送；首次重传在版本分配前安全拒绝且未占号，刷新精确 blob 后血缘/上传槽专项 19/19 与 tracked audit 通过。
- 体验版 `0.1.0-p10.20260922.185` 已上传：`cbe19af5`、production、Manifest `ff14e32989a103e85e5d69e06ed36f0b0c98ff84378adb0ae59e7f6faf2b097d`、232 个代码文件、ZIP 2,646,093 B；远端 tag、allocation、manifest、receipt 身份一致。
- `.185` 已由可信控制只追加放行并保留 `.184`；独立 allowlist verify、完整 `ecs-verify.sh`、公网 `.185/.184=200` 与未知版 `=426` 通过。生产仍为 `cfa934d1`/schema 63，未重复部署或迁移。
- `.186@59f1e801` 继续作为点击/箭头修复与键盘遮挡的修复前证据；本轮后续验收必须绑定 `.187@adccba36`。

## 上一批次：数据缓存与服务器性能审计（已交付，待小米 14 复核）

- 用户授权全面检查/优化并允许联系方式持久缓存，确认采用“服务器推送优先、低频校验兜底”。独占 general-5，REUSE_ONLY，安装 0。
- 生产只读基线：live 318b275d，实际内存 1608 MiB、可用 858 MiB；API/MySQL/Web 三容器无重启/OOM，memory PSI=0。此前每分钟重复容器与 MySQL 内存修复仍有效，本轮不重复清理或停服务。
- 已实现：按 owner+group 保存一份联系人；旧格式扫描每进程一次；月缓存未满不遍历 payload；后台预取并发 2；屏外失效和失败游标修正；403 清缓存；节假日只更新年份；扫描缓存 30 秒/128 条、通讯录筛选 LRU 64 条。
- 推送：复用 API HTTP 分块流，无 Redis/新依赖/后台进程；前台单连接，后台关闭，初连/重连补查，120 秒无提示校验兜底；服务端 110 秒重新鉴权、200 总连接/账号 2 连接上限。联系方式跨组更新也发送提示。
- 验证：Mini 1231 通过/16 跳过、根 Vitest 1297 通过/448 跳过、池工具 81 通过、真实 MySQL 日历集成 41 通过；完整门禁分段完成，细节见报告。开发者工具 3.17.3 实收 SSE 分块，配置已恢复；主包 1715052 B、总包 4615896 B；小米 14 未验收。
- Git/生产：应用 `ebcea83e`，血缘候选 `bc5fc307` 已推送 main 并部署，schema 62 未变；现场回滚候选 `318b275d`。加密备份 `1fb654a7-c6d8-497a-a6ec-6c421f86dfa0`（56 表/284764 行/119964272 B）核对记录、文件大小和 SHA-256 后才部署；完整 ecs-verify 通过。
- 体验版 `0.1.0-p10.20260920.181`（`bc5fc307`）已上传并只增放行，旧版保留；`.181`/`.180` 公网能力 200、未知版 426，新流接口未登录 401。发布后仍只有 3 个常驻容器、restartCount=0/OOM=false；备份后短期指标不当作稳态提速证据。
- 详见 [审计报告](loading-cache-server-20260920.md)；旧测试夹具在父源码复跑也失败，已修正调用签名及统计范围，不降低断言。
- 交付记录 checkpoint：`docs(release): record cache audit deployment and trial 181`；仅文档，按例外不再备份/部署/同步服务器元数据。唯一下一任务：小米 14 `.181@bc5fc307` 验证跨设备联系方式静默更新、前后台/断网补查、切组/退出账号隔离；取得同构建证据前保持“待用户复核”，本批停止扩展修改。

## 历史批次：WebView-only 收口——删除全部 Skyline 兼容层，体验版169待验收

- 用户提问："异常既然不是组件库版本引起的，按版本分叉的代码是否也该清掉？"→ 已核对：生产源码里**只有一处**按基础库版本分叉（`platform/runtime-ui-compatibility.ts` 的"请求 Skyline 且 SDK=3.17.2"），其余 `SDKVersion` 仅用于诊断页展示，仓库内无 `wx.canIUse` 或版本比较工具。删除该兼容层即可让渲染器/基础库版本不再影响任何代码路径。
- 删除清单（全部在请求 WebView 时不可达）：兼容层模块与 16 项门禁测试；`.is-skyline-3172-ui` 规则 25 条（6 个 WXSS）；`ui-wheel-column` 原生滚动孪生；`calendar-month`/`ui-date-picker` 原生分页器孪生与 `_compat*`/`_dateCompat*` 状态；工作流宿主对话框（`workflow-picker-host`/`host-key`/`dialog-only`/`openFromParent`/`forwardHosted*` 与 sheet 点击外部兜底）；`ui-toast` 描边、`ui-selector`/`ui-date-picker` 内联弹层、`ui-loading` 与工作流 spinner 的 SVG 回退、`runtimePressedFeedbackCompatibility`；`calendar-period-pager` 的滚动度量与兜底常量；`app.json` 的 `rendererOptions.skyline` 与对应构建校验；两个只服务该分支的 spinner SVG。
- 门禁：typecheck、format:check、lint、smoke:check-core 通过；Mini **1205 通过 / 16 跳过**；determinism `743c22d2…`；package 总 **4614093 B**（基线 4653854 B，**−39761 B**，主包 1777035 → 1737017）。
- WXSS 复核：首轮脚本把多行选择器合并成一行，已从 `HEAD` 重新推导修正，`git diff -- '*.wxss'` 为纯删除（129 行删除、0 新增）。
- 批次 2（同轮完成）：删除仓库内最后一个 Skyline 专用面——`pages/gesture-probe` 的 A 区 Pan Worklet 探针（`pan-gesture-handler`／`worklet:ongesture`／蓝点样式／`wx.worklet` 初始化）、`src/types/build-env.d.ts` 的 `worklet` 类型声明与对应测试断言（该页 D 区 WXS、B 区触摸计数、C 区设备信息、E 区滚轮、F 区工作台压力探针保留）；文档同步迁移计划冻结边界、ADR-0001／ADR-0005 状态、架构／设计／测试计划／审计快照中的"Skyline"表述；并把渲染器决定写成门禁——不再注入 `__MINIPROGRAM_RENDERER__`，`src/app.json` 的 `renderer` 必须是 `webview`，`build-info.ts` 直接报告 `WebView（应用请求）`。
- 保留决定（有证据）：`pages/manual-matrix-poc/matrix-gesture.wxs` 被生产页 `subpackages/scheduling/pages/manual/index.wxml` 直接 import，因此不能整体删除该目录；`calendar-poc`／`manual-matrix-poc` 已不含 worklet（渲染器无关），且仍可从开发入口页与"更多 → 测试入口"到达，本轮保留（三页合计约 82 KB 主包体积，若确认入口不再需要可单独立批，需同时迁移 `matrix-gesture.wxs`）。
- 回滚：`git revert` 本批次提交并把 `renderer` 与页面 JSON 改回 `skyline`；只改 `renderer` 不是有效回滚（兼容层已删除）。
- 交付与放行：`ca673d0c`（删除兼容层）+ `56781b13`（刷新 workbench 血缘等价证明）已推送；候选在独占 `general-5` 冻结（前后 `RESULT=PASS`）；`0.1.0-p10.20260919.169` 上传成功（说明「WebView-only cleanup 56781b1」，Manifest `524fdea0…4eae`），可信 ensure 追加并保留 `.168`，`ecs-verify.sh` `[verify] complete`；公网 `.169=200`/`.168=200`/未知 `=426`。未提审、未正式发布、未部署生产。
- 开发者工具复核（fullMode，基础库 3.17.2 + WebView，身份页构建标签 `0.1.0-p10.20260919.169@56781b1`）：workbench 群组名完整、箭头紧贴、月历 7 列正常；换班页正常加载、`发起换班` sheet 与月份选择器均以覆盖层弹窗打开（滚轮带`年`/`月`单位、中间项高亮）。截图在 ignored `runtime/audit/devtools-169/`。
- 批次 2 交付：`d201ab97` 已推送；候选在独占 `general-5` 冻结（前后 `RESULT=PASS`）；`0.1.0-p10.20260919.170` 上传成功（说明「WebView-only batch2 d201ab9」，Manifest `4e8f3ccf…be19`），可信 ensure 追加并保留 `.169`，`ecs-verify.sh` `[verify] complete`；公网 `.170=200`/`.169=200`/未知 `=426`。开发者工具复核：`pages/gesture-probe` 在基础库 3.17.2 下正常渲染，构建标签 `0.1.0-p10.20260919.170@d201ab9`，A 区已消失，D/B/E/F 区正常（截图 `runtime/audit/devtools-170/`）。
- 渲染器门禁交付：`566ceed5` 已推送；候选同样在独占 `general-5` 冻结（前后 `RESULT=PASS`）；`0.1.0-p10.20260919.171` 上传成功（说明「WebView-only enforce 566ceed」，Manifest `3a09d985…3e75`），可信 ensure 追加并保留 `.170`，`ecs-verify.sh` `[verify] complete`；公网 `.171=200`/`.170=200`/未知 `=426`。开发者工具复核：workbench 在基础库 3.17.2 下与 `.169` 渲染一致（截图 `runtime/audit/devtools-171/`）。
- 上传路由补充：清理代理后 GitHub fetch 会失败（`Git fetch failed with exit code 128`），必须同时给 git 配 `GIT_CONFIG_*` 代理、并让微信 CI 直连 IPv4。
- **真机验收通过（2026-09-19）**：小米 14 打开 `.171` 未发现问题；此前"异常"的那台设备在同一构建下同样正常。批次 1（删除 Skyline 兼容层）与批次 2（删除最后 Worklet 探针、文档同步、渲染器门禁）全部完成。
- 政策（长期有效）：WebView 是唯一允许的渲染器——构建拒绝其他 `renderer` 值，`apps/miniprogram/scripts/webview-only-policy.test.mjs` 在任何渲染器开关／Skyline 兼容标记／`'worklet'` 指令回归时失败；改渲染器必须先写新 ADR 并重跑真机验收。
- 组件库/基础库注意点：基础库升级不再影响渲染分支，但仍会改变 API 可用性与真机表现；每轮真机验收记录 `基础库版本`、`Skyline 支持`（须为"不支持"＝WebView）、`renderer` 与构建标签，基础库换代后重跑工作台月/周/列表、换班+请假弹层与选择器、手排矩阵。
- 复用的踩坑记录：`docs/agent-context/pitfalls/mini-renderer-webview-only.md`（引擎 vs 基础库版本误判、组件库升级注意事项）、`docs/agent-context/pitfalls/mini-trial-upload-route.md`（GitHub 代理 vs 微信 CI 直连 IPv4、血缘等价证明刷新、upload 用途绑定 RUN_ID/SHA、DevTools 占用导致 Release 被拒）。
- 当时下一任务：无（批次 1/2 已交付并真机通过）；后续工作请开新批次并把结论写回本文件。
- 停止条件：两台设备复核无回归；若出现回归，以 `.168` 构建为对照定位。详情见 `docs/audit/webview-only-cleanup-20260919.md`。

## 历史批次：渲染器改为 WebView（ADR-0007），Skyline 补丁只在"请求 Skyline 且 3.17.2"启用

- 用户真机证据：两台设备**都是 3.17.3**，差别在引擎——正常那台 `Skyline 支持=不支持`（WebView，Grid 0px），异常那台 `Skyline 支持=支持`（Skyline，Grid 退化 8px）。因此界面回退的根因是**引擎**，不是基础库版本；旧兼容分支硬编码 `SDKVersion === '3.17.2'`，灰度后整体失效。
- 决定与实现（ADR-0007，取代 ADR-0001 的"仅 Skyline"）：`src/app.json` + 17 个页面 JSON 的 `renderer` → `webview`；`build-tools.mjs` 新增 `readRequestedRenderer()` 并注入 `__MINIPROGRAM_RENDERER__`；`runtime-ui-compatibility.ts` 判定改为"请求 Skyline 且 SDK=3.17.2"；构建门禁接受 `webview|skyline`（仅在 skyline 时校验 Skyline 版本区间）；8 个页面/构建测试同步更新；`build-info.ts` 不再硬编码 `Skyline（项目固定）`。
- 验证（开发者工具 fullMode，整窗重开 + 清编译缓存）：`src/app.json`/产物 `dist/app.json` 均为 `webview`；workbench 页 `state=ready`、`sdk=3.17.2`、**`compat=false`**（证明 3.17.2 + WebView 下 Skyline 补丁已关闭）、截图显示页头群组名完整、下拉箭头紧贴、布局与"金标准"一致。
- 门禁：typecheck、Mini **1224 项通过/16 跳过**、package 总 **4653854B**、determinism `abbb3658…`、format、lint、smoke:check-core 全通过。
- 未验证（不代替原生验收）：手工排班矩阵滚动同步、首屏性能 `foreground-ready`/`core-ready`（模拟器本次未产出该标记），需小米 14 体验版复核；Skyline 专用代码原样保留，回滚只需把 `renderer` 改回 `skyline`。
- 交付与放行：代码 `1f2dcf61`（渲染器改 WebView）+ `64788ee4`（状态文件压回上下文预算）已推送；候选在独占 `general-5` 冻结（前后 `RESULT=PASS`）；`0.1.0-p10.20260918.168` 上传成功（说明「Webview renderer 64788ee」，Manifest `1edea299…100e`，收据三件套齐全），可信 ensure 追加并保留 `.167`，`ecs-verify.sh` `[verify] complete`；公网 `.168=200`/`.167=200`/未知 `=426`。未提审、未正式发布、未部署生产。
- 上传路由（供后续复用）：GitHub 需要进程代理、微信 CI 必须直连 IPv4 → 用「清 `HTTPS_PROXY/HTTP_PROXY` + `NODE_OPTIONS=--dns-result-order=ipv4first` + 仅给 git 配 `GIT_CONFIG_*` 代理」；`.165`/`.166` 已因 IPv6 出口烧号。
- 当时下一任务：小米 14 打开 `.168` 复核页头/详情卡四处排版、日历交互与整体手感，并确认矩阵滚动同步正常。

## 历史批次：把"保住可见面板"做对 + 高度与滑动同时落位 + 手势不再重排，体验版167已放行

- 用户回传 `.164`：滑动比 `.163` 顺滑 ✓；仍轻微横向抖动；高度仍慢半拍；**定位生硬无动画**且跳转后单元格"正确本月内容 → 闪一下 → 又是正确本月内容"（节点重建）；不方便录屏。
- 定位"无动画"澄清（模拟器）：从别的月份定位**有 364px 轨道滑动**；当前月即本月时走 `applyTodayLocation` 直接重渲染（无动画）＝"生硬跳转"的来源。
- 修法（3.17.3 swiper 分支逐字未改）：①`_compatSlideResetPending` 只在真提交（`delta !== 0`）时消费 → 提交出 `[prev,cur,cur]`、轨道下一 tick 归零（两面板同一对象，可见帧内容不变）；②兼容分支高度过渡 240→**200ms**（滑动 240ms），让高度与滑动同时结束；③手势高度从"拖动中逐次改写"改为"结算时一次"（用户接受的单变量试验，针对横向抖动）。
- 验证（3.17.2 模拟器）：连按 **6 次 → 6 次归零**、Sep→2027-03 逐月推进、结束态 `cleanup=false`/`track=''`/`viewportHeight==gridHeight`（证明不再假死/悬停）；一次切月轨道 -351→-641.8→-714.6 与高度 372→322.5→310.1 并行；定位 2026-11→09 有完整轨道滑动。
- 门禁：typecheck、Mini **1224 项通过/16 跳过**、package 总 **4650981B**、determinism `889cfc96…`、format、lint、smoke:check-core 全通过；新断言在旧源码上先失败（RED）。
- 交付：`03587690` 已推送；候选在独占 `general-5` 冻结，`check-worktree-safety` 前后 `RESULT=PASS`。`.165`/`.166` 因出口走 IPv6 被微信 CI 拒绝（`invalid ip: 2409:8a55:…`）烧号；改用进程级直连 IPv4（清代理 + `NODE_OPTIONS=--dns-result-order=ipv4first`）后 **`.167` 上传成功**（Manifest `74cd9485…acf4`），可信 ensure 追加并保留 `.164`，`ecs-verify.sh` `[verify] complete`；公网 `.167=200`/`.164=200`/未知 `=426`。未部署应用制品、未备份或迁移数据库、未提审、未正式发布。
- 当时下一任务：小米14 打开 `.167` 复核 ①箭头/定位不再闪动（从本月出发无动画属预期）；②高度与滑动同时结束；③手势横向抖动消失；④连按仍不假死。

## 历史批次：撤回 `.163` 的延迟归零，排队手势就地提交，体验版164已放行

- 用户回传 `.163`：比上一版更卡；高度要等活动结束约 1 秒才落；快速切月出现"有切换动画但内容不变"的假死；定位闪动更明显；手势横向抖动仍在。并补充：3.17.2 **必须等蓝色选中框出现才能触发下一次手势滑动**，之前滑会"落空"。
- `.163` 回归定因：延迟归零依赖 `_compatSlideResetPending`，任何一次 `panels` 更新都会提前消费它 → 归零丢失 → 轨道停在侧面板、`_compatSlideActive` 不复位 → 清理被挡 → `gridHeight` 观察器一直让位 → **内容假死 + 高度迟到**；高度拆成两帧下发也让过渡变慢。
- 修法：撤回 `.163` 的两处（回到 `.162`：高度与位移同一次 `setData`、提交时原子换环 + 轨道归零），保留单元格内联 px 宽度（含请假页日期网格）。
- "落空"修法：忙窗口内到来的手势原先在队列后立刻 `recenterCompatPanes` 弹回原位；现在保留手指位置，并在上一步结束后把它**就地提交**（`_compatQueuedInPlace` + `finishMonthSwipeAt`），左右按钮排队仍走滑动。
- 验证（3.17.2 模拟器）：一次切月轨道 -351→-641.8→-714.6 与高度 372→322.5→310.1 并行；连按 4 次 → 12 月→2027-04 不卡死；切月途中补手势 → 月份再前进 1 且结束态干净。新断言在旧源码上先失败（RED）。
- 门禁：typecheck、Mini **1224 项通过/16 跳过**、package 总 **4650884B**、determinism `153070fb…`、format、lint、smoke:check-core 全通过。
- 交付：`4bd30e5e` 已推送；候选在独占 `general-5` 冻结，`check-worktree-safety` 前后 `RESULT=PASS`；`.164` 上传（Manifest `a38c0e58…0e61`），可信 ensure 追加并保留 `.163`，`ecs-verify.sh` `[verify] complete`；公网 `.164=200`/`.163=200`/未知 `=426`。未部署应用制品、未备份或迁移数据库、未提审、未正式发布。
- 未解决（需证据）：箭头/定位闪动、手势左滑横向抖动；合成触摸驱动不了 Skyline 滚动，已请用户提供 5 秒录屏再定因。
- 当时下一任务：小米14 打开 `.164` 复核是否恢复顺滑、不再假死、高度不迟到，忙窗口手势不再落空；闪动/抖动仍在则附录屏。

## 历史批次：3.17.2 分页提交期保住可见面板 + 单元格内联 px，体验版163已放行

- 用户回传 `.162`：高度已基本同步（仍稍落后）；新增两个视觉问题——①箭头/定位切换时单元格内容闪动（手势滑动不闪）；②手势左滑（未来月份）单元格横向抖动，右滑不抖。
- ① 定因：`.162` 把"换干净环 + 轨道归零"放在同一更新里，但换环时**中间面板内容确实换成了新月份**且它正变成可见面板 → 单元格按 `businessDate` 键整体重建 → 闪动；手势路径的换环发生在屏外侧面板，所以不闪。
- ② 定因（推断，合成触摸无法驱动 Skyline 滑动）：兼容分支单元格仍是百分比宽度，而 3.17.2 在原生滚动容器里解析百分比链不可靠；左滑常伴随新月份数据回填触发重排 → 百分比重新解析 → 横向抖动；右滑多为缓存月份无二次回填。
- 修法（3.17.3 swiper 分支逐字未改）：①提交改用保住可见面板的映射（`[prev,cur,cur]` / `[cur,cur,next]`），轨道**下一 tick 再归零**，干净环走既有清理兜底 → 可见面板单元格键不变；②高度提前一帧下发；③兼容分支单元格改内联 `width:52px;`（与面板 px 同源），并镜像到请假页日期网格。
- 验证（3.17.2 模拟器）：112 个单元格宽度全部 52px；一次切月轨道 -351→-534→-641→-681→-703→-713→-715（≈250ms）后提交并归零，结束态 `track` 空、`cleanup=false`、`viewportHeight==gridHeight`；连按 4 次不卡死；连按后手势仍正好一月。新增断言在旧源码上先失败（RED）。
- 门禁：typecheck、Mini **1224 项通过/16 跳过**、package 总 **4650668B**、determinism `7fdc6f6e…`、format、lint、smoke:check-core 全通过；未改 `workbench/index.ts`，血缘证明无需刷新。
- 交付：`76712d29` 已推送；候选在独占 `general-5` 冻结，`check-worktree-safety` 前后 `RESULT=PASS`；`.163` 上传（Manifest `a25a9f58…36d8`），可信 ensure 追加并保留 `.162`，`ecs-verify.sh` `[verify] complete`；公网 `.163=200`/`.162=200`/未知 `=426`。未部署应用制品、未备份或迁移数据库、未提审、未正式发布。
- 当时下一任务：小米14 打开 `.163` 复核箭头/定位是否不再闪动、手势左滑横向抖动是否消失（右滑不应变化）、高度是否同时落位，并确认 3.17.3 无变化。

## 历史批次：3.17.2 程序化切月改为轨道同帧过渡（修"高度仍两段式"），体验版162已放行

- 用户回传 `.161`：滑动已顺滑、连按不再卡死 ✓；但高度仍要等滑动结束才变；用户询问"3.17.3 为何能同步"。
- 分析：3.17.3 的同步来自"滑动与高度都是**元素自身的同帧动画**（swiper 240ms + 高度过渡 240ms）"；3.17.2 兼容路径用的是 `scroll-into-view` + `scroll-with-animation` 的**原生平滑滚动**，真机上平台会把随后的高度/布局变化压到滚动结束之后（模拟器逐帧测得下方内容在滑动期间已在位移 661→649→602→599，本机不复现，只能按真机证据处理）。
- 修法（3.17.3 swiper 分支逐字未改）：程序化切月不再滚动，改为给分页轨道下 `transform` + `transition`（240ms、与高度同一条 `cubic-bezier(0.33,1,0.68,1)`），高度与位移在**同一次 `setData`** 下发 → 同帧起、同帧落；提交时在**一个更新**里换回干净环并把轨道归零（可见面板月份不变），因此不再需要"等滚动事件落位"的清理。手势仍走原生滚动；`.161` 的兜底结算/清理兜底/先归位再滑全部保留。
- 验证（3.17.2 模拟器）：372→310 的切月，轨道 -365→-476→-593→-661→-712→-715 与高度 372→340.8→322.5→313.5→310.4→310 **并行完成**（≈250ms），提交后轨道归零；连按 4/6/10 次逐步推进且每步有滑动、结束态 `cleanup=false`/`viewportHeight==gridHeight`；滑动中落指先归零再交给手势，结束态干净；手势 Sep→Oct 仍正好一月。新增断言在旧源码上先失败（RED）。
- 门禁：typecheck、Mini **1224 项通过/16 跳过**、package 总 **4650161B**、determinism `eb798495…`、format、lint、smoke:check-core 全通过；未改 `workbench/index.ts`，血缘证明无需刷新。
- 交付：`076c897f` 已推送；候选在独占 `general-5` 冻结，`check-worktree-safety` 前后 `RESULT=PASS`；`.162` 上传（Manifest `ad51d1b8…cbbf`），可信 ensure 追加并保留 `.161`，`ecs-verify.sh` `[verify] complete`；公网 `.162=200`/`.161=200`/未知 `=426`。未部署应用制品、未备份或迁移数据库、未提审、未正式发布。
- 当时下一任务：小米14 打开 `.162` 复核切月时高度是否与滑动同时变化/同时落位、连按不卡死且每步有滑动、定位仍不推动整页，并确认 3.17.3 无变化。

## 历史批次：3.17.2 分页"快速切换卡死/高度仍两段式"修复，体验版161已放行，待小米14复核

- 用户回传 `.160`：高度仍两段式；定位不再推动整页 ✓；切月仍不够流畅；**快速连按后整页卡死不动**。
- 卡死定因（模拟器探针）：干净环替换只靠"滚动事件恰好落在中间面板"触发。该事件不来 → `_compatCleanupPanes` 永久挂起 → 重定位被跳过 → 滚动目标不再变化 → 也不再有滚动事件 → **步骤永不结算、队列无法排空**；同时 `gridHeight` 观察器一直被让位（高度也不更新）。
- 修法（3.17.3 swiper 分支逐字未改）：①`CALENDAR_PERIOD_PROGRAMMATIC_FALLBACK_MS=600` 兜底结算；②清理定时兜底 + "不在中间面板先归位再重试" + 归位后对齐宿主 `gridHeight`；③步骤开始若容器仍停在侧面板则**先归位再滑**，保证连按每步都有滑动；同一套保障镜像到请假页日期分页器。
- 高度两段式：把动画高度移到外层容器 `.calendar-motion-frame`（仅兼容分支），滚动节点只做横向分页，高度过渡不再挂在正在跑平滑滚动的节点上；实测该容器过渡 310→348→360→366→372（≈250ms）。
- 验证（3.17.2 模拟器）：连按 10 次 → 队列 6 → 2027-02→…→2027-09 逐步推进，结束态 `cleanup=false`/`target=month-pane-1`/`viewportHeight==gridHeight`，不再卡死且每步仍有完整滑动；布局 frame 364×310、面板 364px、单元格 52×62；手势正好一月。新增断言在旧源码上先失败（RED）。
- 门禁：typecheck、Mini **1224 项通过/16 跳过**、package 总 **4649613B**、determinism `e0a68e30…`、format、lint、smoke:check-core 全通过。本轮未改 `workbench/index.ts`，血缘证明无需刷新。
- 交付：`94af3e56` 已推送；候选在独占 `general-5` 冻结，`check-worktree-safety` 前后 `RESULT=PASS`；`.161` 上传（Manifest `00cdd539…0567`），可信 ensure 追加并保留 `.160`，`ecs-verify.sh` `[verify] complete`；公网 `.161=200`/`.160=200`/未知 `=426`。未部署应用制品、未备份或迁移数据库、未提审、未正式发布。
- 当时下一任务：小米14 打开 `.161` 复核快速连按不再卡死且每步有滑动动画、高度是否与滑动同步、定位仍不推动整页，并确认 3.17.3 无变化。详情见 `runtime-ui-compatibility-period-pager-20260917.md`。

## 历史批次：3.17.2 分页高度/定位/流畅三项修复，体验版160已放行，待小米14复核

- 用户回传 `.159`（仅 3.17.2）三项：高度要等滑动动画归位后才开始（两段式，3.17.3 是同步的）；按定位按钮后整页上滑、月历与顶部导航间隙变小（只有定位按钮会）；切月仍略卡。
- ① 定因：切月时高度与滚动目标写在**同一次 `setData`**，平台会把正在平滑滚动节点上的高度过渡推迟到滚动结束。改为**高度单独先写一次**（实测 `setVh` t=17 → `setPager{pane-2}` t=35，DOM 高度过渡完整落在滑动内），保留"一步只写一次高度"的单写者约束；程序化提交由 t=511 提前到 t=435。
- ② 定因（DevTools 逐帧）：`scroll-into-view` 把 `#workbench-content-top` 顶端对齐到滚动容器顶端，页面因此固定上移 14px（内容上内边距）；**基础库 3.17.3 上测量完全相同**，因此是共用缺陷而非版本差异。定位按钮本就在月历卡片内，故移除月/周定位后的页面滚动（列表保留 `list-day-<today>` 行定位），并加两项回归测试（含"列表不要被过度修复"守卫）。
- ③ 修复：程序化步骤已知目标面板，新增共享常量 `CALENDAR_PERIOD_ARRIVAL_SETTLE_MS=48`——滚到目标面板后再等 48ms 即结算；手势仍保留 140ms 以防动量在慢帧上停顿。
- 验证（3.17.2 + fullMode 模拟器）：定位前后 `anchorTop` 均 125、`scrollTarget` 为空；按钮切月高度在滑动内完成；手势 Sep→Oct 正好一个月且 `viewportHeight` 与 `gridHeight` 一致；`.159` 不变量未回归。新断言在旧源码上先失败（RED）。
- 工具教训：DevTools 此前一直跑**另一个已打开工程**；必须 `project_import` 目标路径 → 关闭/重开窗口 → 用 `pages/calendar-poc` 的 `buildLabel` 核对实际构建。DevTools 改写的 `project.config.json`（追加默认 setting、换行变 CRLF）已恢复 HEAD 并归一到 LF。
- 门禁：typecheck、Mini **1224 项通过/16 跳过**、package 总 **4647504B**、determinism `c987ad48…`、format、lint、smoke:check-core 全通过。
- 交付：检查点 `32ecee11`，血缘证明刷新 `0036c03f`（改动 `workbench/index.ts` 触发 `trial-lineage-policy.v1.json` 的 blob/证据更新）。候选 `0036c03f` 在独占 `general-5` 冻结，前后 `check-worktree-safety` `RESULT=PASS`；`.160` 上传（Manifest `eda7ea2e…b0601`），可信 ensure 追加并保留 `.159`，`ecs-verify.sh` `[verify] complete`；公网 `.160=200`/`.159=200`/未知 `=426`。未部署应用制品、未备份或迁移数据库、未提审、未正式发布。
- 说明：② 的修复对 3.17.3 同样生效（该缺陷在两版本都在）。本轮按"两个实例保持一致"处理；若需 3.17.3 保留旧位移需另行确认。
- 当时下一任务：小米14 打开 `.160` 复核高度是否与滑动同步、定位是否不再推动整页、切月手感，并确认 3.17.3 无变化。详情见 `runtime-ui-compatibility-period-pager-20260917.md`。

## 历史批次：月历/日期分页改原生滚动，体验版155已上传并放行，待小米14复核

> 追加：`.155` 出现"月历单元格宽度错误"回归（原生滚动容器里百分比宽度链在 3.17.2 无法解析）。已改为**测量容器宽度 + 内联 px**（共享助手 `measureCalendarPeriodPaneWidth`），并在 3.17.2 模拟器目视确认月历恢复 7 列、请假选择器日期网格正常；交付 `.156`（候选 `f7155b4b`，Manifest`6cc5901b…7a60`），前后检查 PASS、verify 与 `ecs-verify.sh` 通过、公网 `.156=200`/`.155=200`/未知`=426`。**`.155` 含该回归，请用 `.156` 复核。**
>
> 再追加：`.156` 手势不能按月切换（一次滑过 3 个月）、按钮动画方向相反——根因是环形槽位会轮转而原生滚动按物理位置走。已把兼容分支改为**物理顺序固定（前|当前|后）+ 每次结算后无感归位**；3.17.2 实测 Next/Prev 各跨 1 月、手势只跨 1 月且方向正确、日期网格仍 7 列；交付 `.157`（候选 `12d1a00e`，Manifest`536497b3…ed2a`），前后检查 PASS、verify 与 `ecs-verify.sh` 通过、公网 `.157=200`/`.156=200`/未知`=426`。**请以 `.157` 复核。**
>
> 再追加：`.157` 出现闪烁（先闪旧月再出新月）、卡顿、高度调节慢、快速手势被加载阻塞。根因分别是"归位跳动早于新面板渲染"、"拖拽期逐帧写高度"、"上一步加载时拒绝新步"。已改为**归位与新面板同一次 setData**、**高度只在结算时写**、**手势方向入队**；3.17.2 实测连续手势序列正确（首页 09→10→11→10；选择器 2026-12→2027-01→2027-02→2027-01）；交付 `.158`（候选 `8351312d`，Manifest`63414cb6…4cc0`），前后检查 PASS、verify 与 `ecs-verify.sh` 通过、公网 `.158=200`/`.157=200`/未知`=426`。**请以 `.158` 复核。**
>
> 再追加：`.158` 仍会"短暂出现别的月份的单元格"。机制是提交时**可见面板自身也换了月份**，而滚动跳转与内容更新不同帧。已改为**提交时让可见面板与中间面板同月**、干净映射等归位落地后再替换（改动落在屏外面板）；同时高度改为滑动开始即切换、并加 `bounces="{{false}}"` 压制惯性拉伸。实测提交后 `panes=[09,10,10]`（中间与可见同月）→ 归位后 `[09,10,11]`；交付 `.159`（候选 `9d6a7ad9`，Manifest`24b8f63d…9234`），前后检查 PASS、verify 与 `ecs-verify.sh` 通过、公网 `.159=200`/`.158=200`/未知`=426`。**请以 `.159` 复核。**

- 用户报障（仅 3.17.2）：请假年月日选择器定位落到临近月且无动画、左右切换反跳；首页月历定位同样、左右切换无动画且不跟手。要求"跨多个月也只做一个月的跳转动画"。用户同时确认 3.17.2 滚轮已与 3.17.3 基本一致且低速更顺，**该优点本轮不动**。
- 根因：两处都是"3 槽环形 `swiper` + 改 `current`"；3.17.2 无法动画化程序化跳转，此前一轮设成 `duration:0` 并手动补结算 → 没动画；手动结算依赖槽位匹配，错过即丢 → 环形与画面错位 → 临近月/反跳。
- 实现（3.17.3 分支逐字未改）：3.17.2 的分页换成原生横向 `scroll-view`（与滚轮同一条已真机验证的通道）。面板体抽成 WXML `template` 两分支共用；`scroll-into-view`+`scroll-with-animation` 动画一个面板，`bindscroll` 驱动结算，手势与程序化切换共用同一结算代码；定位今天先无感归位再单面板滑到当月。共享助手（度量合并/最近槽/面板 id/结算延时）落在 `calendar-period-pager.ts`，无第二套实现。
- 验证（3.17.2 模拟器）：请假页下一月 250ms `left=8391.9`→结算 `9072=2×4536`、草稿 2027-01；定位今天跨 4 月 250ms `left=488.8`→结算 `left=0`、草稿 2026-09-17；首页月历连按 3 次正好 2026-10/11/12；定位今天 2026-12→2026-09，视口高度 310 不变。
- 门禁：typecheck、Mini 1221 项通过/16 跳过、package 总 4643899B（+11KB）、determinism`6ea2af8f…`、format、lint、smoke:check-core 全通过。
- 交付与放行：`.155`（Manifest`683b76f3…9b63`）production/clean 上传，前后检查 PASS；可信 ensure 追加 `.155` 保留 `.154`，verify 与 `ecs-verify.sh` 通过；公网 `.155=200`、`.154=200`、未知`=426`。未部署应用制品、未备份或迁移数据库、未提审、未正式发布。
- 原则更新（用户当次）：最小改动优先；当低版本无法在原实现上适配时，为它设计匹配的实现而非硬打补丁，但要有条理、不影响 3.17.3、不占用过多包体积、尽量复用。已写入 `apps/miniprogram/AGENTS.md`。
- 当时下一任务：小米14 打开 `.155` 复核请假选择器与首页月历的定位/左右切换（单月动画、不反跳、落到当月、跟手），并确认 3.17.3 无变化。详情见 `runtime-ui-compatibility-period-pager-20260917.md`。

## 历史批次：滚轮在 3.17.2 改原生滚动实现，体验版154已上传并放行，待小米14复核

- 用户当次授权「继续至全部完成并验证通过并上传放行」，并授权以后由 LLM 直接在模拟器用测试账号登录。
- 三条症状一次定因（同构建切基础库实测）：① 该版本内联 `margin-top` 不当位移用（只有 `transform` 移动轨道）→ 起始停在最前端；② WXS `setStyle` 写入不到渲染器 → 无逐像素位移、无行强调；③ `.ui-wheel-unit` 样式送不到节点且继承色解析不出来 → 字形透明（对照组证明"有没有显式颜色"是唯一变量，与字号无关）。
- 实现：`ui-wheel-column` 内新增仅 3.17.2 走的分支——原生 `scroll-view` 滚轮，`bindscroll` 逐像素反馈，逻辑层按**与 WXS 相同的插值公式**产出行/数字/单位样式经数据下发，松手 `scroll-top` 吸附；静止帧亦由数据绘制。3.17.3 仍走原 WXS 分支（`wx:else`），模板/类名/WXS/样式串逐字未改。
- 验证：3.17.2 `compat=true`、`scrollTop 220→308` 行位移正好 88px、`midIndex 5→7`、选中行 `opacity:1;scale(1)`、单位 12 行全部出墨；3.17.3 `compat=false`、`margin-top:0px`、`#ui-wheel-track` 在、scroll-view 分支不存在。
- 门禁：typecheck、Mini 174 文件/1220 项、package（总 4637088B）、determinism、format、lint、smoke:check-core 全通过。
- 交付与放行：`.154`（Manifest`076a83ba…304a`）production/clean 上传，前后检查 PASS；可信 ensure 追加 `.154` 保留旧版，verify 与 `ecs-verify.sh` 通过；公网 `.154=200`、`.153=200`、未知`=426`。未部署应用制品、未备份或迁移数据库、未提审、未正式发布。
- 当时下一任务：小米14 打开 `.154` 复核滚轮跟手/吸附、单位、中间项放大、滚到 2031年/12月、重开正常，且 3.17.3 无变化。详情见 `runtime-ui-compatibility-wheel-native-scroll-20260917.md`。

## 历史批次：滚轮修复已用开发者工具复现验证（授权清单第2项），待小米14复核

- 用户当次授权：`fullMode` 重开项目窗口 + 测试账号登录，重跑第2项——在开发者工具里验证 `.153` 滚轮修复。只验证，未改业务代码。
- 复核与放行确认（用户授权“提交并放行”）：`.153` 已在白名单，可信 `ensure` 返回“版本已存在并通过验证；未重建容器”（幂等、只追加），`schedule-client-version-allowlist verify` 通过，`/usr/local/lib/schedule/ecs-verify.sh` 输出 `[verify] complete`（api/web 容器 Up 52 分钟，mysql healthy），公网探针 `.153=200`、`.152=200`、未知 `=426`。未部署应用制品、未备份或迁移数据库、未提审、未正式发布。
- 环境打通：窗口必须 `fullMode`；基础库由 `apps/miniprogram/project.private.config.json` 的 `libVersion` 决定。**构建未设 `WECHAT_CI_VERSION` 时版本是 `local`** → `client-capabilities?version=local` 返回 400 → 工作台永久“正在读取排班”；设成 `.153` 后 200，真实生产数据全量加载（控制台 `WeChatLib: 3.17.2`，Skyline 1.4.23，iPhone 12/13 Pro 390×844）。
- A/B（同一构建只切基础库；向真实 `ui-wheel-column` 注入一次 index=3/offset=−132 上报）：3.17.2 `compat=true`、`margin-top:0px;transform:translateY(-132px)`、轨道渲染矩形 top `11642→11510`（正好 −132px）、单位 8/8、选中数字高≈25.2px vs 未选中≈17.9px、选中项盒子 127.2×46.64（=44×1.06）；3.17.3 `compat=false`、样式串只有 `margin-top:0px`、轨道 top 不变。→ 修复在 3.17.2 真实运行时生效，3.17.3 零副作用。
- 工具边界（已在报告标注）：DevTools 的 `fields({computedStyle})` 对 3.17.2/3.17.3 **都返回空**（display/color/transform/marginTop 复核），故模拟器不能复现也不能否证真机“3.17.2 丢弃 WXS `setStyle`”；`trigger` 不触发 WXS 绑定、合成触摸不能驱动 Skyline 滚动、`pageScrollTo` 超时，探针的“拖方块/拖滚轮”未在模拟器执行。结论层级=DevTools 模拟器，不等于小米14原生验收。
- 证据：定向 31 项（wheel/runtime-compat/picker/wxs 集成）通过；截图与探针剪贴板记录在 ignored `runtime/audit/devtools-153/`。详情见 `runtime-ui-compatibility-devtools-3172-verification-20260917.md`。
- 当时下一任务：小米14打开 `.153` 复核按行滚动/单位/中间项放大/范围到底/重开正常/3.17.3不变；之后做授权清单第3项（AI 开发模式 generate→validate，需“开发模式”+服务端口，且不得合入提审版本）。

## 历史批次：Skyline 3.17.2 滚轮单位/选中放大/范围修复已实现，待体验版交付

- 真机对照截图（图一=3.17.2"发起换班"/2031年12月，图二=3.17.3"管理员直接换班"/2025年9月）：3.17.2 缺"年/月"单位、中间选中项不变大、向下只能到 2027 与 5月且抬手再拖不能继续向下（可向上回滚），草稿值（2031年12月）与可见位置（2024..2028）不一致；3.17.3 全部正常。**读图边界**：初稿把 3.17.2 截图读成"行样式通道可用"，与用户文字"没有选中字体放大效果"冲突，属未证实假设，不作为依据；本轮修复不依赖该判断。
- 修复：① 单位随条目数据走（item 带 `unit`，模板`wx:if="{{item.unit || unit}}"`）；② 条目总数改由组件自身 data 承载（`data-item-count="{{wheelConfig.itemCount}}"`，与已验证可用的`data-base-index`同路径）；③ 同一次打开内条目数只增不减（`refreshItemCount` 忽略瞬时更小值），避免一次瞬时渲染剪短可滚动范围；④ 仅在 3.17.2 给滚轮根节点加`is-skyline-3172-ui`，用 CSS 兜底选中行放大/不透明（WXS 行内样式优先，写不进时 CSS 生效；3.17.3 外观不变）。
- 证据：新增`does not let a transient count shrink the wheel range`与既有全范围用例通过；Mini完整174文件1219项通过/16跳过；typecheck、build366、package(主包1746516B/总4620921B)、determinism(3bacb648)、format、lint、smoke:check-core、agent-context-policy通过。`miniprogram:verify`仍只被既有未改手排矩阵`1507>1506`阻断。
- 诊断增强（按用户建议）：测试工具新增二级卡片"滚轮通道探针"（页面级WXS拖动方块 + 真实`ui-wheel-column`），一次采集即可拿到：页面级WXS是否取到节点/移动偏移、滚轮WXS的preview/settle次数与最后index/offset/sequence/generation/runtimeKey、以及`query.in(selectComponent(...))`组件作用域实测的`computedStyle.transform/marginTop/fontSize`与dataset期望值——用于判明样式通道/手势回报通道/渲染器是否真的应用WXS样式。定向23项、Mini完整1220项通过/16跳过；build367文件、package(主包1746707B/总4632789B)、determinism(677e0ed7)、format/lint/smoke通过。
- **探针结论（`.152`真机）**：3.17.2 **丢弃 WXS `setStyle` 写入**（页级探针无`transform`字段 vs 3.17.3 `matrix(...,-88)`），`fields({computedStyle})`不可用；`callMethod`上报与模板数据通道正常。→ 像素只能由模板/数据驱动，是"数字不动/无放大/无渐变"的唯一原因。
- 修复：轨道位移改由组件 data 承载（`wheelTrackOffset`/`wheelTrackStyle`，随每次 WXS 上报与换代更新；仅 3.17.2 含`transform`）；单位改`wx:if="{{item.unit}}"`+`wx:else`；3.17.2 滚动为**按行推进**。定向65项、Mini完整1220项通过/16跳过；build367、package(1747172B/4633254B)、determinism(51bc6941)、format/lint/smoke通过。
- 本轮未上传、未放行、未部署。当时下一任务：取得当次上传授权后上传体验版并 add-only 放行，复核3.17.2滚轮按行滚动/单位出现/中间项放大，3.17.3不变。详情见`runtime-ui-compatibility-wheel-data-motion-20260917.md`。
- 规则与工具链（用户当次要求）：`apps/miniprogram/AGENTS.md` 与仓库 guardrails skill 改为**默认同意 LLM 驱动开发者工具**（保留"无当次授权只读；上传/提审/发布/生产凭证需当次批准；DevTools 证据≠小米14原生验收"边界），skill 校验 RESULT=PASS；安装 `wechatide-skill` v0.3.11（旧版已备份）、注册 `[mcp_servers.wechat-devtools]`（token 在仓库外）、状态检查 `versionRelation=equal`；按官方文档装入 SkillHub 的 `wxa-skills-generate` 与 `wxa-skills-validate`（用于小程序 AI 开发模式的原子接口生成/校验，官方要求该模式代码不得合入正式提审版本）。
- 交付（授权"1，2，3"第1项）：`a18f8692` 上传为体验版 `0.1.0-p10.20260917.153`（Manifest`72b7dcb4…da79fd`）production/clean，前后检查 PASS；可信 ensure 只追加 `.153`，verify 与 `ecs-verify.sh` 通过，公网 `.153=200`、`.152=200`、未知`=426`。第2项（模拟器白屏→DevTools 验证，需 Nightly 版）与第3项（AI 开发模式 generate→validate，需公众平台"开发模式"+服务端口）待执行。
- 交付与放行：`61e81e07` 以 production/clean 上传为 `0.1.0-p10.20260917.152`（说明“Skyline 3.17.2 wheel channel probe 61e81e0”，Manifest`e02b6f6c…904545`）；远端不可变tag指向同一SHA；可信ensure只追加`.152`（白名单48项，保留`.151`），独立verify与`ecs-verify.sh`通过，公网`.152=200`、`.151=200`、动态未知`=426`。未部署应用制品、未备份或迁移数据库、未声明production live release。
- 当时下一任务：小米14打开`.152`跑`测试工具 → 滚轮通道探针`三步并回传复制内容（据此一次性判定通道），再复核单位显示、选中放大、能否滚到年2031/月12月、重开正常、3.17.3不变。详情见`runtime-ui-compatibility-wheel-channel-probe-trial-release-20260917.md`。

## 历史批次：Skyline 3.17.2 滚轮初始定位与重开失效，体验版151已上传并放行，待小米14复核

- 用户真机复核`.150`：首次打开滚轮**可以滚动**（模板覆盖位移的修复生效），但**初始停在 2021年/1月**而非当前年月；**关掉再打开又无法滚动**。
- 根因（同一原因）：3.17.2 不把 WXS 的`change:wheel-config`观察器交给滚轮。① 初始位移只由`configure`写入 → 从未应用 → 停在轨道原点；② 上一轮的"缺 state 时按 dataset 自建基线"只在第一次生效，重开时 state 已存在但 generation 已推进 → `eventState`因代际不一致返回`null` → 手势全被忽略。
- 修复：初始定位改由模板承担（轨道`margin-top:{{wheelLayoutOffset}}`= `-index*44`，WXS 只画增量`translateY(offset - baseOffset)`，两者不同属性不再互相覆盖）；手势按代际自我刷新（dataset 的 generation 更新时按`data-base-index`/`data-item-count`重新播种并重置行样式，更旧仍忽略）。
- 证据：RED（回退 WXS 后"重开"用例失败`expected 'translateY(-44px)' to be 'translateY(0px)'`）；GREEN 定向55项、Mini完整174文件1217项通过/16跳过；typecheck、build366、package(主包1745352B/总4619757B)、determinism(95f7825e)、format、lint、smoke:check-core、agent-context-policy通过。`miniprogram:verify`仍只被既有未改手排矩阵`1507>1506`阻断。
- 3.17.2 已知局限（观察器不交付）：打开后未触摸前没有大小/淡出渐变（触摸一次即恢复）；点击某一项选中（tap-to-select）仍不生效，拖动选择正常。
- 交付与放行：`d33da54b` 以 production/clean 上传为 `0.1.0-p10.20260917.151`（说明“Skyline 3.17.2 wheel layout base d33da54”，Manifest`c8378346…2e55b`），远端不可变tag指向同一SHA；可信 ensure 只追加 `.151`（白名单47项，保留`.150/.149`），独立 verify 与 `/usr/local/lib/schedule/ecs-verify.sh` 通过，公网 `.151=200`、`.150=200`、动态未知 `=426`。未部署应用制品、未备份或迁移数据库、未声明 production live release。
- 当时下一任务：小米14复核3.17.2滚轮“打开即在当前年月、可滚动、重开仍可滚动”，并确认请假定位当日仍一次到位；已知局限保持（未触摸前无渐变、点击单项选中不生效）。详情见`runtime-ui-compatibility-wheel-layout-base-trial-release-20260917.md`。

## 历史批次：Skyline 3.17.2 滚轮位移通道与定位当日一次到位，体验版150已上传并放行，待小米14复核

- 用户真机复核`.149`：换班年月滚轮**仍无法滚动**（上一轮`catch`手势隔离无效）；请假左右切月**不再乱跳**；定位当日**偶尔没反应**，月份越远越容易遇到。
- A 根因：滚轮位移由 WXS 写在`#ui-wheel-track`的 transform 上，而同一节点还有内联`style`绑定`wheelInitialOffset`；拖动时每次预览`setData`重渲染，3.17.2 会把内联样式整条重新下发并覆盖 WXS 的 transform → 内部 offset/高亮变化但像素不动。修复：删除内联绑定，位移完全由 WXS 拥有（符合既有"WXS 独占像素样式"约定）；手势在`touchStart`用节点 dataset 自建基线（新增`data-item-count`/`data-selected-index`），避免运行时未交付 config observer 时直接失效。
- C 根因：`.149`的定位当日等共享 pager 结算，未结算位移（连点箭头/连点）会被守卫吞掉 → "偶尔没反应"。修复：一步重定中心（`resetDatePager` + 一次`setData`；3.17.2 仍`duration:0`），删除已死的`_dateLocateTarget`与`formatMonthValue`。
- 证据：RED（回退 WXS 后新用例`expected undefined to be 'translateY(-264px)'`）；GREEN 定向53项+新增用例、Mini完整174文件1216项通过/16跳过；typecheck/build366/package(主包1744556B/总4618961B)/determinism(21cae2df)/format/lint/smoke:check-core/agent-context-policy通过。`miniprogram:verify`仍只被既有未改手排矩阵`1507>1506`阻断。
- 交付与放行：`a0707b0c` 以 production/clean 上传为 `0.1.0-p10.20260917.150`（说明“Skyline 3.17.2 wheel track transform ownership a0707b0”，Manifest`45598d45…90e69`），远端不可变 tag 指向同一 SHA；可信 ensure 只追加 `.150`（白名单46项，保留`.149/.148/.147`），独立 verify 与 `/usr/local/lib/schedule/ecs-verify.sh` 通过，公网 `.150=200`、`.149=200`、动态未知 `=426`。未部署应用制品、未备份或迁移数据库、未声明 production live release。
- 当时下一任务：小米14复核3.17.2换班年月滚轮能否跟手滚动、请假定位当日是否每次一次到位；若滚轮仍不动，请回复“拖动时中间那一项高亮是否跟着换”或“非中间项数字是否比中间更小更淡”，以区分样式通道与事件通道。详情见`runtime-ui-compatibility-wheel-style-trial-release-20260917.md`。

## 历史批次：Skyline 3.17.2 滚轮手势、切月动效与定位当日体验版149已上传并放行，待小米14复核

- 用户真机复核`.148`：3.17.2 弹窗内点击不再误关，但换班年月滚轮**仍不能滚动**；点左右切月（换班弹窗与日历页月历）播放**反向**滑动动效而最终月份正确（3.17.3 正常）；请假弹窗“定位当日”会**逐月**回退（3.17.2/3.17.3 都有），日历页定位当日一次到位。
- 引入点：滚轮事件绑定与`touch-action: none`来自`57e10cdc`（WXS 滚轮能力探针）；`_dateLocateTarget`逐月续走来自`528722f4`；程序化切月时长来自`calendar-period-pager`接入（`9045dc02`等）。三者都不是本项目状态机错误，而是 3.17.2 渲染器差异被旧写法放大。
- 根因：A 滚轮依赖`touch-action`争抢纵向手势，3.17.2 不按该属性判定归属，手势被祖先容器拿走（同款组件+遮罩在 gesture-probe 真机曾验证可用，故不是遮罩命中或 WXS 子节点样式通道）；B 三槽环形 swiper 在 3.17.2 按“最近逻辑槽位”归一`current`，环形 0↔2 跳变被渲染成反向一步；C 定位当日每结算一步才前进一个月。
- 修复：`ui-wheel-column` 根节点改为`catchtouchstart`/`catchtouchmove` 自持纵向手势（位移仍写内层`#ui-wheel-track`）；受影响运行时程序化切月`duration:0`并抽出`finishMonthSwipeAt`/`finishDateSwiperAt`在零时长跳变后直接结算一次（幂等）；定位当日改为把今天的月份面板作为唯一入场面板放进相邻槽位，删除逐月续走分支。3.17.3 动画与路径不变。
- 证据：定向53项、Mini完整174文件1215项通过/16跳过；typecheck、build366、package(主包1744335B/总4618740B)、determinism(2286365b)、format、lint、smoke:check-core通过。开发者工具（3.17.2/Skyline）仅能验证宿主管弹窗可打开且无异常，元素/组件自动化在该渲染器不可用，触摸级结论只能由小米14提供。
- 交付与放行：`7e215a28` 以 production/clean 上传为 `0.1.0-p10.20260916.149`（说明“Skyline 3.17.2 wheel pan and month paging 7e215a2”，Manifest`442f8933…36fc8`），远端不可变tag指向同一SHA；可信 ensure 只追加 `.149`（白名单45项，保留`.146/.147/.148`），独立 verify 与 `/usr/local/lib/schedule/ecs-verify.sh` 通过，公网 `.149=200`、`.148=200`、动态未知 `=426`。未部署应用制品、未备份或迁移数据库、未声明 production live release。
- 当时下一任务：小米14双实例复核 A/B/C（年月滚轮可滚动、左右切月动效方向、请假弹窗定位当日一次到位），3.17.3 三项不变；若滚轮仍不能滚动，请回复“点滚轮中间那一项有无反应”。详情见`runtime-ui-compatibility-wheel-pager-trial-release-20260916.md`。

## 上一批次：Skyline 3.17.2 弹窗点击误关修复体验版148已上传并放行，待小米14复核

- 用户真机反馈：3.17.2 日期弹窗内任意点击（定位今天/切月/日期格/弹窗内外）都会关闭弹窗；3.17.3 正常。根因是 3.17.2 的弹窗挂在页面根层，卡片内点击冒泡到页面根的关闭回调（3.17.3 的弹窗在 sheet 内被 catchtap 挡住）。
- 修复 1 行：.workflow-picker-layer 增加 catchtap="handleInternalTap"（复用已有 no-op），加 1 条回归断言（RED 1 失败→GREEN 15/15）。未新增机制，3.17.3 路径不变。
- 体验版 0.1.0-p10.20260916.148（说明"Skyline 3.17.2 dialog tap fix c5f06e5"）production/clean 上传成功，Manifest 1f64d195…f9e7；候选前置与上传后绑定检查 PASS。门禁：Mini 全量、typecheck、build366、package、determinism(4410f7fb)、format、lint 通过；主包1744039B/总4618444B。
- 放行：可信 ensure 只追加 .148 并保留 .147 等旧版；allowlist verify 与 ecs-verify 通过，release 仍 44034fcc，无部署/数据库操作；公网 .148=200、.147=200、动态未知=426。
- 当时下一任务：小米14 3.17.2 复核日期弹窗点击不再关闭且可选，年月滚轮是否可滚动（若不可，反馈具体现象以定方向）；3.17.3 不变。详情见 docs/audit/runtime-ui-compatibility-dialog-tap-trial-release-20260916.md。

## 历史批次：Skyline 3.17.2 弹窗层 inset 兼容修复已实现，待体验版交付

- 用户反馈：3.17.2 年月/日期选择器点开后无弹窗；换班等 sheet 点外部不关闭。用开发者工具（3.17.2/Skyline/同提交 d526252b）复现并定位。
- 根因：覆盖层使用 inset:0（及 max()/env() 组合），该渲染器不解析 —— 弹窗层无偏移被排到视口外（渲染树有节点但不绘制）；ui-sheet 遮罩同样无偏移，点弹窗外落在页面上，handleBackdropClose 不触发。
- 修复（语义等价、无版本分支）：ui-date-picker 的 layer/scrim/wheel-mask、ui-selector 的 backdrop、ui-sheet 的 scrim 改为显式 top/right/bottom/left:0；sheet 安全区保留 bottom:12px 回退；新增覆盖层偏移回归断言。
- 证据：开发者工具内对照截图（修复前 layer 在渲染树但不绘制；改显式偏移后"选择月份"卡片立即正常绘制）。门禁：Mini 1214 项通过/16 跳过、typecheck/build366/package/determinism/format/lint 通过；主包1744003B/总4618408B。
- 开发者工具复测（3.17.2/c9ad7c0）：弹窗正常出现（截图）、遮罩关闭弹窗、sheet 遮罩关闭表单；切 3.17.3 复测一致。
- 边界：模拟器无法完成完整交互链（该实例 app 业务请求报网络错误），原生交互须由小米14体验版复核；本轮未上传、未放行、未部署。详情见 docs/audit/runtime-ui-compatibility-overlay-inset-20260916.md。

## 历史批次：Mini 诊断真实读取 Skyline 版本（2026-09-16 累计候选）

- 用户要求消除“更多 → 测试工具”里“Skyline 版本：当前微信版本不支持单独读取”的硬编码，并授权本次上传与 add-only 放行。官方 `wx.getSkylineInfo`（基础库 2.26.2 起）返回 `isSupported`/`version`/`reason`，原来“没有可靠 API”的写法不成立，审计主计划 §8B 本就要求该项。
- 只改测试工具页读取与对应契约测试：`isSupported` 映射官方五种原因文案，`version` 显示真实 Skyline 版本号；缺少 API、`fail` 或 500ms 超时失败关闭为“当前微信版本不支持读取”，与网络类型并行读取、不猜测、不崩溃。未改 WXML/WXSS、页面配置或业务语义。
- 血缘与证据：原检查点`c7a96a0b`按累计血缘要求整合到最新体验版 tag `145@6e31eed8`；定向22/22、Mini 完整174文件1213项通过/16跳过、typecheck通过。两处继承门禁失败未消除且与本次改动无关（icon parity 的 `ui-loading-primary/muted.svg` 未进 canonical manifest；手排矩阵`1507>1506`上限），本轮按用户指示继续交付并在报告中明确归属。
- 当时下一任务：上传体验版并 add-only 放行，记录版本号、Manifest 与 receipt；小米 14 复核“更多 → 测试工具”的 Skyline 支持/版本两行。未操作开发者工具。

## 历史批次：Skyline 3.17.2 年月/日期选择器改由面板根层托管弹窗，待体验版交付

- 用户复核`.142@8988afe`：3.17.2年月选择器就地展开且滚轮无法独立滚动（滚动会带动整个换班弹窗），请假弹窗日期选择器被两列布局挤压；且3.17.2点弹窗外不关闭（3.17.3会）。第二点由上一轮就地展开去掉遮罩直接造成。
- 结论：不再让弹窗待在sheet的滚动容器里。3.17.2由面板把弹窗挂在面板根层（与`ui-sheet`同级的`position: fixed`覆盖层，该层在3.17.2真机验证可用）。
- 实现：`ui-date-picker`新增`dialog-only`（只渲染弹窗）与`host-key`（触发器/宿主配对）；被托管的触发器不再本地渲染弹窗，改为把配置随`pickerrequestopen`上抛，面板调用宿主`openFromParent()`，确认后`forwardHostedChange()`通过模块内实例表找回原触发器并调用`applyChange()`——面板既有`bindchange`处理器一行未改。三个工作流面板在根层各加一个宿主并给8个月/日期触发器加`host-key`；遮罩恢复，点弹窗外即关闭。
- 定向23项通过；Mini完整174文件1211项通过/16跳过；typecheck、build366文件、source/package/determinism、format/lint通过；主包1743699B/总4616396B。详情见`runtime-ui-compatibility-picker-host-dialog-20260916.md`。
- 当时下一任务：取得当次上传授权后交付体验版并add-only放行，再由小米14双实例复核3.17.2月份/日期弹窗独立滚动、点外部关闭，及3.17.3不变。本轮未上传、未放行、未部署。

## 上一批次：Skyline 3.17.2 选择器就地展开后备已实现，待体验版交付

- 用户复核`.138@09c100d`：3.17.2下拉已能渲染选项但被后续字段遮挡；月份/日期面板点按后仍不出现；3.17.3正常。说明`.138`的显式高度修复有效，剩余两项是层级与提升问题。
- 遮挡沿用`.136`已记录的“3.17.2同层z-index不能提升浮层”（引入点`6d0575d0`）；面板不出现是因为`.138`采用的“从ui-sheet插槽内容root-portal到根层”在3.17.2不生效——冻结产物核对确有root-portal、令牌导入与`--ui-z-index-dialog:1000`，而同一机制在页面级与组件级真机均可用。本轮不再押注portal或叠加z-index。
- 修复只在3.17.2生效且全部改为就地展开：下拉容器`is-inline`（`position: static`、去遮罩、覆盖`is-measuring`隐藏、保留显式高度）；月份/日期层与面板`is-inline`（就地卡片、去遮罩与拖拽把手）；同时撤销`.138`的root-portal与根层令牌导入，3.17.3与未知版本恢复为与`.136`逐字相同的覆盖层路径。
- RED 2失败；GREEN兼容14项、Mini完整174文件1203项通过/16跳过。typecheck、production build366文件、source/package/determinism、format/lint/smoke:check-core通过；主包1739791B/总4607445B，较`.138`增644B，无新增依赖。Mini verify仍仅被既有未改手排节点1507>1506阻断。
- 当时下一任务：取得当前消息的上传授权后交付新体验版并add-only放行、保留`.138`等旧版，再由小米14双实例复核3.17.2下拉与月份/日期面板就地可见可选，且3.17.3外观与交互不变。详情见`runtime-ui-compatibility-picker-inline-fallback-20260915.md`。

## 上一批次：Skyline 3.17.2 选择器浮层与页头箭头体验版138已上传并放行，待双实例验收

## 上一批次：Skyline 月视图已过日期灰底恢复，体验版140已上传并放行

- 用户反馈3.17.2/3.17.3两个实例的首页月视图与访客月视图都缺少“该月已过日期单元格灰底”，以前版本有，怀疑某次更新后丢失。
- 引入点：旧小程序`1343f4c6^`的`components/calendar-grid/index.wxml`用`day.isPast`输出`calendar-grid__day--past`、`index.wxss`定义`#f3f4f6`，首页`pages/calendar/index.wxml`与访客`pages/guest/guest.wxml`共用。`1343f4c6`(2026-08-13)删除旧小程序后，`1f715c96`(2026-08-18)新建`calendar-month`/`calendar-cell`、`ad4cfb2c`(2026-08-23)把工作台月视图接到新组件时都没有携带该状态、类或样式；周视图由`50c6d1ed`补齐，Web端`MonthGrid.vue`一直保留`.day-cell.is-past`。日历路径无`SDKVersion`分支。
- 修复复用月视图唯一链路：`WorkbenchCell`/`createMonthCells`新增`isPast: !cell.isOutsideMonth && cell.businessDate < today`（与周视图同款比较语义、排除月外格），`calendar-month/index.wxml`转发`is-past`，`calendar-cell`新增属性、`is-past`类与`.calendar-cell.is-past{background:#f3f4f6}`。灰底规则在`.is-pressed`之前以保留按压反馈，`.is-holiday`粉底优先级不变；访客页复用同一模型与组件零额外改动；预览/补录/POC默认`false`不变；未新增依赖、token或版本分支。
- RED 3失败/26通过；上载体把同样7个文件线性叠加到最新累积体验版`.139@a9c3204f`（记录`3c8ea88d`）之上，定向49项通过。Mini完整与构建门禁、版本绑定与放行结果见下方交付记录。
- 用户在当前消息明确授权上传并放行。详情见`runtime-ui-compatibility-past-month-gray-20260915.md`。

## 上一批次：Skyline 访客周视图分页体验版139已上传并放行，待双实例复核

- 用户复核`.137@09e6398`：3.17.2访客页面周视图乱跳、切到非本周后点单元格无反应；月视图、成员周视图与3.17.3正常。
- 根因：访客页仍在用成员页于`.135`废弃的强制归中（`current=1`+`duration:0`回跳）与`weekPanels[1]`固定索引；3.17.2对该回跳反向动画或补发事件，并使原生页与数据槽位错位，点击落到不可见面板。
- 修复：访客页导入同一个`calendar-period-pager`环形状态机，`renderCalendar`用`mapCalendarPeriodRing`，模板加`circular`/`bindchange`并读取`weekPanels[weekSwiperCurrent]`；260ms、easeOutCubic、±6队列与提交锁不变，成员页面零差异。
- 血缘：`.138@09c100d5`（并行会话的选择器浮层与页头箭头修复）是当前最新累积体验版，本分支以它为基线线性叠加；不改写对方分支。基线若再次前进必须重新叠加。
- RED2项失败；GREEN定向42项、Mini完整174文件1206项通过/16跳过、根270文件1273项通过/444跳过。typecheck/build366文件/source/determinism/format/lint/smoke:check-core通过；主包1741484B/总4609138B，较`.138`增2337B。Mini verify仍仅被既有未改手排1507>1506阻断。
- `.139@a9c3204`已以production/clean上传，Manifest`a2491815…d91e4d7b`与tag/allocation/receipt一致；可信ensure只追加`.139`并保留旧版，allowlist与完整ECS verifier通过，公网`.139/.138/.137/.136`=200、动态未知426；live release未变。
- 当时下一任务：小米14双实例重开`.139@a9c3204`，复核3.17.2访客周视图滑动/点击与`.138`箭头/选择器无回归。详情见`runtime-ui-compatibility-guest-week-pager-trial-release-20260915.md`。

## 上一批次：Skyline 3.17.2 选择器浮层与页头箭头已实现，待体验版交付

- 小米14的3.17.2实例复核`.136@efda88f`：成员页面四项修复通过、3.17.3正常，但页头群组箭头比3.17.3偏右约40px；换班sheet的“我的班次月份/对方班次月份”点按后没有任何遮罩或面板；班次/人员下拉只剩约12px高的白色空框。
- 箭头是本轮自己造成的：`ed06031f`把3.17.2群组容器固定为220px，而箭头一直是相对该盒子的绝对定位元素，于是贴到盒子右缘。选择器则是旧Skyline在滚动容器内的布局差异：内嵌`scroll-view`弹层不按内容推导高度，`position: fixed`对话框层不在可见视口；同页`ui-sheet`不在滚动容器内所以正常。
- 修复只在3.17.2生效：箭头改为Flex流内跟随群名（220px上限与196px省略阈值逐字保留）；弹层按选项数写入显式高度（30n+10、空态56px、上限300px）；对话框层用`root-portal`提升到根层并复用根层令牌作用域，`enable`仅在3.17.2为true。3.17.3与未知版本的`popoverStyle`为空串、`enable=false`，走原路径。
- RED 3失败；GREEN定向14项、Mini完整174文件1203项通过/16跳过、根套件270文件1273项通过/444跳过。typecheck/build366文件/source/package/determinism/format/lint/smoke:check-core通过；主包1739147B/总4606801B，较访客修复基线增2083B，无新增依赖。Mini verify仍仅被既有未改手排节点1507>1506阻断。
- 分支`codex/runtime-3172-picker-overlay-20260915`基于访客修复`09e63980`；两份3.17.2修复在后续合并时必须保持同一血缘。详情见`runtime-ui-compatibility-picker-overlay-fix-20260915.md`。
- 用户当次明确授权“上传并放行”。源码`09c100d5`已推送，分支`codex/runtime-3172-picker-overlay-20260915`基线为访客修复`09e63980`，`origin/main`(4179f05a)仍是祖先。体验版`0.1.0-p10.20260915.138`说明“Skyline 3.17.2 picker overlays 09c100d”，production/clean，Manifest `1eb3d61b…a17e40a`，构建`13:52:36.805Z`、上传`13:54:26.399Z`；`.137`由同机另一任务占用，本轮顺序取得`.138`。
- 候选前置与上传后版本绑定检查`RESULT=PASS`（ready-clean-detached、production-clean、VERSION_LOCAL=absent）；冻结包/回执/分配记录及远端不可变tag一致。可信`schedule-client-version-allowlist ensure 0.1.0-p10.20260915.138`只追加并保留`.137`，独立allowlist verifier与`ecs-verify.sh`通过，release仍`44034fcc`、无应用部署或数据库操作。公网`.138=200`、`.137=200`、动态未知版本`=426`。
- 当时下一任务：小米14双实例核对`.138/09c100d`，3.17.2复核箭头位置、下拉选项可见与月份/日期面板可弹出，3.17.3确认页头与四类选择器与`.136`一致。自动化与生产验证不构成原生验收。详情见`runtime-ui-compatibility-picker-trial-release-20260915.md`。

## 上一批次：Skyline 3.17.2 访客页面按压反馈对齐已实现，待体验版交付

- 用户复核`.136@efda88f`：成员页面四项修复通过，但3.17.2访客页面仍出现周格灰色闪烁和月格蓝色反馈滞留。
- 访客页面已有`.is-skyline-3172-ui`根类并继承成员页面的Grid/Flex后备样式，缺的是两项条件参数：月历未传`runtime-pressed-feedback-compatibility`、周格无条件`hover-class="is-pressed"`。
- 现复用成员页面同一参数名与表达式，源码只改`pages/guest/guest.wxml`两行；成员页面零差异，3.17.3与无法读取版本不变，无新增依赖或第二套机制。
- RED新增1项并在该缺口准确失败；GREEN定向31项、Mini完整174文件1200项通过/16跳过、根套件270文件1273项通过/444跳过。typecheck/build366文件/source/determinism/format/lint/smoke:check-core通过；主包1737064B/总4604718B，较`.136`仅增132B。Mini verify仍仅被既有未改手排节点1507>1506阻断。
- 同时把`docs/project-status.md`收敛回40KB/250行预算内，旧批次细节保留在Git历史与`docs/audit/`。详情见`runtime-ui-compatibility-header-press-fix-20260915.md`。
- 当时下一任务：取得当前消息上传授权后交付新体验版并add-only放行、保留旧版，再由小米14双实例复核3.17.2访客与成员页面按压反馈一致。

## 上一批次：Skyline 页头与按压反馈体验版136已上传并放行，待双实例验收

- `.135@c7025b93`真机确认周切换已恢复；3.17.2仍有群名省略、菜单被日历文字覆盖、周格灰闪及月格蓝色反馈滞留，3.17.3正常。
- 群组菜单已收敛为所有版本共用的一份root-portal、一份模板和一个事件；仅3.17.2解除群名220px宽度的父级上限、移除周格灰色按压类并把月格松手保留从70ms缩为0ms。3.17.3的菜单几何/视觉、原周格反馈和原70ms不变，月/周分页动画完全不改。详情见`runtime-ui-compatibility-header-press-fix-20260915.md`。
- 累计RED 4失败，单菜单收敛RED 1失败；GREEN定向30项、Mini完整1199项通过/16跳过。typecheck/build/source/package/determinism/format/lint/smoke:check-core通过；主包1736932B/总4604586B，较`.135`总包仅增319B，无新增依赖。Mini verify仍只被既有未改手排节点1507>1506阻断。
- `.136@efda88f`已以production/clean上传；tag、allocation、Manifest `27702a1c…f908a32b`和receipt一致。首次`890c50a9`候选因过期canonical blob在占号/上传前停止，policy刷新后lineage/上传门禁通过。
- 可信allowlist ensure只追加`.136`且保留旧版；allowlist verifier、完整ECS verifier通过，公网`.136/.135`为200、动态未知版本为426。live release未变，未部署应用或修改数据库。
- 当时下一任务：小米14双实例均核对`.136@efda88f`；3.17.2复核四项修复，3.17.3复核页头/菜单/通知胶囊、单元格反馈和260ms动画均不变。详情见`runtime-ui-compatibility-header-press-trial-release-20260915.md`。

## 历史批次：Skyline 周视图兼容体验版135已上传并放行，待双实例验收

- `.134@5c02393`同角色双实例确认3.17.2周选中框、环形切周、群名尺寸和Toast组合圆角均异常；同机3.17.3及3.17.2月视图正常，排除账号、权限和排班数据。
- 所有版本周视图统一复用月视图已有`calendar-period-pager`，不再维护第二套强制归中机制；保留周视图原260ms/easeOutCubic、提交锁和有界队列。选中框、页头及Toast仍为3.17.2局部后备，3.17.3+视觉和动画时长不变。详情见`runtime-ui-compatibility-week-fix-20260915.md`。
- RED 3失败；GREEN联合47项、Mini完整1197项通过/16跳过。typecheck/build/source/package/determinism/format/lint/smoke:check-core通过；主包1736356B/总4604267B，较`.134`增3770B。Mini verify仍仅被既有未改手排节点1507>1506阻断。
- `0.1.0-p10.20260915.135@c7025b93`已production/clean上传，Manifest `1aec459f…45b3bf8`，tag/allocation/Manifest/receipt一致。可信ensure仅追加`.135`并保留`.134`等旧版；allowlist与完整ECS verifier通过，公网`.135/.134=200`、动态未知`=426`。未提审、正式发布或部署新应用制品；当时下一任务是两个实例做同版本原生复核。详情见`runtime-ui-compatibility-week-trial-release-20260915.md`。

## 历史批次：Skyline 3.17.2 专属 UI 兼容体验版134已上传并放行，待双实例验收

- 同一`.133@2d7f685`的小米14对照确认：异常实例基础库3.17.2、Grid顶部差8px且CSS圆环尖角；正常实例3.17.3、Grid顶部差0px且圆环正常。CSS变量和显式滚动均正常，根因是实例基础库/Skyline运行时差异。
- 只在`SDKVersion === 3.17.2`时为生产Grid启用局部Flex、为CSS加载圈启用本地SVG；3.17.3及后续/未知版本保留原WXML、Grid和CSS圆环路径。诊断探针不替换；API、数据、权限和交互语义不变。详情见`runtime-ui-compatibility-fix-20260914.md`。
- Mini完整174文件1193项通过/16跳过，typecheck/build/package/determinism/format/lint/smoke:check-core通过；主包1732843B、总4600497B，较`.133`增8869B（约0.19%），无新增依赖。Mini verify仍仅被既有未改手排节点1507>1506阻断。
- 首次正式上传在调用微信平台前被`5285dd1`等价血缘证明安全拒绝，未占用版本；兼容提交只为工作台TS增加精确版本判定的import、data类型和初始字段，未修改受保护方法。更新精确blob证明并复跑门禁后，`0.1.0-p10.20260914.134@5c023931`已production/clean上传，Manifest `1669cf39…60bf55`且tag/receipt一致。
- 可信ensure仅追加`.134`并保留旧版；allowlist verifier、完整ECS verifier和公网`.134/.133=200`、动态未知`=426`通过，服务器release仍`44034fcc`。未部署应用、备份/迁移数据库、提审或正式发布。详情见`runtime-ui-compatibility-trial-release-20260914.md`。当时下一任务：两个微信实例确认同一`.134`后，原生复核3.17.2恢复和3.17.3视觉不变。

## 历史批次：跨微信实例 UI 诊断体验版133已上传，待同版本取证

- 故障基线为体验版132/44034fcc；同一包在不同微信实例出现Grid纵排、加载圈尖角和测试工具无法滚动。异常实例尚无基础库报告，不宣称最终根因。
- 仅诊断页改为固定首屏加显式scroll-view，增加Grid/CSS变量/滚动自动探针、CSS/SVG对照和首屏复制；业务页面、API、权限与数据零修改。详情见`runtime-ui-diagnostics-20260914.md`。
- RED 1；合并后诊断/导出联合69、Mini完整1187通过/16跳过。Mini/Web TypeScript、production build、Storybook build和390/320/大字号辅助复核通过；均非微信原生验收。
- Mini verify仍仅被既有未改手排节点预算1507>1506阻断，本轮不放宽预算。累计候选`2d7f685a`已上传为`0.1.0-p10.20260914.133`，上传Manifest`eb302276…16b90b0`，receipt/tag/Manifest一致。用户单独授权后已可信追加allowlist并保留旧版；完整生产verifier通过，公网`.133/.132=200`、动态未知`=426`，live仍`44034fcc`。未提审或正式发布。
- 当时下一任务：正常与异常微信实例均确认`.133/2d7f685`，进入“更多 → 测试工具”，返回首屏截图、复制首屏诊断和能否继续滚动。收到两份同版本证据前不宣称最终根因、不修改业务UI。

## 历史批次：Feedback26 导出筛选切换重置文件状态

- 导出文件生成后，月份、年份、周期模式、岗位、人员、文件格式或导出类型发生实际变化时，统一清理旧任务/临时文件并回到“选择内容后创建任务”；相同值点击不重置。
- RED 7失败/29通过，GREEN控制器36通过，导出相邻边界联合43通过；Mini production verify通过，包体4579789字节、Worklet2/2。
- 检查点：`4179f05a fix(miniprogram): reset generated export after selection changes`。本轮只有静态/Node/Mini构建证据，未操作开发者工具、未上传或部署，原生验收未进行。

## 历史批次：Feedback22 已部署并放行124，待小米14复核

- 双二维码API响应被Mini严格解码器误拒绝，已补齐`trialImageBase64`生成schema回归。导出页删除旧白屏诊断链，改为首屏立即呈现和后台选项读取。
- 新增Excel/CSV切换及同源`ui-selector`岗位/成员多选，“全部”互斥；schema58/API支持真实OOXML `.xlsx`并兼容旧CSV。
- 完整verify、测试库迁移28项/导出集成6项、Mini verify/Worklet/确定性/包体通过。浏览器冒烟因本地5173未启动而拒绝连接，已如实记录，非原生验收。
- 4cdfdbbd/f0c46078已推送。部署前54表加密备份完成，f0c46078/schema58部署和完整ecs-verify通过。
- 体验版124/f0c46078上传成功，Manifest `e28a01c5…2d3a`；可信ensure仅追加124，公网124/123=200、未知=426。当时下一任务：小米14复核双二维码、导出首屏、自绘多选和Excel/CSV；未提审或正式发布。

## 历史批次：Feedback21 已部署并放行123，待小米14复核

- 公开访客排班采用7天持久缓存与后台刷新，凭证和完整手机号不落盘；正式/体验二维码分环境生成并合成带群名PNG。CSV增加Excel BOM、服务端创建后立即处理，Mini自动下载后显示发送文件/取消；导出页冗余说明区已删除。
- 附件确认9月8—9日源快照简称为全，其余28日为全天；不是CSV截断，未直接改生产历史排班。
- 最终全门禁通过，9e603fdb已推送；体验版123上传成功。后续授权下完成严格host-key协调、54表加密备份、be6ff2ac部署和完整ecs-verify。
- 可信ensure仅追加123并保留旧版；allowlist及ECS verifier、公网123/122=200、未知=426通过。当时下一任务：小米14复核访客缓存/双二维码带群名及CSV速度、自动发送和Excel编码。未提审或正式发布。

## 历史批次：Feedback20 已上传并放行122，待小米14复核

- 累计检查点66b18b26已推送；包含121导出真实上传转换修复、本轮访客月窗/返回登录、删除二维码相册链路，并保留二维码点击预览/轮换自动读取。CSV下载失败确定为公众平台downloadFile合法域名配置。
- 122/66b18b26 production/clean上传成功，Manifest fd736127…bece5，receipt/tag一致；可信ensure仅追加122并保留121，完整verifier与公网122/121=200、动态未知426通过。服务器release仍83d8a03b，无代码部署或数据库操作。
- 自动化验证为Mini1159/16跳过、根1254/439跳过、依赖保护81，最终主包1709746/总4549449；不代替小米14验收。
- 当时下一任务：管理员在公众平台补`https://hosp.schedule.eylinhome.top`的downloadFile合法域名，再由用户在小米14重开122/66b18b2复核CSV、访客三控件/三视图和二维码长按。未提审或正式发布。

## 历史批次：Feedback19 导出页真实上传转换故障已修复，待体验版交付

- 基线3d83d236（体验版120源码c2dbe4c3）；独占general-5，REUSE_ONLY，未安装依赖。
- 根因：106已包含的9bae5beb在共享CSV轮询循环中增加捕获remaining的Promise闭包，
  微信SDK ES6转换生成regeneratorValues，但SDK既未识别也未附带此模块，导致页面载入即失败。
- 本轮运行真实miniprogram-ci转换及仅含其自带helper的VM，旧产物缺模块失败，新产物注册和初始化通过。
  详细引入点、语义审计与旧测试盲区见docs/audit/feedback19-export-runtime.md。
- 修复等待函数作用域，保留轮询/超时/取消语义；导出恢复单一Page及静态模板，
  保留data群组上下文。删除临时组件wrapper、重复加载壳/样式、挂载计时器和未调用测量代码。
- 替换临时结构测试为上传转换后Page运行测试；Mini verify增加SDK helper可打包性门禁。
- 验证：Mini全量168文件1191项通过、2文件16项跳过；共享presentation-core32项通过。
  Mini verify/Worklet2/2/包体4,551,833字节/确定性、typecheck、lint、format、icon parity、
  smoke:check-core通过。既有主包和矩阵内部预警保留；未控制微信开发者工具。
- 检查点：fix(miniprogram): repair export upload transform and remove startup scaffolding。
- 下一任务：交付此修复的干净体验版，再由小米14验证真实导出入口及CSV下载/发送。
  尚无修复后同SHA真机证据，不将Node执行等同于原生通过。生产应用与数据库不在本轮修复范围。

## 上一批次：Feedback14 已交付111，导出白屏待同版本报告

- 本轮限定两项反馈；实现与引入点见docs/audit/feedback14.md。基线e163fde8，独占general-4/5依赖复用、无安装。
- 更多页位移来自7923262d的onHide删除底部诊断区域、返回再插入。现在普通遮盖保留已授权区域，权限撤销仍即时生效，后台不能新授权或跳转；没有WXML/WXSS或无关UI修改。
- 新位移回归先失败后通过；workbench31、联合真实导出及诊断69项通过。390×844/320生产样式浏览器复现旧内容缩短107px、修复布局保持不变，原生效果待同版本验收。
- 导出已对照102/106及9bae5beb、执行110真实冻结JS与真实Page测试，未证实原生白屏根因。新增可复制的固定首屏阶段与root/header/scroll分类诊断；不改CSV操作语义，不宣称白屏已修复。
- 检查点fix(miniprogram): stabilize More navigation and expose export render stages；完整pnpm verify通过：Mini1179/15跳过、根1251/436跳过、依赖保护81；最终Mini verify、Worklet2/2及包体通过。用户随后批准上传并追加放行，已交付111/6b8a9e9，保留110；完整生产verifier/allowlist及公网111/110=200、未知426通过。服务器仍e163fde8，无新应用部署。
- 当时下一任务：小米14重开111/6b8a9e9，复核更多位移，进入导出停留5秒返回，再到测试工具刷新并复制完整诊断报告。交付见docs/audit/feedback14-trial-release.md；不重复上传、放行或部署，白屏仍待定位。二维码及自动收信待用户原生复核状态保留。

## 上一批次：Feedback13 已部署并上传110，待用户真机复核

- 应用8f441d2d已推送部署，累计体验版0.1.0-p10.20260912.110上传成功并仅追加放行，109继续可用。四项日历修复和五类通知独立授权入口均包含；交付证据见docs/audit/feedback13-release.md。
- 加密备份0e13bb85-dabe-40b4-ae94-a7beb6fafefc（54表、106020632字节）实际hash核验一致；schema57，无新增迁移。完整生产verifier/allowlist通过，公网110/109=200、未知426。
- 五模板配置、四业务模板实际字段和外部消息能力复核通过。未主动发送真实消息、不重放历史通知。上传30项、356文件Manifest/receipt/远端tag一致，主包1704137/总包4535157字节。
- 实现验证沿用完整pnpm verify：Mini1170/15跳过、根1251/436跳过、依赖保护81；额外跨月高度2项、MySQL calendar36及390/320生产CSS/ViewModel几何和本地浏览器通过。均非小米14验收。
- general-4/5独占复用，无依赖安装。文档检查点docs(release): record feedback13 delivery，在本次部署授权内以可信哈希复用流程同步文档release身份，应用及体验包仍绑定8f441d2d。
- 当时下一任务/停止条件：小米14重开110/8f441d2，复核四项日历交互及五个通知授权按钮、自然自动收信；二维码相册保存、导出白屏和发送文件仍待当前版本真机证据，不提前标记完成。不重复上传、放行、模板配置或护士导入。

## 上一批次：feedback11 体验版108已上传放行，导出空白待定位

- 代码实施基线72ea0ab0；用户原截图体验版号未知。QR-11和NOTIFY-11已复现并实现，EXPORT-11本地未复现，保持待定位；详情见[feedback11.md](feedback11.md)。
- 复用general-4依赖；RED 4失败/38通过；完整格式/lint/build/typecheck、Mini1122/15跳过、根1240/421跳过及依赖保护81通过。最终Mini verify/Worklet/包体/确定性、打包入口检查和smoke:check-core通过。上述为代码实施轮证据，体验版交付见下条。
- 用户明确授权后，c563afff上传为108，production/clean、Manifest/receipt/tag一致；上传专项30项和候选检查通过。可信ensure追加108、保留旧版，完整生产verifier及公网108/107=200、未知426通过；服务器仍b618d938，无新应用部署/备份/迁移。见[feedback11-trial-release.md](feedback11-trial-release.md)。
- 文档检查点：`docs(release): record feedback11 trial 108 delivery`。当时下一任务：小米14重开108/c563aff复核两项修复，复制导出空白的安全诊断继续定位。没有同版本小米14反馈，不宣称原生通过或三项全部修复，不重复上传或放行。

## 上一批次：feedback10/VIS-02 服务端与体验版107已交付

- 用户已授权上传、追加放行及必要部署。累计应用0565f023包含feedback10四项修复和VIS-02访客日历，发布校验修复b618d938已提交推送并部署，实际live为b618d93861d05ae0c597fa8dfe40ed478902be5c、schema57。完整生产verifier和既有版本策略验证通过；详情见docs/audit/feedback10-release.md。
- 部署期间发现0057新增访客关联表后旧校验器不接受54表新备份。仅新增schema57迁移前53/迁移后54表分支；旧代码23通过/2失败，修复后发布/回滚35项通过，项目lint、格式、smoke:check-core通过。未改变业务数据或新增迁移。
- 最终部署前备份e011c56b-699e-422d-9b30-24b2282279f4，实际104354272字节、54表，SHA-256 6fcb93a4d09413a789abbd198eaaea4c0240ed82047968d03dae7b95abbadeb2与登记一致。应用与控制产物hash验证通过；回滚候选来自本次即时live 0565f023。
- .103/.104失败记录保留；直连IPv4出口120.230.6.0加入微信CI白名单后，.106=0.1.0-p10.20260911.106绑定63877b5e和Manifest c4bf033e252a94927000c6489fabb9f33f679c608c2abb6104606c5f3cc44ceb上传成功，receipt/tag一致。
- 独立HTTPS核验：.102仍200，.103/.104均426；不修改微信平台配置、不关闭IP白名单、不改系统网络。浏览器库存读取失败，无法核对公众平台配置。已归档冻结包/错误/备份/发布证据到ignored runtime/audit/feedback10-delivery-final-20260911及feedback10-delivery-initial-20260911；确认上传进程退出后清理本任务孤立操作锁，不改预约记录。
- 应用验证复用feedback10.md和visitor-calendar-parity.md：合并MySQL45、Mini联合146、共享/API33及访客浏览器通过，Mini/Worklet和专项上传30项通过；不把自动化算作原生验收。CSV真实发送、相册扫码、瞬时通知、新消息点入及访客显示均待小米14。
- 独立HTTPS核验：.106/.102=200，.105/.104/.100/未知版本=426；trusted ensure仅追加.106并保留旧版。无workspace依赖安装、无本地数据库上传、无真实通知、无正式发布或旧版退役。
- 文档收口检查点：docs(release): record successful trial 106 delivery。当时下一任务：小米14复核CSV下载/发送、相册扫码、通知点入日历和访客显示。
- 体验版107已成功上传并追加放行：SHA `4b4af0a`，Manifest `ed36fd07…94bfc4`，receipt/tag/allowlist 一致；服务端 live `b618d938`/schema57，无重复部署。首次 ECONNRESET 已用同一不可变三元组和已验证 IPv4/TLS 路线重试成功。当时下一任务：小米14复核107的 CSV 下载/发送、相册扫码、通知点入日历和访客显示。

## 上一批次：feedback9 体验版102已上传并放行，待小米14复核

- 用户已确认完整方案；独占 general-4/general-5，各自离线校准后复用依赖。
- 九项代码均已实现并整合，已保留访客101最新基线656a463d。新增回归先失败再通过；最新定向70通过，pnpm verify完整通过（Mini1057/15跳过、root1226/418跳过、依赖保护81）。最终Mini verify与Worklet2/2通过。
- 详情、引入点、基线和验证见 [feedback9.md](feedback9.md)。桌面 CSS/Node 检查不能代替小米14真机。
- 应用e40c4f9201bd7e79af151508e00e6667b6897a63已推送并经用户授权上传为0.1.0-p10.20260910.102；production/clean，353文件Manifest、receipt、远端tag一致，上传专项30项及候选检查通过。版本绑定主包1646789/总包4441027字节；交付见[feedback9-trial-release.md](feedback9-trial-release.md)。
- 可信ensure仅追加.102并保留旧版，完整生产verifier/allowlist验证通过；独立HTTPS .102/.101/.99/.98=200、.100/未知=426。服务器应用仍4e0a0d1a/schema57；无新应用部署、数据库备份/迁移、主动通知或正式发布。
- 文档收口检查点：docs(release): record feedback9 trial 102 delivery。当时下一任务/停止条件：用户在小米14重开.102/e40c4f9并核对trial/renderer/基础库/微信版本，复核群组偏好、矩阵与月历、日期加载、补录和CSV实际下载/发送/取消。自动化交付完成，待用户原生复核；当前不宣称真实下载故障已闭环，不重复上传或放行。

## 上一批次：访客修复体验版101已上传并放行，待用户原生复核

- .101/f7bc3ccc已成功上传，涵盖访客切群观察器、接口/缓存/角色隔离、匿名扫码原生Page及Skyline自定义导航安全区。细节见visitor-system-fix.md和visitor-trial-release.md。
- 本次授权上传并追加放行有效；旧动效整文件证明先失败，15方法AST及其他8个blob核对后补充；.100在官方编译因default导航失败，未放行且号码永久保留。导航修复后.101官方编译与上传通过。
- .101为production/clean，353文件Manifest、receipt、tag一致；主包1646685/总包4433783。上传专项28+6项、导航17项、Mini verify/确定性/Worklet通过，其余应用证据复用已验证源码。
- 可信ensure只追加.101，完整生产verifier/allowlist通过，独立HTTPS .101/.99/.98=200、.100/未知=426。服务器live仍4e0a0d1a，医护关联未操作；未另行部署、备份、迁移或发送通知。
- 文档收口检查点：docs(release): record visitor trial 101 delivery。当时下一任务/停止条件：小米14重开.101/f7bc3cc并记录trial/Skyline/基础库/微信版本，反复切医护群、三视图筛选及扫码/后台往返。实现及自动化交付已完成，待用户原生复核；仍闪退则继续定位，不宣称卡死/闪退已消除。未提审或正式发布。

## 上一批次：feedback8 体验版99已上传并放行，待小米14复核

- 基线6729ec0a（应用50744302/体验版98），9项新反馈；账户清理已生产验证，应用代码完成本地运行验证，真机效果待用户复核。
- 已定位：预览严格schema遗漏完整排班字段；JSON空正文DELETE本地Fastify400；班种未选中也着色且缺项提示被删除；预览丢失颜色和弹窗固定高度；邀请接收路由缺失；微信实际模板四字段与发送两字段不匹配。
- 使用独占general-1复用工作区依赖。确认的3账户清理完成，现32/24/8、4011排班归属保留；应用8e68a480已推送并部署生产。上传提交ca634116已交付0.1.0-p10.20260910.99且只追加放行，详见feedback8-trial-release.md；未主动发送通知。
- 已确认：仅好友/群聊邀请卡片；重叠原姓名删除线＋拟姓名暗红字。唯一班种自动选择为可选项，未答前保留手动选择。账户清理已完成，不再等待弹窗或重复执行。
- 最终pnpm verify通过：Mini996/15跳过，root1215/402跳过，依赖保护81；长确认弹窗边界补测21通过，最终Mini verify及320/390桌面几何通过。主包1764091/总包5324841字节。复用原pnpm smoke:browser及同API源码真实MySQL15项结果；均非原生或真实收信证据，详情见feedback8.md。
- 本地Docker本轮因自身Inference socket故障无法启动，未重新跑真实MySQL集成；没有重置Docker或安装依赖。无新增API修改使此前15项证据失效；最后补充的兼容去重断言未在新一轮MySQL中执行，不宣称已复测。
- 服务端备份d5dac482-6607-434e-94cc-8e1711738942及hash核验通过；完整生产verifier、旧版本策略验证通过。实际部署模块的模拟网关四字段检查通过，真实发送0；数据仍32/24/8和4011排班，无缺失成员引用。
- 本轮上传专项30项、候选/版本绑定检查通过；主包1765638/总包5328015字节，349文件冻结Manifest与receipt/tag一致。放行后完整生产verifier通过，独立HTTPS .99/.98/.97=200、未知版本426。服务器应用仍8e68a480，旧版本保留。
- 当时下一任务与停止条件：用户在小米14重开.99/ca63411，验证九项视觉与交互、邀请分享和本人收信。实现及自动化交付完成，待用户原生复核；不提审/正式发布，不重复上传、清理账户或部署应用。

## 上一批次：feedback7 体验版98已上传并放行，待小米14复核

- 17项交互整改应用507443024bb883a35cbea2b27f20ba933cbdc9a3已上传为0.1.0-p10.20260909.98；用户确认的默认空白模板、删除失效排序箭头均已包含。实现见docs/audit/feedback7.md，交付见docs/audit/feedback7-release.md。
- 用户当次批准上传，随后另行批准只追加新版到服务端并保留旧版；已完成。正式上传receipt、340文件冻结Manifest及远端tag一致。
- 服务端可信ensure追加1个版本；完整生产verifier与allowlist验证通过，外部HTTPS .98=200、.97=200、未知版本=426。服务器live仍36fae3d1，本轮不部署应用代码或迁移数据库。
- 实现证据981通过/15跳过；本轮上传专项30通过，版本绑定包主包1753208/总包5135578字节，保留已有主包内部预警。独占warm槽顺序复用，无依赖安装。
- 文档收口检查点：docs(release): record feedback7 trial 98 delivery。只记录已交付应用50744302/.98，不重复上传、部署、备份或同步服务器元数据。
- 当时下一任务与停止条件：用户在小米14重开体验版，确认.98/5074430后复核群组管理、手排模板/预览/草稿/发布、补录、岗位成员。当前自动化交付完成，待用户原生复核；未提审、正式发布或主动发送通知。

## 上一交付：feedback6 体验版97

- 十一项整改已进入应用36fae3d145982d793c1dee243a6eb12867962fb6及体验版0.1.0-p10.20260909.97。3aeaa4c8业务修改完整保留；36fae3d1仅补充历史导航动效证明。结果见feedback6-result.md，发布证据见docs/audit/feedback6-release.md。
- 用户当次授权上传、备份、0055/0056迁移部署及旧版本停用；全部完成。最终schema56，完整生产verifier和版本控制验证通过，外部HTTPS .97=200、.96及未知版本=426。仅.97在允许列表，legacy标识保持原值。
- 备份8ed1f840-8a23-4eff-ae0b-43a1123c862f实际文件hash核验通过。迁移前后账号/排班/事件/模板总数不变，手机号镜像差异0；未删账号或补造历史事件。生产仍为权威数据库，无本地业务数据复制。
- 应用证据复用3aeaa4c8全量verify（Mini971/root1208）、真实MySQL分批回归及原pnpm smoke:browser流程；本轮发布保护35、动效/血缘/候选锁28项通过。最终上传335文件，Manifest与receipt/冻结包/远端tag一致；版本绑定主包1751101、总包5121308字节，Worklet2/2。
- 独占general-1顺序复用，无依赖安装。文档收口检查点：docs(release): record feedback6 trial 97 delivery；只记录已发布36fae3d1，不再次部署/上传/备份。lease状态以ignored runtime官方状态为准。
- 当时下一任务与停止条件：用户在小米14重开.97/36fae3d后复核日历08:00、手动排班/补录、账号管理及通讯录首搜。原生交互/更新提示/搜索耗时未验证；未提审、正式发布或主动发送通知。当前自动化交付完成，待用户复核。

## 上一交付：微信换绑修复体验版96

- 应用a6586326、体验版0.1.0-p10.20260908.96已上传并完成服务端部署/版本放行；生产最终verifier通过。身份修复及网页微信登录退役已进入此版本。
- 上传Manifest=d7db136a1b3edb5e2219d9499607cb78b2255320aa9ad9a754413c6f6bacc1dd，receipt、冻结文件归档及远端版本标签一致。详情见wechat-rebind-release.md。
- 验证沿用wechat-rebind.md的全量检查、65项MySQL和浏览器证据；本轮额外发布门禁24项及候选安全检查通过。没有原生验收或实际收信结论。
- 生产备份与hash校验成功，无迁移、本地业务数据复制或依赖环境安装。未主动发送测试通知，未提审或正式发布。
- 上一交付原生待复核项继续保留：微信往返换绑和提醒诊断，不自动发送通知。
