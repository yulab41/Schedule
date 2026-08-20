# 微信小程序 1:1 迁移实施计划

- 批准日期：2026-08-17
- 工作区：`E:\AItools\Schedule`
- 应用目录：`apps/miniprogram`
- 状态：P0 与 P1 非视觉工具链已完成；月历已通过用户 Android 人工验收。矩阵 C 的旧原生横向方案曾通过、D 纵向始终不可达；用户已确认改为四层纯 Worklet 二维平移，并以 `78e341b`/体验版 `.23` 保留旧方案回退基线。C/D 重新复测通过后才进入 P2
- 产品目标：保留 Web 和服务器 API，在原生微信小程序中复刻完整业务、状态、权限和交互语义

## 1. 已冻结边界

1. 小程序与 Web/API 共用当前 monorepo，不建立第二个 Git 仓库；后端继续由 `apps/api` 和现有 ECS 提供 HTTPS API。
2. 原生栈固定为 WXML、WXSS、TypeScript、JSON、Skyline 和 glass-easel；最低基础库 3.3.0，不提供 WebView 回退。
3. `rendererOptions.skyline.disableABTest=true`，正式范围为 `3.3.0` 至 `15.255.255`。正式发布前记录实际 Stable 编译基础库。
4. 禁止 TDesign MiniProgram 和第三方 UI 库；基础控件、月历、排班格、弹层、导航和状态全部自绘。
5. Web Storybook 是视觉黄金源；原生运行真值由用户人工操作微信开发者工具 GUI 和实体 Android 提供。LLM 永不启动、控制或自动化本地微信开发者工具。
6. 源码采用确定性 `src → dist`；`dist`、私有配置、二维码、人工测试截图和上传私钥不进入 Git。
7. 账号不提供注销。解绑只移除当前正式小程序 AppID 的身份，不影响业务用户、用户名、群组、排班、审计或其他微信渠道。
8. 匿名访客继续存在；完整电话只有在成员针对该群组给出可审计的单独同意后才公开。
9. 手工排班的单次模板、编辑、预览、应用、生成和草稿覆盖均限制 20 人、30 天、600 格；首尾日期总区间不得超过 30 天。
10. 正式版经体验版、回滚演练和用户批准后直接 100% 发布，不做 10%/50% 灰度。
11. Web 在迁移期间继续演进：与既有迁移范围匹配的改动必须在对应 Mini 阶段实时跟随；院内通讯录等迁移计划批准后才新增的功能登记到 P10，最后实施，不打断核心迁移关键路径。

## 2. 可行性和验收定义

Vue SFC、DOM、Web CSS、Pinia、Vue Router、TDesign Web、PointerEvent、ResizeObserver、localStorage 和 PWA/service worker 不能直接搬运。可复用的是纯 TypeScript 领域算法、日期与节假日逻辑、发布/版本状态机、DTO、设计令牌、ViewModel、fixtures 和 Storybook 黄金样张。

自定义组件允许独立模板、样式、属性、状态和事件，官方没有要求使用 TDesign。因此 Web 的自绘开关、按钮、月历格和班次徽标均可用 WXML/WXSS 重绘。最大手排矩阵为 20×30=600 个逻辑格，日常为 7×7=49 格；采用成员行虚拟化、浅层单元格、局部更新和 Worklet 滚动同步后风险可控。

| 模块                           | 指定基准设备视觉目标 | 功能与状态目标 |
| ------------------------------ | -------------------: | -------------: |
| 首页动态 5/6 周月历            |              97%–99% |           100% |
| 排班补录月历                   |              97%–99% |           100% |
| 20×30 手工排班矩阵             |              95%–98% |           100% |
| 发布、撤回、重新发布和版本流程 |              96%–99% |           100% |
| 核心排班闭环                   |              95%–98% |           100% |

“1:1”验收含义：业务功能、状态、权限和交互语义 100%；稳定截图区域相似度 ≥98%；显著差异像素 ≤2%；关键几何偏差 ≤2px。状态栏、系统键盘和字体栅格等动态原生区域使用固定遮罩。默认系统字号严格对照；大字号允许重排但不得截断、遮挡或无法滚动。每页最终由用户人工确认。

