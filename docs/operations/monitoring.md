# 监控与告警

> 当前环境为“公网 + 单账号全局授权”妥协方案；涉及付费的正式告警（费用 70%/85%/100%、证书到期、MySQL 容量等）暂未配置，本文档先记录可立即使用的免费监控手段，再给出正式告警配置清单。

## 1. 可立即使用的监控手段（免费）

### 1.1 可用性

```powershell
$domain = "https://schedule-dev-d1geh4w1l4af7359d-1300188335.tcloudbaseapp.com"
Invoke-WebRequest -Uri "$domain/api/health" -UseBasicParsing   # 期望 200 + "ready"
Invoke-WebRequest -Uri "$domain/" -UseBasicParsing             # 期望 200
```

未登录业务请求应返回 401（网关鉴权生效）：`/api/users/me`。

### 1.2 定时任务健康

每个任务运行记录在 `platform_job_runs`，成功日志输出 `{"event":"cloudbase_job_completed","job":...,"runId":...}`，失败输出 `cloudbase_job_failed`。

平台管理员可查询最近任务：

```powershell
# 平台管理员 UID 调用 GET /api/platform/jobs（分页、cursor）
# 或直接在 CloudBase 控制台日志检索 runId/任务名
```

重点检查每个任务“最后成功时间”：

- `database-backup`：每日 02:00，同时写入 `backup_archives`。
- `duty-reminders`：每日 07:00（按群设置的提醒小时）。
- `export-jobs`：每 15 分钟。
- `notification-retry`：每 5 分钟。
- `group-recycle`：每日 03:00。
- `statistics-rebuild`：每日 03:30。
- `holiday-alerts`：每日 09:00。

### 1.3 业务风险

- 未补位空缺：排班发布/请假审批等被硬冲突或空缺阻塞时会返回 409，并写入 `conflict_detected` 通知；管理员应关注日历空缺标记。
- 长时间待审批：`leave_requests`/`swap_requests`/`duty_adjustments` 的 `pending_*` 状态需人工巡检；当前无自动告警。
- 备份状态：`GET /api/platform/backups` 检查最近归档与保留数量；本地恢复演练至少每季度一次（见 `docs/operations/backup-and-restore.md`）。

### 1.4 日志关联

- HTTP 响应头 `x-request-id` 关联同一请求的全部日志。
- 业务事件 `correlationId`/`operationId` 关联业务对象变更。
- 审计与事件表只允许 `SELECT`/`INSERT`，异常写入会直接失败，可借此发现权限漂移。

## 2. 正式告警配置清单（预算到位后）

在腾讯云控制台配置：

| 告警对象            | 建议规则                                                                   |
| ------------------- | -------------------------------------------------------------------------- |
| 网站可用性          | 自定义域名探测失败连续 3 次告警                                            |
| 证书到期            | 到期前 30/7/1 天告警                                                       |
| API 错误率/响应时间 | 5xx 比例、P95 响应时间阈值                                                 |
| MySQL               | 容量、连接数、慢查询数、备份状态                                           |
| 定时任务            | 任一任务超过预定间隔未成功运行                                             |
| 业务空缺            | 未补位空缺与待审批申请超时（如 24/48 小时）                                |
| 费用                | 月度预算 70%、85%、100% 三级告警；初期关闭不受控超额计费，确认容量后再开启 |
| CloudBase 用量      | 调用量、流量、资源点                                                       |

## 3. 值班与应急

- 应急响应流程见 `docs/operations/incident-response.md`。
- 回滚：`main` 回退到上一可用提交并重新部署，或手动 `tcb fn code update` 上传上一构建包；数据库回滚遵循迁移前备份流程，禁止直接删除已发布迁移。
- 当前妥协方案的已知风险（单账号全局授权、公网数据库、备份文件在临时盘）见 `docs/deployment/production-readiness.md` 第 5 节。
