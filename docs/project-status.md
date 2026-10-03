# Project Status

## 当前批次：全面审查问题逐项修复（2026-10-03，已批准服务器上线，发布门禁补齐）

- 用户已确认状态文字颜色及作业成功30天/失败90天留存；FULL-09/14外部值班接口未改。详见[修复轮次](audit/full-fixes-20261003.md)。
- 基线main/origin/main 6c153f7b；独占general-3、REUSE_ONLY/Bootstrap，安装0。访客36项、Mini全量1366通过/23既有跳过；生产包审计通过，总包减少75571B。
- 健康/共享读取/角色事件/分批历史/通知租约/留存/流式备份及恢复已实现，隔离真实MySQL与单元51项通过；正确旧health与锁边界已验证回归红。迁移0071仅本地合成库验证，尚未部署。
- FULL-12历史超时本轮未复现，已测Babel1268ms并增加诊断，不宣称根治。压测入口强制专用库与marker、消息关闭，补密集非空日历；完整pnpm verify通过（Mini1366/23跳过、根1388/488跳过、Codex83）；真实夹具1820排班/3月/20人/联系人/事件及load:build通过。批准颜色桌面复测一致，不代表小米14验收。
- 修复03ff9635（`fix: bound caches backups and background job load`）已正常推送任务分支及main。独占干净候选由正式分配器分配并Node上传`.228@03ff963`；Manifest c4370eb3…，永久tag/receipt及版本绑定候选检查通过。未提审/正式发布，未连接生产；新版本allowlist尚未追加，不能宣称该体验版已可线上使用。
- 收口9c748c65已推送；用户本次明确批准服务器优化上线及体验版放行。实时只读核实live dbe352886ff425401586da187054bdd7a488dfcc，尚无生产写入。预检发现发布兼容门禁仍仅登记schema70：31553474引入该分支，03ff9635新增0071时遗漏更新。现仅登记已审阅schema71/71，未知71/72继续拒绝；旧实现新增回归1红，新版7项定向通过，格式及diff检查通过，应用验证复用。
- 发布门禁检查点消息`fix(release): register bounded jobs schema 71`，general-3新独占REUSE_ONLY/release Bootstrap，无安装。唯一下一任务/停止条件：推送门禁检查点，冻结干净候选；再次核实实时live、先生产数据库备份，再完整部署/迁移/生产验证及仅追加放行228。保留真机/容量/FULL-12缺口，不改外部接口或扩大外观。

## 上一批次：小程序、服务器与数据库全面审查（2026-10-03，已交付审查；容量/真机缺口保留）

- 用户批准的只读生产/本地审查完成可执行部分，详见[总报告](audit/wechat-miniprogram-audit.md)。未改业务源码/接口/Schema/生产配置，未上传、部署、线上压测、运行备份/清理或真实通知；只提交三个文档。
- 基线main/origin/main为92d5bb7d；独占general-3/4/5/6，REUSE_ONLY/Bootstrap成功、安装0次，原有未跟踪文件保留。生产实读live dbe35288/schema70，迁移70项内容与Git等价（哈希差异均LF/CRLF），最新有效体验版仍`.227@45863f7`，无身份同步。
- 已完成396小程序源码/19路由、204 API及DB/领域TS、产物、服务器/索引/作业/备份覆盖；14项P2机制或风险及候选均分层取证。访客缓存增长、备份全内存、固定ready、读取持锁、冗余产物66463B、状态文字对比等经交叉复核；没有确认当前P0/P1全站故障，不把慢请求归因未测SQL。
- 验证：Mini单次1346通过/28跳过且导出beforeAll超时，隔离5/5通过，合计1351执行通过/23原有跳过；production verify/类型/lint/格式/图标通过。总包3964483B/主包1184234B，独立构建2853ms。API build/typecheck/lint及336项通过、470项MySQL环境跳过；桌面UI32组、CPU合成四象限完成，均非手机/生产容量。
- 生产约34小时41分970个完成请求无5xx，有多接口共同慢窗口；外部同步7天97失败/6196成功且后续成功。Docker Inference manager故障阻塞真实MySQL/锁等待/连接等待/四象限；当前构建原生性能、小米14及备份恢复演练暂未验证，不重置Docker或编造通过。证据ignored runtime/audit/full-review-20261003/，详见各分工报告/JSON。
- 文档检查点消息`docs(audit): assess mini app and production capacity`；应用输入未改，按文档范围复用应用证据，定向文档6项、`pnpm format:check`、`git diff --check`、`pnpm smoke:check-core`通过；未涉及核心链路，无需浏览器冒烟。仅文档，不触发生产部署或备份。唯一建议下一修复批次与审计状态一致：FULL-01/02访客缓存月份/字节预算与逐月校验；本批停止于审查交付，不自动修复或扩大范围。

