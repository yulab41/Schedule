# 日历列表切换卡顿：2026-09-30

## 范围与结论

用户反馈：首页和访客页切换列表卡顿，护士群更明显。基线 `dbe35288`，独占 general-6；另借 general-5 对照旧代码，均为 REUSE_ONLY、未安装依赖。WebView、月/周/列表操作、日期、筛选、联系方式、翻月与列表滚动方式保持原有语义。

已证实的主要规模问题是整月三面板同时创建所有人员节点，以及每次切换仍生成未显示的视图。缓存列表切换没有新增排班请求：既有访客运行测试及本轮回归均通过；周视图缺失窗口的验证读取仍保留。没有证据把这次反馈归因为近期某次代码回归或服务器延迟。

本轮只改小程序，不更新 API/Web 应用代码、数据库结构或生产发布身份。检查点消息：`perf(miniprogram): defer offscreen list content and scope calendar rendering`。体验版使用最终干净 SHA 的不可变新版本；不提审、不正式发布。

## 发现、引入点与处理

| 编号/优先级 | 证据与原因 | 处理、风险与验证 |
| --- | --- | --- |
| CAL-LIST-01 / P2 | `workbench/index.wxml`、`guest/guest.wxml` 对三个月份的每一天、每个人员嵌套建节点；合成20人×30天×3个月为24059个列表宿主节点。护士密度与状态标签放大开销。`git log -S 'const listPanels'` 与 blame 定位三面板建模源于 `733e3af6`；护士排序/预设来自 `e94a54ca`。高置信。 | 共用 `deferred-list-rendering.ts`，保留全部日期与人员行外壳；仅延后屏幕外文字、标记、状态与拨号控件。初始每面板前两天及定位目标立即渲染；一屏缓冲范围内自动补齐，单次仅传布尔路径。保留电话按钮44px对应的CSS伪元素高度，避免估算整个日期高度。原生大字号报告>16时回退完整行；无API/观察器异常同样回退。风险为快速跳转补齐时机与大字号平台差异；Node结构/生命周期与开发者工具部分几何验证，手机待复核。 |
| CAL-LIST-02 / P2 | `createWorkbenchViewModel` 无论当前模式都生成月、周、列表；首页 `9ac4a301` 已限制传输可见模式，但仍计算全部。访客 `renderCalendar` 自 `890efd8b` 展开整个view。20人窗口纯模型中位13.322ms、全view JSON883587B。高置信。 | 可选 `view` 范围，仅生成当前视图；默认调用保持完整模型。选择日期仅生成详情，保持原有格子路径更新。访客仅传可见面板并跳过相等字段；首页切换复用既有差量更新。离开列表清掉隐藏列表数据，下次重建轻量外壳。风险为隐藏面板依赖；护士/医生逐模式对照完整模型，核对顺序、标记、电话、边界时间及输入不变，原有翻页/日期/权限测试通过。 |
| CAL-LIST-03 / P2 | 延后渲染引入异步观察回调，必须防止离页或换群后回写。 | WeakMap只跟随页面，隐藏/卸载/换群/换工作区断开观察；校验观察器实例、群组、视图、状态、可见性及稳定日期键。换群但渲染回调未完成的用例先红后绿；无新增定时器、持久缓存或请求。 |

删除/重构边界：不删业务内容或诊断；不改路由、组件架构、接口或排班规则；不引入依赖。接收者仍用成员调用，回调按原生命周期执行；默认模型、排序/空值/电话/筛选/时间边界以旧完整模型作语义对照。修改只围绕上述调用点，无整文件格式化。

## 可比较基线与复测（Node，非手机性能）

同机独占依赖、固定合成数据、固定时间，预热6次再取20次模型样本。运行 ignored `runtime/audit/calendar-switch-20260930/probe.ts` 的esbuild产物；旧代码在general-5，优化代码在general-6。护士20人、医生3人，每月30天，三个月；WXML统计范围仅列表分支，包含三个面板。

