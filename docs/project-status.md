# Project Status

## 当前批次：Skyline 3.17.2 月历/日期分页改原生滚动，体验版155已上传并放行，待小米14复核

- 追加（回归修复）：`.155` 在真机/模拟器上出现"月历单元格宽度错误"——原生滚动容器里 3.17.2 无法解析环轨道/面板的百分比宽度链，面板宽度退化为不确定值，单元格按内容撑满整行（每行只显示一列）。改为新增共享助手`measureCalendarPeriodPaneWidth`，在两个组件的兼容分支里量一次容器宽度并以**内联 px** 应用到面板；CSS 只留`display:flex`+`flex:none`。3.17.2 模拟器目视确认：`pages/calendar-poc` 月历恢复 7 列、手动排班"开始日期"选择器日期网格正常。门禁：Mini 1222 项通过/16 跳过、package 4644990B、determinism`64d70ef5…`、typecheck/format/lint/smoke 通过。交付 `.156`（候选`f7155b4b`，已并入当前`origin/main`仅文档策略提交；Manifest`6cc5901b…7a60`），前后检查 PASS、verify 与`ecs-verify.sh`通过、公网`.156=200`/`.155=200`/未知`=426`。**`.155` 含该回归，请以 `.156` 复核。**

- 用户真机确认 `.154` 的年月选择器"已和 3.17.3 基本一样"，且低速末尾更顺滑（**该优点本轮不动**）；同时新报仅在 3.17.2 出现的四项：请假年月日选择器定位落到临近月且无动画、左右切换反跳；首页月历定位同样、左右切换无动画且不跟手。要求"跨多个月也只做一个月的跳转动画"。
- 根因：两处都是"3 槽环形 `swiper` + 改 `current`"；3.17.2 无法动画化程序化跳转，此前一轮设成 `duration:0` 并手动补结算 → 没动画；手动结算依赖槽位匹配，错过即丢 → 环形与画面错位 → 临近月/反跳。
- 实现（3.17.3 分支逐字未改）：3.17.2 的分页换成原生横向 `scroll-view`（与滚轮同一条已真机验证的通道）。面板体抽成 WXML `template` 两分支共用；`scroll-into-view`+`scroll-with-animation` 动画一个面板，`bindscroll` 驱动结算，手势与程序化切换共用同一结算代码；定位今天先无感归位再单面板滑到当月。共享助手落在 `calendar-period-pager.ts`，无第二套实现。
- 验证（3.17.2 模拟器）：请假页下一月 250ms `left=8391.9` → 结算 `9072=2×4536`、草稿 2027-01；定位今天跨 4 月 250ms `left=488.8` → 结算 `left=0`、草稿 2026-09-17；首页月历连按 3 次正好 2026-10/11/12；定位今天 2026-12→2026-09，视口高度 310 不变。门禁：Mini 1221 项通过/16 跳过、package 总 4643899B（+11KB）、determinism`6ea2af8f…`、typecheck/format/lint/smoke:check-core 全通过。
- 交付与放行：`.155`（Manifest`683b76f3…9b63`）production/clean 上传，前后检查 PASS；可信 ensure 追加 `.155` 保留 `.154`，verify 与 `ecs-verify.sh` 通过；公网 `.155=200`、`.154=200`、未知`=426`。未部署应用制品、未备份或迁移数据库、未提审、未正式发布。
- 原则更新（用户当次）：最小改动优先；当低版本无法在原实现上适配时为它设计匹配实现而非硬打补丁，但要有条理、不影响 3.17.3、不占过多包体积、尽量复用。已写入 `apps/miniprogram/AGENTS.md`。
- 唯一下一任务：小米14 打开 `.155` 复核请假选择器与首页月历的定位/左右切换（单月动画、不反跳、落到当月、跟手），并确认 3.17.3 无变化。详情见 `docs/audit/runtime-ui-compatibility-period-pager-20260917.md`。

## 上一批次：Skyline 3.17.2 滚轮改原生滚动实现，体验版154已上传并放行

