# Project Status

## 当前 release-candidate 批次（2026-09-02，阶段 2 已部署；candidate 未启用）

- production 实际源码为阶段 2
  `50ac2d07a3412c6d76a3494b1150868276f4781c`；直接 rollback candidate 为阶段 1
  `cc43e8c82424617303a4b2f3b2d9119f66a91eb2`，两份 immutable release 均保留并由 verifier 核对。
- 在 release lock 下先创建加密备份 `80de252f-cbb3-4c02-86d3-765dffb7130c`：daily、55 表、205,991 行、
  91,279,360B。随后 0053 成功写入精确 journal identity，并创建可见非唯一 BTREE
  `directory_search_aliases_entry_type_normalized_idx(entry_id,type,normalized_value)`；schema 为 53。
- API/Web 重建后两个 502 预热探针内恢复；远端完整 verifier 与独立公网 Web/health、`.78`、`.76`、
  未知版本 426 均通过。production 仍为单主机、单 API/MySQL/Web；MySQL 未重建，长事务、pending MDL
  和 active DDL 均为 0。
- production 配置未显式写入查询计划，阶段 2 Compose 注入的实际容器值为
  `DIRECTORY_QUERY_PLAN=legacy`。可信 plan-switch 工具已安装，但本轮没有调用 candidate；candidate
  全局切换仍是独立审批和回滚单元。
- 部署打包开始后 `origin/main` 从 `07decdbb…` 前进到
  `d1594d09a52bc1e3810dfa6ae41e4a3e3dde52d0`；新增提交只涉及 `EXP-UX-001` Mini 与文档，不含 API、
  migration、配置或部署脚本。production 仍精确记录获批源码 `50ac2d07…`，没有自动重部署新主线。
- `0.1.0-p10.20260902.79@d1594d0` 已从 detached clean production profile 经官方 Node
  `miniprogram-ci` 上传（191 code files、zip 2,451,655B、manifest `fe2acd36…a10f0`）。production
  allowlist 已按用户独立授权由可信 add-only 工具追加；API/Web 重建时首个 TLS reset 在 1/30 内恢复，
  随后 allowlist verify、完整 ECS verifier、`.79` 七项能力、`.78` 兼容和未知版本 426 均通过。
- 旧 `codex/directory-query-production-ready@70f14ce6` 未改写，实验 volume/runtime 证据和阶段 1/2 本地
  发布证据均保留。`.79` 现在可供 Xiaomi 14 体验验收；candidate 全局切换仍等待独立授权，不自动执行。
- 阶段 2 部署状态 checkpoint 为 `d4bbab34 docs(release): record directory stage2 deployment`；本轮
  allowlist 状态 checkpoint 以 `docs(audit): record .79 allowlist activation` 识别。两个 docs SHA 都不是
  production 或 Mini 源码 SHA，不因文档提交再次操作 production。

本文档只记录当前可安全接续的事实；详细历史以 Git、`docs/audit/wechat-miniprogram-audit.md` 和精确
debug 日志为准。每轮先读 `docs/agent-context/pitfall-index.json`，只加载匹配坑位详情。

## 最近已完成 Mini 批次（2026-09-02，非当前任务）

- 唯一任务：`MINI-G1-003` 排班配置轮转数字输入的岗位×成员全量重建；状态为
  `P2，逻辑层性能问题已确认并修复；真机可见卡顿未直接确认`。
- 起始主线：`origin/main@a4f50c0207ccb67f5ccdc78dd3912ba248fec9af`；执行前 fetch 后无 SHA 漂移。
- 修复分支/worktree：`codex/fix-mini-g1-003-scheduling-input` /
  `runtime/external-project-worktrees/mini-g1-003-scheduling-input-20260902`。
- checkpoint 识别信息：`fix(miniprogram): localize scheduling rotation input updates`。
- fresh worktree frozen install：1,459 包本地复用、0 下载、7m49.3s；7 个 workspace packages 在本
  worktree 构建通过，锁文件未变，没有借用主工作区 dist。
