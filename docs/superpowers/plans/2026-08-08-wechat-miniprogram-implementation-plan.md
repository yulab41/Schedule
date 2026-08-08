# 微信小程序「科室排班日历」详细实施计划

- 文档日期：2026-08-08
- 当前状态：用户已批准设计方向，等待规格复核后从任务 1 开始执行
- 依据规格：`docs/superpowers/specs/2026-08-08-wechat-miniprogram-design.md`
- 实施范围：微信小程序客户端 + 后端微信身份/访客扫码/邀请链接/订阅消息扩展 + Web 端配套调整
- 提交策略：每个完整且验证通过的任务形成独立 Git 版本节点，并按 `AGENTS.md` 判断是否推送 GitHub

## 0. 跨对话实施批次

每轮新对话只实施 1–3 个任务，复杂任务一轮一个：

1. 新对话先完整读取 `AGENTS.md` 和 `docs/project-status.md`。
2. 只读取当前批次对应的实施计划章节和相关设计章节，不依赖上一轮聊天记忆。
3. 任务 1–3（数据库/微信网关/认证）、任务 4–5（访客/邀请与身份绑定）、任务 6（订阅消息）涉及安全与并发，原则上一轮一个。
4. 任务 7–13 为小程序工程与页面，普通任务可一轮两个。
5. 每个任务独立验证并形成版本节点；提交前更新 `docs/project-status.md`。
6. 达到当前批次停止条件后即结束该轮，不提前开始下一批。

## 1. 执行原则

1. 严格按任务顺序实施，后续任务不得绕过前置验收。
2. 安全相关逻辑（令牌、邀请/身份绑定、访客 key、订阅发送）先写失败测试再实现。
3. 一个任务只解决一个清晰目标，不混入无关重构；不触碰工作区中用户未提交的格式化改动。
4. 修改 `packages/contracts`、数据库 schema 后先构建 contracts/database 再跑 API 集成测试。
5. 每次提交前运行定向测试与 `pnpm verify`；涉及核心链路（contracts 等）运行 `pnpm smoke:check-core`，浏览器冒烟按 AGENTS.md 执行。
6. 仅显式暂存当前任务文件；不提交 `.env`、AppSecret、上传密钥、小程序密钥文件。
7. 规格变更先改设计文档和本计划，获批后再改代码。

## 2. 计划采用的工程组件

- 小程序：原生微信小程序、TypeScript、`tdesign-miniprogram`、`miniprogram-api-typings`。
- API：Fastify、TypeScript、Zod（沿用）。
- 数据访问：Drizzle ORM、MySQL2、SQL 迁移文件（沿用）。
- 微信网关：服务端直接调用 `api.weixin.qq.com`（jscode2session / getUnlimited / subscribeMessage.send），HTTP 用全局 fetch；无第三方 SDK。
- 会话令牌：Node `crypto` HMAC-SHA256 自签名令牌，不引入 JWT 依赖。
- 上传：`miniprogram-ci`（仅本地脚本，读取本机上传密钥）。
- 测试：Vitest、本地 Docker MySQL 集成测试（沿用）。
- UI 决策（2026-08-08 用户确认）：组件库仅 `tdesign-miniprogram`，不引入 WeUI。
- 官方能力参考：微信小程序框架文档（<https://developers.weixin.qq.com/miniprogram/dev/framework/>）、订阅消息、小程序码、分享、场景值等页面作为权威参考；WeUI（<https://github.com/wechat-miniprogram/weui-miniprogram>）不引入，其官方交互规范（订阅授权引导、分享说明等）仅作设计参考。

## 3. 目标目录结构

```text
apps/api/src/
  adapters/auth/wechat-auth.ts        # 微信登录会话令牌签发/校验
  modules/wechat/
    wechat-gateway.ts                 # access_token 缓存 + 微信 HTTP + mock
    wechat-gateway.spec.ts
    wechat-auth-routes.ts             # /auth/wechat/login
    wechat-auth-service.ts
    wechat-push-dispatcher.ts         # subscribeMessage.send 投递器
    wechat-push-dispatcher.spec.ts
  modules/groups/
    visitor-key-service.ts            # visitor_key 生成/校验
    invite-service.ts                 # 邀请链接创建/解析/接受 + 身份合并
    invite-service.integration.test.ts
  modules/notifications/
    notification-writer.ts            # 增加 wechat 投递行
    notification-delivery-job.ts      # 微信投递重试（或扩展现有 retry）
apps/miniprogram/
  app.ts / app.json / app.wxss
  project.config.json
  config/index.ts
  api/client.ts / api/endpoints.ts
  store/session.ts
  styles/tokens.wxss
  components/...
  pages/...
  scripts/upload-ci.mjs
migrations/0033_wechat_identity_and_invites.sql
migrations/0034_wechat_notifications.sql
packages/database/src/schema/wechat.ts
packages/contracts/src/wechat.ts
```