- 用户当次授权「继续至全部完成并验证通过并上传放行」，并授权以后由 LLM 直接在模拟器用测试账号登录（已代登录一次）。
- 定因（同构建切基础库）：① 3.17.2 内联 `margin-top` 不当位移用，只有 `transform` 移动轨道 → 起始位置丢失；② WXS `setStyle` 写入不到渲染器 → 无逐像素位移、无行强调；③ `.ui-wheel-unit` 样式送不到该节点且继承色解析不出来 → 字形透明。第③条的对照实验证明唯一变量是"有没有显式颜色"，与字号无关。
- 实现：`ui-wheel-column` 内新增仅 3.17.2 使用的分支——原生 `scroll-view` 滚轮；`bindscroll` 逐像素 → 逻辑层按与 WXS 相同的插值公式产出行/数字/单位样式经数据下发，松手 `scroll-top` 吸附；单位带显式颜色（`#9aa4ae`/`#16202a`）。3.17.3 仍走原 WXS 分支，逐字未改。
- 验证：3.17.2 `compat=true`、`scrollTop 220→308` 行位移正好 88px、`midIndex 5→7`、选中行 `opacity:1;scale(1)`、单位 12 行全部出墨；3.17.3 `compat=false`、`margin-top:0px`、`#ui-wheel-track` 在、scroll-view 分支不存在。门禁全通过（typecheck、Mini 174/1220、package 4637088B、determinism、format、lint、smoke:check-core）。
- 交付与放行：`.154`（Manifest`076a83ba…304a`）production/clean 上传，前后检查 PASS；可信 ensure 追加 `.154` 保留旧版，verify 与 `ecs-verify.sh` 通过；公网 `.154=200`、`.153=200`、未知`=426`。未部署应用制品、未备份或迁移数据库、未提审、未正式发布。
- 唯一下一任务：小米14 打开 `.154` 复核滚轮跟手/吸附、单位、中间项放大、滚到 2031年/12月、重开正常，且 3.17.3 无变化。详情见 `docs/audit/runtime-ui-compatibility-wheel-native-scroll-20260917.md`。

## 上一批次：滚轮修复已用开发者工具复现验证

- 本轮用户授权：用 `fullMode` 重开项目窗口、以测试账号登录，执行授权清单第2项——在开发者工具里复现并验证滚轮修复，替代读截图推断。只做验证，未改业务代码。
- `.153`（`a18f8692`，构建 `0.1.0-p10.20260917.153@a18f869`）已上传并 add-only 放行（说明"Skyline 3.17.2 wheel data channel a18f869"，Manifest`72b7dcb4…da79fd`）；`.153/.152=200`、未知`=426`。
- 环境打通（此前"模拟器白屏"的真实原因）：必须`--window-mode fullMode`；基础库由`apps/miniprogram/project.private.config.json`的`libVersion`决定（本轮在 3.17.2/3.17.3 间切换同一份构建）。**构建未设`WECHAT_CI_VERSION`时版本为`local`**，`client-capabilities?version=local`返回 400，工作台永久停在"正在读取排班"；设成`.153`后返回 200，真实生产数据全部加载（控制台`WeChatLib: 3.17.2`、Skyline 1.4.23）。
- A/B 实测（同构建只切基础库；向真实`ui-wheel-column`注入一次 index=3/offset=−132 上报，走已验证可用的 callMethod+data 通道）：3.17.2 `compat=true`、样式串`margin-top:0px;transform:translateY(-132px)`、轨道渲染矩形 top `11642→11510`（正好−132px）、单位节点 8/8、选中数字高≈25.2px vs 未选中≈17.9px、选中项盒子 127.2×46.64（=44×1.06）；3.17.3 `compat=false`、样式串只有`margin-top:0px`、轨道 top 不变。
- 结论：修复在真实 3.17.2 运行时生效（数据通道确实推动轨道、单位出现、中间项放大），且对 3.17.3 渲染零副作用。
- 工具边界：DevTools 的`fields({computedStyle})`对 **3.17.2 与 3.17.3 都返回空**（已用 display/color/transform/marginTop 复核），故模拟器不能复现也不能否证真机"3.17.2 丢弃 WXS `setStyle`"；该条仍是设备级证据，本轮刻意不依赖它（`rect` 两版本都可用）。自动化`trigger`不触发 WXS 绑定、合成触摸不能驱动 Skyline 滚动、`pageScrollTo`超时 → 探针卡片的"拖方块/拖滚轮"未在模拟器执行。
- 放行确认（用户当次授权"提交并放行"）：`.153` 已在白名单，可信`ensure`返回"版本已存在并通过验证；未重建容器"（幂等、只追加），`verify`通过，`ecs-verify.sh`输出`[verify] complete`（api/web Up、mysql healthy），公网探针`.153=200`、`.152=200`、未知`=426`；未部署应用制品、未备份或迁移数据库、未提审、未正式发布。
- 证据：定向 31 项（wheel/runtime-compat/picker/wxs 集成）通过；截图与探针剪贴板记录留在 ignored `runtime/audit/devtools-153/`。
- 修复回顾（`cf6fbf40`）：轨道位移改由组件 data 承载（`wheelTrackOffset`/`wheelTrackStyle`，样式串只在 3.17.2 含`transform:translateY(...)`）；单位走`item.unit`+`wx:if/wx:else`；3.17.2 滚动为按行推进。真机`.152`测量仍成立：该版本丢弃 WXS`setStyle`、`computedStyle`不可用，但`callMethod`与模板数据通道正常。
- 规则与工具链：`apps/miniprogram/AGENTS.md`与 guardrails skill 默认同意 LLM 驱动开发者工具（保留"无当次授权只读、上传/提审/发布/生产凭证需当次批准、DevTools≠小米14原生验收"）；`wechatide-skill` v0.3.11；SkillHub 的`wxa-skills-generate`/`wxa-skills-validate`已装。
- 唯一下一任务：小米14打开`.153`，复核滚轮按行滚动/单位出现/中间项放大/范围到底、重开正常、3.17.3不变；随后执行授权清单第3项（AI 开发模式 generate→validate，需"开发模式"+服务端口，且不得合入提审版本）。详情见`docs/audit/runtime-ui-compatibility-devtools-3172-verification-20260917.md`。

