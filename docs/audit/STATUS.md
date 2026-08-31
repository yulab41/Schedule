# 微信小程序审计状态

- 当前阶段：通讯录半屏筛选与性能诊断阶段 A 已完成，等待小米 14 体验版诊断数据
- 状态：代码、origin、production 与 `.72@5fff288` 体验候选已同步并通过正式白名单/full verifier
- 任务起始 checkpoint：`eeba6402`；工作树保留并行用户修改
- 代码 checkpoint：`73811f1f feat(miniprogram): add directory performance diagnostics`，已推送
- production 应用 checkpoint：`73811f1f9204b7c482ab07de0287ebea4c57e693`
- 生产备份：`92af6f22-1d9e-47a2-b78d-e1de255c4fd2`（55 表、196,904 行、88,304,584 bytes）
- 最终 production release 元数据以 `docs(status): record directory diagnostics experience upload` 识别
- 当前体验候选：`0.1.0-p10.20260831.72@5fff288`，190 code files/2,504,558 bytes，manifest `9868c0c7…1a106c`
- 首次上传被微信 `20003 invalid ip: 38.190.176.204` 拒绝；用户登记该 IP 后，同一版本/SHA/描述重试成功
- 基线类型：同一用户工作树修改前/后静态构建；原生、Network、端到端 HTTP 未测

## 阶段 A 已实现

- 筛选 Sheet 按当前 `windowHeight/screenHeight/safeArea.bottom` 计算约半屏高度，横竖屏变化时重算；删除 `92vh/840px` 近全屏约束。
- 顶部横条、标题/完成、固定清除和底部安全区保持；只有一个 `scroll-view` 滚动，列表触摸不关闭 Sheet，筛选状态和滚动位置保持。
- “更多 → 测试工具”新增通讯录性能诊断：开始/停止、清空、最近记录、复制最近 1/10 次和小米 14 标准步骤。
- 每次记录关联请求前、网络、转换、卡片、`setData`、回调、下一渲染周期和隐私安全上下文；最多 20 条，只在 App 内存中。
- 不记录原词、姓名、号码、完整工号、账号/群组/权限、筛选值或游标；基础库无 profile 时写“不支持”。
- 代码确认纯关键词不等待完整 facets；只删除 controller 调 transport 前一层重复 capability 等待，transport/executor 安全门禁保持。
- 未改 API/contracts/数据库/索引/生产部署方式、搜索排序、筛选语义或缓存隔离；阶段 B 未做推测优化。

## 自动证据

| 项目 | 结果 |
| --- | --- |
| 定向 | Mini 6 files/84 tests；Web 辅助黄金 2 files/4 tests |
| Mini 全量 | 110 files/561 tests 全绿 |
| 仓库全量 | 串行 244 files/1,139 tests 全绿；37 files/355 tests 按无数据库环境跳过 |
| 构建与静态 | 全端 build/typecheck、Mini verify/source/package/performance/determinism/CI dry-run 通过 |
| 任务质量 | 任务 ESLint/Prettier/diff、Storybook build、`pnpm smoke:check-core` 通过 |
| 包体 | 5,213,637→5,273,141 B；main 1,658,306→1,675,797 B；organization 1,210,446→1,230,777 B |
| Web 视觉 | 390×844 Sheet 422px；320×700 Sheet 350px；测试工具 390/320 无横溢 |

包体首版曾增加约 83.6 KB；把 profile/request-ID 解析集中到诊断存储层后，最终增加 59,504 B。现有主包 1.5M 和矩阵节点提示仍为基线警告，门禁通过。上述 Web 尺寸只为辅助黄金，不等于微信原生或小米 14 通过。

## 工具与未验证项

- 已读取并应用：`brainstorming`、`systematic-debugging`、`miniprogram-development`、`frontend-design`。
- 已使用：Git、Node、pnpm、TypeScript、Vitest、项目构建/包体/确定性/CI/Storybook/core-smoke 脚本。
- 仓库禁止代理调用微信开发者工具 GUI/CLI；本轮未调用。
- 当前工具无法测量原生手感、真实 Console/Network、DNS/TLS profile 支持、服务端分段和小米 14 端到端时间，均暂未验证。

## 唯一下一任务

用户在小米 14 打开 `.72@5fff288`，从“更多 → 测试工具 → 通讯录性能诊断”清空并开始记录，按首次、同条件第二次、不同关键词、带筛选、科室及可行时 Wi-Fi/移动网络执行，停止后复制最近 10 次给 Codex。

停止条件：未收到匹配新体验版的“小米 14 通讯录性能诊断”复制文本前，不进入阶段 B，不修改正式 API contract、数据库索引或生产部署方式，不宣称搜索性能改善。
