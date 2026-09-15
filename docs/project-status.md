# Project Status

## 当前批次：Skyline 3.17.2 页头与按压反馈修复已实现，正在交付体验版

- `.135@c7025b93`真机确认周切换已正常；3.17.2仍有群名省略、下拉菜单被日历文字覆盖、周格灰闪和月格蓝色反馈滞留，3.17.3正常。
- 根因是`.134`兼容宽度仍被父Flex百分比上限压回、旧Skyline滚动合成层高于页内菜单，以及3.17.2对既有hover透明度/70ms保留时间表现不同。菜单已收敛为所有版本共用的一份root-portal、一份选项模板和一个事件；仅3.17.2保留确定宽度、周格无灰色按压类和月格松手0ms参数。3.17.3的菜单几何/视觉、周格反馈和月格70ms不变。详情见`docs/audit/runtime-ui-compatibility-header-press-fix-20260915.md`。
- 累计RED 4失败，单菜单收敛RED 1失败；GREEN定向30项、Mini完整174文件1199项通过/16跳过。typecheck、production build366文件、source/package/determinism、format/lint/smoke:check-core通过。主包1736932B/总4604586B，较`.135`总包仅增319B（约0.007%），无新增依赖；Mini verify仍仅被既有未改手排节点1507>1506阻断。
- 用户已在当前消息授权上传与追加放行。实现检查点将以`refactor(miniprogram): share Skyline group menu portal`识别；冻结干净SHA后上传新体验版，可信放行只追加新版本并保留`.135/.134`等旧版，不部署生产应用或迁移数据库。最后等待3.17.2/3.17.3双实例原生复核。

## 当前批次：Skyline 周视图兼容体验版135已上传并放行，待双实例验收

- `.134@5c02393`同角色双实例证据确认：3.17.2 周选中框缺失、周切换跳周/反向回弹、群名省略及Toast左圆弧变竖条；同机3.17.3正常，且3.17.2月视图正常。根因不是账号、权限或排班数据。
- 所有版本的周视图统一复用月视图现有`calendar-period-pager`三槽环形状态机，保留周视图原260ms动画、提交锁和有界队列；蓝框、页头明确宽度和Toast实体圆角色条仍只匹配3.17.2。3.17.3+仅同步内部分页机制，视觉和动画时长不变；API、数据、权限、月/列表视图及依赖不变。详情见`docs/audit/runtime-ui-compatibility-week-fix-20260915.md`。
- RED 3失败；GREEN兼容/分页/工作台联合47项、Mini完整174文件1197项通过/16跳过。typecheck、production build366文件、source/package/determinism、format、lint、smoke:check-core通过。主包1736356B/总4604267B，较`.134`仅增3770B（约0.08%），无新增依赖。
- Mini verify仍仅被既有未改手排节点预算`1507>1506`阻断，本轮不修改手排或放宽测试。
- `0.1.0-p10.20260915.135`已用production/clean上传并绑定`c7025b93`，Manifest
  `1aec459f…45b3bf8`且tag/allocation/Manifest/receipt一致。L4可信ensure仅追加`.135`并保留
  `.134`等旧版；allowlist verifier、完整ECS verifier和公网`.135/.134=200`、动态未知`=426`
  通过。未提审、正式发布、部署新应用制品、备份或迁移数据库。详情见
  `docs/audit/runtime-ui-compatibility-week-trial-release-20260915.md`。
- 实现检查点为`47c294ba`与`c7025b93`；发布记录检查点以
  `docs(release): record Skyline week trial 135 delivery`识别。唯一下一任务：小米14的
  3.17.2/3.17.3实例分别复核恢复与零视觉回归。

## 当前批次：Skyline 3.17.2 专属 UI 兼容体验版134已上传并放行，待双实例验收

- 同一体验版`.133@2d7f685`在同一小米14的两微信实例完成对照：基础库3.17.2的受控Grid退化（顶部差8px）且CSS圆环成尖角；3.17.3 Grid顶部差0px且圆环正常。CSS变量及显式scroll-view均正常，根因确定为实例基础库/Skyline运行时差异，不是第三方组件库。
- 仅`SDKVersion === 3.17.2`启用局部Flex和SVG加载圈后备；3.17.3、后续/未知版本继续走原Grid与CSS圆环。覆盖工作台/访客、通讯录、平台账号、排班配置、统计及工作流；诊断探针保留。无依赖、API、数据、权限或业务逻辑变化。详情见`docs/audit/runtime-ui-compatibility-fix-20260914.md`。
- RED先后为3失败及扩展后1失败；GREEN兼容6、工作流65、相关联合46项通过。Mini完整174文件1193项通过/16跳过；typecheck、production build366文件、包体、determinism、format、lint、smoke:check-core通过。主包1732843B/总4600497B，较`.133`总包仅增8869B（约0.19%），无新增依赖。
- Mini verify仍仅被既有未改手排节点预算`1507>1506`阻断，本轮不修改手排或放宽测试。首次正式上传在调用微信平台前因工作台TS blob变化使`5285dd1`等价血缘证明失效而安全停止，未占用版本；确认兼容改动未触及受保护方法后，以`5c023931`更新精确blob证明并复跑血缘及上传专项门禁。
- `0.1.0-p10.20260914.134`已用production/clean上传，绑定`5c023931`，Manifest `1669cf39…60bf55`，tag/allocation/Manifest/receipt一致。可信ensure仅追加`.134`并保留旧版；allowlist verifier、完整ECS verifier及公网`.134/.133=200`、动态未知`=426`通过。服务器应用release仍`44034fcc`，未部署应用、备份/迁移数据库、提审或正式发布。详情见`docs/audit/runtime-ui-compatibility-trial-release-20260914.md`。
- 发布记录检查点以`docs(release): record Skyline compatibility trial 134 delivery`识别；文档格式与`git diff --check`通过。
- 唯一下一任务：同一小米14的3.17.2与3.17.3微信实例均确认`.134@5c02393`，分别复核异常实例恢复及正常实例视觉不变；自动化不代替原生验收。

## 当前批次：小程序 Skyline 运行时诊断体验版133已交付

