# P8 组织管理 Web/API/Mini 对等与安全预检

## 结论

P7 工作流候选 `.94@0975b2d` 已于 2026-08-25 获得用户实体 Android 明确通过，P8 可以开始。当前 Mini 的 `subpackage-organization` 只有 P5 留下的群组手机号公开同意页面；完整群组、成员/预设、班种/岗位/轮转规则、邀请/访客码和平台账号后台均未形成原生闭环，production 的 `organization` capability 继续保持关闭。

现有 Web/API 已覆盖 P8 的主要业务模型和权限，但不能直接把全部 Web 写调用点搬进 Mini。群组与排班配置的多数写请求早于跨端迁移建立，当前没有统一的 `operationId`/`Idempotency-Key`，若响应丢失后由用户重试，部分操作会产生重复副作用；部分可变实体虽返回 `version`，写请求却没有 `expectedVersion`。因此 P8 的冻结顺序是先共享只读边界，再补齐写入幂等和版本保护，最后才开放原生管理 UI。

## 基线与引入点

- 阶段基线：`e6f2e10c`；Git、`origin/main` 与 production release 已对齐。
- 群组/成员/联系方式 Web 客户端主要来自 `8e42afb8`，成员删除来自 `322550d9`，成员改名来自 `394b1c87`。
- 班种、岗位和轮转规则客户端来自 `04c7da36`；班种删除补充来自 `d24b6920`。
- 一次性岗位化邀请 API 来自 `a50c4fce`。
- 平台账号 Web 页面与绑定入口来自 `02a508dd`。
- Mini 现有群组设置 panel 来自 `0d971de1`，只实现 P5 手机号公开同意并使用 `core`/privacy escape 能力，不代表 P8 已实现。
- `organization` capability 与失败关闭路由分类来自 `e25878f0`，生产仍为 `false`。

以上调用点已执行 `git log -S` 与 `git blame`。后续重构必须逐调用点保留 fetch/`wx.request` 接收者、Promise 拒绝、401 单飞恢复、空值、解码、调用次数和离线无写队列语义。

## 权威页面与接口

| P8 范围                                  | Web 黄金/业务真值                          | API 真值                                                                                   | 当前 Mini                              |
| ---------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------ | -------------------------------------- |
| 群组建立、改名、群组码、离群、解散/恢复  | `GroupSetupPanel.vue`、`GroupSwitcher.vue` | `group-routes.ts`、`group-service.ts`、`membership-service.ts`                             | 只有群组摘要和手机号同意               |
| 成员、预设、认领、角色、所有权、联系方式 | `MemberManager.vue`                        | `group-routes.ts`、`group-member-reader.ts`、`membership-service.ts`、`contact-service.ts` | 无管理页                               |
| 班种、岗位、岗位成员、轮转规则           | `SchedulingConfigPanel.vue`                | `scheduling-config-routes.ts`、`scheduling-config-service.ts`                              | 无管理页                               |
| 岗位化邀请                               | Web 暂无完整管理面；契约和 API 为权威      | `invite-routes.ts`、`invite-service.ts`                                                    | 无邀请接收/管理页                      |
| 访客码/小程序码                          | `GuestScheduleView.vue` 与群组设置语义     | `visitor-key-service.ts`、`group-qr`、`guest/groups/resolve`                               | P4 guest 入口未形成产品页；无管理页    |
| 平台账号后台                             | `PlatformAdminUsersView.vue`               | `platform-admin-routes.ts`、`wechat-admin-binding-routes.ts`                               | P3 只有绑定预览/确认；无账号列表管理页 |

院内通讯录继续属于 P10 backlog，不混入 P8 成员管理。访客访问日志属于 P9 insights；P8 只管理 visitor key/小程序码和入口。

## 能力与权限边界

- `core` 继续承载 `/groups`、成员/联系人/配置只读、邀请 resolve/accept 和手机号同意 privacy escape。
- `organization` 承载群组、成员、预设、配置、邀请和平台账号写入；完整 P8 RC 通过前不得在生产开启。
- `guest` 独立承载 visitor key、小程序码和 guest calendar；P8 页面必须同时检查 `organization` 与具体 guest 能力，不能因为组织管理开启而绕过 guest kill switch。
- 群主独占群组改名、群组码、visitor key、解散/恢复、管理员管理和所有权转让。
- 管理员可管理普通成员、预设、邀请、联系方式和排班配置，但不能提升/移除管理员、转让所有权或解散群组。
- 普通成员只有成员/联系方式/配置只读与自身联系方式操作；guest 不能进入组织管理。
- 平台账号后台只允许平台管理员，不从群组角色推导平台权限；页面不得显示姓名、密码、完整联系方式或微信 subject。

服务端 `GroupPermissionService`、`requirePlatformAdmin` 和现有集成测试仍是最终权限边界；Mini capability 和 UI 隐藏只作体验层失败关闭。

## 生产只读预检（2026-08-25）

预检只读取聚合计数，没有读取或输出姓名、手机号、群组码、visitor key、token 或 subject：

