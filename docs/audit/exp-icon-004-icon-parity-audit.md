# EXP-ICON-004：Web 与微信小程序图标及图标动效一致性审计

- 审计日期：2026-09-02（Asia/Hong_Kong）
- 审计基线：`origin/main@359966f7240d2f557b24dd0c1ac61979d6bb8298`
- 调查分支/worktree：`codex/exp-icon-004-audit` /
  `runtime/external-project-worktrees/exp-icon-004-audit`
- 状态：静态审计与迁移设计完成；等待用户审阅第一实施批次的 Prompt
- 范围：Web 生产 UI、微信小程序生产源码、构建包体、动效规格和历史引入点
- 本轮边界：没有修改生产图标实现，没有重跑阶段 0，没有调用微信开发者工具，没有上传体验版，没有部署
  production

## 结论先行

当前没有证据表明图标差异会阻止编译或启动，因此没有 P0。主要问题不是“某个 SVG 画得不够像”，而是
两端在不同时间、不同渲染边界内分别维护了几何、颜色和动效：Web 生产端同时存在本地 inline SVG、
TDesign 图标和 CSS 几何；小程序端同时存在 26 个静态 SVG、CSS/WXML 手绘形状和文本 glyph。部分 path
已经完全相同，但没有可验证的单一源文件，颜色、cap/join、尺寸、组合方式以及触发条件仍会漂移。

建议先建立纯数据的 `packages/ui-icons` 源目录和生成校验，再按垂直链路迁移，而不是一次性替换所有页面。
Web 继续使用 Vue inline-SVG 适配器，小程序继续使用原生 `<image>`/WXML/WXSS 适配器；两端只共享几何、
语义 token 和 motion specification，不共享 React/Vue/DOM/CSS 运行时代码。

严重度摘要：

| 编号        | 严重度 | 发现                                                                                                                                 | 影响                                                                                                |
| ----------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| ICON-P1-001 | P1     | 底部导航由单个 Web inline SVG 与小程序拆分 SVG 组成；active、loop、delay、触发时机不一致                                             | 高频主路径和首屏视觉不一致；小程序日历还会持续循环，未按 Web 的 active-only 规则收敛                |
| ICON-P1-002 | P1     | “更多”中的语义映射不一致：小程序把 groups/manual/backfill/config/events/statistics/export 等多项复用为 profile/calendar/history/bell | 用户通过图标识别入口时会得到错误暗示；属于图标迁移与入口语义的交叉风险，需逐项确认                  |
| ICON-P1-003 | P1     | 动效虽然有相同的局部参数，但两端 actor 结构和状态机不同；小程序对外部 SVG 的 `<image>` 无法驱动内部 path 的 `stroke-dashoffset`      | Web 的 draw/part motion 在小程序上可能退化为整图 opacity/transform，形成“参数相同、效果不同”        |
| ICON-P2-001 | P2     | Web 没有机器可读的几何源；本地 inline SVG、TDesign 和小程序静态文件各自复制 path                                                     | 后续修复仍会产生页面私有版本，无法由校验阻止漂移                                                    |
| ICON-P2-002 | P2     | 颜色、尺寸和描边属性未统一：Mini SVG 多为硬编码颜色；Web 多数为 `currentColor`；chevron、filter、locate、lock 存在几何或 cap 差异    | 主题/状态/缩放下的细微差异可见，且改 token 不能覆盖图片内颜色                                       |
| ICON-P2-003 | P2     | 26 个 Mini SVG 全部从根 `assets/icons` 复制到主包；其中通讯录专用资源约 1,974B，另有孤立 `web-leave-minus.svg`                       | 当前主包已为 1,677,999B，超过内部 1.5MiB warning；共享方案必须防止把更多 runtime 或重复资源放入主包 |
| ICON-P2-004 | P2     | 通讯录 mode 图标、workbench filter、POC phone、多个 chevron/close/check 使用 CSS 或文本近似                                          | 视觉来源无法追溯；其中 mode/filter 是优先页面，POC 与 status glyph 可延后                           |
| ICON-P3-001 | P3     | Storybook Ui2、Poc 页面、旧 dead CSS 和品牌 PNG/CSS 几何未纳入生产统一源                                                             | 不直接影响当前生产主路径，但会继续诱发复制和误迁移                                                  |

## 1. 证据与审计方法

### 1.1 使用的仓库证据

本轮只在干净的独立 worktree 读取和构建，未借用用户主 worktree 的未提交文件。执行过的关键命令及结果：

```text
git fetch origin main
git rev-parse origin/main
  359966f7240d2f557b24dd0c1ac61979d6bb8298
git worktree add -b codex/exp-icon-004-audit runtime/external-project-worktrees/exp-icon-004-audit origin/main
node apps/miniprogram/scripts/build.mjs --profile=production
  [miniprogram-build] production: 276 files written to dist/
node apps/miniprogram/scripts/source-audit.mjs
  [miniprogram-source] passed; worklet directives: 2
node apps/miniprogram/scripts/package-audit.mjs
  [miniprogram-package] passed; total 5113419 bytes
node apps/miniprogram/scripts/performance-budget.mjs
  [miniprogram-performance] passed; tapCellPaths=2
```

构建和静态脚本使用了仓库已有依赖缓存，通过 `NODE_PATH` 指向原工作区的 `node_modules`；没有把依赖、
`dist` 或缓存写入 Git。微信开发者工具 GUI/CLI 按仓库政策禁止由本代理调用，故下文凡是运行时结论均明确
标为“未验证”，不会把 Node 构建当作小米 14 验收。

### 1.3 本轮实际使用的技能与工具能力

- 已成功读取并实际采用 `brainstorming`：先明确审计目标、平台边界和可逆的 source-only 方案；本轮只产出
  设计/计划，不越过用户要求直接实施生产图标替换。
- 已成功读取并实际采用 `systematic-debugging`：对 Web/Mini 调用点做数据流、渲染边界、历史引入点和差异分类，
  用 `git log -S`/`git blame` 定位“分开演进”的根因，而不是用近似截图猜测。
- 已成功读取并实际采用 `miniprogram-development`：遵守原生 WXML/WXSS/TS 边界，优先共享纯数据/token，
  用 Mini build/source/package/performance 脚本做静态证据；没有把 Web DOM/CSS runtime 粘到小程序。
- 成功使用的执行能力：Git、PowerShell、Node 静态构建/审计脚本和仓库补丁编辑；本轮没有调用任何 MCP、微信
  开发者工具 GUI/CLI、真实设备连接、体验上传或 production 部署能力。Web 浏览器 smoke、微信原生冷启动、
  Skyline/WebView 运行时和小米 14 视觉/手势因此均未测量。

### 1.2 根因定位

用 `git log -S` 与 `git blame` 对高频调用点做了引入点追踪：

| 证据                                         | 引入点                                                        | 判断                                                                                               |
| -------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Web `data-source="lucide-animated-pqoqubbw"` | `5b9542a2`，`WorkbenchNavIcon.vue`                            | Web 先形成了本地 Lucide 几何 + pqoqubbw motion 的 inline 组件，但没有抽出跨端纯数据层              |
| Mini `web-bell.svg` 等静态资源               | `3fc41610`、`62e45eb7` 及后续 P8/P9 commits                   | 小程序按页面/阶段逐项复制 SVG，资源名保留了 Web 前缀，却不是由 Web 源生成                          |
| Mini `minimal-bell`、nav motion              | `733e3af6`，`apps/miniprogram/src/pages/workbench/index.wxss` | 后续以 WXSS 重建 Web 动效；对 `<image>` 内部 path 不可见，造成结构性差异                           |
| Mini workbench CSS filter                    | `ad4cfb2c`，后由 `9cdd0a8d` 加动效                            | filter 是三条 CSS bar，不是 Web `LucideMinimalActionIcon` 的 path 数据                             |
| Mini directory mode icon                     | `6b5b30fb`                                                    | 通讯录以 CSS 方块/人形复刻 Web mode icon，未接入同一 path                                          |
| Web action motion                            | `fea129bb` 与 `LucideMinimalActionIcon.vue`                   | Web 将 key remount 与 CSS keyframe 保持在组件内，Mini 以 boolean/timer 分散在 WXML/WXSS/controller |

