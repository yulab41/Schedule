# 微信小程序审计状态

## 当前批次：Skyline 3.17.2 滚轮单位/选中放大/范围修复已实现，待体验版交付

- 真机对照截图（3.17.2 vs 3.17.3）：3.17.2 缺"年/月"单位、中间选中项不变大、向下只能到 2027 与 5月且抬手再拖不能继续向下（可向上回滚），草稿值（2031年12月）与可见位置（2024..2028）不一致；3.17.3 全部正常。截图里行间**有**大小/浓淡渐变 → WXS 行样式通道在 3.17.2 可用，问题在**数据交付通道**（属性/观察器不可靠，组件 data 与条目数据可靠）。
- 修复：① 单位随条目数据走（item 带 `unit`，模板`wx:if="{{item.unit || unit}}"`）；② 条目总数改由组件自身 data 承载（`data-item-count="{{wheelConfig.itemCount}}"`，与已验证可用的`data-base-index`同路径）；③ 同一次打开内条目数只增不减（`refreshItemCount` 忽略瞬时更小值），避免一次瞬时渲染剪短可滚动范围；④ 仅在 3.17.2 给滚轮根节点加`is-skyline-3172-ui`，用 CSS 兜底选中行放大/不透明（WXS 行内样式优先，写不进时 CSS 生效；3.17.3 外观不变）。
- 证据：新增`does not let a transient count shrink the wheel range`与既有全范围用例通过；Mini完整174文件1219项通过/16跳过；typecheck、build366、package(主包1746516B/总4620921B)、determinism(3bacb648)、format、lint、smoke:check-core、agent-context-policy通过。`miniprogram:verify`仍只被既有未改手排矩阵`1507>1506`阻断。
- 本轮未上传、未放行、未部署。唯一下一任务：取得当次上传授权后交付体验版并 add-only 放行，由小米14复核单位显示、选中放大、能滚到 2029/12月 与 12月 且重开仍正常。详情见`runtime-ui-compatibility-wheel-units-and-range-20260917.md`。

## 当前批次：Skyline 3.17.2 滚轮初始定位与重开失效，体验版151已上传并放行，待小米14复核

- 用户真机复核`.150`：首次打开滚轮**可以滚动**（模板覆盖位移的修复生效），但**初始停在 2021年/1月**而非当前年月；**关掉再打开又无法滚动**。
- 根因（同一原因）：3.17.2 不把 WXS 的`change:wheel-config`观察器交给滚轮。① 初始位移只由`configure`写入 → 从未应用 → 停在轨道原点；② 上一轮的"缺 state 时按 dataset 自建基线"只在第一次生效，重开时 state 已存在但 generation 已推进 → `eventState`因代际不一致返回`null` → 手势全被忽略。
- 修复：初始定位改由模板承担（轨道`margin-top:{{wheelLayoutOffset}}`= `-index*44`，WXS 只画增量`translateY(offset - baseOffset)`，两者不同属性不再互相覆盖）；手势按代际自我刷新（dataset 的 generation 更新时按`data-base-index`/`data-item-count`重新播种并重置行样式，更旧仍忽略）。
- 证据：RED（回退 WXS 后"重开"用例失败`expected 'translateY(-44px)' to be 'translateY(0px)'`）；GREEN 定向55项、Mini完整174文件1217项通过/16跳过；typecheck、build366、package(主包1745352B/总4619757B)、determinism(95f7825e)、format、lint、smoke:check-core、agent-context-policy通过。`miniprogram:verify`仍只被既有未改手排矩阵`1507>1506`阻断。
- 3.17.2 已知局限（观察器不交付）：打开后未触摸前没有大小/淡出渐变（触摸一次即恢复）；点击某一项选中（tap-to-select）仍不生效，拖动选择正常。
- 交付与放行：`d33da54b` 以 production/clean 上传为 `0.1.0-p10.20260917.151`（说明“Skyline 3.17.2 wheel layout base d33da54”，Manifest`c8378346…2e55b`），远端不可变tag指向同一SHA；可信 ensure 只追加 `.151`（白名单47项，保留`.150/.149`），独立 verify 与 `/usr/local/lib/schedule/ecs-verify.sh` 通过，公网 `.151=200`、`.150=200`、动态未知 `=426`。未部署应用制品、未备份或迁移数据库、未声明 production live release。
- 唯一下一任务：小米14复核3.17.2滚轮“打开即在当前年月、可滚动、重开仍可滚动”，并确认请假定位当日仍一次到位；已知局限保持（未触摸前无渐变、点击单项选中不生效）。详情见`runtime-ui-compatibility-wheel-layout-base-trial-release-20260917.md`。