## 上一批次：护士列表响应与翻月电话图标（2026-10-01，已完成）

- 用户确认小米14`.226@67d2fff`首次和重复切列表均约500ms、医生不明显，护士翻月电话图标晚出现。以最新origin/main 0c5cf4fa为基线；.225/.226日历逻辑一致。独占general-2、REUSE_ONLY/Bootstrap复用，无安装，canonical已有用户文件保留。
- 已实现：屏幕外整卡只保留日期/等高框及业务来源，删除逐人员占位传输；三月首屏按高度准备；同日同班种状态仅本次建模内复用。电话沿用生成SVG与44/20px几何，通过构建内嵌至WXSS随按钮绘制，拨号权限/数据/操作不变，无API或持久缓存改动。
- 基线42项/typecheck/lint/build通过，构建1937ms，总包3963756B、主包1183507B。7项新回归先红后绿，定向49项通过；护士合成节点3899→943、列表数据115628→39298B，首次访客桥传输128331→51731B；20组桌面高度/像素对比全为0差异。Agent两页WXML/WXSS编译通过，运行连接/缓存未对齐，当前代码的运行耗时与手机无感暂未验证。详见[轮次报告](audit/calendar-list-response-20261001.md)。
- 完整pnpm verify通过：Mini1351/23跳过、根1368/476跳过、Codex83；production verify（8191ms，预算/确定性）、图标、格式/lint/build/typecheck、干跑/lineage/core smoke通过。保留既有manual1513节点预算提示；未改变Web/契约，不要求浏览器核心冒烟。
- 业务45863f70（`perf(miniprogram): streamline list cards and paint phone icons atomically`）已正常推送任务分支/main。干净同口径构建1827ms，总包3964483B/主包1184234B（均+727B），分包不变；由正式锁分配并Node上传`.227@45863f7`，Manifest9c890ce3…，tag/receipt/版本绑定候选检查通过。
- 用户当次明确批准后，13:54–13:56可信ensure只增追加`.227`，117→118且全部旧版本保留；`.227/.226/.225`200、合法未知426，独立policy verify及完整生产verifier通过。实时live前后dbe35288，MySQL容器身份相同；配置控制重建API/Web，无应用部署/迁移/备份或服务端Git身份同步。收口消息`docs(audit): close nurse list response trial delivery`，独占general-3/REUSE_ONLY，文档范围复用应用门禁。
- 用户完成确认（2026-10-01）：交付`.227@45863f7`后回复“确认，切换已较前流畅，该任务完成。”沿用前述小米14体验版上下文，记录为用户定性确认切换改善，本批次已完成；不据此填写实测毫秒数或“完全无感”。电话图标同步、快滚及各入口未单独反馈，基础库/微信版本/renderer未补充，保留测量边界，不作为本批次继续待办。
- 交付时general-2曾因开发者工具文件监听器被正式release拒绝，官方关闭aborted，候选保留；本次不重试或强制回收。验收检查点消息`docs(audit): record calendar list acceptance`；独占general-3、REUSE_ONLY/Bootstrap，无安装，定向文档6项、`pnpm format:check`、`git diff --check`、`pnpm smoke:check-core`通过，复用应用证据。唯一下一任务及停止条件：本批次无剩余必需工作，等待用户新指示；通讯录首搜仍暂缓等待用户数据。本次仅文档，不连接生产或重新上传。

## 上一批次：列表末尾间距与通讯录首搜诊断（2026-10-01）

