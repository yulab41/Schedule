# UX-CLEANUP-10 feedback4

本文件记录实施阶段；后续已交付.94@bfd1fbbd，当前状态与唯一下一任务以 `ux-cleanup-10-feedback4-release.md` 和 `STATUS.md` 为准。

## 授权与基线

- 用户批准七项Mini微调；不授权依赖安装、生产连接或体验版上传。规划基线与远端main均为596c20b2。
- 模式REUSE_ONLY；general-3先由feedback4-root独占，c7f93d48检查点释放后由feedback4-notify正式Acquire。其他组POOL_BUSY，顺序交接同一健康槽，安装0、新建冷槽0。
- 读取Schedule guardrails、miniprogram-development、systematic-debugging、frontend-design及相关UI知识。成功使用shell/Git/Node/Edge布局代理；微信DevTools执行面因仓库政策禁用。
- 截图只作问题报告；短SHA/renderer/基础库/微信版本不齐，不能写当前小米14已验收。

## 发现与行为变化

| ID    | 级别 | 问题与原因                                                 | 修复、风险、验证                                                                                                                                                    |
| ----- | ---- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F4-01 | P2   | 未绑定登录进入choice/password/register旧步骤；e69cfb76引入 | 改直接账号密码sheet，删除自主建档和无引用样式；普通登录和admin-bind保留。需求变化，回归覆盖取消/过期/错密/网络/重复提交。                                           |
| F4-02 | P2   | be878a57将初始密码检查放在懒加载profile                    | 改工作台onReady轻量共享sheet，App冷启动按账号去重，存储失败明确提示；GET失败不猜测状态，改密proof/重登保持。中等生命周期风险，独立bundle共享App状态及迟到响应测试。 |
| F4-03 | P2   | a50b423b按钮缺显式flex居中、sm字号                         | 复用原表单并统一md字号、48px最小高度；390/320和大字号浏览器几何通过，实体机待复核。                                                                                 |
| F4-04 | P3   | ee6f9cb8旧tab顺序与用户要求不同                            | 统计左、事件右，保留statistics默认与数据口径；静态顺序/控制器回归。                                                                                                 |
| F4-05 | P3   | 4e5cb461为today+selected加入near-black圈                   | 仅改同色黄色token，周末/禁用语义不变；原日期状态合同及增量断言通过。                                                                                                |
| F4-06 | P2   | 通知保存使用常驻info alert                                 | 群组/个人保存、微信订阅成功复用ui-toast；与换班共享两秒计时helper，状态挂实例。direct Page与Component均桥接hide/show，隐藏/卸载/换群不回放旧反馈。                  |
| F4-07 | P2   | 偏好默认true不是授权；异步gate在微信调用之前；fail吞错误码 | 独立“订阅微信提醒”入口，同步能力快照校验后直接wx调用。静默accept成功；拒绝不写偏好；20004显示明确设置按钮。保留API默认，不建设回调服务器。                          |

引入点使用git log -S与blame核实。状态机与UI改动按需求变化记录，不称纯重构。密码接收者绑定保留，新增卸载/账号变化的迟到响应保护；请求协议、proof和错误验证保持。

F4-07引入点：API默认true及发送字段为ef3d20ca5；controller异步gate为766ec6ac6，adapter异步gate为cb82cb78c。原生是否因Promise丢失手势尚未确证，本次以同步调用回归保障直接点击边界。F4-02收尾审查发现c7f93d48在401恢复期间可能先读到空账号而漏提醒：现等待已有awaitWechatSessionRecovery，等待前后校验实例代数，卸载不继续请求，新增2项先红后绿。

共享计时提取逐调用审计：接收者调用保留，清理token/计时器、2秒、当前任务与同文案校验相同，无异步请求或错误路径变化；额外清理为空计时状态的幂等调用。通知新增隐藏代数仅管反馈，不取消微信原生授权返回后的正常偏好保存。

## 微信授权说明与未验证项