因此本轮的修复假设是：需要先抽取并校验视觉数据，才能安全判断哪些现有文件只是生成物、哪些是真正的
几何差异；直接重画或批量替换不能解决根因。

## 2. Web 图标来源盘点

### 2.1 生产来源分类

| 来源类别                   | 生产位置/例子                                                                                           | 关键属性                                                                                                                                                                              | 审计结论                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 本地 inline SVG / path     | `apps/web/src/features/layout/WorkbenchNavIcon.vue`                                                     | 16 个导航 key；24×24；`fill="none"`；默认 `stroke: currentColor`；`stroke-width:2`；round cap/join；active actor 用本地 CSS motion                                                    | 是当前 Web 导航几何和动效的最高优先真实来源，但尚未机器可读、尚未被 Mini 生成                             |
| 本地 inline SVG / path     | `apps/web/src/components/LucideMinimalActionIcon.vue`                                                   | bell/profile/filter/locate/department/people 为 inline；export/phone/profile 使用 TDesign path；默认 24×24；动作尺寸由 `--action-motion-icon-size` 覆盖                               | 是 Web 顶部、日历、通讯录动作的主要来源；一个组件内已混合两种来源，需在 catalog 中拆成几何元数据          |
| TDesign Vue icon component | `tdesign-icons-vue-next` 直接 import                                                                    | `LockOnIcon`、`UserIcon`、`FilterIcon`、`FilterClearIcon`、`SearchIcon`、`CloseIcon`、`HistoryIcon`、`StarIcon`/`StarFilledIcon`、chevrons、`CallIcon`、`LogoutIcon`、状态/导出图标等 | 不是跨端运行时来源；其中很多 path 已可逐字抽取到共享 catalog，保留 TDesign 作为 Web adapter/未迁移 legacy |
| CSS 几何                   | `base.css` 品牌 mark、Login/Guest mark；`GroupSwitcher.vue` arrow；部分 picker chevron                  | plus 两条 bar、border arrow、text `›`/`×`；transition 多用 `--ui-duration-fast`                                                                                                       | 简单品牌/布局几何可继续 CSS 适配；语义 icon 不应继续新增 CSS 私有副本                                     |
| 图片资源                   | `apps/web/public/icons/icon-192.png`、`icon-512.png`、`maskable-512.png`                                | PWA manifest 图标                                                                                                                                                                     | 产品 mark/安装图标，不是页面语义 icon；暂不迁移到 Mini icon catalog                                       |
| sprite                     | Web 生产源码没有 `<use>` 或 sprite 文件                                                                 | 未发现                                                                                                                                                                                | 不存在                                                                                                    |
| 字体图标                   | Web/Mini 源码没有 `@font-face`、`.woff`/`.ttf` icon font                                                | 未发现                                                                                                                                                                                | 不存在                                                                                                    |
| 第三方 icon runtime        | Web 仅有 `tdesign-icons-vue-next` / `tdesign-vue-next`；没有 lucide runtime、iconify、heroicons runtime | Lucide/pqoqubbw 仅作为 path/motion 参考并由本地组件承载                                                                                                                               | 不新增第三方运行时；license/source map 需随 catalog 保留                                                  |

### 2.2 Web 生产名称、页面和尺寸

| 语义 key                                                                                  | Web 生产位置                                          | 常见页面/状态                                  | 尺寸与视觉属性                                                                                  |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `calendar`, `calendar-check`                                                              | `WorkbenchNavIcon.vue`                                | Workbench 底部/桌面导航；calendar active actor | 24×24；sw2；round/round；`currentColor`；check actor 使用 `pathLength=1` draw                   |
| `directory`, `groups`, `members`                                                          | `WorkbenchNavIcon.vue`、`LucideMinimalActionIcon.vue` | 底部通讯录、更多入口、通讯录 mode              | 24×24；sw2；round/round；`currentColor`；`groups` 与 mode people 是不同几何语义                 |
| `swap`, `duty`, `leave`, `backfill`, `manual`, `events`, `statistics`, `config`           | `WorkbenchNavIcon.vue`                                | 底部/更多工作区入口；active actor              | 24×24；sw2；round/round；`currentColor`；部分 actor 使用 opacity/draw/transform                 |
| `notifications`, `bell`                                                                   | `WorkbenchNavIcon.vue`、`LucideMinimalActionIcon.vue` | 顶部通知、更多通知入口、未读触发               | 导航 24×24；动作默认约 21.6/24；sw2；round/round；bell 620ms                                    |
| `profile`, `user`                                                                         | 两个 Web 组件及 Login                                 | 顶部个人、底部我的、登录账号                   | 20–24px；TDesign User 默认 square cap，Workbench local user 为 round cap；Mini 目前固定蓝色 SVG |
| `filter`, `locate`, `phone`, `export`                                                     | `LucideMinimalActionIcon.vue`                         | 日历筛选/回到今天、通讯录拨号、导出            | 16–20px 动作尺寸；sw1.8 或 sw2；多为 `currentColor`；各自有 500–620ms motion                    |
| `chevron-left/right`, `close`, `search`, `filter-clear`, `history`, `star`, `star-filled` | TDesign direct imports                                | 日历/通讯录/历史/收藏/导出 sheet               | 16–22px，视组件上下文；TDesign 多为 sw2、square cap；path 由 TDesign 包提供                     |
| `lock`, `logout`, `download`, `info`, `error`, `wifi-off`                                 | TDesign direct imports                                | 登录、我的、离线/状态/导出                     | 18–20px 或组件默认 1em；由 TDesign SVG 及状态组件控制                                           |

### 2.3 Web 生产动效状态机

Web 动效没有独立 runtime；动作发生时递增 `motionKey`，通过 key remount 重播一次性 CSS；导航则根据
`looping=item.id===activeTab` 只让当前 active item 循环。`prefers-reduced-motion: reduce` 会关闭装饰性
icon animation，`preview-motion` 仅供 Storybook 预览覆盖。

生产 motion 参数详见第 5 节；重要的是它们目前写在 Vue/CSS 组件中，不在 `@schedule/ui-tokens` 或
机器可读的共享文件中。Web 源码文档 `apps/web/docs/navigation-icon-sources.md` 已注明 Lucide ISC 几何、
pqoqubbw MIT motion 参考，但没有 path checksum 或生成关系，不能阻止小程序复制后漂移。

## 3. 微信小程序当前来源盘点

### 3.1 资源与构建事实

| 项目                                              |                                                                       实测结果 |
| ------------------------------------------------- | -----------------------------------------------------------------------------: |
| `apps/miniprogram/src/assets/icons` 静态 SVG 数量 |                                                                             26 |
| 源 SVG 总字节数                                   |                                                                         7,218B |
| 构建文件数                                        |                                                                            276 |
| 26 个 SVG 的当前输出位置                          |                        全部被 `copyStaticFiles` 复制到主包 `dist/assets/icons` |
| Mini icon runtime 依赖                            |                                         无；使用原生 WXML/WXSS/TS 和 `<image>` |
| 当前主包                                          | 1,677,999B，超过内部 1.5MiB warning，但低于 1.8MiB block / 2MiB official limit |

