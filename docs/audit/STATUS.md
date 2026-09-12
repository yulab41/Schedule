# 微信小程序审计状态

## 当前批次：Feedback16 导出白屏运行时依赖边界修复待上传116

- 设计检查点 `516e2719`；A 检查点 `42e644a4`；最终 B/C 检查点 `84ae20f8`；当前为上传策略证明补充阶段。详情见 [feedback16.md](feedback16.md)。本轮使用 `general-5` 独占 warm worktree，`REUSE_ONLY`，未安装依赖。
- A 已修复跨月全天班徽标首帧闪烁和周历高度二次回写；B 已补齐导出 panel 的 `ui-toast` 血缘注册、二维码点击预览/长按菜单及轮换后自动读取；C 已将平台账号操作改为统一瞬时 toast，并增加弹窗间距与底部安全区留白。
- 定向与相关回归均通过：Feedback16 日历2、导出1、二维码/账号7，相关 Feedback10/14、导出、组织账号、ui-toast 测试合计71项；A workbench联合58项通过、1项跳过。全量 Mini 测试169文件通过、2文件跳过，1195项通过、16项跳过。合成390/320/大字号布局检查通过，非原生证据。
- 最终门禁：`format:check`、`lint`、Mini verify、包体、Worklet、确定性及 `smoke:check-core` 通过；Mini verify source/output Worklet 2/2，包体4,550,584字节。既有主包和矩阵节点仅为内部 warning，不是本轮回归失败。
- `.114@f7b1709` 小米14报告确认版本一致，但仍只有 `open-requested` 和 `MINI_RUNTIME_ERROR`，没有 Page 生命周期阶段；用户补充现象从 `.106` 及以后出现。`.106` 已有导出路由，当前未发现 URL/app.json 路径回归，精确引入提交仍待原生栈信息。
- 外部边界：不控制微信开发者工具 GUI/CLI；用户已授权本轮体验版上传和追加放行，未授权生产代码部署、数据库操作或真实通知。
- 体验版交付：`905171cfa96b20e0158c39819a96795192d74108` / `0.1.0-p10.20260912.113` / production-clean；Manifest `962af5a88b793f124f3c7f7e3f6761e54d73d16e6bd61428d1e03cb33d274ba8`，receipt 与远端 tag 一致。首次微信 CI 因 IPv6 `-10008 invalid ip` 失败，同一冻结元组经已验证代理 IPv4 路由重试成功。
- 放行与生产边界：`schedule-client-version-allowlist ensure` 仅追加 `.113`，旧版 `.112` 保留；独立 allowlist verify 和完整 `ecs-verify.sh` 通过，线上 release 指针仍为 `83d8a03bfa64817f1ada6afd7c801fc642000978`，未部署生产应用、未备份/修改数据库。
- 导出白屏根因：直接 Page 在 `onLoad` 将群组 ID赋给只读 `this.properties`；回归测试复现 `TypeError: Cannot assign to read only property 'properties'`。静态路由、app.json、构建产物和导航 URL 一致，排除路径设置错误。
- 修复：Page 使用 `data.groupId`，控制器用宿主标记区分 Page/Component 上下文；无 query 冷入口转为可见错误。新增回归后定向39项、全量Mini169文件/1197项、Mini verify通过。
- 新体验版交付：`f7b1709aa471562f15caab2b6c83db1c94383de1` / `0.1.0-p10.20260912.114` / production-clean；Manifest `66ab569cacb1f1384cc38da6b1c4c586c23c3b0c8ecf35032760bce9a4917f9a`，receipt 与不可变 tag 一致。服务器仅 add-only 追加 `.114`，`.113` 保留；allowlist verify 与完整 `ecs-verify.sh` 通过，线上 release 指针未改变。
- 新修复：导出 Page 首帧改为轻量标题/加载壳，下一渲染周期再挂载完整 panel；卸载取消延迟任务，不改变 controller、权限、请求或导出语义。相关回归和构建检查已通过。
- 检查点提交消息：`fix(miniprogram): defer export panel first paint`。
- 新修复验证：Mini 全量169文件/1197项通过、2文件/16项跳过；Mini verify、determinism、format、lint、package、`smoke:check-core`通过，包体4,551,852字节。
- 新体验版交付：`93c660b3cb38c19ff98758529b1c329b37189954` / `0.1.0-p10.20260912.115` / production-clean；Manifest `f94fcfc5d313e9c3eb46e3f5f7ce2fac7f5cb672cace786eac37df10835d1c53`，receipt 与远端 tag 一致，说明为 `Feedback16 export first-paint fix 93c660b`。
- 放行结果：服务器 add-only ensure 仅追加 `.115`，`.114`、`.113` 及旧版保留；allowlist verify 与完整 `ecs-verify.sh` 通过（退出码0），线上 release 未改变，未做生产代码部署、数据库备份或迁移。
- `.115` 同版本报告仍只有 `exports · open-requested`，无 `page-load/page-ready`；静态复核已确认工作台导航 URL 与 `app.json` 注册一致。新失败优先回归显示：`initial-data.ts` 的 `import { type ScheduleExportType }` 进入了构建产物运行时依赖，导出页 bundle 带入 contracts/Zod，并触发 `globalThis`/`navigator` 禁止边界。
- 新修复：导出 Page 注册前只使用纯壳数据，controller 工厂延迟至 `onLoad` 微任务；controller 工厂/初始化失败显示可重试错误。将类型导入改成 `import type`，initial-data 仅作为 controller bundled-only 模块，不改变 API、鉴权、任务、下载或路径。
- 本地证据：导出页119,713字节，不含 `globalThis`/`navigator`，无独立 initial-data 资源；定向29项、Mini verify、包体、Worklet2/2、确定性、format、lint和`smoke:check-core`通过。完整 Mini 测试169文件通过、2跳过，另有与本轮无关的 manual-schedule-limits 既有断言失败。
- 唯一下一任务/停止条件：`UPLOAD_REQUIRED_FOR_NEW_SHA`。本轮尚未上传/放行新 SHA；用户需重新明确授权后才可生成116并追加放行，随后等待小米14同版本原生复核。

