# 通讯录查询 release-candidate 前移与正式门禁报告

日期：2026-09-02

## 结论与边界

正式测试红灯已在独立维护提交中清除，服务端 candidate 已从最新主线重新形成两阶段 source-only
候选。旧分支 `codex/directory-query-production-ready` 和历史审计 SHA
`70f14ce68520cda0c40976583b02edc063597fdb` 均未改写；原实验 volume、readiness volume 和 runtime
报告也未删除。

当前仍是 **production NO-GO**。本轮按用户边界没有连接 production，没有生成 deployable release，
也没有部署、备份、迁移、建索引、修改配置、启用 candidate 或上传小程序。唯一剩余生产阻塞是：
管理通道恢复后取得一次低频、实时、只读 preflight；历史 release/resource 值不能代替该结果。

## 最新主线差异

两次 fetch 均确认最新主线为
`07decdbbf8bd4eaf7c34077392aea3b1fbc4eac2`。`a4f50c0207ccb67f5ccdc78dd3912ba248fec9af`
到该 SHA 只有一个提交：

`07decdbbf8bd4eaf7c34077392aea3b1fbc4eac2 fix(miniprogram): localize scheduling rotation input updates`

| 分类                          | 文件与结论                                                               |
| ----------------------------- | ------------------------------------------------------------------------ |
| Mini 业务                     | `scheduling-config-panel/controller.ts`：轮转标量输入改为局部更新        |
| Mini 测试                     | `p8-organization-c2-controller.test.mjs`：性能与行为合同                 |
| 文档                          | Mini audit STATUS、audit 报告、debug log、project status                 |
| API / migration / 配置 / 部署 | 无变化                                                                   |
| Web                           | 无变化                                                                   |
| candidate 冲突                | 无服务端路径冲突；candidate 查询和 0053 文件前移后与 `70f14ce6` 字节一致 |

因此旧 `5dcb2b5a` 或 `70f14ce6` 虽仍以主线旧 SHA 为祖先，却会遗漏上述 Mini 业务修复、对应永久测试和
最新状态文档；同时保留日期、format、browser smoke 三个正式红灯及旧 source-only 基线，不能直接作为
最终 release 来源。

旧分支相对最新主线独有提交按拓扑顺序为：

1. `5dcb2b5a`：candidate API、flag、schema 52 兼容桥；
2. `1e1084f9`：0053、索引 readiness、语义和隔离基准；
3. `09156b67`：历史 docs-only 状态；
4. `70f14ce6`：migration/flag/source-only hardening 与历史状态文档。

新分支选择性移植 1、2 和 4 的非历史文档路径；3 与 4 中已过期的状态文档没有进入新候选。

## 正式测试门禁清理

### 日期 fixture

干净最新主线稳定复现两个失败：

- `duty adjustment flow logic > builds my shifts, admin shift options, and overtime member options`；
- `swap flow logic > builds my assignments, target options, and per-target assignment lists`。

`git log -S`/blame 定位到 `5d8b205a` 与 `b20ff9b8`。生产 helper 已支持显式 `now`，失败只因 Web spec
省略该参数，使固定 2026-09-01 数据随自然日期过期。提交
`ba7d37939a26c4aca56cd1499bb675b6d48af033 test(web): freeze workflow candidate clocks`
只修改三份测试，固定 UTC 时钟并增加中国时区 08:00 的跨月、跨年边界；3 files / 17 tests 通过，
未改排班业务逻辑或 directory candidate。

### Format

`format:check` 是 `pnpm verify` 和 GitHub Verify 的强制门禁。干净最新主线原样失败的 12 个文件为：

