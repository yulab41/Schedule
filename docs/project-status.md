# Project Status

## 当前批次：feedback5 UI已实现，待真机复核；继续通知诊断与查询方案

- 已完成反馈1/3/4/5/8的Mini源码修改：去筛选多余字符、压缩账户卡底空白、精简特殊日期文案、放松下一班时间字距、滚动12个月趋势（跨年最多2年请求，缺失不冒充零）。Web/共享包/API未改。
- checkpoint message：`fix(miniprogram): refine profile layout and yearly duty trend`。相关35测试及Mini verify/typecheck/icon parity/smoke:check-core通过；390/320大字号布局代理通过，仍待小米14复核。详细证据见 `docs/audit/feedback5-ui.md`。
- 主包1693649→1697935、总包5062991→5067277字节，均+4286；无新增依赖、安装0，general-3健康warm槽独占复用。
- 已知线上观察仍为feedback4：source/release `bfd1fbbdcf2594d66fde39bba6ae4f18b22798e1`、体验版 `0.1.0-p10.20260907.94`。本轮未连接/部署生产、未上传体验版；不将本轮源码当作线上版本。
- 唯一下一批：通知胶囊与微信订阅诊断、首次通讯录查询方案检查；停止条件为本轮剩余授权修改通过验证及独立checkpoint，不自动上传或部署。