## 当前批次：Skyline 3.17.2 滚轮位移通道与定位当日一次到位，体验版150已上传并放行，待小米14复核

- 用户真机复核`.149`：换班年月滚轮**仍无法滚动**（`catch` 手势隔离无效，说明不是祖先滚动容器抢占）；请假左右切月**不再乱跳**；定位当日**偶尔没反应**，月份离当月越远越容易遇到。
- A 根因：滚轮位移由 WXS 写在`#ui-wheel-track`的 transform 上，但同一节点还挂着内联`style="transform:translateY({{wheelInitialOffset}}px)"`；拖动时每次预览都`setData`重渲染并把内联样式整条下发，3.17.2 因此覆盖掉 WXS 刚写的 transform（内部 offset/高亮仍在变，像素不动）。修复：删除该内联绑定，位移完全由 WXS 拥有；组件侧删掉`wheelInitialOffset`；并让手势在`touchStart`用节点 dataset（新增`data-item-count`/`data-selected-index`）自建基线，避免运行时没交付 config observer 时滚轮直接失效。
- C 根因：`.149`的定位当日依赖"准备相邻面板 + 等 pager 结算"，只要还有未结算位移（连点箭头/快速连点）就被守卫吞掉。修复：改为一步重定中心（`resetDatePager` + 一次`setData`，3.17.2 仍`duration: 0`），并删除已死的`_dateLocateTarget`机制与`formatMonthValue`。
- 证据：RED（回退 WXS 后新用例失败`expected undefined to be 'translateY(-264px)'`）；GREEN 定向53项+新增用例、Mini完整174文件1216项通过/16跳过；typecheck、build366文件、package(主包1744556B/总4618961B)、determinism(21cae2df)、format、lint、smoke:check-core、agent-context-policy通过。`miniprogram:verify`仍只被既有未改的手排矩阵`1507>1506`阻断。
- 交付：体验版`0.1.0-p10.20260917.150`（说明“Skyline 3.17.2 wheel track transform ownership a0707b0”）production/clean上传成功，Manifest`45598d45…90e69`，远端不可变tag指向`a0707b0c`；候选前置与上传后绑定检查PASS。
- 放行：可信ensure只追加`.150`（白名单46项，保留`.149/.148/.147`），独立verify与`ecs-verify.sh`通过；公网`.150=200`、`.149=200`、动态未知`=426`。未部署应用制品、未备份或迁移数据库、未声明production live release。
- 唯一下一任务：小米14复核3.17.2换班年月滚轮能否跟手滚动、请假定位当日是否每次一次到位；若滚轮仍不动，请回复“拖动时中间那一项高亮是否跟着换”或“非中间项数字是否比中间更小更淡”，以区分样式通道与事件通道。详情见`docs/audit/runtime-ui-compatibility-wheel-style-trial-release-20260917.md`。

## 当前批次：Skyline 3.17.2 滚轮手势、切月动效与定位当日体验版149已上传并放行，待小米14复核

