# 微信小程序审计状态

- 当前阶段：通讯录专项——代码 checkpoint 已发布
- 状态：自动验证与生产发布完成；体验版/小米 14 待验证
- 代码 checkpoint：`c2a57441 fix(miniprogram): repair directory filtering runtime`
- 生产 release：`c2a57441d3a337c512611b82d05740b4064928fa`
- 生产备份：`0c470222-b4a6-4ce6-b699-7c9df960a0dd`（55 表、193,410 行、87,157,532 bytes）
- 基线类型：当前用户脏树上开发、exact clean commit 打包；用户文件未进入提交
- 最终状态 checkpoint 标识：`docs(status): record directory runtime deployment`

## 本轮结果

- 修复 facets 未就绪仍可打开空筛选弹层；加载/失败时按钮在视觉、ARIA 和 handler 层禁用。
- 唯一活动 Sheet 打开时生成 options，关闭后释放；零层级明确显示“当前无需筛选”。
- 隐藏模式只保留逻辑原始结果和轻量 guide，切回时投影当前卡片，不在 data 常驻两套完整树/卡。
- 使用稳定 JSON 元组 `contextKey/baseQueryKey/pageRequestKey`，固定七级区分 `unset/all/value`。
- 同页 Promise 共享、完成空结果可复用；多页后重复确认无操作，强制刷新/重试真实发请求。
- 实例、上下文、主查询/页键、预期游标和已追加页共同隔离晚响应；卸载后不再 `setData`。
- 工作台传真实角色、开发管理员、群组版本和刷新序号；未知权限/版本时禁用完成复用。
- 401/403 清双模式；分页失败保留成功页，无效游标提供从头刷新；过渡卡禁止拨号/收藏/翻页。
- 主列表/弹层滚动按模式保存，弹层绑定 facets 批次；目标层级优先，节点挂载后恢复并夹紧。
- 未新增 API、contracts、数据库或依赖；服务端继续执行最终权限校验。

## 自动验证

| 项目                                                          | 结果                                                    |
| ------------------------------------------------------------- | ------------------------------------------------------- |
| 旧实现红灯                                                    | 查询模块缺失；controller 5 项预期失败                   |
| 定向回归                                                      | 9 files / 87 tests 通过                                 |
| Mini 全量                                                     | 108 files / 539 tests 通过                              |
| Web 通讯录黄金                                                | 10 files / 51 tests 通过                                |
| 全端 typecheck/build                                          | 通过                                                    |
| Mini verify/source/performance/package/determinism/CI dry-run | 通过                                                    |
| 任务 ESLint/Prettier/diff                                     | 通过                                                    |
| `pnpm smoke:check-core`                                       | 通过；未涉及 Web 核心链路                               |
| 全仓 lint                                                     | 既有 1 error：`wx-request-executor.ts:141 prefer-const` |
| 全仓 format                                                   | 既有 388 files；未接管                                  |
| 生产                                                          | hash-identical trusted reuse；公网 full verifier 通过   |

固定 fixture：初始 `setData` 10 次/13,386 B/最大 5,495 B → 6 次/4,053 B/最大
1,206 B；关闭驻留 72 → 0；重复确认请求 1 → 0；主体 2.61 → 1.49 ms；首次打开中位数
0.30 → 0.31 ms，满足 10% 波动门槛。最终 production manifest 为
`492269023bcf3fe6f62986d0d4dd945ef88d08647b1bca8fbce49b3b9ac4445c`，包体 5,134,389 B，
主包 1,637,688 B，继续只有既有 1.5 MiB 内部预警。

## 工具与未验证项

- 已使用 Git、Node、pnpm、TypeScript、Vitest、esbuild、miniprogram-ci dry-run 和既有发布脚本。
- 仓库禁止代理调用微信开发者工具 GUI/CLI；本轮没有调用，也没有上传体验版。
- Console/Network、原生节点挂载时序、真实帧率、键盘/安全区和小米 14 当前构建表现无法测量，暂未验证。
- facets 与条目来自原子导入批次，但两个 HTTP 请求可能跨发布；搜索响应无版本，本轮按会话内保守失效。

## 唯一下一任务

向用户报告候选短 SHA `c2a5744`、版本描述、当前用户脏树和测试页面，等待当次明确批准后才可上传体验版。
未批准则停止；不得提交审核、正式发布或宣称小米 14 已通过。
