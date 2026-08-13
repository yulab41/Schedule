# DNS 与 HTTPS

## 当前状态

- Web 入口：`https://hosp.schedule.eylinhome.top`。
- DNS：子域名 A 记录指向当前 ECS 公网 IP。
- HTTPS：Let's Encrypt 证书，自动续期；HTTP 重定向 HTTPS。
- 路由：`/` 由 Nginx 托管，`/api/*` 转发 Fastify，`/api/health` 为健康检查。

## 变更步骤

1. 更新 DNS A 记录并等待解析。
2. 在 ECS 执行 `enable-https.sh` 或等价 ACME 配置。
3. 验证证书链、HTTP 重定向、Web 首页和 `/api/health`。
4. 记录证书到期时间与自动续期日志。

公网正式入口必须使用备案域名和 HTTPS；IP 直连只用于开发验证。
