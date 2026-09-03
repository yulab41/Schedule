# EXP-ICON-004 Web / 微信小程序图标及图标动效一致性审计

## 结论先行

本轮确认的主要问题不是“图标画得像不像”，而是同一个产品语义在 Web 和小程序分别拥有
inline SVG、TDesign 组件、`web-*.svg`、CSS 几何和文字字符多个来源。该问题会造成 path、
颜色、尺寸和动效时序漂移，属于 P1 来源一致性问题；没有发现 P0（阻断启动或造成数据/权限错误）
图标问题。

本分支已完成 B1 修复：以 Web 真实 path/TDesign path 的结构化数据作为唯一几何来源，Web 使用
`SharedIcon` 渲染，小程序使用生成的 `ui-*.svg` 和平台兼容层；没有复制 React/DOM/CSS 运行时。
修复不改变 API、路由、权限、业务状态或用户操作结果。

静态修复已经通过 Node/TypeScript/构建/自动化检查；`1ffab10c` 已从 managed exact-clean
`runtime/release-worktree` 上传为体验版 `0.1.0-p10.20260903.81`。上传首次因代理/TUN 的 IPv6 出口被微信
`-10008 invalid ip` 拒绝，复用已审计的进程级 IPv4 DNS 兼容路径后同一候选成功上传（196 code files、ZIP
`2,486,095 B`、local upload manifest `a68c1706742b26fb5ac9cd0572793423003c4c837fd2590aab52ac3bcf804eb6`）。
当前仍没有与 B1.1 修复候选匹配的浏览器 API 后端、微信开发者工具或 Xiaomi 14 视觉/动效验收证据，
因此“代码候选已修复”不等于“跨端视觉验收通过”。
服务器端已按用户授权核对该版本：生产 client-version allowlist `ensure` 幂等通过且未重建容器，随后 allowlist `verify` 与完整 ECS
verifier 通过；这不是本批代码的 Git/ECS 部署，也不能代替 Xiaomi 14 验收。

`.81` 上的后续用户反馈暴露了两项 B1 适配遗漏。B1.1 已按 Web 真值修复：底部日历删除 Mini 私有
420ms 点击弹跳和 `scaleX` 几何缩放，加入 primary/secondary 同源资产；通讯录人员资产使用 Web 的
1.8 stroke 与共享未选中色 `#586678`，原 520ms motion 不改。修复只完成静态/Node 验证，尚未上传新体验版。

## 审计边界与证据

- 基线：执行时最新 `origin/main@8e6a4a320a69fee9f1ca0471d8f9b140e3d4dd39`。
- worktree：`runtime/external-project-worktrees/exp-icon-004-full-20260903`；分支：
  `codex/exp-icon-004-full-20260903`。
- 范围：工作台底部/顶部导航、更多工具、日历、通讯录、事件记录、筛选/关闭/下拉、换班/加扣班/请假、
  导出/通知/访客、身份页、状态和页面返回控件。
- 静态证据：源码、WXML/WXSS、SVG 节点、依赖清单、Git 引用搜索、Node 测试、TypeScript、构建和包体脚本。
- 非证据：微信开发者工具 GUI/CLI、模拟器截图、真机截图、Console/Network、冷启动和 GPU/帧率；本轮均未调用或取得。

## Web 来源盘点

### 生产来源

