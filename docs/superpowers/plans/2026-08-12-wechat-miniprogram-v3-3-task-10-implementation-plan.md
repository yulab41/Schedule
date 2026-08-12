# 微信小程序 V3-3 Task 10：通知、个人、群组与访客实施计划

- 文档日期：2026-08-12
- 状态：**待用户复核；本文件不授权编码**
- 前置检查点：Task 9.1 `5ccd04f`、Task 9.2 `ddf8295`、Task 9.3 `d8387e7` 与 API integration runner `189120e` 均已正常快进至 `origin/main`；Task 9 真机角色矩阵仍待用户/设备复核
- 实施范围：仅 V3-3 Task 10；不进入 V3-4、Task 14 群组配置或任何 Web 重构
- 依据设计：`docs/superpowers/specs/2026-08-09-wechat-miniprogram-v3-design.md` 第 9–10 节，以及前序计划第 10 节的冻结边界

> 本计划建立在 Task 9 最终代码和真实测试数据库验证之上。它把已经完成的 Task 9 作为前提，不重复实现请假、换班、加扣班或请求中心。Task 9 的真机角色矩阵仍须如实保留为待用户/设备复核；不得因为本计划已经写成就把该证据改记为通过。

## 0. 目标、权威顺序与不可扩大范围

Task 10 交付四条安全的移动端路径：

1. 普通成员可使用通知中心、个人资料、本人联系方式、个人提醒偏好和精确登出。
2. 群组上下文可按用户恢复、切换、加入/离开或恢复后刷新，且月历缓存不会跨用户泄露。
3. authenticated guest 只可进入群组、只读日历和明确登出；匿名二维码可不登录打开单群、无 tabBar 的只读月历。
4. API 层对 guest/anonymous 日历绝不返回未确认号码；小程序不以“只允许复制”代替服务端脱敏。

发生语义冲突时依此决策：当前共享契约与 API integration tests → 当前 API 服务实现 → 已验证的 Web 行为/调试记录 → V3 设计 → 本计划。前端显示、路由守卫和缓存不是服务端权限的替代品。

以下事项明确不在本任务：

- 不恢复 `/groups/claim`、群组码认领或公开访客群目录；加入只有 `join-guest` 与邀请接受。
- 不实现群组通知默认值/管理员通知设置（Task 14）、活动/审批/手动排班/补录/统计/导出/平台管理。
- 不把浏览器 push 配置写回个人偏好；不创建假想的通用通知对象深链。
- 不修改 Web 生产代码、旧 Web `ClaimGroup*` 残留或未被本任务阻断的封装。
- 不建立离线写队列、自动重放、持久化 operationId，或调用 `wx.clearStorageSync()`。

## 1. 已核验的基线与固定决议

| 主题          | 当前事实                                                                                                       | Task 10 决议                                                                                   |
| ------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Task 9 前置   | `main == origin/main == 189120e`；真实 MySQL test DB 的 leaves 19、swaps 33、duty 26，共 78 项、零 skip 已通过 | 保留现有检查点；Task 10 新增的 API 集成测试必须同样连接守卫后的 `schedule_test`，skip 不算通过 |
| 资料并发      | `UpdateUserProfileRequest` 与 API `PATCH /users/me` 都要求 `{ realName, version }`，小程序端点仍只传姓名       | 先修端点、控制器和 409；刷新权威资料、保留原错误，不自动覆盖或重放                             |
| 群组认领      | `/groups/claim` 已删除，现有 integration test 明确期望 404                                                     | 小程序不得调用、包装或恢复该路径；`left-member` 仅显示“需管理员邀请重新加入”                   |
| 访客二维码    | 服务端已生成 `pages/guest/guest`，小程序 manifest 尚无此页面；public resolve/calendar API 已存在               | 增加主包匿名页，解析 `scene` 后仅调用 public visitor API，不登录、不写缓存、不显示 tabBar      |
| 手机号码      | 当前 guest 日历查询会携带 contact，成员构建没有按确认状态过滤                                                  | 先从 API 输出收紧为“仅 confirmed”；小程序再以缺失号码为唯一访客行为边界                        |
| native tabBar | guest 工作台入口已过滤，但静态“通知/我的”和直接路由仍可抵达页面                                                | 创建统一可测试 route guard；所有受限页必须在任何数据请求前重定向，不能只隐藏入口               |
| 通知          | API 已有 cursor 列表、未读、单条/全部已读、个人偏好；`notificationType` 是开放 string                          | 首版只做列表、分页、已读与安全 unknown fallback；不承诺深链                                    |
| 微信订阅      | 小程序尚未调用 `wx.requestSubscribeMessage`；服务端微信实际仅投递 `dutyReminder`                               | 仅由显式点击申请该模板；将 accept/reject/ban/异常与服务端投递偏好分别呈现                      |
| 离开/恢复     | owner 不能 leave；guest 软失活；member 留下历史占位；仅原 owner 可在 30 天内 restore                           | 直接展示服务端结果；离开/恢复后刷新群组上下文、active group 与受影响缓存                       |

