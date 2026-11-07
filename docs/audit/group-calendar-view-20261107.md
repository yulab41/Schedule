# 群组切换视图偏好修复

## 范围与原因

- 用户要求切换群组时使用目标群组设置的月、日历或列表视图。本轮仅小程序工作台及回归测试，属于 L1。
- 基线 main/origin/main 为 4540736b，canonical 既有未跟踪文件保留。独占 general-4，Acquire 已完成 ReuseOnly 和 mini Bootstrap，三个 producer 全复用，安装零次。
- `git log -S 'page._groupMonthShiftTypeId = preferences.groupDefaultMonthShiftTypeId'` 与 `git blame -L 2454,2480` 定位至 e94a54ca。读取偏好后只应用默认班种，未应用 effectiveView，群组切换清理也未重置视图。
- GVIEW-01，P2，高置信，已修复。位置为 `apps/miniprogram/src/pages/workbench/index.ts` 的 loadCalendarPreferences、handleViewChange 和 resetCalendarContext。影响为跨群组显示错误视图，风险低，可按提交回退。

## 行为变化与边界

- 账号、群组或角色切换时清理视图初始化标记，先显示月视图，取得当前成员的 effectiveView 后应用。沿用现有服务端成员偏好优先、未设置时采用群组默认值的规则。
- 用户在读取偏好期间主动选择视图后，较晚的偏好响应不覆盖其选择。同一群组前台刷新及读取失败后的恢复保留手动选择。
- 偏好与视图内容经 setCalendarData 一次更新，继续使用现有日期、视图建模及列表补齐逻辑。原有账号、群组、角色、可见性及请求序号校验继续生效。
- 认证访客的现有 display-settings 接口只提供默认班种，没有视图字段，切换进入该上下文采用月视图。未扩展访客接口。
- 本轮是明确行为修复。接收者绑定、原请求次数、异常捕获范围、权限与班种语义沿用原实现，新增初始化标记仅用于视图选择。API、数据库及 WXML/WXSS 无改动。

## 验证记录

- 静态检查和 Node 自动化。基线工作台 31 项通过，typecheck、受影响 ESLint、production build 和 icon:parity 通过。基线定向运行总耗时 8.11 秒。
- 三种目标视图回归在旧业务实现上全部失败，原 31 项通过。修复后 34 项通过。慢偏好响应的手动选择断言同时通过。
- 只读复核发现错误恢复误清理视图，以及测试遗漏首次 onShow。已增加真实前台偏好请求计数与同群组 400 错误恢复断言，先得到 3 失败/31 通过，再修复为 34 通过，总耗时 8.25 秒。
- 最终 `pnpm miniprogram:test` 为 1381 通过、23 既有跳过，197 文件通过、4 文件跳过，耗时 164.05 秒。typecheck、受影响 ESLint、Prettier、icon:parity、production verify、包审计、git diff --check、smoke:check-core 及连续性3项全部通过。只读复评无剩余问题。
- production verify 总包 3889728 B，主包 1128672 B，排班/组织/工作流/洞察分包依次为425091/851105/525349/959511 B。最大文件为工作台 index.js 238334 B。Manifest为80505c47…，本地构建标记local/4540736/dirty，作为本轮自动化证据。保留既有手动矩阵1513节点预算提示。
- 本轮未测同口径基线包体或独立构建耗时，不声称性能、包体改善。Console、Network、冷启动和手机性能当前工具无法测量，暂未验证。
- 本轮使用本地 Git、PowerShell、pnpm、TypeScript、ESLint、Vitest 及现有构建工具。未调用开发者工具或 MCP 运行验证，未取得小米14实体证据。

## 交付与停止条件

- 检查点消息为 `fix(miniprogram): apply calendar view preferences on group switch`。
- 状态为已实现待运行复核。唯一下一任务为同构建体验版复核群组往返切换、三种偏好与手动选择后的前台恢复。本轮停止于验证、提交和推送。
- 本轮没有体验版上传身份，手机验收待后续同构建证据。Mini/文档范围不触发生产部署、数据库备份或服务器发布身份同步。
- 根状态原末尾旧交付摘要为满足40KiB门禁移出当前状态，完整历史仍保存在Git及对应审计报告。

## 第二轮，个人与群组偏好优先级