## 当前批次：Feedback15 已部署并放行112，待小米14复核

- 用户批准八项计划；基线a8695f2a，独占general-4依赖复用、无安装。详情feedback15.md。
- 周历测量/点选、未上班折叠、岗位改名、月历顺延/62px、补班、两步授权及日期文字盒居中已实现。
- pnpm verify通过：Mini1184/16跳过、根1252/439跳过、依赖保护81；MySQL模式集成套件46项通过。额外通知保存失败RED1→联合35通过；最终Mini verify/Worklet2/2/包体通过（主包1708859/总4550421）。
- 390/320真实WXML/生产CSS几何、完整本地浏览器冒烟及smoke:check-core通过。合成管理员标记恢复，临时服务停止；小米14原生待同版本复核。
- 用户授权上传后又授权部署并继续放行；112/83d8a03上传成功，冻结包/receipt/远端tag一致，上传30项和候选前后检查通过。交付见feedback15-trial-release.md。
- 部署前实时live=e163fde8，回滚候选为8f441d2d；备份d89f173b-8b76-463c-b560-3e0726ff3d5d成功（54表、106182176字节）。83d8a03b部署完成，schema57，独立ecs-verify通过。
- 可信ensure仅追加112并保留111；allowlist verifier、再次ecs-verify和公网探针通过：112/111=200，动态未知=426。未发送真实通知或执行版本退役。
- 唯一下一任务：小米14最终复核112同版本的八项反馈；自动化和生产验证已完成，原生证据仍待用户提供。不重复上传、放行或部署。

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

## 上一批次：feedback11 体验版108已上传放行，导出空白待定位

- 代码实施基线72ea0ab0；用户原截图体验版号未知。QR-11和NOTIFY-11已复现并实现，EXPORT-11本地未复现，保持待定位；详情见[feedback11.md](feedback11.md)。
- 复用general-4依赖；RED 4失败/38通过；完整格式/lint/build/typecheck、Mini1122/15跳过、根1240/421跳过及依赖保护81通过。最终Mini verify/Worklet/包体/确定性、打包入口检查和smoke:check-core通过。上述为代码实施轮证据，体验版交付见下条。
- 用户明确授权后，c563afff上传为108，production/clean、Manifest/receipt/tag一致；上传专项30项和候选检查通过。可信ensure追加108、保留旧版，完整生产verifier及公网108/107=200、未知426通过；服务器仍b618d938，无新应用部署/备份/迁移。见[feedback11-trial-release.md](feedback11-trial-release.md)。
- 文档检查点：`docs(release): record feedback11 trial 108 delivery`。唯一下一任务：小米14重开108/c563aff复核两项修复，复制导出空白的安全诊断继续定位。没有同版本小米14反馈，不宣称原生通过或三项全部修复，不重复上传或放行。

## 上一批次：feedback10/VIS-02 服务端与体验版107已交付