Web 只作为已验证交互语义的参考：通知首版没有可靠的对象路由矩阵；管理员 direct workflow 已在 Task 9 对齐，本任务不重做。小程序的访客号码脱敏和静态 tabBar 守卫是安全增强，不能称为现有 Web parity。

## 2. 文件职责图

| 文件或目录                                                                                | Task 10 职责                                                                                                             |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `apps/miniprogram/store/session.ts`                                                       | 用户级 active-group 恢复/验证、单飞 context refresh、invite replacement-token 顺序、generation 失效与精确 logout 编排    |
| `apps/miniprogram/store/session-storage.ts`（新增）                                       | 只保存 user-scoped last-group key；校验输入、隔离 key、删除当前用户 key；不持有 token 或 pending invite                  |
| `apps/miniprogram/store/calendar-cache.ts`                                                | 为已写入 cache key 维护安全 key registry；提供 `removeForUser` 与 `removeForUserGroup`，只删除明确属于目标用户的月历快照 |
| `apps/miniprogram/features/navigation/route-guard.ts`（新增）                             | 用 session status、群组角色和目标路径决定 allow/redirect；所有入口在发请求前调用                                         |
| `apps/miniprogram/features/navigation/workbench-navigation.ts`、`pages/workbench/index.*` | 把可用“群组”入口接到真实群组分包，并保持 platform-admin 独立于群组权限                                                   |
| `apps/miniprogram/api/endpoints.ts` 与 `.test.ts`                                         | 对齐 profile version、群组、通知和公开访客端点；锁定 method/path/body 和 auth 边界                                       |
| `apps/api/src/modules/calendar/calendar-query.ts` 与 calendar/visitor integration tests   | 用明确的 contact visibility 策略生成 guest/anonymous 日历，确保未确认号码在响应前被省略                                  |
| `apps/miniprogram/features/notifications/*`、`pages/notifications/index.*`                | cursor 列表/未读/已读、unknown fallback、个人偏好与微信订阅 adapter；无泛化深链                                          |
| `apps/miniprogram/features/profile/*`、`pages/profile/index.*`                            | profile optimistic update、本人联系方式确认、运行版本和 logout UI；不编辑他人联系方式                                    |
| `apps/miniprogram/features/groups/*`、`subpackages/groups/pages/index.*`（新增）          | catalog、切换、guest join、leave、dissolved restore 和邀请回流后的界面状态                                               |
| `apps/miniprogram/features/visitor/*`、`pages/guest/guest.*`（新增）                      | scene 解析、匿名 resolve、只读月历和错误状态；不得引用 session/cache/workflow 模块                                       |
| `apps/miniprogram/app.json`、manifest/boundary tests                                      | 注册 groups 分包和主包 guest QR 页面，并锁定 anonymous 页、guest 守卫及依赖边界                                          |
| `scripts/run-api-integration.mjs`、其测试、`package.json`                                 | 在不改变既有 Task 9 默认三套测试的前提下，增加命名的 Task 10 API integration allowlist 与守卫入口                        |
| `docs/project-status.md`、`docs/debug/debug-feedback-log.md`                              | 每个 checkpoint 只记录实际通过的命令、设备证据、变更行为和下一批；不把 skip 或 transport 故障标为通过                    |

## 3. 实施前门禁

开始任何一项实现前，执行者必须：

1. 完整阅读 `AGENTS.md`、`docs/project-status.md`、本计划和设计第 9–10 节；检查 `git status --short --branch`、最近历史、remotes。用户已有的 `apps/miniprogram/minitest/` 未跟踪产物不得编辑、暂存或格式化。
2. 更新状态记录：Task 9 代码/API runtime 已完成；真机角色矩阵若仍未完成，写为“待用户复核”而非伪造通过。若用户没有批准本计划，停止，不编码。
3. 对每个将改动的既有调用点运行 `git log -S '<关键表达式>' -- <文件>` 与 `git blame`，把引入点、红测和行为差异写入调试日志。
4. 首先写会在旧代码失败的测试。若当前 API、契约或安全结论与本计划冲突，停止并先更新设计/计划，不自行猜造接口。

