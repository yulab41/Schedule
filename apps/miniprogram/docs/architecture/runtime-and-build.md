# 原生运行时与构建

## 运行时基线

| 项目           | 决策                                                                         |
| -------------- | ---------------------------------------------------------------------------- |
| 模板/样式/逻辑 | WXML、WXSS、TypeScript、JSON                                                 |
| 渲染           | 所有页面 Skyline                                                             |
| 组件框架       | `glass-easel`                                                                |
| 最低基础库     | `3.0.2`                                                                      |
| 回退           | 不提供 WebView 回退                                                          |
| Skyline 发布   | `disableABTest: true`，`sdkVersionBegin: 3.0.2`，`sdkVersionEnd: 15.255.255` |

`project.config.json` 的 `miniprogramRoot` 固定为 `dist/`。正式发布前将实际 Stable 编译基础库和微信客户端范围记录进 release 证据。

## 构建形态

源码位于 `src/`，构建产物位于 ignored `dist/`。P1 工具链必须提供：

1. 确定性复制 WXML、WXSS、JSON、字体和图像等静态文件。
2. 用 esbuild 打包普通共享 TypeScript；不得把 workspace symlink 留入产物。
3. 对包含 Worklet 的模块使用能够原样保留函数指令的编译路径。
4. 独立执行 `tsc --noEmit`，不得依赖已生成的共享包 `dist` 才能完成类型检查。
5. 构建后扫描 Worklet，验证 `'worklet'` 仍为函数第一条语句。
6. 扫描 Node built-in、DOM、数据库包、Zod、密钥、绝对本机路径和 source map 泄漏。
7. 对相同输入连续构建两次，以文件清单和 SHA‑256 证明确定性。
8. 审计主包、单分包和总包体积。

## 环境隔离

- staging 与 production 是两个编译期 profile，应用中没有隐藏环境切换入口。
- base URL 只能来自受审构建配置；AppSecret、Bearer、上传私钥和本地会话不得成为编译输入。
- CI 可以运行 build、simulate、包体和静态门禁；`miniprogram-ci` 可以生成预览/上传开发或体验版本。
- LLM 不得调用本地微信开发者工具 GUI 或 CLI。用户人工打开 GUI 只用于诊断，不构成自动验证链路。

## 当前 P0/P1 状态

- 外部 Skyline 模板已经过逐文件 SHA‑256 校验迁入。
- 正式 AppID 保留在 `project.config.json`；私有配置保留但被 Git 忽略。
- 默认模板首页和 navigation-bar 已移除，以无业务外观的技术 bootstrap 取代。
- `src → dist` 编译、源码/产物边界、包体、Worklet 指令、双构建确定性和无凭证 CI dry-run 门禁已完成。
- P1 基础控件批次新增从 `@schedule/ui-tokens` 单源生成并复制到 `dist/styles/tokens.wxss` 的路径；`app.wxss` 必须显式导入该文件，缺失或漂移由测试/产物审计阻断。
- 当前基础控件不含 Worklet；Worklet 计数为 0 属于预期。42 格月历三面板和双轴矩阵实现后必须出现并验证相应指令，不能以当前计数作为后续豁免。
