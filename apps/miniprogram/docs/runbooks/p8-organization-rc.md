# P8 组织管理实体 Android 验收

## 状态与边界

本清单只由用户在实体 Android 微信原生运行时执行。Storybook、Vitest、`miniprogram-simulate`、`miniprogram-ci` 和桌面浏览器不能替代原生视觉、触控与系统行为结论；Codex 不启动、控制或自动化微信开发者工具 GUI/CLI。

验收候选固定为 `0.1.0-p9.20260826.15`。生产 `organization=false`，所以本轮只在专用测试环境/专用测试群组验证写入；正式生产入口和 API 必须保持失败关闭。邀请 token、visitor key、二维码内容、绑定 URL、完整联系方式、密码和 subject 不得写入 Mini storage、相册、日志或离线队列。

## 交付前自动证据

- 四个页面均为原生 Skyline/glass-easel：群组与成员、班种/岗位/轮转、邀请/访客码/群组二维码、平台账号后台。
- 组织写请求必须同时使用 header/body 相同的 `operationId`，并提交对象对应的 `expectedVersion`、`expectedRulesVersion` 或 `expectedAuthVersion`；结果尚未确认时只能同载荷显式重试。
- guest 二维码读取同时受 `guest` 与组织管理边界保护；关闭任一能力时入口、深链和请求均失败关闭。
- 生产候选已进入版本白名单，但 `MINIPROGRAM_CAPABILITY_ORGANIZATION_ENABLED=false`；未知版本仍返回 426，健康接口保持 ready。
- Mini production verify、源码/包体/性能/确定性/CI dry-run 与 P8 自动契约测试全部通过后，才能开始实体操作。

## 测试准备

1. 准备同一专用测试群组的群主、管理员、普通成员和平台管理员账号；普通成员不能被群组角色冒充平台管理员。
2. 准备可恢复的测试群组、预设成员、至少两个岗位、两个班种和一条轮转规则；只使用未来日期，不修改真实在用排班。
3. 记录设备型号、Android、微信、基础库、系统字体缩放和页面 `buildLabel`，确认与 `0.1.0-p9.20260826.15` 一致。
4. 每个案例记录 `duplicateWriteObserved`、`capabilityGateObserved`、`secretPersistenceObserved`；失败时提供 `buildLabel + caseId + symptomOnFailure`。

## 群主账号

### 1. 群组与成员生命周期

打开“群组设置”，创建/改名/更新群组码，查看成员、预设、认领和联系方式；执行一次成员角色变更、解散与恢复。危险操作必须二次确认，409 后刷新最新版本，表单仍可显式重试。

### 2. 排班配置

打开“班种、岗位与轮转”，新增班种、岗位、岗位成员和轮转规则，再编辑并删除一项。检查跨日、启用、统计和起始成员显示；旧版本提交必须被 409 拒绝，不覆盖新配置。

### 3. 邀请与访客入口

生成正式成员/预设成员邀请并撤销，轮换访客码，读取群组二维码。邀请 token、visitor key 和二维码内容只存在当前页面内存；离开页面后不能从缓存恢复。

## 管理员账号

### 4. 管理员权限边界

验证管理员可管理普通成员、预设、认领、联系方式和排班配置，但不能提升/移除管理员、转让所有权、解散群组或管理平台账号。页面隐藏不是证据，API 拒绝才是最终结果。

## 普通成员账号

### 5. 只读与失败关闭

普通成员可读取成员、联系方式和排班配置；所有群组、成员、配置、邀请和平台账号写入均显示清晰失败关闭提示。无 `organization` 能力时不得出现可提交的伪成功状态。

### 5.1 D0796 微信快捷登录

退出当前会话后回到登录页，点击“微信快捷登录”，不要填写账号或密码。确认微信身份直接进入已绑定的普通成员排班台，资料与群组保持原账号，不出现账号密码绑定表单或新的建档流程；记录 `member-wechat-quick-login` 与 `capabilityGateObserved`。

## 平台管理员账号

### 6. 平台账号后台

打开“平台账号”，查看服务端批准的用户标识、用户名状态和 `authVersion`；分配用户名并生成一次性绑定链接。页面不得显示姓名、密码、完整联系方式、微信 subject 或 ticket。旧 `authVersion` 提交必须 409，绑定 URL 只在当前页面内存中展示。

### 7. 账号密码登录

退出当前会话后回到登录页，使用平台管理员已分配的账号和密码提交“账号密码登录”。确认登录成功后加载正确资料和群组；错误密码只显示明确的账号/密码错误，不创建新用户、不触发 `wx.login`、不切换到其他身份。记录 `platform-admin-password-login` 与 `secretPersistenceObserved`。

## 弱网、生命周期与回滚

1. 在一次组织写入时制造弱网或断网。若提示“本次结果尚未确认”，保持表单不变，以同一载荷重试；最终只允许一条业务记录，`duplicateWriteObserved=false`。
2. 完全离线时写入必须失败，不得排队；恢复网络后由用户显式重试。
3. 四个页面分别执行后台→前台，列表和 capability 必须刷新，旧请求不得覆盖新状态。
4. 交付前自动执行关闭 `organization`、关闭 `guest` 的失败关闭预演并恢复；健康检查保持 ready，预演不写业务数据。

## 反馈模板

```text
buildLabel:
deviceModel / Android / WeChat / baseLibrary / fontScale:
owner-group-member-lifecycle result / duplicateWriteObserved:
administrator-roster-claims-contacts result / capabilityGateObserved:
member-readonly-boundary result:
member-wechat-quick-login result / capabilityGateObserved:
owner-admin-scheduling-configuration result / duplicateWriteObserved:
owner-admin-invite-and-visitor result / secretPersistenceObserved:
guest-qr-dual-capability result / capabilityGateObserved:
platform-admin-account-lifecycle result / secretPersistenceObserved:
platform-admin-password-login result / secretPersistenceObserved:
weak-network-idempotent-retry result / duplicateWriteObserved:
foreground-capability-refresh result:
capability-rollback result:
symptomOnFailure:
```

全部通过后回复“P8 组织管理 RC 通过”即可。用户明确通过前不能进入 P9，不提交审核或正式发布。
