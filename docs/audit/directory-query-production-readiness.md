# 通讯录查询 production-ready 正式化报告

日期：2026-09-02

## 结论

本轮形成两个独立交付：

1. 小程序 ASCII/数字输入改为键盘确认后搜索，中文仍在停止输入 500ms 后自动搜索。最终界面没有新增
   搜索按钮，也没有 bindblur、页面点击或键盘收起触发。该轨道已经独立进入 origin/main。
2. 服务端 candidate 查询、默认 legacy 的 feature flag、schema 52–53 兼容桥、覆盖索引迁移和隔离基准
   已在专用分支正式化。该轨道没有进入 origin/main，也没有部署、迁移或修改 production。

candidate 在相同快照和权限下通过严格零差异门禁。成对交错 40 轮中，首字母查询 main examined rows
从 36,597 降到 1,205（约 96.7%），main P95 从 78.0ms 降到 42.5ms（约 45.5%）。P95 改善明确，
但略低于“约 50%”参考值，不能写成超过该参考线。单字符和有效七级筛选明确保留 legacy。

隔离环境没有复现 production 的 9–10 秒长尾。因此准确表述仍是：

> 扫描放大和冷页回表已优化；production 长尾是否彻底消除仍需持续观察。

## Git 与范围

- 正式化基线：a4f50c0207ccb67f5ccdc78dd3912ba248fec9af。
- 服务端分支：codex/directory-query-production-ready。
- API/flag/schema 兼容桥提交：5dcb2b5ae7034aea1ad34033a38a58c9683f4b9a。
- migration/语义/基准提交：1e1084f9f38e3ebdbe7105a95c60c865215f6caf。
- 原实验分支：codex/directory-query-isolation，保留。
- 原实验与正式化 Docker volume 均保留：
  schedule_directory_query_isolation_data、schedule_directory_query_readiness_data。
- 小程序轨道只包含输入触发、提示文案和测试；不依赖实验 SQL、基准数据或迁移。
- 服务端轨道不改 API contract、响应结构、客户端 setData、客户端缓存或预热策略。

## 路由矩阵

“全部”是小程序内部筛选状态，序列化请求时会被省略；API 不接收 "all" 或 "全部" 哨兵值。

| 配置与输入 | 实际计划 |
| --- | --- |
| DIRECTORY_QUERY_PLAN 未设置、非法、读取失败 | legacy |
| DIRECTORY_QUERY_PLAN=legacy | 所有请求 legacy |
| 空查询、缺少 q 或 trim 后为空 | legacy |
| 单字符中文、ASCII 或数字 | legacy |
| q 长度至少 2，七级筛选均缺失/未选择/明确“全部” | candidate（还需迁移与索引门禁） |
| 无筛选中文姓名、拼音首字母、完整/部分拼音 | candidate |
| 无筛选工号、去前缀工号、电话、无结果 | candidate |
| 任一层级存在真实筛选值 | legacy |
| 下一页 cursor | 按同一查询条件重新选择；跨计划 cursor 已验证兼容 |
| member、owner、administrator、developer admin | 路由相同，结果按原权限过滤 |
| guest、outsider 或无权限 | 权限失败；业务 main/count 发送次数为 0 |

candidate 只有在以下两项同时满足时才可生效：

- __drizzle_migrations 计数至少为 53；
- directory_search_aliases_entry_type_normalized_idx 精确为可见、非唯一、BTREE，
  列序 (entry_id, type, normalized_value)。

任一项缺失、定义不符或检查失败都会回退 legacy、只记录非敏感告警，不向用户返回 500。每个通讯录
请求日志和诊断 Server-Timing 都记录 directoryQueryPlan=legacy/candidate，不记录搜索词、账号或群组
原值。

## 语义门禁