- 用户明确成员群组优先个人设置，未设置时沿用群组默认；非成员群组采用该群默认。本轮跨Mini、client-core及API，按L2处理。基线1545acba，独占general-4，release Bootstrap六项复用、database/test-fixtures两项增量构建，依赖安装0。
- 成员路径使用既有effectiveView，真实数据库验证个人list覆盖群组week、清除个人设置后回到week。关联访客通过新增getWithView按需请求includeView=true，复用现有三字段显示设置解码器，采用groupDefaultView。原不带参数请求继续只返回两字段，避免已上传旧客户端严格解码失败。
- API在现有权限事务内读取群组视图，使用左连接确保默认班种为空、停用或跨群组时仍能返回群组视图。权限撤销后仍返回403，匿名401，非法includeView为400。无数据库迁移。
- 原缺口来自7842c4da的两字段访客设置，前轮1545acba仅补成员effectiveView。log -S及blame已核对，视图配置与图标/动作代码逐行复核，图标门禁通过。
- 客户端先1失败/4通过，API实库先1失败/40未选择，Mini先5失败/32通过（含查询路径更新的两条预期旧路径失败）；修复后客户端5、Mini37、API访客1及成员偏好2项通过。覆盖六种角色/视图组合、手动视图、错误恢复及迟到访客设置200/403。
- 首次成员实库测试因旧清库列表遗漏user_profile_avatars失败2项，来源f723b0db。改用仓库现有共享resetDatabase，保持权限和业务断言并增加清除个人偏好的回退断言，实库2项复测通过。
- API/client-core/Mini类型、受影响ESLint/格式、API及client-core构建、production verify、包审计、图标及core smoke通过。Mini第一次全量1383通过/23既有跳过/1失败，失败为上一轮HEAD推进后canonical proof仍指向旧工作台blob；按既有runbook另建发布证明检查点，再复测。
- 当前本地生产构建总包3906813 B，主包1131086 B，四分包426283/855665/528322/965457 B，Manifest8107c4dc…。本轮未建立同口径干净基线，不计算提升比例。
- 新实现仍保留已有账号/群组/角色/请求序号及前台可见性校验，采用目标群组偏好；同一群组的手动选择继续保留。第二轮规则取代前述关联访客固定月视图的范围边界。
- 检查点消息为fix(calendar): honor group view defaults for linked guests；生产备份与服务器部署已提出本次授权请求，批准前LIVE_RELEASE_VERIFIED=false。体验版尚未上传，手机证据待后续同构建复核。
- 应用提交6914bf68。按现有runbook另立chore(release): refresh group preference source proof，记录e573f842工作台blob及两轮明确行为变更，图标/动作证据经只读复评通过。门禁与保护文件范围沿用原规则。
- 最终全Mini1384通过、23既有跳过，197文件通过/4文件跳过，163.68秒；血缘定向17通过。Web类型检查、连续性3项及测试发现政策3项通过。此前清库与旧证明失败均保留在本记录，最后复测通过。本轮停止于提交推送，唯一下一任务为获本次授权后备份部署配套API，之后同构建体验版验证。

## 生产部署预检，2026-11-07

- 用户已明确授权先备份生产数据库、再部署更新。L4检查通过，独占general-4，Acquire/ReuseOnly/release Bootstrap仅增量重建client-core，工作区依赖安装0。成功fetch确认origin/main为70c06dcb，Schannel首次TLS失败后使用已记录的单进程OpenSSL路线成功。
- 正式路由经双独立DNS、可信主机密钥及HTTPS证书/健康检查验证。预检实时live为4540736baba42ee324e06d2a9a0f3f80fc410554，作为本轮回退候选；manifest及current-release一致，保留归档存在且两个归档SHA256通过，MySQL容器运行约六周且健康。
- 8项定向、全量format:check、git diff --check及候选安全检查通过，冻结70c06dcb。pnpm ecs:package完成API/Web及共享生产构建；构建/归档/API平铺缓存均未命中，正式打包器从现有本地缓存物化131个运行依赖、下载0。未调用依赖安装命令。
- 完整生产预检在nginx配置哈希检查失败。只读比较确认唯一差异为aitool站点新增`location ^~ /pregnancy/`，转发既有原生服务，设置70m请求体上限、透传设备认证、关闭请求缓冲及300秒读取超时。该12行现存配置尚未纳入仓库和live manifest。
- 当前域名健康ready=true，现有网站在运行。按生产门禁，发现配置不一致后停止外部变更，尚未执行数据库备份、上传发布物、updater或release身份同步。准备好的70c06dcb发布包留在ignored warm槽位runtime，未用于覆盖现场。
- 已向用户请求授权，将该现有路由纳入发布配置并保留访问后继续原备份部署。唯一下一任务为取得该范围授权、完成最小纳管及验证，再重新发现实时live作为回退前驱、先备份后部署。未经重新预检不得继续使用本轮旧观察作为永久默认。
- 记录检查点消息docs(audit): record gateway drift blocking calendar deployment。仅文档记录已完成预检事实，部署因配置漂移受阻，收口记录不触发服务器发布身份同步。候选租约已正式释放，报告使用新独占租约复用八个producer。

