# Project Status

## 当前批次：医生值班表双向校对（实现已完成，待生产与体验版交付）

- 独占 warm 槽 `runtime/wt/general-6`，`REUSE_ONLY`，基线 `45bf7bec`，未安装依赖。对方公开页面轮值与 `/api/overrides` 还原 2026-08-01 至 2027-06-30 值班表；每日北京时间今天起与已发布“医生群／一线／全天班”比对。首次差异待确认；人员或班次不唯一时阻塞；失败不写排班。
- API 每分钟任务、快照和来源分类、平台管理员授权、小程序“更多”入口已实现。对方到本系统调用现有加扣班或换班预览/直接创建；本系统到对方在双方重读、待处理记录原子占用后保存并回读。处理中只有生效值班一致才转已一致。新差异按扫描批次一次写入站内通知与现有排班更新模板投递链。
- 验证：真实本地 MySQL 迁移 30/30；新模块单测 13/13，定时脚本 2/2、job runner 3/3；加扣班集成 27/27、换班 34/35，唯一失败为既有“归档后重发布 period.id”断言，前序项目记录已标记同一失败，和本轮链路无关。Mini 全量初跑 1285 通过/21 跳过，6 个旧固定路由断言随新页面调整后定向 20/20；API/Mini 类型、API构建、任务 ESLint、Prettier、Mini production verify、`smoke:check-core` 通过。Mini 包体 4,375,936 B；主包 1,641,484 B 超内部 1.5M 警戒线但在平台限制内。生产真实排班、微信投递、小程序体验版和小米14尚未验证。
- 应用检查点 `a5de1931`、schema 门禁 `5d4e96bf`、备份表数校正 `e4dc2ecf`、唯一班次定位 `cd7faa2f` 已推送。首轮生产备份 `afd557e8-1bfa-4715-837c-fe970561be3e`（54 表）；第二轮备份 `10694934-7cb3-40dd-8c14-ef89e830ab1e`（55 表），均成功。`cd7faa2f` 已部署、独立完整 verifier 通过。运行时扫描又因原始行锁 SQL 未转义保留字 `groups` 失败；已替换为 Drizzle 行锁，真实本地 MySQL 定向用例 1/1 通过。前述只读核对显示“一线＋全天班”唯一组，未来匹配已发布班次 214 天。下一步仅完成当前批次：提交并推送行锁修复，从实时 `cd7faa2f` 前驱重新备份、打包部署、完整 verifier，确认校对任务成功；同 SHA Mini 候选上传体验版。失败时保留当前生产 release，不声称监测已运行；小米14真机另行验收。

## 当前批次：通知最近30天（生产与体验版.212已交付，待用户复核）

- 用户要求通知同样保留最近30天。schema66保存显示标记和索引，复用凌晨每日维护；列表、未读角标、分页和已读操作范围一致，保留原通知/已读/投递历史。Mini说明改为“最近30天”。
- 基线f93868d0、生产前驱实时b0bac240、已有体验版.211；warm/REUSE_ONLY，无install。API通知10/10、迁移30/30、共享维护4/4、单元/发布40/40及类型/lint/build/格式/图标/core smoke通过，开发者工具模板编译成功；[轮次记录](audit/notifications-retention-30days-20260928.md)。
- 应用8bb3c6e4（`feat(notifications): retain the latest 30 days in notification lists`）已推送部署，备份be0ed062-e891-4505-943c-9589384b6817大小/哈希通过。schema66隐藏307条，862通知/30投递的原业务字段哈希一致；23用户、282次读取全200，4–63ms，列表/分页/角标一致。旧65自动回滚不兼容，不绕过门禁。
- Mini全量1291通过/21跳过，production verify、CI dry-run和血缘通过；clean体验版.212@8bb3c6e已上传并add-only放行，完整身份和候选检查通过。独立allowlist/最终完整ECS verifier通过，严格TLS公网.212/.211=200、未知426。交付文档消息 `docs(audit): record notification retention delivery`，文档不重复部署/备份，应用release保持8bb3c6e4。
- 唯一下一任务：小米14退出重进同构建.212，复核通知最近30天说明、角标、列表/分页与已读操作。服务端及体验版交付已完成，真机待用户复核，不提审/正式发布。

## 上一批次：工作流历史过去30天（生产与体验版.211已交付，待用户复核）

- 用户将已结束工作流的过月隐藏改为北京时间滚动30天；待处理/仍生效保留，六处Mini列表增加说明。排班仍按月份归档锁定，原事件/补录一次性隐藏不变。
- 基线ecd8c2be，生产前驱实时核对4674c8bc，保留.210联系方式改动；独占warm/REUSE_ONLY，无install。旧实现跨月回归3失败，修改后真实MySQL定向5/5，Mini1291通过/21跳过，类型/lint/build/格式/图标/core smoke/verify/dry-run/血缘及三个开发者工具模板编译通过。
- 应用 `b0bac240`（`fix(workflows): retain closed records for rolling 30 days`）已推送/部署，备份 `cb40f946-74fd-4080-832f-cd06febd7002` 大小/哈希通过。既有维护任务校准恢复1条近30天加扣班，重触发当天跳过；56请求200、最大127ms，业务字段哈希一致，306事件/3162补录仍隐藏、过月published残留0。详情见[轮次记录](audit/workflow-retention-30days-20260928.md)。
- clean production体验版 `0.1.0-p10.20260928.211@b0bac24` 已上传并add-only放行，tag/allocation/Manifest/receipt一致；前后候选检查、独立allowlist与最终完整ECS verifier通过，严格TLS公网.211/.210=200、动态未知版426。交付文档消息 `docs(audit): record rolling 30-day retention delivery`，文档不再次部署/备份，生产release保持b0bac240。
- 唯一下一任务：小米14退出重进同构建.211，复核六类列表的过去30天说明与记录、既往排班锁定。当前已完成服务端与体验版交付验证，待用户真机复核，不提审/正式发布。

