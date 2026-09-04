# 微信小程序审计状态

## 当前阶段

- 当前批次：用户已明确批准的 `EXP-ICON-004-LINEAGE-B1` 已先红后绿实现；正在形成 checkpoint 并整合执行期间
  前进的主线。按批准边界，本批不修改生产图标、不创建真实 tag、不上传或操作 production。
- 实施/完整验证基线：`origin/main@a1bba5710cfd5c94b5fd5148898e4f17e45faab9`；结束前最新主线已前进到
  `75cc0d3b82dbe03fa1923e0c091b805872603ff8`，须在 checkpoint 后人工合并。独立 worktree 为
  `runtime/external-project-worktrees/exp-icon-004-lineage-b12-20260903`。
- 详细证据和结论见 `docs/audit/exp-icon-004-trial-lineage-and-b12.md`；设计见
  `docs/superpowers/specs/2026-09-03-exp-icon-004-b12-and-trial-lineage-design.md`。

## 已验证事实

- `.84` exact profile 为 `0.1.0-p10.20260903.84@8e6a4a3`；它不是 `.83@5285dd1` 的后继，缺少
  `1ffab10c` 和 `5285dd17`，因此用户截图所见不是图标修复候选。
- `.75` 曾未严格包含原 `.74` 支线；`.76` 已恢复并取代其行为。当前主线 test-tools 三个关键 blob 与 `.76`
  相同，不需要移植旧 `.74` commit。
- `.74` 存在末尾序号多 SHA，`.81/.82` 存在同一完整版本多 SHA；`.77` 只 dry-run 未上传。旧上传 helper
  没有中央版本占用或 ancestor gate，allowlist 又只识别版本字符串，无法发现同号 payload 覆盖。
- B1 实施期间并行 G1-004 任务通过旧流程上传并放行 `0.1.0-p10.20260903.85@a1bba57`；history/policy 已把
  bootstrap floor 追加到 85，不追补真实 tag。该候选不含 `5285dd17`，不能用于图标验收。
- B1 已新增 `.74–.85` tracked history、policy、纯 Node helper 和永久 Vitest，并接入 `upload-experience`：
  clean production、fresh main/latest trial/required ancestor、description short SHA、exact build metadata、
  immutable lightweight tag 和 ignored receipt 均 fail closed；preview/dry-run 不触发 trial 外部状态。
- `.84` 有 25 个不同 `web-*` 名称/85 次引用；图标分支有 0 次 `web-*`、46 个不同 `ui-*`/127 次引用。
- 图标分支仍有 B1.2 残留：底部多项缺双色/active-only motion，顶部 profile geometry/尺寸错误，底部 24px
  对 Web 23px、Mini 按压 0.88 对 Web 0.98，filter stroke、locate 和更多行 context 尺寸未完全一致，平台
  CSS 仍复制 motion 数值。

## 严重程度与处理方向

- `LINEAGE-001～005`：P1/P2；必须先建立 remote immutable tag、累积祖先、clean/profile/description 和
  receipt 门禁。
- 底部五项、顶部 profile、`.84` 全图标回退：P1；合并原提交血缘后做 B1.2。
- top bell、filter/locate/more context、press feedback 和 motion codegen：P2；纳入 B1.2，防止下一轮漂移。
- PWA/Logo/loading/content glyph：P3；当前不迁移。

## 保留的其他审计事实

- `MINI-G1-004` 冻结证据仍为“证据不足，保留 P3”：production 匿名规模最大为 platform accounts 35，
  两个群组 members/contacts 分别 17/6，尚无匹配构建的 Xiaomi 14 原生节点、首绘、滚动或 bridge 证据。
- `.84` 可用于既有 G1-004 规模/运行时人工补证，但不能用于判断 `EXP-ICON-004`，两类证据不得混用。
- `schedule-project-guardrails` 已进入主线；本批按 L2 执行，未获得 L3 上传或 L4 production 授权。

## 验证与边界

- 当前证据层级：Git/static、Node tests/build/package audit、既有任务记录和用户 `.84`/Web 截图。未调用微信开发者工具；
  新候选 Xiaomi 14、Console/Network、冷启动、帧率和内存均“当前工具无法测量，暂未验证”。
- `.84` package：total `5,152,789 B`、main `1,716,235 B`；`.83` 既有记录：total `5,170,583 B`、main
  `1,732,195 B`。不跨不同构建输入计算提升/退化百分比。
- 旧实现红灯为缺少 `trial-lineage.mjs` 的 `ERR_MODULE_NOT_FOUND`；新实现定向 lineage 12/12、CI helper 6/6，
  完整 Mini 120/120 files、655/655 tests 通过。首轮 2 个 suite 的收集失败由 clean worktree 缺 producer dist
  导致，定向构建 producer 后同命令通过。
- Mini typecheck/source/trial policy/production verify/package/performance/determinism/CI dry-run、全仓 format/lint、
  agent-context 3/3、diff check 和 core smoke 通过；package total/main 为 `5,151,892/1,715,718 B`，与基线相同。
- 本批未上传体验版、未创建 remote trial tag、未操作 allowlist、未提审、未正式发布、未连接或部署 production。

## 唯一下一任务与停止条件

- 唯一下一任务：创建 `fix(miniprogram): enforce cumulative trial lineage` checkpoint，合并最新
  `origin/main@75cc0d3b` 并保留其 Skill/G1 `.85` 状态，重跑相称门禁后普通推送。
- 当前停止条件：主线整合、验证和推送完成即停止；不自动进入 B2、L3 上传或 L4 服务器操作。
