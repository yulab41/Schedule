# Project Status

本文档只记录当前可安全接续的事实；详细历史以 Git、`docs/audit/wechat-miniprogram-audit.md` 和精确
debug 日志为准。每轮先读 `docs/agent-context/pitfall-index.json`，只加载匹配坑位详情。

## 当前仓库批次（2026-09-02）

- 已完成主线批次：`MINI-G1-001`、`MINI-G1-002`、`MINI-G1-003`；本批以执行时最新
  `origin/main@359966f7240d2f557b24dd0c1ac61979d6bb8298` 为基线，三项既有代码和文档均未回退。
- 当前活动批次：`MINI-G1-004` 运行证据核查；最终结论为“证据仍不足，保留 P3”，未进入业务修复阶段。
  先前 `EXP-UX-001` 的自动验证、体验上传和 production release 属于已完成历史，不在本轮重做。
- 调查分支/worktree：`codex/mini-g1-004-evidence-audit-20260902` /
  `runtime/external-project-worktrees/mini-g1-004-evidence-audit-20260902`；用户主 worktree、既有修复
  worktree 和其他并行 worktree 未修改、清理、暂存或借用。
- 设计 checkpoint：`7cef75ff docs(superpowers): design EXP-UX-001 experience fixes`。
- 功能 checkpoint：`3b1cbd1b fix(miniprogram): close EXP-UX-001 experience regressions`。
- clean 包体文档 checkpoint：`f04fc56d docs(audit): record clean EXP-UX-001 verification`。
- 本次 build-time manifest 口径修正文档 checkpoint 提交信息：`docs(audit): clarify volatile build manifest`（本文件更新后提交）。
- 为保留当前 production `50ac2d07` 的 schema 53/目录查询能力，最终源码 tip 为
  `3897581e7a8d5734ef5910e2dd8854a92c246062`，其第一父为 EXP tip `d1594d09`、第二父为当前 production release；
  production 使用该 tip 的 hash-identical trusted reuse。
- 本轮不重跑阶段 0，不修改业务实现/API/数据库/权限/路由，不进入日期选择器、事件记录或全局图标任务。
  未调用微信开发者工具 GUI/CLI，未上传体验版，未部署 production。

## MINI-G1-004 调查结果

- 平台账号 `GET /platform-admin/users` 和群组 members/contacts 读取 API 都返回完整数组；权限检查限制可见
  身份，但未发现分页、cursor/pageSize、服务端 limit 或总量上限。页面没有搜索、筛选、懒加载或渲染窗口。
- 新增仅测试用的 `apps/miniprogram/scripts/mini-g1-004-scale-probe.test.mjs`，用无隐私 `N=1/25/100`
  fixture 测量完整 view model、ready `setData`、总 payload、静态重复节点和逻辑 map 次数；未改生产运行时。
  1→100 时平台节点估算 `8→800`、ready bytes `341→19,000`；群组节点估算 `12→1,200`、ready bytes
  `1,068→34,728`；setData 次数分别恒为 4/6，payload 随 N 增长。桌面 Node 毫秒数不作为真机卡顿证据。
- 现有 P8 生产资料只有 2026-08-25 聚合快照（活动群组 2、活动成员 owner 2/admin 3/member 21、pending
  0、活动用户 35），没有当前 release 的逐页最大 N/分布；现有 controller 测试只有 1 个账号/成员。因此
  不能证明真实规模已造成用户影响，也不能因没有自然上限而直接确认真机风险。

## 已完成的 EXP-UX-001

- 换班 request/admin/revoke 三种 sheet 改用既有 `ui-sheet`：fixed z400、78vh/max660、safe-area、
  独立滚动区、固定 footer 和顶部 drag region；首页真实 Tab 导航仍为 z50。
- 共用 `workflow-picker` 已统一同实例 toggle、A/B 互斥、空选项关闭、选择后关闭和 host dispose/unload
  清理；没有复制页面实现。