| 来源 | 基线位置/数量 | 内容 | B1 处理 |
| --- | --- | --- | --- |
| Web inline SVG/path | `apps/web/src/features/layout/WorkbenchNavIcon.vue`，导航 14 项 + `more`/`logout` | 日历、通讯录、群组、手动排班、补录、请假、换班、加扣班、事件、通知、统计、成员、个人、配置及退出；含 `data-part` 动效分组 | path 节点移入 `packages/ui-icons/src/catalog.ts`，组件改为 `SharedIcon` |
| Web action component | `apps/web/src/components/LucideMinimalActionIcon.vue`，8 个动作名 | bell、profile、export、filter、locate、department、people、phone；其中 profile/export/phone 基线来自 TDesign path | 仍保留公共 props/触发时序，几何改由同一 catalog 渲染 |
| TDesign icon component | 基线直接引用见登录、日历、通讯录、事件、个人、访客、导出、状态等页面 | Chevron、User、LockOn、Filter、Search、Close、Star、History、Call、Export、Download、Info、Error、WifiOff | 生产 Web 直引用已换为 `SharedIcon`；`tdesign-icons-vue-next` 从 Web 依赖移除，catalog 仅保存来源和许可证元数据 |
| CSS/JS motion | `LucideMinimalActionIcon.vue`、`WorkbenchNavIcon.vue` 及页面 WXSS/Vue CSS | 点击、激活、切换、导航和打开的 duration/easing/keyframe | 数值归档到 `packages/ui-icons/src/motion.ts`，平台层按同一规格适配 |
| 图片资源 | Web `public/icons/icon-192.png`、`icon-512.png`、`maskable-512.png` | PWA 安装/启动图，不是页面图标 | 暂不迁移；保持平台安装资产边界 |

### 已排除来源

- 生产 Web 未发现 `<use>` sprite、独立 SVG 图标目录、`@font-face` 图标字体、woff/ttf 图标资源。
- Storybook/preview 中的示例字符和装饰不作为生产来源；但生产组件和 Storybook 仍共用同一个动作组件。
- 不新增图标运行时依赖，不把浏览器 DOM/CSS 动画代码复制到小程序。

## Web / 小程序对照清单与严重程度

严重程度采用审计规范：P0 为阻断/安全级，P1 为来源或核心体验高风险，P2 为局部视觉/动效偏差，
P3 为低风险装饰或暂不具备跨端等价条件。表中“B1 状态”是静态代码结果；“真机”仍需体验版确认。

