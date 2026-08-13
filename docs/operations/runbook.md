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
- 保留最近日备份及月度备份，恢复前先保护数据并记录版本。
- 恢复后核对群组、排班、事件、通知、统计、健康接口和浏览器 smoke。
- 每季度在隔离环境演练恢复；禁止用生产数据做本地开发样本。

## 事故响应

- S1：数据丢失、服务不可用或需要恢复数据库。
- S2：定时任务、导出、通知或部分 API 持续异常。
- S3：单账号或单群组问题。

处理顺序：记录时间/版本/request ID → 保护数据或回滚 → 检查容器、API、MySQL、Nginx 和任务日志 → 修复 → 健康检查与关键业务复核 → 记录根因和预防措施。