- 用户已授权上传、追加放行及必要部署。累计应用0565f023包含feedback10四项修复和VIS-02访客日历，发布校验修复b618d938已提交推送并部署，实际live为b618d93861d05ae0c597fa8dfe40ed478902be5c、schema57。完整生产verifier和既有版本策略验证通过；详情见docs/audit/feedback10-release.md。
- 部署期间发现0057新增访客关联表后旧校验器不接受54表新备份。仅新增schema57迁移前53/迁移后54表分支；旧代码23通过/2失败，修复后发布/回滚35项通过，项目lint、格式、smoke:check-core通过。未改变业务数据或新增迁移。
- 最终部署前备份e011c56b-699e-422d-9b30-24b2282279f4，实际104354272字节、54表，SHA-256 6fcb93a4d09413a789abbd198eaaea4c0240ed82047968d03dae7b95abbadeb2与登记一致。应用与控制产物hash验证通过；回滚候选来自本次即时live 0565f023。
- .103/.104失败记录保留；直连IPv4出口120.230.6.0加入微信CI白名单后，.106=0.1.0-p10.20260911.106绑定63877b5e和Manifest c4bf033e252a94927000c6489fabb9f33f679c608c2abb6104606c5f3cc44ceb上传成功，receipt/tag一致。
- 独立HTTPS核验：.102仍200，.103/.104均426；不修改微信平台配置、不关闭IP白名单、不改系统网络。浏览器库存读取失败，无法核对公众平台配置。已归档冻结包/错误/备份/发布证据到ignored runtime/audit/feedback10-delivery-final-20260911及feedback10-delivery-initial-20260911；确认上传进程退出后清理本任务孤立操作锁，不改预约记录。
- 应用验证复用feedback10.md和visitor-calendar-parity.md：合并MySQL45、Mini联合146、共享/API33及访客浏览器通过，Mini/Worklet和专项上传30项通过；不把自动化算作原生验收。CSV真实发送、相册扫码、瞬时通知、新消息点入及访客显示均待小米14。
- 独立HTTPS核验：.106/.102=200，.105/.104/.100/未知版本=426；trusted ensure仅追加.106并保留旧版。无workspace依赖安装、无本地数据库上传、无真实通知、无正式发布或旧版退役。
- 文档收口检查点：docs(release): record successful trial 106 delivery。唯一下一任务：小米14复核CSV下载/发送、相册扫码、通知点入日历和访客显示。
- 体验版107已成功上传并追加放行：SHA `4b4af0a`，Manifest `ed36fd07…94bfc4`，receipt/tag/allowlist 一致；服务端 live `b618d938`/schema57，无重复部署。首次 ECONNRESET 已用同一不可变三元组和已验证 IPv4/TLS 路线重试成功。唯一下一任务：小米14复核107的 CSV 下载/发送、相册扫码、通知点入日历和访客显示。

## 上一批次：feedback9 体验版102已上传并放行，待小米14复核

- 用户已确认完整方案；独占 general-4/general-5，各自离线校准后复用依赖。
- 九项代码均已实现并整合，已保留访客101最新基线656a463d。新增回归先失败再通过；最新定向70通过，pnpm verify完整通过（Mini1057/15跳过、root1226/418跳过、依赖保护81）。最终Mini verify与Worklet2/2通过。
- 详情、引入点、基线和验证见 [feedback9.md](feedback9.md)。桌面 CSS/Node 检查不能代替小米14真机。
- 应用e40c4f9201bd7e79af151508e00e6667b6897a63已推送并经用户授权上传为0.1.0-p10.20260910.102；production/clean，353文件Manifest、receipt、远端tag一致，上传专项30项及候选检查通过。版本绑定主包1646789/总包4441027字节；交付见[feedback9-trial-release.md](feedback9-trial-release.md)。
- 可信ensure仅追加.102并保留旧版，完整生产verifier/allowlist验证通过；独立HTTPS .102/.101/.99/.98=200、.100/未知=426。服务器应用仍4e0a0d1a/schema57；无新应用部署、数据库备份/迁移、主动通知或正式发布。
- 文档收口检查点：docs(release): record feedback9 trial 102 delivery。唯一下一任务/停止条件：用户在小米14重开.102/e40c4f9并核对trial/renderer/基础库/微信版本，复核群组偏好、矩阵与月历、日期加载、补录和CSV实际下载/发送/取消。自动化交付完成，待用户原生复核；当前不宣称真实下载故障已闭环，不重复上传或放行。

## 上一批次：访客修复体验版101已上传并放行，待用户原生复核

