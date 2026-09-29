# Project Status

## 当前批次：六项小程序缺陷修复 + 按类型微信提醒（2026-09-29）

- 范围：仅微信小程序视觉/交互 + 必要的共享包与 API 改动；默认 REUSE_ONLY，独占 warm `runtime/wt/general-6`，未安装依赖；基线 `origin/main` = `9b13dc8e`。
- 已实现：①请假日期边界改用中国日历日（修 5/1 请假误报 4/29 班次、补齐末日漏检；同口径修正可用性、审批预览、撤销守卫与文案）；②周期天数弹层与换班年月选择器共用选中横杠、渐隐遮罩与底部按钮，滚轮数值放大；③删除管理员换班/加扣班弹窗的“直接生效…”胶囊；④`wechatNotificationKinds` 契约 + 迁移 0069 + API 按类型闸门 + 解码器 + 5 个独立开关（保留总开关）；⑤事件时间轴改中文对象名与影响说明；⑥我的页胶囊四周等宽窄内边距并与左标签居中对齐。
- 验证：真实 MySQL 工作流 88 项、手动排班 37 项、迁移 30 项、按类型微信通知用例通过；Mini 1304 通过/23 跳过；typecheck/lint/format/build/图标/production verify 通过（包体 4,442,815 B、矩阵节点 1,513、manifest `d5927312…`）；`pnpm smoke:browser` 全流程通过（本地开发库迁移到 69，仅本地合成平台角色已恢复）。详见 [轮次记录](audit/mini-six-fixes-20260929.md)。
- 既有失败（非本轮引入）：`task10` 的 `calendar.integration.test.ts > excludes drafts and replaced revisions` 在基线 `git stash` 后同样 409 失败，本轮未修改该测试。
- 唯一下一任务：按用户授权执行 L4 生产部署（备份 → 部署含 0069 → 验证）与 L3 体验版上传 + 追加放行；小米 14 同构建真机复核仍待用户证据。

## 上一已交付检查点

- 换班、请假限制与统计口径统一整改：应用 `c59975c4` 已生产部署（schema68、备份 `d18366a6-582a-4002-bcf8-caa6791477a4`）、体验版 `.216@c59975c4` 已上传并只增放行；小米 14 同构建复核仍待用户证据。详见 [轮次记录](audit/leave-statistics-20260929.md)。
- 外部值班校对：生产 release `bc59dfbf`（前驱 `9715e88f`/`06d420a1`/`193ae653`）与体验版 `.215@1eb92e5` 已交付并由用户授权 add-only 放行，schema67/68 已迁移；本轮把它合并进 main 以消除主线与线上分叉。其交付记录见 [UI 轮次](audit/external-duty-ui-20260928.md)、[发布基线设计](superpowers/specs/2026-09-28-external-duty-published-baseline-design.md) 和调试日志 `EXTERNAL-DUTY-PREVIEW-001`；小米14同构建仍待用户复核。
- 通知最近30天：应用 `8bb3c6e4` / 体验版 `.212` 已在上一轮部署、上传和追加放行；文档检查点 `45bf7bec`。本轮未重新验证线上身份，不能用历史记录代替实时回滚基线。见 [通知轮次](audit/notifications-retention-30days-20260928.md)。
- 历史工作流最近30天 `.211`、联系方式 `.210`、历史显示 `.209`、日历 `.208` 等已交付记录位于 `docs/audit/` 和 Git 历史。所有缺少同构建手机证据的项目继续保持“待用户复核”；不重复历史生产操作。
- 长期事实来源：`docs/superpowers/plans/2026-08-01-medical-staff-scheduling-system-implementation-plan.md`、对应 design、`docs/agent-context/pitfall-index.json`、`docs/audit/AUDIT_MASTER_PLAN.md`。本轮是用户批准的工作流/统计整改，不进入无关后续功能。