以下三个 checkpoint 必须按顺序、每个单独提交并停止；不得因计划已经完整而在同一对话越过当前 checkpoint。

## 4. Task 10.1：会话、缓存、路由与访客数据安全基座

**目标：** 先关闭跨用户缓存、guest 直接路由和访客号码泄露三条底层风险，再让后续页面消费统一上下文。

### 4.1 红测与 API 数据边界

- [ ] 在 `apps/api/src/modules/calendar/calendar.integration.test.ts` 与 `visitor-access.integration.test.ts` 增加失败用例：normal member 行为保持当前契约；authenticated guest 与 anonymous visitor 响应只含已确认号码，未确认号码字段完全不存在；guest 不含 change markers，visitorKey 不可跨群读取。
- [ ] 在 `calendar-query.ts` 将“是否取 contacts”和“号码可见范围”分成显式参数或等价受类型约束的策略；先证明旧 `includeContacts: true` 路径泄露未确认号码，再只为 guest/anonymous 采用 confirmed-only。不得用 WXML 条件隐藏替代 API 收紧。
- [ ] 给 `endpoints.test.ts` 增加 profile PATCH 必须带 `{ realName, version }`、public visitor resolve/calendar 绝不附 Authorization、以及 `join-guest`/invite 路径不触及 claim 的断言。

### 4.2 会话与用户级缓存

- [ ] 为 `session-storage.ts` 写红测：key 含稳定编码的 `userId`；A 的 last-group 不能被 B 恢复；无效/过期 group 会在 refresh 时删除；只删除当前用户记录。
- [ ] 为 `calendar-cache.ts` 写红测：写入会登记一个可验证的 identity；`removeForUser(A)` 和 `removeForUserGroup(A, group)` 只删除属于 A 的 cache/index；registry 损坏或 storage remove 抛错不会波及 B，也不会让 logout 中断。
- [ ] 扩展 `session.test.ts`：恢复时从 `/groups` 权威列表选择已保存 group，否则选择首个/空并修正存储；切群、join、leave、restore 和 invite replacement-token 回流都通过唯一 `refreshGroupContext({ preferredGroupId })` 收敛；群组 `version` 更新进入 state，使旧 cache identity 自然换代。
- [ ] 保留已有 invite 顺序：先写 replacement token → 清 pending invite → 读 profile/群组 context。保留“logout 后迟到 promise 不回填”和“logout 不删 pending invite”回归。
- [ ] 实现 logout/401 的安全顺序：捕获当前 userId → 递增 generation 并移除 token → 尽力清当前用户 last-group/cache（捕获失败）→ reset memory → 保留 pending invite。只清本用户，绝不枚举后 `wx.clearStorageSync()`；页面 `reLaunch` 只能发生在安全状态已发布后。

### 4.3 统一 guest 路由守卫

- [ ] 写 `route-guard.test.ts` 和页面边界红测，覆盖 anonymous、owner/administrator/member、guest 与独立 platform-admin 标志。
- [ ] 允许 anonymous 只进入 auth、invite bridge 和 QR guest 页；允许 guest 只进入 workbench、groups、readonly calendar 与 minimal profile/logout；notifications、workflow 分包、事件/管理/写入路径必须在任何 endpoint 调用前定向回安全入口。
- [ ] 在受保护 tab 的 `onShow` 和可分享/分包页面加载入口调用 guard。`switchTab('/pages/notifications/index')`、手工 URL、分享恢复和直接 `navigateTo` 都必须有测试证明：guest 不发通知或工作流请求；只靠工作台隐藏 card 不算完成。
- [ ] guest profile 只展示身份/群组摘要和 logout，不读取个人通知偏好、通讯录编辑或平台数据。原生 static tabBar 可以保留，但被拒页面须即时重定向并不得加载任何越权数据；页面进入/退出应恢复适当 tabBar 状态。

### 4.4 API integration runner 与 checkpoint 验收

