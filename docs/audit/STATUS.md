# 微信小程序审计状态

## 当前阶段

- 当前批次：`EXP-ICON-004-B1.1`；针对 `.81` 真机反馈的日历和通讯录人员模式图标差异已完成静态修复与
  自动化验证，状态为“已实现待新候选上传授权与真机复核”。
- 执行基线：按执行时最新 `origin/main@8e6a4a320a69fee9f1ca0471d8f9b140e3d4dd39` 创建独立干净
  `runtime/external-project-worktrees/exp-icon-004-full-20260903` / `codex/exp-icon-004-full-20260903`；主 worktree 的用户改动未触碰。
- 范围：底部导航、顶部通知/个人、更多工具、通讯录按钮、日历/事件/导出/工作流控制、身份和状态图标的来源审计与同源迁移；不改业务接口、数据结构、路由语义或业务行为。
- 设计、计划和完整对照见 `docs/superpowers/specs/2026-09-03-exp-icon-004-icon-migration-implementation-design.md`、
  `docs/superpowers/plans/2026-09-03-exp-icon-004-icon-migration-implementation-plan.md` 和
  `docs/audit/exp-icon-004-icon-parity-audit.md`。
- B1.1 补充设计/计划见 `docs/superpowers/specs/2026-09-03-exp-icon-004-motion-parity-follow-up-design.md` 和
  `docs/superpowers/plans/2026-09-03-exp-icon-004-motion-parity-follow-up-implementation-plan.md`；用户已确认该设计。

## 已验证事实

- Web 原生产图形来源已盘点：`WorkbenchNavIcon.vue` 的导航 path、`LucideMinimalActionIcon.vue` 的动作 path/TDesign
  图形、页面直接 TDesign 图标、CSS/text 近似；未发现生产 sprite、字体图标或独立 Web SVG 图标目录。PWA PNG 仅作安装图标。
- 新增 `packages/ui-icons` 作为唯一几何/来源元数据/motion specification；Web 由 `SharedIcon`/`SharedIconPart` 渲染，
  小程序由生成器输出 44 个 `ui-*.svg`，颜色从 `packages/ui-tokens` 取值；通讯录人员使用 primary/secondary part 资产；26 个已确认无引用的旧 `web-*.svg` 已删除。
- 失败先行契约在实现前实际 4 项失败，修复后 4/4 通过；Mini 定向相关测试 43/43，最近一次全量 119 个文件、
  646 个测试全部通过。
- 静态/Node 证据：Mini TypeScript、Web TypeScript、Web build、Mini production build、source audit、package audit、
  performance budget、determinism、verify、定向 Web 测试、Prettier、ESLint 均已通过；最新 Mini packageBytes
  `5,168,783`，main `1,730,788`，主包既有 1.5 MB 内部 warning 仍存在但未新增 warning 类别。
- 性能差异：基线总包 `5,151,893`、main `1,715,719`；本批为 `+16,890` 总包、`+15,069` main（约 `+0.33%`），
  其中生成 SVG 源资产约 `20,654` bytes；无新增运行时依赖。构建 300 files；矩阵下界 warning 仍为既有 best-effort warning。
- 浏览器证据：首次 `pnpm smoke:browser` 因本地 5173 未运行返回 `ERR_CONNECTION_REFUSED`；启动本 worktree Vite 并设置
  `VITE_AUTH_DEV_MODE=true` 后重跑，在登录管理员步骤因本地 API `127.0.0.1:3000` 未运行而停留 `/login?redirect=/`；
  `pnpm smoke:check-core` 已在记录补齐后通过。不得将其写成浏览器功能通过。
- 上传前使用 `runtime/release-worktree` 的 detached exact-clean `1ffab10c3f30987e31db47eb555f9e0aef0bf787`；safety checker、
  production profile、credential-free CI dry-run、package/verify 均通过，`buildDirty=false`，44 个生成图标引用无缺失。
