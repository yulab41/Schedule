# Project Status

本文档只记录当前可安全接续的事实；详细历史以 Git、`docs/audit/` 和精确 debug 日志为准。每轮先读
`docs/agent-context/pitfall-index.json`，只加载匹配坑位详情。

## 当前仓库批次（2026-09-03）

- 当前活动批次：`EXP-ICON-004-B1.1`；状态为“用户已确认设计，修复实施中”。用户在 Xiaomi 14 体验版
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
- 当前边界：上一候选曾获当次授权；`0.1.0-p10.20260903.81` 已从 managed `runtime/release-worktree` 的
  `1ffab10c` clean production profile 上传成功。服务器可信 allowlist `ensure` 已核对该版本已存在并通过验证，未重建容器；随后
  allowlist `verify` 与完整 ECS verifier 通过。该授权不自动延伸至 B1.1；本轮不上传、不提交审核、不正式发布、不连接或部署 production。

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
  未提交审核、未正式发布、未部署 production；Xiaomi 14 证据当前“工具无法测量，暂未验证”。

## 已完成的历史批次

- `EXP-CALENDAR-003`：请假日期选择器月份横滑、定位今天和选中态颜色；需按既有状态记录做 Xiaomi 14 原生复核。
- `EXP-FEAT-002`：工作台事件记录入口、既有事件 GET、事件时间线和异步隔离；需按既有状态记录做 Xiaomi 14 原生复核。
- `EXP-UX-001/002`：工作流共享 sheet、picker 生命周期、请假/加扣班弹窗和 direct Page 收口；历史证据在
  `docs/audit/wechat-miniprogram-audit.md` 与 debug 日志。

## 状态策略与唯一下一任务

- 当前问题状态：B1.1 根因已定位、设计已确认；日历的私有点击弹跳/缩放降级与人员资产 stroke/未选中色待通过
  失败先行契约修复。`.81` 用户反馈是问题证据，不得写成 Xiaomi 14 验收通过。
- 唯一下一任务：完成 B1.1 精确回归测试、最小修复、同口径包体和全量验证，更新审计后提交并推送调查分支；
  停在新体验版上传门禁前。
- B1.1 设计 checkpoint 由提交消息 `docs(design): specify EXP-ICON-004 motion parity fix` 标识；随后实施 checkpoint
  必须记录实际测试、包体、commit 和推送结果。
- 任何后续上传都必须重新报告精确 SHA、trial 版本、描述、脏树与测试页并取得当次明确批准；不使用主 worktree ignored 状态，
  不调用微信开发者工具，不提交审核、不正式发布、不连接或部署 production。
