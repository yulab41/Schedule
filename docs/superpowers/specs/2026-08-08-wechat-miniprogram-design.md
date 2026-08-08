# 设计：微信小程序「科室排班日历」

- 文档日期：2026-08-08
- 当前状态：用户已批准设计方向，等待规格复核后进入实施
- 依据规格：`docs/superpowers/specs/2026-08-01-medical-staff-scheduling-system-design.md`（第 26.1 节）
- 实施范围：微信小程序客户端 + 后端微信身份/访客扫码/邀请链接/订阅消息扩展 + Web 端配套调整
- 小程序账号：个人主体；名称“科室排班日历”，简称“科室排班”；AppID `wx56a7a21f974fd9af`

## 1. 背景与目标

Web 1.0 已上线阿里云 ECS（Fastify + MySQL + Nginx），ICP 备案即将完成。本阶段在其上增加微信小程序，复用同一 ECS、API、排班规则和数据。

目标：

1. 微信用户登录后可通过群组码 + 真实姓名认领加入群组；群主/管理员可通过分享链接把已配置好角色的成员直接拉入群组。
2. 访客模式统一为“只有扫描群组专属小程序码才能查看固定群组”，关闭公开群组列表。
3. 小程序具备值班提醒和状态变更提醒（微信订阅消息 + 站内通知）。
4. 小程序覆盖 Web 端全部用户与群组管理功能，界面美观、简约、无错位。

## 2. 用户决策

| 主题 | 决策 |
| --- | --- |
| 技术路线 | 方案 A：原生微信小程序 + TypeScript + TDesign 小程序组件 |
| 功能范围 | 全功能版：成员功能 + 群组管理/审批全部搬入小程序 |
| 邀请链接 | 一次性令牌 + 姓名确认；先到先得风险在确认页明示并记录审计 |
| 访客模式 | 网页端公开群组列表一并关闭；只有扫码可访客查看 |
| 已有账号 | 不做独立绑定码；通过管理员/群主定向邀请链接绑定成员身份（详见 5.4） |
| 主体 | 个人主体，名称“科室排班日历”（简称“科室排班”） |
| 订阅消息 | 个人主体只能使用一次性订阅；长期订阅不可用 |
| 排班提醒模板 | `Nmgf9k3bTIUaohtQFIMl8j_xbZAN2VDm1qnpQIL5WKI`（审批/状态模板待补） |

## 3. 范围

### 3.1 本次范围

- 后端：微信登录/会话令牌、邀请链接身份绑定、群组访客 key、群组小程序码、邀请链接、订阅消息投递渠道。
- 小程序：登录注册、访客日历、群组日历（月/周/列表）、成员与联系方式、请假、换班、加扣班、审批中心、通知与提醒设置、群管理（成员/认领/角色/班种/排班配置/群码/邀请/转让解散）、统计、我的。
- Web：关闭公开群组列表、访客页改为凭访客 key 访问、登录体验适配微信。

### 3.2 不在本次范围

- 平台运维控制台（备份、任务运行、节假日导入）保持 Web 端，不搬入小程序。
- 护士复杂排班（组合班、资质约束等）不在本阶段。
- 微信长期订阅消息（个人主体不可用）。
- 微信支付、社交类能力。

## 4. 架构总览

```text
微信小程序（apps/miniprogram，原生 TS + TDesign）
        │ HTTPS request /api/...
        ▼
Nginx（hosp.schedule.eylinhome.top）
        ▼
Fastify API（apps/api）
  ├─ 微信网关模块（jscode2session / getUnlimited / subscribeMessage.send / access_token 缓存 / mock）
  ├─ 会话认证（HMAC 令牌，AuthPort 适配）
  ├─ 群组/成员/邀请/访客/通知（复用现有模块）
  └─ MySQL（新增 users.wechat_openid、groups.visitor_key、invite_tokens、微信投递渠道）
```

约束：

- 小程序客户端不直接引用 Zod 或 Vue；类型来自 `@schedule/contracts`（仅 type-only）。
- 微信网关通过接口注入，测试与 mock 模式替换真实 HTTP 调用。
- AppSecret、会话密钥、模板 ID 只存在于环境变量，不提交仓库。

## 5. 账号与身份

### 5.1 微信登录