静态 SVG 的源文件名带有 `web-`，但不是从 Web 文件生成的。资源内部多为硬编码颜色，因此即使 path
相同，也不能直接随 Web `currentColor` 或共享 token 改色。`<image>` 是替换元素，WXSS 只能控制图片
外框的尺寸、opacity、transform 等，不能选择其中的 `<path>` 继续执行 `stroke-dashoffset`。

### 3.2 Mini 静态 SVG 清单

下表是源码资产的逐文件盘点；“使用/状态”按当前生产 WXML/TS 静态引用归纳，未引用但被构建复制的文件也
单列。`round/round` 表示 `linecap/linejoin`，`square/—` 表示文件显式 square cap、未显式设置 join。

| 文件/key                         | 使用/状态                                                       | viewBox / 尺寸 | stroke / fill / sw               | cap/join     | Web 关系与结论                                                                                    |
| -------------------------------- | --------------------------------------------------------------- | -------------- | -------------------------------- | ------------ | ------------------------------------------------------------------------------------------------- |
| `web-bell.svg`                   | workbench 顶部、通知/更多入口；24px；静态 + wrapper bell motion | 24×24          | `#1f5aa6` / none / 2             | round/round  | bell path 与 Web action bell 相同；可共享 path，颜色需 token 化；导航 bell 另有 Workbench 几何    |
| `web-calendar.svg`               | 日历、manual/config/events/statistics 等多个更多入口；24px/20px | 24×24          | `#1f5aa6` / none / 2             | round/round  | calendar geometry 可共享；更多入口复用造成语义差异，P1                                            |
| `web-calendar-check.svg`         | 日历底部 nav actor；20–24px                                     | 24×24          | `#1f5aa6` / none / 2             | round/round  | path 与 Web calendar-check actor 相同；外部 image 无法完成 Web 内部 draw                          |
| `web-chevron-left.svg`           | workbench/calendar/workflow；20px                               | 24×24          | `#1f5aa6` / none / 2             | round/round  | Mini Lucide-like path；Web TDesign 为 square cap、半像素位置不同，P2                              |
| `web-chevron-right.svg`          | 同上；20px                                                      | 24×24          | `#1f5aa6` / none / 2             | round/round  | 同上；跨主包/多个分包复用，保留为 common generated asset                                          |
| `web-directory.svg`              | 底部通讯录 nav；24px                                            | 24×24          | `#1f5aa6` / none / 2             | round/round  | 与 Web directory 几何等价；Web currentColor、Mini fixed color                                     |
| `web-directory-filter.svg`       | organization directory filter open/disabled；18px               | 24×24          | `#0a66d5` / none / 2             | square/round | 与 TDesign Filter path exact；可共享 path，Mini 应由 semantic color 生成                          |
| `web-directory-filter-clear.svg` | organization filter sheet reset；20px                           | 24×24          | `#0a66d5` / none / 2             | square/round | 与 TDesign FilterClear path exact；可共享 path                                                    |
| `web-directory-phone.svg`        | directory-entry-card 拨号；17px；点击一次 motion                | 24×24          | `#0a66d5` / none / 2             | 默认/round   | 与 TDesign Call path exact；Mini wrapper motion 与 Web 时序相近                                   |
| `web-directory-search.svg`       | directory 搜索；22px                                            | 24×24          | `#6b7785` / none / 2             | square/—     | 与 TDesign Search path exact；颜色固定，未直接沿用 Web currentColor                               |
| `web-directory-close.svg`        | directory 搜索清除；18px                                        | 24×24          | `#5e6a78` / none / 2             | square/—     | 与 TDesign Close path exact；Web 使用 TDesign，Mini 使用图片                                      |
| `web-directory-star.svg`         | 未收藏；21px                                                    | 24×24          | `#6b7785` / none / 2             | square/round | 与 TDesign Star path exact；可共享 path/token                                                     |
| `web-directory-star-filled.svg`  | 已收藏；21px                                                    | 24×24          | none / `#d49300` / —             | —/—          | 与 TDesign StarFilled path exact；fill 应变为 shared semantic token                               |
| `web-duty.svg`                   | workbench duty 更多入口；24px                                   | 24×24          | `#64748b` / none / 2             | round/round  | path 与 Web duty actor 相同；更多入口单独图标可共享                                               |
| `web-history.svg`                | workbench event action、exports 更多入口；16/24px               | 24×24          | `#5e6a78` / none / 2             | square/—     | 与 TDesign History path exact；event action 当前 `handleUnavailable`，功能状态不是 icon-only 问题 |
| `web-leave.svg`                  | leave 更多入口；24px                                            | 24×24          | `#64748b` / none / 2             | round/round  | base 与 Web leave 相同，但没有 Web leave-minus actor                                              |
| `web-leave-minus.svg`            | 当前未发现 WXML 使用；孤立资产                                  | 24×24          | `#64748b` / none / 2             | round/round  | 与 Web leave actor 相同；暂不删除，迁移时由 source map 判断                                       |
| `web-locate.svg`                 | workbench/calendar 回到今天；20px                               | 24×24          | `#1f5aa6` / `#1f5aa6` center / 2 | round/round  | 几何与 Web locate 等价；Mini 20px fixed blue，Web action 16px currentColor                        |
| `web-lock.svg`                   | identity password；20px                                         | 24×24          | `#1f5aa6` / none / 2             | square/round | 手工简化版；与 Web TDesign LockOn 的坐标和横线不同，P2                                            |
| `web-more.svg`                   | more 主点；24px                                                 | 24×24          | `#64748b` / none / 2             | round/round  | 仅一个中心点，需与 secondary/tertiary 组合；Web 为单 SVG 三点                                     |
| `web-more-secondary.svg`         | more 第二点；24px                                               | 24×24          | `#64748b` / none / 2             | round/round  | 拆分 actor；Mini delay 与 Web 不同                                                                |
| `web-more-tertiary.svg`          | more 第三点；24px                                               | 24×24          | `#64748b` / none / 2             | round/round  | 拆分 actor；Mini delay 与 Web 不同                                                                |
| `web-phone.svg`                  | workbench 日历详情拨号；16px                                    | 24×24          | `#238636` / none / 2             | 默认/round   | 与 Call path 相同但为硬编码绿色；directory-phone 还有蓝色变体，需收敛为 token                     |
| `web-profile.svg`                | 顶部、底部、更多 profile、identity account；20–24px             | 24×24          | `#1f5aa6` / none / 2             | square/round | 与 TDesign User geometry exact；Web Workbench local profile 为 round，需明确 canonical cap        |
| `web-swap.svg`                   | 底部 swap 主 actor；24px                                        | 24×24          | `#64748b` / none / 2             | round/round  | 与 Web swap actor 相同；Mini 拆成两张 image                                                       |
| `web-swap-secondary.svg`         | 底部 swap 次 actor；24px                                        | 24×24          | `#64748b` / none / 2             | round/round  | 与 Web swap actor 相同；Mini keyframe/状态需适配                                                  |

### 3.3 Mini CSS/WXML/text 来源