## 当前批次：Skyline 3.17.2 滚轮位移通道与定位当日一次到位，体验版150已上传并放行，待小米14复核

- 用户真机复核`.149`：换班年月滚轮**仍无法滚动**（上一轮`catch`手势隔离无效）；请假左右切月**不再乱跳**；定位当日**偶尔没反应**，月份越远越容易遇到。
- A 根因：滚轮位移由 WXS 写在`#ui-wheel-track`的 transform 上，而同一节点还有内联`style`绑定`wheelInitialOffset`；拖动时每次预览`setData`重渲染，3.17.2 会把内联样式整条重新下发并覆盖 WXS 的 transform → 内部 offset/高亮变化但像素不动。修复：删除内联绑定，位移完全由 WXS 拥有（符合既有"WXS 独占像素样式"约定）；手势在`touchStart`用节点 dataset 自建基线（新增`data-item-count`/`data-selected-index`），避免运行时未交付 config observer 时直接失效。
- C 根因：`.149`的定位当日等共享 pager 结算，未结算位移（连点箭头/连点）会被守卫吞掉 → "偶尔没反应"。修复：一步重定中心（`resetDatePager` + 一次`setData`；3.17.2 仍`duration:0`），删除已死的`_dateLocateTarget`与`formatMonthValue`。
- 证据：RED（回退 WXS 后新用例`expected undefined to be 'translateY(-264px)'`）；GREEN 定向53项+新增用例、Mini完整174文件1216项通过/16跳过；typecheck/build366/package(主包1744556B/总4618961B)/determinism(21cae2df)/format/lint/smoke:check-core/agent-context-policy通过。`miniprogram:verify`仍只被既有未改手排矩阵`1507>1506`阻断。
- 交付与放行：`a0707b0c` 以 production/clean 上传为 `0.1.0-p10.20260917.150`（说明“Skyline 3.17.2 wheel track transform ownership a0707b0”，Manifest`45598d45…90e69`），远端不可变 tag 指向同一 SHA；可信 ensure 只追加 `.150`（白名单46项，保留`.149/.148/.147`），独立 verify 与 `/usr/local/lib/schedule/ecs-verify.sh` 通过，公网 `.150=200`、`.149=200`、动态未知 `=426`。未部署应用制品、未备份或迁移数据库、未声明 production live release。
- 唯一下一任务：小米14复核3.17.2换班年月滚轮能否跟手滚动、请假定位当日是否每次一次到位；若滚轮仍不动，请回复“拖动时中间那一项高亮是否跟着换”或“非中间项数字是否比中间更小更淡”，以区分样式通道与事件通道。详情见`runtime-ui-compatibility-wheel-style-trial-release-20260917.md`。

## 当前批次：Skyline 3.17.2 滚轮手势、切月动效与定位当日体验版149已上传并放行，待小米14复核

- 用户真机复核`.148`：3.17.2 弹窗内点击不再误关，但换班年月滚轮**仍不能滚动**；点左右切月（换班弹窗与日历页月历）播放**反向**滑动动效而最终月份正确（3.17.3 正常）；请假弹窗“定位当日”会**逐月**回退（3.17.2/3.17.3 都有），日历页定位当日一次到位。
- 引入点：滚轮事件绑定与`touch-action: none`来自`57e10cdc`（WXS 滚轮能力探针）；`_dateLocateTarget`逐月续走来自`528722f4`；程序化切月时长来自`calendar-period-pager`接入（`9045dc02`等）。三者都不是本项目状态机错误，而是 3.17.2 渲染器差异被旧写法放大。
- 根因：A 滚轮依赖`touch-action`争抢纵向手势，3.17.2 不按该属性判定归属，手势被祖先容器拿走（同款组件+遮罩在 gesture-probe 真机曾验证可用，故不是遮罩命中或 WXS 子节点样式通道）；B 三槽环形 swiper 在 3.17.2 按“最近逻辑槽位”归一`current`，环形 0↔2 跳变被渲染成反向一步；C 定位当日每结算一步才前进一个月。
- 修复：`ui-wheel-column` 根节点改为`catchtouchstart`/`catchtouchmove` 自持纵向手势（位移仍写内层`#ui-wheel-track`）；受影响运行时程序化切月`duration:0`并抽出`finishMonthSwipeAt`/`finishDateSwiperAt`在零时长跳变后直接结算一次（幂等）；定位当日改为把今天的月份面板作为唯一入场面板放进相邻槽位，删除逐月续走分支。3.17.3 动画与路径不变。
- 证据：定向53项、Mini完整174文件1215项通过/16跳过；typecheck、build366、package(主包1744335B/总4618740B)、determinism(2286365b)、format、lint、smoke:check-core通过。开发者工具（3.17.2/Skyline）仅能验证宿主管弹窗可打开且无异常，元素/组件自动化在该渲染器不可用，触摸级结论只能由小米14提供。
- 交付与放行：`7e215a28` 以 production/clean 上传为 `0.1.0-p10.20260916.149`（说明“Skyline 3.17.2 wheel pan and month paging 7e215a2”，Manifest`442f8933…36fc8`），远端不可变tag指向同一SHA；可信 ensure 只追加 `.149`（白名单45项，保留`.146/.147/.148`），独立 verify 与 `/usr/local/lib/schedule/ecs-verify.sh` 通过，公网 `.149=200`、`.148=200`、动态未知 `=426`。未部署应用制品、未备份或迁移数据库、未声明 production live release。
- 唯一下一任务：小米14双实例复核 A/B/C（年月滚轮可滚动、左右切月动效方向、请假弹窗定位当日一次到位），3.17.3 三项不变；若滚轮仍不能滚动，请回复“点滚轮中间那一项有无反应”。详情见`runtime-ui-compatibility-wheel-pager-trial-release-20260916.md`。