## 上一批次：号码行与联系方式弹窗（体验版 .210 已上传放行，待真机复核）

- 用户确认先完整显示号码弹窗，点击输入框后再弹系统键盘；两行改为普通直线分隔、号码右对齐、移除箭头。取消自动聚焦/预热，仅该 sheet 关闭入场动画及静止 transform；保存与跨群同步不变。
- 基线 `7f6d4f40`，独占 warm/REUSE_ONLY、无 install。旧代码新增回归6失败，修改后定向47/47、Mini全量1291通过/21跳过；类型/lint/任务格式/图标/core smoke/production verify/CI dry-run/血缘通过。全仓格式仍五个未改文件既有失败。
- 390/320与大字号几何代理通过，相关开发者工具模板/样式编译通过；原生输入同步待小米14同构建验收。总包/主包各减少475 B。详情见[轮次记录](audit/profile-contact-sheet-20260927.md)。
- 应用 `09b834e7`（`fix(miniprogram): show contact editors without autofocus motion`）已推送main；clean production体验版 `0.1.0-p10.20260927.210` 已上传，Manifest `25cca22ee6916cdbc4d06d5f0b6d34e27e72f3568feef6d6d42e83f3839e3dca`，tag/allocation/receipt/构建身份一致，候选前后安全检查通过。交付文档消息 `docs(audit): record contact editor trial 210 delivery`。
- 用户随后明确授权“放行”：受信 `ensure` 只追加 `.210` 并保留旧版，前后完整 ECS verifier、独立 allowlist verify 通过，公网 `.210/.209=200`、动态未知版=426；实时应用 release 前后均为 `4674c8bc`。放行记录消息 `docs(release): record contact editor trial 210 allowlist`；未部署应用/同步 release 元数据、备份或迁移数据库，未提审或正式发布。
- 唯一下一任务：小米14同构建 `.210@09b834e7` 冷启动复核首次打开手机号/短号、点击输入框及键盘收起；取得同构建真机证据前保持“待用户复核”。

## 上一批次：历史数据库状态与凌晨归档（生产已交付，待用户复核）

- 用户报告数十秒加载，并要求数据库保存展示状态、凌晨自动过期/归档。已确认补录审计关联查询导致约19秒请求和权限锁等待；schema65改为存储字段/索引，复用既有调度在北京时间03:00后每日维护一次，失败补跑，过去published真正写为past。
- 基线8197ff88/前驱生产e1de2a0e，独占warm/REUSE_ONLY、无install。2000补录真实存储读取2,003,009→2007；迁移29/29、定向集成105+1通过、单元/发布控制46/46，类型/lint/build/core检查通过。完整证据和行为清单见[记录](audit/history-database-maintenance-20260927.md)。
- 应用 `4674c8bc`（`fix(api): persist history visibility and archive expired months nightly`）已推送/部署，完整生产verifier通过。备份 `970431c4-558e-498b-8997-e85d67b69713` 大小/哈希核对通过；schema65，首次归档2个排班、标记11条工作流，再运行返回当天已完成。
- 生产56个请求均200、三种客户端列表一致，大群组补录19110→22–26ms，并发页面请求20–117ms；306事件/3162补录隐藏，过月published数据库残留0。328事件/4897班次/35工作流/3468原隐藏审计标记的业务字段哈希一致。公网`.209/.208=200`、未知426，Mini无需重传。
- 交付文档检查点消息 `docs(audit): record persisted history production verification`；不再次部署/备份，生产release保持4674c8bc。唯一下一任务：退出重进`.209`小米14复核加载、历史列表和2026-08锁定；服务端已完成，真机待用户复核，不提审/正式发布。

## 上一批次：API统一历史过滤（生产已交付，待用户复核）

- 用户追加要求不依赖小程序标识。六类工作流、群组事件时间线、最近补录在数据库查询中统一过滤；删除客户端分支和可选Mini开关。网页同类列表同步过滤，单班次审计/事件详情与原始数据保留。
- 基线 `6899cd06`，warm/REUSE_ONLY，无install；新范围回归旧代码7失败，API类型/lint/build/core smoke通过，真实数据库126通过/1既有归档重发布失败（新范围7项全部通过），生产回读见[记录](audit/history-api-policy-20260927.md)。不重复清理既有306事件/3162补录标记，不改Mini包，继续`.209`。
- 应用 `e1de2a0e`（`fix(api): enforce history visibility for all clients`）已推送/部署，完整生产verifier通过。备份 `c638d6ea-72c8-4449-aa97-98a958cef81f` 大小/哈希核对通过；16个生产列表在无标识/Mini/Web下全部一致，隐藏事件及现存补录泄漏0，328条事件/4897条班次数量和哈希未变。
- 交付文档检查点消息 `docs(audit): record uniform API history delivery`；文档不再次部署/备份，生产应用release保持`e1de2a0e`。唯一下一任务为`.209`小米14和网页同页复核，真机待验证；出现回归停止验收并定位，不提审/正式发布。

## 上一批次：历史列表回归与过月排班锁定（生产已交付，待小米14复核）

- 应用 `abab2fc3`（`fix(api): honor Mini history visibility and lock past releases`）已推送并部署，修复密码登录绕过六类列表/事件隐藏、最近补录一次性清理及过月排班锁定。独占 warm/REUSE_ONLY，无 install。
- 新增回归最终7/7、Mini页面消费者36通过；API相关9文件155通过/1既有归档重发布断言失败（原版已复现）。API类型/lint/build、任务格式/core smoke、正式打包及完整生产verifier通过。详见[轮次记录](audit/mini-history-regression-20260927.md)。
- 备份 `119a9735-e479-4cb9-b3e4-d75d731c6a42` 大小/哈希核对通过。生产HTTP回读：过月失效列表项0；Mini事件22项、旧日期与隐藏标记泄漏均0；2群组3162条现有补录快照隐藏、再次预览0；过月published残留0，106个过去排班撤销预览均409。328条原始事件/4897条班次的数量及全内容哈希不变。
- 保留 `.209@4d9cde15` 客户端，无Mini源码变化/新上传；API release为 `abab2fc3882d8c1202b04b5bb2230a3d170f958e`。交付文档消息 `docs(audit): record history regression production verification`，不重复部署/备份/同步release。
- 当前已完成API运行验证，待用户复核。唯一下一任务：退出重进 `.209` 小米14，检查六类记录、事件时间线、最近补录和2026-08既往锁定。真机未验收；发生回归停止验收并处理，不提审/正式发布。

