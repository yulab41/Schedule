# Schedule 依赖安装性能审计与可复用 worktree 环境

日期：2026-09-03

审计层级：本地静态检查、Windows 进程/磁盘采样、Node/Vitest/TypeScript/build 自动化

排除范围：production、生产备份、数据库迁移、小程序上传、微信开发者工具 GUI/CLI

## 结论

当前 8–13 分钟的主阶段是 pnpm 的 package import/link，而不是 resolve、下载或 lifecycle build。
短路径当前配置冷装的 490.069 秒中，463.403 秒（94.6%）落在 `importing_started` 至
`importing_done`。1,459 个包全部命中 store，1,454 个使用 hardlink、仅 5 个使用 copy，下载为 0，
lifecycle 事件为 0。`MsMpEng` 在 B 组有明显并发 CPU/I/O，但 C 组 Defender 活动显著降低而总时间
仍为 463.881 秒，因此 Defender 是可见放大器，不是单独根因；本轮没有关闭 Defender 或设置排除项。

项目、全部 worktree 和 pnpm store 都位于 E: NTFS。不存在 C:↔E: 跨盘导入；抽样文件的
`fsutil hardlink list` 同时列出 `E:\.pnpm-store\v11\files\...` 和多个 worktree 目标。旧 worktree
最深实测路径 294 字符，短池槽为 220 字符；Windows long paths 已启用，Git `core.longpaths` 未设置。
短槽仍耗时 490 秒，故长路径至多是次要放大因素。

最有效的修复不是优化一次冷装，而是取消重复冷装：正常 L1 路径现在是

`取得 general-1 → 依赖指纹/健康检查 → 跳过 install → profile 增量 bootstrap → 定向测试`。

## 环境与 pnpm 布局

| 项目                                       | 实测值                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------- |
| Node                                       | `v24.14.0`                                                                |
| pnpm                                       | `11.9.0`                                                                  |
| 仓库                                       | `E:\AItools\Schedule`，E: NTFS                                            |
| pnpm store                                 | `E:\.pnpm-store\v11`，E: NTFS                                             |
| `pnpm config get storeDir`                 | `undefined`                                                               |
| `pnpm config get nodeLinker`               | `undefined`；`.modules.yaml` 实际为 `isolated`                            |
| `pnpm config get packageImportMethod`      | `undefined`；NDJSON 实际为 1,454 hardlink + 5 copy                        |
| `pnpm config get enableGlobalVirtualStore` | `undefined`；正式布局为 worktree-local `.pnpm`                            |
| `pnpm config get virtualStoreType`         | `undefined`                                                               |
| `pnpm config get sideEffectsCache`         | `undefined`；两组冷装均无 lifecycle 事件                                  |
| `pnpm config get recursiveInstall`         | `undefined`；NDJSON `selected=14,total=14`，根 install 覆盖整个 workspace |
| workspace 数量                             | 14（root + 13 个 workspace project）                                      |

`pnpm-workspace.yaml` 的 `allowBuilds` 只允许 `esbuild: true`。`@parcel/watcher`、`@swc/core`、
`core-js-pure`、`less`、`protobufjs`、`vue-demi` 明确为 false。B/C 的 `pnpm:ignored-scripts`
均为空且没有 `pnpm:lifecycle*` 事件，所以 1,459 是 resolve/store/import 进度数量，不是执行了
1,459 个 build script。`sideEffectsCache` 没有显式配置；本次只证明没有产生可见的 lifecycle
阶段，不能从现有日志把“side-effects cache 命中”与“本次无需执行脚本”进一步拆开，故单独效果标为
暂未验证。

## 三组受控基准

物理 `pnpm install` 总数严格为 3：先 B、再 A、最后 C。全部位于仓库外 E: 短路径，命令均为
`--frozen-lockfile --offline --config.strictDepBuilds=false --reporter=ndjson`；C 只额外传入
`--config.enableGlobalVirtualStore=true`，没有修改仓库或用户级 pnpm 配置。