- 客户端 `wx.login()` 取得 `code`，调用 `POST /auth/wechat/login`。
- 服务端用 AppID/AppSecret 调 `jscode2session` 换取 `openid`（不依赖用户授权昵称头像）。
- 新用户自动创建业务用户；已有 `users.wechat_openid` 直接返回会话。
- 开发期 `WECHAT_MOCK_MODE=true` 时，网关不调用微信，用稳定 mock openid 模拟。

### 5.2 身份字段

- `users` 新增 `wechat_openid VARCHAR(64) NULL UNIQUE`。
- 微信用户创建时同时写入 `cloudbase_uid = 'wx_' + openid`（保持既有查询以 cloudbaseUid 定位用户不变）与 `wechat_openid`。
- 接受已认领成员邀请合并身份时不改写既有 `cloudbase_uid`，只写入 `wechat_openid`；微信认证端口按 openid 查 `users.wechat_openid` 解析用户，开发模式令牌仍按 cloudbaseUid 兼容。
- 保留现有开发模式认证（`AUTH_DEV_MODE`），仅本地开发可用；生产必须关闭。

### 5.3 会话令牌

- 登录成功后签发 HMAC-SHA256 签名令牌：`base64url(header.payload).signature`，payload 含 `openid`、`sub`（业务 user id）、`exp`（默认 30 天）。
- 密钥 `WECHAT_SESSION_SECRET`（≥32 字节），仅存服务器环境变量。
- 小程序端把令牌存 storage，请求带 `Authorization: Bearer <token>`；现有接口无需修改认证方式。

### 5.4 身份绑定（由邀请链接承担）

- 系统不提供独立绑定码。微信身份与成员身份的绑定只发生在两个入口：
  1. 登录后输入群组码 + 真实姓名认领（目标成员未认领时，沿用现有认领流程）；
  2. 接受管理员/群主定向分享的邀请链接（目标成员已由管理员配置好）。
- 接受邀请时若目标成员尚未认领：直接绑定到当前微信账号。
- 接受邀请时若目标成员已被其他账号认领（典型场景：网页老用户）：执行受控全量合并——把当前微信账号已有的全部有效群组关系（含群主身份、认领申请）转移到已认领账号，openid 写入该账号（只写入 `users.wechat_openid`，不改写既有 `cloudbase_uid`），删除当前微信空壳账号，并在接受响应中签发新会话；同一微信用户可同时属于多个群组，历史数据全部延续。
- 合并限制：若两个账号在同一个群组已各自存在有效成员身份，或当前微信账号是平台/节假日管理员，则拒绝合并并返回 409，提示先处理冲突，避免数据混并或管理员权限失效。
- 合并/绑定均写审计日志。

## 6. 群组、访客与扫码

### 6.1 访客 key

- `groups` 新增 `visitor_key VARCHAR(64) NOT NULL UNIQUE`（随机 32 位十六进制）。
- 新群组创建时生成；存量群组迁移时回填。
- `visitor_key` 只出现在小程序码与受控分享链接中，任何群组接口不返回。
- 群主/管理员可重新生成（旧码立即失效），并写入审计。

### 6.2 群组小程序码

- 群主/管理员调用 `GET /groups/:groupId/group-qr`，服务端用 `wxacode.getUnlimited` 生成：
  - `scene`：`v=<visitor_key>`（长度约束内，不包含群组码）。
  - `page`：`pages/guest/guest`（小程序落地页）。
  - `env_version`：按环境变量 `WECHAT_QR_ENV_VERSION`（开发/体验/正式）。
- 响应为 PNG base64，小程序用 `data:image/png;base64,...` 直接展示，可保存到相册打印，不依赖 downloadFile 合法域名。
- 生成结果缓存到内存（access_token 有效期内的短期缓存），失败时按微信错误码处理。

### 6.3 访客接口改造

- 删除公开群组列表 `GET /guest/groups`；`GuestCalendarPanel` 不再加载目录。
- 扫码落地页用 scene 中的 `v` 调 `POST /guest/groups/resolve { visitorKey }`（公开、限频）得到 `groupId/groupName`。
- 访客日历改为 `GET /guest/groups/:groupId/calendar?visitorKey=...&businessMonth=...`，服务端校验 visitorKey 属于该群组。
- 保留现有访客日历数据口径：群组名、排班角色、班种、值班姓名、已确认电话、节假日与调休；不返回群组码、事件、统计、管理能力。
- Web 端访客页只接受 `?vkey=` 链接，不对外列出；同时保留“已登录 guest 成员”的工作台入口。