- 用户脏主工作区、既有 worktree、`MINI-G1-001/002`、XMB、test-tools、通讯录并行成果和其他分支均未
  修改、清理或覆盖；不重跑阶段 0。

## 根因、红灯与修复

- 引入点：`38233039` 初次实现 P8 scheduling config 时，让 `handleRotationInput` 的标量草稿更新复用
  `createRoleCards`，导致每字符遍历所有岗位、复制/排序每岗全部群组成员并完整回传 `roleCards`。
- 依赖核实：每天人数/当前位置只影响 `_rotationDrafts`、目标显示和最终保存 payload；起始日期同样不
  影响成员。它们不改变成员归属、岗位/成员排序、卡片数或 picker 成员列表。成员选择/移动确实改变
  关系，继续使用完整重建；班种输入和其他页面未处理。
- 永久测试扩展 `apps/miniprogram/scripts/p8-organization-c2-controller.test.mjs`。夹具名称纠正后，在未改
  业务源码时纯净目标合同 3 项红；既有读取/创建和必要成员重建 3 项保持绿。
- 修复前同一字符：4×2 为 1 次 `setData`/`roleCards`/2,476B/4 次排序/8 个成员视图复制；4×100 为
  1 次/`roleCards`/53,364B/4 次排序/400 个成员视图复制，payload 增长 50,888B、复制增长 392。
- 最小修复：保留原 `_rotationDrafts` 和 `toPositiveInt`，按稳定 `roleId` 当场查当前索引，只更新
  `roleCards[index]` 的目标字段；岗位缺失/未知字段保留旧全量回退。没有 debounce、缓存或架构改造。
- 修复后 4×2/4×100 均为 1 次精确路径 `setData`、41B，排序/岗位/成员数组/成员视图重建与增长均为 0。
- 保持语义：目标卡片立即显示；连续输入取最后值；空串/非法值仍为 1；没有新增失焦处理；原提示不
  被清除；保存使用最新值；重排卡片后仍按稳定 ID 更新正确岗位；其他岗位/成员及成员关系操作不变。

## 最终候选验证

- 永久 controller 合同 6/6；所有含 scheduling-config 的相关测试 16 files/75 tests。
- 标准 `pnpm miniprogram:test` 自动发现扩展文件，113 files/612 tests 全绿。
- Mini TypeScript 通过；production build 276 files。
- `pnpm miniprogram:verify` 通过：main 1,677,998B、total 5,121,615B、Worklet 2/2、matrix
  1445/1506。相对未改基线 total +179B、organization +180B；main -1B 为元数据噪声；只有既有三项
  warning，没有新增依赖或 warning 类别。
- 任务文件 Prettier/ESLint、`git diff --check`、状态策略 3/3 与 `smoke:check-core` 通过；未触及 Web
  核心链路，无需 `pnpm smoke:browser`。
- 真实微信 bridge/帧率和小米 14 可见卡顿当前工具无法测量，暂未验证；自动化已足以收口逻辑问题，
  不要求用户真机复现，也不新增 test-tools。

## 精确范围与外部边界

- 业务源码仅 scheduling-config panel controller；永久测试扩展现有 P8-C-2 controller 文件；另更新
  audit 报告、audit STATUS、本文件和 `docs/debug/debug-feedback-log.md`。
- 没有 `MINI-G1-004`、XMB、test-tools、班种输入、API/DB、权限、路由、视觉、排班规则、锁文件、
  构建产物或生产状态变更。
- 未调用微信开发者工具 GUI/CLI，未上传体验版、未提审/发布，未部署 production、未创建生产备份。

## Mini 轨道既有停止条件

最终 tip 全量验证后再次 fetch。若主线漂移，语义整合并复跑受影响测试、Mini 全量、verify、状态策略和
core smoke；修复分支可先普通推送，main 只做一次最终普通 fast-forward，不 force push。核对远端 SHA、
工作树 clean、无未推送提交后停止。

Mini 轨道后续候选可记录为 `MINI-G1-004`；它不是当前 release-candidate 批次，本轮不执行。