| 指标                         |             A warm / current |                       B cold / current |                           C cold / GVS |
| ---------------------------- | ---------------------------: | -------------------------------------: | -------------------------------------: |
| worktree                     |    `E:\ScheduleWT\general-1` |                                   同左 |               `E:\ScheduleWT\perf-gvs` |
| pnpm execution time          |                       0.535s |                               490.069s |                               463.881s |
| resolve 事件跨度             |                   无阶段事件 |                                 0.740s |                                 0.794s |
| store 命中跨度               |                   无阶段事件 |                                 2.450s |                                 1.818s |
| import stage                 |                            0 |                               463.403s |                               452.806s |
| import 后至 summary          |                            0 |                                25.761s |                                10.131s |
| resolved / reused / imported | 0 / 0 / 0（直接 up to date） |                     1459 / 1459 / 1459 |                     1459 / 1459 / 1459 |
| download                     |                            0 |                                      0 |                                      0 |
| import method                |                           无 |                 1454 hardlink / 5 copy |                 1454 hardlink / 5 copy |
| lifecycle build              |                            0 |                                      0 |                                      0 |
| worktree-local 新增          |                            0 | 约 65,274 文件 / 13,894 目录 / 617.7MB |         214 文件 / 1,250 目录 / 1.50MB |
| GVS 首建额外写入             |                       不适用 |                                 不适用 | 约 65,060 文件 / 15,331 目录 / 616.7MB |
| pnpm CPU 平均/峰值           |          低于 1 秒采样分辨率 |                           7.48% / 127% |                          13.99% / 156% |
| Defender CPU 平均/峰值       |               低于采样分辨率 |                         65.84% / 1144% |                          11.07% / 167% |
| E: busy 平均/峰值            |               低于采样分辨率 |                        572.40% / 1829% |                        537.34% / 1965% |
| E: 平均 read/write           |               低于采样分辨率 |                    96.6KB/s / 2.97MB/s |                   107.7KB/s / 2.10MB/s |

Windows 的 CPU 与 disk busy 格式化计数可因多核和并发队列超过 100%，适合组间比较，不等同于
单核或单设备百分比。A 在 0.535 秒内退出，首个 1 秒采样晚于进程结束，因此 CPU/I/O 标为当前工具
无法测量，而不是填 0。

B/A 的 pnpm 本体成功后，初版后处理器分别在 StrictMode 可选字段和单 PID HashSet 展开处失败；
完整 NDJSON、stderr 和采样 CSV 已在失败前写入，未重跑安装。两个边界已修复，C 的
`Measure-Command` 摘要完整成功。原始证据位于已验证 ignored 的
`runtime/local/dependency-audit/2026-09-03/`，关键 SHA-256：

- B NDJSON：`4CC2F07D...AC5612`；B samples：`5943AF29...A5975`。
- A NDJSON：`6B306712...E13EFD`。
- C NDJSON：`5F3BD4AF...135B5`；C measurement：`9B66BF1E...B309`。

## 依赖指纹与健康门禁

`scripts/codex/ensure-worktree-deps.ps1` 调用跨平台 Node core，并把 marker/lock 放在当前 worktree
自己的 Git 私有目录。marker 不进入 Git，只保存相对输入、内容哈希和非敏感环境事实；绝对 store
路径只进入 SHA-256，不写 marker。

指纹输入：

- `pnpm-lock.yaml`、`pnpm-workspace.yaml`、根及 pnpm 实际枚举的全部 workspace `package.json`；
- `.npmrc`、`.pnpmfile.*`、`pnpmfile.cjs` 与 `patches/**`（只保存哈希，不读取到报告）；
- Node、pnpm、OS release、architecture、store path hash/volume；
- storeDir、nodeLinker、packageImportMethod、enableGlobalVirtualStore、virtualStoreType、
  sideEffectsCache、recursiveInstall 的有效配置读数。

明确不包含 conversation、branch、commit、origin/main、普通业务源码或 mtime。真实槽位从
`411399e7` 切到父 SHA `a2326618`，以及切到包含 API/Mini 业务差异但无依赖输入差异的
`32bc0b19`，均保持同一指纹 `e7e51b49...373e3` 并输出 `DEPENDENCIES_REUSED=true`、
`DEPENDENCIES_INSTALLED=false`。

