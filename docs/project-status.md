# Project Status

## 当前批次：feedback5代码已整合，正在全仓验证

- 已完成反馈1/3/4/5/8的Mini源码修改：去筛选多余字符、压缩账户卡底空白、精简特殊日期文案、放松下一班时间字距、滚动12个月趋势（跨年最多2年请求，缺失不冒充零）。Web/共享包/API未改。
- checkpoint message：`fix(miniprogram): refine profile layout and yearly duty trend`。相关35测试及Mini verify/typecheck/icon parity/smoke:check-core通过；390/320大字号布局代理通过，仍待小米14复核。详细证据见 `docs/audit/feedback5-ui.md`。
- 主包1693649→1697935、总包5062991→5067277字节，均+4286；无新增依赖、安装0，general-3健康warm槽独占复用。
- 已知线上观察仍为feedback4：source/release `bfd1fbbdcf2594d66fde39bba6ae4f18b22798e1`、体验版 `0.1.0-p10.20260907.94`。本轮获授权只读核验生产；未部署、未上传体验版；不将本轮源码当作线上版本。
- 查询检查：线上legacy、0053索引已就绪，首搜4.423秒主要在SQL；建议后续独立授权受控启用candidate，未切换。general-1经健康与历史核对后官方恢复可用，无安装；详见 `docs/audit/feedback5-directory-inspection.md`。记录提交message：`docs(audit): record feedback5 production query inspection`。
- 第6项群组日历偏好保存成功/失败已复用两秒顶部胶囊，补直接Page注册和组件生命周期；保留读取失败持久重试。相关测试及Mini verify、包审、toast28组合通过，组织分包+360字节；待主任务集成及真机复核。详见 `docs/audit/feedback5-group-feedback.md`；checkpoint message：`fix(miniprogram): unify calendar preference feedback`。
- 微信诊断已整合040f03b7：本人诊断/主动测试、取凭据和发送阶段、模板同源、错误胶囊、通讯录查询计划与实例年龄。Mini89/API34/本地MySQL5及视觉代理通过，详见 `docs/audit/feedback5-notifications.md`；本轮未发送真实消息。
- 整合全仓门禁先在lint发现新群组测试wx未显式声明；改为globalThis.wx后lint及11项回归通过，checkpoint message：`test(miniprogram): declare the shared wx fixture explicitly`。
- 唯一下一批：完成整合全仓门禁和同口径包审，更新最终记录并推送；停止于验证后checkpoint，生产candidate切换、部署与最终体验版上传待授权。
