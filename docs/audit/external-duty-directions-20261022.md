# 网页校对连续换班与手动方向

## 范围与原因

用户确认两方向按钮布局，并选择网页到本系统时一起预览关联日期、生成完整方案。独占canonical `runtime/wt/general-3`，从已推送1a2f6d0f实施，Acquire → ReuseOnly → root Bootstrap八项全复用、安装0。入口和canonical用户文件保留。不重设0072发布基线，不改其它页面、renderer或依赖；新增按钮需要API和新小程序体验版配合。

`git log -S 'const unresolved = sorted.some'`及blame定位06d420a1的整期间阻断。匿名双日互换复现一日无建议、另一日blocked。现在只连接共享当前双方人员的差异日期，无关冲突不再连带阻断。同提交的stepOperationId只绑定日期/期间/步骤，新增版本断言先红后绿，证实再次交换复用旧身份；旧步骤加入当前版本/人员，新手动步骤绑定完整方案指纹。

## 行为变化与评审

- 自动来源仍参照发布基线。关联组有来源歧义时不默认网页正确，也不显示自动推荐方向。
- 本系统→网页只处理所选日期；网页→本系统由服务器确定全部关联日期，人数守恒换班，否则逐日加扣班。客户端不能指定任意成员或跳过校验。
- 预览返回完整最终变化和步骤；确认复核整组指纹、ID/期间/版本/人员/基线及网页，也识别新增关联日期。原工作流事务内锁班次、比较预期版本，继续权限/资格/冲突校验；其它调用者没有预期版本参数时行为不变。
- 全组原子领取，复用observedAt固定领取时间。扫描10分钟内保留处理中及原领取时间，包括指纹变化/已一致日期；执行5分钟后不再发起下一步，网页原有8秒超时。终止请求占用到期后可重新检测恢复，无新表或迁移。清理只释放本次领取时间。
- 多步逐步执行，不承诺跨系统原子回滚。每步沿用工作流和校对审计，最终回读才返回成功；中途或刷新失败保留已提交步数，小程序刷新记录再显示错误。

独立只读评审发现扫描提前释放占用、清理覆盖部分完成错误、歧义组误标自动推荐三项，均已修复并补对应测试；复评又发现旧入口成功后未释放占用，已先红后绿修复并完成实库网页写入后立即隐藏验证。最终只读复评无剩余P1/P2。改动为批准的功能变化，不声称语义等价重构。

## 验证层级

- 修改前Node基线：API规划/分类10项、Mini页面8项、Mini类型/lint、icon:parity通过；production构建274文件2704ms，总3888912B/主1128046B。Mini源码当时未改。
- 规划3项和旧重复步骤身份先红后绿。API校对58项通过/1项实库锁环境跳过，方向路由6项通过；Mini页面/客户端15项通过。实库另由工作流集成覆盖，不把跳过算通过。
- 真实本地MySQL：首次3307拒绝，确认专用容器停止，启动既有medical-schedule-test-mysql-1后，换班38/加扣班29，合计67项通过/跳过0，含三轮互换、双卡并发、执行前后穿插扫描、事务版本变化。首次67项环境失败日志保留。
- Agent开发者工具：wechatide兼容/登录有效，打开本slot、WXML及WXSS局部编译成功，再关闭窗口。不是模拟器业务运行或小米14验收。
- Web黄金：现有ExternalDutyPreview新增RepeatedSwap390/320；用户确认后才改原生。最终同文案390×844/320×844截图页面错误0，按钮158/131×44，无溢出，两日期及确认按钮可见。不是原生像素比较。
- 当前production构建274文件、包审计通过：总3889103B/主1128047B/insights959511B，其余分包不变。版本绑定上传构建另行记录，local产物不是体验版。

checkpoint检查已完成：根格式/lint/build/typecheck/图标通过；Mini全量1368通过/28跳过，唯一导出准备钩子10秒超时，隔离原5项通过，合计1373执行通过/23原有跳过，未改导出功能或放宽超时，不称单次verify全绿。根pnpm test：Codex83、Vitest1427通过/494实库环境等跳过；相关真实MySQL67项已另跑，不能把494跳过都算实库通过。最终API另补build/typecheck/lint通过；Mini production verify（预算/确定性/边界）及lineage、CI干跑、smoke:check-core通过。版本绑定新体验候选待干净提交后执行。ignored证据在runtime/audit/external-duty-directions-20261022/；无生产人员、凭证或二维码进入Git。

## 工具与下一任务

成功读取guardrails、systematic-debugging、brainstorming、miniprogram-development、frontend-design、ui-design、requesting-code-review及wechatide根/initializer/compiler；实际使用Git、Node/Vitest、Playwright/Edge本地黄金、Docker专用MySQL和wechatide局部编译。writing-plans引用文件缺失，未声称使用；无CloudBase或桌面原生控制证据。

