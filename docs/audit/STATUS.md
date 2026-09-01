# 微信小程序审计状态

- 当前阶段：静态审计第 1 组“页面状态、异步链路与列表性能”及 docs-only 收口已完成
- 当前 clean 基线：`origin/main@1eb80e8413386f754a058d3270a2f55bb24aae43`
- 审计 worktree：`runtime/external-project-worktrees/static-audit-group1-20260901`
- 审计分支：`codex/audit-static-state-async-list-20260901`
- 当前小程序源码 checkpoint：`a2cdd0651783538a0aa6a566d30922391752d528`
- 历史验收提交 `d23a78a9d0f9769102957ecefd6f6781a37f06d2` 不是当前主线祖先；主线
  `a2cdd065` 已等价恢复 test-tools 的 Flex、四处 `word-break:break-all` 和明确截图类，当前目标
  Grid、`overflow-wrap:anywhere`、`:last-of-type` 均为 0，因此错误基线停止条件未触发
- 建立 worktree 后主线新增 `a9b9f52f`、`0e8f5f99`、`1eb80e84` 三个 docs/status/debug 提交；已在
  clean 状态下 `--ff-only` 同步，小程序源码未变化
- 用户主工作树及其他 P10、release、诊断和历史 worktree 均未修改、清理或覆盖
- 本轮未调用微信开发者工具 GUI/CLI、automator、Console、Network、预览或上传；未修改业务代码、
  API、数据库、索引、缓存、交互、allowlist 或 production

## 本轮结论

| 编号        | 等级 | 状态       | 结论                                                                                                                                        |
| ----------- | ---- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| MINI-G1-001 | P1   | 高可信候选 | workflow host 与部分直达页没有统一卸载/替换 generation；Node deferred 探针复现 detach 后 `setData` 与 A→B serial 碰撞，原生可见故障尚未验证 |
| MINI-G1-002 | P2   | 已确认     | 工作台同年五个月窗口发出 5 个完全相同的 holiday GET；多 4 个请求，真实 Network 耗时未测                                                     |
| MINI-G1-003 | P2   | 高可信候选 | scheduling rotation 每字符重建完整岗位×成员视图；4×100 合成 payload 为 56,171B，真机输入卡顿未验证                                          |
| MINI-G1-004 | P3   | 待运行证据 | platform accounts 与 group members 完整渲染且无明确分页上限；实际生产条数和渲染耗时未知                                                     |

- 未发现 P0，也没有把代码风格、节点数量或测试总耗时写成用户侧故障。
- 通讯录使用服务端搜索、500ms debounce、首批 30 条、稳定 query key、in-flight/完成结果复用以及
  instance/context/query/cursor 四层失效检查；未发现本地完整人员库拼音建索引或每字符全量筛选。
- 三次既有独立 App 首搜为 10,016/685/799ms；正常两次响应到下一渲染周期为 21/44ms，一次异常主要
  落在服务端主查询约 9.7 秒。当前只排除“稳定客户端首搜瓶颈”，服务端长尾仍按既有阈值观察。
- 1,445 节点归属主包 `manual-matrix-poc` 最大 20×30 fixture；1,506 节点归属 scheduling 分包正式
  `manual` editor。两者均非 App 首屏，滚动/惯性由 WXS `setStyle`，点格最多更新两个 cell path；结合
  历史目标 Android 20×30 验收，只保留 no-growth warning，不建立新的 P1/P2。

## 本轮自动证据

| 项目                 | 结果                                                                     |
| -------------------- | ------------------------------------------------------------------------ |
| 安装                 | `pnpm install --frozen-lockfile`；1,459 包本地复用、0 下载、锁文件未变   |
| workspace build      | 7 个 packages build 通过                                                 |
| 定向审计测试         | 8 files / 96 tests 通过                                                  |
| Mini 全量            | 111 files / 580 tests / 0 failure；70.78s                                |
| Mini verify          | 通过；main 1,677,803B、total 5,113,474B、Worklet 2/2、matrix 1,445/1,506 |
| 临时生命周期探针     | 2/2 通过；复现 detach late `setData` 和 serial collision；已删除         |
| 临时 scheduling 探针 | 1/1 通过；4×100 一字符 56,171B；已删除                                   |
| 临时 holiday 探针    | 1/1 通过；5 请求/1 唯一 URL；已删除                                      |

fresh worktree 首次 `miniprogram:verify` 因 workspace package 的 dist 尚未生成而失败；确认 exports 指向
缺失 dist 后只构建 workspace packages，原命令复跑通过。该偏差属于审计环境预构建顺序，不是业务源码
或审计工具错误。固定 5 秒冷测试超时只保留为测试基础设施线索，不能外推为小程序用户侧耗时。

## 已排除和保留边界

- test-tools 的 4 处换行、4 处 Grid、`:last-of-type`、Skyline Warning、真机验收均保持关闭；本轮只核对
  已验收语义仍在当前源码，不重新调查。
- automator `getPageMetaByWebviewId(...)=null` 未重开；绑定状态 503 没有新增调用链、参数或响应证据，
  未与本轮问题关联。
- 主包 1.5 MiB warning 只引用到下一轮“包体积与分包边界”，本轮不展开或重复立项。
- 没有当前 SHA 的原生 Console/Network 或小米 14 体验版证据；iOS、其他 Android 与大规模真实数据仍
  未验证。详细调用链、误判风险、修复与回归建议见 `docs/audit/wechat-miniprogram-audit.md`。

## 唯一下一任务与停止条件

唯一建议下一问题组：只处理 `MINI-G1-001`“异步生命周期失效边界”。先为 workflow host 和一个
organization 直达页写旧代码必红的 deferred 回归，再决定统一 generation/teardown；不得顺带处理
holiday、scheduling payload、分页、缓存、API 或数据库。

本轮 docs checkpoint 以 `docs(audit): complete static state and async review` 识别。文档校验、提交和推送
完成后停止；不开始修复，不上传、提审、正式发布、修改 allowlist、部署或创建生产备份。