## 上一批次：Skyline 3.17.2 弹窗点击误关修复体验版148已上传并放行，待小米14复核

- 用户真机反馈：3.17.2 日期弹窗内任意点击（定位今天/切月/日期格/弹窗内外）都会关闭弹窗；3.17.3 正常。根因是 3.17.2 的弹窗挂在页面根层，卡片内点击冒泡到页面根的关闭回调（3.17.3 的弹窗在 sheet 内被 catchtap 挡住）。
- 修复 1 行：.workflow-picker-layer 增加 catchtap="handleInternalTap"（复用已有 no-op），加 1 条回归断言（RED 1 失败→GREEN 15/15）。未新增机制，3.17.3 路径不变。
- 体验版 0.1.0-p10.20260916.148（说明"Skyline 3.17.2 dialog tap fix c5f06e5"）production/clean 上传成功，Manifest 1f64d195…f9e7；候选前置与上传后绑定检查 PASS。门禁：Mini 全量、typecheck、build366、package、determinism(4410f7fb)、format、lint 通过；主包1744039B/总4618444B。
- 放行：可信 ensure 只追加 .148 并保留 .147 等旧版；allowlist verify 与 ecs-verify 通过，release 仍 44034fcc，无部署/数据库操作；公网 .148=200、.147=200、动态未知=426。
- 唯一下一任务：小米14 3.17.2 复核日期弹窗点击不再关闭且可选，年月滚轮是否可滚动（若不可，反馈具体现象以定方向）；3.17.3 不变。详情见 docs/audit/runtime-ui-compatibility-dialog-tap-trial-release-20260916.md。
## 当前批次：Skyline 3.17.2 弹窗层 inset 兼容修复已实现，待体验版交付

- 用户反馈：3.17.2 年月/日期选择器点开后无弹窗；换班等 sheet 点外部不关闭。用开发者工具（3.17.2/Skyline/同提交 d526252b）复现并定位。
- 根因：覆盖层使用 inset:0（及 max()/env() 组合），该渲染器不解析 —— 弹窗层无偏移被排到视口外（渲染树有节点但不绘制）；ui-sheet 遮罩同样无偏移，点弹窗外落在页面上，handleBackdropClose 不触发。
- 修复（语义等价、无版本分支）：ui-date-picker 的 layer/scrim/wheel-mask、ui-selector 的 backdrop、ui-sheet 的 scrim 改为显式 top/right/bottom/left:0；sheet 安全区保留 bottom:12px 回退；新增覆盖层偏移回归断言。
- 证据：开发者工具内对照截图（修复前 layer 在渲染树但不绘制；改显式偏移后"选择月份"卡片立即正常绘制）。门禁：Mini 1214 项通过/16 跳过、typecheck/build366/package/determinism/format/lint 通过；主包1744003B/总4618408B。
- 开发者工具复测（3.17.2/c9ad7c0）：弹窗正常出现（截图）、遮罩关闭弹窗、sheet 遮罩关闭表单；切 3.17.3 复测一致。
- 边界：模拟器无法完成完整交互链（该实例 app 业务请求报网络错误），原生交互须由小米14体验版复核；本轮未上传、未放行、未部署。详情见 docs/audit/runtime-ui-compatibility-overlay-inset-20260916.md。
## 当前批次：Mini 诊断真实读取 Skyline 版本（2026-09-16 累计候选）

