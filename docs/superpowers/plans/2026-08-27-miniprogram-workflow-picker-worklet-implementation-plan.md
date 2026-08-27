# 小程序年月滚轮 UI 线程实施计划

- 日期：2026-08-27
- 基线：`main@c8479359`
- 状态：Task 1–5 已完成，待实体 Android 复核
- 设计：[`../specs/2026-08-27-miniprogram-workflow-picker-worklet-design.md`](../specs/2026-08-27-miniprogram-workflow-picker-worklet-design.md)
- 范围：一项复杂手势/性能任务

## Task 1：冻结架构回归并证明旧实现失败

修改：

- 新增 `apps/miniprogram/scripts/workflow-picker-worklet.test.mjs`。
- 扩展 `apps/miniprogram/scripts/workflow-picker-controller.test.mjs` 的慢速反向、旧事件、绑定次数与完成语义。

红灯要求：

- 旧 WXML 缺少 `worklet:onscrollupdate`、稳定 item/number ID 和 `scroll-anchoring=false`。
- 旧 TS 仍含 JS snap timer/owner、逐帧 `setWheelProgress`，且没有 SharedValue/animated style。
- 旧慢速 `7 → 7.25 → 7.51 → 7.49 → 7` 路径不能证明零逐帧 `setData`。

验证：

```powershell
pnpm --filter @schedule/miniprogram exec vitest run `
  scripts/workflow-picker-worklet.test.mjs `
  scripts/workflow-picker-controller.test.mjs `
  --fileParallelism=false
```

## Task 2：建立每实例 Worklet runtime 与低频逻辑边界

修改：

- `apps/miniprogram/src/subpackages/workflows/components/workflow-picker/index.ts`
- 必要时 `apps/miniprogram/src/types/build-env.d.ts`

实现：

- 年/月各建 position/reported-index/generation/sequence SharedValue。
- 预绑定 `runOnJS` callback，按 generation/sequence 拒绝延迟旧事件。
- `worklet:onscrollupdate` 只更新 SharedValue；最近索引变化时每行最多一次逻辑提交。
- 非 Worklet `scrollend` 只提交最终索引与实际 scrollTop，不命令二次吸附。
- 删除全部 wheel snap timer、animation owner、逐帧 item 数组重建和触摸 gating。
- 完成前从最新 Worklet/settled index 归一最终年月；取消语义不变。

## Task 3：绑定稳定节点与等价逐像素视觉

修改：

- `apps/miniprogram/src/subpackages/workflows/components/workflow-picker/index.wxml`
- `apps/miniprogram/src/subpackages/workflows/components/workflow-picker/index.wxss`

实现：

- 月份滚轮首次打开后保持 mounted，关闭时 hidden/aria-hidden；日期与 selector 生命周期不变。
- 为 11 年 + 12 月 item 与 number 建稳定 ID；首次 mount 只绑定一次 46 个 updater。
- 父层 Worklet 精确实现 `scale 0.94→1`、`opacity 0.58→1`。
- 数字实际 24px，子层 scale 精确实现 `(19 + 5p) / 24`，与当前逐像素公式等价。
- 保留单一 CSS snap；显式关闭 scroll anchoring，不使用 `scroll-snap-stop: always`。
- 打开/点选只做一次 programmatic scrollTop；新触摸不受逻辑状态屏蔽。

## Task 4：关闭回归、Worklet 与视觉门禁

定向：

```powershell
pnpm --filter @schedule/miniprogram exec vitest run `
  scripts/workflow-picker-worklet.test.mjs `
  scripts/workflow-picker-controller.test.mjs `
  scripts/p7-native-feedback.test.mjs `
  --fileParallelism=false
```

完整：

```powershell
pnpm miniprogram:test
pnpm miniprogram:verify
pnpm --filter @schedule/miniprogram check:determinism
pnpm miniprogram:package-audit
pnpm miniprogram:ci:dry-run
pnpm build
pnpm typecheck
pnpm test
pnpm smoke:check-core
```

另运行任务文件 Prettier/ESLint、`git diff --check`、Worklet source/output audit；审计 receiver、异步/错误、空值、副作用和调用次数。

## Task 5：checkpoint、体验上传与生产同步

- 更新 wheel pitfall、debug log、project status，状态写为“已实现并自动验证 → 待实体 Android 复核”。
- 显式暂存任务路径，排除全部用户脏树。
- 代码 checkpoint：`fix(miniprogram): move workflow wheel motion to ui thread`。
- 推送后上传下一单调 production-profile 体验候选（当前为 `.50`），不提审、不正式发布。
- 创建生产数据库备份；从 clean release worktree 打包，按哈希门禁 full deploy 或 trusted reuse。
- 正式 allowlist ensure/verify 新候选，运行带公网 IP full verifier，清理远端临时目录。
- 最终状态 checkpoint 再同步 Git/origin/production release。

## 停止条件

- 自动门禁、体验上传、Git/GitHub、生产备份/release/allowlist/full verifier 全部完成。
- 实体 Android 前状态只允许“待用户复核”。
- 用户在新候选完成 20 次慢速逐格下→上、半格反向、吸附中反向和年/月交替操作；明确反馈达到持续跟手且无明显跳帧后，才把 pitfall 改为 `fixed-guarded`。