固定场景覆盖中文、首字母、完整拼音、工号、去前缀工号、电话、无结果、单字符、筛选、空查询、角色和
双向跨计划分页。随机差分使用 seed 17、43、89，每个 seed 26 组 API 查询，加 member/owner/admin/guest
与权限变化，共 93 组高层语义对照；其中 69 组 candidate 路径额外直接比较完整 {entryId, rank} 序列。

覆盖的字符串与分页边界包括：

- 同 rank、多 alias 命中同一人员、多个 exact alias；
- 大小写、前导零、中英文混合、空格、全角/半角、Unicode/collation 边界；
- %、_、反斜杠、引号、最大长度；
- 正好一页、超过一页一条、连续分页、发布批次切换和角色变化。

对照结果为 0 差异：entry ID 集合、顺序、rank、total、hasNext、cursor、连续分页完整结果和权限结果。
所有输入继续通过 Drizzle SQL 模板/mysql2 参数传递，没有把查询值拼接进 SQL 字符串。

## 隔离数据形态

正式化环境固定 MySQL 8.4.11、utf8mb4_0900_ai_ci、128MiB buffer pool、同 schema/索引和确定性合成
快照。当前发布人员批次约 1,200 条；整个隔离快照有 7,021 entries、7,057 contacts、128,659 aliases。

| 表 | data bytes | index bytes | 合计 |
| --- | ---: | ---: | ---: |
| directory_campuses | 16,384 | 32,768 | 49,152 |
| directory_contact_methods | 2,637,824 | 5,029,888 | 7,667,712 |
| directory_entries | 8,962,048 | 14,155,776 | 23,117,824 |
| directory_search_aliases | 43,663,360 | 65,093,632 | 108,756,992 |
| 合计 | 55,279,616 | 84,312,064 | 139,591,680（约 133.1MiB） |

新增索引为 14,254,080 bytes（约 14.25MB / 13.59MiB）。扣除它后，上述四表仍约 119.5MiB；加上它后
已经超过 128MiB buffer pool，且尚未计入数据库其他业务页和运行开销。因此页面被其他业务逐出仍是
可信的长尾触发条件，但不是已证实的 production request 级根因。

| alias type | 数量 | distinct normalized | 每人平均 alias | 重复率 |
| --- | ---: | ---: | ---: | ---: |
| source | 35,500 | 2,802 | 5.056 | 92.11% |
| pinyin_full | 31,053 | 1,554 | 4.423 | 95.00% |
| pinyin_compact | 31,053 | 1,554 | 4.423 | 95.00% |
| pinyin_initials | 31,053 | 1,235 | 4.423 | 96.02% |

## 热态成对基准

下表格式为 P50 / P95 / max ms · examined rows。legacy 与 candidate 每个场景、每轮交替先后顺序，
共 40 轮；不是先跑完整个 legacy 再跑 candidate。

