# 小程序五入口常驻外壳与分阶段滑动设计

- 日期：2026-08-29
- 基线：`main@4bc89c59`，运行时代码 `66952803`
- 状态：用户已确认方案与全部关键取舍
- 本轮交付：`.66` 点击切换阶段；`.67` 横滑必须等待 `.66` 实体复核
- 不包含：微信审核、正式发布、Web/API/数据库协议变化

## 1. 证据与平台结论

同环境 A/B 已证明 `.63` workbench 可运行，`.64/.65` 登录页可运行但 workbench 卡死。进一步的单
组件隔离证明：directory 在 Page ready 后嵌入正常；现有 Profile Page 作为静态 Page 正常，但现有
Profile adapter 作为 Component 单独挂载即冻结。因此不能继续调整同一 adapter 的挂载时机。

微信官方 Skyline 资料确认：

- 单 Page 可把固定栏置于 `swiper` 外，由 `current` 同时支持点击和原生跟手拖动；
- `cache-extent` 可保留相邻/指定页面，内外滚动可用 gesture negotiation 协调；
- `wx.switchTab` 不接受自定义路由动画，`wx.navigateTo` 的 custom route 又不能进入 tabBar Page；
- 当前 Mini 主包已为 1,618,725 bytes，五个原生 Tab 页面全部进入主包会越过内部 1.8MB 门槛。

因此采用一个 workbench Page，而不是原生 TabBar 多 Page。

## 2. 已锁定产品决策

1. 五入口固定顺序：日历、通讯录、换班、我的、更多。
2. 顶部状态栏与底部导航是 `swiper` 外的同一组常驻节点。
3. `.66` 只允许底栏点击；点击立即切换，`duration=0`，不播放过渡。
4. `.67` 才开放横滑；内部日历/日期/通讯录横向控件优先。
5. 五个 workspace 首次挂载后全部保留；不循环首尾。
6. Profile 全功能内嵌，但必须重写为真正的 workspace，不复用 Page adapter。
7. 无权限 workspace 保留固定位置并显示说明，零业务请求。
8. 二级设置、统计、群组管理等仍走正常 Page 栈。

## 3. 常驻外壳

workbench 使用确定高度三段 flex：固定顶部、`workspace-swiper`、固定底部安全区。五个
`swiper-item` 的索引由常量表唯一映射；不再用 absolute/hidden 的多个 workspace 叠层。

状态统一为：

- `activeWorkspace` / `activeWorkspaceIndex`
- `workspaceMounted` / `workspaceReady`
- `workspacePreloadQueue`
- `workspaceGestureLocked`
- `primaryWorkspaceSwipeEnabled`

日历和轻量 More 初始存在。日历 core-ready 后按 directory → profile → swap 串行设置 mount；每个
workspace 首个静态视图提交后发 `workspaceready`，网络结果不阻塞队列。点击未挂载入口会提升它的
优先级并显示固定骨架；ready 后保持常驻，重复切换不再 attached 或首载请求。`cache-extent=4` 与低
内存真机门槛共同保护全部保留语义。

## 4. 完整 Profile workspace

新增完整 `profile-workspace`，保留头像、姓名、绑定状态、值班概览、趋势、密码、解绑、头像恢复、
统计入口与退出登录。现有 static Profile Page 继续可深链。

Profile 的业务读取与纯 view-model 从 Page controller 抽为共享服务；Page 与 workspace 共用请求、
解码、错误和格式化语义。workspace 生命周期只有：

- `created`：初始化 account/overview generation 与 serial；
- `attached`：同步本地会话和确定布局，首个 setData callback 发 ready；
- `active/group` observer：唯一入口驱动 account/overview 读取；
- `detached`：作废 generation，零隐式写。

禁止 `Page.onLoad + pageLifetimes.show + 多 group observer` 叠加。账号与概览分开失效；Sheet 只在
打开时 `wx:if` 挂载；密码/头像/解绑/退出的接收者、Promise/catch、空值与副作用次数保持。

## 5. 其他 workspace 与权限

directory 保留现有 controller，只补 `active/workspaceready` 边界。swap host 增加 `active`，隐藏时不
执行 onShow refresh；首个静态视图提交即 ready，group 数据继续按现有 controller 加载。

directory/swap 无权限时渲染说明卡，不向真实 panel 传 groupId，也不调用 organization/workflows
API。群组角色变化时当前 item 原地变为说明，不强制切回日历。

## 6. 手势阶段

`.66`：`primaryWorkspaceSwipeEnabled=false`；优先使用 `swiper disable-touch`，若当前官方编译器拒绝
则使用 `horizontal-drag-gesture-handler` 的拒绝回调。底栏始终是可见替代操作。

`.67`：开启原生 swiper touch，核心位移不依赖自定义 Worklet。活动 workspace 向父层提供
`canWorkspaceSwipe` shared value；日历翻月、directory mode、workflow date swiper 与开放中的
Sheet/picker 锁住外层。目标 Android/iOS 的协商探针未通过时保持 `.66` 点击语义，不牺牲内层手势。

## 7. 验收边界

自动测试覆盖五项固定索引、单实例外壳、点击即时切换、串行挂载/抢占/幂等、状态保留、无权限零
请求、Profile 全功能与陈旧响应、safe-area/320/390/大字号。WXS source/output SHA 必须继续为
`f5fa4eaa14268d4775a811a002313215a92ace5483f0b00d99f85f3caece2e7c`。

Test Center 新增 Workspace F，展示 index、mounted/ready、队列、锁与 attached/request count。
`.66` 必须经默认 GPU DevTools 登录/workbench 截图与 runtime、目标 Android 50 次五入口点击、前后台、
弱网和低内存测试。`.67` 另验慢拖/flick/反向/边界及内层控件优先。