## 上一批次：历史信息清理、操作者显示、分段滑动（生产与体验版 `.209` 已交付，待小米14复核）

- 基线 `074ce633`，独占 warm/REUSE_ONLY、未安装。Mini 工作流在服务端过滤已过月份的关闭/过期项，待处理及跨月保留；事件操作者姓名按需返回，旧客户端响应兼容；统计/事件、月/年、通知提醒模式增加持久滑块与大字体/减少动态效果支持。
- 用户确认：普通事件严格早于北京时间 2026-09-24 00:00，以及目前已有的全部补录事件，一次性从 Mini 时间线隐藏。使用逐事件审计标记，无硬编码永久日期规则；后台原始事件、班次、统计不删除，后续新事件正常显示。
- 新增回归先红后绿；API 定向 108 通过/1 既有失败（原版复现），追加路由用例与最终 events 7/7 通过；共享 144、Mini 全量 1288 通过；类型/lint/构建/图标/Mini verify/浏览器完整冒烟通过。全仓格式仍五个未改文件既有失败。匿名开发者工具页面切换与操作者显示通过；小米14待验收。详见[轮次记录](audit/mini-history-events-20260927.md)。
- 应用 `4d9cde15`（`feat(miniprogram): trim history and animate insight controls`）已推送/部署；备份 `87619fd3-f552-46e9-82db-fdbb73f0cec9` 的大小/哈希验证通过，完整部署验证通过、schema64。一次性隐藏2群组306条事件；后台328条原始事件数量/内容哈希不变，Mini剩余22条均有操作者姓名。
- clean production体验版 `0.1.0-p10.20260927.209@4d9cde15` 上传并add-only放行；Manifest `49c69ecbe63b7adce07fdf385c1a6ee3446352e56b57c40de388a40337897b3f`，tag/receipt一致。网络失败保留同版本/SHA/Manifest后安全重试成功。独立版本与最终完整ECS验证通过，公网`.209/.208=200`、未知426。
- 交付文档检查点消息 `docs(audit): record history cleanup and trial 209 delivery`；按文档专属例外，生产应用release仍`4d9cde15`。唯一下一任务：同版本/SHA小米14复核历史列表、操作者姓名、三个分段控件及新补录事件。版本不符或业务回归停止验收；不提审/正式发布。

## 上一批次：日历姓名左对齐微调（体验版 `.208` 已上传放行，待小米14复核）

- 基线 `d22cf2c9`，独占 warm/REUSE_ONLY、未安装。三字＋标识仅作统一倍率基准，实际所有姓名组合左对齐；首页/访客、手排生成/草稿/发布预览与补录共用月格，两套周历与列表一并验证。仅改两个显示文件，App缓存、倍率、长姓名省略及周标识下一行规则不变。引入点 `17598dc8`，详见[轮次记录](audit/calendar-left-align-20260927.md)。
- 旧代码回归2失败/7通过，修复后定向63通过；Mini完整1,288通过/18跳过，类型/lint/任务格式/几何/图标/core smoke/Mini verify/CI dry-run/血缘通过。全仓格式仍是五个未改文件的既有失败。最终主包1,624,850 B、总包4,334,400 B。
- `60643087`（`fix(miniprogram): left-align calendar names at shared scale`）已推送，clean production体验版 `0.1.0-p10.20260927.208` 已上传并add-only放行；Manifest `314c327a36702da7c281237fe2aaef34335a839c0a2d81adece0be0d695fe8c8`，tag/allocation/receipt一致。`.207`因Git远端查询失败及重试Manifest冲突未上传/放行，记录保留。
- 前后完整ECS verifier、独立allowlist verify通过，公网`.208/.206/.205=200`、`.207/未知=426`；应用release仍`539d88e3`，未部署API/Web、备份/迁移数据库、提审或正式发布。交付记录消息`docs(audit): record calendar left alignment trial 208`。唯一下一任务：同版本/SHA小米14复核左对齐和预览；匿名首页及紧凑预览已在开发者工具查看，真机状态保持待用户复核。

## 上一批次：日历共享容器倍率（体验版 `.206` 已上传放行，待小米14复核）

