# Project Status

当前可接续状态；历史以 Git、docs/audit/ 及精确 debug 记录为准。

## 当前批次（2026-09-05）

- `WARM-UPLOAD-GUARD-001`（RUN_ID `warm-upload-guard-20260905154545`）发布工具修复及体验上传已完成，原生层待用户复核。
- 独立兼容提交 `c25fcf43a01e7f5d27a59856891387b0fe918228`，message：
  `fix(release): align upload checker with leased worktree layout`；普通 push 成功，上传前后 fetch 均确认该主线。
  未改写/amend 应用修复 `cdb759b9d8781dc01749f103d2d30d346689121d`；两者均可从 origin/main 追溯。
- 根因 `LATENT_COMPATIBILITY_GAP_EXPOSED`：76a572a3 写死旧 release 目录，4602120b 使用项目内 warm 池；
  `.88` 源码 84dc966e 到 cdb759b9 的 pool/checker/helper 零 diff，ef6885d0/d10db9fe 未修改布局/schema/checker。
- 详情：`docs/audit/warm-upload-guard-20260905154545.md`。原有根工作区 10 组未跟踪内容完整保留。
  实时租约、最终 Git 和释放事实在 ignored `runtime/codex/tasks/warm-upload-guard-20260905154545.json`。

## 实现与验证

- 正式 checker/helper 共用候选核心，接受有效、独占、真实 warm 子槽位及有时限 upload 用途。
  根工作区、无租约/异主/失效/普通开发、别名/联接/越界、脏树/错 SHA/非 detached、混用输出仍拒绝。
  真实 CI 前后强制复核；原子操作锁、不可变版本占用和 manifest 绑定加强门禁，无 force/skip 或旧路径伪装。
- 先红后绿：helper3、CI门禁2、路径/过期及 Git 基线分配器负例已复现并修复。
  Node工具81、root定向25（含allowlist5）、Mini上传工具30，共136项通过；包含真实文件篡改拒绝。
  目标 lint/JS/PS 语法、官方 format:check、smoke:check-core、仓库 Skill validator 均通过。
- 真实新租约 Acquire → ReuseOnly → Mini Bootstrap → 定向验证通过；3 producer 复用、安装0。
  正式 helper/PS checker 在 c25fcf43 上通过 clean/detached/upload 正例，且对版本绑定输出再次通过。
- 应用 src tree `f505883d01359db826c7a181009e3b98e7ad22e4` 与 cdb759b9 完全一致；Web/packages/依赖输入也无 diff。
  复用已有 **789 passed / 11 conditional skipped**，未重跑业务全套。新候选 Mini typecheck、trial-lineage 审计通过。
- 新版本 production 构建、source/package、performance、determinism、真实 CI dry-run、manifest/专属输出校验通过。
  主包1.5M预警及600格矩阵节点 best-effort 预警保留，无阻断；桌面逻辑测量不当作真机性能。

## 已上传的精确身份

- 动态版本 **`0.1.0-p10.20260905.89`**，源码 **`c25fcf43a01e7f5d27a59856891387b0fe918228`**，clean production。
  描述 `feedback-toast-switch-c25fcf4`；官方成功回执时间 `2026-09-05T09:56:18.409Z`。
- Manifest `df43c76b82c975f812dd726d49e666822b40ee27d8d63e7cc1f69d67dfc68047`；330文件，
  主包1,761,110 bytes，总包5,212,766 bytes。receipt/原子分配/绑定manifest/新dist/归档dist/远端tag一致。
- 首次平台明确 `-10008 invalid ip` 拒绝，无成功回执；确认不可变身份后，使用仓库既有进程级 IPv4 + 单域名 NO_PROXY 路由重试。
  **未重新构建、未改版本或manifest、未关闭TLS**，幂等重试成功；`.88` 及其manifest未修改。
- 精确 add-only allowlist ensure/verify 与完整 installed production verifier 均通过，应用 live release 前后仍为
  `48488019171924701054354e8f707b08eb4d12fe`。只刷新 API/Web 配置，未部署应用或数据库、未备份或迁移。
  verifier 按既有脚本跳过未配置 ECS_PUBLIC_IP 的主动公网IP探测；不冒称该项验证通过。
- 官方 CI 返回成功并绑定上传参数；平台未提供独立可查询的服务端manifest，不宣称服务端逐字节哈希或 Xiaomi14 验收通过。

## 并行与后续边界

- B0 `57d11d70c242f36cdd5e3ef055e1e432829d22e2` 已安全整合，未修改其活动文件、借用租约或依赖。
  Skill-only d10db9fe/ef6885d0 的独立修改保留；本轮安装0。
- 一次性 B2 交接结论为 `P0_NOT_COVERED_OR_PARTIAL`：本轮未重做 latest-trial 受限等价证明模型。
  现有策略未完整绑定 latest ledger/exact trial/candidate/proof-set，不能以136项兼容测试声称完整P0已验收。
  本次 c25fcf43 直接包含 `.88` 和 cdb759b9，不使用非祖先例外；不接管P1/P2。

## 唯一下一任务与停止条件

- 本轮停止自动实现；下一步仅由用户在 `.89@c25fcf4` 体验版复核顶部胶囊背景、换班开关、请假通知和排班配置开关。
  未收到同构建 Xiaomi14 证据前，状态保持“待用户复核”。不自动进入B2或其他批次。
- 上传租约已释放；必要收口文档使用新独占 warm lease，完成轻量文档校验和普通 push 后释放。
  收口校验：`pnpm exec vitest run scripts/agent-context-policy.test.mjs scripts/test-discovery-policy.test.mjs --fileParallelism=false`
  为6通过；目标Markdown格式、`pnpm smoke:check-core`和`git diff --check`通过，只有4份必要Markdown变化。
  文档 checkpoint message：`docs(release): record verified feedback trial upload`；最终 hash 以 Git/ignored task state 为准。
  该 checkpoint 仅记录已冻结上传事实，不重建或重传 `.89`。
- 未提审、未正式发布、未部署ECS应用代码、未部署数据库、未执行数据库迁移、未宣称 Xiaomi14 真机验收通过。