- 用户真机复核`.148`：3.17.2 弹窗内点击不再误关，但换班年月滚轮**仍不能滚动**（3.17.3 正常）；点左右切月（换班弹窗与日历页月历）播放**反向**滑动动效而最终月份正确；请假弹窗“定位当日”会**逐月**回退（3.17.2/3.17.3 都有），日历页定位当日一次到位。
- A 滚动：滚轮依赖`touch-action: none`争抢纵向手势，3.17.2 不按该属性判定归属，手势被祖先容器拿走（同款组件+遮罩在 gesture-probe 真机曾可用，故不是遮罩命中或 WXS 子节点样式通道）。`ui-wheel-column` 根节点改为`catchtouchstart`/`catchtouchmove` 自行消费纵向手势；位移仍写在内层`#ui-wheel-track`（写到会裁剪自身的列容器上不会滚动）。
- B 动效：三槽环形 swiper 的`current`在 3.17.2 按“最近逻辑槽位”归一，环形 0↔2 跳变被渲染成反向一步。受影响运行时的程序化切月改用`duration:0`（与工作台月份列表`listSwiperCurrent:1 + duration:0`既有先例一致），并抽出`finishMonthSwipeAt`/`finishDateSwiperAt`在零时长跳变后直接结算一次（幂等，`animationfinish`再到达即早退）；3.17.3 仍走 240ms 动画。
- C 定位当日：改为像日历页那样把“今天的月份面板”作为唯一入场面板放进相邻槽位，一次结算即落在当天，删除逐月续走分支。
- 门禁：定向53项、Mini完整174文件1215项通过/16跳过；typecheck、build366文件、package(主包1744335B/总4618740B)、determinism(2286365b)、format、lint、smoke:check-core通过。改动仅`ui-wheel-column/index.wxml`、`calendar-month/index.ts`、`ui-date-picker/index.ts`与3个回归测试。
- 交付：体验版`0.1.0-p10.20260916.149`（说明“Skyline 3.17.2 wheel pan and month paging 7e215a2”）production/clean上传成功，Manifest`442f8933…36fc8`，远端不可变tag指向`7e215a28`；候选前置与上传后绑定检查PASS（ready-clean-detached、production-clean、VERSION_LOCAL=absent）。
- 放行：可信ensure只追加`.149`（白名单45项，保留`.146/.147/.148`），独立verify与`ecs-verify.sh`通过；公网`.149=200`、`.148=200`、动态未知`=426`。未部署应用制品、未备份或迁移数据库、未声明production live release。
- 开发者工具（3.17.2/Skyline）只能验证宿主管弹窗可打开且无异常；该渲染器下元素与组件自动化不可用，触摸级滚动与动效方向由小米14复核。
- 唯一下一任务：小米14双实例复核 A/B/C（滚轮可滚动、切月动效方向、定位当日一次到位），3.17.3不变；若滚轮仍不能滚动，请回复“点滚轮中间那一项有无反应”。详情见`docs/audit/runtime-ui-compatibility-wheel-pager-trial-release-20260916.md`。

## 上一批次：Skyline 3.17.2 弹窗点击误关修复体验版148已上传并放行，待小米14复核

- 用户真机反馈：3.17.2 日期弹窗内任意点击（定位今天/切月/日期格/弹窗内外）都会关闭弹窗；3.17.3 正常。根因是 3.17.2 的弹窗挂在页面根层，卡片内点击冒泡到页面根的关闭回调（3.17.3 的弹窗在 sheet 内被 catchtap 挡住）。
- 修复 1 行：.workflow-picker-layer 增加 catchtap="handleInternalTap"（复用已有 no-op），加 1 条回归断言（RED 1 失败→GREEN 15/15）。未新增机制，3.17.3 路径不变。
- 体验版 0.1.0-p10.20260916.148（说明"Skyline 3.17.2 dialog tap fix c5f06e5"）production/clean 上传成功，Manifest 1f64d195…f9e7；候选前置与上传后绑定检查 PASS。门禁：Mini 全量、typecheck、build366、package、determinism(4410f7fb)、format、lint 通过；主包1744039B/总4618444B。
- 放行：可信 ensure 只追加 .148 并保留 .147 等旧版；allowlist verify 与 ecs-verify 通过，release 仍 44034fcc，无部署/数据库操作；公网 .148=200、.147=200、动态未知=426。
- 唯一下一任务：小米14 3.17.2 复核日期弹窗点击不再关闭且可选，年月滚轮是否可滚动（若不可，反馈具体现象以定方向）；3.17.3 不变。详情见 docs/audit/runtime-ui-compatibility-dialog-tap-trial-release-20260916.md。
## 当前批次：Mini 诊断真实读取 Skyline 版本（2026-09-16 累计候选）