性能门槛：基准 Android 核心页面可交互时间 ≤2.5 秒；20×30 数据到达后渲染 ≤1 秒；点击反馈 ≤100ms；没有持续可感知滚动卡顿。页面节点尽量 <1000、深度 <30、单节点直接子项 <60。

## 3. 目标结构和共享边界

```text
apps/miniprogram/
├─ src/
├─ docs/
├─ scripts/
├─ dist/                         # ignored
├─ .artifacts/                   # ignored
├─ project.config.json
├─ project.private.config.json   # ignored
├─ package.json
└─ AGENTS.md
```

`src/` 分为 `app`、`platform`、`store`、`components/ui`、`components/calendar`、`features`、`pages`、`subpackages` 和 `testing/fixtures`。跨端包固定为：

```text
@schedule/contracts
@schedule/scheduling-domain
@schedule/ui-tokens
@schedule/client-core
@schedule/presentation-core
```

- `scheduling-domain` 必须解耦会把完整 contracts/Zod 带入的 barrel。
- `client-core` 定义端点、错误、解码器和 transport；Web 使用 fetch，小程序使用 `wx.request`、`wx.downloadFile` 和 FileSystem。
- `presentation-core` 保存月历、矩阵、撤销和发布流程的纯 TS ViewModel/状态机。共享逻辑先由 Web 使用并通过回归，再给小程序复用。
- 紧凑解码器由 contracts 生成，人工补充特殊联合类型/转换；黄金响应必须证明 Web Zod 结果与 Mini 解码结果相等。
- 小程序包禁止包含 Zod、数据库代码、Node 内置模块和 DOM。

## 4. 运行、构建和分包

构建执行：静态 WXML/WXSS/JSON/资源确定性复制；共享 TS 由 esbuild 打包；Worklet 使用保留指令的 TS 路径；另跑 `tsc --noEmit`；扫描每个 Worklet 的第一条语句；禁止 workspace 符号链接、Node/DOM/数据库/密钥泄漏。

环境只有编译期 profile，包内没有运行时切换：

```text
staging    https://staging-hosp.schedule.eylinhome.top/api
production https://hosp.schedule.eylinhome.top/api
```

主包包含登录/绑定、邀请、匿名访客、工作台、月/周/列表日历、个人页和自绘导航。分包为：

| 分包                      | 内容                           |
| ------------------------- | ------------------------------ |
| `subpackage-scheduling`   | 手工排班、补录、发布、版本     |
| `subpackage-workflows`    | 请假、换班、加扣班             |
| `subpackage-organization` | 群组、成员、配置、平台账号后台 |
| `subpackage-insights`     | 事件、统计、通知、导出         |

官方硬限制为主包/单分包各 2M、直接开发总包 30M。内部门槛：单包 1.5M 预警、1.8M 阻断；总包 15M 预警、25M 阻断；官方上限始终阻断。

## 5. 自绘、日历和矩阵

基础组件：`UiButton`、`UiSwitch`、`UiCheckbox`、`UiRadio`、`UiInputShell`、`UiPicker`、`UiTextarea`、`UiAlert`、`UiChip`、`UiLoading`、`UiDialog`、`UiSheet`、`UiConfirm`、`UiNavigationBar`、`UiTabBar`。原生 `input`、`textarea`、`scroll-view` 和手势组件只作为能力原语。全部支持 ARIA、禁用/加载态、至少 44px 触控区，并从 `@schedule/ui-tokens` 同源生成 `tokens.css` 与 `tokens.wxss`。

首页月历按当月实际跨度生成 5×7 或 6×7，不虚拟化；今日、选中、历史、补录、周末、节假日、跨月、班次和变更独立建模。P1 真机验证后选择原生三面板 `swiper` 统一 Android 触控、PC 鼠标与程序翻页，并显式维护当前高度和底角状态。