## 现有独立工具路由纳管并继续部署

- 用户确认pregnancy属于另一个工具，授权简易修复并继续备份部署。该路由位于aitool TLS虚拟主机，小程序API使用hosp.schedule虚拟主机；本次只补录服务器已有12行配置，完整配置归一化后与本轮实时服务器快照一致。
- 基线a3aceebe，独占general-4，Acquire/ReuseOnly/release Bootstrap八项复用，安装0。新一轮双DNS/主机密钥/TLS路由验证通过，实时live仍4540736b，记录MySQL容器身份用于部署后比较。服务器nginx -t通过。
- 共享网关2cb92de9引入后，另一工具在服务器新增路由但未进入仓库，本轮未追溯其外部修改提交。git log -S及blame确认原网关来源。新回归先因路由缺失失败，再补录后共享网关/权限/发布包36项通过，ESLint、格式、diff及core smoke、连续性3项通过。
- 逐项保留上游路径末尾斜杠、设备认证头、Host及转发头、70m请求体、关闭请求缓冲、300秒超时；排班虚拟主机配置逐字保留。只读复核与生产发布继续执行，原业务1384项及实库偏好证据按应用输入未变复用。
- 应用检查点消息fix(infra): preserve existing pregnancy gateway route。提交推送后从实时live重新冻结回退前驱，创建并验证生产备份，再按正式updater部署配套日历API和已纳管网关配置，最后完整生产校验及两个工具入口复核；结果在本节补记。
- fdfce1f1已提交并正常推送main，独立只读复核确认配置与现场一致、排班虚拟主机逐字一致、现有代理语义全部保留。正式候选安全检查通过，打包完整构建API/Web、共享包和部署脚本；API运行依赖缓存命中，无下载或工作区安装。
- 22:30重新实读并冻结live4540736b，先调用已安装备份控制，得到70c8e975-0d1d-4ff4-b680-75cc70ced5fe，58表、107414323 B；独立读取文件校验大小及SHA256 8f0e80f3…通过。既有保留策略淘汰1份旧归档。
- 上传包、脚本、manifest逐文件SHA与LF/语法、schema72范围、live回退前驱及当前nginx与新manifest一致性均通过，再执行正式updater。API/Web重建，首两次启动健康探测502后正常ready=true，发布fdfce1f1成功。既有留存控制清15条过期成功作业，失败0；原始隐私及遥测删除0，无业务数据写入。
- 独立完整生产verifier含公网IP主动探测通过，内容哈希、控制面、权限隔离与AI预算通过。MySQL容器身份部署前后相同；pregnancy健康入口200，实际部署的CalendarQuery包含includeView及群组默认视图读取。没有使用真实个人会话或执行排班写入，小程序手机效果仍待新体验版。
- 收口前再备份187e525f-b959-42e3-9560-7789cd04e395，58表、107416997 B，独立大小及SHA256 7b02fe88…通过；按既有策略淘汰1份旧归档。收口文档消息docs(audit): close calendar preference production deployment；以新独占租约复用八producer及已验证应用证据，提交推送后按可信哈希复用同步最终release身份并复检，不重启应用或再迁移。本轮停止于身份同步验证通过，唯一下一任务为小程序体验版上传及同构建复核。

## 体验版上传与放行，2026-11-07至08

- 用户明确授权上传并放行。起点b005b078与fresh origin/main一致，独占general-4，REUSE_ONLY/release Bootstrap八producer复用。最新已上传权威receipt及远端tag均为230@3367879，生产实时b005b078、原白名单verify通过。版本尚未分配，凭证存在且位于仓库外。
- format/lint/build/typecheck/图标及Mini全量1384通过、23既有跳过。首轮Codex工具测试82通过/1断言失败，隔离文件16项和整组83项复测通过，未改工具代码或运行真实安装。后续根Vitest1451通过/1失败/494数据库环境跳过，唯一失败为旧隐私静态测试对另一工具的proxy_add_x_forwarded_for作全文件断言。
- 该断言来自4f1047c8，fdfce1f1纳管现存独立工具路由后暴露范围错误。测试现明确排除aitool虚拟主机，仍要求排班主机存在、默认/排班四个隐私日志、remote_addr单代理转发、禁止追加来源和日志敏感字段。业务与网关运行配置逐字保留。原断言先红，修正后隐私5项及网关19项通过，ESLint/格式/diff通过，独立只读复评通过。
- 校验修正检查点消息test(infra): scope privacy checks to Schedule gateway。推送后按相同应用哈希及生产备份规则同步检查点身份，再冻结上传候选，完成正式分配/构建/Manifest绑定/上传及只增放行。用户原有备份部署及本次放行授权继续适用。所有失败日志保存在ignored runtime中，不称单次verify全绿。
