# 项目执行手册

本手册把重复出现的执行决策拆成按需章节。它只规定路由、门禁和停止条件；产品行为、
API 契约、数据库结构、视觉规格和发布命令仍以现有专题文档为准。

## 级别

| 级别 | 任务定义                   | 本轮上限                                                 |
| ---- | -------------------------- | -------------------------------------------------------- |
| L0   | 只读审计                   | 代码、Git、历史、日志和轻量静态检查                      |
| L1   | 普通修改或 bug 修复        | 受影响测试、lint、typecheck 或必要构建                   |
| L2   | 集成验收或最终候选         | 受影响应用完整门禁、production build、必要 browser smoke |
| L3   | 体验版或 release candidate | 精确 clean SHA、确定性构建、包体/测试对比和获批上传      |
| L4   | production 操作            | 实时 preflight、备份、发布、回滚检查和发布后验证         |

L1 是默认级别。L0–L3 不自动进入 production；L2/L3 不因验证通过而自动获得上传或部署授权。
只有当前任务直接、明确授权 production 时才进入 L4。每轮在开始时报告级别和最高门禁。

## 章节目录

| 任务类型                         | 章节                                       | 继续读取的权威文档                                          |
| -------------------------------- | ------------------------------------------ | ----------------------------------------------------------- |
| 微信小程序                       | [mini-program.md](mini-program.md)         | apps/miniprogram/AGENTS.md、apps/miniprogram/docs/README.md |
| 视觉、布局、触控、交互           | [visual.md](visual.md)                     | Web Storybook、Mini design/黄金清单、已批准设计规格         |
| 可复现失败或根因未知             | [debugging.md](debugging.md)               | pitfall 详情、精确 debug 日志和相关 Git 历史                |
| Web/API                          | [web-api.md](web-api.md)                   | local-setup.md、verification.md、相关 plan/spec             |
| 数据库、schema、索引、迁移       | [database.md](database.md)                 | directory-database.md、迁移/恢复/隐私运维文档               |
| 打包、体验上传、release worktree | [packaging-upload.md](packaging-upload.md) | aliyun-ecs.md、Mini CI/release runbook                      |
| production                       | [production.md](production.md)             | aliyun-ecs.md、operations/runbook.md                        |

## 通用启动顺序

1. 读根 AGENTS.md、project-status.md 和 pitfall-index.json。
2. 只读当前任务匹配的章节、技能和专题文档。
3. 核对 dirty tree、目标 SHA、lockfile 和工具链；有并行工作时使用仓库根级短路径的
   runtime/external-project-worktrees/，不要借用其他任务 worktree。
4. 先做最小可复现验证，完成后按同一口径复测；结果写入状态和本地台账。
5. 需要提交时，只显式暂存任务文件；完成 checkpoint 后再按根规则处理 push。

## 证据口径

静态检查、Node 自动化、Storybook、simulate、miniprogram-ci、用户人工开发者工具操作和
Xiaomi 14 体验版是不同证据层级，不能互相冒充。工具无法测量的内容写“当前工具无法测量，
暂未验证”。不把 token、Cookie、Authorization、手机号、openid、session、完整请求/响应或
生产数据写入报告。