| 项目 | 旧代码 | 优化代码 |
| --- | ---: | ---: |
| 护士首次列表节点 | 24059 | 3899（-83.79%） |
| 医生首次列表节点 | 3899 | 1127（-71.10%） |
| 护士模型中位 / P95 | 13.322 / 17.140ms | 11.318 / 15.903ms |
| 医生模型中位 / P95 | 2.226 / 2.628ms | 1.528 / 1.989ms |
| 护士模型JSON全量 / 当前列表范围 | 883587B | 577475B |
| 医生模型JSON全量 / 当前列表范围 | 181749B | 98939B |
| 主包（未绑定体验版本） | 1172931B | 1181058B |
| 总包（未绑定体验版本） | 3955038B | 3963165B（+8127B，约0.21%） |
| 各分包 scheduling / organization / workflows / insights | 432675 / 856423 / 533566 / 959443B | 均不变 |

上述JSON是纯模型口径，不冒充完整Page实际传输；首页此前已限制可见面板，不能把访客全模型的减少套用到首页。丰富人员数据仍在视图模型，未引入第二份大缓存或改变行高。已读过的内容在本次列表期间保留，整月读完后节点会增长；离开列表再进入重新延后。3899仍高于1000理想目标，完整行虚拟化和进一步精简首次数据桥接留作有实际手机证据后的结构方案。

实际构建初始3054ms；独立旧槽位1782ms、复测1442ms，缓存/运行时不同，不据此宣称构建速度收益。包体比较为未绑定版本且优化工作树为dirty（元数据差1字节）；最终版本绑定体积另记，不与这组数直接混算。最大20文件清单取自实际dist，保存在ignored `package-files.json` 并在交付时汇总。

## 验证与工具事实

- 实际读取：仓库 `$schedule-project-guardrails`（hash70fe2e…）、`miniprogram-development`、`systematic-debugging`、`wechatide-skill` 及initializer/compiler/automator/debugger路由规则。使用官方 `wechatide` CLI，无新增依赖或子Agent。
- 基线：Mini typecheck、受影响TS ESLint、定向53项、全量1313通过/23跳过、production build/package通过。新增模型/两页节点回归先在旧代码3项失败，再通过；换群回调边界另有先红后绿记录。
- 已执行完整 `pnpm verify`：格式/lint/构建/typecheck/图标检查、Mini1324项与根1368通过/476跳过、Codex83项通过。其后补充換群回调守卫与大字号回退，最终新增15项、全量Mini1328通过/23跳过；typecheck/production verify再次通过（manifest `d3d4b17f…`）。跳过的数据库/外部用例不记作通过。
- `pnpm --filter @schedule/miniprogram verify`：源码/上传脚本兼容、production构建、包体、性能预算、确定性均通过；Worklet=0。既有手排1513节点warning保持原状；不降低预算。`ci:dry-run`通过。
- 运行/浏览器验证：`pnpm smoke:check-core`通过，未触及Web/契约核心链路，本轮不要求 `pnpm smoke:browser`。
- Agent开发者工具：登录且版本门禁equal；实际调用开/关项目、刷新/打开页面、局部WXML编译、运行evaluate、清编译缓存。首页WXML编译通过。实现阶段dirty工作树的合成护士窗口读到1800行外壳、120个姓名、每行60.6667px、日期1282.6667/1283.3334px；旧合成医生为270行/270姓名、每行60.6667px。只作部分结构/几何支持。
- 非await的早期evaluate、空节点或超时样本均弃用，不纳入前后耗时结论。工具RPC往返不是业务逻辑时间。大窗口旧护士/访客测量出现超时或空节点，不能推断具体渲染耗时；重新启动工具后出现 `wait WechatIDE authorization timeout`。用户回复工具已重启，工具内版本需要放行；`local`构建会被生产拒绝，将用新分配不可变体验版只增放行后复核真实路径，不放行local。
- 官方API文档网页未能读取，不假称已获取其内容。实现阶段尚未取得最终干净体验构建运行；放行后的首页/定位/筛选辅助结果见下方交付收口。帧时间、首屏、小米14与匿名真实访客运行仍暂未验证，无跨平台结论。