- [ ] 先为 `scripts/run-api-integration.mjs` 写失败测试，再增加命名 Task 10 suite；既有 `pnpm test:api-integration` 的精确 Task 9 三文件默认行为、local host、`schedule_test`、凭据检查、无秘密输出和串行运行必须不变。
- [ ] 以显式脚本（建议 `pnpm test:api-integration:task10`）运行固定 allowlist：`calendar.integration.test.ts`、`visitor-access.integration.test.ts`、`group-routes.integration.test.ts`、`group-permissions.integration.test.ts`、`membership-claims.integration.test.ts`、`invite-service.integration.test.ts`、`notifications.integration.test.ts`、`wechat-notifications.integration.test.ts` 与 `user-routes.integration.test.ts`。该脚本不得接受任意文件路径；真实环境缺失或 skip 都是失败/未完成，不是绿灯。
- [ ] 完成后运行本 checkpoint 新增的 API/session/cache/navigation/boundary suites、`pnpm vitest run apps/miniprogram`、`pnpm miniprogram:config:audit`、`pnpm miniprogram:typecheck`、`pnpm miniprogram:lint`、受影响文件 Prettier、`pnpm smoke:browser`，随后 `pnpm smoke:check-core` 与 `git diff --check`。
- [ ] 更新状态/日志，显式暂存本 checkpoint 文件，复核 staged diff 后提交：`fix(miniprogram): secure Task 10 session and visitor boundaries`；正常 fast-forward 推送，然后停止。

**10.1 停止条件：** guest/anonymous 的 API 输出无未确认号码；不同用户的 last-group/cache 无交叉；logout/401 不会被迟到响应复活且 pending invite 可回流；任意 guest 直接路由不产生越权请求；Task 10 API allowlist 在真实 `schedule_test` 上零 skip 通过。

## 5. Task 10.2：通知中心与个人入口

**目标：** 在 10.1 已提供的 context 和 route guard 上完成普通成员的通知与个人自助操作；guest 不取得这些能力。

### 5.1 通知列表、已读与偏好

- [ ] 为 `features/notifications/notification-logic.ts` 写红测：已知类型呈现稳定文案；任意未知 `notificationType` 使用“通知”及安全摘要，不假设 payload shape；卡片点击只标已读，不生成未经类型矩阵验证的对象路由。
- [ ] 为 `notification-controller.ts` 写红测：初次/刷新 cursor 置空、分页 cursor 单飞、重复 cursor 不追加、过期 context 不发布；未读数、单条已读和全读按 API 权威结果刷新；错误保留现有列表并提供重试。
- [ ] 将 `pages/notifications/index.*` 从 shell 改为 controller 驱动的列表、空/加载/错误/分页状态。调用 guard 后才请求；guest 被重定向且 endpoint spy 为零次。
- [ ] 实现个人通知偏好三态：`null` 显示系统默认、`[]` 关闭、非空数组显示/提交 1–720 小时且最多 5 个。只提交本小程序可管理的 `wechatNotificationsEnabled` 与 `dutyReminderHours` partial update；浏览器字段保持 API 返回值且绝不被默认值覆盖。
- [ ] 新增 `wechat-subscription-adapter.ts` 与测试。仅由用户点按“订阅值班提醒”调用 `wx.requestSubscribeMessage`，tmplId 只取 `config` 中实际存在的 `dutyReminder`；分别显示 accept、reject、ban、系统不支持和调用异常。授权结果不自动改服务端偏好，也不宣称任何通知已发送。

### 5.2 资料、联系方式和登出页面

- [ ] 为 `profile-controller.ts` 写红测：资料保存使用当前 `profile.version`；409 先获取最新 profile，再保留/展示服务端原 message 和最新资料，清除编辑 flight，不重放提交；成功后同步 session profile/version。
- [ ] 增加本人联系方式测试：用 `(groupId, membershipId)` 而非姓名定位 `isCurrentUser`；本人编辑号码后可走现有确认语义；不会为管理员创建他人编辑入口。保留 API 的“管理员改他人号码会重置确认”集成回归，但该管理 UI 留给 Task 14。
- [ ] 在 profile 页安全读取 `wx.getAccountInfoSync()`，将 miniProgram 运行版本/envVersion 与 `UserProfile.version` 分开命名和展示；API/模拟器不可用时有不泄露的 fallback。
- [ ] 将登出按钮接到 10.1 的精确 purge；先禁用重复点击，始终保留 pending invite，storage 清理异常也必须回登录。logout 后切换另一用户，A 的月历/last-group 绝不出现。