- 用户确认小米14截图来自`.225@f9457d5`，首页/访客列表末卡紧贴导航；通讯录等待发生在输入关键词后。独占general-1/61e5f18f，REUSE_ONLY，无安装，保留canonical用户文件。
- 间距已实现：9045dc02迁移padding时漏掉底部，成员/访客共用内容补8px；桌面320/390宽×两安全区×两页8场景0→8px先红后绿，Agent工具两页WXSS编译成功。Mini全量1344通过/23既有跳过；production verify/预算/确定性、格式/lint、图标、干跑/lineage/core smoke通过。干净同口径总包3963716→3963756B（+40B）、主包1183467→1183507B，最大文件不变。详见[轮次报告](audit/calendar-footer-directory-first-search-20261001.md)。
- 用户确认拼音/数字键盘确认，已排除500ms汉字自动等待；两模式确认无需等待facets。产物无测试工具路由（e6ef714b），不按旧菜单取证、不恢复入口。用户当次批准只读生产诊断：2026-10-01 10:47–10:59核实live dbe35288、candidate配置及覆盖索引完整；API/Web窗口只有各7次两种facets，没有搜索样本，查询摘要关闭。8个只读EXPLAIN使用现有索引，拼音候选聚合/排序需进一步实测；不据估算宣称首搜原因或提速。
- 根format/lint/build/typecheck与pnpm test通过（Vitest1368/476跳过）。修复67d2fff0（`fix(miniprogram): restore calendar list footer spacing`）正常推送任务分支/main；独占干净候选由正式锁分配并Node上传`.226@67d2fff`，Manifest3851c9c1…，版本绑定检查通过。按用户本轮“先放行226”授权，11:51–11:57可信控制只增追加，116→117版本且全部旧版本保留；`.226/.225/.224`200、动态未知426，独立policy verify和完整生产verifier通过。live前后dbe35288，配置控制重建API/Web，无应用部署、备份/迁移或服务端Git身份同步。
- 放行记录检查点消息`docs(audit): close footer trial allowlist verification`；general-2新独占租约REUSE_ONLY/Bootstrap复用，定向8项通过，无安装。唯一下一任务及停止条件：对齐用户`.226@67d2fff`退出重进后的两次搜索、完成时间与服务器日志，取得首搜耗时后选择最小补丁；同构建两页末尾间距待手机复核。无证据不写首搜已优化或验收通过，不提审/正式发布。

## 上一批次：访客列表空白与日历切换响应（2026-10-01）

- 用户确认小米14体验版.224切到列表会空白，重复切换同样发生；当前批次只修首页/访客展示边界，保持业务、请求验证、路由、样式和操作。独占general-1，5804695a基线，REUSE_ONLY/无安装；general-2独占测同一合成基线。
- 已实现：访客视图/内容一次提交、保留有界列表状态、屏幕外紧凑行与原子补齐、首屏覆盖/纵向预热/回调合并、仅本次建模状态去重。新增14项测试，其中13项回归先红后绿、1项记录成本；Mini1342通过/23跳过（verify导出夹具超时，独立5项补跑通过），根1368/476、Codex83通过；格式/lint/build/typecheck/图标、production verify、预算/确定性/干跑/core smoke通过。最终干净同口径总包+2408B，Node护士首次578492→128331B、重复566364→21B。详见[轮次记录](audit/calendar-view-latency-20261001.md)。
- 业务68362803与独立canonical proof f9457d5d已正常推送任务分支/main；AST仅createViewPatch变化、其余148函数不变，17项lineage通过。干净候选`.225@f9457d5`已由Node上传，Manifest5d53ba0b…；按用户当次授权只增放行，`.225/.224`200、动态未知426、完整生产verifier通过。live前后dbe35288；配置控制重建API/Web容器，无应用部署、数据库迁移/备份或服务端Git身份同步。收口消息`docs(audit): close atomic calendar switch trial delivery`，复用应用证据，文档一致性3项/core smoke/差异检查通过。
- Agent工具编译和首页合成1800行/120姓名切换通过；访客探针超时后连接授权超时，用户报告工具卡死并手动关闭，真实访客运行与手机帧时间暂未验证。当前为待用户复核；唯一下一任务/停止条件：小米14退出重进`.225@f9457d5`复核首页/访客首次及重复月周列表、快滚、翻月、定位、筛选与电话；无同构建实体证据不写无感/验收通过，不进入其它重构，不提审/正式发布。

## 上一批次：主目录文件恢复与继续开发验证（2026-10-01）