## 同构建验收与停止条件

唯一下一任务：在`.224@c0c1463`同构建小米14复核日历切换。护士/医生群分别在首页与访客页执行月→列表→周→月；列表快速滚动、定位今天、翻月、筛选并核对姓名/标记/拨号入口（不拨号），观察空白和跳动。提供同版本标签和实际反馈后才更新手机结论。停止条件：无手机实际证据保持待用户复核，不提审、不正式发布。

主目录现场：交付前发现canonical的apps/packages/tests大量跟踪文件删除，未恢复、未暂存这些变化。完整租约槽位源代码保留；采用槽位提交及正常快进推送，避免覆盖主目录。访客入口`guest-entry/index`只负责读取/扫描访客码并跳转`guest/guest`，该实际日历路径已修改；成员群组访客沿用workbench路径。下一轮主目录路由门禁必须先调查缺文件事实。

用户回复不是主动整理、要求保留并调查。只读调查：1344个跟踪删除，apps子目录时间约22:13:07、canonical node_modules只剩.vite（22:13:36）；本轮工具记录无对应删除调用，现有进程无法归因，PowerShell历史最后更新9月28日无匹配删除、Security4663无匹配事件。维护入口仅删除租约文件，不能据此指认。尚未确定执行程序/原因，不归咎用户或推断恶意；不恢复/安装/清理主目录。缺文件清单及SHA256 `a20e28f0…` 保存在ignored canonical runtime/audit/calendar-switch-20260930。

用户补充刚运行过CCleaner64，列为待证实原因。定向只读查看其portable配置/现有日志：没有指向Schedule或node_modules的Include项；进程/用户/系统TEMP与TMP均未指向Schedule。可取得日志未提供22:13删除路径或进程归因，不因用户提出猜测就写成已确认。未再次执行清理，未改清理配置。

## 上传血缘收口

业务检查点`0848a3da`已正常推送任务分支及main。第一次真实上传在分配前被checkpoint5285dd1源码proof拒绝，未占用版本、未调用微信上传。按`mini-trial-upload-route`正式pitfall释放原冻结租约，再Acquire实际返回general-1（REUSE_ONLY/mini bootstrap，无安装）。在新租约中单独刷新proof为当前committed首页blob`53a315b4…`，保留所有必需检查点、祖先与exact blob门禁。

AST比较旧proof`b91c6cd7…`与0848a3da：149函数中仅7个批准调用点变化（onHide/onUnload/handleViewChange/activatePrimaryWorkspace/setCalendarData/createViewPatch/resetCalendarContext），其余142相同；全部导航/swiper/period commit/定位/滚动方法及另两项图标motion文件不变。不是整文件语义等价声明。现有proof回归先红后绿，6个定向文件44项通过、icon parity与production verify通过。独立检查点消息`chore(release): refresh calendar performance lineage proof`；最终候选以该提交clean SHA分配版本，业务源码仍是0848a3da。

## 最终未绑定版本产物最大20文件（字节）

旧槽位快照总包3953180B，构建身份元数据不同于主表初始3955038B，下面旧列仅作实际文件排序参考，不拿它复算主表包体差；优化列来自最终production verify产物3963165B。