- 用户选择先发布诊断增强版，不先修改业务UI。故障基线为体验版`0.1.0-p10.20260914.132@44034fcc`；异常实例尚无基础库报告，不把环境推断写成最终根因。
- 诊断页已改为固定首屏加显式纵向scroll-view；增加Grid、跨组件CSS变量、滚动尺寸自动探针，CSS/SVG图形对照和首屏复制。登录、工作台、成员日历、API、权限及数据均未修改。详情见`docs/audit/runtime-ui-diagnostics-20260914.md`。
- RED 17项中1失败；合并后诊断/导出联合69、Mini完整173文件1187项通过/16跳过。Mini/Web TypeScript、production build363文件、Storybook build及390/320/大字号辅助复核通过；包体主1728648B/总4591628B、确定性Manifest`fb649413…5f2f7`，320无横溢，按钮44px。lint与smoke:check-core通过；独占general-2复用依赖，无安装。
- Mini verify在诊断源码/构建/包体后仍仅被既有未改手排节点预算`1507>1506`阻断，本轮不修改手排或放宽测试；独立typecheck、build、package和determinism均通过。检查点以`feat(miniprogram): add first-screen runtime diagnostics`识别。
- 诊断检查点`c694345c`已推送，并按发布血缘要求合并最新`origin/main@4179f05a`形成累计提交`2d7f685a`。`0.1.0-p10.20260914.133`已用production/clean上传成功，Manifest`eb302276…16b90b0`，远端不可变tag、allocation、Manifest和receipt一致；详情见`docs/audit/runtime-ui-diagnostics-trial-release-20260914.md`。
- 用户单独授权后，可信ensure已只追加`.133`并保留旧版；allowlist verify和完整`ecs-verify.sh`通过，独立公网`.133/.132=200`、动态未知`=426`。API重建健康窗口内三次短暂502后自行恢复；live前后均为`44034fcc`，未部署代码、迁移或修改数据库。未提审或正式发布。
- 唯一下一任务：正常与异常微信实例都确认`.133/2d7f685`，在“更多 → 测试工具”返回首屏截图、复制首屏诊断和滚动结果；两份同版本证据齐全前不判断最终根因、不修改业务UI。

## 当前批次：Feedback26 手动排班刷新与最长一年范围已实现

- 手动排班四阶段点击现均重新读取对应数据；草稿发布成功后进入发布记录页，避免继续显示旧草稿。
- 编辑表单改为模板+岗位、开始+结束、周期+人员三行；结束日期用于真实预览/草稿范围。应用范围最长366天，模板周期仍为30天、20人和600格，服务端按月份拆分草稿。详情见`docs/audit/feedback26-manual-schedule-refresh.md`。
- 共享契约/领域27项与Mini定向21项通过，Contracts/Domain/API/Mini TypeScript通过；API月度草稿集成命令因warm槽缺少`.env`未启动测试数据库，不能记为通过。独占general-5，REUSE_ONLY且未安装依赖。微信开发者工具未调用，小米14原生待后续同SHA体验版复核。
- 运行/浏览器验证：`pnpm smoke:browser` 已执行，warm槽未启动localhost:5173，结果`ERR_CONNECTION_REFUSED`，不记为浏览器通过；API与Mini production构建通过，后续`smoke:check-core`复核通过。
- 当前消息未授权体验版上传、生产部署或数据库操作。唯一下一任务：完成检查点并由用户决定是否另行授权上传体验版。

## 当前批次：头颈 DOCX 发布基础版导出与历史换班补记

- 修复漏日/错列：一值先上后下、先左后右，首尾留空，中途缺位为`-`；历史ID归一，二/三值及Word视觉不变。
- Word只读planned基础人员，忽略换班/加扣班actual；历史换班补记不改排班、不通知。全量verify通过，待部署、补记及新体验版。详见`docs/audit/head-neck-docx-export.md`。

## 当前批次：Feedback26 导出筛选切换重置文件状态

- 基线`4d75ab20`；独占general-1，REUSE_ONLY且无安装。设计与证据见`docs/superpowers/specs/2026-09-14-feedback26-export-selection-reset-design.md`和`docs/audit/feedback26-export-selection-reset.md`。
- 根因是导出周期/类型只更新选择摘要，岗位/人员多选直接写data，均未使已生成任务和临时文件失效。现在七类实际参数变化统一清理旧任务并回到“选择内容后创建任务”；相同值点击不重置。
- 回归RED为7失败/29通过，GREEN控制器36通过；导出下载/直接Page/thin-page联合43通过。Mini production verify通过，包体4579789字节、Worklet2/2、Manifest`30a26638…9cb9b`；保留既有内部预警。
- 检查点`4179f05a fix(miniprogram): reset generated export after selection changes`已进入累计体验版候选。未操作微信开发者工具、未上传体验版、未部署生产；原生效果待同SHA体验版复核。

## 当前批次：Feedback25 已部署并放行体验版129，待小米14复核

- 小米14 `.127` 证据确认：访客五行月历因 viewport 62px/行而 panel 仍54px/行产生底部留白；访客列表模板漏掉成员列表已有的班种状态。需继续核对医生/护士月周列表结构与交互，成员日历页面禁止修改。
- 访客二维码当前只有5分钟进程缓存，冷路径串行生成正式/体验两码并在客户端二次绘制；用户确认二维码永久保存，只有手动“刷新访客码”才更换 visitorKey 并废除旧码。设计采用独立持久资源表、双码并行、同请求合并和分段脱敏耗时证据。
- 设计与计划见`docs/superpowers/specs/2026-09-13-feedback25-guest-calendar-qr-performance-design.md`及对应plan。访客month panel已补齐62px rowHeight，列表主体结构与成员一致；成员日历文件零修改。schema61永久保存正式/体验访客二维码，冷生成并行且合并重复请求，刷新事务内废除旧资源，界面统一“刷新访客码”。
- RED旧代码Mini 4/5失败且0061缺失；Feedback25/guest/导出/布局55项、schema兼容与备份表计数32项通过。完整门禁根1266项通过/443跳过、Mini1175项通过/16跳过；Windows release-cache rename曾一次`EPERM`，独立复跑4/4通过。Mini production verify主包1728134、总包4580599字节、Worklet2/2及确定性通过，`smoke:check-core`无需Web冒烟。MySQL持久化集成已加入但warm槽无测试库而14项跳过。独占general-1，REUSE_ONLY且未安装依赖；成员日历零修改和逐行diff通过。
- 应用检查点`21fe6591`及验证器检查点`590aebb4`已推送；schema61/API与最终可信控制面已部署。首次备份`ef3a25ea-0180-462b-819c-fa75ad5081f4`为54表/256555行，最终部署前备份`9a29cb36-fe58-44c3-a933-6114e6a6c16b`为55表/256584行/108379344字节，SHA-256 `2981b347…05d558`。完整生产verifier通过。
- `0.1.0-p10.20260914.129`以production/clean绑定`590aebb4`上传成功，Manifest `21075b8e…fdb360`；可信ensure仅追加129并保留全部旧版本。allowlist verifier、完整ecs verifier及公网探针通过：129/128=200，动态未知=426。未提审、未正式发布、未退役旧版本。唯一下一任务：小米14打开129复核医生/护士访客月周列表、首次/再次读取二维码及“刷新访客码”速度。