## 4. 通用验证命令

- 定向测试：`pnpm vitest run <pattern>`
- 全量：`pnpm verify`
- 核心链路冒烟：`pnpm smoke:check-core`
- 浏览器冒烟：`pnpm smoke:browser`（仅核心链路/Web 改动时）
- 小程序：`pnpm --filter @schedule/miniprogram typecheck`、`pnpm lint`

## 5. 任务 1：数据库迁移与 schema（微信身份/访客 key/邀请/通知渠道）

目标：新增 0033、0034 迁移，同步 Drizzle schema 与 contracts 基础类型。

主要文件：

- `migrations/0033_wechat_identity_and_invites.sql`
- `migrations/0034_wechat_notifications.sql`
- `packages/database/src/schema/wechat.ts`、`schema/index.ts`
- `packages/database/src/schema/notifications.ts`
- `packages/contracts/src/wechat.ts`、`errors.ts`

实施步骤：

1. 0033：`users.wechat_openid`（唯一、可空）、`groups.visitor_key`（存量回填随机 32 位十六进制后加唯一非空约束）、`invite_tokens` 新表（含 target_membership_id/target_roster_entry_id 二选一约束、token_hash、expires_at、used_by_user_id、status、版本与时间戳；TIMESTAMP 显式默认值）。
2. 0034：`notification_deliveries.channel` ENUM 增加 `wechat`；增加 `external_message_id`；`notification_preferences.wechat_notifications_enabled` 默认 1；新增 `visitor_access_logs` 表（group_id、business_month、client_ip、request_id、created_at；TIMESTAMP 显式默认值）。
3. 同步 `packages/database/src/schema` 与 `packages/contracts/src/wechat.ts`（wechat 会话、访客解析、访问记录、群码、邀请契约 + 新错误码）。
4. 扩展 `redact.ts` 日志脱敏路径（appsecret、token、visitor_key、openid）。

验证：

- 迁移在空库与已有数据（含存量群组回填）上可执行。
- contracts/database 构建通过；`pnpm verify` 全绿；`pnpm smoke:check-core` 通过。

版本节点：`feat(db): wechat identity, visitor key/logs, invites and wechat notification channel`

## 6. 任务 2：微信网关模块与环境配置

目标：封装 jscode2session、getUnlimited、subscribeMessage.send、access_token 缓存，支持 mock。

主要文件：

- `apps/api/src/modules/wechat/wechat-gateway.ts`、`wechat-gateway.spec.ts`
- `apps/api/src/config/env.ts`、`.env.example`、`.env.production.example`

实施步骤：

1. 定义 `WechatGateway` 接口：`exchangeCode(code)`、`getUnlimitedQr(scene, page, envVersion)`、`sendSubscribeMessage(openid, templateId, data)`、`isConfigured`。
2. 实现真实网关：access_token 用内存缓存 + 到期前 5 分钟刷新；错误码映射表；fetch 超时。
3. 实现 mock 网关：`WECHAT_MOCK_MODE=true` 时返回稳定 mock openid、占位二维码字节、记录发送日志并标记成功；生产 env schema 拒绝 mock=true。
4. env 增加：`WECHAT_APPID`、`WECHAT_APPSECRET`、`WECHAT_SESSION_SECRET`、`WECHAT_MOCK_MODE`、`WECHAT_QR_ENV_VERSION`、三个模板 ID；`local-server.ts` 注入网关。
5. 日志脱敏确认：网关请求/响应不打印 appsecret 与 openid。

验证：

- mock 模式全流程单测通过；真实模式错误码映射单测通过。
- env 校验测试覆盖生产禁用 mock。

版本节点：`feat(api): wechat gateway with mock mode`

## 7. 任务 3：微信认证与会话令牌

目标：`/auth/wechat/login`、HMAC 会话令牌、AuthPort 集成与会话重签（供邀请接受合并场景复用）。

主要文件：