| 位置                                                   | 当前实现                                             | 结论                                                                                       |
| ------------------------------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `pages/workbench/index.wxml/.wxss` filter              | 三条 `<view>` bar；宽度约 13/8/4px、sw2 视觉；520ms  | 与 Web filter 的 16/10/4 path 不同；应改为共享 geometry 生成的静态资源或明确的 CSS adapter |
| workbench 旧 `.nav-*-before/after`、`.chevron-line` 等 | 已被后续 image 规则隐藏或 WXML 不再引用，但仍在 WXSS | dead/manual history，迁移清理批次处理，不在本轮删除                                        |
| organization directory mode                            | 四个方块 department；CSS 人形 people；500/520ms      | 与 Web inline path/circle 非同一几何；优先适配为 canonical asset + actor wrapper           |
| workflow picker / sheet / filter close                 | `›`、`×`、`✓` 等 text glyph                          | 不具有稳定 stroke/尺寸；close/check 可生成共享 asset，sheet 的“完成/取消”文字不应误当图标  |
| `pages/calendar-poc`                                   | CSS 手绘 phone；测试/Poc 路由且注册在 main           | P3 重复来源；先保留测试行为，迁移 cleanup 时改为明确 fixture 或 shared asset               |
| profile/identity/status                                | avatar、`✓`、`i`、`!` 等文字/内容                    | 与页面状态语义相关，不应在本批直接替换；需另列 status icon catalog/真机验收                |

## 4. Web/Mini 对照清单与差异严重度

以下按用户要求的页面优先级排列。尺寸为当前源码上下文中的 CSS/WXML 尺寸，不是设备像素；颜色为
默认生产值。`P1` 表示高频/关键路径的明显一致性或语义风险，`P2` 表示应在迁移中收敛但可分批，`P3`
表示低风险重复或非生产路径。

| 语义/图标                          | Web 生产事实                                                                                                            | Mini 当前对应                                                                                                                  | 差异与严重度                                                          | 迁移结论                                                                                          |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 底部 `calendar` + `calendar-check` | `WorkbenchNavIcon` 单个 24px inline SVG；active 时 actor draw；只在 active Tab loop，默认 nav motion 约 1800ms infinite | `web-calendar.svg` + `web-calendar-check.svg` 两张 24px image；calendar `is-looping` 常驻；Mini draw selector 作用在 `<image>` | 组合层级、loop 条件、draw 能力不同；P1                                | 共享 calendar/check path 与 motion spec；Mini 用生成 asset + actor wrapper，先做 active-only 回归 |
| 底部 `directory`                   | Web 24px inline contact；静态，不 loop                                                                                  | Mini `web-directory.svg` 24px fixed `#1f5aa6`                                                                                  | 几何大体一致，color/currentColor 与 cap 需收敛；P2                    | 共享 path/token，低风险迁移                                                                       |
| 底部 `swap`                        | Web 一个 inline icon，左右 actor；active loop/actor delay 100/200 体系                                                  | Mini `web-swap.svg` + `web-swap-secondary.svg`；一次 520ms；direction/keyframe 与 Web 不是同一状态机                           | 结构、duration、delay、loop 不同；P1                                  | 共享两 actor path 与 spec；Mini 保留双 image adapter，不复制页面 SVG                              |
| 底部 `profile`                     | Web 24px local user/currentColor，mobile 23px；active loop                                                              | Mini `web-profile.svg` 24px fixed blue；`profileAnimating` boolean                                                             | geometry 接近；颜色、cap、触发状态不同；P1                            | 共享 User geometry；先对齐颜色/尺寸/active trigger                                                |
| 底部 `more`                        | Web 一个三点 inline SVG，主点/次点/第三点 delay 100/200，active loop                                                    | Mini 三张拆分 image；520ms one-shot，delay 80/160；更多项打开时另有 motion                                                     | 高可见动效差异；P1                                                    | 共享 dot parts 与 Web spec；Mini actor adapter                                                    |
| 顶部通知 `bell`                    | `LucideMinimalActionIcon` 21.6/24px；620ms；角度 0/-9/+8/-5/+3/0；触发打开通知                                          | `web-bell.svg` 24px；same-looking wrapper keyframe；硬编码蓝色                                                                 | path 近似/部分相同；wrapper 可复现旋转，颜色不随 currentColor；P2     | 共享 bell path/spec，Mini colorize generated SVG                                                  |
| 顶部个人 `profile`                 | action/user 20px，TDesign/User 与 local user 混用；480ms translateY 0/-1.5/+0.5/0；触发打开 profile                     | `web-profile.svg` 24px；静态 image，只有页面 `profileAnimating` 时 wrapper                                                     | 尺寸/触发效果不一致，path 可能同源；P1                                | 共享 User geometry；按 action/nav 两个 size preset 适配                                           |
| 更多 `groups`/团队                 | Web `groups` 人员 icon；更多 item 使用独立 key                                                                          | Mini “群组设置”复用 `web-profile.svg`                                                                                          | 语义几何错误；P1                                                      | 共享 Web groups path，生成 Mini asset；不要复用 profile                                           |
| 更多 `manual`                      | Web `manual` table/grid icon                                                                                            | Mini “手动排班”复用 calendar                                                                                                   | 语义错误；P1                                                          | 共享 manual path，迁移 B4                                                                         |
| 更多 `backfill`                    | Web circular backfill + clock actor                                                                                     | Mini “补录”复用 history                                                                                                        | 近似但不是同一语义；P2                                                | 共享 backfill path/motion，迁移 B4                                                                |
| 更多 `leave`                       | Web calendar-minus/base + minus actor                                                                                   | Mini `web-leave.svg` 仅 base                                                                                                   | actor 缺失、状态语义丢失；P2                                          | 共享 leave + leave-minus parts                                                                    |
| 更多 `duty`                        | Web duty 24px；actor/静态路径                                                                                           | Mini `web-duty.svg`；几何相同，颜色 fixed secondary                                                                            | 差异主要为 token/color；P2                                            | 直接共享 path/token                                                                               |
| 更多 `config`                      | Web gear/config actor                                                                                                   | Mini “排班配置”复用 calendar                                                                                                   | 语义错误；P1                                                          | 共享 config path，迁移 B4                                                                         |
| 更多 `events`/事件                 | Web list/events icon                                                                                                    | Mini “事件与统计”复用 calendar                                                                                                 | 语义错误；P1                                                          | 共享 events path；与 event feature status 分开验收                                                |
| 更多 `statistics`                  | Web chart-line/statistics icon                                                                                          | Mini 同样复用 calendar                                                                                                         | 语义错误；P1                                                          | 共享 statistics path，迁移 B4                                                                     |
| 更多 `notifications`               | Web bell/notification icon                                                                                              | Mini bell asset                                                                                                                | 可能可共享，但 Web nav bell 与 action bell 需选定 canonical alias；P2 | path source map 记录 variant，不按文件名猜同源                                                    |
| 更多 `export`                      | Web TDesign Export 20px + 620ms arrow/frame                                                                             | Mini “导出”复用 history                                                                                                        | 语义错误且无 export motion；P1                                        | 共享 TDesign Export path/spec，迁移 B4                                                            |
| 更多 `visitor/invite/access`       | Web 有明确 action/通知/访问语义组合                                                                                     | Mini invite/visitor/platform 多项复用 bell/calendar/profile                                                                    | 入口识别差异；P2                                                      | 先定义语义 key，再迁移，避免用相似图标填坑                                                        |
| 日历 chevron                       | Web TDesign 20px/16px；square cap；path `M14.5 17.5L9 12L14.5 6.5` 等                                                   | Mini 20px image；round cap；path `m15 18-6-6 6-6` 等                                                                           | cap、半像素、path 位置、颜色不同；P2                                  | 共享一个 canonical chevron；Web/Mini 各自 renderer                                                |
| 日历 locate                        | Web action 16px，currentColor；520ms rotate 0→90                                                                        | Mini 20px fixed blue image；同 520ms wrapper rotate                                                                            | 几何接近，尺寸/color/内部 fill 不同；P2                               | 共享 path/spec，按 context size/color 生成                                                        |
| 日历 filter                        | Web inline `M4 6h16 / M7 12h10 / M10 18h4`，20px、sw1.8、round；520ms 三 actor                                          | Mini CSS bars 约 13/8/4，sw2；520ms，CSS view actor                                                                            | geometry 不同；Mini 不能从 Web path 生成当前 CSS；P2                  | 共享 filter path，优先生成 SVG；保留 CSS 仅作明确 fallback                                        |
| 通讯录 filter/search/close/reset   | Web TDesign Filter/Search/Close/FilterClear，18–22px，currentColor/TDesign square cap                                   | Mini 四个独立 SVG，几何 path 多数 exact；硬编码蓝/灰                                                                           | 几何可复用，颜色及文件复制关系不统一；P2                              | 直接共享 TDesign path 数据，生成 org adapter                                                      |
| 通讯录 mode `department`/`people`  | Web action inline path/circle；500/520ms                                                                                | Mini CSS 四格/人形；同大致时序                                                                                                 | 几何不是同一数据，动效 actor target 不同；P2                          | 共享 path/parts；Mini actor wrapper，先做静态再 motion                                            |
| 通讯录 favorite                    | Web TDesign Star/StarFilled，21px                                                                                       | Mini `web-directory-star*` 21px，path exact                                                                                    | 几何可复用，仅 token/fill 需收敛；P2                                  | 共享 path/token                                                                                   |
| 通讯录 phone                       | Web Call/TDesign path，17px，currentColor，620ms rotate                                                                 | Mini `web-directory-phone.svg` 17px，#0a66d5，620ms wrapper                                                                    | 时序大致一致；颜色和内部 path 控制方式不同；P2                        | 共享 Call path/spec，Mini image wrapper                                                           |
| 事件记录 history                   | Web TDesign History 16px；点击打开 EventCenter                                                                          | Mini `web-history.svg` 16px；当前工作台 handler 为 unavailable                                                                 | 视觉 path exact，但功能状态不一致；P2（icon）/另记业务 P1             | icon 可直接共享；功能不在本轮图标迁移内                                                           |
| 工作流/更多 back                   | Web TDesign chevron 或 local back                                                                                       | Mini 多处 `web-chevron-left.svg`                                                                                               | cap/path/context size 不一致；P2                                      | 统一 chevron source，页面 adapter                                                                 |
| filter sheet close / picker close  | Web TDesign Close 或文字 `×`，视组件而定                                                                                | Mini 多处文字 `×` 或“完成/取消”                                                                                                | glyph 非稳定图标；P2（close）/不迁移 sheet action 文案                | close icon 可共享；action 文案保持文本                                                            |
| identity user/lock                 | Web Login `UserIcon` + `LockOnIcon` 20px                                                                                | Mini profile asset + 手工简化 `web-lock.svg` 20px                                                                              | user geometry exact；lock 坐标/横线不同；P2                           | user 共享；lock 以 TDesign path 为基准，真机确认                                                  |
| profile logout/status/info         | Web Logout/状态组件/TDesign；Mini 多为文本按钮或 `✓/i/!`                                                                | 对应关系不完整                                                                                                                 | 属于状态/账户功能语义，不宜在 icon batch 盲替；P3/P2                  | 后续单独 catalog/验收，不纳入 B1                                                                  |

