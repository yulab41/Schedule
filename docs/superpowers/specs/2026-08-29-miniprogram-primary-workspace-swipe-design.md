# 小程序五入口 `.67` 原生横滑与嵌套手势协商设计（已取消）

- 日期：2026-08-29
- 基线：`main@b032edee`，`.66@4fe1b5e` 已获用户实体确认
- 状态：2026-08-30 用户取消；未实现、未提交、未上传
- 不包含：自定义位移 Worklet、API/数据库/权限变化、微信审核或正式发布

> 本文以下内容仅保留为已否决方案的历史记录，不再是实施指令。通讯录已把左右滑动定义为
> “科室/人员通讯录切换”；外层再接管同一方向会形成手势所有权冲突。最终产品决策是保持 `.66`
> 的全局底栏点击切换、`duration=0` 与外层横拖拒绝，同时完整保留通讯录内部原生 `swiper`。
> `.67` 版本号不创建、不上传，也不得以本设计为由重新开启全局横滑。

## 1. 目标与不变量

在 `.66` 单 Page 常驻 header/swiper/nav 基础上开放 Skyline 原生横滑。手指位移、惯性和松手吸附
全部由 native `swiper` 完成；Page 只在 `change.source === 'touch'` 后提交入口语义。底栏点击继续
零动画立即切换，首尾不循环，五个 workspace 仍常驻并保留滚动、输入和选择状态。

必须优先保留现有内层交互：月历翻月、周/列表期间切换、通讯录模式切换、workflow 日期面板、WXS
年月滚轮、Sheet/picker/menu/编辑态。任一目标 Android/iOS 无法稳定区分时，回退 `.66` 开关，不能
牺牲内层控件。

## 2. 方案比较

### A. 原生 swiper + shared 手势协商（采用）

外层和内层均使用官方 `horizontal-drag-gesture-handler`/native-view 代理；共享值只传递“外层是否可
接管”，不计算位移。优点是跟手与吸附由同一个原生引擎负责，并能动态响应内层声明和弹层锁。

### B. 打开 swiper touch、仅依赖默认嵌套优先级（不采用）

改动少，但不能证明跨组件 inner swiper、Sheet 和快速反向时的所有权，容易形成偶发误切入口。

### C. 自定义 Worklet/WXS 实现五页位移（不采用）

可完全自控，却重新引入多个位置所有者；目标设备已有 Worklet 执行失败历史，也违背原生跟手目标。

## 3. 外层状态与提交规则

Page 创建以下 UI-thread shared 值：横滑开关、活动 index、弹层锁、内层手势声明和窗口宽度。外层
handler 同时使用：

- `should-accept-gesture`：拒绝关闭态、锁定态及左右系统边缘起手；
- `should-response-on-move`：内层 shared claim 为真时立即让出；
- `onscrollend`：清理本次临时 claim，不承担业务状态提交。

`swiper change` 只有 `source=touch` 才更新 active workspace。程序点击产生的空 source 回声永远忽略，
防止快速点击被陈旧事件覆盖。swiper 默认吸附时长为 240ms；底栏点击在同一序列中临时设 duration=0，
提交目标 current 后恢复 240ms。序列号保证较早 callback 不能改变较新的点击。

## 4. 内层横向控件优先

outer 与以下 inner handler 建立 simultaneous tag：

1. 月视图 `calendar-month` swiper；
2. 工作台周视图 swiper；
3. 工作台列表视图 swiper；
4. 通讯录 internal/employee mode swiper。

inner 的 `should-response-on-move` 先把同一个 shared claim 设为 true 并自行响应；END/CANCEL/scrollend
清回 false。父 Page 在 component ready/重挂载后通过公开方法注入 shared 引用。内层始终优先，哪怕
它已在自身首尾边界，也不把同一次触摸转交外层。

workflow 日期 swiper 位于已打开 picker 内，不参与 ordinary-area 协商：picker 打开期间直接锁住外层。
WXS 年月滚轮保持原文件和 SHA，不接入外层 shared，不新增第二位置所有者。

## 5. 弹层和编辑锁

Page 使用按 source + workspace 分域的 lock registry，避免一个弹层关闭时误解锁另一个弹层。锁来源：

- 顶部群组菜单、通知 Sheet；
- 日历筛选 Sheet；
- 通讯录筛选 Sheet；
- Profile 密码 Sheet；
- swap 内任一 workflow picker。

子组件只上报 `{source, locked}`，不读取父 Page。非活动 workspace 的保留弹层不阻塞当前 workspace；
返回该 workspace 时锁自动恢复。Page hide 只清临时 claim 并暂停 shared gate，onShow 从 registry 重算；
unload 才清空 registry，业务 controller 的失效语义不变。

## 6. 可访问性与体验

底栏五项始终可见、可点击且有 active state，任何功能都不要求必须滑动。系统左右边缘保留 24px，
避免覆盖系统返回手势。快速反向、点击中断、触摸取消都直接以最新 native/current 语义为准，不依赖
animationend 才恢复正确状态。

## 7. 验证与回退

红绿覆盖 touch source、程序回声、点击 duration、首尾、shared claim、各 lock source、作用域切换和
清理。Workspace F 增加 swipe enabled、touch change count、当前锁和 `.67` 清单。

DevTools 自动化依次验证 ordinary 慢拖/flick/反向/首尾、四类 inner swiper、Sheet/picker 锁和点击替代。
随后运行 Mini 全量、构建/确定性/source/package/performance/CI、根 build/typecheck/test 与 core smoke。
WXS source/output SHA 必须仍为 `f5fa4eaa14268d4775a811a002313215a92ace5483f0b00d99f85f3caece2e7c`。

任一内层冲突失败即把 `primaryWorkspaceSwipeEnabled` 恢复 false，不上传伪 `.67`。全部自动门禁通过后
才提交、推送、备份/部署并上传单调 `.67`，最终停止等待 Android 与 iOS 实体确认。