## 当前批次：Feedback24 与头颈 DOCX 已部署并放行128，待小米14复核

- 小米14体验版126确认：导出成员选择器弹层被表单卡片裁剪，文件类型仍为原生picker；护士匿名访客缺少成员护士预设/群组月历班种偏好，周/列表swiper归中使用260ms造成反向跳动，启动时先渲染持久缓存造成旧班种闪现。
- 修复限定在导出宿主、匿名访客和独立安全显示设置端点：文件类型复用`ui-selector`，卡片允许弹层显示；旧访客日历响应不加字段。访客从群组设置读取默认视图（当前护士周/医生月）和月历班种，接入护士排序/状态/折叠、62px月格、compact详情和0ms归中提交锁/队列，持久缓存只作网络失败兜底。成员日历页面未修改。
- Feedback24修复限定在导出宿主、匿名访客和独立安全显示设置端点：文件类型复用`ui-selector`，卡片允许弹层显示；访客读取群组默认视图/月历班种并接入护士排序、状态、折叠、62px月格和0ms归中提交锁。成员日历页面未修改。详情`docs/audit/feedback24.md`。
- 同时保留生产刚部署的头颈外科医生群 DOCX/schema60 功能：目标群排班为Word/CSV，统计及其他群为Excel/CSV，固定姓名配置与生产Compose透传不回退。详情`docs/audit/head-neck-docx-export.md`。
- 两条分支共同基于`40723a1d`；检测到真实并发发布后未抢锁，合并生产`ececc967`并形成累计检查点`463f4512`。锁空闲后重新备份`f2ade922-8942-44fd-8cf9-5351489ee66d`（54表、256201行、108185080字节、SHA-256 `aaa2095a…584f5`），schema60/API部署及完整verifier通过。
- 完整`pnpm verify`通过（Mini1169/16跳过、根1262/442跳过、依赖保护81）；Mini production verify主包1727549、总包4579238字节、Worklet2/2及确定性通过。浏览器冒烟因localhost:5173未启动而`ERR_CONNECTION_REFUSED`，`smoke:check-core`通过。
- `0.1.0-p10.20260913.127`绑定`463f4512`以production/clean上传成功，Manifest `f570cb98…c9812`；可信ensure仅追加127并保留全部旧版本。allowlist verifier、完整ecs verifier及公网探针通过：127/126=200，动态未知=426。未提审、未正式发布、未退役旧版本；唯一下一任务为小米14复核访客三视图与导出选择器/DOCX入口。
- 用户确认127已被占用并精确授权改用128。同一累计应用以主线发布记录提交`0e7fc6c7`、production/clean上传`0.1.0-p10.20260913.128`，Manifest `71109555…8297`，receipt与远端轻量tag均绑定同一SHA。可信ensure只追加128；完整ecs verifier及公网探针通过：128/127/126=200，动态未知=426。未提审、未正式发布、未退役旧版本；唯一下一任务仍为小米14打开128复核。

## 当前批次：Feedback23 已部署并放行126，待小米14复核

- 已确认导出选择器溢出来自导出页缺少本地字段内边距容器；共享`ui-selector`无须修改。访客与成员使用同一ViewModel且访客WXSS已导入成员样式，成员在e94a54ca后使用`shiftGroups/tint`，访客模板仍循环旧`duties`，属于展示模板同步遗漏。
- 用户确认访客开放电话和事件，但完整手机号继续受当前群组有效同意门槛。绑定二维码允许群主/群管理员为本群待绑定成员生成，平台管理员也可生成；生成前必须检查未绑定，图片显示群组名/群组码/姓名/工号/有效期，scene只含一次性随机票据。
- 用户授权以视觉/交互匹配、减少重复、包体和加载为目标；实时追随未来成员日历更新不是验收项。当前访客已接入`shiftGroups/tint`、公共详情折叠/班种自动折叠和成员同口径周高，成员日历文件尚未修改；导出选择器已加本地边界容器。Mini typecheck及定向48项通过，QR定向19项通过；API绑定集成因本机未配置测试MySQL而7项明确跳过，不能记为通过。
- 一次性成员绑定二维码API/schema59/client-core和Mini信息卡已实现；幂等记录不保存Base64图片，平台/群组管理员来源分别审计。最终`pnpm verify`通过（Mini1164/16跳过、根1257/440跳过）；Mini production verify主包1720876、总包4570156字节、Worklet2/2、确定性通过。运行/浏览器验证：`pnpm smoke:browser`已执行，warm槽未启动localhost:5173，结果`ERR_CONNECTION_REFUSED`，不记浏览器通过；`pnpm smoke:check-core`通过。MySQL集成因本机测试库未配置而跳过。
- 应用检查点87475d51已推送并部署，schema59；备份cc678008-9368-4332-a7f7-0e7bc070fe19（54表、108086228字节、SHA-256 4e14781b…d8e0）完成，完整ecs-verify通过。125因预构建时间戳冲突在微信上传前失败，永久保留占用且未放行；126/87475d51 production-clean上传成功，359文件Manifest 66e8d858…18b32c，receipt/tag一致。
- 可信ensure仅追加126并保留旧版本；allowlist verifier、完整ecs-verify与公网探针通过：126/124=200，125/动态未知=426。未提审、未正式发布、未退役旧版本。唯一下一任务：小米14打开126，复核访客三视图/电话/事件、成员绑定二维码扫码确认及导出选择器边界；自动化和生产验证不代替原生验收。证据见`docs/audit/feedback23.md`。