## 5. 动效规格对照

### 5.1 Web 真实规格

| motion key / 触发               |                                                                 duration | delay / loop / direction                         | easing                                | 关键帧与状态                                                                                    |
| ------------------------------- | -----------------------------------------------------------------------: | ------------------------------------------------ | ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `bell`：打开通知、`motionKey++` |                                                                    620ms | delay 0；一次；normal                            | `cubic-bezier(0.2,0,0,1)`             | rotate `0 → -9 → 8 → -5 → 3 → 0deg`，offset 0/22/44/64/82/100；origin 约 `12px 3px`             |
| `profile`：打开个人             |                                                                    480ms | delay 0；一次                                    | `cubic-bezier(0.2,0,0,1)`             | translateY `0 → -1.5 → .5 → 0px`，offset 0/42/68/100                                            |
| `export`：打开导出              |                                                                    620ms | delay 0；一次                                    | `cubic-bezier(0.25,0.8,0.25,1)`       | arrow 与 frame 分 actor；arrow 约 `+2.2/-2.2px`，frame 约 `-.7/+.7px`，由 CSS selector 分别驱动 |
| `filter`：打开日历筛选          |                                                                    520ms | delay 0；一次                                    | `cubic-bezier(.2,0,0,1)`              | top `+2px`、middle `-2px`、bottom `+1px`，约 46% 后归零                                         |
| `locate`：回到今天              |                                                                    520ms | delay 0；一次                                    | `cubic-bezier(.2,0,0,1)`              | rotate `0 → 90deg`                                                                              |
| `department`：通讯录 mode 切换  |                                                                    500ms | delay 0；一次                                    | `cubic-bezier(.2,0,0,1)`              | 四格 actor rotate `0 → 90deg`                                                                   |
| `people`：通讯录 mode 切换      |                                                                    520ms | delay 0；一次                                    | `cubic-bezier(.2,0,0,1)`              | primary x `0 → -.75 → 0`，secondary x `0 → +1 → 0`，约 46% 回零                                 |
| `phone`：点击拨号               |                                                                    620ms | delay 0；一次                                    | `cubic-bezier(.2,0,0,1)`              | rotate `0 → -8 → +7 → -3 → 0deg`，offset 0/26/52/74/100                                         |
| nav active actor：选中 Tab      | 默认 1800ms（apple 2000/android 1500 仅存在 style 选项，生产默认未传入） | active-only；infinite；normal                    | `ease-in-out` 或 motion-specific      | calendar/check draw、swap actor、more dots；Web `looping=item.id===activeTab`                   |
| `more` nav actor                |                                                    同 nav default 1800ms | part delay 100/200ms；active-only；infinite      | `ease-in-out`                         | three dots staggered translate/opacity；不是 Mini 的一次性 520ms                                |
| `GroupSwitcher` / disclosure    |                                                                    120ms | 一次；open 时 rotate 45→225                      | `ease`                                | border arrow translateY ±2px；属于 control affordance，不是 animated SVG                        |
| calendar chevron press          |      120ms transition；部分 list nav 另有 240–260ms directional keyframe | pointer/tap；一次；left/right direction opposite | token ease / `cubic-bezier(.2,0,0,1)` | transform scale/translate；TDesign chevron path 本身不变化                                      |

Web 所有装饰性 icon animation 在 reduced motion 下关闭；按压反馈与业务状态切换需在适配层分别保留，
不能因为关闭 loop 而丢掉点击可见性。

### 5.2 Mini 当前规格与差异

| motion                        | Mini 当前实现                                                                                                                                | 差异判断                                                                                  |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 顶部 bell/profile             | `index.wxss` 有 620ms/480ms、同类 bezier 和近似 keyframe；通过 class/boolean/timer 控制 `<image>` wrapper                                    | 外层 rotate/translate 可适配；不能驱动 SVG 内部 path；触发清理与 Web key remount 不同，P2 |
| 底部 calendar                 | `is-looping` 在 WXML 中常驻；`.nav-icon-actor` 1800ms infinite，包含 opacity/dashoffset 设想                                                 | active-only 条件错误；`stroke-dashoffset` 对 replaced `<image>` 不生效或无法证明，P1      |
| 底部 swap                     | 两张 image；520ms bezier；left 0→-2→0→+1→0，right 相反                                                                                       | Web 是同一 icon 内 parts、active loop、delay 体系；Mini 一次性且无同一 delay，P1          |
| 底部 more                     | 三张 image；520ms ease-in-out；secondary/tertiary delay 80/160ms                                                                             | Web delay 100/200、default infinite；P1                                                   |
| 日历 locate / workflow locate | 520ms bezier rotate0→90；Mini 通过 boolean/timer 重播                                                                                        | timing 可复用；尺寸/color 和 timer 生命周期需 adapter 化，P2                              |
| workbench filter              | 520ms 同类 bezier；bars 使用 transform，触发为 filter toggle                                                                                 | timing 可复用，几何不是 Web path；P2                                                      |
| directory department/people   | department 500ms、people 520ms；controller 清 timer；切换 internal/employee/swiper 都会 replay                                               | 时序基本可映射，但 actor geometry不同；P2                                                 |
| directory phone               | 620ms 同类 bezier；按 number id reset→set，timer 到期清理                                                                                    | 时序接近 Web；目前只动画整张 image，P2                                                    |
| chevron / disclosure          | directory filter chevron 120ms；workbench/group switcher 160ms；calendar/workflow image directional 240ms 左右；picker trigger 无 transition | 同名 control 有多个 duration、path、cap；P2                                               |
| reduced motion                | WXSS 有 `prefers-reduced-motion` 规则，关闭多类 animation/transition                                                                         | 需小米 14/微信版本确认媒体特性实际生效；当前静态证据不等于真机，P2                        |