- `apps/api/src/adapters/auth/wechat-auth.ts`
- `apps/api/src/modules/wechat/wechat-auth-service.ts`、`wechat-auth-routes.ts`
- `apps/api/src/plugins/authenticate.ts`（适配新 AuthPort 组合）
- `apps/api/src/app.ts`、`local-server.ts`
- 集成测试：`wechat-auth.integration.test.ts`

实施步骤：

1. 签发/校验 HMAC 令牌：payload `{ openid, sub, exp }`；过期、篡改、密钥缺失一律 401。
2. 登录：exchangeCode → 按 `wechat_openid` 查用户；不存在则创建 `cloudbase_uid='wx_'+openid` 与空资料（未填真实姓名前允许会话但资料接口 404）；返回 `{ token, isNewUser, profile? }`。
3. 会话重签：提供 `issueSessionForUser(userId, openid)`，供任务 5 全量合并后签发新令牌。
4. AuthPort：按 openid 解析用户；mock/dev 令牌兼容保留；生产 AUTH_DEV_MODE=false。
5. 审计：登录（新用户）。

验证：

- 集成测试：登录/新用户/重复登录/令牌过期/篡改/签名密钥缺失。
- `pnpm verify` 全绿；`pnpm smoke:check-core` 通过。

版本节点：`feat(api): wechat login and signed session tokens`

## 8. 任务 4：访客扫码统一（visitor key + 群码 + 访问记录 + 公开目录下线）

目标：群组访客 key、群组小程序码 API、访客接口改造、访客访问记录、Web 公开目录下线。

主要文件：

- `apps/api/src/modules/groups/visitor-key-service.ts`
- `apps/api/src/modules/groups/group-routes.ts`（群码/visitor-key 重生成）
- `apps/api/src/modules/calendar/calendar-routes.ts`、`calendar-query.ts`
- `apps/api/src/modules/calendar/visitor-access-log.ts`（写入与查询）
- `apps/web/src/features/groups/GuestCalendarPanel.vue`、`workbench-nav.ts`、`HomeView.vue`
- 集成测试：`visitor-access.integration.test.ts`

实施步骤：

1. 群组创建时生成 visitor_key；群主可重生成（旧码失效，写审计）。
2. `GET /groups/:groupId/group-qr`：owner/admin 权限，网关生成小程序码，返回 PNG base64（内存缓存，失败按错误码处理）。
3. 删除 `GET /guest/groups`；新增 `POST /guest/groups/resolve`（限频）；`GET /guest/groups/:groupId/calendar` 增加 `visitorKey` 必填校验。
4. 访客日历读取成功后写访问日志（business_month、client_ip、request_id）；新增 `GET /groups/:groupId/visitor-access-logs`（owner/admin，倒序分页）。
5. Web：访客面板移除目录加载，改为 `?vkey=` 链接进入；已登录 guest 成员数据保留兼容，不再提供新加入入口。
6. 更新浏览器冒烟断言（访客目录不再出现；vkey 访问正常；访问记录可见）。

验证：

- 集成测试：群码权限、visitor_key 校验/错误/重生成旧码失效、公开目录 404、访问日志写入与权限、限频。
- `pnpm smoke:browser` + `pnpm smoke:check-core`。

版本节点：`feat(api+web): scan-only guest access with visitor keys and group QR codes`

## 9. 任务 5：邀请链接与身份绑定

目标：邀请创建/解析/接受/撤销，一次性令牌 + 姓名确认 + 角色配置；接受邀请同时承担微信身份与成员身份的绑定（替代独立绑定码）。

主要文件：

- `apps/api/src/modules/groups/invite-service.ts`、`invite-routes.ts`
- `apps/api/src/modules/groups/group-routes.ts`（创建入口 + 群组码加入/认领接口下线）
- `apps/api/src/modules/groups/membership-service.ts`（移除 claim/claim-lookups/认领申请方法）
- `packages/contracts/src/wechat.ts`
- 集成测试：`invite-service.integration.test.ts`、`membership-claims.integration.test.ts`（更新）

实施步骤：