本地已完成、待上线/用户复核；检查点消息`feat(external-duty): preview and confirm reconciliation directions`，当前任务分支正常提交推送后准备独占干净新体验候选。生产备份/API部署/版本放行须当次明确授权，之后用户小米14同构建复核；没有当前实体证据不写验收通过，不提审或正式发布。

## 体验交付与停止点

业务检查点e03f256c（feat(external-duty): preview and confirm reconciliation directions）已正常推送origin/codex/schedule-75032-49481c4ee8ee。独占clean detached候选由正式锁动态分配并Node上传`0.1.0-p10.20261022.229@e03f256`；production、dirty=false、说明“网页校对双向预览与连续换班 e03f256”，测试页为排班网页校对。上传成功时间2026-10-22 22:26:51北京时间，tag永久占用，Manifest `585cc6eeeb334f16a46520266a9c90a38c4806173b4ad6de67d48bc67c0aae9e`，canonical receipt/manifest/allocation均已保存并核对，正式版本绑定候选检查PASS。

版本绑定包总3890528B/主1128469B，Zip2041640B；该值与local构建分别记录，不把版本元数据增加当作业务体积退化。Git正常fetch/push成功，fresh origin/main仍55c3a9fd。旧保存微信IPv4 TLS校验失败，改用本轮系统解析的真实IPv4，证书与servicewechat.com主机名匹配、TLS1.3通过，进程级lookup/IPv4优先且不改系统网络；上传成功，无不确定重试。

上传用途租约已正式释放；为交付记录重新取得同一healthy general-3的独占root租约，八producer全复用、安装0。此收口只改文档，按相同应用输入复用检查证据；提交消息docs(audit): record reconciliation trial 229。唯一下一任务是取得当次生产备份、部署配套API和只增放行229的授权，再由用户小米14核对同构建的双向预览、连续换班和记录。未连接生产、未创建生产备份、未修改allowlist、未提审或正式发布，未声称手机验收通过；体验上传本身不证明API上线。

## 生产交付（2026-10-23）

用户回复“授权”，明确批准实时身份读取、生产备份、API部署及只增放行229。独占general-3新release租约，八producer全复用、安装0，当前任务分支codex/schedule-48220-b655d5b57c02；入口和canonical用户文件保留。机器信息仅存ignored操作记录，不进入Git。

fresh fetch的origin/main仍55c3a9fd；SSH已验证known_hosts唯一匹配、两独立DoH及正式域名TLS/SNI，再读取实时live/manifest为1a2f6d0faace56764b56a992db6943277f0f2984。该即时前驱在首次变更和部署前均再次一致核对，schema72/保留包验证通过。上一轮未完成清单的两个payload缓存已存在，本轮官方packager三个缓存全命中，包/脚本本地与远端SHA、LF/bash -n通过。

初次完整verifier的遥测/留存综合断言失败；只读复查表1、索引3、CHECK3、过期遥测/访客/打开回执均0，已完成留存作业2949；再次完整verifier通过。没有测得最初失败瞬间的各项值，不将原因猜成已证实的某一条边界记录；没有手动清理或修改门禁。

先执行已安装备份控制：archiveId21ce45a6-a04b-491d-87e5-83c448d586e9，58表/104095903B，文件流式SHA256为84abf129b03bb6b12ad7e614f651d6a6c4fa0a5a9beb10db064aef8550565095，与登记值/大小一致。既有备份保留策略淘汰1份旧归档。随后完整部署7e80336af48e608bab22a90a5eb5884352352939，schema仍72、无新迁移，前后MySQL容器ID一致；发布工具按原留存规则清11条过期成功作业、失败0，访客和遥测清理0。未复制本地数据库、会话或凭证到服务器。

可信schedule-client-version-allowlist ensure仅追加0.1.0-p10.20261022.229；版本数119→120，逐项确认原119版本保留、新增集合恰为229。独立verify和完整ecs-verify.sh（显式公网IP主动探测）通过，首次容器重建期间的健康重试已恢复。新resolve-preview/resolve-apply在部署前404、部署后401，证明路由已上线且仍受登录保护；部署容器内纯匿名双日互换规划为1步/2日期，自动方向歧义继续阻断，生产业务写入0。

部署前后253条基线及其253条原排班全部保留；基线完整SHA为13f717b21ef27454e314a6796131ef22c2b63582f458c846da8b29d113eb28f1，原计划完整SHA为61404d392b6b18380a7e9ed140c63baebc8a99ecd98f20df34118f4c0def67c5，前后严格一致。没有为了演示去同步网页、创建真实换班或加扣班。

生产证据位于ignored runtime/audit/external-duty-deploy-20261023/。收口消息docs(audit): close reconciliation deployment and trial 229，只改文档并复用应用输入，定向文档/core smoke验证后正常提交推送；以本轮授权先新备份、再通过可信哈希复用同步最终文档release身份，完成后停止。唯一下一任务是用户小米14同构建229复核，仍不声称手机验收通过；未提审或正式发布。