- 用户要求把“更多 → 测试工具”的“Skyline 版本”从硬编码“当前微信版本不支持单独读取”改为真实读取，并授权本次上传与 add-only 放行。官方 `wx.getSkylineInfo`（基础库 2.26.2 起）返回 `isSupported`/`version`/`reason`；审计主计划 §8B 本就要求“Skyline 支持与版本（API 支持时）”。
- 实现只改`apps/miniprogram/src/subpackages/diagnostics/pages/test-tools/index.ts`与`apps/miniprogram/scripts/test-tools.test.mjs`：`isSupported` 映射官方五种原因文案，未识别原因写“不支持（原因未识别）”，`version` 显示真实版本号；缺 API、`fail` 回调或 500ms 超时统一失败关闭为“当前微信版本不支持读取”，与网络类型并行读取、不阻塞页面。未改 WXML/WXSS、页面配置、渲染器契约或业务语义，未新增依赖。
- 血缘：原检查点`c7a96a0b`（基线`4179f05a`）不含并行线体验版137–145，按体验版累计血缘要求整合到最新 tag `145@6e31eed8` 上形成本候选；未改动、未覆盖并行线的任何更新，冲突只出现在两个状态文档且以并行线版本为准。
- 候选门禁：定向22/22通过；Mini 完整174文件1213项通过/16跳过；typecheck通过。两处继承门禁失败仍存在且与本次改动无关：`pnpm icon:parity:check` 报“generated manifest and Mini SVG directory are not bidirectionally closed”（`ui-loading-primary/muted.svg` 由并行线`70c51353`加入，未进入 `packages/ui-icons` canonical manifest），`pnpm miniprogram:verify` 报手排矩阵节点`1507>1506` no-growth 上限；icon parity 在并行线 tip `09e63980` 与本候选均复现。本轮按用户指示继续交付，不改动其图标系统或手排预算。
- 独占general-3，REUSE_ONLY且无安装；未操作微信开发者工具。唯一下一任务：按本轮授权上传体验版并 add-only 放行，再由小米14在“更多 → 测试工具”复核 Skyline 支持与版本两行、以及原有九项页面显示检查不受影响。

## 当前批次：Skyline 3.17.2 年月/日期选择器改由面板根层托管弹窗，待体验版交付

- 用户复核`.142@8988afe`：3.17.2月份弹窗就地展开、滚轮被外层滚动抢占，请假日期选择器被两列挤压，且点弹窗外不关闭（3.17.3会）。
- 改法：弹窗不再留在sheet滚动容器内，改由面板在**根层**渲染（与`ui-sheet`同级、3.17.2真机验证可用的fixed覆盖层）。`ui-date-picker`新增`dialog-only`/`host-key`，被托管触发器把配置上抛、面板调用宿主打开，确认后由宿主找回原触发器`applyChange()`，面板既有`bindchange`未改；换班/请假/加扣班共8个触发器接入，遮罩恢复（点外部关闭）。
- 验证：定向23项、Mini完整1211项通过/16跳过；typecheck、build366、source/package/determinism、format/lint通过；主包1743699B/总4616396B。3.17.3路径未改。详情见`docs/audit/runtime-ui-compatibility-picker-host-dialog-20260916.md`。
- 唯一下一任务：取得当次上传授权后交付体验版并add-only放行，由小米14双实例复核。本轮未上传、未放行、未部署。

## 上一批次：Skyline 3.17.2 选择器就地展开后备已实现，待体验版交付

