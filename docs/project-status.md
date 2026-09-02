# Project Status

本文档只记录当前可安全接续的事实；详细证据见 Git、
`docs/audit/directory-query-production-readiness.md` 与精确 debug 记录。每轮先读 pitfall index，只加载
匹配详情。

## 当前仓库批次（2026-09-02）

- 当前任务：服务端 directory candidate 进入 production 上线前最后门禁补强；不合并 main、不部署、
  不迁移、不改 production。
- 本轮 fetch 后 `origin/main=07decdbbf8bd4eaf7c34077392aea3b1fbc4eac2`；小程序请求收敛基线
  `a4f50c0207ccb67f5ccdc78dd3912ba248fec9af` 是其祖先，没有分叉。
- 服务端分支/worktree：`codex/directory-query-production-ready` /
  `runtime/external-project-worktrees/directory-query-production-ready`；本轮起点与远端均为
  `09156b67fc7a7687ae763efb4ef0736256c472ac`。
- 阶段 1 精确来源仍为 `5dcb2b5ae7034aea1ad34033a38a58c9683f4b9a`；其 migration 最高为 0052，
  不可能由 updater 自动执行 0053。
- 用户脏主工作树及其中 project.config、群组设置、UI 草稿和其他未提交文件没有被修改、暂存、重置
  或更新。

## 本轮门禁补强

- API 不再用 migration 总数判断 0053；现在精确校验 journal 正整数 id、
  `created_at=1785542400053`、当前 SQL SHA-256，以及索引名称、列序、非唯一、可见、BTREE 定义。
- readiness 是 API 实例级 60 秒 TTL；同一刷新并发合并，过期/失败不沿用旧 true。迁移后由全部 API
  实例重建立即刷新，未重建实例最多 60 秒重新检查。
- 0053 设置 session `lock_wait_timeout=5` 秒；trusted updater 有 300 秒独立总迁移超时和四类非敏感
  失败分类。隔离 MDL 阻塞时约 5 秒失败、索引不残留，释放锁后安全重试成功。
- production Compose 显式传递 `DIRECTORY_QUERY_PLAN`，默认 legacy。新增受 release lock 保护的全局
  切换工具；它原子更新 env、重建并核对全部 Compose API 实例。当前不是部分用户灰度，多主机编排
  未实现时不得启用 candidate。
- source-only dry-run 工具不构建 tar/zstd、不生成 deployable artifact。阶段 1 source tree hash 为
  `5bd3192b230a4becab2798f410574692159489b8123d67c789642c00a5559bce`；阶段 2 在最终 checkpoint 后
  生成。benchmark、合成数据、Docker volume 和 runtime 证据不进入 production archive allowlist。

## 临时表与资源边界

- 隔离环境：`tmp_table_size=max_heap_table_size=16MiB`、`temptable_max_ram=1515364023B`、
  `temptable_max_mmap=0`、max connections 151；API 单实例 pool 上限 10。
- candidate 的 72 个实际 candidate 请求产生 432 个内存临时表、0 磁盘临时表；main/count 顺序执行。
  当前数据规模的逻辑 payload 粗估约 4–8MiB，但配置硬上界可达约 480MiB，不能据此放行 production。
- production tmp/TempTable、连接、CPU 和内存实时值未取得；观察/回滚阈值已冻结在 readiness 报告。

## 验证与已知红灯

- 精确 identity/cache/flag/release/source-only 单元门禁和 directory 数据库组合通过；MDL 阻塞/重试定向
  测试通过。任务 TypeScript typecheck 与 shell `bash -n` 通过。
- migration 全文件本轮首次执行有 2 个既有测试因本机 MySQL 短时变慢触发 5 秒 Vitest timeout；数据库
  恢复后按同一命令重跑为 1 file / 25 tests 全绿，其中 MDL 阻塞/失败/重试用例约 6.3 秒完成。
- 两个 Web 日期 fixture 本轮仍失败；从 a4f50c0 到 origin/main@07decdbb 无相关文件变化。root
  `pnpm verify` 包含这两个测试，因此属于正式发布红灯，只能由独立非-directory 提交修复。
- 既有 `pnpm smoke:browser` 仍停在“筛选排班” Sheet `.t-select` 可见性断言；没有 Web/UI diff，不能
  在 directory candidate 提交中掩盖。

## production 状态与停止条件

- 本轮唯一一次 SSH 仍在 banner exchange 前超时，远端执行命令数为 0。实时 live release、rollback、
  磁盘/inode、内存/swap、MySQL tmp/TempTable/buffer pool、长事务/MDL、索引和备份恢复状态均未知。
- 历史 live release 不作为实时值；当前总判定为 NO-GO。
- 本轮没有上传小程序、部署或修改 production、创建备份、运行 production migration/DDL/EXPLAIN、
  切换 release/flag、重启、清缓存或删除实验 volume/runtime 证据。
- 本轮 checkpoint 以 `hardening(directory): close production preflight gaps` 识别并普通推送专用分支后
  停止。下一步只有在 production 管理通道恢复、实时预检完整且独立测试红灯处理后，才能重新形成
  go/no-go；仍需用户当次明确批准任何部署、备份、迁移、索引或 candidate 操作。