- 体验上传：第一次经本机代理/TUN 被微信 `-10008 invalid ip`（IPv6 出口）拒绝且未形成版本；清除本次进程代理并复用已审计的
  `runtime/ci-network/force-servicewechat-ipv4.cjs` 后，同一 SHA/版本/描述直连已登记 IPv4 成功。微信回执为
  `0.1.0-p10.20260903.81`、`exp-icon-004-b1-1ffab10`、196 code files、ZIP `2,486,095 B`，本地 upload manifest
  `a68c1706742b26fb5ac9cd0572793423003c4c837fd2590aab52ac3bcf804eb6`。
- 上传 IP 白名单路径已验证可用；没有修改 hosts、VPN、系统配置或仓库生产配置。用户随后明确授权服务器放行该版本；可信
  `schedule-client-version-allowlist ensure 0.1.0-p10.20260903.81` 返回“版本已存在并通过验证；未重建容器”，独立 `verify` 通过。
  随后的完整 `ecs-verify.sh` 通过；公网 IP 主动探测因未设置 `ECS_PUBLIC_IP` 按工具规则跳过。未提交审核、未正式发布、未部署本批代码；
  上传 checkpoint 当时尚无结构化 Xiaomi 14 证据，后续问题反馈见下一项。
- 用户随后报告 `.81` 的日历动效和通讯录人员模式按钮与 Web 不一致。静态复核确认：日历还保留 Web 不存在的
  420ms 点击弹跳，并用 `scaleX(.35)` 代替 dash draw；人员 520ms/位移/目标状态触发已经一致，差异来自 Mini
  生成资产 `stroke-width=2`（Web 为 1.8）及未选中 `#6B7785`（Web 为 `#586678`）。该用户报告是问题证据，
  但缺少 renderer/基础库/微信版本等完整元数据，不能作为修复后的验收证据。
- B1.1 已删除日历私有点击状态/关键帧，保留 active-only `1800ms ease-in-out infinite`，并把外链 SVG 兼容层
  收敛为 shared motion 的 `opacity .3 → 1 → .3`；不再缩放图形。新增 calendar/check secondary 同源资产。
  外链 SVG 内部 path 的 `stroke-dashoffset` 仍无法由页面 WXSS 可靠驱动，不虚构完全等价。
- B1.1 为通讯录模式资产增加 manifest 级 `strokeWidth: 1.8`，新增共享
  `directoryModeInactive #586678` token；Web/Mini 样式和 Mini 生成资产共同消费。人员 520ms motion 与触发逻辑未改。
- 失败先行：新契约在旧实现上为 `3 failed / 1 passed`，其中通过项正是人员 motion 数值/触发；修复后 4/4，
  原 B1 定向合计 38/38。最终 Mini 全量 `120 files / 650 tests`、Web/token 定向 `42/42`，共享包/Web/Mini
  类型检查、Web build、Mini production build/source/package/performance/determinism/verify、format、lint、
  `smoke:check-core` 均通过；thin-page guard 通过且没有 Page/Component 挂载变化。
- B1.1 production build 为 302 files、packageBytes `5,169,730`、main `1,731,703`；相对 B1 候选仅
  `+947 B / +915 B`。本批 8 个新增/变化 SVG 源资产净增 `863 B`，低于 8 KiB follow-up 预算；既有主包和
  600-cell 矩阵 warning 未新增类别。

## 唯一下一任务与停止条件

- 唯一下一任务：创建并普通推送由消息 `fix(miniprogram): align calendar and people icon motion` 标识的 B1.1
  checkpoint，然后停止在新体验版门禁前。后续必须重新报告精确 SHA、trial 版本/描述、脏树和测试页并取得当次上传批准。
- 新体验版真机只需回归本次差异：日历未激活 secondary 色、激活后的 1800ms opacity/draw 观感、重复点击无额外弹跳且仍回到顶部；
  人员未选中 `#586678`、选中 primary、1.8 线宽、切入 employee 时 520ms 位移、重复点击不重播；再确认 reduced-motion。
- `.81` 的服务器版本放行保持原状；B1.1 不继承其上传/production 授权。本轮不上传、不连接 Git/ECS production、
  不做数据库备份/迁移、不提审或正式发布。
- 当前状态保持“待新体验版 Xiaomi 14 复核”；Node/静态/浏览器构建结果不能代替真机验收。