## 7. 邀请链接

### 7.1 数据模型

`invite_tokens`：

| 字段 | 说明 |
| --- | --- |
| id | CHAR(36) 主键 |
| group_id | 目标群组 |
| target_membership_id / target_roster_entry_id | 二选一：已有未认领成员身份或待认领名单 |
| invitee_real_name | 被邀请人真实姓名（链接中展示并需确认） |
| permission_role | 加入后权限角色（member；群主可选 administrator） |
| schedule_role_id | 可选排班角色，接受后自动加入该排班角色成员列表 |
| created_by_user_id | 创建者（群主/管理员） |
| token_hash | SHA-256（链接明文 token 只返回一次） |
| expires_at | 默认 7 天 |
| used_by_user_id / used_at | 使用记录 |
| status | pending / used / revoked / expired |

### 7.2 流程

1. 群主/管理员在小程序“成员管理 → 邀请加入”选择目标人员（待认领名单或未认领成员），可配置排班角色；服务端创建一次性令牌。
2. 小程序用 `open-type="share"` 分享落地页 `pages/invite/invite?t=<token>`；token 即邀请链接密钥，明示“请转发给指定的张三本人，先到先得”。
3. 被邀请人打开 → 需登录（未登录先走登录/注册）→ `POST /invites/resolve { token }` 展示“邀请你以 XX 角色加入 XX 群组，姓名：张三”。
4. 确认姓名一致后 `POST /invites/accept { token, confirmRealName }`：
   - 目标为待认领名单：创建成员并绑定当前用户；可选加入排班角色。
   - 目标为未认领成员：绑定当前用户；可选加入排班角色。
   - 目标已被其他账号认领：按 5.4 全量合并（转移微信账号已有群组关系与群主身份 + openid 绑定 + 重签会话）；冲突场景 409。
   - 无需再填真实姓名、无需认领审批。
5. 令牌一次性：使用、过期、撤销后立即失效；使用/撤销写审计。

### 7.3 风险与防护

- 转发风险（抢先使用）在确认页与分享文案中明示；记录 `used_by_user_id`、时间与 IP（经 request context）。
- 创建者限频（每群每分钟最多 10 个待使用令牌）。
- 令牌明文只返回一次，服务端仅存哈希。

## 8. 提醒与订阅消息

### 8.1 渠道扩展

- `notification_deliveries.channel` ENUM 增加 `wechat`。
- `notification_preferences` 增加 `wechat_notifications_enabled TINYINT DEFAULT 1`。
- `notification_deliveries` 增加 `external_message_id VARCHAR(64) NULL`（微信 msgid，审计用）。
- 投递判断：用户有 `wechat_openid` 且成员偏好开启且客户端已订阅对应模板。

### 8.2 一次性订阅机制

- 客户端在以下时机调用 `wx.requestSubscribeMessage`（用户选“总是保持以上选择”后不再弹窗，仍累计额度）：
  - “提醒设置”开启值班提醒时；
  - 之后每次打开小程序（若开启）静默补一次值班提醒模板额度；
  - 提交请假/换班/加扣班申请时，订阅“审批结果”模板；
  - 收到审批操作（管理员处理）时订阅“状态变更”模板。
- 服务器不持久化额度；发送时若返回 `43101`（用户拒绝/无额度）记为 `skipped` 并保留站内通知。

### 8.3 模板配置

- `WECHAT_DUTY_REMINDER_TEMPLATE_ID`：排班提醒（已提供）。
- `WECHAT_APPROVAL_RESULT_TEMPLATE_ID`：审批结果（待补充）。
- `WECHAT_STATUS_CHANGE_TEMPLATE_ID`：状态变更（待补充）。
- 模板 ID 只存服务器环境变量；`apps/web` 不感知。

### 8.4 发送与重试

- 复用现有 `notification_deliveries` 状态机（pending/sent/failed/skipped、attempts、next_attempt_at）。
- 新增微信投递器：获取 access_token → `subscribeMessage.send` → 成功写 `external_message_id`；网络/系统错误按现有重试任务退避；业务错误码映射（43101 跳过、40003 参数错误失败）。
- 值班提醒由现有 `DutyReminderJob` 触发，`NotificationWriter` 增加微信投递行。
- mock 模式：不调用微信，把发送目标与内容写入日志并标记 sent。

