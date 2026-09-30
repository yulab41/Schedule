# Project Status

## 当前批次：通知中心“全部已读”闪烁修复（2026-09-30）

- 范围：仅微信小程序通知面板模板 + 回归测试 + 文档；独占 warm `runtime/wt/general-6`，REUSE_ONLY，无依赖安装；基线 `origin/main` = `2191b136`。
- 已修复：点击任一通知时，“全部已读”按钮不再闪动。引入点为 `304d742f`（嵌入通知 Sheet）把该控件的可见禁用样式绑到“任意操作”`actionBusyId !== ''`；现改为只在该控件自己的操作进行中生效（嵌入 Sheet `actionBusyId === 'all'`，独立通知页 `disabled="{{actionBusyId === 'all'}}"`）。控制器并发守卫、请求、未读计数与 `unreadchanged` 事件未改；契约/API/数据库未改，无迁移。
- 追加（用户指示“允许按压反馈”）：独立通知页每行“已读”按钮改为 `disabled="{{actionBusyId !== '' && actionBusyId !== item.id}}"`（只有保存中的那一行变灰），嵌入 Sheet 卡片与“全部已读”的 `hover-class` 改为固定 `is-pressed`；点击反馈只由手指触摸驱动，重复点击仍被控制器守卫吞掉。取舍：请求窗口内其它行的 `aria-disabled` 会读作“可用”，已在轮次记录登记。
- 验证：两条回归用例先红后绿（其中一条回退模板复跑 `1 failed | 34 passed`）；`notifications-controller` 35 项、Mini 全量 1308 通过/23 跳过（基线 1306/23）、typecheck/lint/format/production verify（包体 4,447,507 B、manifest `91589cee…`）通过；`smoke:check-core` 判定未涉及核心链路。详见 [轮次记录](audit/notification-readall-flicker-20260930.md)。
- 交付（2026-09-30 用户当次授权）：候选 `939c1d5f` 由 Node `miniprogram-ci` 上传体验版 `0.1.0-p10.20260930.220`（manifest `2d9a5e89…`、tag `miniprogram-trial/0.1.0-p10.20260930.220`、receipt 在 ignored `runtime/audit/miniprogram-trials/`）；可信控制 `schedule-client-version-allowlist ensure` 只增追加，重复 ensure 幂等，`verify` 与完整 `ecs-verify.sh`（`ECS_PUBLIC_IP=120.77.220.79`）通过。放行前后 live release 均为 `5f25d946`（schema 69）：Mini/文档范围未部署应用、未备份/迁移数据库、未提审、未正式发布。
- 用户真机复核（2026-09-30）：小米 14 同构建体验版 `.220@939c1d5` 按交付步骤复核后回复“通过”，本轮“点击通知时全部已读闪烁”记为已通过同构建真机验收。用户未附截图/基础库/微信版本记录，故不外推到 iOS、其他安卓或全平台；`.216`、`.218`、`.219` 等历史检查点的待复核状态不受影响。
- 唯一下一任务与停止条件：本轮无待办，等待用户下一次反馈或新需求；未获当次授权不做生产部署、上传或提审。若要继续处理历史待复核项，按各轮次记录在小米 14 同构建下复核后再更新结论。

## 上一批次：按类型微信提醒开关 + 开关响应速度优化（2026-09-30）

- 范围：仅微信小程序通知设置页 + 文档；独占 warm `runtime/wt/general-6`，REUSE_ONLY，无依赖安装；基线 `origin/main` = `2cd6e088`。
- 已实现：删除“接收微信提醒”总开关与相关状态/处理器；只保留 5 个按类型开关，打开某类时申请该类订阅授权并下发完整 5 类偏好 + 打开服务端总闸，关闭时只写该偏好；历史“总开关关闭”状态按全关呈现，打开任一类只开启该类；保存中只在该行显示 loading，仅未配置模板的类型永久禁用。
- 追加（同日）：开关点击后**立即上屏**（乐观绘制、失败回滚）；同一页面会话内已授权的类型反复开关**不再弹窗、瞬时生效**；行状态文字改为“重新授权”入口（一次性额度用完后可手动补授权），说明提示可勾选“总是保持以上选择”。
- 验证：`notifications-controller` 33 项、`workflow-switch-feedback` 23 项、Mini 全量 1306 通过/23 跳过、typecheck/lint/format/production verify（包体 4,447,547 B、manifest `39841506…`）通过；`smoke:check-core` 判定未涉及核心链路。详见 [轮次记录](audit/notification-kind-switches-20260930.md)。
- 体验版 `.218@8ec20dd`（只保留按类型开关）与 `.219@19e16565`（即时上屏 + 会话内复用授权）均已上传并按用户当次授权只增放行，白名单 `verify` 与完整 `ecs-verify.sh` 通过；Mini/文档范围，未部署生产，live release 仍为 `5f25d946`（schema 69）。
- 唯一下一任务：小米 14 退出重进同构建体验版 `.219@19e16565` 复核“点击立即上屏、同会话反复开关不弹窗、状态文字可重新授权、5 类独立开关无总开关”；取得同构建真机证据前不写验收通过。

