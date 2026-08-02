# DNS 与 HTTPS

## 当前状态（2026-08-02 妥协方案）

- 入口：CloudBase 默认开发域名 `https://schedule-dev-d1geh4w1l4af7359d-1300188335.tcloudbaseapp.com`。
- HTTPS：由 CloudBase 默认证书提供，实测 `GET /api/health` 与首页均 200。
- 同域路由：`/` → 静态托管，`/api` → `schedule-api` 云函数（网关鉴权开启、路径透传），`/api/health` 匿名。
- 正式自定义域名、CNAME、备案证书均**未配置**（涉及付费，已按用户决定跳过）。

## 目标架构

```
用户 (IPv4)
  └─ https://schedule.example.com  （自定义域名 + HTTPS 证书）
       ├─ /          → CloudBase 静态网站托管（SPA history 404 回落）
       └─ /api/*     → CloudBase HTTP 访问服务 → schedule-api（网关鉴权）
```

前端与 API 使用同一域名，避免跨域；CloudBase CDN/HTTP 入口负责 IPv4 访问，不要求用户直接访问公网 IP。

## 绑定自定义域名的步骤（预算到位后）

1. 完成 ICP 备案（见 `docs/deployment/icp-checklist.md`）。
2. 在 CloudBase 控制台 → 环境 → 域名管理，绑定自定义域名。
3. 在域名服务商处添加 CNAME 记录，指向 CloudBase 分配的 CNAME 地址。
4. 等待证书签发（CloudBase 自动申请/绑定 HTTPS 证书），或上传自有证书。
5. 在 CloudBase 控制台 → 环境配置 → Web 安全域名中，把新域名加入安全域名列表。
6. 更新 HTTP 访问服务路由：静态托管与 `/api` 云函数路由均切换到自定义域名（原默认域名可保留但不再作为正式入口）。
7. 更新 GitHub `development` 环境变量 `CLOUDBASE_DEV_DOMAIN` 为新的正式域名（部署健康检查会轮询该域名）。
8. 验证（PowerShell）：

```powershell
$domain = "https://schedule.example.com"
Invoke-WebRequest -Uri "$domain/api/health" -UseBasicParsing   # 期望 200 且含 "ready"
Invoke-WebRequest -Uri "$domain/" -UseBasicParsing             # 期望 200 返回应用外壳
```

9. 验证登录与业务请求：登录后 `/api/users/me` 返回 200，未登录返回 401。

## 注意事项

- CloudBase 默认域名只用于开发和内部测试；2025 年 10 月之后新建环境的默认域名会保留访问提示中间页，正式环境必须绑定备案自定义域名。
- 修改 CNAME/证书后，CDN 缓存可能使旧路径短暂生效，验证时换新路径或等待缓存过期。
- 绑定正式域名后，把 `docs/deployment/production-readiness.md` 的验收对照表更新为满足状态，并下线默认域名入口。