- 用户要求消除“更多 → 测试工具”里“Skyline 版本：当前微信版本不支持单独读取”的硬编码，并授权本次上传与 add-only 放行。官方 `wx.getSkylineInfo`（基础库 2.26.2 起）返回 `isSupported`/`version`/`reason`，原来“没有可靠 API”的写法不成立，审计主计划 §8B 本就要求该项。
- 只改测试工具页读取与对应契约测试：`isSupported` 映射官方五种原因文案，`version` 显示真实 Skyline 版本号；缺少 API、`fail` 或 500ms 超时失败关闭为“当前微信版本不支持读取”，与网络类型并行读取、不猜测、不崩溃。未改 WXML/WXSS、页面配置或业务语义。
- 血缘与证据：原检查点`c7a96a0b`按累计血缘要求整合到最新体验版 tag `145@6e31eed8`；定向22/22、Mini 完整174文件1213项通过/16跳过、typecheck通过。两处继承门禁失败未消除且与本次改动无关（icon parity 的 `ui-loading-primary/muted.svg` 未进 canonical manifest；手排矩阵`1507>1506`上限），本轮按用户指示继续交付并在报告中明确归属。
- 唯一下一任务：上传体验版并 add-only 放行，记录版本号、Manifest 与 receipt；小米 14 复核“更多 → 测试工具”的 Skyline 支持/版本两行。未操作开发者工具。

## 当前批次：Skyline 3.17.2 年月/日期选择器改由面板根层托管弹窗，待体验版交付

- 用户复核`.142@8988afe`：3.17.2年月选择器就地展开且滚轮无法独立滚动（滚动会带动整个换班弹窗），请假弹窗日期选择器被两列布局挤压；且3.17.2点弹窗外不关闭（3.17.3会）。第二点由上一轮就地展开去掉遮罩直接造成。
- 结论：不再让弹窗待在sheet的滚动容器里。3.17.2由面板把弹窗挂在面板根层（与`ui-sheet`同级的`position: fixed`覆盖层，该层在3.17.2真机验证可用）。
- 实现：`ui-date-picker`新增`dialog-only`（只渲染弹窗）与`host-key`（触发器/宿主配对）；被托管的触发器不再本地渲染弹窗，改为把配置随`pickerrequestopen`上抛，面板调用宿主`openFromParent()`，确认后`forwardHostedChange()`通过模块内实例表找回原触发器并调用`applyChange()`——面板既有`bindchange`处理器一行未改。三个工作流面板在根层各加一个宿主并给8个月/日期触发器加`host-key`；遮罩恢复，点弹窗外即关闭。
- 定向23项通过；Mini完整174文件1211项通过/16跳过；typecheck、build366文件、source/package/determinism、format/lint通过；主包1743699B/总4616396B。详情见`runtime-ui-compatibility-picker-host-dialog-20260916.md`。
- 唯一下一任务：取得当次上传授权后交付体验版并add-only放行，再由小米14双实例复核3.17.2月份/日期弹窗独立滚动、点外部关闭，及3.17.3不变。本轮未上传、未放行、未部署。

## 上一批次：Skyline 3.17.2 选择器就地展开后备已实现，待体验版交付

- 用户复核`.138@09c100d`：3.17.2下拉已能渲染选项但被后续字段遮挡；月份/日期面板点按后仍不出现；3.17.3正常。说明`.138`的显式高度修复有效，剩余两项是层级与提升问题。
- 遮挡沿用`.136`已记录的“3.17.2同层z-index不能提升浮层”（引入点`6d0575d0`）；面板不出现是因为`.138`采用的“从ui-sheet插槽内容root-portal到根层”在3.17.2不生效——冻结产物核对确有root-portal、令牌导入与`--ui-z-index-dialog:1000`，而同一机制在页面级与组件级真机均可用。本轮不再押注portal或叠加z-index。
- 修复只在3.17.2生效且全部改为就地展开：下拉容器`is-inline`（`position: static`、去遮罩、覆盖`is-measuring`隐藏、保留显式高度）；月份/日期层与面板`is-inline`（就地卡片、去遮罩与拖拽把手）；同时撤销`.138`的root-portal与根层令牌导入，3.17.3与未知版本恢复为与`.136`逐字相同的覆盖层路径。
- RED 2失败；GREEN兼容14项、Mini完整174文件1203项通过/16跳过。typecheck、production build366文件、source/package/determinism、format/lint/smoke:check-core通过；主包1739791B/总4607445B，较`.138`增644B，无新增依赖。Mini verify仍仅被既有未改手排节点1507>1506阻断。
- 唯一下一任务：取得当前消息的上传授权后交付新体验版并add-only放行、保留`.138`等旧版，再由小米14双实例复核3.17.2下拉与月份/日期面板就地可见可选，且3.17.3外观与交互不变。详情见`runtime-ui-compatibility-picker-inline-fallback-20260915.md`。