| 文件 | 旧槽位快照 | 优化产物 |
| --- | ---: | ---: |
| pages/workbench/index.js | 234690 | 236835 |
| subpackages/scheduling/pages/manual/index.js | 187330 | 187330 |
| pages/guest/guest.js | 157760 | 160241 |
| components/profile-workspace/index.js | 158968 | 158968 |
| subpackages/organization/pages/group-settings/index.js | 155114 | 155114 |
| subpackages/scheduling/pages/backfill/index.js | 154148 | 154148 |
| subpackages/workflows/components/workflow-swap-panel/index.js | 153673 | 153673 |
| subpackages/insights/pages/notification-settings/index.js | 152475 | 152475 |
| subpackages/insights/pages/notifications/index.js | 152472 | 152472 |
| subpackages/insights/components/notifications-panel/index.js | 152074 | 152074 |
| subpackages/workflows/pages/duty/index.js | 150617 | 150617 |
| subpackages/organization/components/directory-panel/directory-panel-controller.js | 147257 | 147257 |
| subpackages/workflows/pages/leave/index.js | 145801 | 145801 |
| subpackages/insights/pages/insights/index.js | 130822 | 130822 |
| subpackages/insights/pages/exports/index.js | 130009 | 130009 |
| subpackages/organization/pages/platform-accounts/index.js | 125814 | 125814 |
| subpackages/organization/pages/scheduling-config/index.js | 124141 | 124141 |
| subpackages/organization/pages/qr-visitor/index.js | 122925 | 122925 |
| app.js | 109958 | 109958 |
| subpackages/insights/pages/visitor-access/index.js | 109174 | 109174 |

## 交付收口（2026-09-30，Node + Agent开发者工具）

- 业务`0848a3da`（`perf(miniprogram): defer offscreen list content and scope calendar rendering`）、血缘`c0c1463b`（`chore(release): refresh calendar performance lineage proof`）均已正常推送任务分支及main；canonical保持原HEAD和删除现场，未强制切换。收口文档检查点消息`docs(audit): close calendar list performance trial delivery`。候选冻结后仅文档前进，按release cutoff不重新绑定/上传。
- 正式Node CI动态分配并上传`0.1.0-p10.20260930.224@c0c1463`，production/clean、tag不可变；build UTC14:59:50.292、upload UTC15:01:06.631，Manifest `7acf64720e0f56dbde0a4993b554f0adeb1bbc74dffd6560b96514a5065db082`。上传前后正式候选检查器PASS；最终版本绑定package3962852B，主包1181504B，官方上传ZIP buffer2124945B；元数据不同，不拿它重算主表Node未绑定包体差。receipt/preflight存ignored runtime/audit。
- 用户当次要求版本放行：实时读取live release=dbe352886ff425401586da187054bdd7a488dfcc，确保未变化后用可信`ensure .224`只增追加；`verify`及完整已安装`ecs-verify.sh`通过（UTC15:05:17.324收口）。公网保留TLS域名的`.224/.223`=200，动态合法未知probe=426。首次自写探针缺platform/非法版本得400，已按正式控制语法修正；不拿400冒充426。live前后均dbe35288，未部署应用代码/迁移/数据库备份/元数据同步；控制按既有流程重建API+Web容器应用配置，旧版本保留。
- Agent开发者工具成功打开最终槽位、刷新，两页WXML及共享WXSS局部编译通过；界面build label`.224@c0c1463`。新槽位无登录会话，微信快捷登录handler后真实首页ready；只保存路由/状态/数量，不保存身份/人员/电话/访客码。医生真实列表92行外壳/33姓名，护士672/78，护士定位后姓名108、目标内容已渲染；护士成员筛选active=1、行672→43，随后清除。通过实际测得按钮坐标点击，医生月→列表、护士列表→周→月→列表的data与界面分支均生效。group switch/filter为现有handler辅助调用，未冒充全部selector点击。初始nth-child selector实际读到month，故弃作列表点击证据。
- 触摸滚动调用未取得能证明滚动位移/帧时间的证据，不写快滚已验收；可读取console缓冲的TypeError过滤无匹配，只限该过滤范围，不宣称全量零异常或完整Network对比。匿名访客未取得可用访客码，真实运行暂未验证；其两页共享逻辑/节点回归、全量Mini和最终WXML编译通过。不伪造访客权限或读取生产库访客密钥。手机帧时间/无感切换当前工具无法测量，暂未验证。
- CCleaner调查：用户确认刚运行健康检查或自定义清理；仍无删除日志指向Schedule或进程归因，记录“可能但未确认”。现场1344删除及根依赖缺失保持原状，Git提交和独立warm源码完整。全部证据移入canonical ignored runtime/audit/calendar-switch-20260930；关闭本任务DevTools、释放候选后Acquire独立文档租约收口（无安装），文档提交后释放。