- 用户明确授权恢复。独占warm general-1/REUSE_ONLY，未安装依赖；canonical原dbe35288，备份现场后仅恢复1344个已跟踪删除，再正常快进至最新c460520f；1939个已有跟踪路径齐全，181个保留文件哈希不变，近期功能保留。
- 原Git提交图缓存异常已备份并重建，常规fsck和commit-graph verify通过；173个恢复文件内容逐个等于index，刷新旧状态缓存后跟踪工作树干净。未知未跟踪删除不能保证找回，CCleaner原因未证实。根node_modules不安装/复制，后续开发复用正式warm槽位。
- 验证：ReuseOnly/root bootstrap和14项定向通过；格式/lint/build/typecheck/图标通过。月初凌晨暴露2项既有测试月口径不一致，定位9e3a966c/528722f4，仅测试复用值班日、局部固定Date；旧口径2红→31绿。最终Mini1328通过/23跳过、根1368通过/476跳过、Codex83通过、文档/发现范围9项和core smoke通过；首轮verify失败后续跑剩余阶段，不伪称单次全绿。详见[恢复记录](audit/source-recovery-20261001.md)。
- 本地恢复/开发验证已完成；检查点消息`test(miniprogram): stabilize duty-month checks after source recovery`，Git/ignored交付回执核对正常推送、canonical同步与租约释放。唯一下一业务待办仍为`.224@c0c1463`的小米14同构建日历复核；无实体证据不写无感/验收通过。本轮不触及生产或新体验上传，后续开发按正式warm路线复用依赖。

## 上一批次：日历列表切换卡顿（2026-09-30）

- 独占general-6，REUSE_ONLY、未安装依赖，基线dbe35288；已证实三月人员节点一次性创建和隐藏视图重复建模。首页/匿名访客共用按屏幕范围补齐人员内容，保留日期、行高、顺序、联系方式、筛选、定位与翻月；缺API、异常或大字号回退完整渲染。
- 验证：新增15项回归（旧代码3项失败、换群迟到回写另先红后绿）；最终Mini1328通过/23跳过；完整pnpm verify、production verify、包体/性能预算/确定性、上传干跑、core smoke通过。Node合成护士首次列表节点24059→3899，医生3899→1127；手机帧时间与无感切换暂未验证。未绑定版本总包3955038→3963165B。详见[轮次记录](audit/calendar-list-switch-20260930.md)。
- 检查点消息 `perf(miniprogram): defer offscreen list content and scope calendar rendering`。用户当次说明工具内版本须放行：将最终干净候选分配新不可变体验版并只增放行，不放行local、不部署API/Web应用或迁移数据库。旧账号/30天功能包含在候选中。
- 业务0848a3da已正常推送任务分支/main；上传在分配前被旧首页proof阻断，未占用版本。按正式pitfall新租约general-1刷新canonical blob，7个批准函数变化、其余142和受保护导航/手势方法不变，44定向/图标/production verify通过。独立检查点消息`chore(release): refresh calendar performance lineage proof`。主目录删除仍保留，CCleaner可能原因尚无日志证明。
- 交付：`.224@c0c1463`已上传（Manifest7acf6472…）并只增放行，`.224/.223`=200、合法未知probe426，完整生产verifier通过。live前后dbe35288，未部署API/Web应用、迁移/备份数据库或同步服务端Git身份；配置控制重建容器，旧版本保留。文档收口消息`docs(audit): close calendar list performance trial delivery`，不重新上传文档SHA。
- Agent开发者工具最终label匹配：首页真实护士/医生ready，坐标点击月/周/列表、定位今天和筛选辅助验证通过；护士672行/78姓名，筛选43行。两页WXML/共享WXSS编译通过。匿名实际访客码、快滚帧时间、小米14暂未验证。唯一下一任务：小米14退出重进`.224@c0c1463`复核首页/访客月列表周、快滚、定位、翻月、筛选与联系方式；无实体证据保持待用户复核，不提审/正式发布。
- 用户确认主目录删除非主动整理，随后说明运行CCleaner健康检查/自定义清理；只读调查1344删除，时间约22:13，无删除路径日志/进程归因，CCleaner可能但未确认。现场/缺依赖保持原状，未恢复/安装；main从槽位快进推送，canonical HEAD未改，源码在Git和warm完整。候选已关闭工具/释放；独立文档租约general-1收口后释放。
- 收口文档4a564da8已正常推送main；末次检查校正STATUS中实现阶段的“仅合成”旧句，明确最终真实首页已复核、匿名访客/快滚/实体仍待证据。文档校正消息`docs(audit): align calendar runtime verification status`，差异仅文档，已逐行核对及core smoke；`.224`及生产身份不变，不触发部署或重复上传。

## 上一批次：账号活跃详情、访客30天与小程序全量审查（2026-09-30）

