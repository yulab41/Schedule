# Project Status

本文档只记录当前可安全接续的事实；详细历史以 Git、`docs/audit/` 和精确 debug 日志为准。每轮先读
`docs/agent-context/pitfall-index.json`，只加载匹配坑位详情。

## 当前仓库批次（2026-09-03）

- 当前活动批次：`EXP-ICON-004-B1.1`；状态为“修复体验版已上传并放行，待 Xiaomi 14 复核”。用户在 Xiaomi 14 体验版
  `0.1.0-p10.20260903.81` 指出日历动效与通讯录人员模式图标仍和 Web 不一致；本批只修复这两个已定位差异，
  不重跑阶段 0。
- 执行 worktree：`runtime/external-project-worktrees/exp-icon-004-full-20260903`；分支
  `codex/exp-icon-004-full-20260903`；基于执行时最新 `origin/main@8e6a4a320a69fee9f1ca0471d8f9b140e3d4dd39`。
  根工作区的用户自有脏改动未接管。
- 设计、计划和审计分别见 `docs/superpowers/specs/2026-09-03-exp-icon-004-icon-migration-implementation-design.md`、
  `docs/superpowers/plans/2026-09-03-exp-icon-004-icon-migration-implementation-plan.md` 和
  `docs/audit/exp-icon-004-icon-parity-audit.md`。
- B1.1 补充设计与计划见 `docs/superpowers/specs/2026-09-03-exp-icon-004-motion-parity-follow-up-design.md` 和
  `docs/superpowers/plans/2026-09-03-exp-icon-004-motion-parity-follow-up-implementation-plan.md`；设计已由用户确认。
- 当前发布：`5285dd17a78793f2e62e1afcb0a7ef65f6ae57c1` 已从 managed exact-clean release worktree 以
  production profile 上传为 `0.1.0-p10.20260903.83`，描述 `exp-icon-004-b1.1-5285dd1`；可信 allowlist
  已原子追加该版本，独立 verify、带公网 IP 的完整 ECS verifier、`.83=200`/未知 `.84=426` 均通过。
  未提交审核、未正式发布、未部署本分支应用代码或迁移数据库；production 应用 release 仍为 `48488019`。
- 版本冲突：分支/本地记录预检只发现 `.81`，故先误用 `.82` 上传一次；随后生产 allowlist no-op 与跨任务核对证明
  `.82` 已属于 `EXP-CALENDAR-003`。该冲突上传不作为本批验收版本，已通知原任务 `.82` 不再是可靠验收标识；
  服务器 `.82` 保持 add-only，未获版本退役授权故未删除。最终 `.83` 在本地记录、build profile、近期任务和生产 426
  四层确认未占用后上传。

## 本批基线与验证证据

- 独立 worktree 初始 clean；Node `v24.14.0`、pnpm `11.9.0`；`pnpm install --frozen-lockfile` 通过。
- 修改前 Mini production build `282 files`、package `5,151,893B`、main `1,715,719B`；source audit、package audit、
  performance budget、determinism、verify 和 Mini TypeScript 均通过。工作树初始无 `node_modules/dist`，依赖安装耗时约 8m04s。
- 失败先行：`apps/miniprogram/scripts/icon-parity-contract.test.mjs` 在旧源码上实际 4 项失败；共享 catalog、
  motion、Web adapter 和 semantic Mini assets 完成后 4/4 通过。
- 已完成实现：新增 `packages/ui-icons`；Web `SharedIcon`/`SharedIconPart`；小程序生成 44 个 `ui-*.svg`；所有确认无引用的
  26 个旧 `web-*.svg` 已删除；未改 API、数据结构、权限、路由、业务状态或运行时第三方依赖。
- 最终候选静态指标：Mini production build `300 files`；package audit/verify `5,168,783B`，main `1,730,788B`；相对基线
  `+16,890B / +0.33%`、main `+15,069B`。主包既有 1.5 MB warning 和矩阵 `1445/1506` best-effort warning 未新增类别。
- 最终引用门禁：44 个 WXML `ui-*.svg` 唯一引用全部解析到生成文件，无缺失、无遗留 `web-*.svg`；生成文件均含 source/content hash 标记。
- 已通过：Mini/Web TypeScript、Mini 定向 43 tests、Web 定向 34 tests、Mini production build、source/package/performance/
  determinism/verify、Prettier、ESLint；Mini 最终全量 `119 files / 646 tests` 全部通过。