### 5.3 10.2 验收与提交

- [ ] 运行 notifications/profile/route-guard/session/cache 定向测试和全小程序套件；若 endpoint 或 profile/API 触及，运行 `pnpm test:api-integration:task10`，并复跑 affected user/notifications tests。
- [ ] 运行 config audit、typecheck、lint、相关 Prettier、`smoke:browser` 后 `smoke:check-core`、`git diff --check`；DevTools build-npm、preview 和连接态 smoke 无脚本错误。
- [ ] 更新状态/日志，提交 `feat(miniprogram): add notifications and profile controls` 并正常推送，然后停止。

**10.2 停止条件：** 普通成员可分页、刷新/已读通知并安全处理未知类型；偏好三态与订阅授权不混淆；资料冲突可恢复；本人联系方式、版本和精确 logout 均有回归证据；guest 未能读取任一通知或个人敏感端点。

## 6. Task 10.3：群组切换、加入/离开/恢复与匿名二维码访客

**目标：** 使 authenticated user 能管理自己的群组上下文，使匿名 visitorKey 在隔离页面读月历；所有状态变化复用 10.1 的 refresh/purge 语义。

### 6.1 群组页面和状态转换

- [ ] 为 `features/groups/group-controller.ts` 写红测：群组 catalog relation 只映射真实 `none`、`active-member`、`active-guest`、`left-member`；`left-member` 无 join/claim action，只提示管理员邀请；无效 relation 走安全 fallback。
- [ ] 注册 `subpackages/groups/pages/index`，由 workbench 的“群组”入口导航。页面展示当前 groups、catalog、切换、guest join、leave、dissolved restore、loading/error/empty 状态；不放 Task 14 的群组配置入口。
- [ ] 切换必须调用 session 的 user-scoped active group 设置；join 后 `refreshGroupContext({ preferredGroupId: joined.id })`；leave active group 后选择仍有效的首个 group 或空，并清除该用户该群缓存；restore 后优先选择 restored group。所有网络完成都受 context generation 约束。
- [ ] owner 显示不可 leave 的服务端语义；member leave 说明保留历史占位；guest leave 说明可重新以 guest 加入；dissolved restore 仅向服务端允许的原 owner 显示。服务端仍是最终权限判断。
- [ ] 邀请 bridge/`consumePendingInvite` 回归覆盖 replacement token、群组列表刷新、优先 group 选择、pending token 清除顺序和重复回流单飞。

### 6.2 匿名 visitorKey 页面

- [ ] 在 `app.json` 主包注册 `pages/guest/guest`（不可放进需下载的分包）；页面配置为自定义导航且无 tabBar。新增 manifest/boundary test 锁定此路径与 public-only imports。
- [ ] 为 `visitor-calendar-controller.ts` 和 scene parser 写红测：只接受经一次 decode 后的合法 visitor key；缺 scene、错误格式、404/revoked、429 与网络错误都有安全文案；resolve 成功后只读取该 response 对应 group 的 public calendar；切月不登录、不持久化 visitor key 或月历。
- [ ] 复用纯 calendar view-model/网格展示所需只读字段，但不复用 authenticated guest controller 的端点、session 或 cache。匿名页不提供电话 copy/dial（除 API 返回的 confirmed 联系方式外也不新增动作）、事件、change markers、通知、审批、群组目录或任何写操作。
- [ ] authenticated guest 的 calendar 继续走现有 logged-in guest endpoint；结合 10.1 API 红测，WXML/电话 logic 测试必须证明未确认号码不可能产生 copy/dial action。匿名页不强制跳登录。

### 6.3 10.3 验收与提交

- [ ] 运行 groups/visitor/calendar/session/navigation/manifest 定向测试、完整小程序测试和 Task 10 真实 DB integration allowlist；`membership-claims.integration.test.ts` 保持 `/groups/claim` 404 断言。
- [ ] 运行 config audit、typecheck、lint、受影响文件 Prettier、`smoke:browser` 后 `smoke:check-core`、`git diff --check`。DevTools build-npm、preview 和连接态 smoke 必须覆盖新增 groups 分包及 guest 主包页面。
- [ ] 更新状态/日志，提交 `feat(miniprogram): add group and guest journeys` 并正常推送，然后停止。不得进入 V3-4。

