# VIS-02 访客月历内容与成员一致

## 范围与状态

2026-09-11，用户确认小程序与 Web 同步覆盖群关联访客、独立登录访客和持有效 key 的匿名访客。已实现并完成本地运行验证，待具体检查点部署/上传授权和小米 14 复核。没有生产连接、备份、部署、放行、群关联变更或真实电话/通知。

基线为 d5d2ebb15dde7e1c07e7d87ec7803100b41cb865（包含反馈9/.102及访客/.101）。独占 general-1，依赖指纹 aef084f57bf1321a10e60130f912fe4ef35127421f368cd461c490b7ef7ec527；Acquire → ReuseOnly → Bootstrap → Targeted test，无安装。用户恢复本机 Docker 后运行本地真实 MySQL；自动审批拒绝的 socket 清理未执行。

## 行为变化与权限

- `CalendarQuery` 访客读取使用成员相同的联系方式可见性和变更标记生成规则；取消关联访客额外删号及 Mini 客户端统一删号。明确撤回公开的手机号仍隐藏，短号/格式规则复用原实现。
- 新增 GET `/groups/:groupId/guest-calendar/shifts/:shiftId/events` 与 `/guest/groups/:groupId/calendar/shifts/:shiftId/events`。分别要求登录访客资格或有效 visitorKey；严格解析群/班次 UUID 和 cursor/pageSize（1–100）。每页都校验班次与群关联、群/发布期/班次未删除、发布期为 published/past。
- 事件仅使用既有 EventQuery 的 groupId + shiftId 范围；不提供通用事件查询/详情权限，不沿群级父子事件图跳转。两端通过分页完整读取该班次事件，再复用成员事件卡片和变更链规则；重复 cursor 失败，不无限循环。
- Web 两种访客入口复用 CalendarView；Mini 独立扫码页复用成员详情行、展开状态及事件组件。电话仅用户点击后触发 `tel:` / `wx.makePhoneCall`，Mini 还拒绝旧群或当前数据中不存在的号码点击。
- 独立 calendarEvents 判定不启用 insights/管理/通讯录。现有工作台结构、观察器修复、关联数据、认证协议、成员记录及数据库表均保留。
- 账号、角色、群与月份绑定读取；切换/隐藏/卸载/权限或能力撤销时清空电话和事件并丢弃旧响应。访客数据和 key 只在内存，原成员离线缓存不用于访客；访客解析、日历及事件响应统一 no-store，禁止 HTTP 缓存。
- Web 事件加载错误新增弹层内错误和重试，避免误显示“暂无事件”；日历错误也提供重新加载。号码公开说明补充“成员及有效访客”。

这些是获批的权限/浏览行为变化，不宣称整文件语义等价。成员事件页增加分页与失效响应保护；拨号增加当前数据验证；其余成员读写边界不变。

## 引入点与先失败后通过

- 群关联删号：`git log -S 'access.linked'`、blame 指向 4e0a0d1a。
- Mini 统一删号与访客入口：`git log -S 'sanitizeGuestCalendar'` 指向 890efd8b。
- Web 班次事件读取：`git log -S 'getGroupEvents(props.group.id'`、blame 指向 7ac2a07a；原错误路径仅写外层告警，弹层显示空记录。
- 旧服务端源码运行新增真实 MySQL 用例：访客班次路由 404，预期 200；恢复实现后通过。首次 Docker 未启动导致的 ECONNREFUSED 不计作业务红灯。
- 共享客户端缺少新方法、小程序旧删号、Web 事件错误无弹层重试、Mini 旧号码点击以及访客响应缺失 no-store 均有失败输出；修复后通过。测试中的号码/事件/用户均合成，未拨打真实电话。

## 验证证据

证据日志保存在 ignored `runtime/audit/visitor-parity/`；浏览器图在 `runtime/smoke/visitor-parity/` 和 `visitor-parity-details/`。

