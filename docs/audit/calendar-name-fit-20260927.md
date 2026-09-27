# 日历姓名完整显示与分段动画（2026-09-27）

## 范围与行为

本轮以 `539d88e3`（已含正式包精简）为基线，独占 `runtime/wt/general-6`，按 Acquire → ReuseOnly → Bootstrap → Targeted test 执行，未安装依赖。用户批准实现、提交、推送和体验版上传；未授权生产部署或版本 allowlist。原截图没有可核对的构建身份，仅用于定位现象。

- 月历和列表完整姓名与随行标识同一行；周历完整姓名单行、标识固定下一行，保留班种分组标题。
- 月格横向 padding 从 3px 收到 2px，姓名/标识间隔从 2px 收到 1px，换班标识从 13px 收到 12px；多班次/紧凑格原 0/1px 特例也统一为 2px，保留选中框安全空间。390px 匿名三字姓名加单标识不缩小。
- `calendar-fit-line` 测量可用宽度和未变换的自然宽度，只在溢出时等比缩小。按内容、首次显示、重新激活和页面 resize 合并测量，拒绝过期/已销毁回调；无定时轮询或滑动帧 setData。月份 pager、手势、周高度、业务事件和接口未改。
- 首页/访客共享独立选中底块，`viewMode` 直接驱动 240ms cubic-bezier(0.2, 0.8, 0.2, 1) 位移和 180ms 字色过渡；内容仍即时切换，减少动态效果模式关闭过渡。
- 首页、访客、手排生成/草稿/发布预览和补录均通过原共享日历接入；保留人数汇总、跨月/过去状态、新增暗红、移除删除线和已有排班灰色。

## 根因与测试先行

`git log -S 'text-overflow: ellipsis'` 与 `git blame` 定位：月格省略规则来自 `8e68a480`；列表规则来自 `50c6d1ed`；首页周历允许断行来自 `e94a54ca`，共享预览周历来自 `e8286722`。周历标识下一行本身是有意设计，不是本轮待修缺陷。涉及文件为 calendar-cell / calendar-week-panel 的 WXML/WXSS 和 workbench/guest 模板及共享样式。

基线实际 WXSS 在 320/360/390px 的三字姓名自然宽度 33px，可用宽度分别约 21/27/31px，旧 ellipsis 规则均裁切。新增显示与测量生命周期回归先在旧代码得到 5 failed，再接入组件通过。旧周历换行断言改为本轮批准的 nowrap；日期点击测试注册真实新增子组件，原日期事件断言保留。

问题编号 `MINI-CALENDAR-NAME-001`（P2）：小屏姓名裁切影响辨认，月/列表省略和周历断行规则与确认需求冲突；根因置信度高。共享显示适配风险限于原生布局；修复后仍需同构建小米 14 验收。状态：已实现，待用户复核。

## 证据与边界

全部日志、匿名样例和截图位于 ignored `runtime/audit/calendar-fit-20260927/`。基线 production verify 用时 15.54s，原始总包 4,325,026 B、主包 1,615,560 B；基线 Mini 全量 184 文件通过/2 跳过、1,274 测试通过/18 跳过（154.45s）。构建前后均使用同一 warm 依赖指纹 `53681b41817f58032e808840921c1b7b3d108929781e602f330b04534006e2d6`。

