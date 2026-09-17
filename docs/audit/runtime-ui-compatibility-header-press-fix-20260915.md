# Skyline 3.17.2 页头与按压反馈兼容修复（2026-09-15）

## 结论与范围

体验版 `.135@c7025b93` 的小米 14 反馈确认周切换已经恢复，但基础库 3.17.2 仍有四项局部差异：
页头群组名被省略、群组菜单被日历文字覆盖、周格点击出现灰色闪烁、月格蓝色按压反馈比正常实例
滞留更久。本轮不修改月/周分页状态机、动画时长、数据、权限或 API。

修复严格限定到 `SDKVersion === 3.17.2`：

- 群组触发器使用不再受父 Flex 项反向限制的 220px 明确宽度，正文实际可用 196px；
- 所有版本的群组菜单统一为一份 `root-portal`、一份选项模板和一个选择事件；固定到根层后绕过
  旧 Skyline 的 `scroll-view` 合成遮挡；
- 周格不再附加通用透明度按压类，避免点击后的灰色遮罩；
- 月格仍在按下时显示原蓝色反馈，但松手后的保留时间由 70ms 缩短为 0ms。

3.17.3、后续版本和无法读取版本与 3.17.2 共用同一群组菜单 DOM；菜单仍为原 216px 宽、
左侧 12px、顶部“页头内容起点 + 34px”，颜色、圆角、阴影和选择事件不变。它们继续使用原周格
按压类和原月格 70ms 保留时间。
已有 Toast 根层样式仅把生成的 token 作用域从专用类改为通用根层类；生成 token 内容逐字等价，
没有增加依赖或复制第二套主题。

## 引入点与根因

- `733e3af6` 引入页头 `fit-content`、群名 `max-width: 172px`、页内绝对定位菜单和固定页头层级。
  `.134` 的 3.17.2 补丁 `47c294ba` 虽设置触发器 220px，却同时保留 `max-width: 100%`；该百分比
  仍按被右侧动作区压缩的父 Flex 项计算，因此实际宽度重新退回约 172px。菜单的普通 z-index 仍处于
  旧 Skyline 滚动合成层之下，继续加同层 z-index 不能解决真机遮挡。
- `ad4cfb2c` 为周格接入通用 `.is-pressed { opacity: 0.72 }`，3.17.2 真机把它表现为可见灰闪。
- `1f715c96` 为月格设置 `hover-stay-time="70"`；3.17.2 的实际释放反馈比 3.17.3 更长。

以上调用点已用对应文件的 `git log -S` 和 `git blame` 核对。根层菜单复用项目既有
`ui-toast` 的 `root-portal` 与构建期 UI token 重绑定方法；微信官方 Mini Program Demo 也以
单一 popup 内容配合一个 `root-portal`。根层原生合成仍只能由实体微信验证。

## RED / GREEN 与语义边界

- RED：旧实现新增 4 个失败，覆盖兼容宽度、根层菜单、周格按压隔离、月格反馈保留时间；
  收敛检查又以“两份菜单”准确失败 1 项。
- GREEN：兼容/构建/Toast 定向 30 项通过；Mini 完整 174 文件 1199 项通过、16 项跳过。
- TypeScript、production build（366 文件）、source audit、package audit、determinism、format、lint、
  `smoke:check-core` 通过。
- 主包 1,736,932 B、总包 4,604,586 B；相对 `.135` 分别增加 576 B 和 319 B，
  总包约增加 0.007%，没有新增依赖或构建文件数量。
- `pnpm --filter @schedule/miniprogram verify` 仍只被未修改的手排模板节点预算
  `1507 > 1506` 阻断；这与上一轮基线一致，本轮不修改手排或放宽预算。

行为审计：群组菜单只有一个 `bindtap="handleGroupSelect"`，原绝对定位的 216px/34px/0px 几何
等价换算为固定定位的 216px/`contentTop + 34px`/12px；页头原左 padding 正是 12px。月格新增属性
默认 `false`，未传入时仍为 70ms；
Toast token 只同步重命名选择器与引用，并由构建测试证明恢复成 `page` 后与 token 源文件完全一致。
没有改变事件接收者、异步/错误边界、空值语义、副作用或调用次数。

首次冻结上传候选后，正式血缘检查器在版本分配和微信上传前拒绝了旧的
`workbench/index.ts` canonical blob。精确比较证明该文件仅新增群组菜单根层定位字段、默认值和
`createShellLayoutPatch` 返回值；分页、选择、请求与生命周期方法均未改变。血缘 policy 已更新为
当前 blob，并须经 lineage/上传门禁重新验证；该次失败未分配版本、未创建 tag、未调用微信上传。

## 访客页面按压反馈对齐（`.136` 复核后）

用户复核 `.136@efda88f` 后确认：成员页面四项修复通过，但 3.17.2 访客页面仍出现周格灰色闪烁和月格
蓝色反馈滞留。访客页面 `pages/guest/guest.wxml` 第 1 行已带 `is-skyline-3172-ui` 根类，并通过
`@import '../workbench/index.wxss'` 继承成员页面的 Grid/Flex 后备与选中样式，但漏接两项条件参数：

- 访客月历 `<calendar-month>` 未传 `runtime-pressed-feedback-compatibility`，3.17.2 仍按 70ms 保留蓝反馈；
- 访客周格仍无条件使用 `hover-class="is-pressed"`，点击后出现 `.is-pressed { opacity: 0.72 }` 灰闪。

修复复用成员页面完全相同的参数名与表达式，没有新增第二套机制。源码改动只有两行：访客月历新增
`runtime-pressed-feedback-compatibility="{{skyline3172UiCompatibility}}"`，访客周格改为
`hover-class="{{skyline3172UiCompatibility ? 'none' : 'is-pressed'}}"`。成员页面、月/周分页状态机、
动画时长、数据、权限与 API 均无改动；3.17.3 和无法读取版本的取值与外观不变。

RED 新增 1 项并在该双分支缺口上准确失败；GREEN 兼容/布局/访客运行定向 31 项、Mini 完整 174 文件
1200 项通过、16 项跳过，根套件 270 文件 1273 项通过、444 项跳过。TypeScript、production build（366 文件）、source audit、determinism、
format、lint、`smoke:check-core` 通过；主包 1,737,064 B、总包 4,604,718 B，较 `.136` 仅增 132 B。
`pnpm --filter @schedule/miniprogram verify` 仍只被未修改的手排节点预算 `1507 > 1506` 阻断。

## 验收边界

体验版 `.136@efda88f` 已以 production/clean 上传并追加放行；远端 tag、allocation、Manifest 与
receipt 一致，放行后 `.136/.135` 均为 HTTP 200、动态未知版本为 426，完整生产 verifier 通过。
未调用微信开发者工具，也没有新的小米 14 原生证据。随后须分别复核 3.17.2 四项恢复及 3.17.3
外观与交互不变；详见 `runtime-ui-compatibility-header-press-trial-release-20260915.md`。

访客页面对齐尚未上传：必须取得用户对本次检查点的当次明确上传授权后才能分配版本并上传，
不把成员页面的 `.136` 通过或本轮本地证据当作访客页面的原生验收。