## 9. 小程序客户端

### 9.1 工程结构

```text
apps/miniprogram/
  project.config.json       # 开发者工具项目配置（AppID）
  project.private.config.json # 本地私有（不入库）
  package.json              # tdesign-miniprogram、miniprogram-api-typings
  tsconfig.json
  app.ts / app.json / app.wxss
  config/index.ts           # API 地址、模板 ID 映射、版本
  api/client.ts             # 请求封装（token、错误、刷新登录）
  api/endpoints.ts          # 契约类型（type-only 引用 @schedule/contracts）
  store/session.ts          # 会话/用户/群组状态（轻量单例）
  utils/format.ts           # 日期/班次/错误文案
  styles/tokens.wxss        # 设计令牌（与 ui-tokens 对齐）
  pages/...                 # 页面
  components/...            # 日历网格、班次卡片、空状态等
  scripts/upload-ci.mjs     # miniprogram-ci 上传（本地读 key，不入库）
```

### 9.2 页面清单

- 登录/注册：微信一键登录、真实姓名；直接打开小程序只能建群或输群组码加入，绑定身份走群主/管理员邀请链接。
- 工作台：当前群组、今日值班摘要、待办、快捷入口。
- 访客日历：扫码落地（scene 解析，无需登录）。
- 日历：月视图、周视图、列表视图；周末红、今天金黄、班次色块与网页一致；点击班次查看详情与电话。
- 成员：群成员列表、联系方式、拨号。
- 请假/换班/加扣班：创建、预览、我的申请、历史。
- 审批中心：待审批列表、影响预览、通过/拒绝/撤销。
- 通知：站内通知列表、已读/未读；提醒设置（提醒时间、微信订阅开关、订阅授权）。
- 群管理：成员与待认领名单、认领审批、权限角色、排班角色、班种、排班配置与发布、群组码与访客小程序码、邀请链接、转让群主/解散/恢复。
- 统计：月度/年度/周末/节假日/加扣班。
- 我的：个人资料、联系方式确认、群组设置、注销。

### 9.3 状态与 API

- 不用 Pinia/Redux；使用 `store/session.ts` 单例 + 页面 `onShow` 拉取。
- `api/client.ts` 统一处理 401（清会话回登录）、网络错误、契约校验失败文案。
- 请求并发去重（登录/资料/群组列表），避免重复弹登录。

### 9.4 视觉规范

- 组件：`tdesign-miniprogram`，浅色卡片化布局，圆角 12/16rpx，主色沿用网页医疗蓝绿。
- 颜色：周末 `#E03131`、今天 `#F5C518`、班次色/文字色沿用现有数据。
- 排版：日历网格等宽、不换行溢出；长名称省略号；安全区适配；骨架屏与空状态；禁点态统一。
- 验收标准：模拟器 375×667 与真机无横向滚动、无错位、无遮挡；深色模式至少可读。

## 10. 新增/调整接口

### 10.1 认证

- `POST /auth/wechat/login` `{ code }` → `{ token, isNewUser, profile? }`
- `POST /invites/accept` 在“空新账号合并到已认领账号”场景额外返回新会话 `token`（客户端用新令牌替换本地会话）。

### 10.2 群组与访客

- `GET /groups/:groupId/group-qr`（owner/admin）→ `{ imageBase64 }`
- `PUT /groups/:groupId/visitor-key`（owner）→ `{ visitorKeyChanged: true }`
- `POST /guest/groups/resolve`（公开，限频）`{ visitorKey }` → `{ groupId, groupName }`
- `GET /guest/groups/:groupId/calendar?visitorKey=&businessMonth=`（公开，限频）
- 下线：`GET /guest/groups`；Web `GET /groups/catalog` 前端入口下线（后端接口保留给已登录用户查询关系，不再作为访客目录）。

### 10.3 邀请

- `POST /groups/:groupId/invite-links`（owner/admin）`{ targetMembershipId | targetRosterEntryId, scheduleRoleId?, permissionRole? }` → `{ token, sharePath, realName, groupName, scheduleRoleName?, expiresAt }`
- `POST /invites/resolve`（auth）`{ token }` → `{ groupId, groupName, realName, scheduleRoleName?, permissionRole }`
- `POST /invites/accept`（auth）`{ token, confirmRealName }` → `{ group }`
- `POST /groups/:groupId/invite-links/:token/revoke`（owner/admin）

