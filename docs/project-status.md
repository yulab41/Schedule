# Project Status

本文件是当前 Web 1.0 的交接入口；历史过程以 Git 提交为准。

## 当前状态（2026-08-14）

- 分支：`main`，上游：`origin/main`。
- 本轮目标：正式域名专属入口、关闭生产测试通道、微信开放平台网站扫码登录。
- 当前阶段：Checkpoint 1、2 的代码与本地验证已完成，生产发布待补齐微信网站应用凭据并执行服务器备份/发布核验。
- 生产规范入口：`https://hosp.schedule.eylinhome.top`。仓库当前生效配置不包含服务器公网 IP URL。
- 当前尚未修改生产服务器；没有写入或传输任何微信 AppSecret。

## 已完成检查点

### Checkpoint 1：正式网页认证

- 新增微信网站应用 OAuth 网关、`GET /auth/wechat/web/start` 和 `POST /auth/wechat/web/exchange`。
- 使用 HMAC 签名、5 分钟有效期和前端同源消息校验保护 OAuth state；授权码重复使用由微信错误映射拒绝。
- 新增 `user_auth_identities` 表和迁移 0035，区分小程序身份与网站身份；unionid 可关联同一业务用户，网站 openid 不覆盖小程序 openid。
- 新增网页扫码登录页、回调页、会话保存/恢复、扫码窗口关闭/超时提示；生产构建严格按 `MODE=development` 才显示本地开发按钮。
- 生产环境缺少完整网站 AppID、AppSecret、HTTPS 回调地址或会话密钥时启动失败；`AUTH_DEV_MODE=true` 和 `WECHAT_MOCK_MODE=true` 在生产拒绝。
- Checkpoint 1 提交：`12e7f40 feat(auth): add WeChat website QR login`，已推送 `origin/main`。

### Checkpoint 2：域名入口和测试通道收口

- Nginx 正式 Web server block 只服务 `hosp.schedule.eylinhome.top`；80/443 默认 server 对未知 Host/IP 拒绝，不跳转到正式域名、不返回项目首页/API。
- 生产 Compose 固定 `NODE_ENV=production`、`AUTH_DEV_MODE=false`、`WECHAT_MOCK_MODE=false`，API/数据库没有新增公网端口。
- ECS 更新/核验脚本不复用 ICP 测试 override，残留 override 会被发布清理并在核验时报错；核验新增未知 Host、IP、监听端口、开发认证和旧初始化账号检查。
- ICP 维护脚本不再生成 8080 自测入口；已删除 `scripts/start-ecs-test-tunnel.bat`；本地/CI 的 `compose.test.yml` 和 smoke 流程保留。
- 生产 release 打包脚本强制 `NODE_ENV=production` 且 `AUTH_DEV_MODE=false`。
- Checkpoint 2 提交信息：`fix(deploy): enforce domain-only production ingress`（提交前记录）。

## 运行验证

- `pnpm install --frozen-lockfile`：通过；本地 pnpm 首次因无 TTY 的依赖清理保护中止，使用锁文件恢复后通过。
- `pnpm build`：通过；Vite 仅报告既有的大 chunk 提示。
- API/Web/Contracts/Database TypeScript 检查：通过（直接使用各 workspace 的 `tsc`/`vue-tsc`，避免 pnpm 递归清理提示）。
- 定向 Vitest：44 项通过，覆盖环境拒绝、OAuth state、网站网关和前端会话。
- 全量 Vitest：57 个文件、438 项通过；29 个数据库集成文件、252 项按项目既有保护逻辑跳过（本机未提供测试 MySQL）。
- Nginx 配置语法/路由结构检查：通过 Docker Nginx 1.27 Alpine 静态校验；正式证书仍需在服务器上验证。
- 运行/浏览器验证：`pnpm smoke:browser` 通过，登录、管理员、成员、访客和访问记录流程无浏览器错误。
- 运行/核心校验：`pnpm smoke:check-core` 通过。
- `pnpm verify`：通过；包含格式、Lint、构建、类型检查，以及 57 个测试文件/438 项通过、29 个数据库集成文件/252 项跳过。
- `git diff --check`：通过。

## 外部配置与发布阻塞

正式扫码登录上线前，需要在服务器 `/opt/schedule/.env.production` 写入以下网站应用配置；不要把密钥发到聊天或提交 Git：

```dotenv
WECHAT_WEB_APPID=微信开放平台网站应用AppID
WECHAT_WEB_APPSECRET=微信开放平台网站应用AppSecret
WECHAT_WEB_REDIRECT_URI=https://hosp.schedule.eylinhome.top/auth/wechat/callback
```

微信开放平台“授权回调域名”只填写 `hosp.schedule.eylinhome.top`，不填协议、路径或服务器 IP。`WECHAT_SESSION_SECRET` 由部署脚本生成的随机值维护，不需要用户自行设计。小程序的 `WECHAT_APPID` / `WECHAT_APPSECRET` 与网站应用配置分开保留。

发布前还要：备份生产数据库和当前 release，上传正式 release，执行域名/HTTPS/未知 Host/API/扫码/权限核验，并确认没有 8080、3000、3001、3306、3307 公网监听。

## 下一批次与停止条件

- 下一批次（Checkpoint 3）：生成生产 release，补齐服务器网站应用凭据，执行备份、迁移、容器重建、`ecs-verify.sh` 和人工扫码权限验收。
- 停止条件：正式域名首页/API 正常；IP/未知 Host 不展示本项目；扫码登录、首次资料补全、管理员/普通成员权限和通知通过；测试通道关闭；回滚材料已记录。