1. `apps/miniprogram/testing/p8-organization-rc-plan.json`
2. `apps/web/src/stories/miniprogram/p9-insights-web-golden.spec.ts`
3. `apps/web/src/stories/miniprogram/p9-visitor-access-golden.spec.ts`
4. `apps/web/src/stories/miniprogram/P9InsightsWebGolden.stories.ts`
5. `apps/web/src/stories/miniprogram/P9InsightsWebGolden.vue`
6. `apps/web/src/stories/miniprogram/P9VisitorAccessGolden.stories.ts`
7. `apps/web/src/stories/miniprogram/P9VisitorAccessGolden.vue`
8. `packages/client-core/src/testing/insights-api-golden.ts`
9. `packages/client-core/src/visitor-access-read-client.spec.ts`
10. `apps/miniprogram/scripts/client-core-calendar-boundary.test.mjs`
11. `apps/miniprogram/scripts/p10-directory-native.test.mjs`
12. `apps/miniprogram/scripts/p8-organization-rc-plan.test.mjs`

提交 `071549f4b2bf503c4a914124df89b9ea52ba9f1c style: normalize release-gate fixtures` 只有 Prettier
机械格式化；没有业务变化。全仓 `format:check` 随后通过。

### Browser smoke

`.t-select` helper 由 `af37f5e4` 引入。当前失败不是过时 selector、Sheet 未打开、节点被动画遮挡或产品
故障：本地当前月的 roles、shift types、members 和 assignments 都为 0，页面按 `v-if` 正确不渲染
下拉框；原 smoke 错把“当前月必有数据”当作不变量。统计 sticky 检查也量到了空态 `colspan` 行，
不是实际数据行。

提交 `5f564b8b4e9cf0c3e411fc11a44c035a1f9f387c test(web): stabilize smoke empty-month fixtures`：

- 当前月有 select 时仍验证 popup 位于打开的 Sheet；无 select 时验证所有月内日期为明确空态；
- 排班详情和统计 sticky 改用仓库固定的 2026-08 有数据 fixture，并等待真实语义状态；
- 不增加固定 sleep、长 timeout、skip 或产品 Web 改动；
- smoke 证据固定写入 ignored `runtime/smoke/`，并有 artifact policy 测试。

真实浏览器最终通过登录、管理员、成员、访客 vkey 与访问记录全流程，无浏览器错误。

## 强制发布门禁矩阵

| 检查             | production 强制门禁 | 真实调用链                                                                                      | 当前状态                                                                        |
| ---------------- | ------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| root Vitest      | 是                  | `pnpm verify` → `pnpm test`；GitHub Verify 的 Build and run tests                               | PASS；246 files / 1,170 passed；无 DB env 的标准运行另有 37 files / 364 skipped |
| `format:check`   | 是                  | `pnpm verify` 第一项；GitHub Verify 并行质量检查                                                | PASS；原 12 文件已独立 format-only 修复                                         |
| `smoke:browser`  | 是                  | `docs/testing/verification.md` 的 release standard；独立命令，不在 `pnpm verify`/CI workflow 内 | PASS；真实浏览器全流程通过                                                      |
| lint             | 是                  | `pnpm verify`；GitHub Verify 并行质量检查                                                       | PASS                                                                            |
| typecheck        | 是                  | `pnpm verify`；GitHub Verify 并行质量检查                                                       | PASS                                                                            |
| production build | 是                  | `pnpm verify` → `pnpm build`；GitHub Verify                                                     | PASS；API/Web/Mini production build 通过，Mini 276 files                        |
| migration tests  | 是                  | root Vitest 在 GitHub MySQL service 下发现并执行                                                | PASS；本地 MySQL 8.4.11 显式 25/25，包括 MDL timeout/零残留/重试                |

GitHub workflow 额外要求的 `.github/**/*.yml`、`docs/deployment/**/*.md` Prettier 和 production
Compose `config --quiet` 和落账后的 `smoke:check-core` 也已通过。

## 新 release-candidate

维护分支：`codex/release-gate-maintenance-20260902`

- `ba7d37939a26c4aca56cd1499bb675b6d48af033` 日期时钟；
- `071549f4b2bf503c4a914124df89b9ea52ba9f1c` format-only；
- `5f564b8b4e9cf0c3e411fc11a44c035a1f9f387c` browser smoke。

服务端分支：`codex/directory-query-release-candidate`