- active groups 2；active memberships 为 owner 2、administrator 3、member 21；群主字段与唯一 active owner membership 不一致为 0。
- pending roster 0；active schedule roles 2；active shift types 13，其中 disabled 5；缺少 active rotation rule 的岗位为 0。
- invite token 为空，过期但仍为 pending 的邀请为 0。
- active users 35；password identities 24；当前 Mini Program identity 1。
- admin binding ticket 为空，过期但仍为 pending 的 ticket 为 0。

该快照证明当前数据没有阻断 P8 的所有权或排班配置异常，但不能替代后续真实 MySQL 并发、权限和回滚测试。

## 已确认的写入缺口

以下现有调用均保持单次网络调用，但在共享 Mini 写客户端和原生按钮接入前必须完成安全硬化：

1. 创建/删除/恢复群组、离群、成员/预设增删转换、角色变更、所有权转让、认领审批与撤销。
2. 群组码更新、visitor key 轮换、邀请创建/撤销；结果不明确时不得生成第二个有效链接或重复轮换。
3. 岗位、岗位成员、轮转顺序/规则和班种的增删改；旧配置版本不得覆盖新配置。
4. 平台用户名分配和管理员绑定链接生成；旧 `authVersion` 不得覆盖新身份状态，链接正文和 ticket 不缓存。

每项危险写采用 header/body 同一 `operationId`，服务端按用户/群组/动作/规范 payload 指纹保留 24 小时；同键同 payload 重放原结果，同键异 payload 返回 409。具有 `version`/`rulesVersion`/`authVersion` 的对象同时提交对应 `expectedVersion`，409 返回可刷新所需的最小 latest data。没有有效幂等键时 Mini transport 不自动重试，离线始终无写队列。

## 冻结实施顺序

### P8-A1 共享只读边界

- 为群组摘要、成员/预设、联系方式、排班配置、平台账号和邀请预览建立 `@schedule/client-core` endpoint、紧凑 decoder 与黄金响应。
- Web 现有只读方法先委托共享 service；Mini 工作台现有 `/groups`、成员和配置手写 decoder 改为共享 decoder，保持 `core` 能力和 24 小时缓存隐私清理不变。
- Zod 与紧凑 decoder 深等价；共享包继续禁止 `wx`、fetch、Vue、DOM、Node、数据库和 Zod runtime。

### P8-A2 写入契约与并发硬化

- 按“已确认的写入缺口”逐族增加 operation/version contract、API 事务重放与冲突测试。
- Web 先切换到新共享写 service，并逐调用点证明 receiver、错误、空值、副作用和调用次数等价。
- 真实 MySQL 覆盖成员/所有权、群组解散恢复、配置并发、邀请单次使用和平台身份并发。

### P8-B Web 黄金

- 状态（2026-08-25）：34 个精确 Storybook ID、390×844/320px/大字号、五类角色和八类状态已固化，34/34 浏览器装配与六类代表 Axe 扫描通过；详见 `page-golden-manifest.md`。Web 黄金已获准进入 P8-C–F 原生实现。

- 使用 production `GroupSetupPanel`、`MemberManager`、`SchedulingConfigPanel`、`PlatformAdminUsersView` 固化 390×844、320px 和大字号状态。
- 补齐群主/管理员/成员/平台管理员、loading/empty/error/409/确认/成功/禁用状态；邀请和 visitor key 使用与现有 Web 同源的新 story，不建立第二套视觉方向。
- 更新 `page-golden-manifest.md`，用户确认后才实现原生 WXML/WXSS。

### P8-C–F 原生页面

1. 群组与成员/预设/认领/联系方式。
2. 班种、岗位成员和轮转规则。
3. 邀请、visitor key 和小程序码；邀请 token、visitor key、完整电话和二维码内容不得持久化。
4. 平台账号列表、用户名分配和一次性管理员绑定链接；只显示 Web 已批准的必要字段。

状态（2026-08-25）：P8-C–F 原生页面已完成，四项原生页面均已实现并上传体验版 `0.1.0-p8.20260825.3`；生产 `organization=false`，等待 P8 RC 自动契约与用户实体 Android 复核。实现 checkpoint 依次为 P8-C-1 `70f9a98f`、P8-C-2 `38233039`、P8-D `ddd5c107`、P8-E `c0ea31e9`。

### P8 RC

- 自动契约文件：`apps/miniprogram/testing/p8-organization-rc-plan.json`、`apps/miniprogram/scripts/p8-organization-rc-plan.test.mjs`；实体机清单：`apps/miniprogram/docs/runbooks/p8-organization-rc.md`。
- 自动：权限、身份、幂等、版本、事务、409、前后台、弱网、隐私、capability 回滚、package/Worklet/determinism/simulate、390/320。
- 实体 Android：群主/管理员/成员/平台管理员覆盖各自可见/禁用边界和完整增删改流程；弱网结果不明确时重试不得重复写。
- 用户明确通过前不进入 P9，不提交审核或正式发布。