## 上一批次：Skyline 3.17.2 选择器浮层与页头箭头体验版138已上传并放行，待双实例验收
## 上一批次：Skyline 月视图已过日期灰底恢复，体验版140已上传并放行

- 用户反馈3.17.2/3.17.3两个实例的首页月视图与访客月视图都缺少“该月已过日期单元格灰底”，以前版本有，怀疑某次更新后丢失。
- 引入点：旧小程序`1343f4c6^`的`components/calendar-grid/index.wxml`用`day.isPast`输出`calendar-grid__day--past`、`index.wxss`定义`#f3f4f6`，首页`pages/calendar/index.wxml`与访客`pages/guest/guest.wxml`共用。`1343f4c6`(2026-08-13)删除旧小程序后，`1f715c96`(2026-08-18)新建`calendar-month`/`calendar-cell`、`ad4cfb2c`(2026-08-23)把工作台月视图接到新组件时都没有携带该状态、类或样式；周视图由`50c6d1ed`补齐，Web端`MonthGrid.vue`一直保留`.day-cell.is-past`。日历路径无`SDKVersion`分支。
- 修复复用月视图唯一链路：`WorkbenchCell`/`createMonthCells`新增`isPast: !cell.isOutsideMonth && cell.businessDate < today`（与周视图同款比较语义、排除月外格），`calendar-month/index.wxml`转发`is-past`，`calendar-cell`新增属性、`is-past`类与`.calendar-cell.is-past{background:#f3f4f6}`。灰底规则在`.is-pressed`之前以保留按压反馈，`.is-holiday`粉底优先级不变；访客页复用同一模型与组件零额外改动；预览/补录/POC默认`false`不变；未新增依赖、token或版本分支。
- RED 3失败/26通过；上载体把同样7个文件线性叠加到最新累积体验版`.139@a9c3204f`（记录`3c8ea88d`）之上，定向49项通过。Mini完整与构建门禁、版本绑定与放行结果见下方交付记录。
- 用户在当前消息明确授权上传并放行。详情见`runtime-ui-compatibility-past-month-gray-20260915.md`。

## 上一批次：Skyline 访客周视图分页体验版139已上传并放行，待双实例复核

- 用户复核`.137@09e6398`：3.17.2访客页面周视图乱跳、切到非本周后点单元格无反应；月视图、成员周视图与3.17.3正常。
- 根因：访客页仍在用成员页于`.135`废弃的强制归中（`current=1`+`duration:0`回跳）与`weekPanels[1]`固定索引；3.17.2对该回跳反向动画或补发事件，并使原生页与数据槽位错位，点击落到不可见面板。
- 修复：访客页导入同一个`calendar-period-pager`环形状态机，`renderCalendar`用`mapCalendarPeriodRing`，模板加`circular`/`bindchange`并读取`weekPanels[weekSwiperCurrent]`；260ms、easeOutCubic、±6队列与提交锁不变，成员页面零差异。
- 血缘：`.138@09c100d5`（并行会话的选择器浮层与页头箭头修复）是当前最新累积体验版，本分支以它为基线线性叠加；不改写对方分支。基线若再次前进必须重新叠加。
- RED2项失败；GREEN定向42项、Mini完整174文件1206项通过/16跳过、根270文件1273项通过/444跳过。typecheck/build366文件/source/determinism/format/lint/smoke:check-core通过；主包1741484B/总4609138B，较`.138`增2337B。Mini verify仍仅被既有未改手排1507>1506阻断。
- `.139@a9c3204`已以production/clean上传，Manifest`a2491815…d91e4d7b`与tag/allocation/receipt一致；可信ensure只追加`.139`并保留旧版，allowlist与完整ECS verifier通过，公网`.139/.138/.137/.136`=200、动态未知426；live release未变。
- 唯一下一任务：小米14双实例重开`.139@a9c3204`，复核3.17.2访客周视图滑动/点击与`.138`箭头/选择器无回归。详情见`runtime-ui-compatibility-guest-week-pager-trial-release-20260915.md`。

## 上一批次：Skyline 3.17.2 选择器浮层与页头箭头已实现，待体验版交付