| 图标/位置 | Web 基线真实来源 | 小程序基线差异 | 严重程度 | B1 状态与结论 |
| --- | --- | --- | --- | --- |
| 底部导航：日历 | `WorkbenchNavIcon` 的日历框 + check path，check 为 `data-part=check` | B1 后仍有 Web 不存在的 420ms 点击弹跳，并以 `scaleX(.35)` 代替 dash draw；未激活资产仍为 primary | P1 | B1.1 删除私有弹跳/缩放，增加同源 secondary 资产；active-only 1800ms/ease-in-out/opacity 已对齐，image 内部 dash 仍为兼容限制，需真机确认 |
| 底部导航：通讯录 | `directory` path + `contact-person` group | 独立 `web-directory.svg` | P1 | 改为 `ui-directory.svg`，来源/颜色 token 化 |
| 底部导航：换班 | `swap` 的左右箭头 group | `web-swap.svg` 与 `web-swap-secondary.svg` 私有维护 | P1 | 改为 `ui-swap-left/right.svg`，动效改为 1800ms infinite active loop |
| 底部导航：我的 | Web 为 `profile` path/circle | Mini 的 `web-profile.svg` 实为另一份 TDesign User path | P1 | `ui-profile` 用 Web 导航几何；身份/账号语义单独用 `ui-user` |
| 底部导航：更多 | Web 三个 dot 的 stagger | Mini 三份静态文件且 delay 曾为 80/160ms、520ms one-shot | P1 | 由同一 dot catalog 生成，改为 1800ms、100/200ms stagger infinite |
| 顶部通知 | Web action bell 的真实 path | Mini `web-bell.svg` 固定颜色，结构与 Web action 相同但无来源记录 | P1 | `ui-bell.svg` 同源；620ms bell motion 保留，真机需看 transform-origin |
| 顶部个人 | Web action 的 TDesign User 与导航 profile 语义曾混用 | Mini 顶部使用 `web-profile.svg` | P1 | 顶部工作台使用 `ui-profile.svg`，身份字段使用 `ui-user.svg` |
| 更多：群组管理 | Web `groups` 两人 path/group | Mini 误用 profile | P1 | 改为 `ui-groups.svg` |
| 更多：手动排班 | Web `manual` frame/rules/column | Mini 误用 calendar | P1 | 改为 `ui-manual.svg` |
| 更多：排班补录 | Web `backfill` rewind/clock hands | Mini 误用 history | P1 | 改为 `ui-backfill.svg` |
| 更多：请假 | Web `leave` calendar + minus | Mini 只有无 minus 的 `web-leave.svg` | P1 | catalog `leave` 补齐 Web minus，生成 `ui-leave.svg` |
| 更多：加扣班 | Web `duty` plus/minus | 旧资源可用但无共享来源 | P1 | 改为 `ui-duty.svg` |
| 更多：排班配置 | Web `config` gear | Mini 误用 calendar | P1 | 改为 `ui-config.svg` |
| 更多：事件与统计 | Web 分别有 `events`、`statistics`；Mini 是一个合并入口 | Mini 误用 calendar | P1 | 合并入口使用 `ui-events.svg`；`statistics` 仍保留 Web catalog，避免在一个 row 放两图标 |
| 更多：通知设置/通知中心 | Web action bell 与 nav notifications 几何略有不同 | Mini 两个入口都用 bell | P1 | 设置用 `ui-bell`，中心用 `ui-notifications` |
| 更多：导出排班 | Web TDesign Export path | Mini 误用 history | P1 | 改为 `ui-export.svg` |
| 更多：邀请与访客/平台账号 | Web 无专用 visitor icon，账号语义使用 User | Mini 曾误用 bell/profile | P2 | 统一为 `ui-user.svg`；visitor 语义和文案需体验版确认是否需要独立 product icon |
| 更多：访客访问 | Web 无单独 visitor path；当前使用日历确认语义 | Mini 用 calendar-check 但旧文件无共享来源 | P2 | 改为 `ui-calendar-check.svg`，不新增临摹图 |
| 更多：测试工具 | Web 没有专用工具图标 | Mini 用 more dot | P2 | 改为共享 TDesign Info path 的 `ui-info-circle.svg` |
| 更多行右箭头 | Web 文字 `›` | Mini 图片/文字/CSS 混用 | P1 | Web 和 Mini 均改为 chevron path；Mini 另生成 muted variant |
| 工作台事件记录 | Web TDesign History；点击后读取事件时间线 | Mini 入口已是真实事件组件，但图标是旧独立 SVG | P1 | `ui-history.svg`，不改变事件 GET/权限/状态逻辑 |
| 排班详情电话 | Web TDesign Call，绿色/主色根据上下文 | Mini `web-phone.svg` 与目录电话颜色不同 | P1 | `ui-phone-success` 用于工作台绿色电话，`ui-phone` 用于通讯录主色；620ms wrapper motion |
| 日历周/月/列表前后箭头 | Web TDesign Chevron path | Mini `web-chevron-left/right` | P1 | 统一 `ui-chevron-left/right`，保留 240/260ms 页面位移动效 |
| 日历定位 | Web action Locate rotor/center | Mini 静态 SVG + wrapper | P2 | `ui-locate.svg`；520ms rotate 保留，内部 rotor 无法被 image 子选取 |
| 工作台筛选 | Web action 三条 path，分别 `filter-top/middle/bottom` | Mini 原来是 WXSS 三个横条手绘 | P1 | 三个 path part 各生成一个全 viewBox SVG，叠放后按同一 520ms keyframe 动画 |
| 筛选面板关闭 | Web TDesign Close path/按钮 | Mini 使用 `×` 字符 | P1 | 改为 `ui-close.svg` |
| 筛选下拉箭头 | Web/Mini 组件各自用字符或 border triangle | Mini `filter-chevron`、group selector 曾为 CSS border | P1 | 改为旋转 `ui-chevron-right-muted.svg`，只保留平台旋转适配 |
| 通讯录顶部/筛选 | Web Filter/Search/Close/FilterClear path | Mini 旧 `web-directory-*` | P1 | `ui-filter-funnel`、`ui-search`、`ui-close`、`ui-filter-clear` |
| 通讯录科室/人员切换 | Web action 的 department/people groups；模式按钮 18px、stroke 1.8、未选中 `#586678` | B1 已移除手绘并对齐 motion，但生成资产仍为 stroke 2、未选中 `#6B7785` | 人员差异 P2；原来源问题 P1 | B1.1 由同一 catalog 以 manifest override 生成 1.8 stroke，未选中色来自共享 token；500/520ms 与 destination-only 触发不变 |
| 通讯录收藏 | Web TDesign Star/StarFilled | Mini 旧 directory 专用 star | P1 | 统一 `ui-star` / `ui-star-filled`，保留 favorite token |
| 通讯录拨号 | Web action phone | Mini 旧 directory phone SVG | P1 | 使用 `ui-phone.svg`，保留 dial target 与 phone motion |
| 工作流 picker 触发器/日期箭头/关闭 | Web TemporalPicker path；Mini 自绘 border/`×`/字符 | 形状、旋转、颜色和关闭来源分散 | P1 | trigger、date nav、close 改用 chevron/close assets；picker 的 native 交互仍由 Mini adapter 承载 |
| 身份账号/密码 | Web User/LockOn path | Mini `web-profile`/`web-lock` | P1 | `ui-user` / `ui-lock` 与 Web path 一致 |
| 导出/状态/离线 | Web Download/Info/Error/WifiOff | Mini 多为文字状态或页面私有状态 mark | P2 | Web 统一 `SharedIcon`；Mini 本批只迁移实际控件箭头/关闭，状态文字与装饰保持语义边界 |
| 选择勾、表格方向、时间范围箭头 | 文字是内容或表格语义，不是独立 icon asset | Mini 仍有 `✓`、`↓`、`→` 内容字符 | P3 | 不擅自替换为图标，避免改变文案语义；若体验版显示为控件图标，另开批次 |
| Logo、PWA 安装图、时间线点、loading ring | 品牌或布局装饰，不是跨端页面 icon | CSS/WXML 结构各自表达 | P3 | 暂不迁移；继续保留平台专属边界 |