- 最终规则：首次读取逻辑屏宽，App全局缓存各容器的固定三字＋标识倍率；同一布局全部单元格使用同一个值。二字不额外放大，多字只省略；删除逐行测量组件、逐姓名缓存和测宽setData。首页/访客共用页面倍率，普通预览、紧凑弹窗、补录分别按实际留白计算；周标识仍固定下一行。保留上一批切换优化和分段等距圆角。
- 独占warm/REUSE_ONLY、未安装；回归先红后绿，真实生成JS两个独立副本只读屏宽1次，开发者工具从首页进入普通/紧凑预览共用App缓存。Mini完整1,287通过/18跳过，几何/类型/lint/任务格式/verify/确定性/包体/图标/core smoke/dry-run/血缘通过。全仓格式仍仅五个未改文件的既有失败。最终原始主包1,624,906 B/总包4,334,456 B。
- 应用检查点 `17598dc8`、独立血缘证明 `a7528cfb`、跨entry bundle共享缓存修正 `151c9753`（`fix(miniprogram): share calendar sizing across entry bundles`）均已推送。最终clean production体验版 `0.1.0-p10.20260927.206@151c9753` 上传成功，Manifest `78147232b0e8c688da67e682e32b5f2a0131bcb19211f6cfeb0215bb5454fd35`，ZIP2,370,600 B；tag/allocation/receipt/构建身份一致，前后候选安全检查通过。
- 已按用户授权add-only放行`.206`并保留`.205/.203`及既有版本，独立allowlist verify、完整ECS verifier、公网`.206/.205/.203=200`与未知版`426`通过。应用release前后均为`539d88e3`；未部署应用/同步release元数据、备份/迁移数据库，不提审、不正式发布。交付记录检查点消息 `docs(audit): record shared calendar scale trial 206 delivery`。
- 唯一下一任务：同版本/SHA小米14复核切换流畅度、三字＋标识对齐、长姓名省略和预览适配。匿名首页月/周和紧凑弹窗已在开发者工具查看；真实群组切换、有效访客链接和真机耗时仍待反馈。状态：已实现及自动化/模拟器验证，待用户真机复核。详见[轮次记录](audit/calendar-shared-scale-20260927.md)。

## 上一批次：日历切换反馈修复（体验版 `.204` 已上传，待单独放行与真机复核）

- 按用户追加要求固定“三字＋标识”基准；短姓名不额外放大，月格最高 1.18 倍，长姓名仅溢出兜底。按页面/布局缓存首次测量，窗口宽度变化重算；月/周反复切换不再测宽。标识上移 0.5px 校准视觉中心，分段控件外 12px/内 9px/间隔 3px。
- 减少 ViewModel 重复排序/分组，访客完整缓存切换不再重复请求；保持在途权限校验与原分页/手势/周高度。基线 `6de6b319`、独占 warm/REUSE_ONLY、未安装，保留包体精简。详见[轮次记录](audit/calendar-switch-feedback-20260927.md)。
- 验证：Mini 1,287 passed/20 skipped；几何代理 2/2，32 组模型与基线输出一致；根 lint/typecheck、任务文件格式、Mini verify/包体/确定性、图标、smoke:check-core、CI dry-run/血缘通过。全仓格式仍有五个未改文件的基线失败。主包 1,629,511 B/总包 4,338,977 B（各 +4,266 B）。
- 开发者工具匿名首页月/周/列表及测量计数：首次月 1 批、首次周累计 2 批，再回月/周仍为 2；没有真实排班数据测试。小米 14 体感及字体最终观感待同构建复核。
- 应用检查点 `0edc34ed`（`fix(miniprogram): cache calendar sizing and remove switch overhead`）已推送；clean production 体验版 `0.1.0-p10.20260927.204` 上传成功，Manifest `08f8d5b36e93ab16f2483ca6bfa387675701f7ddf9aef228aebdf5756a5f88ba`，ZIP 2,368,140 B，远端 tag/receipt/构建身份一致，前后候选安全检查通过。交付记录检查点消息 `docs(audit): record calendar performance trial 204`。
- 唯一下一任务：取得 `.204` 单独生产放行授权后执行 add-only allowlist，再进行同 SHA 小米 14 复核。当前停止生产动作；未部署/备份/迁移、不提审、不正式发布。

## 上一批次：日历姓名完整显示与分段动画（体验版 `.203` 已上传放行，待小米 14 复核）

- 月/列表姓名和标识同行等比适配；周历姓名单行、标识固定下一行，保留分组标题。首页、访客、手排生成/草稿/发布预览、补录普通/紧凑日历共用文本适配，分页/手势/高度及业务逻辑不变。月周列表底块滑动与字色过渡沿用通讯录时序。
- 基线为最新 `origin/main=539d88e3`，保留 `.202` 包体精简；独占 warm 槽位、REUSE_ONLY、未安装。引入点、行为清单和红绿证据见[轮次记录](audit/calendar-name-fit-20260927.md)。
- 验证：Mini 1,279 passed/20 skipped，四档宽度几何代理单独 2/2；根 lint/typecheck、任务文件格式、Mini verify/package/determinism/dry-run、icon parity、smoke:check-core 和血缘审计通过。全仓格式仍有五个未改文件的基线失败，未宣称根 verify 通过。原始总包 4,334,710 B、主包 1,625,244 B，较本轮基线各 +9,684 B。
- 开发者工具匿名样例已检查首页月/周/列表、访客月/周、补录、手排普通/紧凑月/周预览；嵌套精确几何、真实换群/有效访客链接、小米 14 尚未验证。模拟器截图不替代真机验收。
- 应用检查点 `f651024f`（`fix(miniprogram): fit full calendar names and animate view tabs`）及交付记录 `74c6facb` 已推送。production clean 体验版 `0.1.0-p10.20260927.203@f651024f` 上传成功，Manifest `cfd402a1f168ea92ad4f4ee0dcaa90c56cb464c247d9d2a34177a9af8b724abe`、ZIP 2,363,771 B，远端 tag/receipt/构建身份一致，候选安全检查前后通过。
- 用户随后授权“放行”：可信 `ensure` 仅追加 `.203` 并保留所有原允许版本，独立 allowlist verify、前后完整 ECS verifier、公网 `.203/.202=200` 和未知版 `=426` 通过；一次短暂健康探针 TLS EOF 经控制工具自动等待恢复。实时应用 release 前后均为 `539d88e3`，未部署应用、备份/迁移数据库或同步 release 元数据。放行记录消息 `docs(release): record calendar fit trial 203 allowlist`。唯一下一任务：同 SHA 小米 14 复核；不提审、不正式发布。

## 上一批次：小程序正式包精简（体验版 `.202` 已部署放行，待小米 14 验收）

