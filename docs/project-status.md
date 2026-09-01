# Project Status

本文档只记录当前可安全接续的事实；详细历史以 Git、`docs/audit/wechat-miniprogram-audit.md` 和精确
debug 日志为准。每轮先读 `docs/agent-context/pitfall-index.json`，只加载匹配坑位详情。

## 当前仓库批次（2026-09-02）

- 唯一任务：`MINI-G1-002` 工作台同一年 holidays 请求去重；P2 已确认并修复，修复 checkpoint
  `32467997` 已完成最终主线整合，当前只同步收口状态。
- 起始主线：`origin/main@2751f549756d890d9bfbe7be14fd4eb905977527`；用户给出的已闭环参考
  `24fce3bb90d5b64b97d57b51bb76c4ed0376e8cd` 已确认是其祖先。
- 修复分支/worktree：`codex/fix-mini-g1-002-holiday-year-dedupe` /
  `runtime/external-project-worktrees/mini-g1-002-holiday-year-dedupe-20260902`。
- 修复 checkpoint：`32467997`（`fix(miniprogram): dedupe annual workbench holidays`）；最终状态
  checkpoint：`docs(status): close MINI-G1-002 main integration`。
- fresh worktree frozen install：1,459 包本地复用、0 下载、7m43.8s；7 个 workspace packages 在本
  worktree 构建通过，锁文件未变，没有借用主工作区 dist。
- 用户脏主工作区、既有 worktree、`MINI-G1-001`、XMB、test-tools、通讯录并行成果和其他分支均未
  修改、清理或覆盖；不重跑阶段 0。

## 根因、红灯与修复

- 接口核实：`GET /holidays?year=...` 的 client/route/service/model 均按年份返回全年数据。
- 引入点：`9e3a966c` 把原 `readMonths` 唯一年份集合改成逐月 `readMonth` 年度读取；五个月窗口由
  `4300fbe7` 定义。当前 `loadActiveThenAdjacent` 又让相邻月并发，形成同年 result/in-flight 重复。
- 永久测试：`apps/miniprogram/scripts/workbench-holiday-dedupe.test.mjs`。未改业务源码时 3/3 红：
  同年 5 次；跨年 `[2026,2026,2026,2027,2027]` 且 2027 同时在途 2 次；首次失败后 retry 累计 6 次。
- 最小修复：`loadWorkbench`/`refreshWorkbenchWindow` 每个 generation 先生成唯一年份 Map，同年共享
  原始 Promise。新 generation 新建 Map，不是全局或持久缓存，失败 Promise 不会跨 retry 保留。
- 修复后：同年 `5→1`；跨年 `5→2` 且每年一次/2027 同时在途 1 次；失败后 retry 累计 `6→2`。
- 保持语义：五个月 calendar、资源顺序、每月年度结果、跨年 dates 和月格展示、活动月先 ready、相邻
  月 best-effort、错误/离线/403/24h cache、request serial、receiver、UI、接口、权限和路由均不变。

## clean checkpoint 验证

- holidays 永久合同 3/3；workbench 相关 4 files/40 tests。
- 标准 `pnpm miniprogram:test` 自动发现新文件，113 files/608 tests 全绿。
- Mini TypeScript 通过；production build 276 files。
- `pnpm miniprogram:verify` 通过：main 1,677,999B、total 5,121,436B、Worklet 2/2、matrix
  1445/1506。只有既有主包 1.5MiB 与 matrix 三项 warning，没有新增 warning 类别。
- 任务文件 Prettier、`git diff --check`、状态策略 3/3 和 `smoke:check-core` 通过。
- 真实微信 Network 次数/耗时和小米 14 性能当前工具无法测量，暂未验证；本问题由自动化收口，不要求
  用户真机复现，也不新增 test-tools。

## 精确范围与外部边界

- 业务源码仅 `apps/miniprogram/src/pages/workbench/index.ts`；永久测试仅
  `apps/miniprogram/scripts/workbench-holiday-dedupe.test.mjs`；另更新 audit 报告、audit STATUS、本文件和
  `docs/debug/debug-feedback-log.md`。
- 没有 `MINI-G1-003`/`004`、XMB、test-tools、包体/矩阵治理、API/DB、锁文件、构建产物或生产状态变更。
- 未调用微信开发者工具 GUI/CLI，未上传体验版、未提审/发布，未部署 production、未创建生产备份。

## 唯一下一任务与停止条件

修复候选验证后再次 fetch，`origin/main` 前后均为 `2751f549`；远端修复分支已建立，main 已普通快进
`2751f549 → 32467997`，没有 force push、冲突或分支保护错误。最终状态 checkpoint 复验后普通推送到
修复分支和 main；核对二者远端 SHA、工作树 clean、无未推送提交后停止。

后续唯一候选可记录为 `MINI-G1-003`；本轮不执行。