## 动效规格

`packages/ui-icons/src/motion.ts` 是规格来源；组件 CSS 是渲染适配，不是规格来源。所有 one-shot
规格默认 `delay=0ms`、`iterationCount=1`、`direction=normal`、`fillMode=none`；循环规格默认
`delay=0ms`、`iterationCount=infinite`、`direction=normal`、`fillMode=none`。

| motion key | 触发条件 | duration | easing | 循环/方向 | 关键帧/分组 |
| --- | --- | ---:| --- | --- | --- |
| `bell` | 打开通知 | 620ms | `cubic-bezier(0.2,0,0,1)` | 1 / normal | `bell`: 0°, -9°, 8°, -5°, 3°, 0°，offset 0/.22/.44/.64/.82/1 |
| `profile` | 打开个人 | 480ms | `cubic-bezier(0.2,0,0,1)` | 1 / normal | `portrait`: translateY 0 → -1.5px → .5px → 0，offset 0/.42/.68/1 |
| `export` | 打开导出 | 620ms | `cubic-bezier(0.25,0.8,0.25,1)` | 1 / normal | `frame` 与 `arrow` 分别使用原 Web 微位移路径 |
| `filter` | 打开筛选 | 520ms | `cubic-bezier(0.2,0,0,1)` | 1 / normal | 三条 bar 分别 +2px、-2px、+1px 后回零，offset 0/.46/1 |
| `locate` | 点击定位 | 520ms | `cubic-bezier(0.2,0,0,1)` | 1 / normal | `rotor` 0° → 90° |
| `department` | 切换科室 | 500ms | `cubic-bezier(0.2,0,0,1)` | 1 / normal | `rotor` 0° → 90° |
| `people` | 切换人员 | 520ms | `cubic-bezier(0.2,0,0,1)` | 1 / normal | `primary` 0 → -.75px → 0；`secondary` 0 → +1px → 0 |
| `phone` | 点击拨号/展开电话 | 620ms | `cubic-bezier(0.2,0,0,1)` | 1 / normal | 0° → -8° → 7° → -3° → 0°，offset 0/.26/.52/.74/1 |
| `navigation` | active 导航 | 1800ms | `ease-in-out` | infinite / normal | check path 的 opacity/dash draw；小程序 image 使用兼容层 |
| `more-stagger` | active 更多 | 1800ms | `ease-in-out` | infinite / normal | dot-one delay 0，dot-two +100ms，dot-three +200ms；上下位移 ±2px |