1. 创建：目标为待认领名单或未认领成员；可指定排班角色与权限角色；生成随机 token（只返回一次），存 SHA-256；每群待使用令牌限频。
2. 解析：校验状态/过期；返回群组名、姓名、角色预览。
3. 接受：确认姓名与邀请一致 → 事务内：
   - 目标为待认领名单/未认领成员：创建或绑定成员到当前用户 → 可选加入排班角色（memberScheduleRoles）；
   - 目标已被其他账号认领：执行受控全量合并——把当前微信账号已有的全部有效成员关系（含群主身份、认领申请）转移到已认领账号，openid 写入该账号（不覆盖 cloudbase_uid）、删除当前账号、调用 `issueSessionForUser` 返回新令牌；若两个账号在同一群组已有重复有效身份，或当前账号是平台/节假日管理员，返回 409；
   - 标记 used、记录用户与审计。
4. 撤销：owner/admin 撤销待使用令牌。
5. 并发防护：接受时行锁邀请令牌，双开只成功一次。
6. 下线群组码加入与认领申请：移除 `POST /groups/claim`、`POST /groups/:groupId/claim-lookups` 及认领申请相关路由（历史数据保留），同步 contracts 与集成测试；Web/小程序不再提供群组码加入与认领 UI（页面收口在任务 8/14）。

验证：

- 集成测试：创建/接受/重复接受 409/过期/撤销/姓名不一致 400/权限/排班角色写入/未认领绑定/已认领全量合并返回新令牌（含多群与群主转移）/同群重复身份 409/管理员账号 409/限频。
- 群组码加入、认领查询、认领申请接口移除后返回 404；既有未认领名单与历史认领数据不受影响。
- `pnpm verify` 全绿。

版本节点：`feat(api): one-time role-configured invite links with identity binding`

## 10. 任务 6：微信订阅消息投递

目标：通知渠道扩展、微信投递器、值班提醒与状态变更接入、重试与 mock。

主要文件：

- `apps/api/src/modules/wechat/wechat-push-dispatcher.ts`、`wechat-push-dispatcher.spec.ts`
- `apps/api/src/modules/notifications/notification-writer.ts`、`notification-service.ts`
- `apps/api/src/jobs/duty-reminders.ts`、`notification-retry.ts`
- `packages/database/src/schema/notifications.ts`
- 集成测试：`wechat-notifications.integration.test.ts`

实施步骤：

1. NotificationWriter 为开启微信提醒且有 openid 的接收者创建 `channel='wechat'` 投递行。
2. 微信投递器按模板映射发送（值班提醒/审批结果/状态变更）；成功写 external_message_id；43101 → skipped；系统错误进入重试。
3. 值班提醒在现有 job 中触发微信投递；审批/状态变更在对应服务成功事务后写入。
4. 成员提醒设置接口增加 `wechatNotificationsEnabled`。
5. mock 模式发送记录日志并标记 sent。

验证：

- 单测覆盖错误码映射；集成测试覆盖投递行创建、发送成功/跳过/重试。
- `pnpm verify` 全绿。

版本节点：`feat(api): wechat subscription message delivery`

## 11. 任务 7：小程序工程脚手架

目标：`apps/miniprogram` 可被微信开发者工具导入，类型检查与 lint 纳入工作区。

主要文件：

- `apps/miniprogram/package.json`、`tsconfig.json`、`project.config.json`
- `apps/miniprogram/app.ts`、`app.json`、`app.wxss`
- `apps/miniprogram/config/index.ts`、`styles/tokens.wxss`
- `pnpm-workspace.yaml`、根 `package.json` scripts

实施步骤：

1. 初始化原生小程序 TS 工程；安装 `tdesign-miniprogram`、`miniprogram-api-typings`；`project.config.json` 填 AppID（不提交 secret）。
2. app.json 配置 tabBar（工作台/日历/通知/我的）与页面注册；tokens.wxss 定义主色、周末红、今天金、间距与圆角。
3. 仅引入 `tdesign-miniprogram`，不安装 WeUI；自定义日历网格等组件以 TDesign 样式令牌为基础。
4. 建立 `api/client.ts` 基础封装（baseURL、Bearer、401 处理、错误映射）与 `store/session.ts`。
5. 根 package.json 增加 `miniprogram:typecheck`、`miniprogram:lint` 脚本；ESLint/Prettier 纳入。

验证：

- `pnpm --filter @schedule/miniprogram typecheck` 与根 lint 通过。
- 开发者工具可导入并显示空首页（无红屏）。

版本节点：`feat(miniprogram): scaffold native TypeScript app with TDesign`

## 12. 任务 8：小程序登录/注册页

目标：微信一键登录、真实姓名资料、会话恢复；直接打开只能创建群组，加入群组必须通过邀请链接。

