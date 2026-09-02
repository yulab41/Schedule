# Project Status

## 当前 release-candidate 批次（2026-09-02，阶段 1 已部署；阶段 2 NO-GO）

- production 实际源码为阶段 1
  `cc43e8c82424617303a4b2f3b2d9119f66a91eb2`；直接 rollback candidate 为部署前 live release
  `a23266182122c6e2fcb5ca5aba5d8857ef781910`，两份 immutable release 均由 verifier 核对。
- 部署前创建加密数据库备份 `155c2560-ef5d-4acf-90d1-a24158e6e1ee`：daily、55 表、205,864 行、
  91,237,728B。阶段 1 归档最高 migration 0052；updater 的 migration 步骤为空跑，部署后 schema 仍为
  52、目标索引仍不存在、API 实际 `DIRECTORY_QUERY_PLAN=legacy`。
- 远端完整 verifier 与独立公网 Web/health/capability/未知版本 426 均通过；production 拓扑为单主机、
  单 API/MySQL/Web。MySQL 未重建；API/Web 在内置健康等待后恢复。
- SSH 根因为 VPN/TUN：正式域名解析到 `198.18.0.43`，必须使用正式域名、既有 `aliyun_schedule` 私钥和
  严格 host-key 校验；直连真实 IP 会在 banner 前超时。
- 阶段 2 业务/迁移来源仍为 `50ac2d07a3412c6d76a3494b1150868276f4781c`，只有 source-only 证据；本轮
  没有执行 0053、建索引、启用 candidate、调整 MySQL 配置或上传 Mini。旧
  `codex/directory-query-production-ready@70f14ce6` 未改写，实验 volume/runtime 证据保留。
- 唯一下一批次：等待用户对阶段 2 migration/index 的另一次明确批准；即使以后部署阶段 2，也必须先
  保持 legacy，迁移和 candidate 全局切换仍是不同审批/回滚单元。
- 本轮状态 checkpoint 以 `docs(release): record directory stage1 deployment` 识别；该 docs SHA 不是
  production 源码 SHA，不因文档提交再次操作 production。

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