## 当前批次：Feedback22 已部署并放行124，待小米14复核

- 独占general-5，基线ea0db36c；依赖采用锁内已有`archiver@5.3.1`生成标准OOXML Excel，稳定store维护下载0。访客码故障根因为client-core严格生成schema遗漏`trialImageBase64`，已修复并回归。
- 导出页移除Feedback14遗留的生产诊断链，表单立即呈现、筛选后台读取；右上角改为Excel/CSV二选一。岗位/成员复用手动排班`ui-selector`多选，“全部”与具体项互斥。
- API与schema58支持xlsx及岗位/成员数组并兼容旧CSV/单选请求。测试库迁移28项、导出集成6项通过；完整`pnpm verify`通过（Mini1161/16跳过，根1338/440跳过）。Mini production verify主包1714300、总包4555475字节，Worklet2/2，确定性及包体通过。
- 运行/浏览器验证：`pnpm smoke:browser`已执行，warm槽未启动localhost:5173，结果`ERR_CONNECTION_REFUSED`，无浏览器运行证据；静态/Node/MySQL自动化不代替小米14验收。详情见docs/audit/feedback22-export-xlsx.md。
- 检查点4cdfdbbd和f0c46078已推送main。生产即时回滚候选ea0db36c；加密备份cb765202-9d82-4199-aa62-d83b44e6bf2c（54表、107939924字节、SHA-256 0d8c20f1…6153c3）完成后，f0c46078部署及schema58迁移成功，完整ecs-verify通过。
- 体验版`0.1.0-p10.20260913.124`绑定f0c46078上传成功，Manifest `e28a01c5…2d3a`、receipt/远端tag一致。可信ensure仅追加124并保留旧版；allowlist与ecs verifier通过，公网124/123=200、动态未知=426。未提审、未正式发布、未退役旧版。
- 唯一下一任务：小米14重开124，复核正式/体验访客二维码读取和带群名保存、导出页首屏、自绘岗位/成员多选，以及Excel/CSV生成和发送。自动化与生产验证完成，原生验收仍待用户。

## 当前批次：Feedback21 已部署并放行123，待小米14复核

- 基线2d63e5a3，独占general-5，REUSE_ONLY且未安装依赖。访客公开排班改为7天持久缓存和后台刷新，完整手机号、访客密钥及Guest token不落盘；切后台/卸载不再全量清除，明确失效仅清对应群组。
- 正式版/体验版二维码分环境生成与缓存，客户端合成为二维码加群名的PNG供长按保存；服务端开关可关闭体验版生成。导出CSV增加UTF-8 BOM，创建后立即处理，分钟任务保留兜底；Mini自动下载后仅显示发送文件/取消，失败时显示重新获取文件，并删除导出页冗余说明区。
- 附件证据：9月CSV 2562字节/30行，无BOM；9月8—9日源快照为全天班/全，其余28行为全天班/全天。换班只变实际成员，导出未截断字段。详见docs/audit/feedback21-visitor-export.md。
- 最终`pnpm verify`通过：Mini 1160通过/16跳过、根1255通过/439跳过，格式、lint、构建、typecheck和icon parity通过；另有Mini定向53项、契约/API定向23项。Mini production verify主包1713723、总包4554857字节。首次Web构建完成后遇Windows libuv退出断言，单独及最终全量Web build均通过。运行/浏览器验证：`pnpm smoke:browser`登录页通过后因warm槽无`.env`、本地API未启动而停在管理员登录；未复制凭据，结果已记录。
- 应用检查点9e603fdb及文档检查点be6ff2ac已推送；0.1.0-p10.20260913.123上传成功，production/clean，Manifest 03986dd5…f5495c，receipt/tag同一应用SHA。
- 用户随后授权生产部署与放行。两个DoH、直连TLS、既有公网IP ED25519严格SSH认证后，正式域名host key安全协调且有ignored备份。备份b0bbc0cc-bcf2-4c29-96c5-4eff80274bd1成功（54表、107823088字节、SHA-256 90b69342…db7f1）。
- be6ff2ac已部署，实时回滚候选83d8a03b；预热3次502后恢复，更新器及完整ecs-verify通过。可信ensure仅追加123并保留旧版；allowlist verifier、再次ecs-verify和公网123/122=200、动态未知=426通过。
- 唯一下一任务：小米14打开体验版123，复核访客缓存/返回登录、正式与体验二维码带群名长按保存，以及医生群CSV速度、自动发送和Microsoft Excel中文显示。未提审或正式发布。

## 当前批次：Feedback20 已上传并放行122，待小米14复核

- 原始访客/二维码检查点325f82ea与累计合并检查点66b18b26均已推送；后者包含体验版121的导出真实上传转换修复、二维码点击预览/轮换自动刷新，以及本轮删除相册按钮/API、访客月窗和返回登录。详情docs/audit/feedback20-visitor-export.md及feedback20-trial-release.md。
- 完整verify通过：Mini1159/16跳过、根1254/439跳过、依赖保护81；Mini verify/Worklet2/2/确定性/包体/smoke:check-core通过，主包1709746/总4549449字节。
- 0.1.0-p10.20260913.122/66b18b26 production/clean上传成功，Manifest fd736127…bece5，build-profile/receipt/远端tag一致。可信ensure仅追加122并保留121；allowlist verify、完整ecs-verify、DoH/TLS/strict SSH和公网122/121=200、动态未知=426通过。服务器应用release仍83d8a03b，未部署代码、备份/迁移数据库或退役旧版。
- 微信公众平台浏览器执行面不可用，无法代配置downloadFile合法域名。唯一下一任务：管理员在公众平台加入`https://hosp.schedule.eylinhome.top`为downloadFile合法域名，然后用户在小米14重开122/66b18b2复核CSV下载、访客三控件/切换、二维码点击预览与长按。未提审或正式发布。