- 用户复核`.138@09c100d`：3.17.2下拉已渲染出选项但被后续字段遮挡；月份/日期面板点按后仍不出现；3.17.3正常。`.138`的显式高度修复被证明有效，剩余两项是层级与提升问题。
- 遮挡沿用`.136`已记录“3.17.2同层z-index不能提升浮层”（引入点`6d0575d0`）；面板不出现是因为`.138`的“从ui-sheet插槽内容root-portal到根层”在3.17.2不生效（冻结产物确有root-portal、令牌导入与`--ui-z-index-dialog:1000`，而该机制在页面级/组件级真机均可用）。本轮不再押注portal或叠加z-index。
- 修复只在3.17.2生效且改为就地展开：下拉`is-inline`（static、去遮罩、覆盖`is-measuring`隐藏、保留显式高度）；月份/日期层与面板`is-inline`（就地卡片、去遮罩与把手）；撤销`.138`的root-portal与根层令牌导入，3.17.3与未知版本恢复与`.136`逐字相同的覆盖层路径。
- RED 2失败；GREEN兼容14项、Mini完整174文件1203项通过/16跳过、typecheck、build366文件、source/package/determinism、format/lint/smoke:check-core通过；主包1739791B/总4607445B，较`.138`增644B，无新增依赖。
- 唯一下一任务：取得当次上传授权后交付新体验版并add-only放行、保留`.138`，再由小米14双实例复核。本轮未上传、未放行、未部署。详情见`docs/audit/runtime-ui-compatibility-picker-inline-fallback-20260915.md`。

## 上一批次：Skyline 3.17.2 选择器浮层与页头箭头体验版138已上传并放行，待双实例验收
## 上一批次：Skyline 月视图已过日期灰底恢复，体验版140已上传并放行

- 用户反馈3.17.2/3.17.3两个实例的首页月视图与访客月视图都缺少“该月已过日期单元格灰底”，以前版本有；要求最小改动、两处全面修复、不牵连其他外观。
- 引入点：旧小程序`1343f4c6^`的`components/calendar-grid`用`day.isPast`+`.calendar-grid__day--past{background:#f3f4f6}`，首页`pages/calendar/index.wxml`与访客`pages/guest/guest.wxml`共用；`1343f4c6`删除旧小程序后，`1f715c96`新建`calendar-month`/`calendar-cell`、`ad4cfb2c`接入工作台月视图时都没有携带该状态。周视图由`50c6d1ed`补齐、Web端`MonthGrid.vue`一直保留，因此只有月视图看起来“某次更新后没了”。日历路径无`SDKVersion`分支，不是基础库差异。
- 修复只补月视图唯一复用的一个状态与一条样式：`createMonthCells`新增`isPast: !cell.isOutsideMonth && cell.businessDate < today`，`calendar-month`转发`is-past`，`calendar-cell`属性/类/`.is-past{background:#f3f4f6}`。灰底放在`.is-pressed`之前保留按压反馈，`.is-holiday`粉底优先级不变；访客页复用同一模型与组件、零额外改动；预览/补录/POC默认`false`不变。
- 实现检查点`3a9ccca9`（分支`codex/runtime-3172-past-month-gray-20260915`，基线`.138`记录`d56ecba2`）已推送；上载体在独占warm槽`codex/runtime-3172-past-month-gray-upload-20260915`把同样7个文件线性叠加到最新累积体验版`.139@a9c3204f`之上，不改写并行分支、不创建合并提交。
- RED 3失败/26通过；`.139`基线叠加后定向49项通过，Mini完整与构建门禁见交付记录。详情见`docs/audit/runtime-ui-compatibility-past-month-gray-20260915.md`。
- 用户在当前消息明确授权“上传并放行”。唯一下一任务：按runbook完成`.140`候选冻结、上传与add-only放行，再由小米14双实例复核首页与访客月视图已过日期灰底，并确认今天/未来、假期粉底、选中框与按压反馈不变。

## 上一批次：Skyline 访客周视图分页体验版139已上传并放行，待双实例复核

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
- 用户当次明确授权“上传并放行”：源码`09c100d5`已推送，体验版`0.1.0-p10.20260915.138`（说明“Skyline 3.17.2 picker overlays 09c100d”）production/clean上传成功，Manifest `1eb3d61b…a17e40a`；候选前置与上传后版本绑定检查通过（ready-clean-detached、production-clean、VERSION_LOCAL=absent），冻结包/回执/分配记录与远端不可变tag一致。
- 可信`schedule-client-version-allowlist ensure 0.1.0-p10.20260915.138`只追加并保留`.137`；独立allowlist verifier、`ecs-verify.sh`与公网策略（`.138=200`、`.137=200`、未知`=426`）通过；release仍`44034fcc`，无应用部署、数据库备份或迁移。
- 唯一下一任务：小米14双实例核对`.138/09c100d`，3.17.2复核页头箭头、下拉选项可见与月份/日期面板可弹出，3.17.3确认页头与四类选择器不变。详情见`docs/audit/runtime-ui-compatibility-picker-trial-release-20260915.md`。

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