- 浏览器证据：首次 `pnpm smoke:browser` 因 5173 未启动 `ERR_CONNECTION_REFUSED`；启动本 worktree Vite 并设置
  `VITE_AUTH_DEV_MODE=true` 后，在管理员登录步骤因本地 API `127.0.0.1:3000` 未运行停留 `/login?redirect=/`；
  该结果已写入 `docs/debug/debug-feedback-log.md`，`pnpm smoke:check-core` 已通过。浏览器功能未宣称通过。
- 按仓库政策未调用微信开发者工具 GUI/CLI；第一次代理上传因 IPv6 `-10008 invalid ip` 失败，随后用既有 IPv4 DNS 兼容脚本重试成功：
  196 code files、ZIP `2,486,095 B`、upload manifest `a68c1706742b26fb5ac9cd0572793423003c4c837fd2590aab52ac3bcf804eb6`。
  未提交审核、未正式发布、未部署 production；自动化工具无法取得 Xiaomi 14 证据，后续用户问题反馈缺少完整环境元数据。
- B1.1 根因：Mini 日历保留了 Web 不存在的 420ms 点击弹跳并以 `scaleX(.35)` 模拟 dash draw；通讯录人员
  motion/触发已一致，但生成资产为 stroke 2 和 `#6B7785`，不同于 Web 的 1.8 和 `#586678`。
- B1.1 实现：删除日历私有点击状态/关键帧，保留 active-only 1800ms/ease-in-out/infinite，并把外链 SVG
  兼容层收敛为 canonical opacity；新增同源 secondary 资产。Mini manifest 支持 stroke override，新增共享
  `directoryModeInactive` token；people motion/controller 未改。外部 image 内部 dashoffset 仍待真机判断兼容观感。
- B1.1 失败契约旧实现 `3 failed / 1 passed`、修复后 4/4；定向 Mini 38/38、Web/token 42/42，最终 Mini
  120 files/650 tests；共享/Web/Mini typecheck、Web build、Mini build/source/package/performance/determinism/
  verify、format、lint、`smoke:check-core` 通过。302 files、package `5,169,730B`、main `1,731,703B`，
  相对 B1 `+947B/+915B`；本批 SVG 净增 863B，无新增 warning 类别或运行时依赖。
- `.83` release profile 复验：Node `v24.14.0`、pnpm `11.9.0`，302 files、package `5,170,583B`、main
  `1,732,195B`（含显式版本/描述元数据）；source/package/determinism/verify、credential-free dry-run、38 项定向测试和
  上传前后 safety checker 均通过。微信回执为 196 code files、ZIP `2,488,358B`、upload manifest
  `8c67a51e01084d7a09b941fdd9d7a9284d669e49028331ee39fba5c7e31dc313`。

## 已完成的历史批次

- `EXP-CALENDAR-003`：请假日期选择器月份横滑、定位今天和选中态颜色；需按既有状态记录做 Xiaomi 14 原生复核。
- `EXP-FEAT-002`：工作台事件记录入口、既有事件 GET、事件时间线和异步隔离；需按既有状态记录做 Xiaomi 14 原生复核。
- `EXP-UX-001/002`：工作流共享 sheet、picker 生命周期、请假/加扣班弹窗和 direct Page 收口；历史证据在
  `docs/audit/wechat-miniprogram-audit.md` 与 debug 日志。

## 状态策略与唯一下一任务

- 当前问题状态：B1.1 代码、自动化、`.83` 体验上传和服务器放行完成；不得据此写成 Xiaomi 14 验收通过。
- 唯一下一任务：用户在 Xiaomi 14 打开 `trial 0.1.0-p10.20260903.83`，核对 build `5285dd1` 后复核日历
  active/inactive/重复点击/reduced-motion 与通讯录人员 1.8 stroke/颜色/520ms destination-only motion；返回环境与观察结果后停止。
- 发布记录 checkpoint 由提交消息 `docs(audit): record EXP-ICON-004 B1.1 trial upload` 标识并普通推送调查分支。
- 不调用微信开发者工具，不再上传，不提交审核、不正式发布、不部署应用 production；后续版本必须先跨任务检查版本占用。
