# Web 运维手册

## 监控

```powershell
Invoke-WebRequest https://hosp.schedule.eylinhome.top/api/health
docker compose ps
docker compose logs --tail 100 api web nginx
```

关注 Web/API 可用性、5xx、延迟、认证失败、MySQL 连接/容量/慢查询、定时任务、备份、ECS 资源和证书到期。日志禁止记录密码、令牌和完整手机号。

浏览器推送异常时，先检查 `/opt/schedule/.env.production` 中三项 VAPID 值是否同时非空，再检查 API 容器是否已重建、`/etc/cron.d/schedule-notifications` 是否存在，以及平台任务中 `duty-reminders` 和 `notification-retry` 的最近运行结果。

## 备份与恢复

- 定时任务生成加密的全量逻辑备份和校验值；备份与密钥分离保存。
- `visitor_access_logs` 是 90 天在线原始隐私表，永久排除在新备份之外；格式 1 旧归档恢复时也必须跳过该表。匿名 `visitor_access_monthly_aggregates` 可正常备份恢复。
- 保留最近日备份及月度备份，恢复前先保护数据并记录版本。
- 恢复后核对群组、排班、事件、通知、统计、健康接口和浏览器 smoke。
- 每季度在隔离环境演练恢复；禁止用生产数据做本地开发样本。

## 访客 IP 隐私保留

- 原始 IP 只允许群主、群管理员、环境平台管理员和数据库 developer admin 查看；API 即使清理任务延迟，也不得返回 `created_at < now-90天` 的行，恰好等于边界的行保留。
- `/usr/local/lib/schedule/schedule-privacy-retention.sh` 由 `/etc/cron.d/schedule-privacy-retention` 每 15 分钟触发，并用 `/var/lock/schedule-privacy-retention.lock` 防并发。任务把过期行按群组、北京时间访问月份和查看月份聚合后，在同一事务中删除原始行并写脱敏审计。
- 检查 `platform_job_runs` 中 `privacy-retention` 最近状态和 `/var/log/schedule-privacy-retention.log`；失败摘要只能含 cutoff、批次/行数和 backlog，不得含 IP、request ID 或原始记录 ID。
- Nginx access log 只记录 method、`$uri`、status、bytes 和耗时，不记录来源 IP、query 或 `$request`；`X-Forwarded-For` 必须覆盖为 `$remote_addr`，API 只信任一个反向代理 hop。
- MySQL `binlog_expire_logs_seconds=2592000`、`general_log=OFF`；生产 verifier 同时检查 90 天以前原始行为 0、匿名表/索引、定时任务和容器日志隐私边界。

## 小程序脱敏遥测

- `POST /client-telemetry` 只接受成对且受支持的 Mini platform/version headers，不接收 Bearer、用户/群组/联系方式/凭证/IP/原始 stack/message/客户端时间或排班正文；版本只取服务端已验证 header。
- 单批最多 10 条、body 最大 16KiB。事件只含固定 page、device tier、network type、error code、性能 metric/duration 和本地脱敏后的 64 位 stack fingerprint；发送失败 best-effort 丢弃，不重试、不落 storage、不建立离线队列。
- Nginx 对 exact route 按来源 IP 做内存限流，API 另有不保留 IP 的全局分钟预算；没有遥测读取 API。
- `privacy-retention` 每 15 分钟删除严格早于 30 天 cutoff 的遥测行。`miniprogram_telemetry_events` 永久排除在备份/恢复之外；job summary 只记录数量和 cutoff。

## 小程序证据、包体与上传边界

- 拟上传产物必须来自最终提交的独立干净 worktree；不得复用主工作树混合 `dist`。构建资料需记录完整 SHA、Node/pnpm、lockfile、production profile、环境变量、版本号、描述和脏树状态。
- 修改前后包体只使用相同工具链、lockfile、profile、清理/构建/统计命令比较，并列出总包、主包、每个分包和最大文件差异。“release 运行时关闭”不等于代码未打包；必须静态检查重型诊断符号所在包。
- Web 黄金图、Node 自动化、`miniprogram-simulate` 和 dry-run 只属于辅助证据，不能写成微信原生 Console、交互手感或小米 14 体验版验收通过。
- 上传体验版前必须重新核对最终 SHA、未使用版本号、显示标识、AppID、目标环境和仓库外私钥来源，并取得用户对该 checkpoint 的当次明确批准。dry-run 不等于上传；不得输出私钥内容。
- 纯小程序或文档 checkpoint 不自动触发 production 部署、数据库备份或服务器 release 标识同步。小程序上传与 API/Web production 是两条独立发布轨道。

## 动态发布身份与基线冻结

- Prompt、示例、计划或状态文档中的版本、SHA 和 release 只能作为带来源与时间的观察记录，不能成为后续任务的永久默认值。状态文档可以保存一次已冻结证据，但下一轮必须重新发现，而不是照抄。
- 任务开始时发现当前授权允许确认的最新状态；无法取得新鲜来源时明确标为未知或过期，不猜测。需要区分：
  - 最新 `origin/main`：以本轮成功 fetch 后的远端引用为准；
  - 最新合格的已上传体验版：按小程序 CI runbook 的成功上传记录、clean SHA、production profile 和 Manifest 判定；
  - production 当前 live release：只有当前消息明确授权相应 `L4` 读取且实时查询成功后才能这样称呼，否则沿用的历史记录必须标记 `LIVE_RELEASE_VERIFIED=false`。
- 三者是独立身份，不因 SHA、时间或版本描述碰巧相同而互相证明。体验版上传不证明服务器已部署，`origin/main` 前进也不改变已上传体验版或 live release。
- 每次外部变更前重新核验受影响的身份和权限；若发现变化，先停止并重做 preflight。第一次外部变更开始时冻结本轮基线，记录发现时间、来源和三类身份中实际适用的值；操作途中不得静默切换到更新值。
- 体验版版本分配、不可变的版本/SHA/Manifest 绑定、无上传授权时的候选选择，以 [miniprogram-ci 运行手册](../../apps/miniprogram/docs/runbooks/miniprogram-ci.md#体验版版本分配与不可变身份) 为唯一事实来源。

## Production 回滚来源

- 如获当次明确授权执行 production 部署，rollback candidate 必须在部署前从服务器当前 live release 读取并核验；不得用上一个应用代码 checkpoint、旧聊天记录或本地猜测替代。

## 事故响应

- S1：数据丢失、服务不可用或需要恢复数据库。
- S2：定时任务、导出、通知或部分 API 持续异常。
- S3：单账号或单群组问题。

处理顺序：记录时间/版本/request ID → 保护数据或回滚 → 检查容器、API、MySQL、Nginx 和任务日志 → 修复 → 健康检查与关键业务复核 → 记录根因和预防措施。
