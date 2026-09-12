# Feedback12 微信自动通知与访客显示设置

- 基线 `5f79236f`；独占 `runtime/wt/general-4`、`codex/feedback12-notifications`。
- L2 inspector PASS；Acquire → ReuseOnly → api Bootstrap 全复用，`INSTALL_INVOKED=false`。新增契约后 mini Bootstrap 仅重建 contracts/client-core，presentation-core复用。
- 本记录只证明本地静态检查、Node与隔离MySQL；未连接生产、未读取生产队列、未发送真实微信消息、未上传小程序。

## 已验证原因与行为变化

- 旧微信类型映射只有 `duty_reminder`，业务通知只有站内记录，无微信投递。此次明确新增独立业务模板，不套用值班模板字段。
- 后台原默认 `formal`；本人测试可显式 `trial`，手动成功不证明定时器、排班筛选或队列正确。自动通知现按准确群组ID白名单选择trial，其余formal，显式诊断目标不变。
- `git log -S` / blame：业务通知接收人由 `52e9e1f4` 引入；覆盖发布只选新排班成员，被替换旧成员漏通知。手排与普通发布均补齐旧/新成员并按用户去重。
- `targetVersion`参数来源 `9bae5beb`，此次不将formal差异冒充已证实生产故障。
- 业务覆盖发布、手排发布、已发布变更、换班/加扣班申请与接受/审批/结果/撤销、请假审批/结果/取消/撤销，沿用现有业务事务与接收人。
- 普通发布每人一条月份摘要；手排每人一条日期范围摘要。草稿与显式静默不生成业务推送；配置上线不扫描/补发旧站内通知。
- 静默导入仍允许未来值班提醒；真实业务的定时生成与重试两个Job已使用隔离数据库+mock网关验证，未调用测试发送接口。
- 业务投递前复查群组、成员、用户/资料及接收偏好有效性；无效时跳过。保留原43101终止及系统错误重试行为。
- 小程序设置一次点击订阅可配置的两个模板；部分接受保留已授权提醒并提示。本人诊断仅订阅值班模板，不被业务模板拒绝阻断。

## 部署配置仍待提供

- `WECHAT_BUSINESS_TEMPLATE_ID`：用户在公众平台取得的业务模板ID，必须与值班模板不同。
- `WECHAT_BUSINESS_TEMPLATE_FIELDS`：JSON逻辑字段到实际微信字段名；至少含title或summary，字段不能重复。未配置、非法或与值班ID相同均关闭业务微信投递，不影响站内通知和既有值班提醒。
- 支持title/summary/groupName→thing字段，memberName→name或thing，status→phrase或thing，occurredAt→time；按类型长度生成摘要，时间使用北京时间。
- 示例仅说明格式：`{"title":"thing1","summary":"thing2","occurredAt":"time3"}`。不能把示例当作实际模板映射；必须核对公众平台模板完整字段。
- `WECHAT_TRIAL_GROUP_IDS`：逗号分隔的准确医生群/护士群UUID，未配置时formal。群名不参与匹配；实际ID尚未从生产读取。
- API及定时任务共用compose透传配置。无需迁移。实际业务模板、字段与两个群ID未取得，不能宣称业务推送已上线可用。
- 微信字段类型参考：[腾讯云开发官方说明](https://docs.cloudbase.net/recipes/add-subscribe-message-cloud-function)。微信开发者站本轮访问失败，未把第三方镜像作为依据。

## 验证

- 基线 `pnpm exec vitest run apps/api/src/modules/wechat/wechat-push-dispatcher.spec.ts`：5通过。
- 新业务映射/自动trial RED：2失败；修复后与原dispatcher共8通过。
- 旧/新接收人MySQL RED：2失败、22通过；旧代码两个用例均只通知1人而预期2人。修复后手排21、普通发布3通过。
- 部分订阅授权RED：1失败、24按筛选跳过；最终Mini通知控制器/客户端/诊断/边界/设置静态5文件51通过。
- 正式隔离入口：`node --env-file=E:/AItools/Schedule/.env --input-type=module` 调用 `scripts/run-api-integration.mjs` 的 `runApiIntegrationTests({testFiles:[...]})`；入口验证仅本地3307、schedule_test。
- 最新独立MySQL用例：manual-apply21、schedule-publication3、wechat-notifications13、calendar34，共71通过。中间新增夹具错误（非法membership枚举、SQL保留字）已修正并复测，未据此修改业务。
- 微信13用例包含两Job自动trial、业务模板与值班模板分离、队列重跑不重复、缺配置不重放、偏好/成员/群撤销、43101与临时错误。
- 共享client-core和API纯函数12通过；最终API/Mini typecheck、定向格式/lint和git diff --check通过。集成浏览器与全量收口由主任务记录。

## 追加只读访客接口

- `GET /groups/:groupId/guest-calendar/display-settings` → `{groupId,groupDefaultMonthShiftTypeId:string|null}`，bearer身份、复用`requireGuestCalendarAccess`、`no-store`。
- 仅返回当前群启用未删的默认班种ID，否则null；不开放原配置权限、不修改旧日历响应、不迁移数据。
- 契约与严格轻量decoder一致；Mini工厂`createRuntimeGuestCalendarDisplaySettingsClient(getAccessToken, authentication).get(groupId)`使用guest能力。
- 新端点RED为404；修复后关联访客读取/停用班种null/关联撤销403/未登录401及完整日历34通过；追加跨群班种null断言后，定向1通过、33按筛选跳过。
- 契约触发核心浏览器复核；当前为已实现待浏览器复核，由主任务集成后执行并记录，不以本地单测替代。

## 主任务联合收口

- 非法WECHAT_TRIAL_GROUP_IDS列表增加启动和发送双重验证，RED2后env/业务函数25项通过，不静默退回formal。
- 主任务同源集成完成format/lint/build/typecheck、Mini1160通过/15跳过、根1247通过/433跳过及依赖保护81；相关隔离MySQL71项证据复用。
- 运行/浏览器验证：pnpm smoke:browser通过当前集成API与Web完整流程，pnpm smoke:check-core通过；开发合成local-admin标记已回读恢复，未触生产/真实消息。
