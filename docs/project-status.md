# Project Status

本文档只记录当前可安全接续的状态；详细历史以 Git 提交为准。

## 当前状态（2026-08-14）

- 分支：`main`，上游：`origin/main`。
- 正式入口：`https://hosp.schedule.eylinhome.top`。仓库当前生效配置不使用服务器公网 IP URL。
- Checkpoint 1（网站微信扫码认证）和 Checkpoint 2（域名专属入口、测试通道收口）已完成并已推送：`12e7f40`、`dec9943`。
- 用户确认无法取得微信开放平台网站应用，改用正式账号密码注册/登录。本轮已实现后端密码认证、前端注册/登录、scrypt 哈希、生产配置和迁移 0036；网站扫码代码暂保留为未来可选能力，但生产配置不依赖它，正式页面不显示扫码入口。
- 小程序凭据仍只用于小程序登录和通知。用户在聊天中发送过的小程序 AppSecret 按“已暴露”处理：本轮没有把它写入仓库、新 release 或服务器；正式发布前必须重置。小程序代码上传 `.key` 文件不是网页登录凭据，不需要上传或提交。
- 服务器只做过只读预检，尚未部署本轮 release；当前服务器仍需按新 release 执行迁移、重建和核验。现有服务器会话密钥已存在，网站 AppID/AppSecret 不再是阻塞项。

## 本轮已完成

- 新增 `POST /auth/password/register` 和 `POST /auth/password/login`，账号格式为 3-64 位字母、数字或 `._-`，密码至少 8 位。
- 新增 `user_password_credentials` 表和迁移 `0036_password_credentials`；不覆盖 `users.wechat_openid` 或现有小程序身份映射。
- 密码使用随机盐 scrypt 哈希；会话使用 `provider=password` 的签名 token，认证端会检查用户 active 状态。
- 生产配置要求 `AUTH_PASSWORD_ENABLED=true`、长度至少 32 的 `WECHAT_SESSION_SECRET`，并继续拒绝 `AUTH_DEV_MODE=true` 与 `WECHAT_MOCK_MODE=true`。
- Web 生产登录页改为账号登录/注册；本地开发构建仍保留仅开发模式可见的 smoke 登录按钮。
- Compose、ECS 核验脚本、迁移计数、部署文档和当前环境模板已同步。
- checkpoint commit：`de3ad5f feat(auth): add production password authentication`。

## 已运行验证

- `pnpm install --frozen-lockfile`：通过；此前本机生产依赖安装清理了开发依赖，已按锁文件恢复。
- API、Contracts、Database、Web 类型检查：通过（API/Contracts/Database 使用 `tsc`，Web 使用 `vue-tsc`）。
- `pnpm --filter @schedule/api test`：通过，88 个单元测试通过，26 个数据库集成文件因本机没有测试 MySQL 跳过；新增密码哈希/会话测试通过。
- `pnpm verify`：通过；59 个测试文件、445 个测试通过，29 个数据库集成文件因本机没有测试 MySQL 跳过。
- `pnpm smoke:browser`：通过；现有开发管理员、开发成员、访客排班和访客访问记录流程无浏览器错误。
- `pnpm smoke:check-core`：通过；已在 `docs/debug/debug-feedback-log.md` 记录“运行/浏览器验证：pnpm smoke:browser …”。
- 旧的 `dec9943` release 仅对应域名入口收口，不包含本轮账号密码代码；本轮需要重新生成 release。

## 下一批次与停止条件

下一批次为：

1. 将当前 `main`（包含代码 checkpoint `de3ad5f`）推送到 `origin/main`，并从当前 HEAD 生成生产包；
2. 先备份服务器数据库和旧 release，再按 `docs/deployment/aliyun-ecs.md` 发布并执行 `ecs-verify.sh`；
3. 在服务器上人工验收账号注册、登录、资料补全、权限和未知 Host 拒绝。

停止条件：正式域名首页/API 可用；未知 Host 不返回项目内容；注册、登录、资料补全和 401 会话清理人工验收通过；旧 8080 测试通道及开发认证没有恢复；小程序 AppSecret 已重置后再恢复小程序通知配置。
