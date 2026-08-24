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

## 事故响应

- S1：数据丢失、服务不可用或需要恢复数据库。
- S2：定时任务、导出、通知或部分 API 持续异常。
- S3：单账号或单群组问题。

处理顺序：记录时间/版本/request ID → 保护数据或回滚 → 检查容器、API、MySQL、Nginx 和任务日志 → 修复 → 健康检查与关键业务复核 → 记录根因和预防措施。
