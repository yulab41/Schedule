# Skyline 访客周视图分页体验版 139 交付

## 交付结论

- 体验版：`0.1.0-p10.20260915.139`
- 应用 SHA：`a9c3204fdaf513bb56ac5dc186aaf5613e58b2f4`
- 实现检查点：`a9c3204f fix(miniprogram): share Skyline circular week pager with guest`
- 累积基线：`09c100d5`（并行会话的 `.138`「3.17.2 选择器浮层与页头箭头」）
- 上传说明：`Skyline guest circular week a9c3204`
- 构建档位：`production/clean`
- 上传 Manifest：`a249181529719b47f6c659b7e045c6e23fa4feac2b8895497ce18a34d91e4d7b`

远端轻量 tag、allocation、Manifest 和 receipt 均绑定同一版本、SHA、说明与 Manifest。本轮只上传
小程序并通过可信控制追加允许版本；未提交审核、未正式发布、未退役旧版本，也未部署新的 API/Web
应用制品、执行数据库备份、迁移或业务数据写入。

## 血缘与并发处理

首次上传尝试以 `.137@09e63980` 为基线，被血缘门禁在**版本分配之前**拒绝：并行会话已上传
`.138@09c100d5`，而最新累积体验版必须是本候选的祖先。该次失败未消耗版本号、未创建 tag、未调用
微信上传。

随后在独立 warm 槽中把访客周视图的源码、测试与文档线性叠加到 `09c100d5` 之上：不改写对方分支、
不创建合并提交、不触碰对方租约，也不与其共享可写依赖树。因此 `.139` 同时包含 `.138` 的选择器
浮层/页头箭头修复与本次访客周视图分页修复。

## 变更范围与门禁

访客页面改为导入成员页面同一个 `components/calendar/calendar-period-pager.js` 环形状态机：
`renderCalendar` 用 `mapCalendarPeriodRing`，模板加 `circular="{{true}}"` 与
`bindchange="handleWeekSwiperChange"`，标题/星期行读取 `weekPanels[weekSwiperCurrent]`，提交后
`weekSwiperCurrent` 固定为当时的 `weekRingSlot`，不再回到 1 号页。成员页面零差异；260ms、
`easeOutCubic`、±6 有界队列与提交锁不变。

RED 2 项在旧实现上失败；GREEN 定向 42 项、Mini 完整 174 文件 1206 项通过、16 项跳过，根套件
270 文件 1273 项通过、444 项跳过；TypeScript、production build（366 文件）、source audit、
package audit、determinism、format、lint、`smoke:check-core` 通过。主包 1,741,484 B、
总包 4,609,138 B，较 `.138` 增加 2,337 B。Mini verify 仍只被未修改的手排节点预算
`1507 > 1506` 阻断。

## 放行与公网验证

L4 预检：双 DoH 一致、TLS/SNI、严格 SSH 主机密钥与显式身份通过；实时读取的生产 live release 为
`44034fcc342b7ac9994b8222022c64118d276df9`，本轮未改变它。可信
`schedule-client-version-allowlist ensure` 只追加 `.139`，保留 `.135/.136/.137/.138`；allowlist
verifier 与完整 `/usr/local/lib/schedule/ecs-verify.sh` 通过。公网探针：
`.139/.138/.137/.136 = 200`、动态未知版本 `= 426`。

## 验收边界

上传、放行和自动验证不等于真机验收。唯一下一任务：在小米 14 上用 3.17.2 与 3.17.3 两个实例复核
`.139@a9c3204`：访客页面周视图连续左右滑动是否平顺不乱跳、切到其它周后点单元格是否立即选中；
同时确认 `.138` 的页头箭头与四类选择器、以及月视图、列表视图、成员页面的 260ms 动画均无回归。