## 当前批次：Feedback19 导出页真实上传转换故障已修复，待体验版交付

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

## 上一批次：Feedback15 已部署并放行112，待小米14复核

- 用户批准八项计划；基线a8695f2a，独占general-4依赖复用、无安装。详情docs/audit/feedback15.md。
- 当前周独立测量/点选局部更新、before折叠、岗位改名接口与弹窗、月历顺延/62px、三视图补班、单按钮两步授权及日期文字盒居中已实现。
- pnpm verify通过：Mini1184/16跳过、根1252/439跳过、依赖保护81；MySQL模式集成套件46项通过。收口额外通知保存失败回归RED1→联合35通过，最终Mini verify/Worklet2/2/包体通过（主包1708859/总4550421字节）。
- 390/320真实WXML/生产CSS几何及运行/浏览器验证：pnpm smoke:browser通过；smoke:check-core通过。本地synthetic管理员标记已回读恢复、3105/4175服务已停止；小米14原生待同版本复核。
- 83d8a03b已推送；112/83d8a03已上传成功，357文件冻结包/receipt/远端tag一致，主包1709858/总4552499。上传专项30项及候选前后检查通过，见docs/audit/feedback15-trial-release.md。
- 用户随后授权生产操作：备份d89f173b-8b76-463c-b560-3e0726ff3d5d成功（54表、106182176字节）；服务端83d8a03b部署完成，schema57，独立ecs-verify通过。生产健康探测首段短暂502后恢复，未改变业务数据。
- 可信ensure仅追加112并保留111；allowlist verifier、再次ecs-verify及公网策略探针通过：112/111=200，动态未知=426。未执行replace、版本退役或真实通知。
- 唯一下一任务：小米14重开体验版112/83d8a03b，复核八项交互和视觉。自动化与生产验证完成，原生待用户复核；不重复上传、放行或部署。文档检查点docs(release): record feedback15 trial 112 delivery。

## 上一批次：Feedback14 已交付111，导出白屏待同版本报告

- 本轮限定两项反馈；实现与引入点见docs/audit/feedback14.md。基线e163fde8，独占general-4/5依赖复用、无安装。
- 更多页位移来自7923262d的onHide删除底部诊断区域、返回再插入。现在普通遮盖保留已授权区域，权限撤销仍即时生效，后台不能新授权或跳转；没有WXML/WXSS或无关UI修改。
- 新位移回归先失败后通过；workbench31、联合真实导出及诊断69项通过。390×844/320生产样式浏览器复现旧内容缩短107px、修复布局保持不变，原生效果待同版本验收。
- 导出已对照102/106及9bae5beb、执行110真实冻结JS与真实Page测试，未证实原生白屏根因。新增可复制的固定首屏阶段与root/header/scroll分类诊断；不改CSV操作语义，不宣称白屏已修复。
- 检查点fix(miniprogram): stabilize More navigation and expose export render stages；完整pnpm verify通过：Mini1179/15跳过、根1251/436跳过、依赖保护81；最终Mini verify、Worklet2/2及包体通过。用户随后批准上传并追加放行，已交付111/6b8a9e9，保留110；完整生产verifier/allowlist及公网111/110=200、未知426通过。服务器仍e163fde8，无新应用部署。
- 唯一下一任务：小米14重开111/6b8a9e9，复核更多位移，进入导出停留5秒返回，再到测试工具刷新并复制完整诊断报告。交付见docs/audit/feedback14-trial-release.md；不重复上传、放行或部署，白屏仍待定位。二维码及自动收信待用户原生复核状态保留。

## 上一批次：Feedback13 已部署并上传110，待用户真机复核

- 应用8f441d2d已推送部署，累计体验版0.1.0-p10.20260912.110上传成功并仅追加放行，109继续可用。四项日历修复和五类通知独立授权入口均包含；交付证据见docs/audit/feedback13-release.md。
- 加密备份0e13bb85-dabe-40b4-ae94-a7beb6fafefc（54表、106020632字节）实际hash核验一致；schema57，无新增迁移。完整生产verifier/allowlist通过，公网110/109=200、未知426。
- 五模板配置、四业务模板实际字段和外部消息能力复核通过。未主动发送真实消息、不重放历史通知。上传30项、356文件Manifest/receipt/远端tag一致，主包1704137/总包4535157字节。
- 实现验证沿用完整pnpm verify：Mini1170/15跳过、根1251/436跳过、依赖保护81；额外跨月高度2项、MySQL calendar36及390/320生产CSS/ViewModel几何和本地浏览器通过。均非小米14验收。
- general-4/5独占复用，无依赖安装。文档检查点docs(release): record feedback13 delivery，在本次部署授权内以可信哈希复用流程同步文档release身份，应用及体验包仍绑定8f441d2d。
- 唯一下一任务/停止条件：小米14重开110/8f441d2，复核四项日历交互及五个通知授权按钮、自然自动收信；二维码相册保存、导出白屏和发送文件仍待当前版本真机证据，不提前标记完成。不重复上传、放行、模板配置或护士导入。

## 上一批次：护士照片139条已录入，待用户查看

- 用户明确批准多人补录及静默导入修复、代码修改和生产部署，最终继续139条已确认数据导入。只匹配已有成员/班次，D5电脑，指定跳过项不写；资料留ignored runtime。
- 基线fe505ee9，独占general-4依赖复用，无安装。新增可选成员匹配补录和静默手排，旧行为/旧请求幂等指纹保持，无数据库迁移或小程序上传。详情docs/audit/nurse-schedule-import.md。
- 旧版两项MySQL回归失败；修复后32个不同MySQL用例、契约/路由10项通过。pnpm verify通过：Mini1122/15跳过、根1241/424跳过、依赖保护81；浏览器完整冒烟及smoke:check-core通过。代码及运行验证已完成。
- 生产备份542b8bcb-9796-4cb2-92b0-25d740229594（54表、105228472字节）已核验文件hash；数据尚未录入。
- c4a9b67f及补充修复a90e3b0a均已推送部署，最终live=a90e3b0a2b1db4eb252eb73e3940964bbf83813d、schema57；完整生产verifier通过。计划人员回退查找回归RED为3条而非2条，修复后MySQL12项复测通过，API build/lint/格式与smoke:check-core通过。
- 最终部署前备份f2cca68a-7547-4b16-8d0a-841019f55cce（54表、105250592字节）文件hash与登记一致；即时回滚候选c4a9b67f。两次打包均85包复用、downloaded0，无依赖安装。
- 2026-09-12北京时间08:08事务提交139条：历史54、当前/未来85；独立回读139一致、重复0；原有287条有效排班不变，其中9月1—6日59条保留。成员、岗位、班次配置不变，通知/投递新增0，无小程序上传或新增迁移。
- 原照片1处NP到次日11:00、A次日08:00的3小时重叠按确认原样保留，不自行改班。报告与个人明细仅存ignored runtime/audit/nurse-import-20260911。
- 文档收口：docs(ops): record verified nurse schedule import；仅记录已交付应用与数据，不重复部署或导入。唯一下一任务：用户刷新护士群日历查看9月7—20日；自动交付已完成，真机显示待用户复核。