- 用户批准的完整计划已实现；独占general-6、REUSE_ONLY、无依赖安装，基线aaaf6b36。账号详情按点击请求，成功会话登录/前台打开分开统计，UTC+8自然日，事务去重；迁移0070两表，回执及访客30天，累计摘要保留。
- 全量扫描748文件并人工复核模块热点；修复账号列表竞态、过滤30个无入口独立输出并保留源码/诊断。总包4445519→3955037 B（-11.03%），主包1673804→1172930 B（-29.92%）。详见 [轮次记录](audit/account-activity-retention-20260930.md)。
- 验证：完整pnpm verify、真实MySQL独立99项、Mini1313通过/23跳过、Codex83项、浏览器七阶段冒烟、production verify/确定性/上传干跑通过；开发者工具账号WXML/WXSS编译通过。Docker重启阻断已解决；手机性能/小米14验收暂未验证。
- 交付：应用31553474已正常推送main并生产部署，schema70、30天访客/回执过期数0、完整独立verifier通过；体验版.223@3155347（manifest b171c2f1…）上传并只增放行，.223/.222=200、未知426。部署前误认updater会备份数据库而漏建新备份；已有f84ddfca…保留，部署后补备份4f1a4747…（57表），偏差详见轮次记录。收口文档消息 docs(audit): close account activity and 30-day retention delivery，按授权执行先数据库备份再内容哈希复用同步生产身份。
- 开发者工具：最终构建首页/账号/带群组访客页ready，手动排班editor；账号详情处理器展开7字段并收起，selector点击未证实，不代替手机。唯一下一任务与停止条件：小米14退出重进.223同构建复核详情、登录/前台计数、30天访客及核心路径；取得用户实际证据前为待用户复核，不提审/正式发布。

- 文档比例校正：主包按同口径字节复算为29.92%，字节数/业务代码/体验版不变；前一收口c788174e已同步。检查点消息 docs(audit): correct main package reduction percentage，仍按授权先备份再哈希复用同步，唯一下一任务保持小米14同构建复核。

## 上一批次：全部 warm 槽位恢复（2026-09-30）

- 用户明确授权本地恢复全部7个注册槽位，进入固定锁文件离线维护；基线 origin/main `d888d54a`。Windows版本指纹变化是本次依赖阻断原因，不因新对话安装依赖。
- 原 general-3 脏工作树完整保留在 ignored external-project-worktrees；原 general-4 分支已合入主线、无进程，通过官方入口释放旧租约。canonical 用户文件保留。
- 修复非JSON维护丢失下载计数输出；经严格输入、健康与离线命令核验，可收口已完成安装而无需第二次安装。引入点 `fa10d5ba`；回归先红后绿、定向16项及 Codex guard 全量83项通过，core smoke判定未涉及应用链路。详见 [恢复记录](audit/warm-pool-recovery-20260930.md)。
- 修复检查点 `feeed8e8`（`fix(codex): preserve offline maintenance evidence and finalize completed installs`）已正常快进推送 main；7槽逐槽35项验证通过，释放代码租约后全池实测7/7 free/detached/clean/compatible、无租约与进程。收口文档提交消息 `docs(audit): close all warm slot recovery`，文档收口再次申请时直接复用8个共享 producer，未安装。
- 当前维护批次已完成，收口后释放文档租约。唯一下一任务与停止条件：恢复已批准的账号活跃详情、访客30天留存与小程序全量审查批次；本维护批次不代表业务功能已完成。未连接生产，未上传小程序。

## 上一批次：点击一条「已读」后其它「已读」按钮闪烁（2026-09-30）