### 5.3 兼容性结论

共享的不是 Web `@keyframes` 文本，而是平台无关的 motion specification：part 名称、offset、duration、
delay、easing、iteration、direction、fill mode、reduced-motion 策略和触发语义。Web adapter 将其编译为
inline SVG/CSS；Mini adapter 将同一 spec 的可支持属性映射到 WXML actor/image wrapper。

`stroke-dashoffset`、内部 path selector、CSS `currentColor` 传递到外部 SVG 是小程序 image 边界，不能假定
可用。若关键帧包含这些能力，Mini 第一版只使用同一 offset/easing 驱动可观察的 actor opacity/transform，
并在真机上标为“兼容渲染”，不伪称与 Web path draw 像素等价。是否为极少数关键图标引入 WXML canvas/path
renderer，应另立风险批次并先测量性能；本轮不引入 canvas 或大型动画库。

## 6. 共享、适配与暂不迁移分类

### 6.1 可直接共享的视觉数据

这里的“直接共享”指共享一份 path/parts/source metadata，由两端生成各自渲染产物；不是把 Vue 组件或 DOM
代码放入小程序。

- 已经被 TDesign/Web/Mini 证实相同或可逐字抽取的 path：`bell` action、`profile/user`、`filter`、
  `search`、`close`、`filter-clear`、`phone/call`、`history`、`star`/`star-filled`、`duty`、
  `calendar`/`calendar-check`、`directory`、`swap` parts、`leave`/`leave-minus`、`locate`。
- Web `WorkbenchNavIcon.vue` 的 `manual`、`backfill`、`events`、`statistics`、`config`、`groups`、
  `notifications`、`more` parts：以当前 Web path 为 canonical，先记录 source/license，再生成 Mini；
  不能因 Mini 目前没有对应文件而重新临摹。
- `viewBox=0 0 24 24`、part key、stroke width/cap/join、semantic color role、license/source ref 和
  alias（例如 `user`/`profile`）应是同一 catalog 字段。

### 6.2 必须平台适配

| 内容           | Web adapter                                             | Mini adapter                                                                                                    |
| -------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 静态 path      | Vue inline `<svg>`，允许 `currentColor` 与 CSS vars     | 生成 token-colorized SVG，使用原生 `<image>`；禁止页面手写复制                                                  |
| 多 actor 动效  | 一个 SVG 的 `<g data-part>` + CSS keyframes/key remount | 拆分为生成的 actor asset 或 WXML actor wrapper；只把 spec 的 transform/opacity 映射到外层                       |
| path draw      | pathLength/dashoffset                                   | 外部 image 不可选内部 path；保持同一 spec metadata，兼容层降级到支持的属性并标未验证                            |
| currentColor   | 由 Web CSS 继承                                         | 由生成器按 `primary/secondary/success/...` token 烘焙颜色变体，或使用 WXML color layer；不在 SVG 内硬编码页面色 |
| size/context   | `--action-motion-icon-size`、导航 desktop/mobile preset | WXML class / `image` width/height；size 来自 shared icon context token                                          |
| trigger/replay | `motionKey++` + key remount                             | controller/page boolean reset/set + timer；逻辑集中在 adapter，清理 detach/unload                               |
| reduced motion | `prefers-reduced-motion` CSS                            | 保留 WXSS media rule，并以真机确认微信客户端支持；默认关闭装饰 loop 不改变业务状态                              |
| chevron/close  | TDesign 或 catalog inline SVG                           | 生成图片/原生 WXML；文字“完成/取消”保持文本，不把文案当 icon                                                    |

### 6.3 暂不建议迁移

- `apps/web/public/icons/*.png` PWA 安装图标：它们是产品 mark/manifest 资源，不是语义 icon。
- `apps/web/src/stories/ui2/Ui2Icon.vue` 和相关 preview/P3 identity raw SVG：仅 Storybook/preview 视觉草稿，
  几何与生产 `WorkbenchNavIcon` 不同，不能反向成为 Mini 源。
- `apps/miniprogram/src/pages/calendar-poc` 的 CSS phone、foundation/test route 的 glyph：先保持测试 fixture
  可运行，等测试路由是否继续保留确认后再清理。
- status glyph `✓`/`i`/`!`、头像、timeline dot、sheet 的“完成/取消”文字：它们分别属于状态语义、内容或
  文案，不应在本轮用一套页面 icon 替代。
- 尚未列入优先链路的 TDesign `Download`、`InfoCircle`、`ErrorCircle`、`WifiOff` 等：先维持 Web TDesign
  adapter；除非 Mini 出现同页面需求，否则不为“全量统一”引入 Mini 包体。

## 7. 重复资源、手绘近似和无统一来源

### 7.1 已确认重复/漂移

- Mini `web-phone.svg` 与 `web-directory-phone.svg` 共享 Call path，但颜色分别是 `#238636` 与 `#0a66d5`；
  Web 同一 `CallIcon` 由 currentColor 控制。它们应是一个 geometry + 两个 semantic color context，而不是两
  份 source。
- Mini `web-calendar.svg` 被 manual/config/events/statistics 等多个不同语义入口复用；这是“少文件”但不是
  “统一来源”，反而掩盖缺少真实语义图标。
- Mini `web-history.svg` 同时承担 history/event action/export；Web 三者至少存在 History 与 Export 两种
  geometry，属于语义映射错误。
- Mini `web-profile.svg` 同时承担 profile、groups、platform accounts；Web 有 profile/user、groups、id-card
  等不同 geometry。
- Web `WorkbenchNavIcon`、Web `LucideMinimalActionIcon`、TDesign 包、Mini 26 SVG 各自复制同一批 path；
  共享文件名不等于共享数据。

### 7.2 已确认手绘/近似实现

- Mini workbench filter 三条 CSS bar 与 Web filter path 几何不一致。
- Mini directory department/people CSS shapes 与 Web inline actor path/circle 不一致。
- Mini calendar/workflow/group chevrons 有 image、border CSS、text `›` 三种实现。
- Mini close/check/状态多用 `×`、`✓`、`i`、`!` text glyph。
- Mini `calendar-poc` CSS phone 与生产 Call path 重复。
- Workbench WXSS 保留已隐藏的旧 nav pseudo-element、`.chevron-line` 和 locate tick/center 规则；它们增加
  维护噪声和构建字节，但本轮不删除。

### 7.3 无统一来源

当前没有 `packages/ui-icons`、icon manifest、path checksum、motion manifest 或生成器。Web license/source
文档是人工说明；Mini 文件名中的 `web-` 不能证明来源。首批设计必须让新增 icon 没有 catalog/source ref
时无法通过静态检查。