手排采用四层纯 Worklet 坐标结构：固定左上角、只随 X 移动的日期层、只随 Y 移动的人员层、同时随 X/Y 移动的班次主体。矩阵内部完全移除 `scroll-view`/`native-view`，普通 WXML 裁切面上的单一 `pan-gesture-handler` 在 UI 线程直接维护有界 X/Y SharedValue；handler 与命中面都显式绑定当前矩阵像素高度，不能依赖绝对定位子层撑开。首次达到 2px 且某轴超过另一轴 1.2 倍后锁轴到 END/CANCELLED，横纵松手均使用有边界的 `decay`。矩阵视口固定为 82px 表头加 7 个 44px 人员行，共 390px；7×7 与 20×30 共用同一引擎，手势 ACTIVE 不调用 `setData`。点击只更新目标格/行；撤销保存 `{key,before,after}`；600 格性能不足前不 Canvas 化。回退规则以 [ADR-0005](../decisions/ADR-0005-worklet-matrix-engine.md) 为准。[Worklet](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/worklet.html)、[手势](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/gesture.html)。

## 6. 网络、会话和缓存

- 自研纯 TypeScript store；完整领域模型不全部放页面 `data`。
- transport 显式检查 `statusCode`；GET 可退避重试；写请求只有幂等键时才可重试。
- 业务日期统一 `YYYY-MM-DD` 和中国标准时间语义。
- 30 天 Bearer 单独持久化，不与业务缓存混存；退出、解绑、401 清理；401 后只执行一次 `wx.login` 静默重登。
- 登录用户只缓存 24 小时排班查看数据；离线只读且无写队列。
- 不缓存完整手机号、访客凭证、导出文件或请求正文；退出或离群清理对应缓存。
- 匿名访客 token、电话和日历只驻留内存。

## 7. 公共接口和后端改造

### 7.1 微信登录与绑定

```ts
type WechatLoginResult =
  | { status: 'authenticated'; token: string; expiresAt: string; profile: UserProfile }
  | { status: 'link_required'; linkToken: string; expiresAt: string };
```

- `POST /auth/wechat/login { code }`：未知微信不得自动建号，返回 10 分钟、单次、数据库只存哈希的 `linkToken`。
- `POST /auth/wechat/link-password { linkToken, username, password }`：绑定既有账号。
- `POST /auth/wechat/register { linkToken, realName }`：只创建微信身份；真实姓名必填，入群仍要求完全同名预设成员。
- Web 移除公开注册 UI 并停止匿名 `/auth/password/register`；用户名只能由平台管理员分配。
- `PUT /platform-admin/users/:userId/password-identity` 分配用户名；`PUT /me/password` 用新微信 code 或当前密码作为 proof 设置/修改密码。
- 平台管理员先在 Web 通过 `POST /platform-admin/users/:userId/wechat-miniprogram-binding-links` 生成 10 分钟单次 URL Link ticket；小程序以 `/auth/wechat/admin-bind/preview` 和 `/confirm` 完成脱敏预览与主动确认。

身份模型：provider 唯一键 `(provider, appId, subject)`；新增 `wechat_union_accounts`，UnionID/userId 分别唯一；无 UnionID 时以 `(appId,openid)` 为底座；业务用户和微信自然人一一对应；`authVersion` 在密码、用户名或解绑变化时使旧会话失效；修复既有 mini/web UnionID 冲突和邀请合并遗留身份；预分配密码身份可有用户名但尚未设置密码。

### 7.2 只解除小程序身份

- `POST /me/wechat/miniprogram/unbind`，body `{ code }`，带幂等键。
- `POST /platform-admin/users/:userId/wechat/miniprogram/unbind`，body `{ reason }`，带幂等键。
- 只解除当前小程序 AppID；用户/管理员均可发起；必须先有可用 Web 用户名和密码；用户需新微信 code，管理员需原因；旧小程序会话立即失效；可立即重新绑定。
- 不存在账号注销端点、页面或隐含删除流程。

### 7.3 排班、补录和幂等

```ts
MAX_MANUAL_MEMBERS = 20;
MAX_MANUAL_DAYS = 30;
MAX_MANUAL_CELLS = 600;
```