## 上一批次：feedback11 体验版108已上传放行，导出空白待定位

- 用户批准三项故障修复计划；基线72ea0ab0，独占general-4复用依赖，无安装。二维码PNG/JPEG格式与通知空JSON正文缺陷已复现修复；导出真实Page/模板检查通过但原生空白未复现，未猜测修改。
- RED 4失败/38通过；完整格式/lint/build/typecheck、Mini1122/15跳过、根1240/421跳过及依赖保护81通过；最终Mini verify、Worklet2/2、包体/确定性和smoke:check-core通过。主包1679971/总包4502798，保留已有内部警告。详情见docs/audit/feedback11.md。
- 用户明确授权上传并放行；c563afff已交付`0.1.0-p10.20260912.108`，production/clean，354文件Manifest/receipt/远端不可变tag一致。上传专项30项及候选前后检查通过，主包1681039/总包4505008。详情见docs/audit/feedback11-trial-release.md。
- 可信ensure只追加108并保留旧版；完整生产verifier与版本策略验证通过，公网108/107=200、未知版本426。即时服务器仍b618d938，本轮没有新应用部署、备份、迁移或真实通知；网络及107残留操作锁已验证处理，版本预约记录全部保留。
- 文档检查点：`docs(release): record feedback11 trial 108 delivery`。唯一下一任务：小米14重开108/c563aff复核二维码和通知，并取得导出空白安全诊断继续定位。不得写三项全部完成，不重复上传/放行或部署。

## 上一批次：feedback10/VIS-02 服务端与体验版107已交付

- 用户已授权上传、追加放行及必要部署。累计应用0565f023包含feedback10四项修复和VIS-02访客日历，发布校验修复b618d938已提交推送并部署，实际live为b618d93861d05ae0c597fa8dfe40ed478902be5c、schema57。完整生产verifier和既有版本策略验证通过；详情见docs/audit/feedback10-release.md。
- 部署期间发现0057新增访客关联表后旧校验器不接受54表新备份。仅新增schema57迁移前53/迁移后54表分支；旧代码23通过/2失败，修复后发布/回滚35项通过，项目lint、格式、smoke:check-core通过。未改变业务数据或新增迁移。
- 最终部署前备份e011c56b-699e-422d-9b30-24b2282279f4，实际104354272字节、54表，SHA-256 6fcb93a4d09413a789abbd198eaaea4c0240ed82047968d03dae7b95abbadeb2与登记一致。应用与控制产物hash验证通过；回滚候选来自本次即时live 0565f023。
- .103/.104分别保留失败记录；直连IPv4出口120.230.6.0加入微信CI白名单后，.106=0.1.0-p10.20260911.106以63877b5e、production/clean、354文件Manifest c4bf033e252a94927000c6489fabb9f33f679c608c2abb6104606c5f3cc44ceb上传成功，receipt与不可变远端tag一致。
- 独立HTTPS核验：.102仍200，.103/.104均426；不修改微信平台配置、不关闭IP白名单、不改系统网络。浏览器库存读取失败，无法核对公众平台配置。已归档冻结包/错误/备份/发布证据到ignored runtime/audit/feedback10-delivery-final-20260911及feedback10-delivery-initial-20260911；确认上传进程退出后清理本任务孤立操作锁，不改预约记录。
- 应用验证复用feedback10.md和visitor-calendar-parity.md：合并MySQL45、Mini联合146、共享/API33及访客浏览器通过，Mini/Worklet和专项上传30项通过；不把自动化算作原生验收。CSV真实发送、相册扫码、瞬时通知、新消息点入及访客显示均待小米14。
- 独占general-4全程复用依赖；官方ECS flat导出复用85包、downloaded0，最终重打包命中flat缓存。无workspace依赖安装、无本地数据库上传、无真实通知、无正式发布、无新增放行或旧版退役。
- 独立HTTPS核验：.106/.102=200，.105/.104/.100/未知版本=426；可信ensure仅追加.106，保留旧版。上传和放行已完成，后续只待小米14原生复核，不重复部署或上传。
- 106 已占用后，107 以 clean production 累积候选 `4b4af0a233f1a3ab06e4178333181747a6250e25` 上传成功；Manifest `ed36fd07a1266a33875f101b85d486c180a0bba60351b6cf0e1168c12794bfc4`、receipt、远端不可变 tag 和 add-only allowlist ensure/verify 均一致。生产 live 仍 `b618d938`/schema57，本轮无需重复部署或备份。首次网络 ECONNRESET 后通过已验证 IPv4/TLS 路线对同一三元组重试成功。
- 体验版107说明“访客日历电话事件 4b4af0a”，主包1679405、总包4501599；保留既有内部主包预警。自动化和生产验证完成，CSV真实发送、相册扫码、通知点入和访客原生显示待小米14。

## 上一批次：feedback9 体验版102已上传并放行，待小米14复核