| 阶段 | 精确业务来源                               | 内容                                                                                                                            |
| ---- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `cc43e8c82424617303a4b2f3b2d9119f66a91eb2` | 最新主线 + 维护提交 + API/flag/schema 52–53 兼容桥；最高 migration 0052，无 0053 SQL，源码默认 legacy；本轮无 production 实际值 |
| 2    | `50ac2d07a3412c6d76a3494b1150868276f4781c` | 阶段 1 + candidate + 0053 + exact identity/index/cache/MDL/flag/source hardening；默认仍 legacy                                 |

candidate 查询、query-plan、0053/rollback、schema 和 migration identity 文件与历史审计
`70f14ce6` 字节一致，前移未改变 SQL。定向 8 files / 85 tests、真实 migration 25/25、真实 directory
12/12 通过；后者含 seed 17/43/89、多角色、双向跨计划 cursor 和错误门禁，语义差异为 0。

fresh-current 0053 的本地 MySQL 8.4.11 关键 smoke 为 20 轮成对交错；首字母 main examined rows
88,098→1,205，P95 53.4ms→32.0ms，0 error；中文/完整拼音走 candidate，有效七级筛选仍走 legacy。
该数字只证明前移没有破坏候选路由和主要计划，不替代历史完整隔离实验，更不是 production 或小米 14
实测。旧 readiness volume 的 0053 journal 保存 hardening 前 SQL hash，新 guard 正确 fail-closed；旧 volume
未改写。另用全新独立 volume 从当前 migration fresh apply 后完成 smoke，随后恢复旧容器健康，两份证据
都保留。

## Source-only manifest

两张 manifest 均从精确 Git object 读取，连续生成两次字节一致；`deployable=false`、未生成构建制品、
未读取 production live release/rollback。

| 阶段 | release SHA                                | manifest SHA-256                                                   | production source tree SHA-256                                     | migration                                             |
| ---- | ------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ | ----------------------------------------------------- |
| 1    | `cc43e8c82424617303a4b2f3b2d9119f66a91eb2` | `58ccbf6117b9db71134f2cdbd2f8032db9b8d71bc2f575ae47fd453604912cb7` | `8e4d576c5ee3a626140a7b42337b3bce8261f4a893459480bc46587c6f200780` | 52 entries；最高 0052；无 0053；updater 不可执行 0053 |
| 2    | `50ac2d07a3412c6d76a3494b1150868276f4781c` | `7626ed3753e7bc5d16147c980cd72ae2b80b94190cc92ae8707cc2dca0d6f0ea` | `bf0c688928665fe3d269759cdab600230b26c9bbdc52f3544f505c139cd407ec` | 53 entries；精确 0053 hash；updater 可执行 0053       |

阶段 2 虽跟踪 8 个 readiness harness 文件，但 production archive allowlist 不含
`scripts/directory-query-readiness/` 或 `runtime/`。旧 manifest 继续作为历史证据，明确不可部署。

## 上线观测归因

- candidate 与 legacy 的 main/count SQL 结构不同，应在受控时间窗从
  `performance_schema.events_statements_summary_by_digest` 读取各自归一化 `DIGEST`/`DIGEST_TEXT`，并用
  `COUNT_STAR`、`SUM_ROWS_EXAMINED`、`SUM_CREATED_TMP_TABLES`、`SUM_CREATED_TMP_DISK_TABLES`、
  `SUM_TIMER_WAIT` 和 `MAX_TIMER_WAIT` 形成按 digest 的窗口增量。只保存结构指纹和数值，不保存关键词。
- 应用日志的 `directoryQueryPlan=legacy/candidate` 与 request ID 给出同窗口各计划请求数和应用阶段耗时；
  数据库 digest 用结构白名单对应计划。当前没有 request ID 到单条 Performance Schema digest 的严格
  一对一链路，因此只允许做同窗口聚合归因，不把相关性写成单请求因果。
- 全局 `Created_tmp_disk_tables` 只作实例健康兜底；正式归因必须用 plan-specific digest 增量，并从全局
  增量扣除/区分其他业务 digest，不能把全局变化全部归给通讯录。