常量在 contracts、API、service、Web、Mini 同源强制。生产超限模板阻断部署，由管理员拆分/归档，不自动截断。

`POST /groups/:groupId/past-schedules/backfill-batches` 最多 31 个过去日期、同批业务键不重复、单事务、任一失败全回滚；相同幂等键/指纹重放，相同键不同 payload 返回 409。

危险写操作统一使用 `Idempotency-Key: <uuid>`；暂时兼容 `body.operationId`，两者并存必须一致；记录保留 24 小时。

### 7.4 访客、隐私、消息和导出

- `POST /guest/groups/resolve { visitorKey }` 换取 30 分钟 `Authorization: Guest <token>`；长期 key 只用于 resolve；token 绑定 group/key version/aud/签发/过期；访客码轮换立即失效；按 IP、设备线索和路由限流。
- 完整电话须先取得成员针对群组的单独同意，记录 group、phone fingerprint、说明版本和时间。未同意/撤回只隐藏电话；号码、新群组或说明实质变化需重取；管理员不可代授权。
- 完整访客 IP 仅群管理员/平台管理员可见，原始 90 天后只留匿名聚合。
- 订阅消息覆盖值班提醒、排班发布和请假/换班/加扣班待处理与结果。正式 AppID 获医疗长期模板资格时使用长期授权，否则使用一次性 grant；记录 accept/reject/ban/filter、模板版本、授权时间、grant 和消费状态；默认关闭；只在明确点击/相关操作后请求；模板未审批不阻塞核心 v1。
- 导出格式扩展为 `csv | xlsx`；Web 保留 CSV，小程序默认 XLSX，通过带 Bearer 的 `wx.downloadFile`，不使用 URL token，并防公式注入。
- `GET /client-capabilities?platform=miniprogram&version=<version>` 返回全局和 core/workflows/organization/insights/externalMessages/guest 能力，UI/API 双端强制。
- 自建遥测只记录版本、页面、设备等级、错误码、网络类型、性能和脱敏堆栈指纹；不记录身份、联系方式、凭证或排班正文；原始脱敏事件保留 30 天。

## 8. 预览和视觉流程

`frontend-design` + Web Storybook 负责意图、390×844 黄金和 320 边界；`miniprogram-simulate` 只验证属性/事件/状态/组件树；`miniprogram-ci` 只编译和上传；用户人工操作微信开发者工具 GUI 与实体设备验证原生渲染、交互和性能。

每页顺序：设计意图与状态矩阵 → Storybook 390 黄金 → 320/大字号 → 用户确认 → 原生 WXML/WXSS → simulate/静态门禁 → 用户人工 GUI/实体机测试 → 必要时用截图与自有比较器诊断 → 修正 → 用户最终确认。

## 9. 阶段和停止条件

| 阶段                | 范围                                                                       | 停止条件                                                                                 |
| ------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| P0 安全迁入         | 协调脏树；迁入 Skyline 模板；建立 docs/AGENTS/ignore/计划                  | 外部目录迁空；AppID 保留；私有配置未跟踪；无无关文件进入 checkpoint；根状态仅留链接/批次 |
| P1 工具链与风险 PoC | src→dist、静态门禁；基础控件/动态月历/矩阵视觉确认；5/6 周与 7×7/20×30 PoC | 静态门禁通过；用户人工编译并在实体 Android 完成四页清单，明确反馈通过后进入 P2           |
| P2 共享核心         | presentation-core、client-core、transport、tokens、fixtures、解码器        | Web 先用且回归；Mini bundle 边界/黄金解码一致性通过                                      |
| P3 身份安全         | 数据预检、关闭公开注册、账号后台、登录/建档/两种绑定/密码/解绑             | 身份并发、UnionID、旧 token、无注销等安全测试通过                                        |
| P4 壳层与日历       | 自绘导航、登录/邀请/访客、工作台、月周列表、详情、认领、成员、缓存、设置   | 未迁功能隐藏；核心只读链路和 24h 缓存通过                                                |
| P5 排班闭环         | 手排、限制、撤销、预览/应用、风险、草稿/发布版本、补录、电话同意           | 20/30/600、30 天区间、原子补录、版本和隐私通过                                           |
| P6 核心 v1          | 弱网、后台、权限、缓存、性能、隐私、回滚硬化                               | 体验版与回滚演练通过，用户批准后 100% 正式发布                                           |
| P7 工作流           | 请假、换班、加扣班、审批/撤销/冲突和消息                                   | 阶段 RC、用户人工实体机测试和批准                                                        |
| P8 组织管理         | 群组/成员/预设、班种/岗位/规则、邀请/访客码、平台账号后台                  | 阶段 RC、权限/身份、用户人工实体机测试和批准                                             |
| P9 数据与消息       | 事件、访客日志、统计、通知、订阅、CSV/XLSX                                 | 阶段 RC、隐私/导出/消息、用户人工实体机测试和批准                                        |
| P10 对等审计        | 逐 Web 路由、角色、状态、错误分支核对；补齐院内通讯录等迁移后新增功能      | 除批准的平台差异与 Web/PWA 专属能力外无缺失                                              |

