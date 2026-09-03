# 微信小程序审计状态

## 当前阶段

- 当前批次：`EXP-ICON-004-B1`；Web/小程序图标同源修复已完成静态实现，状态为“已完成（含自动化验证）→ 待体验版确认”。
- 执行基线：按执行时最新 `origin/main@8e6a4a320a69fee9f1ca0471d8f9b140e3d4dd39` 创建独立干净
  `runtime/external-project-worktrees/exp-icon-004-full-20260903` / `codex/exp-icon-004-full-20260903`；主 worktree 的用户改动未触碰。
- 范围：底部导航、顶部通知/个人、更多工具、通讯录按钮、日历/事件/导出/工作流控制、身份和状态图标的来源审计与同源迁移；不改业务接口、数据结构、路由语义或业务行为。
- 设计、计划和完整对照见 `docs/superpowers/specs/2026-09-03-exp-icon-004-icon-migration-implementation-design.md`、
  `docs/superpowers/plans/2026-09-03-exp-icon-004-icon-migration-implementation-plan.md` 和
  `docs/audit/exp-icon-004-icon-parity-audit.md`。

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
- 按仓库政策未调用微信开发者工具 GUI/CLI，未上传体验版，未提交审核，未正式发布，未部署 production；当前没有 Xiaomi 14
  实机证据。

## 唯一下一任务与停止条件

- 唯一下一任务：审阅本批提交并确认候选的体验版上传参数（短 SHA、版本号、版本描述、脏树状态和测试页面）；收到当次明确确认后，
  使用 `runtime/release-worktree` 的干净候选和 `miniprogram-ci` 上传体验版，上传后立即停止，等待用户提供匹配构建的 Xiaomi 14 证据。
- 上传前必须再次执行 worktree safety checker、`miniprogram-ci` credential-free dry-run/production profile 校验和最终 package/verify；
  不使用主 worktree 的 ignored 状态，不上传生产，不提交审核，不正式发布。
- 真机复核至少覆盖：底部导航五项及 active-only loop、顶部 bell/profile、更多每一行图形/右箭头、通讯录科室/人员切换、搜索/筛选/清除/收藏/电话、
  日历前后月/周/定位、事件记录、导出、工作流 picker 的下拉方向/关闭、身份 user/lock、Xiaomi 14 安全区与 reduced-motion。
- 当前状态保持“待体验版确认”，直到上传候选获得用户明确批准；Node/静态/模拟器结果不能代替真机验收。
