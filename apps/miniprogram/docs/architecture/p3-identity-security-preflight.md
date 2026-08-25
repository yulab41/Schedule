# P3 身份安全预检

- 日期：2026-08-22
- 基线：`98ce2512a205b5b45c5b225570924c498a8e2520`
- 范围：仓库与生产聚合数据只读审计；未改生产数据、身份配置、接口或 UI

## 冻结不变量

1. 未知微信登录返回 `link_required`，不得自动创建业务用户。
2. 业务用户与微信自然人一一对应；渠道 identity 以 `(provider, appId, subject)` 唯一，UnionID 单独映射到业务用户。
3. Web 不再公开注册；用户名只能由平台管理员分配。预分配用户名可以尚未设置密码。
4. 密码、用户名或 Mini 解绑改变 `authVersion`，使旧会话失效。
5. 产品不存在账号注销。解绑只移除当前正式小程序 AppID 的 identity，不删除用户、资料、群组、排班、审计或其他渠道。
6. linkToken 和管理员绑定 ticket 均为 10 分钟、单次、数据库只存 token 哈希；并发消费必须只有一个成功。

权威产品范围见[总计划](../plans/2026-08-17-wechat-miniprogram-migration-plan.md#71-微信登录与绑定)和 [ADR-0004](../decisions/ADR-0004-identity-unbind-only.md)。

## 当前实现与引入点

| 当前实现                                                                            | 引入点                                 | 与目标的差距                                            |
| ----------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------- |
| `user_auth_identities` 只有 `(provider, subject)`，并把 `union_id` 直接设为全局唯一 | `12e7f40`                              | 缺 `appId`；同一自然人的 Mini/Web identity 无法同时保存 |
| Mini 未知微信会立即创建 `users`、legacy openid 和 identity                          | `39f9c66`，后由 `12e7f40` 扩展 UnionID | 违反 `link_required` 和“不自动建号”                     |
| 匿名 `POST /auth/password/register` 及 Web 注册页仍存在                             | `de3ad5f`                              | 违反管理员分配用户名                                    |
| `POST /users/me/deregister` 会软删除用户并清空联系方式                              | `a837586`                              | 违反 ADR-0004 的无注销边界                              |
| 30 天 JWT 没有 `authVersion`/`appId` claim                                          | `39f9c66`                              | 密码、用户名和解绑不能立即吊销旧会话                    |
| `passwordAuthResponseSchema` 继承当前微信登录 response                              | `de3ad5f`                              | 微信改为判别联合后会无意改变密码登录契约                |
| `password_hash` 非空                                                                | `de3ad5f`                              | 不能表示“已分配用户名、尚未设密”                        |

当前 `WechatGateway` 已按服务端 `code2Session` 结果区分 openid 与可选 UnionID，但 Mini gateway 没有向身份服务暴露配置 AppID。Web 微信 AppID/AppSecret 当前生产未配置，代码路径保留但不作为正式 Web 登录入口。

## 生产聚合快照

查询只返回计数、schema 属性和配置是否存在，不返回用户名、姓名、openid、UnionID、密码哈希、UID 或 secret。

- 环境：production；开发认证和微信 mock 均关闭；密码登录开启；Mini AppID/AppSecret、会话 secret 和平台管理员配置存在；Web 微信 AppID/AppSecret 不存在。
- 用户：40 个，其中 active 34、suspended 2、deleted 4；35 个有资料，active 中 1 个无资料。
- 密码身份：24 个，全部为规范化用户名和独立 scrypt hash；24 个都属于 active 用户。19 个已有 `password_<userId>` locator，另 5 个 locator 为 null、资料完整且有 active 群组成员关系，当前密码登录会错误拒绝这 5 个账号。
- 微信身份：`user_auth_identities` 当前为 0，因此没有待合并的 provider/subject/UnionID 冲突。legacy `users.wechat_openid` 有 1 个 active 用户；该用户无资料、密码、群组、排班、工作流、通知或邀请引用，仅有 1 条创建审计。
- 其他保留数据：9 个 active 资料用户没有密码、微信 identity 或 legacy openid，也没有 active 群组成员关系。不得自动删除、合并或分配登录名；后续仅由平台管理员显式处理。

## 分步实施顺序

### P3-A：加法式身份基础

1. 增加 `users.auth_version NOT NULL DEFAULT 1`。
2. 给 identity 增加可空 `app_id` 过渡列和索引；建立 `wechat_union_accounts`，分别唯一约束 `union_id` 与 `user_id`。本步不删除旧 `union_id` 列或旧索引。
3. 将 `password_hash` 改为可空，允许只预分配用户名；现有 24 个 hash 不变。
4. 只对“已有密码凭证且 locator 为空”的 5 个用户确定性补为 `password_<userId>`。不触碰其他 null locator、用户名、密码、资料或成员关系。
5. migration/schema 测试必须断言重复 app identity、UnionID 跨用户和单用户多 UnionID 均失败关闭。

本步对旧 API 二进制兼容：旧代码忽略新增表/列，已有非空密码仍可用，locator 补齐只恢复 5 个账号的既有密码登录。

### P3-B：会话与 identity resolver

1. 先把密码 response 从微信 response 解耦。
2. 新 token 写入 `authVersion`；Mini token 同时写入 `appId`。验证器把旧 token 的缺失版本视为 1，只要数据库仍为 1 即继续有效。
3. 每次认证校验用户 active/deleted 和 `authVersion`；密码、用户名、解绑事务递增版本后，旧 token（包括 rollout 前 token）立即失效。
4. identity 查询优先使用 `(provider, appId, subject)`；过渡期只为精确 legacy openid 用户创建当前 AppID identity，不自动创建第二个用户。

### P3-C：link-required 与危险旧端点收口

1. 增加哈希 linkToken 存储与原子单次消费；未知 Mini 登录只返回 `link_required`。
2. 实现密码绑定和真实姓名建档，覆盖过期、篡改、重放、并发、UnionID 和已绑定冲突。
3. 删除账号注销 contract、service 和 route；增加只解绑当前 Mini AppID 的用户/管理员接口。
4. 公开密码注册先在服务端关闭；Web 注册入口与平台账号后台在下一视觉批次同步交付，避免长期保留失效 UI。

### P3-D：管理员和密码 proof

1. 平台管理员可列出必要的脱敏账号状态、分配/修改用户名，并生成 10 分钟单次管理员绑定 ticket/URL Link。
2. `/me/password` 只接受当前密码或新微信 code proof；首次设密和修改密码均递增 `authVersion`。
3. Mini 管理员绑定必须先脱敏 preview，再由当前微信主动 confirm；URL 本身不完成绑定。

### 首个视觉暂停点

Web 登录页改为仅登录，平台账号后台增加账号状态/用户名/绑定入口；Mini 后续包含登录、密码绑定、真实姓名建档、管理员绑定和解绑确认。上述页面先形成 390×844、320px 和状态矩阵黄金稿，用户确认后才实现原生 WXML/WXSS。

## 回滚与部署门禁

- 每个 schema checkpoint 发布前备份，并先跑旧代码兼容测试；P3-A 回滚应用代码时新增列/表可保留，不执行破坏性降级。
- tightening migration（`app_id NOT NULL`、删除 legacy UnionID/openid）只能在生产聚合门禁为 0 后单独执行，不与首次行为切换同提交。
- 旧 Web 和上一 Mini 体验版在 P3 期间必须继续读取既有 API；新增 response 字段只能 additive，判别联合只用于 Mini 微信登录端点。
- 不通过聊天、日志或测试输出任何真实 identity、credential、token、AppSecret 或完整生产资料。

## 当前 Mini 登录入口（2026-08-25）

- `pages/identity/index` 初始页同时提供 Web 同源账号/密码表单与“微信快捷登录”；平台管理员账号可直接调用 `POST /auth/password/login`，已绑定微信的普通成员可调用 `POST /auth/wechat/login`。
- 两类 bearer 会话共用当前私有会话槽位，但持久化 `authMethod`；密码会话收到 401 时只清理当前会话，不得静默调用 `wx.login` 切换到另一位微信用户。微信会话仍保留原有单飞静默恢复。
- 密码登录必须返回已有 `profile`；不接受公开注册或无资料自动建号。密码只发送给服务端，不写 Mini storage；绑定 URL、ticket 和微信 code 仍按原有内存/单次语义处理。
- 视觉黄金继续使用 `P3IdentitySecurityPreview` 的 `mini-login-390/320`，原生页面需用户在实体 Android 复核账号密码、微信快捷登录和两种会话切换。

## 必测安全矩阵

- 旧/新 JWT、版本递增、悬挂/删除用户、provider/AppID/subject 错配。
- 未知微信不建号；linkToken 过期/篡改/重复/并发；有/无 UnionID；Mini/Web 同自然人冲突。
- 5 个 null locator 密码账号迁移前失败、迁移后成功；24 个现有密码 hash 不变。
- 公开注册拒绝；代码/API/UI 无注销；解绑只删当前 AppID identity并保留业务引用。
- 管理员 username/ticket 权限、审计、并发、原因和脱敏 preview；用户密码/code proof。

## 明确不做

- 预检和 P3-A 不调用真实 `wx.login`、不生成真实 URL Link、不写生产业务数据、不实现 Mini 页面。
- 不自动删除 1 个 legacy Mini stub 或 9 个无登录资料用户，不猜测用户名，不合并用户。
- 不在 P3 实现 P4 缓存/壳层、P5 排班、P9 导出或 P10 新增 Web 功能。
