# 微信小程序审计状态

- 当前阶段：阶段 0——规则落盘与修改前基线
- 状态：已完成
- 基线：`main@59b1f3c5`（与 `origin/main` 一致）
- 基线类型：当前工作树；包含已登记的用户未提交配置/测试/WXML，不是 clean release 基线
- checkpoint 标识：`docs(audit): establish miniprogram audit baseline`

## 本轮已完成

- 完整总规范已结构化保存到 `docs/audit/AUDIT_MASTER_PLAN.md`。
- 长期规则已加入根 `AGENTS.md`，并明确仓库的 `wechatide`/GUI/CLI 禁令优先。
- 已创建本状态、初始审计报告和小米 14 体验版验收协议。
- 已识别原生 TypeScript/WXML/WXSS/WXS、`src → dist`、Skyline、glass-easel、主包、四个普通分包、
  自绘导航、自建 API、请求/缓存和测试链路。
- 已完成生产静态构建、Mini/根类型检查、Mini 全量测试、Mini verify、包体、lint 和 format 基线。
- 未修改业务代码，未创建测试工具页，未修复 lint/format/包体问题，未调用开发者工具，未部署 ECS，
  未上传体验版。

## 核心基线

| 项目                      | 结果                                             |
| ------------------------- | ------------------------------------------------ |
| Mini production build     | 通过；2.60s；268 files                           |
| Mini TypeScript           | 通过；0 error；3.57s                             |
| Mini tests                | 107 files / 517 tests 全通过；80.11s             |
| Mini verify               | 通过；7.10s；3 个预警；Worklet 2/2               |
| 根 TypeScript             | 10 projects 通过；19.48s                         |
| ESLint                    | 未通过；1 error/0 warning；未修复                |
| Format check              | 未通过；387 files；未格式化                      |
| 主包                      | 1,636,609 bytes；超过内部 1.5 MiB 预警线，未阻断 |
| 总包                      | 5,107,804 bytes；未阻断                          |
| DevTools Console/Network  | 当前工具无法测量，暂未验证                       |
| 小米 14 体验版            | 本轮未上传、未测试、未验收                       |
| 文档 Prettier / diff      | 通过；无占位符                                   |
| Agent context / discovery | 2 files / 6 tests 通过                           |
| `pnpm smoke:check-core`   | 通过；未涉及 Web 核心链路                        |

详细命令、分包、最大文件和限制见 `docs/audit/wechat-miniprogram-audit.md`。

## 工具状态

- 已读取：`miniprogram-development`、`wechatide-skill`、initializer/compiler/debugger 规则。
- 可发现 `wechatide.cmd`，但仓库明确禁止代理调用 GUI/CLI，因此没有执行就绪检查或任何 DevTools 能力。
- 当前会话没有可调用的微信小程序/CloudBase MCP；项目也未使用 CloudBase。
- 已实际使用：Git、Node、pnpm、esbuild、TypeScript、Vitest 和项目包体/静态验证脚本。

## 未验证与外部状态

- Console/Network、冷启动、首页首次渲染、真实请求数、页面切换、键盘、安全区和原生 Skyline 表现。
- 小米 14 以及 iOS/其他 Android。不得写任何真机或全平台通过结论。
- 仓库既有 `.68@fe12db5` 仍等待用户实体设备复核；它不是本轮新上传的版本。
- 用户把本轮限制为读取、测量和文档创建；因此生产部署属于未获授权的范围扩展，本 checkpoint 不执行。

## 下一轮唯一建议任务

**阶段 1A：只读完成“主包、分包与重复打包”专项审计。**

理由：当前包体方面的唯一预警是主包 1,636,609 bytes，且 esbuild 显示生成的 calendar schema 在多个入口有较大
累计贡献。下一轮只追踪依赖图、入口归属、重复贡献和可迁移边界，按 P0～P3 格式形成有证据的问题清单
与低风险修复建议。

停止条件：更新审计报告后停止；不修改业务代码、不删除依赖、不创建测试工具页、不上传体验版。
