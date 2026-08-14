# ECS 部署与上线

当前 Web 部署目标是阿里云 ECS + Docker Compose：Nginx、Fastify、MySQL 和定时任务。服务器不编译，构建和依赖准备在本机完成后上传。

## 入口与脚本

- Web 入口：`https://hosp.schedule.eylinhome.top`；正式公网访问使用备案 HTTPS 域名。
- `/` 由 Nginx 托管，`/api/*` 转发 Fastify，`/api/health` 为健康检查。
- 新机：`infra/scripts/ecs-bootstrap.sh`。
- 更新：`infra/scripts/ecs-update.sh`。
- 核验：`infra/scripts/ecs-verify.sh`。
- HTTPS：`infra/scripts/enable-https.sh`。

## 发布顺序

1. 本地运行 `pnpm verify` 和 `pnpm --filter @schedule/web build`。
2. 在本机生成一次 Web dist、API runtime、迁移、版本清单和 Docker 所需文件；服务器不重新编译或安装依赖。
3. 上传 `schedule-dist.tar.gz`、`api-flat.tar.zst` 和 `deploy-manifest.json`，执行 `ecs-update.sh`。
4. 核对 commit、版本清单、归档 hash、容器状态、迁移、日志、Web 首页和 `/api/health`。
5. 运行生产浏览器 smoke；失败时保留上一可用版本。

## 部署铁律

- 2G 机器只运行一个入口和共享 MySQL；设置容器内存上限、日志轮转和磁盘清理。
- API runtime 依赖从 lockfile 生成，禁止服务器现场安装造成依赖漂移。
- 同一次本机构建的部署清单必须与 ECS 的 release 归档 hash 和当前 commit 完全一致。
- 迁移前备份，迁移、重启、健康检查按固定顺序执行。
- 浏览器推送必须在服务器 `.env.production` 中同时配置 `VAPID_SUBJECT`、`VAPID_PUBLIC_KEY` 和 `VAPID_PRIVATE_KEY`；三项缺一不可，私钥不得进入仓库或 Web 产物。
- `/usr/local/bin/schedule-notifications` 每分钟串行执行 `duty-reminders` 和 `notification-retry`；任务使用 `flock` 防止重入，并写入平台任务记录。
- 生产环境使用 `NODE_ENV=production`、独立数据库和最小权限账号；开发认证不得上线。
- 生产入口只接受 `hosp.schedule.eylinhome.top`；IP 和未知 Host 由共享 Nginx 拒绝，不返回项目页面、不跳转到正式域名。
- 不对外发布 API、数据库或测试端口；未来站点使用自己的域名和内部 upstream，不复制本项目的默认 Host 配置。

## 上线前清单

- 完成 ICP 备案、域名和证书配置。
- 完成正式账号认证，关闭开发认证。
- 完成备份恢复演练、迁移升级测试、安全检查和浏览器 smoke。
- 明确回滚版本、负责人、监控阈值和验收窗口。

## 更新命令

本地构建完成后，使用生产环境变量运行 `pnpm ecs:package` 生成 `runtime/ecs-release/`，然后将三个文件上传到 ECS：

```bash
NODE_ENV=production AUTH_DEV_MODE=false pnpm ecs:package
bash infra/scripts/ecs-update.sh \
  /tmp/schedule-dist.tar.gz \
  /tmp/api-flat.tar.zst \
  /tmp/deploy-manifest.json
bash infra/scripts/ecs-verify.sh
```

当前生产入口由共享 Nginx 暴露 80/443，并按域名分流；本项目只有 `hosp.schedule.eylinhome.top` 的 server block。API 健康检查使用该域名下的 `/api/health`，不保留 8080 测试隧道。

## 微信网页登录配置

浏览器扫码登录使用微信开放平台的“网站应用”，与小程序 `WECHAT_APPID` / `WECHAT_APPSECRET` 分开配置：

```dotenv
WECHAT_WEB_APPID=网站应用AppID
WECHAT_WEB_APPSECRET=网站应用AppSecret
WECHAT_WEB_REDIRECT_URI=https://hosp.schedule.eylinhome.top/auth/wechat/callback
```

在微信开放平台填写授权回调域名时只填 `hosp.schedule.eylinhome.top`，不要填协议、路径或服务器 IP。`WECHAT_WEB_APPSECRET` 只写服务器 `/opt/schedule/.env.production`，不发到聊天、不提交 Git；`WECHAT_SESSION_SECRET` 由部署流程生成并同样只留在服务器。

## 浏览器推送配置

首次启用或更换服务器时，在 `/opt/schedule/.env.production` 中写入同一对长期 VAPID 密钥：

```dotenv
VAPID_SUBJECT=https://hosp.schedule.eylinhome.top
VAPID_PUBLIC_KEY=生成的公钥
VAPID_PRIVATE_KEY=生成的私钥
```

使用 `web-push` 生成密钥对：

```bash
node -e "const webpush=require('web-push');console.log(webpush.generateVAPIDKeys())"
```

`VAPID_SUBJECT` 可以直接使用生产站点的 HTTPS 地址，不需要真实邮箱、SMTP 或邮件服务。写入后必须按正常 ECS 更新流程重建 API 容器；仅修改环境文件不会改变已经运行的 Node 进程。不要更换已经投入使用的 VAPID 密钥，否则已有浏览器订阅需要重新注册。
