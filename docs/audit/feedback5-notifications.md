# Feedback5 — 微信订阅诊断与通知反馈

2026-09-07；基线 `2ed5035c`；本组独占 general-1，REUSE_ONLY，安装0、新建冷槽0。
提交标识：`fix(miniprogram): diagnose WeChat subscriptions and delivery`。
状态：已实现并通过 Node/本地 MySQL/桌面视觉代理验证，待整合门禁及用户手机复核。

## 改动与边界

- 通知设置操作失败复用 ui-toast(error) 与现有2秒host计时器；替换重复反馈，hide/unload后不展示迟到反馈。加载失败和功能暂停仍是可读页面状态。群组日历偏好胶囊由同轮UI组独立处理。
- 普通订阅页和诊断页从已认证的 `/notifications/wechat-subscription-config` 获取同一发送模板。配置请求独立失败降级，不阻塞其他提醒设置；无配置与非法/失败响应分开显示。订阅接口仍在用户点击同步栈内调用。
- 测试工具按阶段区分配置、微信总开关及当前模板记住选择、原生授权、接收偏好确认、服务端投递、人工收到。展示最近10条本人真实投递和5次本人测试；无记录明确尚不能验证发送链路。
- 新增 `GET /me/wechat-notification-diagnostics?groupId=…`、`POST /me/wechat-notification-test`，复用指定developerAdmin权限条件，仅本人且须为未删除群组的有效成员。POST严格body为groupId+issuedAt，必须UUID幂等头，不接受目标userId。
- 真正发送只发生于用户主动点击测试按钮；接收偏好保存成功后才启用。测试固定内容，不创建真实排班通知，不进入后台重试任务。本轮仅使用mock网关测试，未发送真实消息、未连接生产或上传。
- 现有idempotencyKeys在本人行锁下先持久预留，再事务外调用网关一次；默认24小时保留，请求时效10分钟，指纹绑定groupId/issuedAt。并发不同键每分钟最多一次。同键未知结果不再发送，失联/崩溃保留未知；明确4xx与网络/5xx未知分开。
- 网关采用单次调用可选phase observer，标明access-token或send阶段，无全局observer；观察器异常不影响发送。原调用保留原3参数及接收者绑定。mock网关显式标记，禁止作为真实发送成功证据。
- 诊断只记录白名单状态/数字错误码/耗时/安全时间，不输出模板ID、openid、凭据、请求正文或原始微信错误。最多12条本地阶段记录，复用App共享已授权runtime slot；账号/会话、授权slot和store实例保护迟到/撤销重授回调。
- 通讯录报告补directory_plan白名单legacy/candidate及“未提供”；instance_age保持服务器30天上限，达到上限显示≥，不再截成10分钟，不收集查询明文。
- 轻量当前群组reader从workbench-read提取且保留原导出。严格保持owner检查、空值、非空字符串（不trim，保留空白字符串原语义）、一次存储读取及异常返回undefined语义；无this依赖。诊断PUT使用既有executor并校验服务器明确返回开启，避免载入整套工作台读客户端。

## 引入点与回归证据

- 通知红块沿用 `766ec6ac`，feedback4 `c55906e5`只替换成功反馈；群组偏好红/绿块为 `dffef1f2`（本组只读核对）。
- 发送thing1/thing2字段来自 `ef3d20ca`，并非本次发明。实际平台模板字段仍待核对；诊断如实显示“尚未核对”，不宣称微信接受等于手机收到。
- 当前群组读取源自 `9e3a966c`，通过git log -S及blame核对并补等价边界测试。
- 新诊断模块缺失时Mini2项及API测试文件红；网关phase测试在旧实现上明确[]≠[access-token,send]失败，实现后通过。
- 本地MySQL复用已运行测试容器，仅loopback:3307/schedule_test，经既有run-api-integration wrapper执行；5项通过，覆盖同键并发、不同键限频、unknown重放、过期/离组/删群/mock拒绝、权限/请求严格边界。所有外部微信调用均为测试stub。

## 验证与包体

- 修改前：通知/群组/test-tools/transport定向68项通过，10.48秒。统一production构建基线由同轮UI组测得：主包1693649、总包5062991字节、332文件、构建+包审3.26秒。
- 修改后：Mini定向10文件89项通过（含原生订阅调用的Node模拟）；API定向4文件34项通过；真实本地MySQL5项通过；API/Mini typecheck、改动范围Prettier/ESLint、git diff --check通过。
- production构建+包审2.32秒，332文件；主1698314、scheduling415158、organization1016976、workflows821981、insights1056585、diagnostics82534，总5091548字节。
- 同口径差值：主包+4665、总包+28557字节。仍有原有主包超过内部1.5M提示，未超过正式包体门禁。新增辅助模块沿用bundled-only列表，不额外重复输出独立JS；没有新增依赖。
- 桌面诊断按钮代理390/320宽×16/20px字体4组通过，已查看320/20截图；现有ui-toast桌面28场景通过。仅桌面CSS几何证据，不能替代Skyline/小米14。
- 全部运行日志、截图与代理脚本位于 ignored `runtime/audit/feedback5-notify/`；不提交截图或敏感环境值。最终全仓verify、整合后包审与项目状态由主任务统一执行。

## 手机下一步

取得与最终体验版SHA一致的新版本后，在“测试工具→微信提醒诊断”刷新只读检查、开始本次订阅诊断，随后按需主动发送一条本人测试，确认是否手机收到并复制安全报告。微信接口接受仅是接口结果，平台实际字段、真实送达及小米14显示尚未验证。