| 层级 | 命令/结果 |
| --- | --- |
| 基线 Node | 访客与工作台39通过；Mini verify通过，主包1647645、总包4441172字节 |
| 真实 MySQL | 受控 run-api-integration.mjs 运行 calendar.integration.test.ts：33通过；后续撤销/独立访客10项与边界1项补充复测通过。覆盖成员/两种登录访客/匿名内容一致、分页、跨群、草稿、历史期、删除班次、失效key、号码撤回及九类关联资格撤销 |
| 共享/根测试 | `pnpm test`：依赖保护81通过；root 1227通过/419条件跳过。真实MySQL证据单独列示，不把条件跳过当通过 |
| 小程序 Node | 全量1059通过/15条件跳过；最后事件/拨号修正后定向47通过。包含真实属性观察器、组件模拟、快速切群、同群角色、晚到响应、后台和卸载；模拟不代表原生验收 |
| 浏览器真实本地 API | 运行/浏览器验证：`pnpm smoke:browser` 通过，登录/管理员/成员/访客与访客访问记录全流程；合成管理员标记已恢复。访客响应布局在1280/390/320宽度验证 |
| 浏览器合成 API | `node scripts/smoke-guest-calendar-parity.mjs` 通过：号码/拦截拨号、事件503错误及重试、分页、三视图、权限撤销清空及日历重试；没有成员接口请求 |
| 构建/静态 | API/共享客户端构建与类型检查、Web生产构建、Mini verify、ESLint、格式、icon parity均通过 |
| 包体（访客实现合并前） | Mini 主包1679888、总包4492767字节；Worklet2/2；Manifest 0af18ea398573ffd2ca42f7aee3e032aefa91014d9e13a40b44bd0eed52a55fd。保留既有1.5M内部预警与矩阵节点预警，硬预算通过 |
| 发布证明 | 动效/lineage/候选路径/上传锁28项通过；lineage audit 3个必需检查点有效。正式版本绑定构建/上传尚未执行 |

## 动效证明与后续门禁

15个受保护导航、swiper、定位与滚动队列方法经 TypeScript AST 比对，与旧证明 blob 111c05e295e78b4056af49e022d7a842b0411cf7 一致；其余8个证明文件 blob 一致。新工作台 blob 337b3f78596cd4fe60d1ed486dd74dfd8f4399f7，仅更新对应证明和说明，保留全部必需检查点/精确匹配门禁。

检查点消息 `feat(calendar): align guest calendar details with members`。先提交并普通推送；生产 LIVE_RELEASE_VERIFIED=false，未经本轮实际查询不拿旧状态作回滚候选。无迁移。用户批准具体 SHA 后按项目流程重新读 live、备份及校验、部署并验证，再使用干净独占候选动态分配体验版本、上传和只追加放行；不退役旧版。

唯一下一任务：批准具体检查点部署/上传后交付体验版，小米14在同一新版本上核对 SHA、trial、Skyline、基础库、微信版本与构建时间，复核双向切群、扫码、电话取消/失败及事件。当前工具无法测量原生卡死/闪退/实际拨号体验，暂未验证；不得记为真机通过。


## 主线并发集成

访客功能检查点0a8bcba722619481394d83abc84c338406ae21f3完成后，主线新增9bae5beb14adc4338cd28f08ca1dadd361aa7c6d。普通快进因分叉停止，未强制推送；在独占槽合并并保留反馈10全部CSV、二维码保存及通知跳转改动。只有两份状态文档冲突，业务源码无冲突。原访客验证绑定0a8bcba7应用内容；合并后只补跑变化影响的producer构建、交叉测试、包体和运行检查，不把旧包体伪标为合并后产物。合并消息 merge: preserve feedback10 alongside guest calendar parity；最终批准/部署/上传使用累积检查点SHA。


合并后证据：真实MySQL日历/CSV/微信诊断45通过（全部通知gateway为fixture）、Mini访客/切群/事件/CSV/QR/通知联合146通过、共享/网关/路由/连续性33通过；访客浏览器专项再次通过。Web/API构建与类型、格式、icon parity和核心运行记录检查通过。仅重建client-core/presentation-core受影响producer；6个其他producer复用，无安装。Mini verify主包1681844、总包4504816字节，Worklet2/2，Manifest fd34eaca3726d8397919e8b1232f492830ed8e15a81fabed3fa149c2fb5b40df；原有预警不变。受保护动效源码与proof未受主线合并影响。