- 用户范围：删六个无正式导航用途的独立/诊断路由和三套独立业务包装页；测试三页源码及单测留仓库，但构建和上传产物排除。工作台内业务组件及网络/通知/错误记录链路保留。原精简轮次未授权部署；用户随后明确授权部署和放行，未授权提审或正式发布。
- 实测：在独占 `runtime/wt/general-6` 复用依赖、未安装；相同 production 命令的原始包 4,819,158→4,326,081 B，减少 493,077 B；主包 1,835,334→1,616,037 B，减少 219,297 B；本地 ZIP 代理减少 119,398 B。超过 400,000/170,000 B 停止阈值。详情见[包体精简轮次记录](audit/mini-package-slim-20260926.md)。
- 验证：Mini 完整 1,273 通过/18 跳过、根测试 1,307 通过/452 跳过；Mini production verify、lint/build/typecheck、图标一致性、smoke:check-core、CI dry-run/血缘及上传内容拒绝门禁通过。全仓 `format:check` 因五个本轮未改文件的既有格式差异失败；本轮文件格式检查通过。开发者工具五标签状态和登录/访客/四个业务分包模板编译通过；访客无有效链接，运行时读取超时，真机未验证。
- 检查点 `e6ef714b`（精简）和 `5b12c724`（更新精确血缘证明）已推送 `origin/main`。首次上传在版本分配前被旧 blob 证明拦下；红绿测试和血缘审计确认仅诊断入口变化，第二次 Git tag 读取遇到瞬时网络错误，均未占用新版本。同一干净 production 候选随后动态分配并成功上传 `0.1.0-p10.20260926.202@5b12c724`；Manifest `bdb22991a43ecdf3d9c5f22064a8125a244564d6e4c2e9a688fb6ccddabe61f7`，上传 ZIP 2,360,179 B，远端 tag/本地 receipt/构建身份一致，330 个正式产物文件无测试工具和旧包装页。上传实际 ZIP 没有同工具链基线值，减量仅以上述本地同口径 ZIP 代理为准。
- 用户本轮明确授权“部署并放行”。实时生产前驱为 `833a11e4`，和候选 `8ab6663b` 的 21 项应用/控制/schema 哈希相同。加密备份 `e465caa7-6d6c-491d-b652-adc9d9bde087`（54 表、315,123 行、131,224,032 B，服务器文件 SHA-256 与记录一致）后，可信无停机复用发布到 `8ab6663b`，前后完整 verifier 通过；受信 `ensure` 只追加 `.202`，独立 allowlist verify 和完整 ECS verifier 通过，公网 `.202/.201=200`、动态未知版=426。允许版本操作中一次短暂 TLS EOF 已由健康等待恢复。交付记录检查点消息：`docs(release): record Mini package slim deployment and allowlist`；该文档检查点以相同产物哈希同步生产 release 元数据，另行备份。唯一下一任务：等待同构建小米 14 的登录、工作台五标签、访客和主要业务分包验收；缺真实证据不写通过。不提审、不正式发布。

## 上一批次：日历定位按钮位置统一（体验版 `.201` 已放行，待小米 14 复核）

- 用户范围：日历首页定位按钮在月视图与周视图不一致、周视图偏左，以月视图为准；首页、访客等所有定位按钮统一；只改这一件事，改完直接提交并放行。
- 根因与基线：月视图用共享组件 `.locate-button`（40×44，距卡片右外沿 71px，`1f715c96`），周/列表视图用页面内联 `.calendar-locator`（44×44 + `margin-left: 4px`，`ad4cfb2c`），准星偏左 2px。两次独立测量：`.198` 开发者工具截图月 443 / 周 440（chevron 一致）；真实 WXSS 390px 无头几何月 70.00px / 修复前周 72.00px。
- 修改：`apps/miniprogram/src/pages/workbench/index.wxss` 的 `.calendar-locator` 改为 `width: 40px` 并删除无布局作用的 `margin-left`；换期 chevron、标题、按压/hover、动效与定位逻辑未改。访客页经 `@import '../workbench/index.wxss'` 同批生效；列表视图仍按 Web 金标准保留最右槽位。
- 验证：新增“定位按钮盒一致”断言先失败后通过（该文件 27 passed）；Mini 全量 `183 passed | 2 skipped`（1282/18 跳过）；Mini production verify（总包 4,817,890 B、manifest `40f35b70e93f890d6adfd88d020ae67a9f03e778867962f0ce9ad766a679025a`）、`pnpm typecheck`、`pnpm lint`、`icon:parity:check`、`smoke:check-core` 通过。开发者工具（`.201` production 构建、真实排班、390px、WebView）：月/周准星 `left` 均为 299.6（卡片右沿 378.4），chevron 同为 339.6/30.8，列表 343.6。
- 交付：检查点 `287691ff` 已推送 `main`；体验版 `0.1.0-p10.20260926.201`（Manifest `72e7f32900c6f1550514d82300983bf5d39e24667748868f05783ccad9439060`、239 代码文件、ZIP 2,703,186 B）上传，tag/allocation/manifest/receipt 同一 SHA；add-only `schedule-client-version-allowlist ensure` 只追加 `.201` 并保留 `.200`，独立 verify、完整 `ecs-verify.sh`（live release 仍 `833a11e4`、schema 64）与公网 `.201/.200=200`、未知版本 `=426` 通过。
- 本轮是小程序 + 文档范围：未部署生产、未备份或迁移数据库、未提审、未正式发布、未退役旧版本。未验证：访客页模拟器实测（需有效访客链接）、模拟器截图接口本轮只返回 35×75、小米 14 同构建复核。细节见 [轮次记录](audit/calendar-locate-button-20260926.md)。
- 下一批次与停止条件：用户用小米 14 打开 `.201@287691ff`，复核首页/访客月、周、列表的定位按钮位置是否与月视图一致；取得同构建真机证据前保持“待用户复核”，不进其他功能开发。

## 上一批次：补录「移除已有班次」+ 预览精简 + 圆角统一（生产已部署，体验版 `.200` 已放行）