健康检查验证 `.modules.yaml`、eslint/prettier/tsc/vitest 根 executable、store 可读、virtual store
布局、pnpm 版本，以及所有 `workspace:*` 链接精确指向当前 worktree 的 producer。根
`node_modules` 为 junction/reparse point、stale workspace link 或现存 install lock 均失败关闭。
原子 lock 覆盖 reuse/check/install；安装失败或安装后健康失败都不会更新 marker。自动命令只允许一次
frozen/offline 增量 install，不使用 `--force`，不删除 store。

测试证明 lockfile/manifest/pnpm hook/patch/layout/Node/pnpm/平台/store 变化会报告具体 reason 并调用
一次 install；真实 manifest check-only 探针报告 `input:package.json:changed` 且没有安装。显式
`-AdoptHealthyExisting` 只允许“marker 缺失且完整健康”的一次迁移。

## Workspace bootstrap 指纹

共享 producer 为 contracts、database、presentation-core、scheduling-domain、client-core、
test-fixtures、ui-tokens；它们的 `main`/`types`/`exports` 指向 `dist`。Mini 的 Node/Vitest 收集需要
contracts、client-core、presentation-core；API 还需要 database、scheduling-domain、test-fixtures。

`scripts/codex/ensure-workspace-bootstrap.ps1` 对每个 producer 计算 `src/**`、`scripts/**`、
`package.json`、`tsconfig*.json`、根 `tsconfig.base.json`、上游 producer 指纹、Node 与 TypeScript
版本；marker 同时保存所有 dist 与现有 `.tsbuildinfo` 的哈希。指纹和输出哈希一致时不构建，缺失、
损坏、源码/tsconfig/上游变化时只按拓扑重建受影响 package。

真实 clean `general-1` 结果：

- Mini 首次只构建 contracts → client-core 与独立 presentation-core，10.349s；第二次三包全复用，
  4.411s，database/scheduling-domain/test-fixtures/ui-tokens 未被构建。
- API 首次复用 contracts，只构建 database、scheduling-domain、test-fixtures，10.634s；第二次四包
  全复用，4.530s。
- root-typecheck profile 只补建 ui-tokens；随后 release profile 七个 producer 全复用。

## 长期 worktree 池

最小并发需求为一个普通开发任务，因此正式池只登记 `E:\ScheduleWT\general-1`。它是 detached、
Git clean、依赖兼容、worktree-local `node_modules`，对话结束保留。`perf-gvs` 仅为受控实验树，
完成最终 SHA 验证后移除；GVS 的共享 links 不删除。

`scripts/codex/manage-worktree-pool.ps1` 提供 Initialize/Acquire/Release/Status/ClearOutputs：

- 默认从仓库所在卷计算短路径池，不提交 E: 绝对配置；拒绝跨卷或嵌套 worktree。
- Acquire 先筛 free + clean，再按依赖 `compatible=true` 优先；以 `FileMode.CreateNew` 创建本地租约。
- 同槽位第二次 Acquire 的真实探针失败关闭；Release 必须 token 匹配且 worktree clean。
- 不运行 `git clean`。ClearOutputs 的 allowlist 仅含 app/infra/test dist，不含 packages dist 或
  `node_modules`。
- 不允许多个槽位共享同一可写 `node_modules`；stale/wrong-target workspace 链接也不能入池。

## Global virtual store 结论

GVS 技术兼容通过，但没有启用。C 组首次创建 `E:\.pnpm-store\v11\links`，本地 node_modules 很小，
但全局 links 仍首次写入约 65k 文件。C 的观测时间比 B 少 26.188 秒（5.34%），但两组 Defender
活动不同，因此这是两次独立测量，不能归因成 GVS 性能提升。受三次物理安装上限约束，没有再创建
第四个 worktree 测 GVS warm link graph，也不把推断当实测收益。

在同一 GVS 安装上通过：

- Mini 定向 3 files/7 tests；日期 fixture 稳定后完整 110 files/562 tests；
- API 根入口 46 files/172 tests，33 files/324 tests 因未配置隔离数据库明确跳过；
- root typecheck（10 workspace）、production build、直接 Node ESM imports；
- release helper/import 与 cache 测试 2 files/14 tests；
- `node scripts/smoke-browser.mjs --check-core` 的 Node 模块解析路径。