- 用户已批准方案：矩阵随人数完全展开、纵向页面滚动；默认日期占位后直接显示首个未排班日期；CSV 保留并增加用户主动发送文件。
- 使用独占 general-4，导出并行任务独占 general-5；用户另行授权两槽离线锁文件校准，已完成并回到 ReuseOnly，无依赖升级。
- 群组分区、班种选择、矩阵实测边界/高度、月历正方形标识/节假日/圆角/阴影、日期加载与竞态修复已实现；CSV 下载后发送、错误分类和临时文件清理已整合。已保留并行访客101交付（656a463d）。
- 基线与回归、行为变化、槽位恢复结果见 docs/audit/feedback9.md；不重复旧批次账户删除、通知测试或生产操作。
- pnpm verify通过：Mini1057/15跳过、root1226/418跳过、依赖保护81；最终Mini verify、Worklet2/2及320/390桌面布局通过。真实下载原因、文件发送和原生手势待用户复核。
- 应用检查点e40c4f9201bd7e79af151508e00e6667b6897a63已推送main；用户明确授权上传并放行，已交付0.1.0-p10.20260910.102。production/clean，353文件冻结Manifest、成功receipt与远端不可变tag一致；详情见docs/audit/feedback9-trial-release.md。
- 上传专项30项与候选前后检查通过；版本绑定主包1646789/总包4441027字节，保留既有内部主包预警。可信ensure仅追加.102，完整生产verifier及allowlist验证通过；独立HTTPS .102/.101/.99/.98=200、.100/未知版本=426。服务器应用仍4e0a0d1a/schema57，没有新应用部署、数据库备份/迁移或真实通知。
- 文档收口检查点：docs(release): record feedback9 trial 102 delivery。唯一下一任务/停止条件：用户在小米14重开.102/e40c4f9，复核群组偏好、手排矩阵/日期/月历、补录和CSV下载后发送/取消；失败时保留新版分类提示。自动化交付完成，真实下载原因与原生效果待用户复核；不重复上传、放行、部署或同步服务器release标识。
- general-4/5已恢复；general-2/3历史改动保留，general-6精确路径恢复/删除被自动审批以blocked by policy拒绝而未执行，归档及原文件保留。

## 上一批次：访客修复体验版101已上传并放行，待小米14复核

- 最终体验版0.1.0-p10.20260910.101，源码f7bc3ccc5d967b5bbeca0493256a7bdce12b49bb，包含890efd8b访客完整修复、17939041历史动效证明补充及Skyline导航兼容修复。均已推送main；详情见docs/audit/visitor-trial-release.md。
- 用户明确同意上传并放行，正式锁内分配，production/clean。receipt、353文件冻结Manifest及不可变远端tag一致；主包1646685/总包4433783字节。此前.100因官方编译拒绝default导航而失败，号码永久占用且未放行。
- 可信ensure追加.101并保留旧版；完整生产verifier与allowlist验证通过，外部HTTPS .101/.99/.98=200、.100/未知版本=426。服务器应用仍4e0a0d1a/schema57，本轮没有新应用部署、数据库备份/迁移或医护关联变更。
- 应用证据复用visitor-system-fix.md；本轮动效/lineage/候选/锁28及CI封装6通过，扫码导航17项、Mini verify/确定性/包体/Worklet通过。独占general-1顺序Acquire/Release，依赖复用、无安装。
- 文档收口检查点：docs(release): record visitor trial 101 delivery。只记录交付，不重复上传、放行、备份或同步服务器release标识。
- 唯一下一任务/停止条件：用户在小米14重开.101/f7bc3cc，核对trial/renderer/基础库/微信版本后复核反复医护群切换、三视图与筛选、扫码及后台恢复。自动化交付完成，待用户原生复核；未提审/正式发布或主动发送通知，未宣称卡死/闪退真机验收通过。

## 上一批次：群组互为访客已上线并启用

- 新增群组级双向关联，当前及未来正式成员实时获得对方群访客访问；离群/停用自动失效，不创建成员行，不传播第三群，原有身份保留。
- 登录关联访客只读已发布/历史排班，过滤所有联系方式；平台管理员标记不扩大关联权限。群目录、加入退出冲突提示、群回收和运维预检/幂等启停/审计齐备。
- 新增0057迁移；发布兼容要求schema57。操作说明见docs/operations/group-visitor-links.md，验证与引入点见docs/audit/group-visitor-links.md。
- 验证：真实MySQL83项不同用例及13项定向复测，API/数据库Node257通过/411跳过；build/typecheck/ESLint/format通过。完整浏览器冒烟与双向关联专项浏览器均通过；smoke:check-core通过。
- 独占general-1复用依赖，无安装。Docker残留socket阻塞已排除；合成local-admin的测试标记已恢复。原有未跟踪文件保持不动。
- 应用检查点4e0a0d1a `feat(groups): add reciprocal guest access between groups`已推送并部署。生产备份a4c0aff8-c461-45e3-98a0-a69ef6c0d3c4已核验文件长度与hash；部署前实际live=8e68a480，部署后schema57。完整生产verifier、版本策略与外部HTTPS健康检查通过。
- 医生群7名、护士群18名有效正式成员；原有跨群身份优先保留，新增覆盖医生群6账号→护士群、护士群17账号→医生群。生产逐账号验证访客摘要、排班读取、联系方式隐藏及管理权限拒绝全部通过。
- 生产关联已启用（version1），账号37/成员关系35/排班4011前后不变；未新增个人成员记录、未主动发送通知、未上传小程序。交付细节见docs/audit/group-visitor-links.md。
- 收口检查点：`docs(ops): record reciprocal guest access activation`。唯一下一任务/停止条件：Web可查看对方群访客入口；小程序现有包未接通专用接口，已转入当前访客修复批次。本轮实施及生产配置完成，不再次部署、备份或启停关联。

## 上一批次：feedback8 九项整改已交付体验版99，待小米14复核