- 服务端（`20c024c6`）：批量补录请求新增可选 `removals: [{ assignmentId, businessDate, scheduleRoleId }]`，`items` 取消 `min(1)` 改为「items+removals 至少一项」；`backfillBatch` 在同一事务、同一幂等指纹、同一审计事件、同一统计刷新与工作流自愈内软删除班次（`deletedAt` + `version + 1`），老客户端不带 `removals` 时行为不变。真实 MySQL 集成 `13/13`。
- 客户端（本批）：点击已存在的「人员 + 班种」= 暂存**移除**，否则 = 暂存**新增**，两者都只在点「确认补录」时一次提交 `items + removals`；草稿键改为「岗位:日期:类型:目标」，同一天可同时挂多条改动；周/月视图统一用 `state: removed|added`（黑色删除线 / 暗红 `#a42620`），删除（原）（拟）徽标，并按班种 + 人员锚定；修掉「只看当天第一条」与「同一人 + 班种重复暂存」两个缺陷。
- 预览窗口：删除单元格点击详情（绑定、模板、样式、模型 `details`/`selectedDate` 与选中态），高度不再随详情变化。
- 圆角统一核验：首页/访客周视图（inline `.week-day-grid` 17px，`e5305bd0` 修复）、月视图与补录/手排预览周视图（`calendar-month`：卡片内圆角 17px = 格子 17px）。无头浏览器量测圆弧/直线覆盖率 0.996 / 1.045 / 1.073（均不偏细），开发者工具实拍月视图左下圆角与直线等宽。访客页 `@import` 首页样式、手排预览复用 `calendar-month`，无独立实现。
- 验证：Mini 全量 183 文件 / 1281 通过 / 18 跳过；presentation-core 备份模型 7/7；补录控制器 15/15；`pnpm typecheck`、`pnpm lint`、root `pnpm test` 通过；Mini production verify 通过（总包 4,817,910 B，manifest `1870568db54fec0788e3925e0dc4df12229a93267654ea0e4fa9555aa01db50a`）。开发者工具：首页月/周、补录页均正常加载，Console 无 error。
- 交付：检查点 `833a11e4` 已推送 `main`；ECS 制品打包后先创建生产加密备份 `7fd67e5c-3d9c-49a5-9b4a-643bc9620bc3`（54 表 / 311,250 行 / 129,955,640 B / SHA-256 `4fdf9bbaa4be6288551d46059d02aa66547d8794852f08eada76bf606954ac6a`），再完整部署到 release `833a11e462a2526df6f117b94b6afb77d19a9f4c`（回滚候选 `ad6c09fe`），`ecs-verify.sh` 完整通过。体验版 `0.1.0-p10.20260926.200`（Manifest `9a9dd18a11a5c3c064b5275c6abcb3b99c6f48c083e6ee3c7dbee1e3e84b7a09`、239 文件、ZIP 2,703,801 B）已上传，受信 add-only `ensure` 只追加该版本，独立 verify 与完整 verifier 通过；公网 `.200`/`.199`=200、动态未知版本=426。
- 未验证：小米 14 同构建真机（护士群多班种补录的移除交互、删除线/暗红渲染、三类预览周/月圆角）。下一批次：用户在小米 14 复核；若发现问题按最小改动修复。

## 当前批次：周视图网格圆角统一体验版 `.199` 已上传放行，待小米 14 复核

- 用户授权对“选中蓝色框圆弧偏细”做最小统一改动。结论与证据：直线与圆弧是同一支 `inset box-shadow: 0 0 0 2px`；开发者工具实测（`.198` production 构建、真实排班数据）圆弧外缘半径 16.96–17.21px 等于设计值 17，无遮挡；观感偏细源自抗锯齿（圆弧峰值不透明度 0.83–0.92，直线 0.94–1.00）。
- 唯一结构性不一致是首页 `.week-day-grid` 裁剪圆角 18px（`var(--ui-radius-large)`）对格子 17px；隔离 CSS 复现显示该 1px 差会削掉圆弧外层约 0.3px。最小改动：仅把网格圆角改为 17px（补录/预览共用组件已是 17/17，不动）。
- 验证：新增“网格圆角必须为 17px”断言先红后绿（该文件 5 passed/1 skipped）；Mini 全量 183 文件/1280 通过/18 跳过；`pnpm --filter @schedule/miniprogram verify` 通过（总包 4,817,612 B、manifest `4d4391501819a2a20c94da84b580695f9a78e07e6dca818fb3e52e6292ceafbb`）；`pnpm smoke:check-core` 通过。开发者工具复测：左下圆弧 2.131 → 2.259 CSS px、峰值 0.92 → 0.965；右下 1.876 → 1.997、0.826 → 0.887。
- 交付：用户授权“上传并放行”后，干净候选 `e5305bd0c68734a913f1da04c01f01aed490ba2b` 上传体验版 `0.1.0-p10.20260925.199`（Manifest `14b8aeb2bb4e0f038a29428f2498ef38a471bcf73493705e9f048aac332104df`、239 代码文件、ZIP 2,703,859 B），tag/allocation/manifest/receipt 同一 SHA；可信 `ensure` 只追加 `.199` 并保留旧版，独立 verify 与完整 ECS verifier 通过（一次 502 后恢复），线上 release 仍 `ad6c09fe`。公网 `.199=200`、`.198=200`、未知版 `=426`。未提审、未正式发布、未部署生产、未迁移数据库。
- 下一批次与停止条件：唯一下一任务是用小米 14 打开同构建 `.199@e5305bd0`，复核周视图左下/右下圆弧笔画观感；取得同构建真机证据前保持“待用户复核”，不进入其他功能开发。

## 上一批次：周视图回归修复体验版 `.198` 已上传放行，待小米 14 复核

