# 微信小程序审计状态

## 当前阶段

- 当前批次：`EXP-ICON-004-B3/B4` 已完成实现并进入 checkpoint 收口。用户在当前会话明确授权：验证通过后上传新的
  微信体验版，并把该精确版本追加到服务端客户端版本白名单。没有授权提交审核、正式发布、Web/API production
  部署、数据库变更或备份。
- 独立 worktree：`runtime/external-project-worktrees/exp-icon-004-lineage-b12-20260903`；分支
  `codex/exp-icon-004-lineage-b12-20260903`。当前实现 parent 为 `fcb3c15a`，已包含最新
  `origin/main@4602120b`、图标血缘 `5285dd17`（含 `1ffab10c`）及累计体验版门禁 `c027abcd`。
- 前序最新体验版为 `0.1.0-p10.20260903.85@a1bba571`。最终候选必须再次 fresh-fetch main、保持上述祖先、
  从 clean exact SHA 动态占用大于 85 的唯一版本；禁止预猜、复用或删除 trial tag。
- B3/B4 checkpoint `71110712` 与 bootstrap-safe tooling checkpoint `db7f3328` 已推送。用户创建的第二份单次
  授权已完成项目内依赖 materialization 并被消费；随后暴露 ambient default store 与项目内版本化 store 的
  health 比较错误。当前修复已让 install/fingerprint/health 共用 pnpm 解析后的项目内 store，并纠正 post-install
  失败时的调用事实；两项回归先红后绿，健康 marker 已采纳，复核为 `READY_REUSE` 且未二次安装。尚未占用
  新版本、上传或修改 allowlist。Node guard 21/21、release/test-discovery 14/14、Skill validator、
  format/lint/core smoke 与完整 `pnpm verify` 均通过；Mini 123 files/668 tests，根 Vitest 246 files/1,171 tests。
- `9396ed04` release worktree 已 clean/detached/ready，依赖复用成功。Mini producer 首次构建和 marker 写入成功后，
  仅 human-readable 输出因错误迭代 package reason map 返回非零；新增 formatter 回归先红后绿，真实 wrapper 复跑
  返回三个 producer 全部 reused、`READY_BOOTSTRAP`、`INSTALL_INVOKED=false`。当前正在形成最后的输出收口
  checkpoint；最终 Node guard 22/22、release/test-discovery 14/14、format/lint/core smoke、diff check 与完整
  `pnpm verify` 通过，Mini 123 files/668 tests、根 Vitest 246 files/1,171 tests。仍未分配或占用 trial 版本。

## EXP-ICON-004 B3 已验证事实

- `.84@8e6a4a3` 与 `.85@a1bba57` 都不是 `.83@5285dd1` 的后继，缺少
  `1ffab10c`/`5285dd17`。版本号前进但图标代码回退的根因是并行分支 Git 血缘，不是真机缓存。
- B3 把使用场景规格固定在 `packages/ui-icons/src/context.ts`，把唯一 trigger、duration、delay、easing、循环、
  方向、fill 与 reduced-motion 固定在 `motion.ts`，`platform-bindings.ts` 只保存 selector、origin 和 Mini
  capability；生成器输出 Web CSS、Mini WXSS 与 58 个 Mini SVG。页面不再保存第二套关键帧数值。
- 底部五项统一为 23px/2、active primary/inactive secondary，并直接由 `activeWorkspace` 控制 active-only
  1800ms 循环；通讯录、我的与更多拆为同源 part asset，换班保留左右方向，更多保留 0/100/200ms stagger。
  按压改为整个 nav item 120ms/scale(.98)，删除旧 `navMotion`、24px 与 icon-only scale(.88)。
- 顶部通知使用 21.6px/1.8 的 bell context；顶部个人改用 TDesign User 真实几何 20px/2，并与底部 profile
  状态分离。通讯录 department/people 保持 18px/1.8、`#586678` inactive、500/520ms destination-only；
  calendar filter/locate、favorite/phone、more-row 尺寸都由 context 生成。
- 旧 `web-*`、合并版 `ui-directory.svg`/`ui-profile.svg`、平台私有共享 keyframe 与 `navMotion` 均已移除；
  更多页、搜索/关闭/清空、事件、工作流 picker、身份及其余 B1 几何保持同源，没有新增运行时依赖或业务状态变化。

## 验证、包体与已知边界

- 失败先行：B3 单一来源契约在旧实现上 5/5 失败；实现后 5/5 通过。最终 Mini 定向为
  8 files/126 tests；完整 Mini 为 123 files/668 tests，Web/token 定向 4 files/19 tests，Web/Mini/ui-icons typecheck、Web
  production build（4,251 modules）、Mini source/package/performance/determinism/production verify、format/lint、
  generated check、credential-free CI dry-run（manifest `ce84b24f…`）、`git diff --check` 和
  `pnpm smoke:check-core` 均通过。
- B3 工作树 production verify 为 total/main `5,181,999/1,745,405 B`；同环境 parent 为
  `5,169,731/1,731,704 B`，即 `+12,268/+13,701 B`。总包增量低于 B1.2 16 KiB，且刚好低于
  variant/adapter 12 KiB 预算 20 B；58 个 SVG 为 27,257 B，Web/Mini motion adapter 为
  `12,240/9,490 B`。最终 clean SHA 仍须同口径复测，超预算即停止上传。
- 仓库级 `pnpm verify` 首次在最终 `pnpm test` 阶段暴露主线 `4602120b` 新增的 5 个 `node:test` 文件被
  Vitest 误收集，产生 5 个 “No test suite”；此前所有实际 Node assertions 均通过。新增测试先 2 项失败，
  随后根入口固定先跑 `node --test scripts/codex/*.test.mjs`，Vitest 排除该目录；17 项 Node guard tests、
  246 files/1,171 Vitest tests 全绿，修复后的完整 `pnpm verify` 整链通过。该修复不改变产品运行时。
- 仍只有既有 Mini 主包 1.5 MiB 内部 warning、两个 600-cell matrix best-effort warning 和 Web >500 KiB
  chunk warning。冷启动、帧率、内存、Skyline 合成、SVG transform-origin 与真实触控观感当前工具无法测量。
- 仓库政策下未调用微信开发者工具 GUI/CLI。B2 的浏览器 smoke 能打开登录页，但本地 API 3000 未运行；不把
  Node、构建或旧 `.81–.85` 截图写成 Xiaomi 14 验收。

## 唯一下一任务与停止条件

- 完成 bootstrap reason 输出收口的全仓验证、提交并推送新的 exact checkpoint；随后重置
  `runtime/release-worktree` 并只以 ReuseOnly 复用现有健康依赖和 producer 输出。
- 完成版本绑定 build 与动态唯一版本分配；上传前披露 exact tuple 并取得当次 L3 批准后才上传体验版。
- 上传前必须披露 exact SHA、版本、description、clean/profile/manifest 和测试页面；若仓库门禁仍要求精确候选
  二次确认，则在该点等待用户确认。上传成功后，只有用户当时消息明确授权 exact version 的 L4 操作，才执行
  受控 allowlist `ensure <exact-version>`、`verify` 和规定的只读生产健康验证；不部署应用或数据库。
- 收到上传回执并记录 version/SHA/manifest、allowlist 加法语义与验证结果后停止。Xiaomi 14 状态保持
  “自动化候选通过，待用户复核”；不提审、不正式发布。