主要文件：

- `apps/miniprogram/pages/login/*`、`pages/register/*`
- `apps/miniprogram/api/endpoints.ts`、`store/session.ts`
- `apps/miniprogram/config/index.ts`（mock 开关）

实施步骤：

1. 登录页：`wx.login` → `/auth/wechat/login`；新用户跳资料页填真实姓名（调用现有 `/users` 注册）；老用户直接进工作台。
2. 会话恢复：启动时读 storage token，401 统一回登录页；登录按钮防重复点击。
3. 错误/空态/加载态组件化。
4. 首页/工作台入口提示：直接打开只能创建群组；加入群组需群主/管理员邀请链接。

验证：

- mock 模式在开发者工具完整走通登录→资料→工作台。
- 真机预览（调试模式）同流程通过。

版本节点：`feat(miniprogram): login and profile`

## 13. 任务 9：小程序访客日历、群码与邀请落地页

目标：群码 scene 解析、访客日历、群码/邀请分享落地页。

主要文件：

- `apps/miniprogram/pages/guest/guest.ts/.wxml/.wxss`
- `apps/miniprogram/pages/invite/invite.ts/.wxml/.wxss`
- `apps/miniprogram/components/calendar-grid/*`
- `apps/miniprogram/api/endpoints.ts`

实施步骤：

1. 启动参数 `scene` 解码：`v=<visitor_key>` → resolve → 访客日历；无 scene 时提示“请扫描群组小程序码”。
2. 访客日历：月视图 + 上一月/下一月；周末红/今天金黄/班次色块；点击值班展示姓名与电话（仅已确认号码）。
3. 邀请落地页：`t=<token>` → resolve 展示群组/姓名/角色 → 未登录先登录 → 确认接受。
4. 群码展示页（群管理进入）：base64 渲染、保存到相册。

验证：

- 开发者工具输入 mock scene 可查看访客日历；邀请链接正/反向路径通过。

版本节点：`feat(miniprogram): guest calendar, group QR and invite landing`

## 14. 任务 10：小程序日历与成员/联系方式

目标：登录后月/周/列表日历、群组切换、成员与电话。

主要文件：

- `apps/miniprogram/pages/calendar/*`、`pages/calendar-week/*`、`pages/calendar-list/*`
- `apps/miniprogram/pages/members/*`
- `apps/miniprogram/components/calendar-grid/*`、`shift-card/*`

实施步骤：

1. 复用日历接口渲染三视图；数据模型与 Web 对齐（roles/shiftTypes/assignments/members）。
2. 班次详情弹层：值班人、电话（`wx.makePhoneCall`）、事件标记。
3. 成员页：列表、联系方式确认状态、拨号；权限按 Web 口径。
4. 群组切换器（工作台顶部）。

验证：

- 三视图在 375×667 无错位、无横向滚动；深色模式可读。

版本节点：`feat(miniprogram): calendar views, members and contacts`

## 15. 任务 11：小程序请假/换班/加扣班

目标：成员创建申请、影响预览、历史与撤销；与 Web 相同校验。

主要文件：

- `apps/miniprogram/pages/leaves/*`、`pages/swaps/*`、`pages/duty-adjustments/*`
- `apps/miniprogram/components/form-*`

实施步骤：

1. 表单与预览调用现有接口；日期/班次选项复用 Web 格式（日期 + 班次名 + 星期，周末红色）。
2. 提交前请求订阅“审批结果”模板（开启时）。
3. 我的申请列表与状态；可撤销/取消按权限显示。

验证：

- 与后端集成测试一致；模拟器全流程通过。

版本节点：`feat(miniprogram): leave, swap and duty adjustment flows`

## 16. 任务 12：小程序审批中心、事件与访问记录、通知/提醒设置

目标：管理员审批、排班事件时间线、访客访问记录（群主/管理员）、站内通知、订阅授权与提醒设置。

主要文件：

- `apps/miniprogram/pages/approvals/*`、`pages/events/*`、`pages/notifications/*`、`pages/notification-settings/*`

实施步骤：

1. 审批中心：请假/换班/加扣班待办、影响预览、通过/拒绝；审批时请求“状态变更”模板。
2. 事件中心：排班事件时间线；群主/管理员可切换“访问记录”查看访客访问日志。
3. 通知中心：未读计数、列表、已读/全部已读、跳转。
4. 提醒设置：提醒时间（沿用群组/个人偏好接口）、微信订阅开关；开启与每次进入时静默 `wx.requestSubscribeMessage`。