### 平台适配边界

- Web `SharedIcon` 输出真实 SVG DOM，`data-part` 可直接命中 path/group；不会执行小程序 WXML 或复制浏览器
  事件代码。
- 小程序不能可靠地选择外部 `<image>` 内部 SVG 的 path/group，因此筛选 bar 使用同一个 catalog 的三个
  part asset 叠放；电话、bell、profile、department、people 使用 image/wrapper 兼容实现。
- `stroke-dashoffset`、外部 image 内部 group transform 不能在小程序 image 外部等价复现；B1.1 的 calendar
  兼容层只执行 canonical opacity `.3 → 1 → .3`，不再以 `scaleX` 改变几何，并复用 1800ms/ease-in-out/infinite。
  calendar draw 仍需真机确认；people 已拆为同源 primary/secondary
  part asset，两个位移关键帧均由平台层执行。
- `prefers-reduced-motion`/小程序 reduced-motion 规则保留；关闭状态和点击状态不改变业务异步路径。

## 单一来源目录和边界

```text
packages/ui-icons/
  src/types.ts                         # IconKey、节点、来源/许可证、颜色角色
  src/catalog.ts                       # Web path/TDesign path 的唯一几何目录
  src/motion.ts                        # duration/delay/easing/keyframe/循环规格
  scripts/generate-miniprogram-assets.mjs
                                        # 只生成小程序静态兼容资产并清理旧生成物
apps/web/src/components/
  SharedIcon.vue                       # Web SVG root、viewBox、stroke 元数据
  SharedIconPart.vue                   # path/circle/rect/group 递归渲染
apps/web/src/features/layout/WorkbenchNavIcon.vue
apps/web/src/components/LucideMinimalActionIcon.vue
                                        # 业务组件边界，保留触发 API，不保存第二套 path
apps/miniprogram/src/assets/icons/ui-*.svg
                                        # generated；业务 WXML 只引用，不手改
```

颜色使用 `packages/ui-tokens` 的 primary/secondary/muted/success/favorite 等角色；需要 active/inactive
差异时生成同一 sourceKey 的 token variant，而不是复制 path。小程序的 44 个 SVG 都包含生成标记、
source revision 和 nodes content hash，生成器会删除自己生成但已不在 manifest 的旧 `ui-*` 文件。

## 三类迁移结论

### 可直接共享

- 24×24 viewBox、path/circle/rect/group 节点、strokeWidth、linecap、linejoin、pathLength、fill rule。
- Web 导航、动作和 TDesign 的真实几何 path；TDesign 只作为已确认的上游来源/许可证，不作为小程序运行时依赖。
- 颜色角色和 motion specification 的数值元数据。

### 需要平台适配

