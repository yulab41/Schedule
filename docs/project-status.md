# Project Status

## 当前批次：Skyline 访客周视图分页体验版139已上传并放行，待双实例复核

- 用户复核`.137@09e6398`：3.17.2访客页面周视图滑动乱跳、切到非本周后点单元格无反应；同实例月视图、成员周视图与3.17.3正常。
- 根因：访客页仍使用成员页在`.135`废弃的强制归中（`weekSwiperCurrent=1`+`duration:0`回跳）与`weekPanels[1]`固定索引；3.17.2对该0ms回跳会反向动画或补发`animationfinish`，并使原生swiper停在2号页、数据停在1号，可见单元格属于另一周，点击后选中态落在不可见面板。
- 修复：访客页直接导入成员页同一个`calendar-period-pager`环形状态机，渲染用`mapCalendarPeriodRing`，模板加`circular`/`bindchange`并读取`weekPanels[weekSwiperCurrent]`；260ms、easeOutCubic、±6有界队列与提交锁不变，月/列表视图与成员页面零差异。
- 血缘：并行会话的`.138@09c100d5`（3.17.2选择器浮层与页头箭头）是当前最新累积体验版；本分支以它为基线线性叠加访客周视图修复，不改写对方分支、不产生合并冲突。若上传前基线再次前进，必须重新叠加。
- RED 2项失败；GREEN定向42项、Mini完整174文件1206项通过/16跳过、根套件270文件1273项通过/444跳过。typecheck、production build366文件、source/package/determinism、format/lint/smoke:check-core通过；主包1741484B/总4609138B，较`.138`增2337B，无新增依赖。Mini verify仍仅被既有未改手排节点1507>1506阻断。
- `.139@a9c3204`已以production/clean上传，Manifest`a2491815…d91e4d7b`与tag/allocation/receipt一致；可信ensure只追加`.139`并保留`.135/.136/.137/.138`，allowlist与完整ECS verifier通过，公网`.139/.138/.137/.136`均200、动态未知版本426。live release仍`44034fcc…d276df9`，未部署应用或修改数据库。
- 唯一下一任务：小米14双实例重开`.139@a9c3204`，复核3.17.2访客周视图滑动不乱跳、切周后点单元格立即选中，并确认`.138`箭头/选择器与月/列表/成员页面无回归。详情见`docs/audit/runtime-ui-compatibility-guest-week-pager-trial-release-20260915.md`。

## 上一批次：Skyline 3.17.2 选择器浮层与页头箭头已实现，待体验版交付

- 用户用小米14复核`.136@efda88f`：成员页面四项修复通过、3.17.3正常，但3.17.2页头群组箭头比3.17.3偏右约40px；换班sheet的月份/日期选择器点按无任何反应；班次/人员下拉只剩约12px高的白色空框。
- 箭头来自本项目`.136`自身：`ed06031f`把3.17.2群组容器固定为220px，而箭头一直相对该盒子绝对定位，于是贴到盒子右缘（`git log -S`/`git blame`核对）。选择器来自旧Skyline滚动容器差异：`6d0575d0`的内嵌`scroll-view`弹层不按内容推导高度（塌成内边距），`bc32a4f1`/`528722f4`的`position: fixed`对话框层在滚动容器内不再按视口定位，同页不在滚动容器内的`ui-sheet`仍正常。
- 修复只在3.17.2生效：箭头改为Flex流内跟随群名（220px上限与196px省略阈值逐字保留）；弹层按选项数写入显式高度（30n+10、空态56、上限300）；对话框层用`root-portal`提升到根层并`@import`根层令牌作用域，`enable`仅在3.17.2为true。3.17.3与未知版本继续内容自适应高度与同位置渲染。
- RED 3失败；GREEN定向14项、Mini完整174文件1203项通过/16跳过、根套件270文件1273项通过/444跳过。typecheck、production build366文件、source/package/determinism、format/lint/smoke:check-core通过；主包1739147B/总4606801B，较访客修复基线增2083B，无新增依赖。Mini verify仍仅被既有未改手排节点1507>1506阻断。
- 分支`codex/runtime-3172-picker-overlay-20260915`基于访客修复`09e63980`；两份3.17.2修复在后续合并时必须保持同一血缘。本轮未上传、未放行、未部署生产应用。详情见`docs/audit/runtime-ui-compatibility-picker-overlay-fix-20260915.md`。
- 唯一下一任务：取得当前消息的上传授权后交付新体验版并add-only放行、保留旧版，再由小米14双实例复核3.17.2箭头、下拉选项与月份/日期面板恢复，并确认3.17.3页头与四类选择器不变。