验证：

- 订阅授权在模拟器弹窗/静默两种路径通过；通知未读计数正确。

版本节点：`feat(miniprogram): approvals, events/visitor logs, notifications and reminder subscriptions`

## 17. 任务 13：小程序群管理、排班配置与统计

目标：全功能管理页（成员与待认领名单/角色/班种/排班/群码/邀请/转让解散）与统计。

主要文件：

- `apps/miniprogram/pages/group-manage/*`、`group-members/*`
- `apps/miniprogram/pages/schedule-roles/*`、`shift-types/*`、`scheduling/*`
- `apps/miniprogram/pages/group-qr/*`、`invite-create/*`、`statistics/*`

实施步骤：

1. 按 Web 现有页面拆分移动端流程：成员与待认领名单（用于发起邀请）、权限角色、排班角色与轮值顺序、班种、排班期间生成/预览/发布/撤回、手动排班与模板（保持与 Web 同数据与校验）。
2. 群管理：改名/改码/访客 key 重生成/群码展示/邀请创建/转让/解散恢复。
3. 统计：月度/年度/周末/节假日/加扣班，图表用轻量 canvas/简单列表。

验证：

- 与 Web 对照走查每个管理动作；接口校验一致。

版本节点：`feat(miniprogram): group administration and statistics`

## 18. 任务 14：Web 端配套调整

目标：公开群组目录下线、访客 vkey 链接、群组码加入/认领申请入口下线、登录体验适配。

主要文件：

- `apps/web/src/features/groups/GuestCalendarPanel.vue`
- `apps/web/src/features/layout/workbench-nav.ts`、`views/HomeView.vue`
- `apps/web/src/features/groups/*`（群组管理/成员面板：移除群组码加入与认领入口）
- `apps/web/src/api/client.ts`

实施步骤：

1. 移除访客目录加载与入口；访客页读取 URL `vkey` 调访客日历。
2. 移除群组码加入、认领查询/申请入口；群组码仅作为群组标识展示。
3. 登录页与访客页文案补充“加入群组必须通过群主/管理员邀请链接；访客仅可扫描群组小程序码查看”。
4. 更新浏览器冒烟断言。

验证：

- `pnpm smoke:browser` 与 `pnpm smoke:check-core` 通过。

版本节点：`feat(web): scan-only guest access, invite-only joining and copy`

## 19. 任务 15：部署与验收

目标：服务器配置、小程序后台配置、上传脚本、验收清单。

主要文件：

- `.env.production.example`、`docs/deployment/aliyun-ecs.md`
- `docs/deployment/wechat-miniprogram-setup.md`
- `apps/miniprogram/scripts/upload-ci.mjs`

实施步骤：

1. 服务器 `.env.production` 增加微信配置（AppSecret 不提交）；迁移先行部署纪律。
2. 编写并本地验证 `upload-ci.mjs`（读本机上传密钥上传体验版）。
3. 编写《微信小程序从 0 到上线》文档：注册/类目/合法域名/订阅模板/备案/发布核对清单，并附官方框架文档、订阅消息、小程序码与 WeUI 规范参考链接。
4. 端到端验收：登录、扫码访客、邀请（未认领绑定/已认领合并）、审批、提醒订阅、三视图、深色模式；用户真机复核后提交审核。

验证：

- `pnpm verify` 全绿；ECS 部署后 API 冒烟通过；体验版真机清单全部勾选。

版本节点：`docs+ops(miniprogram): deployment, upload script and launch checklist`

## 21. 每阶段检查点

- 任务 1–3 完成后：微信账号体系可用（mock 与真实配置均可登录），`pnpm verify` 全绿。
- 任务 4–6 完成后：扫码访客与访问记录、邀请/身份绑定（唯一加入方式）、群组码加入/认领下线、订阅消息后端全部可用并有集成测试。
- 任务 7–13 完成后：小程序全功能可在开发者工具与真机预览运行。
- 任务 14–15 完成后：Web 与小程序统一访客口径，上线材料齐备，等待用户提交审核与发布。

## 22. 实施开始条件

1. 用户复核并批准本计划与设计规格。
2. 工作区 Git 状态确认（当前存在用户未提交的格式化改动，任务 1 起不得暂存或改写）。
3. 本地 Docker MySQL 可用，`pnpm install` 依赖完整。
