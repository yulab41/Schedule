# 微信小程序审计状态

- 当前阶段：`MINI-G1-002` P2 已确认并修复；exact clean 修复 checkpoint `32467997` 已非强制快进到
  执行时最新主线，当前只完成最终状态同步
- 起始主线：`origin/main@2751f549756d890d9bfbe7be14fd4eb905977527`
- 已闭环参考：`24fce3bb90d5b64b97d57b51bb76c4ed0376e8cd`，已确认是起始主线祖先
- 修复分支/worktree：`codex/fix-mini-g1-002-holiday-year-dedupe` /
  `runtime/external-project-worktrees/mini-g1-002-holiday-year-dedupe-20260902`
- 修复 checkpoint：`32467997`（`fix(miniprogram): dedupe annual workbench holidays`）；最终状态
  checkpoint：`docs(status): close MINI-G1-002 main integration`
- 范围：只改工作台同一 load generation 的 holidays 年度请求计划、永久测试和四份连续性文档；
  `MINI-G1-003`、`MINI-G1-004`、XMB、test-tools、API、数据库、持久缓存、UI、权限和路由未改
- 外部状态：未调用微信开发者工具 GUI/CLI，未上传体验版、未提审/发布，未部署 production 或创建
  生产备份，未修改或清理用户主工作区和其他 worktree

## 根因与永久红灯

- `/holidays?year=...` 的 client、route、service 和 `HolidayReadModel` 均确认按年份返回全年数据。
- `git log -S`/blame 定位回归引入点为 `9e3a966c`：原本 `readMonths` 的唯一年份集合在弱网/离线硬化时
  被替换为逐月 `readMonth → client.getHolidays(year)`；五个月窗口来自 `4300fbe7`。
- 永久测试：`apps/miniprogram/scripts/workbench-holiday-dedupe.test.mjs`。未改业务源码时 3/3 红：
  - 同年 2026-07～11：holidays 实际 5 次，均为 2026；
  - 跨年 2026-10～2027-02：实际 `[2026,2026,2026,2027,2027]`，2027 同时在途 2 次；
  - 首次 500 保持原错误态，点击 retry 后可恢复，但修复前累计 6 次 holidays 请求。

## 最小修复与语义边界

- `loadWorkbench` 与 `refreshWorkbenchWindow` 各自把五个月先映射为唯一年份 Map，创建 generation-local
  `HolidayReader`；每年首个调用保存原 Promise，其他月份共享 in-flight 或已完成结果。
- 同年 holidays `5→1`；跨年 `5→2`，2026/2027 各一次且 2027 同时在途 `2→1`；失败后的显式 retry
  建立新 Map，请求累计 `6→2`，失败 Promise 不跨 generation 或永久保存。
- 五个月 calendar GET、Map 顺序、每月年度结果、跨年 dates 合并和 12 月/1 月 holiday 月格展示保持；
  活动月先 ready、相邻月 best-effort、`requestSerial`、错误/离线回退、403 清理、24h 逐月 cache、
  receiver、接口、权限、路由和 UI 均未改变。
- 真实微信 Network 次数和耗时当前工具无法测量，暂未验证；不把请求减少写成小米 14 性能提升。

## clean checkpoint 验证

| 层级                          | 结果                                                                         |
| ----------------------------- | ---------------------------------------------------------------------------- |
| holidays 永久合同             | 3/3 通过；同年、跨年/in-flight、数据/顺序/展示、失败和 retry                 |
| workbench 相关                | 4 files / 40 tests 通过                                                      |
| 标准 Mini 全量                | 113 files / 608 tests / 0 failure；标准命令自动发现永久测试                  |
| TypeScript / production build | 通过；276 files                                                              |
| clean `miniprogram:verify`    | 通过；main 1,677,999B、total 5,121,436B、Worklet 2/2、matrix 1445/1506       |
| 收口门禁                      | 任务文件 Prettier、`git diff --check`、状态策略 3/3、`smoke:check-core` 通过 |

fresh worktree 的首次 Mini TypeScript 因 7 个 workspace package dist 尚未生成而失败；在本 worktree
构建 packages 后原命令通过，锁文件未变，没有借用主工作区 dist。production verify 只有既有主包 1.5MiB
和 matrix 1445/1506 三项 warning，没有新增 warning 类别。

## 主线整合、独立状态与停止条件

- `24fce3bb` 之后的 `MINI-G1-001`、XMB、test-tools 和最新通讯录提交均保留；本轮 diff 不含这些路径。
- 修复分支完整验证后第二次 fetch：`origin/main` 前后均为 `2751f549`，没有主线漂移；修复分支和 main
  的普通推送均成功，main `2751f549 → 32467997`，没有 force push 或冲突。
- 最终状态 checkpoint 只更新四份连续性文档；复验后普通推送到修复分支和 main，并核对二者远端 SHA。

最终状态 checkpoint 远端可追溯、工作树 clean、无未推送提交后停止。下一候选可记录为
`MINI-G1-003`，本轮不执行；不上传体验版、不部署 production。