- 范围：仅微信小程序通知面板模板 + 回归测试 + 文档；独占 warm `runtime/wt/general-6`，REUSE_ONLY，无依赖安装；基线 `origin/main` = `d8fe49bd`（含并行轮次的文案精简 `99c67b8b` 与体验版 `.221`，未覆盖对方改动）。
- 已修复：独立通知页每行「已读」的 `disabled` 由 `actionBusyId !== '' && actionBusyId !== item.id` 改为 `actionBusyId === item.id`（与 `loading` 同条件）。原条件对“其它行”仍为真，等于继续禁用它们——上一轮按“允许按压反馈”的改写方向写反，所以现象没有消失。现在只有正在保存的那一行变灰转圈，其它行保持正常外观与按压反馈；控制器并发守卫仍在，不会发起第二次请求。契约/API/数据库未改。
- 引入点与机制：过度禁用源自 `1a428d73`（`304d742f` 沿用）；`ui-button` 的 `is-inactive` 把“白底 + 浅蓝描边”换成“浅灰填充 + 弱化文字 + opacity .72”，因此任一已读请求都会让其余「已读」按钮换色再恢复，即用户看到的“填充快速闪过”。
- 验证：回归先红后绿（`1 failed | 34 passed` → `35 passed`）；Mini 全量 1308 通过/23 跳过；typecheck/lint/format/production verify（包体 4,446,633 B、manifest `d2036fe1…`）通过；`smoke:check-core` 判定未涉及核心链路。详见 [轮次记录](audit/notification-read-button-flicker-20260930.md)；上一轮的更正说明已补进 [read-all 轮次](audit/notification-readall-flicker-20260930.md)。
- 交付（2026-09-30 用户当次授权）：候选 `025eef76` 由 Node `miniprogram-ci` 上传体验版 `0.1.0-p10.20260930.222`（manifest `de82259b…`、tag `miniprogram-trial/0.1.0-p10.20260930.222`、receipt 在 ignored `runtime/audit/miniprogram-trials/`）；可信控制 `schedule-client-version-allowlist ensure` 只增追加（`.218`–`.221` 保留）且重复 ensure 幂等，`verify` 与完整 `ecs-verify.sh` 通过。放行前后 live release 均为 `5f25d946`（schema 69）：Mini/文档范围未部署应用、未备份/迁移数据库、未提审、未正式发布。
- 唯一下一任务与停止条件：小米 14 退出重进同构建体验版 `.222@025eef7` 复核“点一条通知的「已读」后，其它「已读」按钮完全不闪、按下仍有反馈，被点的那条自己转圈”；取得同构建真机证据前不写验收通过。

## 上一批次：通知设置页文字精简（2026-09-30）

- 范围：仅微信小程序通知设置面板模板/样式 + 回归测试 + 文档；独占 warm `runtime/wt/general-6`，REUSE_ONLY，无依赖安装；基线 `origin/main` = `34cb6475`。
- 已实现（用户截图红框）：删除设置页小标题“提醒节奏”与「微信提醒授权」卡片底部整段说明，并清理无引用的 `.audit-note/.audit-mark` 样式；每行状态文字“本次已授权 · 点此重新授权”继续承载重新授权入口，功能不变。
- 验证：`notification-shared-presentation` 与 `p9-notification-settings-native` 断言同步更新，受影响 4 文件 42 项通过；Mini 全量 1308 通过/23 跳过；typecheck/lint/format/production verify（包体 4,446,656 B、manifest `7619a5f6…`）通过；`smoke:check-core` 判定未涉及核心链路。详见 [轮次记录](audit/notification-kind-switches-20260930.md)。
- 交付（2026-09-30 用户当次授权）：体验版 `0.1.0-p10.20260930.221`（manifest `aff139e9…`）已上传并经可信控制只增放行；`schedule-client-version-allowlist verify` 通过，完整 `ecs-verify.sh` 通过（首次命中 30 天遥测保留竞态，按既有做法运行一次已安装保留控制后通过）。Mini/文档范围未部署生产、未备份/迁移数据库，live release 仍为 `5f25d946`（schema 69）；`.218`/`.219`/`.220` 放行状态不变。
- 唯一下一任务与停止条件：小米 14 退出重进同构建体验版 `.221@99c67b8` 复核设置页只剩标题/字段/开关、两处红框文字已消失且“点此重新授权”可用；取得同构建真机证据前不写验收通过，未获当次授权不做生产部署或提审。

## 上一批次：通知中心“全部已读”闪烁修复（2026-09-30）

