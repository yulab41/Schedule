# Project Status

## 当前批次：换班、请假限制与统计口径统一整改

- 范围：已批准的十项需求，覆盖 API、小程序及 Web；默认 REUSE_ONLY，独占 warm `runtime/wt/general-6`，没有安装依赖。源码基线 `45bf7bec`，保留 canonical 未跟踪文件。
- 已实现：换班申请优先/处理人补全；请假提交和审批硬性阻断，删除自动清空/补位/恢复执行链；待审批与批准请假按日期禁排；生成、应用、发布、换班/加扣班和撤销恢复均在群组事务内检查。
- 已实现：统计算法 v2 按有效申请与班次计算七项指标、撤销/冲销排除、补录校正基线、跨月和年度去重；修正无名空行与成员班种归属，多班种默认折叠明细，旧接口由同一结果适配。历史审计不改写，没有数据库迁移。
- 回归和引入点详见 [轮次记录](audit/leave-statistics-20260929.md)。相关真实 MySQL 七文件148项通过；追加撤销恢复与跨夜边界5项通过。五个既有未改文件已单独完成纯格式提交 `c4af13ef`，完整 `pnpm verify`（format/lint/build/typecheck/图标/Mini/root）在本轮应用检查点上全绿；Mini1295通过/22跳过，root1313通过/465跳过。
- 运行/浏览器验证：`pnpm smoke:browser` 对应脚本在本地 API 3105/Web 4175 全流程通过，含管理员/成员/访客/新版统计；320/390px 与大字号几何代理通过。开发者工具局部编译通过；小米14同构建、iOS及其他安卓未验证。
- 部署前发现主线与线上分叉：线上 `bc59dfbf` 属并行分支 `codex/doctor-duty-reconcile`，不在 main 祖先线上（两边都缺对方代码）。按仓库既有 `merge: include …` 惯例把该分支并入 main（`c59975c4`），避免部署回退已上线的外部值班校对；仅三个状态/日志文档冲突，合并后完整 `pnpm verify` 全绿，真实 MySQL 七个共享集成文件153项与迁移30/30通过。
- 2026-09-29 用户明确授权 L4：`c59975c4` 已部署生产（独立 verifier 通过、schema68、备份 `d18366a6-582a-4002-bcf8-caa6791477a4`：56表/138,974,408 B）；统计重算116个月0失败，116个快照全部 `algorithmVersion=2`、758个成员行无无名空行、医生群每月6人、护士群按班种明细；体验版 `0.1.0-p10.20260929.216@c59975c4`（manifest `fa93ee4c…`）已上传并按可信控制只增放行，公网 `.216/.215=200`、未知版本 `426`，完整 verifier 与独立白名单校验通过。未提审、未正式发布。
- 唯一下一任务：小米14退出重进同构建 `.216@c59975c4` 复核换班顺序/处理人、请假提示间距与禁排红字、统计七项指标与班种明细；取得同构建真机证据前不写验收通过。

## 上一已交付检查点

- 外部值班校对：生产 release `bc59dfbf`（前驱 `9715e88f`/`06d420a1`/`193ae653`）与体验版 `.215@1eb92e5` 已交付并由用户授权 add-only 放行，schema67/68 已迁移；本轮把它合并进 main 以消除主线与线上分叉。其交付记录见 [UI 轮次](audit/external-duty-ui-20260928.md)、[发布基线设计](superpowers/specs/2026-09-28-external-duty-published-baseline-design.md) 和调试日志 `EXTERNAL-DUTY-PREVIEW-001`；小米14同构建仍待用户复核。
- 通知最近30天：应用 `8bb3c6e4` / 体验版 `.212` 已在上一轮部署、上传和追加放行；文档检查点 `45bf7bec`。本轮未重新验证线上身份，不能用历史记录代替实时回滚基线。见 [通知轮次](audit/notifications-retention-30days-20260928.md)。
- 历史工作流最近30天 `.211`、联系方式 `.210`、历史显示 `.209`、日历 `.208` 等已交付记录位于 `docs/audit/` 和 Git 历史。所有缺少同构建手机证据的项目继续保持“待用户复核”；不重复历史生产操作。
- 长期事实来源：`docs/superpowers/plans/2026-08-01-medical-staff-scheduling-system-implementation-plan.md`、对应 design、`docs/agent-context/pitfall-index.json`、`docs/audit/AUDIT_MASTER_PLAN.md`。本轮是用户批准的工作流/统计整改，不进入无关后续功能。
