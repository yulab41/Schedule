# DNS 与 HTTPS

## 当前状态（2026-08-08）

- 入口：`https://hosp.schedule.eylinhome.top`（HTTPS 已验证，HTTP 自动跳转 HTTPS）；公网 IP `http://120.77.220.79` 保留为备用 HTTP 入口。
- 域名：`hosp.schedule.eylinhome.top` 已绑定本项目（A 记录 → `120.77.220.79`）。
- HTTPS：已启用 Let's Encrypt 免费证书（2026-11-06 到期，certbot 自动续期），HTTP/2 已开启。
- 同域路由：`/` → Nginx 静态托管，`/api/*` → Fastify，`/api/health` 健康检查。

## 目标架构

```
用户 (IPv4)
  └─ https://schedule.example.com  （自定义域名 + HTTPS 证书）
       ├─ /          → Nginx 静态托管（SPA history 404 回落）
       └─ /api/*     → Nginx 反向代理 → Fastify
```

## 绑定自定义域名与 HTTPS 的步骤

> 已按以下流程完成 `hosp.schedule.eylinhome.top` 的绑定（2026-08-08）；后续新增子域名可复用。

1. 用户提供域名与想用的子域名（例如 `schedule.example.com`；已用于其它网站的域名请用新子域名避免冲突）。
2. 确认域名已完成 ICP 备案且当前 ECS 已纳入备案（见 `docs/deployment/icp-checklist.md`；阿里云大陆服务器会对未备案域名拦截 80/443）。
3. 在域名 DNS（阿里云云解析或当前服务商）添加 A 记录：主机记录填子域名前缀（如 `schedule`），记录类型 A，记录值 `120.77.220.79`，TTL 默认。
4. 安全组已放行 80/443（本轮已完成）。
5. 在服务器执行 `bash /opt/schedule/infra/scripts/enable-https.sh <域名>`（自动安装 certbot、签发证书、改写 Nginx 配置并设置自动续期）。
6. 验证：

```powershell
$domain = "https://schedule.example.com"
Invoke-WebRequest -Uri "$domain/api/health" -UseBasicParsing   # 期望 200 且含 "ready"
Invoke-WebRequest -Uri "$domain/" -UseBasicParsing             # 期望 200 返回应用外壳
```

7. 验证登录与业务请求：登录后 `/api/users/me` 返回 200，未登录返回 401；再用 `pnpm smoke:browser`（`SMOKE_BASE_URL=https://域名`）做公网浏览器冒烟。

## 注意事项

- 公网 IP 直连继续保留为默认 HTTP 入口；绑定域名后，域名请求走 HTTPS，IP 请求仍可访问。
- 更换证书或 DNS 后，浏览器/代理缓存可能使旧内容短暂生效，验证时换新路径或等待缓存过期。
- 绑定正式域名后，更新 `docs/deployment/production-readiness.md` 验收对照表并下线公网 IP 入口。