- 范围：仅微信小程序通知面板模板 + 回归测试 + 文档；独占 warm `runtime/wt/general-6`，REUSE_ONLY，无依赖安装；基线 `origin/main` = `2191b136`。
- 已修复：点击任一通知时，“全部已读”按钮不再闪动。引入点为 `304d742f`（嵌入通知 Sheet）把该控件的可见禁用样式绑到“任意操作”`actionBusyId !== ''`；现改为只在该控件自己的操作进行中生效（嵌入 Sheet `actionBusyId === 'all'`，独立通知页 `disabled="{{actionBusyId === 'all'}}"`）。控制器并发守卫、请求、未读计数与 `unreadchanged` 事件未改；契约/API/数据库未改，无迁移。
- 追加（用户指示“允许按压反馈”）：独立通知页每行“已读”按钮改为 `disabled="{{actionBusyId !== '' && actionBusyId !== item.id}}"`（只有保存中的那一行变灰），嵌入 Sheet 卡片与“全部已读”的 `hover-class` 改为固定 `is-pressed`；点击反馈只由手指触摸驱动，重复点击仍被控制器守卫吞掉。取舍：请求窗口内其它行的 `aria-disabled` 会读作“可用”，已在轮次记录登记。
- 验证：两条回归用例先红后绿（其中一条回退模板复跑 `1 failed | 34 passed`）；`notifications-controller` 35 项、Mini 全量 1308 通过/23 跳过（基线 1306/23）、typecheck/lint/format/production verify（包体 4,447,507 B、manifest `91589cee…`）通过；`smoke:check-core` 判定未涉及核心链路。详见 [轮次记录](audit/notification-readall-flicker-20260930.md)。
- 交付（2026-09-30 用户当次授权）：候选 `939c1d5f` 由 Node `miniprogram-ci` 上传体验版 `0.1.0-p10.20260930.220`（manifest `2d9a5e89…`、tag `miniprogram-trial/0.1.0-p10.20260930.220`、receipt 在 ignored `runtime/audit/miniprogram-trials/`）；可信控制 `schedule-client-version-allowlist ensure` 只增追加，重复 ensure 幂等，`verify` 与完整 `ecs-verify.sh`（`ECS_PUBLIC_IP=120.77.220.79`）通过。放行前后 live release 均为 `5f25d946`（schema 69）：Mini/文档范围未部署应用、未备份/迁移数据库、未提审、未正式发布。
- 用户真机复核（2026-09-30）：小米 14 同构建体验版 `.220@939c1d5` 按交付步骤复核后回复“通过”，本轮“点击通知时全部已读闪烁”记为已通过同构建真机验收。用户未附截图/基础库/微信版本记录，故不外推到 iOS、其他安卓或全平台；`.216`、`.218`、`.219` 等历史检查点的待复核状态不受影响。
- 唯一下一任务与停止条件：本轮无待办，等待用户下一次反馈或新需求；未获当次授权不做生产部署、上传或提审。若要继续处理历史待复核项，按各轮次记录在小米 14 同构建下复核后再更新结论。

## 上一批次：按类型微信提醒开关 + 开关响应速度优化（2026-09-30）

- 范围：仅微信小程序通知设置页 + 文档；独占 warm `runtime/wt/general-6`，REUSE_ONLY，无依赖安装；基线 `origin/main` = `2cd6e088`。
- 已实现：删除“接收微信提醒”总开关与相关状态/处理器；只保留 5 个按类型开关，打开某类时申请该类订阅授权并下发完整 5 类偏好 + 打开服务端总闸，关闭时只写该偏好；历史“总开关关闭”状态按全关呈现，打开任一类只开启该类；保存中只在该行显示 loading，仅未配置模板的类型永久禁用。
- 追加（同日）：开关点击后**立即上屏**（乐观绘制、失败回滚）；同一页面会话内已授权的类型反复开关**不再弹窗、瞬时生效**；行状态文字改为“重新授权”入口（一次性额度用完后可手动补授权），说明提示可勾选“总是保持以上选择”。
- 验证：`notifications-controller` 33 项、`workflow-switch-feedback` 23 项、Mini 全量 1306 通过/23 跳过、typecheck/lint/format/production verify（包体 4,447,547 B、manifest `39841506…`）通过；`smoke:check-core` 判定未涉及核心链路。详见 [轮次记录](audit/notification-kind-switches-20260930.md)。
- 体验版 `.218@8ec20dd`（只保留按类型开关）与 `.219@19e16565`（即时上屏 + 会话内复用授权）均已上传并按用户当次授权只增放行，白名单 `verify` 与完整 `ecs-verify.sh` 通过；Mini/文档范围，未部署生产，live release 仍为 `5f25d946`（schema 69）。
- 唯一下一任务：小米 14 退出重进同构建体验版 `.219@19e16565` 复核“点击立即上屏、同会话反复开关不弹窗、状态文字可重新授权、5 类独立开关无总开关”；取得同构建真机证据前不写验收通过。