- `pnpm --filter @schedule/miniprogram exec vitest run scripts/calendar-name-fit.test.mjs scripts/calendar-simulate.test.mjs scripts/mini-ui-c-event-today.test.mjs scripts/p7-native-feedback.test.mjs --fileParallelism=false`：22/22。测量覆盖合并、缩小/恢复、零宽隐藏、激活、过期、卸载和 resize。
- 浏览器几何代理：`SCHEDULE_CALENDAR_FIT_GEOMETRY=1 pnpm --filter @schedule/miniprogram exec vitest run scripts/calendar-name-geometry.test.mjs --fileParallelism=false`。实际 WXSS + 真实适配控制器，覆盖 320/360/390/393px 的月历、紧凑月历、两套周历和列表，二/三/四字、长中文/英文、单/多标识、N/NP、+人数；验证矩形边界、无碰撞、行位置、三字保持字号、连续选项与 reduced-motion。393px 只是额外探针，不代表已测得小米 14 的逻辑宽度。
- Agent 操作开发者工具（WebView、390×844、基础库 3.17.3）：首页月/周/列表、访客月/周、补录月历、手排普通预览与紧凑月/周弹窗匿名样例截图；共享组件及相关页面 WXML/WXSS 编译成功。首次热更新预览长英文仍显裁切，完整重新打开编译后显示完整，旧截图不作为通过证据。临时测量日志已移除。
- 开发者工具使用 `version=local` 的本地匿名显示夹具，不是假冒旧已放行版本；未进行真实补录、发布、换群写入。自动化跨上下文数组须按原生数组构造器复制，最初注入类型警告不归为业务回归。嵌套组件精确几何当前工具无法可靠测量，以截图辅助；真实账号换群、端到端访客链接和小米 14 暂未验证。
- 全仓 `pnpm format:check` 仍在上轮已记录的五个未修改文件失败：预览 model、补录 controller、contracts past-schedules、presentation-core backfill 源码/测试；没有混入无关格式修改，不宣称根 `pnpm verify` 通过。本轮文件 Prettier/ESLint、根 lint/typecheck、icon parity 和 `smoke:check-core` 通过；未涉及 Web 核心链路。

最终 `pnpm --filter @schedule/miniprogram test`：185 文件通过/3 跳过，1,279 测试通过/20 跳过，151.07s；其中新几何文件的两项默认跳过，已单独显式运行 2/2 通过（5.74s）。`verify` 的类型/源码/production 构建/包体/性能/确定性通过，`ci:dry-run`、trial-lineage 通过。最终本地原始总包 4,334,710 B、主包 1,625,244 B，前后各增加 9,684 B，保留前轮包体精简；Manifest `6678fd0dfb32e9c8704a318bcda9c93870b8f0e126f0ea851d050ea1ee4a1b6b`。仍有主包 1.5MB 内部预警与既有 600 格手排矩阵 1510 节点提示，无新增构建错误。这些是本地 dirty 候选测量，不是上传 ZIP 或真机性能结论。

原始产物分包：scheduling 428,690 B、organization 849,094 B、workflows 533,293 B、insights 898,389 B；最大文件为 `pages/workbench/index.js` 223,046 B、手排 `index.js` 184,908 B、`platform/client-core-calendar.js` 167,630 B。

## 体验版交付

应用检查点 `f651024f246eefd3569a6ecbb46315597ac76251`（`fix(miniprogram): fit full calendar names and animate view tabs`）已正常快进推送 `origin/main`。正式 helper 将拥有的 clean warm 槽位冻结为上传候选，版本由锁内分配器选为 `0.1.0-p10.20260927.203`，说明 `Calendar full names and tabs f651024`，production、dirty=false，构建时间 `2026-09-27T04:43:33.137Z`。

`pnpm --filter @schedule/miniprogram upload:experience` 于 `2026-09-27T04:45:02.581Z` 成功；微信 CI ZIP 2,363,771 B、代码文件 218，Manifest `cfd402a1f168ea92ad4f4ee0dcaa90c56cb464c247d9d2a34177a9af8b724abe`。远端不可变 tag、allocation、Manifest 绑定文件、receipt 与构建 profile 精确匹配同一 SHA/版本/摘要。正式 candidate safety 在构建前及版本绑定构建后均通过，后者确认 `VERSION_LOCAL=absent`。上传走已核验的微信直连 IPv4/Git 专用代理，保留 TLS 校验，没有重试占号。

没有生产连接、备份、部署、版本 allowlist、提审或正式发布。开发者工具项目窗口已关闭，上传槽干净释放；交付文档使用重新 Acquire 的独占 warm 租约，复用应用证据，不修改 `.203` 构建或重新上传。交付记录检查点消息：`docs(audit): record calendar fit trial 203`。

## 下一任务与停止条件

唯一下一任务：待单独生产 allowlist 授权后，用 `.203@f651024f` 在小米 14 冷启动，检查首页/访客月周列表、手排普通/紧凑预览和补录月/周，再检查切月份/群组与弹窗重开。核对版本、SHA、renderer、基础库、微信版本和构建时间；身份不符不计验收通过。取得同构建真机反馈前保持“待用户复核”。
