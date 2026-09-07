# Feedback5 群组日历偏好胶囊

2026-09-07；基线52d7abff，general-3独占复用；无安装。该子批未部署或上传。

- 个人/群组日历偏好保存成功和失败统一复用ui-toast与info-message-lifetime两秒计时。移除保存结果的大块alert及无引用calendarPreferencesInfo，读取失败保留持久错误与重试。
- 原行为来自dffef1f2（git log -S及blame）。直接Page此前遗漏ui-toast注册，本次补齐；组件hide/detach及换群转发生命周期。
- hide清理显示及timer；unload只失效timer和请求序号，不setData。组件重建保持单调序号防A→B→A旧响应碰撞；保存结果和finally核对发起账号及会话token，防同账号重登污染。
- 复用已有手机号同意通知计时入口，不新增计时器。新保存先清旧胶囊；错误使用toast支持的error色调，实际组件displayTone测试确认，避免danger退化info。

## 验证

- 基线19测试通过（6.49秒），生产构建333文件/包审通过：主1697936、组织1016750、总5067278字节。
- 首轮5红：旧保存没有胶囊、无hide/unload方法、Page无toast注册。新回归覆盖个人/群默认成功失败、两秒替换、hide清理、卸载/换群迟到、A→B→A、同账号重登、实际Page/Component生命周期、实际error样式、加载错误持久。
- 相关控制器/页面测试33通过；追加hide已显示通知清理测试单独通过。Mini verify/typecheck、包审与smoke:check-core通过，主包既有1.5M和矩阵节点warning不变。
- 最终静态包：主1697935、组织1017110、总5067637；组织+360，总+359，主-1来自构建身份元数据，非业务优化；文件333不变。
- node apps/miniprogram/scripts/ui-toast-layout.mjs：28个浏览器CSS组合通过，含320/390、大字号和error色调；320截图已视觉检查。ignored证据在槽内runtime/audit/mini-toast-switch-feedback。未使用微信DevTools，不等于Skyline/小米14验收。

下一批继续通知订阅诊断及通讯录查询核验，由主任务集成；本子批停止于验证后的checkpoint。