- 用户确认症状为点击后不出现授权窗口。旧开关若默认true，点击实际走关闭分支；独立订阅入口现可再次申请。记住选择后静默返回是微信正常行为，不能强制弹窗。
- 截图8的[消息推送配置](https://developers.weixin.qq.com/miniprogram/dev/framework/server-ability/message-push.html)接收微信发给开发者的事件，与客户端弹订阅窗不同；本轮不填URL/Token/AESKey。
- [微信订阅API](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/subscribe-message/wx.requestSubscribeMessage.html)要求用户主动点击；[订阅说明](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/subscribe-message-overview.html)区分一次性和长期权限。官方网页经PowerShell只读请求取得，web工具直连失败不计成功使用。
- 后端已实现定时任务与订阅发送；当前生产模板类型/字段、凭证配置、实际投递与微信原生窗口未测量。本次不声称“微信消息已送达”或“小米14验收通过”。

## 验证与体积

- `pnpm --filter @schedule/miniprogram verify`基线PASS，8.16s，主包1,689,058/总包5,051,234 bytes。主包1.5MB内部预警和两矩阵节点1445/1506警告已有，不是新增原生性能结论。
- 基线身份/profile定向24通过/12布局条件skip，ESLint通过。新增identity/security/UI回归均已记录red后green。
- 1–5检查点：47项定向PASS（identity、account-security、profile、workspace、build-tools、日期），ESLint/typecheck/verify/icon parity PASS。
- Edge布局代理16项PASS，390×844/320px、大字号、登录及按钮几何；输出canonical runtime/codex/feedback4/profile-layout。修正代理中motion import先于page override的顺序，产品筛选图标代码未改。
- 中途Mini全集：862通过、1旧共享模板路径断言失败、14条件skip；随后修正测试路径并定向通过，6–7完成后的最终全集结果如下。
- 独立组件方案曾增20,241 bytes；改为工作台直接模板与共享控制器并排除无用途独立module输出后，1–5阶段主包1,692,724/总包5,054,896。阶段净增3,662 bytes，不声称净减包。
- 命令、实际日志/包摘要位于general-3/runtime/audit/feedback4，均ignored。原生Console/Network/冷启动性能当前工具无法测量，暂未验证。
- 6–7及恢复收尾：新增22项回归先红后绿（通知15、订阅运行时5、恢复等待2）；受影响定向集与ui-toast共73项最终纳入全集通过。两处旧异步gate/文案静态断言与旧toast归属审计随实际结构迁移，未降低授权要求。
- `pnpm --filter @schedule/miniprogram verify` PASS，6.25s，dirty主包1,693,648/总包5,062,990 bytes；相同预算预警保留。最大文件：workbench/index.js 217,223B、scheduling/pages/manual/index.js 182,334B、workflows/pages/swap/index.js 180,827B（无最大文件基线比较）。
- `pnpm --filter @schedule/miniprogram test` PASS：142文件通过/1跳过，889通过/14条件skip，103.73s。日志`notify-full-mini.log`。变更ESLint/format、typecheck、icon parity PASS，无新增依赖。
- `node apps/miniprogram/scripts/ui-toast-layout.mjs`复用已安装Edge完成28个CSS布局组合。首次将输出指定canonical runtime被脚本git check-ignore跨工作树边界拒绝；改用本槽ignored runtime/audit/feedback4/notification-toast-layout后PASS，未改脚本或产品布局来规避检查。
- 源码提交后同槽clean `pnpm --filter @schedule/miniprogram verify`再次PASS，主包1,693,649/总包5,062,991 bytes；相较596c20b2 clean基线增加4,591/11,757。Manifest `cfca985635b5497729054ccbc1b0c94fac4ca0f739261e58400a0b3ab2e217fd`，日志`notify-clean-verify.log`。dirty字段为false多1字节，不能把dirty/clean差异当应用退化。

## 检查点与下一步

- 首源码检查点c7f93d48：`fix(miniprogram): streamline identity and launch password reminder`。
- 最终源码检查点c55906e5f17526bebfb40443500e02769cb9061c：`fix(miniprogram): clarify subscriptions and transient feedback`。两者已由root fast-forward整合并普通推送GitHub main；首次push的schannel TLS失败后仅重试一次即成功，未修改系统、证书或代理，未因网络重建/重测。
- 文档收口message：`docs(audit): record feedback4 validated checkpoint`；应用输入不变，复用既有验证，不重复全测试。无体验上传/生产部署。
- 唯一下一任务UPLOAD_REQUIRED：取得最终SHA当次体验上传授权后准备并上传，再核对同版本小米14证据。原生授权窗口、实际送达和真机验收不以本轮Node/桌面代理替代；本轮停止，不预分配版本。
