# Web 监控

## 免费基础检查

```powershell
Invoke-WebRequest https://hosp.schedule.eylinhome.top/api/health
docker compose ps
docker compose logs --tail 100 api web nginx
```

## 关注指标

- Web/API 可用性、5xx、延迟和认证失败。
- MySQL 连接数、容量、慢查询和备份状态。
- 定时排班、通知、统计和备份任务的最近成功时间。
- ECS CPU、内存、磁盘、带宽和证书到期时间。

正式费用、证书、容量和恢复告警需绑定负责人和升级渠道；日志禁止记录密码、令牌和完整手机号。