- .101/f7bc3ccc已成功上传，涵盖访客切群观察器、接口/缓存/角色隔离、匿名扫码原生Page及Skyline自定义导航安全区。细节见visitor-system-fix.md和visitor-trial-release.md。
- 本次授权上传并追加放行有效；旧动效整文件证明先失败，15方法AST及其他8个blob核对后补充；.100在官方编译因default导航失败，未放行且号码永久保留。导航修复后.101官方编译与上传通过。
- .101为production/clean，353文件Manifest、receipt、tag一致；主包1646685/总包4433783。上传专项28+6项、导航17项、Mini verify/确定性/Worklet通过，其余应用证据复用已验证源码。
- 可信ensure只追加.101，完整生产verifier/allowlist通过，独立HTTPS .101/.99/.98=200、.100/未知=426。服务器live仍4e0a0d1a，医护关联未操作；未另行部署、备份、迁移或发送通知。
- 文档收口检查点：docs(release): record visitor trial 101 delivery。唯一下一任务/停止条件：小米14重开.101/f7bc3cc并记录trial/Skyline/基础库/微信版本，反复切医护群、三视图筛选及扫码/后台往返。实现及自动化交付已完成，待用户原生复核；仍闪退则继续定位，不宣称卡死/闪退已消除。未提审或正式发布。

## 上一批次：feedback8 体验版99已上传并放行，待小米14复核

- 基线6729ec0a（应用50744302/体验版98），9项新反馈；账户清理已生产验证，应用代码完成本地运行验证，真机效果待用户复核。
- 已定位：预览严格schema遗漏完整排班字段；JSON空正文DELETE本地Fastify400；班种未选中也着色且缺项提示被删除；预览丢失颜色和弹窗固定高度；邀请接收路由缺失；微信实际模板四字段与发送两字段不匹配。
- 使用独占general-1复用工作区依赖。确认的3账户清理完成，现32/24/8、4011排班归属保留；应用8e68a480已推送并部署生产。上传提交ca634116已交付0.1.0-p10.20260910.99且只追加放行，详见feedback8-trial-release.md；未主动发送通知。
- 已确认：仅好友/群聊邀请卡片；重叠原姓名删除线＋拟姓名暗红字。唯一班种自动选择为可选项，未答前保留手动选择。账户清理已完成，不再等待弹窗或重复执行。
- 最终pnpm verify通过：Mini996/15跳过，root1215/402跳过，依赖保护81；长确认弹窗边界补测21通过，最终Mini verify及320/390桌面几何通过。主包1764091/总包5324841字节。复用原pnpm smoke:browser及同API源码真实MySQL15项结果；均非原生或真实收信证据，详情见feedback8.md。
- 本地Docker本轮因自身Inference socket故障无法启动，未重新跑真实MySQL集成；没有重置Docker或安装依赖。无新增API修改使此前15项证据失效；最后补充的兼容去重断言未在新一轮MySQL中执行，不宣称已复测。
- 服务端备份d5dac482-6607-434e-94cc-8e1711738942及hash核验通过；完整生产verifier、旧版本策略验证通过。实际部署模块的模拟网关四字段检查通过，真实发送0；数据仍32/24/8和4011排班，无缺失成员引用。
- 本轮上传专项30项、候选/版本绑定检查通过；主包1765638/总包5328015字节，349文件冻结Manifest与receipt/tag一致。放行后完整生产verifier通过，独立HTTPS .99/.98/.97=200、未知版本426。服务器应用仍8e68a480，旧版本保留。
- 唯一下一任务与停止条件：用户在小米14重开.99/ca63411，验证九项视觉与交互、邀请分享和本人收信。实现及自动化交付完成，待用户原生复核；不提审/正式发布，不重复上传、清理账户或部署应用。

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

## 上一交付：微信换绑修复体验版96

- 应用a6586326、体验版0.1.0-p10.20260908.96已上传并完成服务端部署/版本放行；生产最终verifier通过。身份修复及网页微信登录退役已进入此版本。
- 上传Manifest=d7db136a1b3edb5e2219d9499607cb78b2255320aa9ad9a754413c6f6bacc1dd，receipt、冻结文件归档及远端版本标签一致。详情见wechat-rebind-release.md。
- 验证沿用wechat-rebind.md的全量检查、65项MySQL和浏览器证据；本轮额外发布门禁24项及候选安全检查通过。没有原生验收或实际收信结论。
- 生产备份与hash校验成功，无迁移、本地业务数据复制或依赖环境安装。未主动发送测试通知，未提审或正式发布。
- 上一交付原生待复核项继续保留：微信往返换绑和提醒诊断，不自动发送通知。
