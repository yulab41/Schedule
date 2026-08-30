# 微信小程序审计状态

- 当前阶段：“更多 → 测试工具”体验候选已上传
- 状态：自动验证、生产发布、体验上传和客户端白名单完成；微信开发者工具与小米 14 待人工复核
- 代码 checkpoint：`18498a8b feat(miniprogram): add safe test tools`，已推送
- 体验候选：`0.1.0-p10.20260831.70@18498a8`
- 上传结果：188 files / 2,444,502 bytes；manifest `8c4dae56…7287b`
- 生产 release：`18498a8b6b19991dd27a0590eb97602519725fbb`；hash-identical trusted reuse
- 生产备份：`68902f0f-a5eb-4a56-963a-e78829862086`（55 表、194,887 行、87,642,424 bytes）
- 基线类型：用户脏树上测量、exact clean commit 构建/上传；无关用户文件未进入 checkpoint
- 最终状态 checkpoint 标识：`docs(status): record test tools experience upload`

## 本轮结果

- “更多 → 测试工具”入口改为真实诊断页；页面位于非首屏 `subpackages/diagnostics`，旧手势探针保留并从“交互检查”进入。
- develop/trial 显示且允许访问；release 不显示入口，直接测试工具页和旧手势探针均在采集/手势初始化前返回工作台。
- App 只在 develop/trial 创建诊断仓库；release 不创建仓库。未新增 `onNetworkStatusChange`、内存或其他运行时监听。
- 诊断只读、进程内存有界：最近请求 20、错误 10、性能 12；不持久化、不上传、不提供清空业务缓存。
- 请求仅保留方法、脱敏路径、时间、耗时、状态、重试和近邻重复标记；查询、动态 ID、Header、body 与响应不进入仓库。
- 错误只保留固定分类和 SHA-256 指纹；完整/Codex 报告不含凭证、身份、联系方式、成员、正文、存储键值或原始堆栈。
- 版本卡新增 Git SHA、构建时间、安全版本描述、dirty 标记、API profile、微信环境和小程序版本；无 CloudBase/npm 产物时明确说明。
- 页面提供设备/屏幕/安全区、显示检查、关键场景、性能、网络、错误、存储摘要及一次复制报告；文案逐项说明影响和截图位置。
- 未新增依赖；未修改 API、数据库、权限、认证、业务请求重试/Header/body/异常、业务 `setData` 或无关业务页面。

## 环境保护矩阵

| 环境    | “更多”入口 | 直接测试工具页 | 旧手势探针 | App 诊断仓库 |
| ------- | ---------- | -------------- | ---------- | ------------ |
| develop | 显示       | 允许           | 允许       | 创建         |
| trial   | 显示       | 允许           | 允许       | 创建         |
| release | 隐藏       | 返回工作台     | 返回工作台 | 不创建       |

## 自动验证与包体

| 项目                                                          | 结果                                                                |
| ------------------------------------------------------------- | ------------------------------------------------------------------- |
| 旧实现红灯/引入点                                             | `712aa4ee` 将入口写死为 true；旧 HEAD 门禁按预期失败                |
| 定向回归                                                      | 8 files / 65 tests；Web 黄金 2 tests 全通过                         |
| Mini 全量                                                     | 109 files / 548 tests 全通过                                        |
| 根测试                                                        | 243 files / 1,137 tests 通过；37 files / 355 tests 无数据库环境跳过 |
| 全端 typecheck/build                                          | 通过                                                                |
| Mini verify/source/performance/package/determinism/CI dry-run | 通过；clean 2/2 Worklet；manifest `f4ae3085…a5bfd`                  |
| 任务 ESLint/Prettier                                          | 通过；既有 `wx-request-executor.ts prefer-const` 按要求保持不改     |
| 诊断分包敏感模式扫描                                          | 通过；无凭证、身份、手机号、UUID 或原始请求模式                     |
| 390/320/大字号 Web 黄金                                       | 无横向溢出；页面内 6 个按钮均 ≥44px；页面错误 0                     |
| `pnpm smoke:check-core`                                       | 通过；未涉及 Web 核心链路                                           |

包体同口径：主包 `1,637,688 → 1,658,098` B；scheduling `420,884 → 422,480`；organization
`1,197,103 → 1,201,891`；workflows `821,914 → 825,106`；insights `1,056,800 → 1,061,589`；
新增 diagnostics `35,710`；总包 `5,134,389 → 5,204,874` B。主包仍只有既有 1.5 MiB 预警，未到 1.8 MiB 阻断线。
上传追踪标签写入后的最终 dist 为主包 1,658,565 B、diagnostics 35,728 B、总包 5,205,623 B；差异仅来自可追溯版本元数据。

## 工具与未验证项

- 已读取：`brainstorming`、`miniprogram-development`、`frontend-design`、`systematic-debugging`、`previewer` 及其安全/发布参考。
- 已实际使用：Git、Node、pnpm、TypeScript、Vitest、esbuild、Storybook、Playwright、项目包体/静态/安全脚本与 Node `miniprogram-ci`。
- 仓库禁止代理调用微信开发者工具 GUI/CLI；本轮没有调用。体验版从 exact clean commit 经 Node `miniprogram-ci` 上传。
- DevTools 编译与 Console/Network、Skyline 原生布局、真实首屏/帧率、键盘和小米 14 均暂未验证。
- 390/320 Web 黄金仅证明辅助布局边界，不能证明微信运行时或手机端验收通过。
- `.70` 已通过正式 allowlist ensure/verify；重建预热的一次 TLS EOF/一次 502 在受控等待内恢复，公网完整 verifier 随后通过。未提审、未正式发布。

## 唯一下一任务

用户在小米 14 打开 `.70@18498a8`，截图版本条、设备与安全区、显示检查和交互探针，并复制 Codex 简化报告；另由用户在微信开发者工具编译同一 checkpoint 并检查 Console。未取得匹配 SHA 真机证据前不得宣称验收通过；不得提审或正式发布。