| 场景 | legacy main | candidate main | legacy count | candidate count |
| --- | --- | --- | --- | --- |
| 首字母 | 55.4 / 78.0 / 80.8 · 36,597 | 31.4 / 42.5 / 56.9 · 1,205 | 52.3 / 77.3 / 81.7 · 36,592 | 29.1 / 37.1 / 43.8 · 1,204 |
| 中文姓名 | 62.5 / 76.6 / 80.5 · 36,606 | 36.5 / 46.7 / 59.8 · 1,205 | 60.5 / 84.8 / 120.5 · 36,595 | 35.0 / 42.1 / 45.4 · 1,204 |
| 完整拼音 | 68.1 / 92.3 / 96.0 · 80,014 | 29.2 / 41.8 / 49.1 · 1,205 | 69.1 / 79.0 / 91.1 · 80,007 | 28.1 / 36.8 / 46.8 · 1,204 |
| 部分拼音 | 47.4 / 62.4 / 71.2 · 66,427 | 29.5 / 41.5 / 46.5 · 1,205 | 46.0 / 63.2 / 63.8 · 66,358 | 28.7 / 38.0 / 41.6 · 1,204 |
| 精确工号 | 47.7 / 56.8 / 59.8 · 34,311 | 30.4 / 37.9 / 42.4 · 1,205 | 46.8 / 55.6 / 70.2 · 34,310 | 29.2 / 36.0 / 67.7 · 1,204 |
| 去前缀工号 | 13.6 / 19.6 / 20.8 · 3,488 | 1.4 / 1.6 / 3.0 · 4 | 12.1 / 14.4 / 16.4 · 3,487 | 1.2 / 1.4 / 3.8 · 3 |
| 电话 | 13.6 / 22.0 / 40.1 · 3,491 | 1.4 / 1.6 / 2.3 · 4 | 12.1 / 18.6 / 25.9 · 3,488 | 1.2 / 1.4 / 1.7 · 3 |
| 无结果 | 82.5 / 106.4 / 162.2 · 22,932 | 81.9 / 97.0 / 103.6 · 1,203 | 78.2 / 95.8 / 109.3 · 22,932 | 82.8 / 103.4 / 111.8 · 1,203 |
| 单字符 | 81.0 / 104.0 / 109.8 · 115,078 | 实际 legacy | 32.3 / 40.4 / 50.7 · 39,151 | 实际 legacy |
| 七级筛选 | 6.3 / 7.4 / 9.3 · 11 | 实际 legacy | 5.8 / 7.6 / 14.6 · 6 | 实际 legacy |

首字母 P95 改善约 45.5%，略低于参考 50%；examined rows 改善约 96.7%，高于参考 70%。其他主要
candidate 场景没有超过 15% 的 P95 退化。无结果 total P95 为 206.725→197.447ms；单字符直接保留
legacy，避免宽泛候选物化。

## 冷态与独立收益归因

原隔离实验的“冷态”定义是：仅针对专用 benchmark volume 停止 MySQL 进程、禁止 shutdown buffer pool
dump 和 startup load，并对 237–246 个 volume 文件执行 posix_fadvise(DONTNEED)；每轮独立执行，共
3 轮。它清除了隔离 MySQL buffer pool 并尽力驱逐该专用 volume 的 OS page cache，不涉及 production。
只重启 API 从未被称为数据库冷态。

首字母的独立对照如下：

| 方案 | cold main P50 / max | warm main P50 / P95 | examined | 解释 |
| --- | --- | --- | ---: | --- |
| legacy，无新索引 | 943.5 / 950.3ms | 97.2 / 123.2ms | 36,597 | 基线 |
| legacy，仅覆盖索引 | 291.0 / 295.0ms | 48.0 / 59.5ms | 36,597 | 减少回表/冷页读取，不解决扫描放大 |
| candidate，仅改写 | 1,018.5 / 1,023.3ms | 70.4 / 82.1ms | 1,205 | 解决扫描放大，但无覆盖索引时冷页仍重 |
| candidate + 覆盖索引 | 291.9 / 297.8ms | 25.6 / 28.1ms | 1,205 | 同时减少扫描和冷页回表 |

candidate + 覆盖索引的其他 cold main P50 / max：中文 288.3/296.9ms、完整拼音 289.3/298.6ms、
部分拼音 288.8/291.1ms、工号 288.5/289.3ms、无结果 336.2/347.3ms。对应 legacy 为
959.1/978.5、995.0/1,003.2、965.6/967.6、973.1/987.9、1,002.1/1,010.6ms。

128MiB→512MiB 的 post-pressure 对照没有形成独立明确收益：main P50 为 113.7→115.6ms，P95
139.3→120.7ms，物理读 P50 79→77。该实验是“压力后驻留”，不是全冷首查。因此 buffer pool 调整只能
作为 production 只读内存/工作集证据充足后的独立候选，不能替代查询改写或索引，也不在本轮实施。

## 混合并发

