# 日历共享容器倍率（2026-09-27）

## 范围、基线与引入点

用户最终要求以固定三字姓名＋标识为基准，同一布局所有单元格共用一个倍率；二字姓名不额外放大，多字允许省略，不再按内容测量或缩小。首页/访客共用页面倍率，普通预览、紧凑预览弹窗与补录各自按实际容器规则计算。用户已明确授权修改后直接上传并放行；本轮只执行新体验版的 add-only allowlist，不部署应用、备份/迁移数据库、同步服务器 release 元数据、提审或正式发布。

基线 `origin/main=3e6af0d5`，包含 `.204@0edc34ed`；独占 `runtime/wt/general-6`，Acquire → ReuseOnly → Bootstrap → Targeted test，依赖指纹 `53681b41817f58032e808840921c1b7b3d108929781e602f330b04534006e2d6`，未安装。`git log -S 'scheduleFit'` 与 blame 确认逐行测量组件由 `f651024f` 引入、`0edc34ed` 增加缓存和批处理。这次是用户明确改变长姓名显示规则，不声称整套适配语义等价。

## 行为变化与边界

- `MINI-CALENDAR-SHARED-005`（P2，高置信）：删除 `calendar-fit-line` 及四个入口注册，替换为原生 view/text。姓名变化、行数增加、切换视图不再创建测量实例、selector query、nextTick 或逐行 setData。共用 `calendar-name-layout.ts` 首次读取逻辑窗口宽度，以布局/compact 为键缓存固定计算结果；无需物理 DPI，布局本身以逻辑 px 定义。
- 普通月历基准为三个 11px 字＋13px 标识＋1px 间隔；紧凑弹窗使用三个 9px 字的原有基准。统一倍率为 `(单元格宽度 - 5px安全预算) / 固定参考宽度`，最大 1.18。所有月格、N/NP/换班标识均使用这个共享值；文本与标识整体居中。姓名上限 3em，长姓名只省略，不再缩小；完整文本仍在绑定/业务数据中。人数汇总、暗红新增、删除线移除、已有灰色和跨月状态保留。
- 首页/访客卡片宽度为窗口减 24px；普通手排预览减 28px（≤340px 减20px）；补录减28px（≤340px 减24px）；弹窗按外边距28px、最大362px、边框及20/32px内边距计算。浏览器用真实页面 CSS 验证这些常量，避免首页绝对倍率套入小弹窗。
- 周历姓名和下一行标识共用该布局的周倍率，保留班种标题、两套分页/手势/高度。列表固定原字号并使用同一 3em 省略规则；不需要按宽大列表容器放大姓名。不随每次进入、换月、换组重新计算；本轮按用户要求固定首次窗口宽度，旋转/分屏改变宽度需重开小程序，不声称动态窗口适配。
- 保留 `.204` 的访客缓存、护士 ViewModel 优化，以及分段 240ms 底块/180ms 字色、外12/内9/间隔3px、reduced-motion 规则。首页 TypeScript 仅新增导入、只读样式字段、初始化三行；删除这三行后与基线逐字一致，所有函数的接收者、异步/错误路径、空值、副作用和调用次数不变。

## 验证与证据层级

证据位于 ignored `runtime/audit/calendar-static-20260927/`，全部为匿名样例。

- 基线 `pnpm --filter @schedule/miniprogram verify` 通过：主包 1,629,512 B、总包 4,338,978 B；Manifest `cba4c83873a212e166bb53cde694ea3133bb52ad58454e2ad865ccd6afe9cafe`。基线定向14通过。未测量真机切换时长。
- 先红后绿：`red-static.log` 旧逐行组件/省略规则失败；`red-shared-layout.log` 新共享布局2项在实现前失败。后续真实 CSS 几何发现320px普通预览/补录内边距不同，固定公式补齐后通过；未用实际姓名决定倍率。旧 P7 固定11/12px断言按已授权显示规则更新，保留默认字号与单行约束。
- `SCHEDULE_CALENDAR_FIT_GEOMETRY=1 pnpm --filter @schedule/miniprogram exec vitest run scripts/p7-native-feedback.test.mjs scripts/calendar-name-layout.test.mjs scripts/calendar-name-fit.test.mjs scripts/calendar-name-geometry.test.mjs scripts/calendar-simulate.test.mjs scripts/workbench.test.mjs scripts/guest-runtime.test.mjs`：70/70。320/360/390/393px匿名二/三/四字、中英文长姓名、N/NP、多标识/人数汇总、预览状态及月/周/列表无碰撞；真实容器宽度另覆盖768px上限。600次访问页面/弹窗布局仍仅读取屏幕一次且对象复用。393px不是已核实的小米14宽度。
- Mini完整：`SCHEDULE_CALENDAR_FIT_GEOMETRY=1 pnpm --filter @schedule/miniprogram test`，188文件通过/2跳过，1,286通过/18跳过。根 `pnpm lint`、`pnpm typecheck`、任务 TS/MJS/JSON 格式、`pnpm icon:parity`、`pnpm smoke:check-core` 通过；无Web核心改动，不要求 `pnpm smoke:browser`。
- 最终 Mini verify（类型/源码/构建/确定性/包体）和 `ci:dry-run` 通过。主包1,623,944 B（-5,568），总包4,333,494 B（-5,484）；已有主包1.5MB内部预警、手排矩阵1510节点提示保留。全仓 `format:check` 仍仅五个未修改文件失败：预览model、补录index.ts、contracts/past-schedules、presentation-core/past-schedule-backfill及其测试；不宣称根verify通过，不处理无关文件。
- Agent操作开发者工具：清编译缓存，当前运行首页样式字段已读取；匿名月/周截图完整三字及多字省略、周标识下一行可见；手排紧凑弹窗独立倍率、N/NP与新增/移除/已有状态截图已查看。首次automation调用超时，随后成功。访客打开后自动回到首页，因此不能把该截图当作访客证据；访客由同样式/模板及21项运行测试覆盖。真实群组切换、有效访客链接、小米14点击至绘制耗时均未验证，不能承诺具体毫秒数。

