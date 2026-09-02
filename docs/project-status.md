# Project Status

本文档只记录当前可安全接续的事实；详细证据见 Git、docs/audit/directory-query-production-readiness.md、
docs/audit/wechat-miniprogram-audit.md 和精确 debug 日志。每轮先读 pitfall index，只加载匹配详情。

## 当前仓库批次（2026-09-02）

- 当前任务：通讯录输入请求收敛已进入主线；服务端 candidate 查询与覆盖索引完成 production-ready
  正式化，停在专用分支等待下一次批准。
- 执行时最新基线：origin/main@a4f50c0207ccb67f5ccdc78dd3912ba248fec9af。
- 服务端分支/worktree：codex/directory-query-production-ready /
  runtime/external-project-worktrees/directory-query-production-ready。
- API/flag/schema 兼容桥：5dcb2b5ae7034aea1ad34033a38a58c9683f4b9a。
- migration/语义/基准：1e1084f9f38e3ebdbe7105a95c60c865215f6caf。
- 原实验分支/worktree 和 volume 均保留，不删除 runtime 证据。
- 用户脏主工作树和其中未提交的 project.config.json、群组设置、UI 草稿及其他文件未修改、暂存或重置。

## 小程序轨道

- 原 41104305 只包含 Mini 输入行为和对应测试，不依赖实验 SQL/基准数据；选择性整合后的功能提交为
  9585f9c0。曾加入的可见按钮由 2751f549 正向撤除，最终净状态没有按钮。
- 中文（含单字）继续静默 500ms 自动搜索；ASCII、数字、拼音首字母、完整拼音、工号和电话仅由
  confirm-type=search + bindconfirm 进入同一 handler。空输入、连续确认、timer 清理、in-flight/
  completed 复用和旧响应隔离均有回归。
- 当前 clean 拟上传源码为 origin/main@a4f50c0207ccb67f5ccdc78dd3912ba248fec9af。候选元数据仅作
  dry-run：0.1.0-p10.20260902.77@a4f50c0，描述 p10-directory-confirm-a4f50c0，manifest
  f193af947efc9339741f323db16374dcf31306ef2bb4617729108848e6a8c8ec。未查询占用历史、未分配、未上传。

## 服务端正式化

- DIRECTORY_QUERY_PLAN 仅支持 legacy/candidate，默认和任何非法/读取失败均 legacy。
- candidate 只处理长度至少 2、无有效七级筛选的查询；空查询、单字符和真实筛选继续 legacy。
- migration count≥53 且覆盖索引精确定义匹配后 candidate 才可生效；否则非敏感告警并回退，不返回 500。
- migration 0053 精确创建 (entry_id,type,normalized_value)，INPLACE/LOCK=NONE；独立 rollback 只删除
  完全匹配的索引。release 兼容桥声明 schema 52–53，支持先部署 legacy API、后迁移和应用回滚。
- 3 个随机 seed 共 93 组 API 语义、69 组直接 rank、双向跨计划分页、角色/权限均 0 差异。
- 成对 40 轮首字母 main examined 36,597→1,205，P95 78.0→42.5ms；改善明确但低于约 50%参考。
- 并发 20 throughput 8.434→10.744/s、total P95 2920.952→2277.997ms，0 error/timeout/disk temp。
- 索引 14,254,080B；alias insert P50 +24.073%、全量导入 +2.136%、失败导入回滚 +8.365%。
- 在线 DDL 本机 2357.393ms，读 7/写 62 均 0 error，pending MDL 最大 0；不外推 production。

## 验证与已知基线问题

- plan/env/timing/release 5 files/75；migration 24；directory DB 11；Mini 113 files/608 全绿。
- root lint/typecheck/build、任务文件 Prettier、bash syntax、diff check 通过。
- root Vitest：241 files/1158 通过，37 files/362 DB 项按环境跳过；2 个既有 Web 日期 fixture 因
  2026-09-02 将 2026-09-01 视为过去而失败，本轮未改这些文件。
- 全仓 format:check 仍被 12 个基线文件阻断；本任务文件全部格式通过。
- 运行/浏览器验证：pnpm smoke:browser 在本地 API/Web 登录和管理员工作台后，连续两次被既有
  “筛选排班” Sheet .t-select 5 秒可见性断言阻断；本轮无 Web/UI diff，临时 3000/4173 服务已停止。

## production 边界与下一步

- 公网 health 当前 200；SSH 两次在 banner 前超时，零远端命令。实时磁盘/inode/内存、buffer pool、
  长事务/MDL、索引、备份、live release 和 rollback candidate 未取得。
- 本轮没有上传、production 部署/配置/迁移/索引/缓存清理/重启、生产备份或 release 切换。
- 服务端分支完成普通推送后停止。下一步只能是用户分别批准：
  1. 小程序候选上传；或
  2. production 第一阶段 legacy API 兼容桥部署。
- 任何 production 阶段前必须先恢复只读 SSH 预检并从服务器实时 live release 读取 rollback candidate。
  不把历史 checkpoint 当作回滚来源。