## 上一批次：六项小程序缺陷修复 + 按类型微信提醒（2026-09-29）

- 范围：仅微信小程序视觉/交互 + 必要的共享包与 API 改动；默认 REUSE_ONLY，独占 warm `runtime/wt/general-6`，未安装依赖；基线 `origin/main` = `9b13dc8e`。
- 已实现：①请假日期边界改用中国日历日（修 5/1 请假误报 4/29 班次、补齐末日漏检；同口径修正可用性、审批预览、撤销守卫与文案）；②周期天数弹层与换班年月选择器共用选中横杠、渐隐遮罩与底部按钮，滚轮数值放大；③删除管理员换班/加扣班弹窗的“直接生效…”胶囊；④`wechatNotificationKinds` 契约 + 迁移 0069 + API 按类型闸门 + 解码器 + 5 个独立开关（保留总开关）；⑤事件时间轴改中文对象名与影响说明；⑥我的页胶囊四周等宽窄内边距并与左标签居中对齐。
- 验证：真实 MySQL 工作流 88 项、手动排班 37 项、迁移 30 项、按类型微信通知用例通过；Mini 1304 通过/23 跳过；typecheck/lint/format/build/图标/production verify 通过（包体 4,442,815 B、矩阵节点 1,513、manifest `d5927312…`）；`pnpm smoke:browser` 全流程通过（本地开发库迁移到 69，仅本地合成平台角色已恢复）。详见 [轮次记录](audit/mini-six-fixes-20260929.md)。
- 既有失败（非本轮引入）：`task10` 的 `calendar.integration.test.ts > excludes drafts and replaced revisions` 在基线 `git stash` 后同样 409 失败，本轮未修改该测试。
- 2026-09-29 用户授权 L4/L3：应用检查点 `5f25d946` 已部署生产（回滚候选 `c59975c4…`、备份 `49236b11-b57e-4994-bca2-5a7b7ce2edec`：56 表/139,505,928 B、schema 69、独立 verifier 通过、公网健康 `ready:true`）；体验版 `0.1.0-p10.20260929.217`（manifest `8a432f75…`）已上传并按可信控制只增放行，验证通过。未提审、未正式发布。
- 唯一下一任务：小米 14 退出重进同构建体验版 `.217@5f25d946` 复核六项修复（5/1 请假不再提示 4/29 冲突、周期天数弹层、管理员弹窗无胶囊、5 个微信提醒开关、事件页中文标识、我的页胶囊对齐）；取得同构建真机证据前不写验收通过。

## 上一已交付检查点

- 换班、请假限制与统计口径统一整改：应用 `c59975c4` 已生产部署（schema68、备份 `d18366a6-582a-4002-bcf8-caa6791477a4`）、体验版 `.216@c59975c4` 已上传并只增放行；小米 14 同构建复核仍待用户证据。详见 [轮次记录](audit/leave-statistics-20260929.md)。
- 外部值班校对：生产 release `bc59dfbf`（前驱 `9715e88f`/`06d420a1`/`193ae653`）与体验版 `.215@1eb92e5` 已交付并由用户授权 add-only 放行，schema67/68 已迁移；本轮把它合并进 main 以消除主线与线上分叉。其交付记录见 [UI 轮次](audit/external-duty-ui-20260928.md)、[发布基线设计](superpowers/specs/2026-09-28-external-duty-published-baseline-design.md) 和调试日志 `EXTERNAL-DUTY-PREVIEW-001`；小米14同构建仍待用户复核。
- 通知最近30天：应用 `8bb3c6e4` / 体验版 `.212` 已在上一轮部署、上传和追加放行；文档检查点 `45bf7bec`。本轮未重新验证线上身份，不能用历史记录代替实时回滚基线。见 [通知轮次](audit/notifications-retention-30days-20260928.md)。
- 历史工作流最近30天 `.211`、联系方式 `.210`、历史显示 `.209`、日历 `.208` 等已交付记录位于 `docs/audit/` 和 Git 历史。所有缺少同构建手机证据的项目继续保持“待用户复核”；不重复历史生产操作。
- 长期事实来源：`docs/superpowers/plans/2026-08-01-medical-staff-scheduling-system-implementation-plan.md`、对应 design、`docs/agent-context/pitfall-index.json`、`docs/audit/AUDIT_MASTER_PLAN.md`。本轮是用户批准的工作流/统计整改，不进入无关后续功能。
