# 小程序年月滚轮 WXS 真机探针实施计划

- 日期：2026-08-28
- 基线：`main@1dee8a34`
- 状态：用户已确认规格，待阶段 A 实施
- 设计：[`../specs/2026-08-28-miniprogram-workflow-picker-wxs-design.md`](../specs/2026-08-28-miniprogram-workflow-picker-wxs-design.md)
- 范围：仅 `UiWheelColumn + gesture-probe E`；生产 `workflow-picker` 保持 `.51` 语义
- 复杂度：一项复杂手势任务

## Task 1：冻结阶段 A 红灯

新增：

- `apps/miniprogram/scripts/ui-wheel-column.test.mjs`
- `apps/miniprogram/scripts/ui-wheel-column-simulate.test.mjs`

扩展：

- `apps/miniprogram/scripts/gesture-probe.test.mjs`

旧树必须稳定失败于：

1. 不存在 `components/ui/ui-wheel-column` 五文件原生组件。
2. 不存在普通 `view + WXS` 单一触摸入口、config observer、稳定 track/item/number 节点。
3. 不存在可执行 WXS harness，无法证明逐像素视觉、投影目标、单段吸附和中途反向接管。
4. gesture-probe 没有 E 区、preview/settle/generation 证据与生命周期重置按钮。

红灯命令：

```powershell
pnpm --filter @schedule/miniprogram exec vitest run `
  scripts/ui-wheel-column.test.mjs `
  scripts/ui-wheel-column-simulate.test.mjs `
  scripts/gesture-probe.test.mjs `
  --fileParallelism=false
```

## Task 2：实现可复用 UiWheelColumn

新增：

- `apps/miniprogram/src/components/ui/ui-wheel-column/index.json`
- `apps/miniprogram/src/components/ui/ui-wheel-column/index.ts`
- `apps/miniprogram/src/components/ui/ui-wheel-column/index.wxml`
- `apps/miniprogram/src/components/ui/ui-wheel-column/index.wxss`
- `apps/miniprogram/src/components/ui/ui-wheel-column/wheel-gesture.wxs`

组件契约：

- 输入 `items/unit/selectedIndex/runtimeKey/generation/commandRevision/animateCommand/ariaLabel`。
- 输出 `previewchange` 与 `settle`，均携带 runtimeKey/generation/sequence/index/offset。
- 点行只生成同一 WXS 引擎的新 command，不建立第二套定位逻辑。
- TypeScript 只做配置、顺序校验、ARIA 摘要与低频语义事件；高频路径不 `setData`。

WXS 运动：

- 2px 阈值与 1.2 纵轴比；新 touchstart 先取消旧 animation token。
- 速度样本仅接受 0–80ms，钳制 ±3px/ms；投影 160ms 后取最近 44px 行。
- 8–18 个固定逻辑帧执行单段 cubic-out；RAF 不读取时间戳，最后一帧强制精确行坐标。
- 每帧只设置 track transform 与相邻行 transform/opacity；不缓存跨渲染节点句柄。
- state 按 runtimeKey/generation 隔离；延迟 config/sequence 不覆盖新手势。

## Task 3：接入诊断页 E 区

修改：

- `apps/miniprogram/src/pages/gesture-probe/index.json`
- `apps/miniprogram/src/pages/gesture-probe/index.ts`
- `apps/miniprogram/src/pages/gesture-probe/index.wxml`
- `apps/miniprogram/src/pages/gesture-probe/index.wxss`

实现：

- 复用真实 `UiWheelColumn` 展示 11 个年份、中心双轨、渐变遮罩和 188px 视口。
- 显示 preview 年份、settle 年份、generation 与现有 build/device 信息。
- “重置滚轮”回到 2026 并递增 generation，用于连续关闭/重开等价测试。
- 保留 A/B/C/D 原探针，不修改 Worklet/WXS 黄点的既有诊断语义。
- 诊断页保持项目现有医疗蓝、白卡和信息层级；E 区唯一新增视觉签名是生产滚轮的数字呼吸感。

## Task 4：自动门禁与语义审计

定向：

```powershell
pnpm --filter @schedule/miniprogram exec vitest run `
  scripts/ui-wheel-column.test.mjs `
  scripts/ui-wheel-column-simulate.test.mjs `
  scripts/gesture-probe.test.mjs `
  scripts/manual-matrix-poc.test.mjs `
  scripts/performance-budget.test.mjs `
  --fileParallelism=false
```

完整：

```powershell
pnpm miniprogram:test
pnpm --filter @schedule/miniprogram typecheck
pnpm --filter @schedule/miniprogram verify
pnpm --filter @schedule/miniprogram check:determinism
pnpm miniprogram:package-audit
pnpm miniprogram:ci:dry-run
pnpm build
pnpm typecheck
pnpm test
pnpm smoke:check-core
```

另运行任务文件 Prettier/ESLint、`git diff --check`、WXS 热路径/source/output/secret/package
审计。确认本阶段不修改 workflow picker、API、权限、网络、业务 emit、receiver、Promise/catch、
空值、幂等或写次数。

## Task 5：checkpoint、体验上传与实体停止门槛

- 更新 P7 RC、wheel pitfall、debug log 与 project status；详细证据保存在 Mini 文档，根状态保持
  ≤250 行。
- 显式暂存本任务路径，排除用户 `project.config.json`、群组 hunk、`.agents/`、Storybook 草稿、
  `runtime/`、根 `src/` 与工作簿。
- checkpoint 识别消息：`test(miniprogram): add WXS wheel capability probe`。
- 推送后从精确 clean checkpoint 上传 `.61` 之后的下一可用单调 production-profile 体验版；不提审、
  不正式发布。
- 创建生产数据库备份；从 clean release worktree 打包并按哈希门禁部署或 trusted reuse，随后执行
  allowlist ensure/verify、新版本七维 capability、未知版本 426、带公网 IP full verifier 与远端清理。
- 状态只能是 `已实现并完成自动验证 → 待实体 Android 探针复核`。

## 实体 Android 停止条件

用户在新体验版 E 区完成：

1. 慢速下一格后立即上一格 20 次。
2. 半格两侧反向与吸附中反向。
3. 连续快速 flick、点相邻行后立即拖动。
4. 顶/底边界各 10 次、重置 generation 10 次。
5. 核对 preview、settle、中心值、字号与透明度一致。

明确反馈通过前，不修改生产 `workflow-picker`，不进入设计规格阶段 B。