- Web 用 SVG DOM；小程序用构建时生成 SVG 文件，不能使用 Web component、DOM selector 或 CSS `:deep`。
- 外部 image 的内部 path/group 动效改由 part asset、image wrapper 或明确的静态降级承载。
- 小程序状态色用生成的 muted/primary/success 文件选择，不依赖 `currentColor` 穿透 image。
- 小程序原生 `picker`、`scroll-view`、`ui-sheet` 的触摸/关闭/安全区由原有平台组件继续负责，图标只负责视觉数据。

### 暂不建议迁移

- PWA 192/512/maskable 安装图。
- Logo/品牌 mark、loading ring、时间线圆点、表格方向/说明文案字符；它们不是当前跨端页面图标来源，迁移会扩大范围或改变语义。
- 任何没有 Web 真实来源、只能凭视觉猜测的 visitor/test 专用新图形；本批复用已有 User/Info/Calendar 语义并记录体验版决策点。

## 包体与启动预算

| 指标 | 最新 main 基线 | B1 候选 | 变化 | 预算/判断 |
| --- | ---:| ---:| ---:| --- |
| Mini 总包 | 5,151,893 B | 5,168,783 B | +16,890 B / +0.33% | 预算为 ≤ +64 KiB；通过 |
| Mini 主包 | 1,715,719 B | 1,730,788 B | +15,069 B | 仍有既有 1.5 MB internal warning；本批未新增 warning 类别 |
| `subpackages/scheduling` | 425,318 B | 425,985 B | +667 B | 无明显回归 |
| `subpackages/organization` | 1,053,334 B | 1,053,533 B | +199 B | 人员双 part 资产增加有限 |
| `subpackages/workflows` | 833,720 B | 834,005 B | +285 B | 无明显回归 |
| `subpackages/insights` | 1,071,781 B | 1,072,333 B | +552 B | 无明显回归 |
| generated SVG assets | 旧 `web-*` 约 7,218 B | 44 个约 20,654 B | +13,436 B | ≤ 24 KiB 静态资产预算；通过 |
| Web shared icon chunk | 无 catalog chunk | raw 12.73 KiB / gzip 4.63 KiB | 新增 | 无运行时第三方依赖；在 Web build warning 范围内可接受 |

### B1.1 follow-up 包体

| 指标 | B1 `.81` 候选 | B1.1 本地候选 | 变化 | 判断 |
| --- | ---:| ---:| ---:| --- |
| Mini 总包 | 5,168,783 B | 5,169,730 B | +947 B | ≤16 KiB follow-up 预算；通过 |
| Mini 主包 | 1,730,788 B | 1,731,703 B | +915 B | 既有 1.5 MB warning，无新增类别 |
| 本批 8 个新增/变化 SVG 源资产 | 2,876 B | 3,739 B | +863 B | ≤8 KiB 资产预算；通过 |
| 文件数 | 300 | 302 | +2 | 两个 calendar secondary variant，无运行时依赖 |

基线/候选均为静态 Node package audit；真实冷启动、内存、帧率和 Skyline renderer 开销当前工具无法测量，
暂未验证。若体验版证据显示首屏或切页回归，优先减少非首屏生成资产或按分包边界延迟加载，不复制页面私有版本。

## 风险拆分与实施批次

| 批次 | 范围 | 风险 | 停止条件/验收 |
| --- | --- | --- | --- |
| B1（本分支） | catalog/types/motion、Web adapters、底部/顶部/更多/通讯录/日历/身份/工作流优先图标、旧副本清理 | 低到中；可能有尺寸/颜色/外部 image 动效差异 | TypeScript、契约、全量 Mini tests、Web build、Mini build/verify、包体预算通过；不改变业务行为 |
| B1.1（本分支） | `.81` 日历 adapter 与通讯录模式资产的视觉规格补齐 | 低；日历 dash 只能 opacity 降级 | 精确契约旧实现 3 红/1 绿、修复后 4/4；Mini 120 files/650 tests、包体和构建门禁通过；待新体验版 |
| B2（体验版验收） | 用 B1 候选在 Xiaomi 14 Android 微信体验版确认视觉、active-only loop、下拉/关闭、safe-area 和 reduced motion | 中到高；依赖原生 renderer/微信版本 | 只接受匹配 SHA、renderer、基础库、微信版本和构建时间的用户证据；发现回归则回 B1 修复，不继续扩大范围 |
| B3（按需） | P3 状态字符/品牌或 visitor/test 专用图标的产品决策 | 中；可能改变语义/品牌边界 | 先有设计确认和真实来源，再单独红绿测试；不与 B1/B2 混批 |