- 回归引入点为 `e8286722`：首页周格被替换为独立 `calendar-week-panel`，并把首页高度公式从 `+20` 改为共享公式。当前修复将首页页面、视图模型和事件处理精确恢复到 `aef86299`；只在补录/预览周格保留共享组件并修正高度、底角圆弧和未来日期灰显。
- 测试先行：新增回归用例先在旧实现上失败（首页结构/高度/事件、补录灰显、预览圆角与高度）；修复后 Mini 全量 `1280 passed / 18 skipped`，根 `1306 passed / 451 skipped`，最终 `pnpm verify` 通过。Mini production verify 通过（4,817,496 B，manifest `a1deb7225864811c054ec55f06fde0b77c90816f4c9fe60d331b5a20c16003a8`），格式、lint、构建、类型、图标门禁和开发者工具 WXML/WXSS 编译通过。模拟器首页仍停在排班读取，真实排班视觉、连续手势及小米 14 未验证。
- 交付：干净 production 候选 `a3eccb490c6f3a31645a6ab8528eea43ff492ff6` 已推送；体验版 `0.1.0-p10.20260925.198` 上传成功（description `weekly calendar parity a3eccb4`、239 代码文件、ZIP 2,703,520 B、Manifest `a9064a4d781a76d7e4137e612f10d8048a569c019878259ed348ddea392d5014`），远端 tag、allocation、manifest 与 receipt 绑定同一 SHA；候选冻结在独占 `general-6`、REUSE_ONLY、未安装依赖，`check-worktree-safety` 前后 `RESULT=PASS/ready-clean-detached`、`VERSION_LOCAL=absent`。
- 放行：按受信物理路线执行 add-only `schedule-client-version-allowlist ensure`，只追加 `.198` 并保留旧版；独立 `verify` 与完整 `ecs-verify.sh` 退出 0，公网 `.198=200`、`.197=200`、动态未知版本 `=426`。线上 release 仍 `ad6c09fe`、schema 未变；本轮 Mini/文档范围不触发生产部署、数据库备份或迁移，未提审、未正式发布、未退役旧版本。
- 偏差与阻塞：首次上传在动态版本分配前被 `trial-lineage` 拒绝——策略 `5285dd1` required checkpoint 仍记录共用组件版首页 `index.ts` 指纹 `0d80dfc…`，而本轮按用户要求把首页恢复到 `aef86299` 后指纹为 `e0f48e5…`；该次无版本、tag、receipt 或平台副作用。只更新该 canonical proof 后门禁与 19 项定向测试通过，提交 `a3eccb49`。模拟器首页仍停在“正在读取排班”，真实排班视觉、连续手势与 320px 仅由自动化/几何代理覆盖。
- 下一批次与停止条件：唯一下一任务是用小米 14 打开同构建 `.198@a3eccb49`，复核首页周视图高度、底角圆弧、蓝色选中框是否完全复原，以及补录/预览周视图与首页是否 1:1 一致；取得同构建真机证据前保持“待用户复核”，不进入新功能开发。

## 上一批次：补录与预览修复 .196 已放行，待小米 14 复核

- 基线 `5befe6a3`；独占 warm `general-4`、REUSE_ONLY、未安装依赖。引入点 `8e68a480`（班种徽标首汉字）与 `672d52ef`（预览独立周格）；详情见 [轮次记录](audit/schedule-week-preview-20260925.md)。
- 共用徽标现按首页规则显示 N/NP/A/D/电脑；补录按群组默认周/月，列表映射月；手排生成、草稿、发布预览的周历复用已有日历分页/单元格，保留灰色已有排班、节假日、日期详情、滑动和定位。代码改动限 Mini；后续生产操作获用户单独授权。
- 定向 42/42，根 `pnpm verify` 1306 通过/451 跳过，Mini production verify 通过（总包 4,801,743 B、主包 1,826,112 B），开发者工具三处 WXML 编译通过。模拟器补录页未获得排班数据；真实滑动及小米 14 未验证。代码检查点 `aef86299` 已推送。
- 经授权上传 `0.1.0-p10.20260925.196@aef86299`；tag、receipt、构建身份及 Manifest `16a51495e92e8f2d60988432632602d0490bb8a5335bb54e559576e83e4e0beb` 一致。交付记录 `17c1c90f` 已推送；生产备份 `49c9cf91-8a30-45b5-ab83-d74f1bf0d80f` 的文件大小和 SHA 核对通过，全部应用/控制/schema 哈希相同时无停机复用发布 `17c1c90f`，前后完整 verifier 通过。`.196` 只追加放行，独立 allowlist 与完整 ECS verifier 通过；`.196/.195=200`、未知版=426。未迁移、提审或正式发布。唯一下一任务：用同构建小米 14 复核护士群补录及三类预览；取得证据前保持待用户复核。

## 上一批次：排班补录与预览修复已上传放行，待小米 14 复核

- 用户授权上传并放行排班补录与预览修复。先将 `4eceafac` 与最新体验版 `.194@a83be6a4` 合并，保留两边功能；上传需绑定合并后的干净 SHA，放行仅追加版本，不替换旧版。真机验收仍待小米 14 同构建证据。
- 三处文本冲突已按两边语义合并；定向 49/49、Mini production verify、完整 `pnpm verify`（根 1306/451 跳过）、格式/图标门禁通过。`pnpm smoke:browser` 因本地 5173 未启动返回连接拒绝，已记录且不计通过；`smoke:check-core` 通过。合并检查点 `d4f0cbe3` 已推送；体验版 `0.1.0-p10.20260925.195` 已从 clean production 候选上传，Manifest `3b593acff0edbdecb90ccea9dca51ec39a35e574600e66b20b6cc37150e579e6`、receipt、远端 tag 一致。
- 用户随后明确授权生产部署。实时回滚基线 `162ef4c1`；候选与线上产物、控制面、schema 哈希完全一致。部署前 verifier 首次在遥测隐私检查报错，汇总只读核对及完整复跑通过后继续。加密备份 `a521826a-24c6-42b7-a38d-319cfb09da67` 的服务器文件哈希与记录一致；可信复用发布将线上 release 无停机切至 `d4f0cbe3`，前后完整 verifier 通过。`.195` 通过 `ensure` 只增放行及独立 `verify`；再次完整 ECS verifier 通过，公网 `.195`=200、动态未知版=426。未执行数据库迁移、提审或正式发布。
- 本轮记录 checkpoint：`docs(release): record schedule preview trial 195 delivery`；文档例外不再次部署或上传。唯一下一任务：用户在小米 14 同构建 `.195@d4f0cbe3` 验证补录日历、选中样式和周/月预览；取得真机证据前保持“待用户复核”。