- 一个观察窗口不足 100 个 candidate 请求时，不计算百分比成功结论，也不扩大 candidate；延长受控
  窗口或保持 legacy。单个重复 >5s、错误、磁盘临时表或连接 acquisition timeout 仍可触发保守回滚。
- digest、应用 plan 日志或资源观测不可用时，启用前 fail closed 保持 legacy；已启用时按全局受控切换
  回 legacy。管理通道不可用则这一步本身为 BLOCKED，不得宣称可回滚。
- 隔离候选临时 payload `4–8MiB` 与连接池/临时表配置推导的 `480MiB` 都是估算，不是 production 实测
  或严格内存上界。production tmp/TempTable 配置和内存余量必须由下一次实时只读 preflight 获取。

## 修订后的 PASS / BLOCKED

| 项目                                                      | 状态    | 证据                                                                               |
| --------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------- |
| 正式测试红灯                                              | PASS    | 日期、12 文件 format、browser smoke 各自独立提交；所有强制本地门禁已绿             |
| 0053 精确身份与索引定义                                   | PASS    | unit/integration/真实 migration；journal hash 与可见非唯一 BTREE 三列精确校验      |
| schema readiness 缓存                                     | PASS    | 实例单例、60s TTL、同窗 Promise 合并、过期/失败 fail closed、实例重建/显式 refresh |
| 隔离 MDL 有界失败与重试                                   | PASS    | session lock wait 5s；25/25 migration 测试证明零残留和安全重试                     |
| production updater 实际 DDL 恢复                          | BLOCKED | 未连接 production，未运行 updater/migration                                        |
| flag 脚本与失败恢复                                       | PASS    | trusted switch/release control 测试通过；缺失/非法/读取失败为 legacy               |
| production 实际切换耗时                                   | BLOCKED | 代码 health 上限不是 production 测量                                               |
| production 实际中断时间                                   | BLOCKED | 未执行全局切换                                                                     |
| SSH 不可用时的回滚可执行性                                | BLOCKED | 管理通道未恢复即不能宣称可操作                                                     |
| 单一 Compose project 控制逻辑                             | PASS    | 同一 env、全 API force-recreate、逐实例校验的脚本测试通过                          |
| production 主机数量                                       | BLOCKED | 本轮禁止连接，实时拓扑未知                                                         |
| production API 实例数量                                   | BLOCKED | 本轮禁止连接，实时拓扑未知                                                         |
| production 全实例一致性                                   | BLOCKED | 未在真实拓扑执行                                                                   |
| 临时表归因方法                                            | PASS    | plan-specific digest 指标、应用 plan 窗口和全局兜底口径已冻结                      |
| production 临时表/内存余量                                | BLOCKED | tmp/TempTable、连接上限、内存余量无本轮实时值                                      |
| 阶段 1 source-only 产物                                   | PASS    | 精确 SHA、最高 0052、无 0053、deterministic、non-deployable                        |
| 阶段 2 source-only 产物                                   | PASS    | 精确 SHA/0053、deterministic、non-deployable；harness/runtime 排除                 |
| production 管理通道                                       | BLOCKED | 按用户要求本轮未重试 SSH                                                           |
| live release 与 rollback                                  | BLOCKED | 不用历史 SHA 代替实时值                                                            |
| production 磁盘、inode、内存、MDL、schema/index、备份状态 | BLOCKED | 等待一次实时只读 preflight                                                         |

## 唯一下一步与停止条件

保持 NO-GO。只有用户明确通知 SSH 或等价管理通道恢复后，才执行一次低频只读 preflight，取得 live
release、精确 rollback、主机/API 拓扑、磁盘/inode、内存/swap、buffer pool、tmp/TempTable、连接上限、
schema/journal/index、长事务、pending MDL、表/索引大小、备份和恢复工具状态。该批全部实时可读后才
重新判断是否可生成 deployable release；当前不提供生产执行批准建议。