## 上一批次：Skyline 3.17.2 访客页面按压反馈对齐已实现，待体验版交付

- 用户复核`.136@efda88f`：四项修复在成员页面通过，但3.17.2访客页面仍出现周格灰色闪烁和月格蓝色反馈滞留。
- 根因是访客页面已继承成员页面的`.is-skyline-3172-ui`根类与Grid/Flex后备样式，却漏接两项条件参数：`pages/guest/guest.wxml`的月历未传`runtime-pressed-feedback-compatibility`，周格仍无条件使用`hover-class="is-pressed"`。
- 访客页面现复用成员页面完全相同的机制与同一表达式；源码改动仅`pages/guest/guest.wxml`两行，成员页面零差异，3.17.3与无法读取版本的数值和外观不变，未新增依赖或第二套机制。
- RED新增1项并在该双分支缺口上准确失败；GREEN定向31项、Mini完整174文件1200项通过/16跳过、根套件270文件1273项通过/444跳过。typecheck、production build366文件、source/determinism、format/lint/smoke:check-core通过。主包1737064B/总4604718B，较`.136`仅增132B。Mini verify仍仅被既有未改手排节点1507>1506阻断。
- 同时修复既有`docs/project-status.md`超出40KB/250行策略上限：只保留最近批次，旧批次细节继续留在Git历史与`docs/audit/`。详情见`docs/audit/runtime-ui-compatibility-header-press-fix-20260915.md`。
- 唯一下一任务：获当前消息授权后上传新体验版并add-only放行、保留旧版，再由小米14双实例复核3.17.2访客页面与成员页面按压反馈一致。

## 上一批次：Skyline 页头与按压反馈体验版136已上传并放行，待双实例验收

- `.135@c7025b93`真机确认周切换已正常；3.17.2仍有群名省略、下拉菜单被日历文字覆盖、周格灰闪和月格蓝色反馈滞留，3.17.3正常。
- 根因是`.134`兼容宽度仍被父Flex百分比上限压回、旧Skyline滚动合成层高于页内菜单，以及3.17.2对既有hover透明度/70ms保留时间表现不同。菜单已收敛为所有版本共用的一份root-portal、一份选项模板和一个事件；仅3.17.2保留确定宽度、周格无灰色按压类和月格松手0ms参数。3.17.3的菜单几何/视觉、周格反馈和月格70ms不变。详情见`docs/audit/runtime-ui-compatibility-header-press-fix-20260915.md`。
- 累计RED 4失败，单菜单收敛RED 1失败；GREEN定向30项、Mini完整174文件1199项通过/16跳过。typecheck、production build366文件、source/package/determinism、format/lint/smoke:check-core通过。主包1736932B/总4604586B，较`.135`总包仅增319B（约0.007%），无新增依赖；Mini verify仍仅被既有未改手排节点1507>1506阻断。
- `.136@efda88f`已以production/clean上传；tag、allocation、Manifest `27702a1c…f908a32b`和receipt一致。首次`890c50a9`候选因过期canonical blob在占号/上传前停止，policy刷新后lineage/上传门禁通过。
- 可信allowlist ensure只追加`.136`并保留`.135/.134`等旧版；allowlist verifier、完整ECS verifier通过，公网`.136/.135`为200、动态未知版本为426。live release仍为`44034fcc…d276df9`，未部署应用、备份或迁移数据库。
- 自动证据不能代替真机。唯一下一任务：同一小米14双实例均核对`.136@efda88f`；3.17.2复核群名、菜单遮挡、周格灰闪、月格反馈，3.17.3复核页头/菜单/通知胶囊、单元格反馈和260ms动画均不变。详情见`docs/audit/runtime-ui-compatibility-header-press-trial-release-20260915.md`。

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