## 10. 验证和发布硬门槛

普通 checkpoint：根 format/lint/build/typecheck/test；Mini WXML/WXSS/TS/JSON；包边界、密钥、Zod、Node/DOM；Worklet 指令；构建确定性；包体；simulate；涉及 Web 核心时 browser smoke；`pnpm smoke:check-core`。P1、核心 v1 RC、后续正式阶段 RC 和重大 Skyline/构建升级均由用户执行对应人工原生测试清单；用户未反馈通过时不得越过阶段门槛。

正式发布前必须同时满足：暴露过的 AppSecret 已轮换；私钥/Secret 在仓库外；staging/production request/download 合法域名完成；隐私指引和手机号单独同意可审计；生产无未处理超限模板；用户人工实体机视觉/交互/性能验收通过；能力开关和回滚演练通过；用户明确批准审核和发布。

## 11. 执行规约

- 每轮先读根状态、Git、本阶段计划及相关专题文档；复杂任务 1 项，普通任务最多 2–3 项。
- 回归先查引入点并测试先行；视觉批次强制使用 `frontend-design` 和截图批评。
- 默认使用 GPT‑5.6 Sol、推理强度 xhigh；具体会话模型由 Codex 项目组配置保障。
- 每个完整 checkpoint 更新状态、显式暂存、提交、推送，并按根规则完成 ECS 备份/部署/验证；Mini 发布是独立轨道。
- 每个完成验证并推送的小程序修改 checkpoint 都必须用 Node 版 `miniprogram-ci` 上传微信开发/体验轨道；缺少仓库外上传私钥时必须记录阻塞并在下一实施步骤前补传同一提交，不能用 dry-run 或本地开发者工具 CLI 冒充上传。
- 提交审核、撤回审核和正式发布不包含在上述自动上传中，仍须取得用户当次明确批准。
- 遇到未覆盖的产品、安全、隐私或公共接口选择立即停止询问，不自行决定。

## 12. 官方依据

- [原生目录结构](https://developers.weixin.qq.com/miniprogram/dev/framework/structure.html)
- [TypeScript 支持](https://developers.weixin.qq.com/miniprogram/dev/devtools/compilets.html)
- [WXSS](https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxss.html)
- [自定义组件](https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/)
- [Skyline Worklet](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/worklet.html)
- [手势](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/gesture.html)
- [scroll-view](https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view.html)
- [渲染性能建议](https://developers.weixin.qq.com/miniprogram/dev/framework/performance/tips/runtime_render.html)
- [Skyline 发布上线](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/migration/release.html)
- [分包加载](https://developers.weixin.qq.com/miniprogram/dev/framework/subpackages.html)
- [miniprogram-ci](https://developers.weixin.qq.com/miniprogram/dev/devtools/ci.html)
- [订阅消息](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/subscribe-message-overview.html)
- [隐私保护指引](https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/miniprogram-intro.html)