## 上一批次：按日期发布与成员绑定修复（生产与体验版已交付，待真机复核）

- `162ef4c1` 已推送并部署生产 schema 64；受控恢复后 2026-12 月历及导出各 31 天。备份、部署、数据核对与 API/MySQL 验证见 [完整交付记录](audit/date-granular-publish-binding-20260924.md)。
- 累积体验版 `.192@162ef4c1` 已上传并放行；版本/Manifest 与恢复交付细节见同一记录。可靠的小屏和小米 14 原生复核仍待用户提供同构建证据。

## 上一批次：手动排班预览对照与访客审计去重（生产与体验版已交付，待真机复核）

- 已实现：模板 DELETE 显式 `{}`；草稿按可见三月窗口叠加同岗位已有排班，已有嫩灰、本次彩色且不增加图例；compact 节假日标识专属缩小；访客用可选 `visitId` 按页面实例原子去重，旧客户端仍逐请求记录。无数据库迁移，不清理历史记录。
- RED→GREEN 与全门禁：contracts/client-core 22、Mini 定向 49；真实 MySQL 手排 34、Task10 107；`pnpm verify` 的 Mini 1254/16 skip、根 1302/445 skip、warm 工具 81 全绿。生产 Mini verify/source/package/determinism/dry-run 通过，总包 4,798,345 B、主包 1,821,922 B。
- 运行/浏览器验证：默认 5173 未启动首轮失败不计通过；当前源码 API 3105/Web 4175 的原 smoke 完整通过且临时服务已停。最终 `.191@c6c4fcd2` 在开发者工具能力与一次性预览请求均 200，页面进入预览态、无新增图例、已有排班灰显，Console 无 error/fail；彩色空草稿与 compact 节假日仍由自动化证明。当前证据不等于小米 14。
- checkpoint `c6c4fcd2` 已推送。加密备份 `2432fa5e-bb1e-4b09-ad3e-40da590350b7` 核验后部署生产 `c6c4fcd2`/schema 63，完整 verifier 通过；动态体验版 `.191`（Manifest `0b7a8161…8c46`）上传并只追加放行，`.191/.190=200`、未知版 426。未提审、不正式发布。
- 完整证据见 [交付记录](audit/manual-preview-visitor-followup-20260923.md)；发布记录 checkpoint 以 `docs(release): record manual preview and visitor trial delivery` 标识。唯一下一任务为小米 14 `.191@c6c4fcd2` 原生复核；取得同构建证据前保持“待用户复核”。

## 上一批次：手动排班一次性编辑、366 天应用与模板删除（生产已部署放行，待真机复核）

- 模板/岗位首行约 2:1，其余两行等宽；未保存编辑可直接预览并以同一不可变快照创建草稿。周期矩阵仍限 30 天/20 人/600 格，应用范围独立放宽至含首尾 366 天，保存模板保留自选日期。
- 已保存模板提供独立删除 action 和摘要确认；一次性草稿按业务月拆分，幂等指纹包含完整快照和日期，预览/草稿不隐式写模板。
- 自动化、真实 MySQL、生成器、typecheck、format/lint/build、包体/确定性、浏览器 smoke 与 390px 开发者工具验证通过；模拟器不等于小米 14 验收。
- `eacfd752` 已推送；`.190` 身份/Manifest/receipt 一致。备份 `18760517-efb4-45fa-9012-5b478e658db5` 后部署 `b17a4e57`/schema 63，并只追加放行 `.190`；完整记录见 [审计文档](audit/manual-schedule-inline-editor-20260923.md)。

## 上一批次：联系方式预热及账号联系方式/二维码/访客改造

- `.186` 修复点击/箭头，`.187@adccba36` 增加键盘避让，`.188@83eb80c3` 修复键盘关闭回底，`.189@531d7c39` 增加首次输入层预热；均已上传放行，首次号码延迟问题由当前批次继续处理，未把预热记为真机验收通过。
- 账号级手机号/短号、跨群同步、schema63回填、单环境成员/访客二维码和访客审计已交付；旧邀请/群码能力按此前明确授权退役。顶部导航保持原样。历史验证、破坏性迁移授权、备份、上传Manifest与生产结果见[原轮次记录](audit/profile-qr-visitor-audit-20260921.md)及Git历史。
- `.185@cbe19af5` 合并 `.184` 累计能力；后续 `.186`–`.189` 仅Mini修复，应用release当时为`cfa934d1`、schema63。以上均为历史记录，不作为当前线上状态或后续版本分配依据。

## 历史批次摘要

- 数据缓存与服务器性能审计、极致读缓存与增量同步（已过排班 + 节假日/补班）、Feedback26 导出筛选重置、Feedback25 `.129`、Feedback15 `.112`、Feedback14 `.111`、Feedback13 `.110`、护士照片 139 条导入、feedback11 `.108`、Feedback9 及更早：均已完成交付或放行，未决项统一为“小米 14 同构建复核”。
- 细节按主题检索：`docs/audit/`（轮次记录）、`docs/debug/debug-feedback-log.md`（运行与发布日志）、`git log`（历史检查点）。
