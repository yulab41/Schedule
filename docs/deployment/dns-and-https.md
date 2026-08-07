# DNS 与 HTTPS

## 当前状态（2026-08-07）

- 入口：阿里云 ECS 公网 IP `http://8.148.183.46`（Nginx 容器 :80）。
- HTTPS：**未配置**；自定义域名与备案证书均未购买。
- 同域路由：`/` → Nginx 静态托管，`/api/*` → Fastify，`/api/health` 健康检查。

## 目标架构

```
用户 (IPv4)
  └─ https://schedule.example.com  （自定义域名 + HTTPS 证书）
       ├─ /          → Nginx 静态托管（SPA history 404 回落）
       └─ /api/*     → Nginx 反向代理 → Fastify
```

## 绑定自定义域名与 HTTPS 的步骤（预算到位后）

1. 完成 ICP 备案（见 `docs/deployment/icp-checklist.md`）。
2. 在域名服务商处把域名 A 记录指向 ECS 公网 IP。
3. 在 ECS 安全组放行 80/443 入方向，并收紧其余端口。
4. 签发 HTTPS 证书（阿里云免费证书或 Let's Encrypt），把证书挂载进 Nginx 容器并在 `infra/docker/nginx.prod.conf` 增加 443 server 与 80→443 跳转。
5. 验证：

```powershell
$domain = "https://schedule.example.com"
Invoke-WebRequest -Uri "$domain/api/health" -UseBasicParsing   # 期望 200 且含 "ready"
Invoke-WebRequest -Uri "$domain/" -UseBasicParsing             # 期望 200 返回应用外壳
```

6. 验证登录与业务请求：登录后 `/api/users/me` 返回 200，未登录返回 401。

## 注意事项

- 公网 IP 直连仅用于试用；正式入口必须使用备案域名 + HTTPS。
- 更换证书或 DNS 后，浏览器/代理缓存可能使旧内容短暂生效，验证时换新路径或等待缓存过期。
- 绑定正式域名后，更新 `docs/deployment/production-readiness.md` 验收对照表并下线公网 IP 入口。