- 小米14的3.17.2实例复核`.136@efda88f`：成员页面四项修复通过、3.17.3正常，但页头群组箭头比3.17.3偏右约40px；换班sheet的“我的班次月份/对方班次月份”点按后没有任何遮罩或面板；班次/人员下拉只剩约12px高的白色空框。
- 箭头是本轮自己造成的：`ed06031f`把3.17.2群组容器固定为220px，而箭头一直是相对该盒子的绝对定位元素，于是贴到盒子右缘。选择器则是旧Skyline在滚动容器内的布局差异：内嵌`scroll-view`弹层不按内容推导高度，`position: fixed`对话框层不在可见视口；同页`ui-sheet`不在滚动容器内所以正常。
- 修复只在3.17.2生效：箭头改为Flex流内跟随群名（220px上限与196px省略阈值逐字保留）；弹层按选项数写入显式高度（30n+10、空态56px、上限300px）；对话框层用`root-portal`提升到根层并复用根层令牌作用域，`enable`仅在3.17.2为true。3.17.3与未知版本的`popoverStyle`为空串、`enable=false`，走原路径。
- RED 3失败；GREEN定向14项、Mini完整174文件1203项通过/16跳过、根套件270文件1273项通过/444跳过。typecheck/build366文件/source/package/determinism/format/lint/smoke:check-core通过；主包1739147B/总4606801B，较访客修复基线增2083B，无新增依赖。Mini verify仍仅被既有未改手排节点1507>1506阻断。
- 分支`codex/runtime-3172-picker-overlay-20260915`基于访客修复`09e63980`；两份3.17.2修复在后续合并时必须保持同一血缘。详情见`runtime-ui-compatibility-picker-overlay-fix-20260915.md`。
- 用户当次明确授权“上传并放行”。源码`09c100d5`已推送，分支`codex/runtime-3172-picker-overlay-20260915`基线为访客修复`09e63980`，`origin/main`(4179f05a)仍是祖先。体验版`0.1.0-p10.20260915.138`说明“Skyline 3.17.2 picker overlays 09c100d”，production/clean，Manifest `1eb3d61b…a17e40a`，构建`13:52:36.805Z`、上传`13:54:26.399Z`；`.137`由同机另一任务占用，本轮顺序取得`.138`。
- 候选前置与上传后版本绑定检查`RESULT=PASS`（ready-clean-detached、production-clean、VERSION_LOCAL=absent）；冻结包/回执/分配记录及远端不可变tag一致。可信`schedule-client-version-allowlist ensure 0.1.0-p10.20260915.138`只追加并保留`.137`，独立allowlist verifier与`ecs-verify.sh`通过，release仍`44034fcc`、无应用部署或数据库操作。公网`.138=200`、`.137=200`、动态未知版本`=426`。
- 唯一下一任务：小米14双实例核对`.138/09c100d`，3.17.2复核箭头位置、下拉选项可见与月份/日期面板可弹出，3.17.3确认页头与四类选择器与`.136`一致。自动化与生产验证不构成原生验收。详情见`runtime-ui-compatibility-picker-trial-release-20260915.md`。

## 上一批次：Skyline 3.17.2 访客页面按压反馈对齐已实现，待体验版交付

- 用户复核`.136@efda88f`：成员页面四项修复通过，但3.17.2访客页面仍出现周格灰色闪烁和月格蓝色反馈滞留。
- 访客页面已有`.is-skyline-3172-ui`根类并继承成员页面的Grid/Flex后备样式，缺的是两项条件参数：月历未传`runtime-pressed-feedback-compatibility`、周格无条件`hover-class="is-pressed"`。
- 现复用成员页面同一参数名与表达式，源码只改`pages/guest/guest.wxml`两行；成员页面零差异，3.17.3与无法读取版本不变，无新增依赖或第二套机制。
- RED新增1项并在该缺口准确失败；GREEN定向31项、Mini完整174文件1200项通过/16跳过、根套件270文件1273项通过/444跳过。typecheck/build366文件/source/determinism/format/lint/smoke:check-core通过；主包1737064B/总4604718B，较`.136`仅增132B。Mini verify仍仅被既有未改手排节点1507>1506阻断。
- 同时把`docs/project-status.md`收敛回40KB/250行预算内，旧批次细节保留在Git历史与`docs/audit/`。详情见`runtime-ui-compatibility-header-press-fix-20260915.md`。
- 唯一下一任务：取得当前消息上传授权后交付新体验版并add-only放行、保留旧版，再由小米14双实例复核3.17.2访客与成员页面按压反馈一致。

## 上一批次：Skyline 页头与按压反馈体验版136已上传并放行，待双实例验收