包内 `@schedule/api test` 因既有根 Vitest `src/**` 在 package cwd 排除了全部文件而返回 no tests；
改用仓库根 API 入口完成实际覆盖。Mini 全量最初暴露一个 2026-08 fixture 依赖真实月份的既有测试，
local 布局同样 1/6 失败；引入点 `4de2cd91`。按现有 duty/swap 模式固定测试时钟后 local 6/6、
GVS full 562/562，通过且未改业务代码。

随后 root 全量还暴露 Web duty/swap 两个同类真实日期漂移：2026-09 fixture 在 2026-09-03 已被
业务规则判为过去。引入点分别为 `5d8b205a` 与 `b20ff9b8`；共享函数原本就提供 `now` 注入，四个
测试调用改为显式传 2026-08-25 reference。旧实现 2/11 失败，修改后 11/11 通过；最终 root
248 files/1,177 tests 通过、37 files/355 tests 按数据库环境跳过，业务实现不变。

鉴于固定池的正常路径完全不调用 pnpm install，而 GVS 没有得到可归因的冷装收益，本轮不修改
`pnpm-workspace.yaml`、不升级 pnpm、不更换 nodeLinker、不把 GVS 用于正式 release。未来若允许一组
新的物理安装预算，可只补测“已有 links 的第二个新 worktree”；在此之前正式方案保持固定 worktree +
本地 node_modules + 同盘 store。

## 验收矩阵

| 条件                       | 证据                                                             |
| -------------------------- | ---------------------------------------------------------------- |
| 相同指纹新任务不 install   | pool Acquire：reused=true、installed=false                       |
| 另一源码 SHA 不 install    | `a2326618` 与 `32bc0b19` 实测同指纹复用                          |
| 仅业务源码变化不 install   | `32bc0b19` 包含 API/Mini 变化且依赖输入差异为 0                  |
| lock/manifest 改变触发一次 | 单测验证 install spy=1；真实 manifest check-only 输出精确 reason |
| Node/pnpm 变化失效         | 单测覆盖两项环境字段                                             |
| 失败不伪造 marker          | 受控安装失败单测，marker 不存在且 lock 释放                      |
| 工作树 clean               | general-1 最终 clean；实验补丁已反向移除                         |
| worktree 不嵌套            | 两个实验路径均为 `E:\ScheduleWT` 直接子项                        |
| 不共享可写 node_modules    | pool 检查根 reparse point；workspace link 精确目标检查           |
| 三组真实耗时               | A 0.535s / B 490.069s / C 463.881s                               |
| 主耗时有证据               | B import stage 463.403s、download/lifecycle=0                    |
| L1 正常路径                | Acquire → deps reuse → profile bootstrap → targeted tests        |

## 变更文件与语义边界

- 新增 `scripts/codex/` 下依赖 wrapper/core、bootstrap wrapper/core、pool manager、安装测量器与三组测试。
- 修改 `scripts/prepare-release-worktree.mjs` 及测试：保留原 detached/clean/exact-commit 检查和输出，
  只把依赖判断委托给环境感知门禁，并把真正 miss 的安装固定为 frozen/offline。旧 marker 仅用于一次
  健康 adoption；同步错误仍失败关闭，不改变 checkout 目标或构建/发布调用次数。
- 更新 root/skill guardrails、worktree/bootstrap reference、本地 setup、pitfall index/detail、项目状态
  和本报告；性能 raw evidence 仍 ignored，不进入 Git。
- 稳定 3 个日期 fixture 测试文件。只注入固定 `Date`/`now`，不改生产代码；receiver、异步/catch、
  空值、类型收窄、副作用与业务调用次数均不变。

没有修改 package manifest、lockfile、pnpm 主线配置、业务 API/数据结构/路由、数据库或生产配置。

## Worktree 清单

实验树移除后共 40 个登记 worktree，其中 25 个 complete。健康定义为 `.modules.yaml`、四个根
executable 和全部 `workspace:*` 链接存在且精确指回该 worktree；只有 `complete` 可直接作为依赖
候选。状态是收口审计时快照，主树的 task/user diff 在 checkpoint 时会显式拆分。

