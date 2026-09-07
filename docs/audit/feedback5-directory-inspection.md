# Feedback5 通讯录首搜与工作池检查

2026-09-07；本轮获准只读检查生产，未切换配置、重启、部署、迁移或发送通知。

## 当前证据

- 用户小米14体验版 `.94@bfd1fbb` 冷启动记录：首次共4423ms，服务端4380ms，其中主查询4183ms；连接等待1ms，响应605B/1条，响应后显示18ms。后四次共242–608ms，均未复用客户端结果。
- 源码每查询分页30条，换词重新请求；不下载全量联系人，不在手机本地建立拼音搜索索引。首次延迟集中于服务端SQL，而非客户端转换或渲染。
- 本轮SSH只读查得 live `bfd1fbbdcf2594d66fde39bba6ae4f18b22798e1`，API配置 `DIRECTORY_QUERY_PLAN=legacy`；MySQL8.4.11，buffer pool128MiB，slow_query_log关闭、performance_schema开启。
- 0053迁移精确hash/时间对应唯一一行，候选覆盖索引存在且可见：`entry_id,type,normalized_value`，非唯一BTREE。当前schema54；未修改任何索引。
- 查询摘要只输出digest/次数/耗时/扫描量，未输出SQL或业务参数。最重摘要累计121次/15567739扫描行/358.347秒，最长29.525秒；次重156次/8394306行/120.080秒，最长9.877秒。两者磁盘临时表计数均0。这是累计证据，不能直接对应用户的单次请求。
- 应用DB账号无performance_schema权限；改用既有服务器管理通道只读取得上述摘要，未扩大应用权限。未清空数据库缓存，未运行EXPLAIN ANALYZE或生产压测。

## 结论与下一动作

- 既有候选查询在 `cc43e8c8` 实现，`50ac2d07` 补上线门禁；`d4bbab34` 明确把配置切换保留为独立审批。当前SQL与该验证版本一致，并非本轮漏写一份优化。
- 历史隔离测试证明结果/权限/分页等价，并显示首字母扫描量改善；不能用历史或热查询结果保证本次冷首搜已修复。
- 推荐下一步使用已有可信工具 `schedule-directory-query-plan candidate` 受控启用，不新增全量缓存或重复SQL。该动作会重建API，需要明确的生产变更授权，本轮未执行。
- 本轮只读复核安装工具与仓库脚本SHA256一致：`e7134bd009ea4b98d8e66ff4dc86cd0335d5457c3b173af2a3e2bcd380f7a0de`，服务器所有者root/权限755；未运行切换动作。
- 启用前复核即时live、索引与配置；失败按工具恢复legacy。后续用同版本诊断核对实际query plan与冷启动/无关词搜索耗时；达不到改善标准继续按证据定位，不宣称已解决。
- 本轮补充客户端诊断的计划枚举和实例年龄展示；当前legacy不运行candidate readiness，故不把readiness计时缺口当成本次原因。

## 本地验证与槽位

- 独占general-3集成槽：Acquire→ReuseOnly→root Bootstrap全命中，无依赖安装。`pnpm exec vitest run apps/api/src/modules/directory/directory-query-plan.spec.ts apps/api/src/modules/directory/directory-server-timing.spec.ts`：32通过，8.77秒。
- 用户授权核查旧槽位后，general-1的提交patch-id已合入main、无未提交修改、无活动进程；ReuseOnly通过。官方Register清除陈旧隔离状态后READY_REUSE，交给通知组独占使用。
- general-4/5本来空闲但旧依赖指纹不匹配、缺当前ui-icons工作区链接，单纯复位状态无法变成健康槽，未安装或手工伪造健康状态。
- general-2/6/icon-parity-1仍有历史未提交组合，部分不能精确证明已合入；原样保留，不因当前没有其他对话而丢弃。当前任务使用已确认健康槽即可并行。

## 微信只读配置旁证

本轮只输出布尔值核对：服务端模板已配置、与 `.94` 客户端模板一致、gateway已配置、externalMessages开启。不能据此推断已授权、模板字段正确或已送达；后续本人测试诊断单独验证。