- leave/swap/duty 非 Tab 直达页的旧 bottom-nav WXML、专用 handler 和样式已源码删除；路由、左上角返回、
  系统侧滑返回保留，底部只保留必要 `16px + safe-area` 内容空间。只读审查未发现其他页面挂载同一遗留导航；
  workbench 首页导航未改。
- 13 个右上角静态 `phase-chip` P5/P7/P8/P9 节点及专用样式已删除；CSV 改为 `format-chip`。buildLabel、
  编译 SHA/版本/profile/time、测试工具 metadata 和 P1 左侧诊断说明保留。源码和 production dist 搜索无
  `phase-chip`/右上角 P 标签。
- 详细截图映射、根因、删除清单、picker 调用者、包体和真机边界见 `docs/audit/wechat-miniprogram-audit.md`
  第 11 节；连续性记录见 `docs/debug/debug-feedback-log.md` 的 2026-09-02 条目。

## 验证证据

- 旧实现先红：EXP 合同在业务源码修改前实际 7 红/1 绿；修复后 EXP 9/9，受影响定向合同 52/52。
- 起始主线历史 Mini 全量为 114 files / 621 tests passed；本轮新增诊断后，clean worktree 正式
  `pnpm miniprogram:test` 为 115 files / 622 tests passed（117.62s）。
- `pnpm exec vitest run scripts/test-discovery-policy.test.mjs` 为 1 file / 3 tests passed；contracts 与
  scheduling-domain 只读 build 产物已补齐以完成 workspace 测试解析。
- Mini：`pnpm miniprogram:build`、`pnpm --filter @schedule/miniprogram typecheck`、source audit、
  `pnpm miniprogram:verify` 均通过；clean verify packageBytes `5,113,419`。manifest 会包含每次构建时间，
  因此每次 verify 重新生成，不作为稳定 SHA/包体指标提交。
- 包体同口径从 `5,121,616` 降至 `5,113,419`，实际减少 `8,197` bytes；主包 warning 和矩阵 warning 保持
  既有类别。
- 根 production build、TypeScript、ESLint、全仓 Prettier、`git diff --check` 均通过；合入 production 父线后
  `pnpm test` 为 246 files / 1,170 passed / 364 skipped。
- `pnpm smoke:browser` 已运行：第一次因 5173 未启动拒绝连接；按正式启动方式重试时，该 worktree 缺少本地 `.env`，
  API 无法启动，因此未进入产品断言；端口已确认无残留。该结果不替代 production verifier。
- 未调用微信开发者工具 GUI/CLI；`.80` 体验版已由官方 Node `miniprogram-ci` 上传，production 已部署并加入
  allowlist，生产数据库备份已创建。Node/静态/WXS 结果仍不代替 Xiaomi 14 原生运行时或实体设备验收。
- production 备份：`bd5f74d6-4b06-4330-878b-9c1f87c6ee9f`（55 表、206,133 行、91,326,356B）；当前 release
  `3897581e7a8d5734ef5910e2dd8854a92c246062`；allowlist 含 `0.1.0-p10.20260902.80`。

## 状态策略与唯一下一任务

- 当前 `MINI-G1-004` 状态为“证据仍不足，保留 P3”：不关闭，也不提升为已确认真实规模风险；本轮没有
  业务修复 Prompt。唯一下一任务是补当前 release 的脱敏逐页规模/分布与匹配 SHA 的 Xiaomi 14 原生首屏、
  节点和滚动证据，再决定是否关闭或进入最小修复设计。
- 本调查 checkpoint 的停止条件：文档、测试和 diff 审阅完成后提交并推送调查分支；按用户指示不上传体验版、
  不部署 production。不要因本批有剩余上下文而进入分页/分批实现。
- 本批 checkpoint commit message：`audit(miniprogram): measure MINI-G1-004 list growth`；提交后以 Git 短哈希
  作为本批可接续身份。
