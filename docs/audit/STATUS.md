# 微信小程序审计状态

- 当前阶段：通讯录弹层、拨号返回和工号别名修复已完成生产部署
- 状态：实现、推送、生产备份/部署和只读验证完成；体验上传和小米 14 待完成
- 任务起始应用 checkpoint：`18498a8b`；并行状态文档后当前基线：`01add026`
- 代码 checkpoint：`7952f1d1 fix(directory): preserve results and support employee aliases`，已推送
- 生产 release：`7952f1d106c65a5c3b8815ee0dc52756252f381a`
- 生产备份：`1a46cf22-4a78-4032-a1fd-5f3fb1583a2f`（55 表、195,074 行、87,707,540 bytes）
- 当前体验候选仍为：`0.1.0-p10.20260831.70@18498a8`；不包含本次修复
- 基线类型：clean HEAD 包体 + 用户脏树自动测试；无关用户文件保持排除

## 已实现

- 筛选弹层顶部 28px 专用横条区域支持下拉跟手、160ms 关闭和 180ms 回弹；8px 判轴、纵横比 1.2，关闭阈值为 96px，或 28px + 0.65px/ms。
- 手势只绑定横条区域，筛选列表不带动 Sheet；拖动由 WXS 直接改 transform/opacity，逻辑层 `setData=0`。下滑与“完成”共用 `closeFilters`。
- 横条、标题/完成、清除全部筛选均固定；只有层级和选项进入 flex scroll-view。
- workbench/独立页前台返回后台复核科室与人员 facets；上下文和发布批次未变时不清视图、不重建卡片、不发列表请求、不调用 `setData`。401/403、账号/群组/权限/版本变化仍立即清除。
- 导入同一不可变事务为字母前缀工号增加有限数字尾部/去前导零 source alias；API 对 3 位以上纯数字用当前 batch 的 `directory_search_aliases(normalized_value,type)` 索引预解析，工号 rank 750，电话精确/前缀 700/650 保留。
- 未新增 API 字段、contracts、迁移或依赖；权限、发布批次、姓名/拼音/首字母、电话号码、筛选、稳定排序和分页游标语义不变。

## 证据

| 项目         | 结果                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| 先红         | Mini 5、导入 1、API 2 项旧实现失败                                                                      |
| 定向         | Mini 3 files/45 tests；导入 13；API unit 2；MySQL integration 5 按环境跳过                              |
| 全量         | Mini 110 files/555 tests；root 244 files/1,139 tests，37 files/355 tests 按数据库环境跳过               |
| 构建与静态   | 全端 typecheck/build、Mini verify/source/package/performance/determinism/CI dry-run 通过                |
| 任务质量     | 任务 ESLint/Prettier/diff、`pnpm smoke:check-core` 通过                                                 |
| 工号实际结果 | production 当前发布批次只读验证 `D0468/d0468/0468/468` 均命中 D0468，各 1 条                            |
| 拨号返回回归 | 双 facets 后台复核；list request `+0`、`setData +0`，查询/卡片/分页/236px 滚动保持                      |
| 查询路径性能 | 三轮中位数的中位数 50.12→48.36ms（-3.5%）；P95 中位数 62.17→57.34ms                                     |
| 包体         | exact clean main 1,658,099→1,658,307 B；organization 1,201,831→1,210,386 B；total 5,204,815→5,213,578 B |

全仓 lint 仍只被未修改 `wx-request-executor.ts` 的既有 `prefer-const` 阻断；全仓 format 仍被既有约 385 文件基线阻断，任务文件单独严格通过。生产性能数字仅为只读数据库查询路径，不是端到端 HTTP；后者当前工具无法安全测量。

## 工具与未验证项

- 已读取并应用：`brainstorming`、`systematic-debugging`、`miniprogram-development`、`ui-design`、`ui-ux-pro-max`、`frontend-design`。
- 已使用：Git、Node、pnpm、TypeScript、Vitest、生产只读 SQL、SSH/SCP、项目构建/包体/确定性/CI/部署/verifier 脚本。
- 仓库禁止代理调用微信开发者工具 GUI/CLI；本轮未调用。
- WXS 原生触摸、遮罩/安全区、真实 Console/Network、端到端 HTTP、帧率和小米 14 当前构建均暂未验证。

## 唯一下一任务

从 exact clean `7952f1d1` 复核 production Mini 构建，单独报告拟上传 `.71` 的短 SHA、版本描述、脏树和测试页；取得当次明确批准后才能上传体验版。未取得匹配小米 14 证据前不得宣称真机通过，不提审、不正式发布。

停止条件：已向用户提交体验上传门禁信息；未获批准前停止在上传之前。
