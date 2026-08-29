# 小程序五入口常驻外壳 `.66` 实施计划

- 设计：`../specs/2026-08-29-miniprogram-primary-workspace-shell-design.md`
- 基线：`main@4bc89c59`
- 目标：`.66` 点击阶段；不启用 `.67` 横滑
- checkpoint：`fix(miniprogram): ship persistent primary workspace shell`

## Task 1：冻结旧架构红灯

扩展 workbench navigation/runtime/native、Profile controller/native、workflow host 和 Test Center 测试。
旧代码必须失败于：无五项 swiper、上下栏仍靠 absolute overlay、Profile 仍是 Page adapter、无统一
mounted/ready/queue、无 Workspace F、无权限切换仍退回日历。

## Task 2：实现 Profile workspace

先做逐层 DevTools 门禁：静态 shell → 本地会话 → account read → overview read → Sheet/敏感动作。
每层必须保持 workbench runtime/screenshot 可响应，再继续下一层。抽取共享 loader/view-model，保留
static Page 行为；Component 只用单一 lifecycle/generation。

## Task 3：实现 workbench swiper 与串行预载

重排 WXML/WXSS 为 header/swiper/nav 三段；建立五项 descriptor/index、点击 `duration=0`、
`cache-extent=4`、touch disabled。实现 directory → profile → swap ready 链、点击抢占、常驻状态与
disabled placeholder。补 directory/swap `active/workspaceready`。

## Task 4：增加 Workspace F

在现有 Test Center 增加只含低敏诊断的 F 区：当前 workspace、index、mounted/ready、queue、gesture
lock、attached/request count 与 50 次点击压力按钮。不得显示账号、群组、排班或联系方式正文。

## Task 5：验证与 `.66` 发布

运行任务定向、Mini 全量、typecheck、production verify、determinism、source/package/performance、CI
dry-run、root build/typecheck/test、任务 Prettier/ESLint、diff check 与 core smoke。主包 <1.8MB，
WXS SHA 不变。

从 exact clean checkpoint 用默认 GPU DevTools 验证 identity/workbench/Profile 与五入口压力；更新
status/debug/pitfall，显式暂存、提交、推送。随后 official upload `.66`、生产备份、部署或 trusted
reuse、allowlist ensure/verify、七维 capability、unknown=426、公网 full verifier 与远端清理。

停止于 `.66` 实体复核；`.67` 不在本 checkpoint 开启。