每档 120 请求，包含首字母、中文、完整/部分拼音、工号、电话、无结果、第一页/下一页、筛选和 count。
candidate 配置下实际为 72 candidate + 48 legacy。

| 并发 | legacy throughput/s | candidate throughput/s | legacy total P50/P95/P99/max ms | candidate total P50/P95/P99/max ms |
| ---: | ---: | ---: | --- | --- |
| 1 | 8.539 | 11.446 | 125.778 / 177.732 / 289.472 / 344.015 | 77.486 / 171.385 / 198.839 / 229.598 |
| 5 | 8.541 | 11.713 | 588.615 / 793.048 / 885.977 / 925.416 | 443.399 / 605.251 / 668.625 / 675.710 |
| 10 | 8.070 | 11.322 | 1,281.806 / 1,720.670 / 1,918.873 / 1,942.728 | 909.815 / 1,210.676 / 1,245.747 / 1,246.133 |
| 20 | 8.434 | 10.744 | 2,572.033 / 2,920.952 / 3,098.636 / 3,107.624 | 2,015.078 / 2,277.997 / 2,334.137 / 2,335.304 |

并发 20 MySQL CPU 为 13,992.169→10,862.980ms；connection wait P95 为 24.9→30.7ms（绝对增加
5.8ms），但吞吐提高且总 P95 下降。所有档位均为 0 错误、0 超时、0 磁盘临时表、无可解释长尾的锁等待。
candidate 混合负载产生 432 个内存临时表/120 请求，来自固定分支的派生聚合；没有磁盘临时表或无界
内存结构。

## 导入、发布与索引写放大

相同合成快照各跑 3 轮；下列为 P50，括号为有索引相对无索引变化：

| 阶段 | 无索引 | 有索引 | 变化 |
| --- | ---: | ---: | ---: |
| alias 批量插入 | 505.979ms | 627.785ms | +24.073% |
| 全量导入 | 853.700ms | 871.935ms | +2.136% |
| 发布事务 | 7.616ms | 6.556ms | -13.918%（低绝对值噪声） |
| 清理旧批次 | 597.145ms | 583.232ms | -2.330%（噪声） |
| 失败导入总回滚 | 1,243.749ms | 1,347.786ms | +8.365% |
| rollback 调用 | 410.813ms | 559.120ms | +36.101% |

搜索与导入并行时两组均 0 错误。写入 P50：data written 137,219,072→188,035,584 bytes，
redo 56,200,704→70,891,520 bytes，pages written 4,919→6,776。索引空间和失败回滚写放大是真实成本，
但在当前合成规模内没有不可接受的发布事务阻塞。

## migration 与在线 DDL

- migration：0053_directory_candidate_covering_index，使用既有 Drizzle journal。
- DDL：ALGORITHM=INPLACE, LOCK=NONE。
- 已存在且定义完全相同：安全跳过。
- 同名但列序、唯一性、类型或可见性不同：fail closed，不覆盖。
- rollback 为独立脚本；索引缺失时安全跳过，只删除精确定义匹配的索引。
- ALGORITHM=INSTANT 故意失败后索引仍不存在，随后正确重试成功，证明失败状态和重试安全。

本机 MySQL 8.4.11 在线 DDL 用时 2,357.393ms；并发读 7 次、写 62 次，均 0 错误。读延迟
P50/max 360.663/856.074ms，写 P50/P95/max 12.048/149.964/288.349ms，观测到的 pending metadata lock
最大值为 0。复用的隔离 tablespace 没观察到高于最终文件大小的临时峰值，这不能外推为 production
临时空间为 0；production 仍必须预留 DDL 空间并检查长事务和 metadata lock。

MySQL 8.4 的 CREATE INDEX 语法没有 IF NOT EXISTS，所以迁移使用 information_schema 精确检查和
prepared DDL；在线 secondary index 虽支持 INPLACE/LOCK=NONE，开始/结束阶段仍可能等待 metadata
lock。

## production 只读预检

已验证：