## 上一批次：六项小程序缺陷修复 + 按类型微信提醒（2026-09-29）

- 范围：仅微信小程序视觉/交互 + 必要的共享包与 API 改动；默认 REUSE_ONLY，独占 warm `runtime/wt/general-6`，未安装依赖；基线 `origin/main` = `9b13dc8e`。
- 已实现：①请假日期边界改用中国日历日（修 5/1 请假误报 4/29 班次、补齐末日漏检；同口径修正可用性、审批预览、撤销守卫与文案）；②周期天数弹层与换班年月选择器共用选中横杠、渐隐遮罩与底部按钮，滚轮数值放大；③删除管理员换班/加扣班弹窗的“直接生效…”胶囊；④`wechatNotificationKinds` 契约 + 迁移 0069 + API 按类型闸门 + 解码器 + 5 个独立开关（保留总开关）；⑤事件时间轴改中文对象名与影响说明；⑥我的页胶囊四周等宽窄内边距并与左标签居中对齐。
- 验证：真实 MySQL 工作流 88 项、手动排班 37 项、迁移 30 项、按类型微信通知用例通过；Mini 1304 通过/23 跳过；typecheck/lint/format/build/图标/production verify 通过（包体 4,442,815 B、矩阵节点 1,513、manifest `d5927312…`）；`pnpm smoke:browser` 全流程通过（本地开发库迁移到 69，仅本地合成平台角色已恢复）。详见 [轮次记录](audit/mini-six-fixes-20260929.md)。
- 既有失败（非本轮引入）：`task10` 的 `calendar.integration.test.ts > excludes drafts and replaced revisions` 在基线 `git stash` 后同样 409 失败，本轮未修改该测试。
- 2026-09-29 用户授权 L4/L3：应用检查点 `5f25d946` 已部署生产（回滚候选 `c59975c4…`、备份 `49236b11-b57e-4994-bca2-5a7b7ce2edec`：56 表/139,505,928 B、schema 69、独立 verifier 通过、公网健康 `ready:true`）；体验版 `0.1.0-p10.20260929.217`（manifest `8a432f75…`）已上传并按可信控制只增放行，验证通过。未提审、未正式发布。
- 唯一下一任务：小米 14 退出重进同构建体验版 `.217@5f25d946` 复核六项修复（5/1 请假不再提示 4/29 冲突、周期天数弹层、管理员弹窗无胶囊、5 个微信提醒开关、事件页中文标识、我的页胶囊对齐）；取得同构建真机证据前不写验收通过。

## 上一已交付检查点

- 换班、请假限制与统计口径统一整改：应用 `c59975c4` 已生产部署（schema68、备份 `d18366a6-582a-4002-bcf8-caa6791477a4`）、体验版 `.216@c59975c4` 已上传并只增放行；小米 14 同构建复核仍待用户证据。详见 [轮次记录](audit/leave-statistics-20260929.md)。
- 外部值班校对：生产 release `bc59dfbf`（前驱 `9715e88f`/`06d420a1`/`193ae653`）与体验版 `.215@1eb92e5` 已交付并由用户授权 add-only 放行，schema67/68 已迁移；本轮把它合并进 main 以消除主线与线上分叉。其交付记录见 [UI 轮次](audit/external-duty-ui-20260928.md)、[发布基线设计](superpowers/specs/2026-09-28-external-duty-published-baseline-design.md) 和调试日志 `EXTERNAL-DUTY-PREVIEW-001`；小米14同构建仍待用户复核。
- 通知最近30天：应用 `8bb3c6e4` / 体验版 `.212` 已在上一轮部署、上传和追加放行；文档检查点 `45bf7bec`。本轮未重新验证线上身份，不能用历史记录代替实时回滚基线。见 [通知轮次](audit/notifications-retention-30days-20260928.md)。
- 历史工作流最近30天 `.211`、联系方式 `.210`、历史显示 `.209`、日历 `.208` 等已交付记录位于 `docs/audit/` 和 Git 历史。所有缺少同构建手机证据的项目继续保持“待用户复核”；不重复历史生产操作。
- 长期事实来源：`docs/superpowers/plans/2026-08-01-medical-staff-scheduling-system-implementation-plan.md`、对应 design、`docs/agent-context/pitfall-index.json`、`docs/audit/AUDIT_MASTER_PLAN.md`。本轮是用户批准的工作流/统计整改，不进入无关后续功能。