- 上传提交ca634116925f2ad708ec07b2edbfcd531e9a0bf6（应用8e68a480）已上传为0.1.0-p10.20260910.99。用户明确批准该提交上传及新版放行；上传receipt、349文件冻结Manifest、远端不可变tag一致，见docs/audit/feedback8-trial-release.md。
- 只追加.99到服务器允许列表并保留旧版，完整生产verifier与allowlist验证通过；独立HTTPS：.99/.98/.97均200，动态未知版本426。服务器应用仍8e68a480，未重复部署代码或新建数据库备份。
- 九项实现见docs/audit/feedback8.md。完整验证Mini996/15跳过、root1215/402跳过、依赖保护81；额外弹窗21项、最终Mini verify和320/390几何通过，浏览器与同API源码MySQL15项证据复用。本轮上传专项30项通过，版本绑定主包1765638/总包5328015字节，保留既有内部警告。
- 账户按用户最终条件仅删除3个确认账户；清理备份e03aba70-d331-48f0-a865-e383b625dd15、操作及校验见feedback8-account-cleanup.md。剩32账户（24已设置、8历史待设置），4011排班及成员归属保留，不重复执行。
- 服务器应用8e68a480已在上一阶段部署，部署备份d5dac482-6607-434e-94cc-8e1711738942及hash核验通过，回滚候选36fae3d1，详情见feedback8-server-release.md。四字段通知经部署模块模拟网关验证，尚无用户本人实际收信结论。
- 独占general-1依赖复用，工作区无安装。Docker自身socket故障使末次MySQL复测未运行；不能把跳过项或上传成功当作原生验收。可选唯一班种自动选中未获选择，保留原手动行为。
- 文档收口检查点：`docs(release): record feedback8 trial 99 delivery`；只记录已交付ca634116/.99，不再次上传、部署、备份、清理账户或同步服务器release标识。
- 唯一下一任务/停止条件：用户在小米14重开体验版，确认.99/ca63411后复核群组按钮、周期弹窗、预览/草稿/发布月历、补录、好友/群聊邀请及本人通知测试。九项实现和自动化交付已完成，待用户原生复核；未提审、正式发布或主动发送通知。

## 上一批次：feedback7 体验版98已上传并放行，待小米14复核

- 17项交互整改应用507443024bb883a35cbea2b27f20ba933cbdc9a3已上传为0.1.0-p10.20260909.98；用户确认的默认空白模板、删除失效排序箭头均已包含。实现见docs/audit/feedback7.md，交付见docs/audit/feedback7-release.md。
- 用户当次批准上传，随后另行批准只追加新版到服务端并保留旧版；已完成。正式上传receipt、340文件冻结Manifest及远端tag一致。
- 服务端可信ensure追加1个版本；完整生产verifier与allowlist验证通过，外部HTTPS .98=200、.97=200、未知版本=426。服务器live仍36fae3d1，本轮不部署应用代码或迁移数据库。
- 实现证据981通过/15跳过；本轮上传专项30通过，版本绑定包主包1753208/总包5135578字节，保留已有主包内部预警。独占warm槽顺序复用，无依赖安装。
- 文档收口检查点：docs(release): record feedback7 trial 98 delivery。只记录已交付应用50744302/.98，不重复上传、部署、备份或同步服务器元数据。
- 唯一下一任务与停止条件：用户在小米14重开体验版，确认.98/5074430后复核群组管理、手排模板/预览/草稿/发布、补录、岗位成员。当前自动化交付完成，待用户原生复核；未提审、正式发布或主动发送通知。

## 上一交付：feedback6 体验版97

- 十一项整改已进入应用36fae3d145982d793c1dee243a6eb12867962fb6及体验版0.1.0-p10.20260909.97。3aeaa4c8业务修改完整保留；36fae3d1仅补充历史导航动效证明。结果见feedback6-result.md，发布证据见docs/audit/feedback6-release.md。
- 用户当次授权上传、备份、0055/0056迁移部署及旧版本停用；全部完成。最终schema56，完整生产verifier和版本控制验证通过，外部HTTPS .97=200、.96及未知版本=426。仅.97在允许列表，legacy标识保持原值。
- 备份8ed1f840-8a23-4eff-ae0b-43a1123c862f实际文件hash核验通过。迁移前后账号/排班/事件/模板总数不变，手机号镜像差异0；未删账号或补造历史事件。生产仍为权威数据库，无本地业务数据复制。
- 应用证据复用3aeaa4c8全量verify（Mini971/root1208）、真实MySQL分批回归及原pnpm smoke:browser流程；本轮发布保护35、动效/血缘/候选锁28项通过。最终上传335文件，Manifest与receipt/冻结包/远端tag一致；版本绑定主包1751101、总包5121308字节，Worklet2/2。
- 独占general-1顺序复用，无依赖安装。文档收口检查点：docs(release): record feedback6 trial 97 delivery；只记录已发布36fae3d1，不再次部署/上传/备份。lease状态以ignored runtime官方状态为准。
- 唯一下一任务与停止条件：用户在小米14重开.97/36fae3d后复核日历08:00、手动排班/补录、账号管理及通讯录首搜。原生交互/更新提示/搜索耗时未验证；未提审、正式发布或主动发送通知。当前自动化交付完成，待用户复核。

## 上一交付：微信换绑修复

- 应用a6586326b8bccc91fe7cf4f46b89e6296108e869已部署，体验版0.1.0-p10.20260908.96已上传并放行。用户本轮分别明确授权上传及生产部署/版本放行，最终生产verifier通过。
- 换绑修复、旧凭证失效、并发/事务保护、网页微信登录退役及诊断提示已交付；原账号业务数据保留，无新迁移。旧网页微信授权入口实际HTTP404。
- 备份9168aa6d-2fd1-4f8c-9f14-458face592ee及加密文件hash核验通过；部署前回滚候选实际读取为657f6ef5，最终live=a6586326，查询方案candidate保持开启。
- 实现证据见docs/audit/wechat-rebind.md：全量verify、65项真实MySQL和浏览器检查通过；本轮上传门禁24项、候选版本绑定/归档/标签校验通过。交付详情见docs/audit/wechat-rebind-release.md。
- 无依赖环境安装/冷槽新建。general-1上传租约已释放并用于文档收口；general-3历史释放仍受PID重用阻挡，不终止无关进程。
- 收口提交标识：docs(release): record WeChat rebind trial 96 delivery。只记录已交付应用a6586326，不再部署文档提交。
- 上一交付保留待复核项（非当前下一任务）：小米14确认.96/a6586326后测试个人账号↔admin换绑、微信登录及诊断身份一致，再主动本人订阅/发送并返回脱敏报告。未主动发送真实测试通知，未提审或正式发布，原生与收信效果待用户复核。
