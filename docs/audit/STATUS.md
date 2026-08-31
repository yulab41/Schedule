# 微信小程序审计状态

- 当前阶段：通讯录性能诊断阶段 B，已取得 `.72@5fff288` 小米 14 数据并完成 API 日志对照
- 状态：阶段 B 代码、origin、production 与 `.73@c7c142e` 体验候选已同步并通过白名单/full verifier
- 任务起始 checkpoint：`eeba6402`；工作树保留并行用户修改
- 代码 checkpoint：`bb97145d perf(directory): add measured server timing diagnostics`，已推送
- production 应用 checkpoint：`bb97145dee8f8ee7a1ec4a57d532c60eb8f63625`
- 生产备份：`758c1a3b-d444-4bd1-879a-e675ae6276e5`（55 表、197,477 行、88,492,384 bytes）
- 最终 production release 元数据以 `docs(status): record directory phase b deployment` 识别
- 当前体验候选：`0.1.0-p10.20260831.73@c7c142e`，190 code files/2,517,609 bytes，manifest `6ed8b196…b89e4`
- 首次上传被微信 `20003 invalid ip: 38.190.176.204` 拒绝；用户登记该 IP 后，同一版本/SHA/描述重试成功
- 基线类型：同一用户工作树修改前/后静态构建；原生、Network、端到端 HTTP 未测

## 阶段 B 实测结论

- 两批共 17 条 Wi-Fi 记录全部以 request ID 对上 production API 完成日志，均为 HTTP 200；9 次完成、8 次被新搜索替代。
- 完成搜索中位：总计 1315ms、请求前 7ms、首字节 1216ms、API 总耗时 250ms、API 外差值约 992ms、返回后到可见 19ms。
- 客户端转换 0–1ms、卡片 0–2ms、单次完成约 3KB setData；没有证据支持大改转换、卡片或渲染。
- 8/17 被替代与 240ms 防抖、265–450ms 连续输入间隔一致；本批调整为 500ms，显式确认保持立即执行。
- API 仍有 14–1790ms 波动，现有日志不能分段；本批只加受控响应头诊断，不改 API body、数据库 schema/索引、权限锁和查询结构。

## 自动证据

| 项目       | 结果                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------- |
| 红绿定向   | 旧实现 Mini 3 项、API 1 项先红；实现后 Mini 3 files/65 tests、API 1 file/3 tests 全绿    |
| Mini 全量  | 110 files/563 tests 全绿                                                                 |
| 仓库全量   | 串行 245 files/1,142 tests 全绿；37 files/355 tests 按无数据库环境跳过                   |
| 构建与静态 | 全端 build/typecheck、Mini verify/source/package/performance/determinism/CI dry-run 通过 |
| 任务质量   | 任务 ESLint/Prettier/diff、数据报告构建与 `pnpm smoke:check-core` 通过                   |
| 包体       | 5,273,141→5,279,151 B（+6,010）；main 1,675,797→1,679,326 B（+3,529）                    |

当前主包 1.5M 和矩阵节点仍为基线 warning，门禁通过。`pnpm --filter @schedule/api test` 因现有根
Vitest `src/**` 排除规则在子包 cwd 找不到测试；根级全量实际执行全部 API 测试并通过。阶段 B 报告已由
Data App 预构建运行时校验，HTML SHA-256 `8a5d742b…cf53`，保存在 ignored `runtime/audit/`。

## 工具与未验证项

- 已读取并应用：`brainstorming`、`systematic-debugging`、`miniprogram-development`、`frontend-design`、
  `metric-diagnostics`、`analyze-data-quality`、`build-report`、`visualize-data`。
- 已使用：Git、Node、pnpm、TypeScript、Vitest、生产脱敏日志、Data App 构建器、项目构建/包体/
  确定性/CI/core-smoke 脚本。
- 仓库禁止代理调用微信开发者工具 GUI/CLI；本轮未调用。
- 当前实现后的 Server-Timing、原生自动搜索手感和 `.73` 端到端时间尚未真机验证；修改后数值不得估算。

## 唯一下一任务

用户在小米 14 `.73@c7c142e` 按首次、同条件第二次、不同关键词、带筛选、科室及可行时 Wi-Fi/移动
网络执行诊断，停止后复制最近 10 次给 Codex。

停止条件：匹配 `.73` 的小米 14 数据返回前，不修改数据库索引、权限锁、搜索查询结构或生产部署方式，
不填写修改后性能数字，不提审、不正式发布。