- 公网 https://hosp.schedule.eylinhome.top/api/health 返回 200/ready，Nginx 1.27.5。
- 公网响应没有 release header，不能据此确认 live release。

未验证：

- SSH 到 120.77.220.79:22 两次均在 SSH banner 前超时；没有任何远端命令执行。
- 因此当前实时磁盘、inode、可用内存、buffer pool、长事务、metadata lock、索引是否存在、表/索引
  大小、备份/恢复状态、live release 和 rollback candidate 均未取得。
- 历史文档最后记录的 live release 为
  a23266182122c6e2fcb5ca5aba5d8857ef781910，本报告不把它当成本轮实时核验结果。

本轮没有 production 写入、EXPLAIN ANALYZE、索引、迁移、缓存清理、重启、配置修改、备份或部署。

## 分阶段上线与回滚

上线建议必须拆成批准明确的阶段：

1. 部署仅支持 flag/candidate、但默认和实际值均为 legacy 的 API 兼容桥；数据库仍可为 schema 52。
2. 验证 API 行为、日志和健康完全未变。
3. 获取新的 production 只读预检和当次迁移批准后，部署 migration 0053；flag 保持 legacy。
4. 核对 schema 53、索引精确定义、DDL 状态、磁盘、长事务、metadata lock 和 legacy 健康。
5. 在受控观察窗口把 flag 切到 candidate。跨计划 cursor 已零差异，因此不需要随机账号路由或分页
   session 粘滞；不得在同一请求内随机选计划。
6. 观察 main/count P50、P95、P99、最大值、错误率、超时、磁盘临时表和导入发布。
7. 再决定是否长期启用。

回滚顺序：

1. 立即把 flag 切回 legacy；
2. 验证 API 与查询恢复；
3. 保留新增索引，停止故障扩大；
4. 只有确认稳定且无其他依赖后，才在独立维护窗口执行 rollback/DROP INDEX。

紧急回滚不先 DROP INDEX。schema 52–53 兼容桥使迁移后仍可回滚应用版本。正式 release 打包前仍须从
服务器实时 live release 读取 rollback candidate；本轮 SSH 未取得该值，因此没有生成可部署 release。

production 成功标准：

- 首字母 mainQuery 不再出现超过 1.5 秒的长尾；
- 正常查询 P95 明显改善，错误率不升高；
- 分页、rank 和权限无差异；
- 导入发布没有不可接受退化；
- legacy 随时可恢复。

## 验证与已知阻塞

- feature flag/plan/timing/release controls：5 files / 75 tests 通过。
- MySQL 8.4.11 migrations：1 file / 24 tests 通过。
- 通讯录真实数据库组合：1 file / 11 tests 通过。
- Mini：113 files / 608 tests 通过。
- 全仓 lint、typecheck、production build、任务文件 Prettier、shell syntax 和 diff check 通过。
- 全仓非数据库 Vitest：241 files / 1,158 tests 通过，37 files / 362 数据库项按环境跳过；另有 2 个
  与本轮无关的 Web 日期 fixture 在 2026-09-02 把 2026-09-01 视为过去而失败。本轮未修改这些文件。
- pnpm smoke:browser：首次因 5173 未启动停止；按 runbook 启动当前源码 API/Web 并把本地开发库从
  schema 49 迁移到 53 后，登录与管理员工作台成功，但连续两次被既有“筛选排班” Sheet 内
  .t-select 5 秒可见性断言阻断。本轮没有 Web/UI 变更；临时服务已按执行 session 停止。

剩余不确定性：

- production 9–10 秒长尾的发生率和是否彻底消失，只能在真实灰度后判断；
- 当前 production 主机资源、schema/index 和 rollback candidate 未实时核验；
- 在线 DDL 的 metadata lock 和临时空间必须在正式窗口重新预检；
- buffer pool 调整没有隔离环境的明确独立收益，不建议本轮实施。