- `.135@c7025b93`真机确认周切换已恢复；3.17.2仍有群名省略、菜单被日历文字覆盖、周格灰闪及月格蓝色反馈滞留，3.17.3正常。
- 群组菜单已收敛为所有版本共用的一份root-portal、一份模板和一个事件；仅3.17.2解除群名220px宽度的父级上限、移除周格灰色按压类并把月格松手保留从70ms缩为0ms。3.17.3的菜单几何/视觉、原周格反馈和原70ms不变，月/周分页动画完全不改。详情见`runtime-ui-compatibility-header-press-fix-20260915.md`。
- 累计RED 4失败，单菜单收敛RED 1失败；GREEN定向30项、Mini完整1199项通过/16跳过。typecheck/build/source/package/determinism/format/lint/smoke:check-core通过；主包1736932B/总4604586B，较`.135`总包仅增319B，无新增依赖。Mini verify仍只被既有未改手排节点1507>1506阻断。
- `.136@efda88f`已以production/clean上传；tag、allocation、Manifest `27702a1c…f908a32b`和receipt一致。首次`890c50a9`候选因过期canonical blob在占号/上传前停止，policy刷新后lineage/上传门禁通过。
- 可信allowlist ensure只追加`.136`且保留旧版；allowlist verifier、完整ECS verifier通过，公网`.136/.135`为200、动态未知版本为426。live release未变，未部署应用或修改数据库。
- 唯一下一任务：小米14双实例均核对`.136@efda88f`；3.17.2复核四项修复，3.17.3复核页头/菜单/通知胶囊、单元格反馈和260ms动画均不变。详情见`runtime-ui-compatibility-header-press-trial-release-20260915.md`。

## 当前批次：Skyline 周视图兼容体验版135已上传并放行，待双实例验收

- `.134@5c02393`同角色双实例确认3.17.2周选中框、环形切周、群名尺寸和Toast组合圆角均异常；同机3.17.3及3.17.2月视图正常，排除账号、权限和排班数据。
- 所有版本周视图统一复用月视图已有`calendar-period-pager`，不再维护第二套强制归中机制；保留周视图原260ms/easeOutCubic、提交锁和有界队列。选中框、页头及Toast仍为3.17.2局部后备，3.17.3+视觉和动画时长不变。详情见`runtime-ui-compatibility-week-fix-20260915.md`。
- RED 3失败；GREEN联合47项、Mini完整1197项通过/16跳过。typecheck/build/source/package/determinism/format/lint/smoke:check-core通过；主包1736356B/总4604267B，较`.134`增3770B。Mini verify仍仅被既有未改手排节点1507>1506阻断。
- `0.1.0-p10.20260915.135@c7025b93`已production/clean上传，Manifest `1aec459f…45b3bf8`，tag/allocation/Manifest/receipt一致。可信ensure仅追加`.135`并保留`.134`等旧版；allowlist与完整ECS verifier通过，公网`.135/.134=200`、动态未知`=426`。未提审、正式发布或部署新应用制品；唯一下一任务是两个实例做同版本原生复核。详情见`runtime-ui-compatibility-week-trial-release-20260915.md`。

## 当前批次：Skyline 3.17.2 专属 UI 兼容体验版134已上传并放行，待双实例验收

- 同一`.133@2d7f685`的小米14对照确认：异常实例基础库3.17.2、Grid顶部差8px且CSS圆环尖角；正常实例3.17.3、Grid顶部差0px且圆环正常。CSS变量和显式滚动均正常，根因是实例基础库/Skyline运行时差异。
- 只在`SDKVersion === 3.17.2`时为生产Grid启用局部Flex、为CSS加载圈启用本地SVG；3.17.3及后续/未知版本保留原WXML、Grid和CSS圆环路径。诊断探针不替换；API、数据、权限和交互语义不变。详情见`runtime-ui-compatibility-fix-20260914.md`。
- Mini完整174文件1193项通过/16跳过，typecheck/build/package/determinism/format/lint/smoke:check-core通过；主包1732843B、总4600497B，较`.133`增8869B（约0.19%），无新增依赖。Mini verify仍仅被既有未改手排节点1507>1506阻断。
- 首次正式上传在调用微信平台前被`5285dd1`等价血缘证明安全拒绝，未占用版本；兼容提交只为工作台TS增加精确版本判定的import、data类型和初始字段，未修改受保护方法。更新精确blob证明并复跑门禁后，`0.1.0-p10.20260914.134@5c023931`已production/clean上传，Manifest `1669cf39…60bf55`且tag/receipt一致。
- 可信ensure仅追加`.134`并保留旧版；allowlist verifier、完整ECS verifier和公网`.134/.133=200`、动态未知`=426`通过，服务器release仍`44034fcc`。未部署应用、备份/迁移数据库、提审或正式发布。详情见`runtime-ui-compatibility-trial-release-20260914.md`。唯一下一任务：两个微信实例确认同一`.134`后，原生复核3.17.2恢复和3.17.3视觉不变。

## 当前批次：跨微信实例 UI 诊断体验版133已上传，待同版本取证

