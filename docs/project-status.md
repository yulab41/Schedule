# Project Status

## 当前批次：换班、请假限制与统计口径统一整改

- 范围：已批准的十项需求，覆盖 API、小程序及 Web；默认 REUSE_ONLY，独占 warm `runtime/wt/general-6`，没有安装依赖。源码基线 `45bf7bec`，保留 canonical 未跟踪文件。
- 已实现：换班申请优先/处理人补全；请假提交和审批硬性阻断，删除自动清空/补位/恢复执行链；待审批与批准请假按日期禁排；生成、应用、发布、换班/加扣班和撤销恢复均在群组事务内检查。
- 已实现：统计算法 v2 按有效申请与班次计算七项指标、撤销/冲销排除、补录校正基线、跨月和年度去重；修正无名空行与成员班种归属，多班种默认折叠明细，旧接口由同一结果适配。历史审计不改写，没有数据库迁移。
- 回归和引入点详见 [轮次记录](audit/leave-statistics-20260929.md)。相关真实 MySQL 七文件148项通过；追加撤销恢复与跨夜边界5项通过。五个既有未改文件已单独完成纯格式提交 `c4af13ef`，完整 `pnpm verify`（format/lint/build/typecheck/图标/Mini/root）在本轮应用检查点上全绿；Mini1295通过/22跳过，root1313通过/465跳过。
- 运行/浏览器验证：`pnpm smoke:browser` 对应脚本在本地 API 3105/Web 4175 全流程通过，含管理员/成员/访客/新版统计；320/390px 与大字号几何代理通过。开发者工具局部编译通过；小米14同构建、iOS及其他安卓未验证。
- 应用检查点 `52e4b7e2`（`fix(scheduling): enforce leave restrictions and effective statistics`）已正常快进推送main。本地运行验证已完成；本次收口文档提交 `docs(audit): record leave and statistics implementation checkpoint` 不触发生产操作。
- 主线与线上分叉：部署前实时读取线上 release `bc59dfbf`，确认它来自并行分支 `codex/doctor-duty-reconcile` 而不在 main 祖先线上（两者都缺对方代码）。按仓库既有 `merge: include …` 惯例合并该分支，避免部署把已上线的外部值班校对回退；合并只冲突三个状态/日志文档。
- 已获用户明确 L4 授权（“授权继续执行，不再询问”），本批次继续按“服务端备份部署 → 统计重算核对 → 新体验版上传和追加放行”交付；不提审、不正式发布，真机验收单独记录。

## 上一已交付检查点

- 外部值班校对：生产 release `bc59dfbf`（前驱 `9715e88f`/`06d420a1`/`193ae653`）与体验版 `.215@1eb92e5` 已交付并由用户授权 add-only 放行，schema67/68 已迁移；本轮把它合并进 main 以消除主线与线上分叉。其交付记录见 [UI 轮次](audit/external-duty-ui-20260928.md)、[发布基线设计](superpowers/specs/2026-09-28-external-duty-published-baseline-design.md) 和调试日志 `EXTERNAL-DUTY-PREVIEW-001`；小米14同构建仍待用户复核。
- 通知最近30天：应用 `8bb3c6e4` / 体验版 `.212` 已在上一轮部署、上传和追加放行；文档检查点 `45bf7bec`。本轮未重新验证线上身份，不能用历史记录代替实时回滚基线。见 [通知轮次](audit/notifications-retention-30days-20260928.md)。
- 历史工作流最近30天 `.211`、联系方式 `.210`、历史显示 `.209`、日历 `.208` 等已交付记录位于 `docs/audit/` 和 Git 历史。所有缺少同构建手机证据的项目继续保持“待用户复核”；不重复历史生产操作。
- 长期事实来源：`docs/superpowers/plans/2026-08-01-medical-staff-scheduling-system-implementation-plan.md`、对应 design、`docs/agent-context/pitfall-index.json`、`docs/audit/AUDIT_MASTER_PLAN.md`。本轮是用户批准的工作流/统计整改，不进入无关后续功能。