## 检查点与下一步

应用检查点消息：`fix(miniprogram): share fixed calendar name scales by container`。逐行检查任务diff、未混入依赖、后端、数据库或包体精简回退。随后单独更新工作台精确 blob 血缘证明（先旧证明失败后新证明通过），提交/推送后冻结同一 clean SHA，官方 helper 动态分配体验版。放行使用可信 ensure 只增新版本并保留原列表，前后完整ECS verifier、独立allowlist verify、旧/新版200与未知版426。

唯一下一任务：完成已授权上传/放行，再等待同版本/SHA小米14复核。状态为已实现、自动化完成、待用户真机复核；未取得同构建证据不写真机通过。

应用检查点已推送：`17598dc8`。工作台 proof blob 从 `951cf5f6` 更新到 `c9e21ac4`；旧证明精确匹配回归失败，新证明17/17通过。只追加该检查点理由和精确blob，未减少必需祖先、禁用验证或修改版本序列。独立检查点消息：`chore(release): refresh shared calendar scale lineage proof`。

## 打包边界补充修正

`.205@a7528cfb` 已于本轮上传并 add-only 放行，Manifest `f41fa25b61ca80a5d7744035e0d81bb2fbe4a5fed7bb639424669aaec6013149`、ZIP 2,368,652 B。前后完整 ECS verifier、独立 allowlist verify 通过；生产应用 release 保持 `539d88e3`。这仍只代表各入口各自缓存；发布产物复查发现 `build-tools.mjs` 的 bundle:true 会把helper分别打包进首页、访客与月历组件，模块变量不能证明全小程序只读屏宽一次。

- `MINI-CALENDAR-SHARED-006`（P2，高置信，`17598dc8` 引入）：新增跨独立模块副本回归，旧代码对象相等断言失败；改用现有 `App.globalData` 运行态模式保存仅含屏宽和布局值的缓存。无姓名、持久化或业务数据；没有全局App的Node环境保留局部fallback。每个入口仍只按布局键读取，不按每个单元格计算。三个宽度公式与样式均未改变。
- 在新的独占租约中继续复用同一warm槽位，REUSE_ONLY/Bootstrap无构建依赖、未安装。原候选冻结身份不改写，修正版另提交、另由官方分配器分配版本。原`.205`保留。
- 回归旧代码1失败/2通过，新代码3/3，几何和结构合计11/11；实际生成JS在两个独立VM中加载后 `screenReads=1`、页面/弹窗对象相同、缓存2种布局。开发者工具读取实际App运行态，390px且存在`page:false`缓存。
- 修正后Mini verify通过，主包1,624,906 B、总包4,334,456 B，相对本轮原始基线分别减少4,606/4,522 B；此前主包/矩阵预警仍在。完整Mini复测1,287通过/18跳过，根类型/lint、任务格式、core smoke、CI dry-run和血缘审计通过。开发者工具从首页进入匿名手排后，同一个App缓存依次出现page:false、preview:false、dialog:true，宽度保持390px；这是真实跨入口缓存证据，未冒充真机耗时。
- 修正检查点消息：`fix(miniprogram): share calendar sizing across entry bundles`。本次只修改helper缓存位置和对应回归，工作台精确proof blob不变；下一步通过门禁后上传新的clean候选并add-only放行，最终停在同构建小米14复核。