- 故障基线为体验版132/44034fcc；同一包在不同微信实例出现Grid纵排、加载圈尖角和测试工具无法滚动。异常实例尚无基础库报告，不宣称最终根因。
- 仅诊断页改为固定首屏加显式scroll-view，增加Grid/CSS变量/滚动自动探针、CSS/SVG对照和首屏复制；业务页面、API、权限与数据零修改。详情见`runtime-ui-diagnostics-20260914.md`。
- RED 1；合并后诊断/导出联合69、Mini完整1187通过/16跳过。Mini/Web TypeScript、production build、Storybook build和390/320/大字号辅助复核通过；均非微信原生验收。
- Mini verify仍仅被既有未改手排节点预算1507>1506阻断，本轮不放宽预算。累计候选`2d7f685a`已上传为`0.1.0-p10.20260914.133`，上传Manifest`eb302276…16b90b0`，receipt/tag/Manifest一致。用户单独授权后已可信追加allowlist并保留旧版；完整生产verifier通过，公网`.133/.132=200`、动态未知`=426`，live仍`44034fcc`。未提审或正式发布。
- 唯一下一任务：正常与异常微信实例均确认`.133/2d7f685`，进入“更多 → 测试工具”，返回首屏截图、复制首屏诊断和能否继续滚动。收到两份同版本证据前不宣称最终根因、不修改业务UI。

## 当前批次：Feedback26 导出筛选切换重置文件状态

- 导出文件生成后，月份、年份、周期模式、岗位、人员、文件格式或导出类型发生实际变化时，统一清理旧任务/临时文件并回到“选择内容后创建任务”；相同值点击不重置。
- RED 7失败/29通过，GREEN控制器36通过，导出相邻边界联合43通过；Mini production verify通过，包体4579789字节、Worklet2/2。
- 检查点：`4179f05a fix(miniprogram): reset generated export after selection changes`。本轮只有静态/Node/Mini构建证据，未操作开发者工具、未上传或部署，原生验收未进行。

## 当前批次：Feedback22 已部署并放行124，待小米14复核

- 双二维码API响应被Mini严格解码器误拒绝，已补齐`trialImageBase64`生成schema回归。导出页删除旧白屏诊断链，改为首屏立即呈现和后台选项读取。
- 新增Excel/CSV切换及同源`ui-selector`岗位/成员多选，“全部”互斥；schema58/API支持真实OOXML `.xlsx`并兼容旧CSV。
- 完整verify、测试库迁移28项/导出集成6项、Mini verify/Worklet/确定性/包体通过。浏览器冒烟因本地5173未启动而拒绝连接，已如实记录，非原生验收。
- 4cdfdbbd/f0c46078已推送。部署前54表加密备份完成，f0c46078/schema58部署和完整ecs-verify通过。
- 体验版124/f0c46078上传成功，Manifest `e28a01c5…2d3a`；可信ensure仅追加124，公网124/123=200、未知=426。唯一下一任务：小米14复核双二维码、导出首屏、自绘多选和Excel/CSV；未提审或正式发布。

## 当前批次：Feedback21 已部署并放行123，待小米14复核

- 公开访客排班采用7天持久缓存与后台刷新，凭证和完整手机号不落盘；正式/体验二维码分环境生成并合成带群名PNG。CSV增加Excel BOM、服务端创建后立即处理，Mini自动下载后显示发送文件/取消；导出页冗余说明区已删除。
- 附件确认9月8—9日源快照简称为全，其余28日为全天；不是CSV截断，未直接改生产历史排班。
- 最终全门禁通过，9e603fdb已推送；体验版123上传成功。后续授权下完成严格host-key协调、54表加密备份、be6ff2ac部署和完整ecs-verify。
- 可信ensure仅追加123并保留旧版；allowlist及ECS verifier、公网123/122=200、未知=426通过。唯一下一任务：小米14复核访客缓存/双二维码带群名及CSV速度、自动发送和Excel编码。未提审或正式发布。

## 当前批次：Feedback20 已上传并放行122，待小米14复核

- 累计检查点66b18b26已推送；包含121导出真实上传转换修复、本轮访客月窗/返回登录、删除二维码相册链路，并保留二维码点击预览/轮换自动读取。CSV下载失败确定为公众平台downloadFile合法域名配置。
- 122/66b18b26 production/clean上传成功，Manifest fd736127…bece5，receipt/tag一致；可信ensure仅追加122并保留121，完整verifier与公网122/121=200、动态未知426通过。服务器release仍83d8a03b，无代码部署或数据库操作。
- 自动化验证为Mini1159/16跳过、根1254/439跳过、依赖保护81，最终主包1709746/总4549449；不代替小米14验收。
- 唯一下一任务：管理员在公众平台补`https://hosp.schedule.eylinhome.top`的downloadFile合法域名，再由用户在小米14重开122/66b18b2复核CSV、访客三控件/三视图和二维码长按。未提审或正式发布。

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
