# 微信小程序与通讯录审计状态

- 当前阶段：服务端 candidate 处于“production 上线前最后门禁”，结论 NO-GO；未合并、部署、迁移、
  建索引、备份或启用 candidate。
- 最新远端：`origin/main=07decdbbf8bd4eaf7c34077392aea3b1fbc4eac2`；已进入主线的小程序请求
  收敛 SHA `a4f50c0207ccb67f5ccdc78dd3912ba248fec9af` 仍是其祖先。
- 服务端分支：`codex/directory-query-production-ready`；本轮起点
  `09156b67fc7a7687ae763efb4ef0736256c472ac`。
- 详细证据：`docs/audit/directory-query-production-readiness.md`。

## 已完成的门禁补强

- 0053 以 `_journal.json` tag/when 和数据库 `id + created_at + SQL SHA-256` 精确关联；索引仍要求精确
  名称、列序、非唯一、可见、BTREE。migration 数量不再代替身份。
- readiness 为每 API 实例 60 秒 TTL，同一刷新并发合并；未知、失败和过期检查均 fail closed。
- 0053 session MDL 等待上限 5 秒；部署迁移总上限 300 秒。隔离阻塞试验在有界时间失败、无残留，
  释放锁后安全重试。
- `DIRECTORY_QUERY_PLAN` 是启动时全局开关，production Compose 默认 legacy；trusted switch 在 release
  lock 下原子更新、重建和逐实例核对。不是部分用户灰度，多主机未协调时禁止 candidate。
- 阶段 1 source-only manifest 证明 0053 不在精确 SHA `5dcb2b5a…` 的 archive；阶段 2 在最终 checkpoint
  后生成。两者都不是可部署产物。

## 当前阻塞

- 本轮唯一一次 production SSH 仍在 banner exchange 前超时，远端命令数 0。live release、rollback、
  磁盘/inode、内存/swap、MySQL tmp/TempTable/buffer pool、长事务/MDL、索引和备份恢复均没有实时值。
- 两个日期 fixture 仍失败；root `pnpm verify` 包含它们。既有 Web smoke 仍被排班筛选 Sheet 断言阻断。
  两者都不属于 directory candidate，必须由独立提交处理；仓库没有已批准的 production 豁免。
- production 临时表配置和内存余量未知；隔离 432 个内存临时表/120 混合请求不能代替生产证据。

## 唯一下一任务与停止条件

专用分支本轮 checkpoint 普通推送后停止。必须先恢复稳定 production 管理通道、取得完整实时只读
预检，并处理或明确批准独立测试红灯，才可重新形成 go/no-go。未获得用户下一次明确授权前，不合并
服务端分支、不生成 deployable artifact、不部署、不备份、不迁移、不建/删索引、不改 production 配置、
不启用 candidate、不上传小程序，也不删除实验 volume 或 runtime 证据。