## 第一实施批次精确 Prompt

以下是可直接用于后续执行/复核的 B1 Prompt，范围与本分支实现保持一致：

> `EXP-ICON-004-B1`：在基于执行时最新 `origin/main` 的独立干净 worktree 中，审计并修复 Web/微信小程序核心图标来源一致性。只允许把 Web 真实 inline SVG/path 和已核对的 TDesign path 结构化到 `packages/ui-icons/src/catalog.ts`，把 duration/delay/easing/iteration/direction/fill/reduced-motion 结构化到 `packages/ui-icons/src/motion.ts`，颜色只从 `packages/ui-tokens` 取值。Web 新增 `SharedIcon`/递归 part adapter，保留现有导航和动作组件 props/触发条件；小程序通过生成器输出 `ui-*.svg`，WXML 只引用生成资产，不能把 React/DOM/CSS 浏览器代码粘贴到小程序。覆盖底部导航、顶部 bell/profile、更多每一行、通讯录 filter/search/close/reset/star/phone、日历 chevron/locate、事件 history、工作流 picker、身份 user/lock；用 part asset 或 image wrapper 适配外部 SVG 的动效限制，但不得重新设计关键帧。先添加在旧源码上失败的 parity contract，再实现至通过；删除前确认无引用的旧 `web-*.svg`。禁止修改业务接口、权限、路由、数据结构；禁止微信开发者工具、体验版上传、正式发布和 production 部署。验收：Mini/Web TypeScript、相关全量测试、Web build、Mini production build、source/package/performance/determinism/verify、format/lint、`pnpm smoke:browser`（若后端不可用记录精确失败）和 `pnpm smoke:check-core`；输出对照表、P0-P3、迁移分类、包体 delta、真机确认清单。`

## 体验版真机必须确认的差异

必须先核对候选短 SHA、`trial` 版本、renderer、基础库、微信版本、构建时间和脏树状态，再在 Xiaomi 14
Android 微信体验版确认：

1. 底部五项 active-only 状态、日历 check draw、换班左右箭头、更多 1800ms stagger；顶部 bell/profile 的触发和回弹。
2. 更多工具所有可见角色/权限下的语义图形、muted/primary 颜色、右箭头对齐和长文案不溢出。
3. 通讯录“科室/人员”切换的静态几何、active/inactive 颜色、500/520ms motion；搜索、筛选、清空、收藏和电话按钮。
4. 日历月/周/列表前后箭头、定位、事件记录入口；筛选三条 bar 是否同 Web path 且在 390px 宽度不抖动。
5. 工作流 picker 的 right/down/up 方向、日期箭头、关闭按钮、滚轮/弹层安全区、返回和 reduced-motion。
6. 身份 user/lock、导出/通知/状态控件及 390×844/小字体/大字体环境；Android 系统返回、刘海/底部安全区。

B1.1 新候选须额外聚焦：日历未激活颜色、激活循环、重复点击无 420ms 弹跳且滚动复位仍生效；人员
active/inactive 颜色与 1.8 线宽、只在切入 employee 时播放一次、520ms 节奏；reduced-motion 下两者均停止非必要动画。

当前不得据此声称 iOS、全部 Android、所有基础库或全平台通过；未取得匹配真机证据前，状态保持“待用户复核”。