**10.3 停止条件：** group switch/join/leave/restore/invite 回流后的 session、active group 和缓存正确；`left-member` 无 claim 通路；二维码在未登录时进入无 tabBar 的单群只读月历；guest/anonymous 无未确认号码、无通知/写入/管理端点调用。

## 7. Task 10 统一验收矩阵

| ID      | 场景                                             | 必须结果                                                          |
| ------- | ------------------------------------------------ | ----------------------------------------------------------------- |
| T10-S01 | A 登出后 B 登录                                  | 仅删 A 的 last-group/月历 cache；B 数据和 pending invite 不受影响 |
| T10-S02 | logout/401 后迟到请求                            | token/profile/groups 不会回填；清理异常不阻断匿名态               |
| T10-S03 | 保存 group 后成员资格已失效                      | refresh 删除 stale key，选择有效群组或空                          |
| T10-S04 | guest 直接 switchTab/分享/workflow URL           | 先守卫后重定向，通知/流程/管理 endpoint 为零调用                  |
| T10-S05 | platform-admin + guest                           | platform flag 不提升 guest 群组权限                               |
| T10-S06 | confirmed 与 unconfirmed 联系方式                | guest/anonymous API 只含 confirmed；前端无 unconfirmed copy/dial  |
| T10-S07 | public visitorKey                                | 合法 scene 无登录打开对应单群；错 key/跨群/revoked 不泄露群组信息 |
| T10-S08 | 通知未知类型                                     | 不崩溃，不猜 payload/深链，仍可标已读                             |
| T10-S09 | cursor/双击全读                                  | 不重复 append/写入；刷新保持权威 unread 数                        |
| T10-S10 | 微信订阅 accept/reject/ban                       | 三种结果分别可见；仅 dutyReminder；不等同服务端偏好或发送成功     |
| T10-S11 | profile 409                                      | 原 message 保留、最新资料可见、无自动重放                         |
| T10-S12 | 本人联系方式                                     | 以 membershipId 定位；确认语义正确；无他人编辑 UI                 |
| T10-S13 | left-member catalog                              | 只显示管理员邀请说明，无 join-guest/claim                         |
| T10-S14 | active owner leave / guest leave / owner restore | 服务端语义与 context/cache 刷新一致                               |
| T10-S15 | invite replacement token                         | 保存 replacement → 清 pending → refresh；重复回流不重复消费       |

## 8. 最终验证、设备复核与 Git

每个 checkpoint 都必须先运行该 checkpoint 定向测试，再运行：

```powershell
pnpm vitest run apps/miniprogram
pnpm miniprogram:config:audit
pnpm miniprogram:typecheck
pnpm miniprogram:lint
pnpm exec prettier --check <本次明确文件>
pnpm smoke:browser
pnpm smoke:check-core
git diff --check
```

涉及 API 的 checkpoint 还必须在守卫环境运行 `pnpm test:api-integration:task10`。它只能连接本机 `schedule_test`；任何环境拒绝、skip 或失败都不得写成通过。每次提交前逐行审阅 `git diff`/`git diff --cached`、写明行为变化，显式暂存任务路径，永不暂存 `apps/miniprogram/minitest/`。

Task 10 最后才运行 DevTools build-npm、preview、连接态 `pnpm miniprogram:smoke`；新增 groups 分包与 `pages/guest/guest` 均须无脚本错误。真机/微信用户复核至少覆盖：QR scene 首开/失效 key、anonymous 无 tabBar、guest direct tab/分享拦截、confirmed 号码、订阅 accept/reject/ban、A→logout→B cache 隔离、pending invite 回流，以及 owner/admin/member/guest × platform-admin 导航矩阵。

若全部证据形成，更新 `docs/project-status.md` 与调试日志为“已完成待用户复核”，提交最终 checkpoint 后停止；**不得顺势实施 V3-4。**

## 9. 复核结论与下一批

- [x] Task 9 的 direct、preview、reason、409、operationId 和真实 DB 测试语义已被前序 checkpoint 锁定，本计划不回退它们。
- [x] `/groups/claim` 删除、访客 confirmed-only 号码、静态 tabBar guard、replacement-token 顺序、精确 logout 和订阅真实边界均有实现级落点。
- [x] 三个 checkpoint 各自包含红测、实现、自动验证、真实数据库/设备门禁和独立提交。
- [ ] 用户批准本计划后，唯一下一批为 **Task 10.1**；完成其 checkpoint 后停止并重新读取实际代码，再决定是否进入 Task 10.2。