## 11. 数据模型变更（迁移 0033 起）

1. `users.wechat_openid VARCHAR(64) NULL UNIQUE`。
2. `groups.visitor_key VARCHAR(64) NOT NULL UNIQUE`（存量回填随机值）。
3. `invite_tokens` 新表（字段见 7.1）。
4. `notification_deliveries.channel` ENUM 增加 `wechat`；增加 `external_message_id`。
5. `notification_preferences.wechat_notifications_enabled TINYINT UNSIGNED NOT NULL DEFAULT 1`。

所有新增 TIMESTAMP 列显式默认值（遵循既有部署纪律）。

## 12. 错误处理与安全

- 统一复用现有 ApiError 协议；新增错误码：`WECHAT_LOGIN_FAILED`、`INVITE_INVALID`、`INVITE_USED`、`INVITE_EXPIRED`、`VISITOR_KEY_INVALID`、`WECHAT_MESSAGE_SEND_FAILED`。
- 限频：访客解析、邀请创建、群码生成。
- 审计：身份合并/绑定、邀请创建/使用/撤销、访客 key 重生成、群码生成。
- 日志脱敏：AppSecret、token、visitor_key、openid 不进日志（扩展 `redact.ts` 路径）。
- 生产禁用 `WECHAT_MOCK_MODE` 与 `AUTH_DEV_MODE`（env schema 强校验）。

## 13. 部署与配置

- 新增环境变量：`WECHAT_APPID`、`WECHAT_APPSECRET`、`WECHAT_SESSION_SECRET`、`WECHAT_MOCK_MODE`、`WECHAT_QR_ENV_VERSION`、`WECHAT_DUTY_REMINDER_TEMPLATE_ID`、`WECHAT_APPROVAL_RESULT_TEMPLATE_ID`、`WECHAT_STATUS_CHANGE_TEMPLATE_ID`。
- 小程序后台：request 合法域名 `https://hosp.schedule.eylinhome.top`；上传密钥 `private.wx56a7a21f974fd9af.key` 仅本机使用，`scripts/upload-ci.mjs` 读取本地路径。
- 上线前置：网站 ICP 通过后执行 `icp-maintenance.sh off`；小程序完成备案；体验版验收后提交审核发布。
- AppSecret 已出现在对话中：联调完成后由管理员在小程序后台重置一次。

## 14. 测试与验收

- 后端：微信网关 mock 单测；认证/邀请（含未认领绑定、已认领全量合并、同群重复身份 409、管理员账号 409）/访客 key/群码/订阅投递集成测试；`pnpm verify` 全绿；涉及 contracts 改动运行 `pnpm smoke:check-core`。
- 小程序：`tsc` 类型检查、ESLint；DevTools 模拟器与真机预览清单（登录、绑定、扫码、邀请、审批、提醒订阅、日历三视图、深色模式）。
- 回归：Web 端访客目录下线后浏览器冒烟更新断言；核心链路改动按 AGENTS.md 执行 `pnpm smoke:browser`。
- 验收清单见实施计划任务 15。

## 15. 分阶段实施

任务 1–3（数据库 + 微信网关 + 认证）→ 任务 4–5（访客扫码 + 邀请/身份绑定）→ 任务 6（订阅消息投递）→ 任务 7–8（小程序工程 + 登录/API 基础）→ 任务 9–13（页面与功能）→ 任务 14–15（Web 配套 + 部署验收）。

详细步骤见 `docs/superpowers/plans/2026-08-08-wechat-miniprogram-implementation-plan.md`。

## 16. 风险与决策记录

- 邀请链接先到先得：用户已确认接受此语义；确认页与审计降低纠纷风险。
- 邀请链接同时是身份绑定通道：接受已认领成员邀请时执行受控全量合并（转移群组关系与群主身份）；同群重复身份或管理员账号冲突时拒绝。
- 个人主体：无长期订阅、无医疗类目；排班提醒依赖用户“总是保持”授权。
- `cloudbase_uid` 继续承担外部稳定 UID 职责（既有 N6 决策），新增 `wechat_openid` 作为微信身份主键；未来如需中性命名另行迁移。
- AppSecret 泄露风险：联调后重置。