| Path                                                                                                      | Len | HEAD       | Branch                                                   | Status         | node_modules |
| --------------------------------------------------------------------------------------------------------- | --: | ---------- | -------------------------------------------------------- | -------------- | ------------ |
| `E:/AItools/Schedule`                                                                                     |  19 | `411399e7` | `codex/schedule-project-guardrails`                      | dirty T13/U918 | complete     |
| `E:/AItools/Schedule/runtime/audit/preupload-correction-5fff288f`                                         |  63 | `5fff288f` | `detached`                                               | clean          | complete     |
| `E:/AItools/Schedule/runtime/audit/preupload-correction-7952f1d1`                                         |  63 | `7952f1d1` | `detached`                                               | clean          | complete     |
| `E:/AItools/Schedule/runtime/debug-worktrees/mini63`                                                      |  50 | `57e10cdc` | `detached`                                               | clean          | partial      |
| `E:/AItools/Schedule/runtime/debug-worktrees/mini64`                                                      |  50 | `712aa4ee` | `detached`                                               | dirty T2/U0    | complete     |
| `E:/AItools/Schedule/runtime/debug-worktrees/same-version-18498a8`                                        |  64 | `18498a8b` | `detached`                                               | dirty T1/U0    | complete     |
| `E:/AItools/Schedule/runtime/debug-worktrees/test-tools-attribution-docs`                                 |  71 | `fa876731` | `codex/test-tools-attribution-docs`                      | clean          | missing      |
| `E:/AItools/Schedule/runtime/directory-release-6b5b30fb`                                                  |  54 | `6b5b30fb` | `detached`                                               | clean          | complete     |
| `E:/AItools/Schedule/runtime/experience-worktree-mini-g1-001-003-20260902`                                |  72 | `07decdbb` | `detached`                                               | clean          | complete     |
| `E:/AItools/Schedule/runtime/external-project-worktrees/diagnostics-test-tools-skyline-cleanup`           |  93 | `1218f9c3` | `codex/diagnostics-test-tools-skyline-cleanup`           | clean          | partial      |
| `E:/AItools/Schedule/runtime/external-project-worktrees/diagnostics-test-tools-skyline-integration`       |  97 | `fe6b036a` | `codex/diagnostics-test-tools-skyline-integration`       | clean          | partial      |
| `E:/AItools/Schedule/runtime/external-project-worktrees/diagnostics-test-tools-skyline-integration-final` | 103 | `d23a78a9` | `codex/diagnostics-test-tools-skyline-integration-final` | dirty T1/U0    | partial      |
| `E:/AItools/Schedule/runtime/external-project-worktrees/directory-query-isolation`                        |  80 | `41104305` | `codex/directory-query-isolation`                        | dirty T0/U13   | partial      |
| `E:/AItools/Schedule/runtime/external-project-worktrees/directory-query-production-ready`                 |  87 | `70f14ce6` | `codex/directory-query-production-ready`                 | clean          | complete     |
| `E:/AItools/Schedule/runtime/external-project-worktrees/directory-query-release-candidate-20260902`       |  97 | `5627ee50` | `codex/directory-query-release-candidate`                | clean          | complete     |
| `E:/AItools/Schedule/runtime/external-project-worktrees/directory-search-confirm-integration`             |  91 | `a4f50c02` | `codex/integrate-directory-search-confirm-20260902`      | clean          | complete     |
| `E:/AItools/Schedule/runtime/external-project-worktrees/execution-policy-closure-20260902`                |  88 | `5cb5eb8a` | `codex/execution-policy-closure-20260902`                | clean          | missing      |
| `E:/AItools/Schedule/runtime/external-project-worktrees/exp-calendar-003-20260902`                        |  80 | `8e6a4a32` | `codex/exp-calendar-003-20260902`                        | clean          | complete     |
| `E:/AItools/Schedule/runtime/external-project-worktrees/exp-feat-002-event-records`                       |  81 | `0792ed01` | `codex/exp-feat-002-event-records`                       | clean          | complete     |
| `E:/AItools/Schedule/runtime/external-project-worktrees/exp-icon-004-audit`                               |  73 | `5d40b189` | `codex/exp-icon-004-audit`                               | clean          | partial      |
| `E:/AItools/Schedule/runtime/external-project-worktrees/exp-icon-004-full-20260903`                       |  81 | `5285dd17` | `codex/exp-icon-004-full-20260903`                       | clean          | complete     |
| `E:/AItools/Schedule/runtime/external-project-worktrees/exp-ux-001`                                       |  65 | `359966f7` | `codex/fix-exp-ux-001`                                   | clean          | complete     |
| `E:/AItools/Schedule/runtime/external-project-worktrees/exp-ux-002`                                       |  65 | `48488019` | `codex/fix-exp-ux-002`                                   | clean          | partial      |
| `E:/AItools/Schedule/runtime/external-project-worktrees/mini-g1-001-lifecycle-20260901`                   |  85 | `2a856725` | `codex/fix-mini-g1-001-lifecycle`                        | clean          | complete     |
| `E:/AItools/Schedule/runtime/external-project-worktrees/mini-g1-001-main-integration-20260902`            |  92 | `24fce3bb` | `codex/integrate-mini-g1-001-main-20260902`              | clean          | complete     |
| `E:/AItools/Schedule/runtime/external-project-worktrees/mini-g1-002-holiday-year-dedupe-20260902`         |  95 | `a4f50c02` | `codex/fix-mini-g1-002-holiday-year-dedupe`              | clean          | complete     |
| `E:/AItools/Schedule/runtime/external-project-worktrees/mini-g1-003-scheduling-input-20260902`            |  92 | `07decdbb` | `codex/fix-mini-g1-003-scheduling-input`                 | clean          | complete     |
| `E:/AItools/Schedule/runtime/external-project-worktrees/mini-g1-004-evidence-audit-20260902`              |  90 | `e7ec0617` | `codex/mini-g1-004-evidence-audit-20260902`              | clean          | complete     |
| `E:/AItools/Schedule/runtime/external-project-worktrees/preupload-diagnostics-correction`                 |  87 | `eb36d70f` | `codex/preupload-diagnostics-correction`                 | clean          | complete     |
| `E:/AItools/Schedule/runtime/external-project-worktrees/release-gate-maintenance-20260902`                |  88 | `5f564b8b` | `codex/release-gate-maintenance-20260902`                | clean          | complete     |
| `E:/AItools/Schedule/runtime/external-project-worktrees/Schedule-member-permissions`                      |  82 | `1dee8a34` | `detached`                                               | dirty T24/U0   | complete     |
| `E:/AItools/Schedule/runtime/external-project-worktrees/Schedule-p10-directory`                           |  77 | `389be7b8` | `codex/p10-directory-implementation`                     | clean          | missing      |
| `E:/AItools/Schedule/runtime/external-project-worktrees/Schedule-p10-preflight`                           |  77 | `4ed5085c` | `codex/p10-parity-preflight`                             | clean          | missing      |
| `E:/AItools/Schedule/runtime/external-project-worktrees/static-audit-group1-20260901`                     |  83 | `4ddaa38e` | `codex/audit-static-state-async-list-20260901`           | clean          | complete     |
| `E:/AItools/Schedule/runtime/external-project-worktrees/test-tools-devtools-acceptance-d23a78a`           |  93 | `d23a78a9` | `detached`                                               | clean          | partial      |
| `E:/AItools/Schedule/runtime/external-project-worktrees/test-tools-finalization`                          |  78 | `e1d215d3` | `codex/finalize-test-tools-skyline`                      | clean          | missing      |
| `E:/AItools/Schedule/runtime/external-project-worktrees/test-tools-semantic-finalization`                 |  87 | `a1f052c6` | `codex/finalize-test-tools-skyline-semantic`             | clean          | partial      |
| `E:/AItools/Schedule/runtime/external-project-worktrees/test-tools-upload-d23a78a`                        |  80 | `d23a78a9` | `detached`                                               | clean          | partial      |
| `E:/AItools/Schedule/runtime/release-worktree`                                                            |  44 | `5285dd17` | `detached`                                               | clean          | complete     |
| `E:/ScheduleWT/general-1`                                                                                 |  23 | `411399e7` | `detached`                                               | clean          | complete     |