## 8. 推荐单一视觉来源与组件边界

### 8.1 推荐目录

```text
packages/ui-icons/
  src/
    catalog.ts              # semantic key、alias、24×24 viewBox、source/license ref
    geometry/
      workbench.ts          # Web WorkbenchNavIcon 的原始 parts/path
      actions.ts            # Web action 与已核对的 TDesign parts/path
      controls.ts           # chevron/close/search/filter/history/star 等
    motion/
      navigation.ts         # active actor、more stagger、swap direction
      actions.ts             # bell/profile/filter/locate/phone/export 等
    tokens.ts                # icon semantic role 到 @schedule/ui-tokens 的映射
  scripts/
    generate-miniprogram-assets.mjs
  tests/
    catalog.test.mjs
    generated-assets.test.mjs
  docs/
    source-map.md
```

这是建议的 source shape，不是本轮已创建的生产目录。`packages/ui-icons` 只允许纯 TypeScript/JSON-like data
和生成器，禁止 import Vue、React、WXML、WXSS、DOM、TDesign runtime 或动画库。几何字段保存原始 path
字符串，不经过会改变数字精度的自动 beautify；每条 definition 记录 `sourceRef`、`licenseRef`、`sourceSha`
和是否由 TDesign/Lucide/local motion 组成。

### 8.2 两端组件边界

```text
packages/ui-icons (geometry + tokens + motion specs)
        ├── WebIconAdapter (Vue inline SVG/CSS; apps/web)
        └── MiniIconAdapter (WXML/image/WXSS; apps/miniprogram)
             └── generated static assets under the Mini asset build boundary
```

- Web `WorkbenchNavIcon.vue` 和 `LucideMinimalActionIcon.vue` 先变成 adapter/consumer，业务调用仍保留
  `name`、`motionKey`、`looping` 等语义接口；不把页面状态下沉到 shared package。
- Mini 先在不改变页面业务 handler 的前提下消费生成的 assets；actor 拆分和 timer 清理集中在一个 Mini
  adapter/utility，不能由每个页面复制。页面只传 `iconKey`、`sizeContext`、`motionTrigger` 和 semantic role。
- TDesign 仍可作为 Web adapter 的 legacy backend。已生成并校验的 path 逐步改为 catalog source；本轮不为了
  统一而删除 TDesign 依赖或扩大 Web bundle。
- `@schedule/ui-tokens` 继续是颜色/尺寸基础 token source；icon motion duration 和 actor 参数放在
  `ui-icons` motion spec，避免把页面动画细节污染通用 UI token。若未来多个产品使用，再提升到 token 包。
- 生成产物必须标记 generated；不能手改 `dist`，也不能让 organization-only assets 因 generator 默认路径
  再次全部进入 main。

### 8.3 source-of-truth 规则

1. 新 icon 先登记 semantic key 和使用页面，再登记确切 source path/license；不能先在页面里画一个近似版。
2. 一份 geometry definition 可以生成多个 size/color/context 产物；禁止按页面复制同一 path。
3. Motion spec 只描述视觉状态和时间，不描述 Web DOM selector 或 Mini `setData` 字段。
4. Web/Mini adapter 的差异必须写成 capability map（例如 `supportsInternalPathAnimation=false`），不得在
   spec 中悄悄修改 duration、offset、delay 或 easing。
5. 每次生成后做 path/source checksum、asset count、包体 delta 和 diff review；旧文件只有在所有引用迁移并
   通过真机确认后才可删除。

## 9. 包体、启动与运行性能预算

### 9.1 当前基线

| 包范围                     | 当前 bytes | 说明                                                               |
| -------------------------- | ---------: | ------------------------------------------------------------------ |
| main                       |  1,677,999 | 已超过内部 1.5MiB warning；低于 1.8MiB block / 2MiB official limit |
| `subpackages/scheduling`   |    425,318 | 当前构建审计通过                                                   |
| `subpackages/organization` |  1,053,334 | 当前构建审计通过；通讯录图标被主包 asset root 复制                 |
| `subpackages/workflows`    |    832,966 | 当前构建审计通过                                                   |
| `subpackages/insights`     |  1,071,781 | 当前构建审计通过                                                   |
| `subpackages/diagnostics`  |     52,021 | 当前构建审计通过                                                   |
| total                      |  5,113,419 | 低于内部 15MiB warning / 25MiB block / 30MiB official limit        |

当前 26 个 SVG 共 7,218B；其中 organization-only filter/search/close/filter-clear/stars 的源码约 1,974B，
但因为源路径在 root `assets/icons`，构建会随主包复制。`build-manifest.json` 含 build-time 时间字段，不能
作为稳定 checksum 或单独求和依据；以上数字以 `package-audit.mjs` 的同一口径为准。

### 9.2 迁移预算与硬门槛

以本轮实测数为 `B0`，第一至第三实施批次的预算如下：

| 指标                | 预算/门槛                                                                                                     | 原因                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| main                | 不超过 `1,682,095B`（B0 + 4KiB）；不得新增 block；优先通过把 org-only generated assets 移到 organization 降低 | main 已在 warning 区，不能用共享名义把 runtime/大 CSS 放进首屏 |
| 单个 subpackage     | 不超过该包 B0 + 4KiB；不得超过内部 1.8MiB block                                                               | 防止每个分包各复制一套 SVG/animation CSS                       |
| total               | 不超过 `5,121,611B`（B0 + 8KiB）；不新增 warning category                                                     | 共享 source 是 build-time 数据，不能变成多个 runtime bundle    |
| generated SVG       | 首批总源/产物增长不超过 1KiB，或被 moved asset 抵消；不生成每个页面的 color copy                              | 现有 7,218B 已可接受，重复变体应由 generator 控制              |
| Mini runtime JS/WXS | icon adapter 初版新增不超过 2KiB gz/未压缩口径以现有 package audit 为准；不得引入依赖、canvas、逐帧 setData   | 动效应由 WXSS/image wrapper 承担，不增加启动和点击路径逻辑     |
| 首屏/启动           | 不新增网络请求、定时器常驻、页面 JSON、首屏 WXML 深度；active loop 仅在可见 active icon                       | 当前性能脚本不能测原生冷启动，故以结构门槛+真机确认双重控制    |
| Web bundle          | 本轮不改生产 Web consumer，故不宣称有 delta；实施时需记录 build 前后 JS/CSS/gzip delta，超过 4KiB 需复核      | 防止把全部 TDesign/path catalog 运行时打入每个 Web chunk       |

若 generator 为了精确 draw effect 需要大量 frame、canvas 或新增动画库，立即停止当前批次，另立设计；不得在
预算不明时用“共享”掩盖包体或性能回归。

## 10. 按风险拆分的实施批次

