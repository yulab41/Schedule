# Project Status

## 当前批次：Skyline 3.17.2 滚轮初始定位与重开失效，体验版151已上传并放行，待小米14复核

- 用户真机复核`.150`：换班年月滚轮**首次打开可以滚动**（上一轮"模板覆盖 WXS 位移"的修复生效），但**初始停在最前端（2021年/1月）**而非当前年月；**关掉弹窗再打开又变回不能滚动**。
- 根因（同一原因）：3.17.2 不把 WXS 的`change:wheel-config`观察器交给滚轮。① 初始位移只由`configure`写入 → 从未应用 → 停在轨道原点；② 上一轮"缺 state 时按 dataset 自建基线"只在第一次生效，重开时 state 已存在但 generation 已推进 → `eventState`因代际不一致返回`null`，手势全被忽略。
- 修复：初始定位交给模板（轨道`margin-top:{{wheelLayoutOffset}}`= `-index*44`），WXS 只画增量`translateY(offset - baseOffset)`，两者不同属性不再互相覆盖；手势按代际自我刷新（dataset 的 generation 更新时按`data-base-index`/`data-item-count`重新播种并重置行样式，更旧仍忽略）。
- 证据：RED（回退 WXS 后"重开"用例失败`expected 'translateY(-44px)' to be 'translateY(0px)'`）；GREEN 定向55项、Mini完整174文件1217项通过/16跳过；typecheck、build366文件、package(主包1745352B/总4619757B)、determinism(95f7825e)、format、lint、smoke:check-core、agent-context-policy通过。`miniprogram:verify`仍只被既有未改手排矩阵`1507>1506`阻断。
- 3.17.2 已知局限：打开后未触摸前没有大小/淡出渐变（触摸一次恢复）；点击某一项选中仍不生效，拖动选择正常。
- 交付：体验版`0.1.0-p10.20260917.151`（说明“Skyline 3.17.2 wheel layout base d33da54”）production/clean上传成功，Manifest`c8378346…2e55b`，远端不可变tag指向`d33da54b`；候选前置与上传后绑定检查PASS。
- 放行：可信ensure只追加`.151`（白名单47项，保留`.150/.149`），独立verify与`ecs-verify.sh`通过；公网`.151=200`、`.150=200`、动态未知`=426`。未部署应用制品、未备份或迁移数据库、未声明production live release。
- 用户复核`.151`：初始定位与重开已正常，但 3.17.2 仍缺"选中字体放大"、年月数字旁的"年/月"单位，且滚轮最多只能到 2027 和 5月。本轮先补范围回归断言`keeps the whole range reachable from a dataset-seeded baseline`（从数据集基线连续拖动必须能到最后一格）——**该断言通过**（2021→2031、1→12月在隔离环境全部可达），说明限制不在 WXS 取值域，而在渲染器侧实际渲染行/布局；开发者工具本次模拟器渲染不出内容（只有数据层可用），故已请求小米14截图比对 3.17.2/3.17.3 的滚轮外观与拖动极限。
- 唯一下一任务：拿到 3.17.2/3.17.3 滚轮截图后，区分两种可能：① WXS 对"动态生成 id 的行"`setStyle` 在 3.17.2 不到达渲染器（表现为无放大、无渐变）；② `margin-top` 承载的布局基线在 3.17.2 被裁剪/漏绘（表现为到不了底）。前者改用数据驱动的选中态，后者改回由 WXS 承担基线。详情见`docs/audit/runtime-ui-compatibility-wheel-layout-base-trial-release-20260917.md`。

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