| 批次       | 范围                                                                                                                                                              | 风险                     | 完成条件/停止条件                                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| B0（本轮） | 只读盘点、源映射、motion spec、包体预算、真机清单                                                                                                                 | 低；不改生产实现         | 文档与状态文件一致；没有上传/部署；本轮完成后停止                                                                                  |
| B1         | 建立 `packages/ui-icons` 纯数据 catalog、source/license/checksum、motion schema、Mini SVG generator 和静态/预算测试；不替换页面消费者                             | 低                       | 旧 Web/Mini 画面不变；先让 catalog tests 在旧代码上证明缺口，再通过；预算/生成 deterministic；任何未知 source 或包体超门槛即停     |
| B2         | 第一垂直链路：workbench 底部 nav（calendar/directory/swap/profile/more）+ 顶部 bell/profile；共享 path、颜色、size context、active-only 状态和兼容 motion adapter | 高可见但范围窄           | Web Storybook/组件测试、Mini 静态合同、包体通过；用户明确批准后再上传；小米 14 复核 active loop、触发、reduced motion 后才删旧资产 |
| B3         | 日历与通讯录动作：chevron、filter、locate、search/close/reset、department/people、star、phone；按 common/org asset boundary 重新生成                              | 中高；涉及分包和多个交互 | 路由/handler 不变；逐项 visual diff；外部 image actor 兼容差异有记录；真机确认点击重播、滚动和拨号                                 |
| B4         | 更多工作区的真实语义 icon：groups/manual/backfill/leave/duty/config/events/statistics/export/visitor；事件记录功能状态另开业务任务                                | 中高；入口语义风险       | 所有入口 key 有 source map；未能证明语义的项不迁移；不以相似 icon 代替缺失功能                                                     |
| B5         | identity lock、logout/status、workflow/picker close/arrow、dead CSS/孤立资产清理；最终包体和跨端回归                                                              | 中；低优先但清理面大     | 所有引用迁移、source audit/包体/测试通过；用户提供同构建 Xiaomi 14 证据后才标“待用户复核”完成                                      |

批次之间不共享未验收的“顺手重构”。每批都要保留旧实现可回滚，并把“已实现待浏览器复核 → 已完成（含
运行验证）→ 待用户复核”三态写入状态文档。

## 11. 第一实施批次的精确 Prompt

下面的 Prompt 是给下一轮实施代理的边界合同；本轮不执行它：

```text
执行 EXP-ICON-004-B1「canonical icon source foundation」，基线必须是当次最新 origin/main；先读取
docs/project-status.md、docs/audit/STATUS.md、docs/audit/exp-icon-004-icon-parity-audit.md 和本设计/计划。

目标：建立纯数据的 packages/ui-icons，使 Web 与微信小程序以后从同一 geometry/motion source 生成各自
渲染产物。本批只建立 source catalog、生成器、校验和，不替换任何生产页面的 icon consumer，不改变路由、
API、业务状态、WXML handler、页面布局、TDesign 依赖或用户可见结果。

必须覆盖的首批 canonical keys：calendar、calendar-check、directory、groups、swap-left、swap-right、
profile/user、bell、phone/call、chevron-left、chevron-right、locate、filter、search、close、filter-clear、
history、star、star-filled、duty、leave、leave-minus、more-primary、more-secondary、more-tertiary、manual、
backfill、events、statistics、config、export、lock。

实现约束：
1. 只在 packages/ui-icons/src 保存纯 TypeScript/JSON-like geometry、parts、viewBox、strokeWidth、linecap、
   linejoin、fill/stroke semantic role、sourceRef、licenseRef、sourceSha、alias；禁止 import Vue/React/DOM/
   WXML/WXSS/TDesign runtime/动画库，禁止凭视觉重新临摹 path。
2. motion spec 只保存 part key、offset、transform/opacity/dashOffset（若适用）、duration、delay、easing、
   iteration、direction、fillMode、trigger 和 reducedMotion；以当前 Web 生产值为 canonical。不要把 Mini
   `<image>` 的限制偷偷改写成另一套关键帧。
3. 提供 deterministic 的 Mini SVG 生成器和生成校验；生成颜色只能来自 @schedule/ui-tokens 的 semantic
   role，不生成页面私有副本。生成文件必须标记 generated，不能手改 dist；先不要删除或改写现有
   apps/miniprogram/src/assets/icons 文件。
4. 提供测试：catalog key/source/license 完整性、path/source checksum、viewBox 与属性、motion schema、重复
   key/alias、生成结果 deterministic、Mini asset size 预算。必须先让至少一个“缺 source/checksum 或重复 key”
   的回归断言在旧/错误 fixture 上失败，再用实现通过；不能改测试来掩盖。
5. 明确 capability map：Mini external image 不支持内部 path selector/currentColor/stroke-dashoffset；这里只记
   兼容能力，不引入 canvas、逐帧 setData、WXS worklet 或新依赖。
6. 记录现有 Web/TDesign/Mini path 是否 exact；不确定的 geometry 标记 needs-review，禁止自动合并为同一 key。

验证（PowerShell 每次多个 native command 都设置
$ErrorActionPreference='Stop' 和 $PSNativeCommandUseErrorActionPreference=$true）：
- git diff --check；相关单测/纯数据测试；Web typecheck 或 package test（若不改 Web consumer，不需浏览器 smoke）；
- node apps/miniprogram/scripts/build.mjs --profile=production；
- node apps/miniprogram/scripts/source-audit.mjs；
- node apps/miniprogram/scripts/package-audit.mjs；
- node apps/miniprogram/scripts/performance-budget.mjs；
- 记录 B1 前后 main/subpackage/total bytes、最大文件和未测量的原生冷启动/真机项。

停止条件：发现需要改变 path 语义、引入新 runtime/canvas、任何包体超过本审计预算、生成器不能保持
deterministic、source/license 不可追溯，或需要修改生产 consumer 时，停止并报告，不扩展到 B2。不得调用微信
开发者工具，不上传体验版，不部署 production。完成后只提交 B1 范围内文件，并等待 B2 的明确批准。
```

## 12. 必须由体验版/小米 14 真机确认的差异

本轮只能证明源码、静态构建和包体事实，不能证明微信原生 SVG/image 合成、CSS animation、媒体查询、
Skyline/WebView 差异或触摸手感。未来上传必须先获得当次明确授权，并记录 build SHA、`trial`、renderer、
基础库、微信版本、构建时间；截图/日志放在 ignored `runtime/audit/`，不得提交 token、Cookie 或生产数据。

最小验收页面：

1. `pages/workbench/index`：底部 calendar/directory/swap/profile/more active 与非 active 状态；顶部 bell/profile
   点击后的 620/480ms 动效、未读点、返回/切 Tab 后是否只保留 active loop。
2. 同页日历 week/month/list：上一页/下一页 chevron、filter sheet 打开、locate today、按压 scale、重复点击
   是否每次完整重播，且不影响日期/筛选业务状态。
3. organization directory：department/people 切换、filter section chevron、search/clear/reset、star
   selected/unselected、phone 点击；检查 image actor 是否只旋转外框、是否有闪烁/裁切/颜色不对。
4. workbench “更多”及各对应入口：groups、manual、backfill、leave、duty、config、events、statistics、
   export、visitor/invite/access；确认图标与文字语义，不接受“看起来差不多”作为替代。
5. workflow picker/sheet 与 identity：chevron/close 文案、back、user/lock；检查系统返回、safe-area、滚动和
   reduced-motion 设置下的可用性。
6. 小米 14 Android 体验版分别在 WebView/Skyline（若版本支持）记录静态几何、动画方向/循环/延迟、点击重播、
   快速连点、页面卸载后的残留动画、主包首次打开和分包首次进入。当前这些数据均为“当前工具无法测量，暂未验证”。

只有证据与当前源码短 SHA 完全一致，才能把对应项从“已实现待浏览器复核”推进到“已完成（含运行验证）”；
用户验收前保持“待用户复核”。

## 13. 本轮停止条件与未做事项

- 已完成 Web/Mini 图形来源、对应关系、静态属性、动效参数、重复来源、适配边界和包体预算的静态审计。
- 已完成单一来源目录、Web/Mini 组件边界、motion spec/capability map 和 B0–B5 实施计划。
- 未修改 `apps/web/src`、`apps/miniprogram/src`、`packages/ui-tokens/src` 或任何生产图标实现。
- 未重跑阶段 0；未调用微信开发者工具；未上传体验版；未部署 production；未宣称浏览器、微信原生或小米 14
  验收通过。
- 下一动作只有用户审阅并批准 B1 Prompt；本轮在调查分支文档 checkpoint 推送后停止。
