# ECS 部署与正式上线

正式网页入口是 `https://hosp.schedule.eylinhome.top`。共享 Nginx 只按域名分流：本项目只响应这个域名，未知 Host 不返回项目首页，也不跳转到正式域名。API、MySQL 和其他站点服务不新增公网端口。

## 本地生成 release

服务器不负责安装依赖或编译。完成本地验证后，在仓库根目录执行：

```bash
RELEASE_COMMIT="$(git rev-parse HEAD)"
ROLLBACK_CANDIDATE="<已审计且已保留在服务器的40位release>"
NODE_ENV=production AUTH_DEV_MODE=false AUTH_PASSWORD_ENABLED=true \
ECS_RELEASE_EXPECTED_COMMIT="$RELEASE_COMMIT" \
ECS_ROLLBACK_CANDIDATE="$ROLLBACK_CANDIDATE" \
pnpm ecs:package
```

打包器会先重建工作区，并要求 Git tracked/untracked 均干净、commit 与显式变量一致、rollback candidate 是当前 commit 的祖先；六个发布 shell 必须为 LF 且逐文件通过 `bash -n`。将 `runtime/ecs-release/` 中的三个产物，以及同一 commit 的 `infra/scripts/ecs-update.sh`、`infra/scripts/ecs-verify.sh`，上传到服务器独立临时目录。不要复用来源不明的旧 `/tmp/ecs-*.sh`。

成功部署后，归档内的 updater、verifier、rollback、capability switch 和数据库备份脚本会以 root 所有、不可被组/其他用户写入的形式安装到 `/usr/local/lib/schedule` 或 `/usr/local/bin`，并由独立 control-plane manifest 校验。应用回滚只回退 `/opt/schedule` 应用产物，控制面保持前向版本。

从 Windows 上传后仍在服务器复核 LF 与 `bash -n`。示例：

```bash
RELEASE_ID="$(sed -nE 's/.*"releaseId"[[:space:]]*:[[:space:]]*"([0-9a-f]{40})".*/\1/p' /tmp/deploy-manifest.json | head -1)"
[[ "$RELEASE_ID" =~ ^[0-9a-f]{40}$ ]] || { echo "invalid release id" >&2; exit 1; }
SCRIPT_DIR="/tmp/schedule-release-${RELEASE_ID}"
sed -i 's/\r$//' "$SCRIPT_DIR/ecs-update.sh" "$SCRIPT_DIR/ecs-verify.sh"
bash -n "$SCRIPT_DIR/ecs-update.sh"
bash -n "$SCRIPT_DIR/ecs-verify.sh"
bash "$SCRIPT_DIR/ecs-update.sh" \
  /tmp/schedule-dist.tar.gz \
  /tmp/api-flat.tar.zst \
  /tmp/deploy-manifest.json
bash "$SCRIPT_DIR/ecs-verify.sh"
```

发布前必须先备份生产数据库和当前 release。发布失败时保留上一份可用 release，不要删除其他站点的容器或配置。部署后的显式应用回滚只接受当前 manifest 中的单一审计前驱，并在回退前再做数据库备份、artifact/hash/path/schema 兼容检查；回退后完整校验失败会自动前滚原版本：

```bash
sudo schedule-ecs-rollback <当前manifest声明的40位rollbackCandidate>
```

## 生产认证配置

正式网页使用账号密码注册/登录，不依赖微信开放平台的网站应用。生产 `/opt/schedule/.env.production` 至少要包含：

```dotenv
NODE_ENV=production
AUTH_DEV_MODE=false
AUTH_PASSWORD_ENABLED=true
WECHAT_SESSION_SECRET=服务器上的随机长密钥
MINIPROGRAM_SUPPORTED_CLIENT_VERSIONS=0.1.0-p6.20260824.78,0.1.0-p6.20260824.79,0.1.0-p6.20260824.80,0.1.0-p6.20260824.81,0.1.0-p7.20260824.85,0.1.0-p7.20260824.86,0.1.0-p7.20260824.87
MINIPROGRAM_LEGACY_CLIENT_VERSION=0.1.0-p6.20260824.78
MINIPROGRAM_CAPABILITY_GLOBAL_ENABLED=true
MINIPROGRAM_CAPABILITY_CORE_ENABLED=true
MINIPROGRAM_CAPABILITY_WORKFLOWS_ENABLED=true
MINIPROGRAM_CAPABILITY_ORGANIZATION_ENABLED=false
MINIPROGRAM_CAPABILITY_INSIGHTS_ENABLED=false
MINIPROGRAM_CAPABILITY_EXTERNAL_MESSAGES_ENABLED=false
MINIPROGRAM_CAPABILITY_GUEST_ENABLED=true
```

`.env.production` 必须由 root 所有且权限为 `0600`。`WECHAT_SESSION_SECRET` 由部署流程生成并只保留在服务器。七维能力开关必须逐项显式配置；使用 `sudo schedule-client-capability <global|core|workflows|organization|insights|externalMessages|guest> <true|false>` 原子切换并自动探测，禁止手工输出整份环境文件。账号密码接口是：

- `POST /api/auth/password/register`
- `POST /api/auth/password/login`

密码保存在独立的 `user_password_credentials` 表中，使用带随机盐的 scrypt 哈希，服务器和前端都不会保存或打印明文密码。

小程序的 `WECHAT_APPID` / `WECHAT_APPSECRET` 仍只用于小程序登录和微信通知能力。小程序 AppSecret 如果曾发到聊天、工单或截图中，必须先在微信公众平台重置；不要把重置前后的密钥提交 Git。小程序代码上传 `.key` 文件不是网页登录密钥，也不能放进项目目录、服务器配置或 Git。

首次注册的账号默认为普通用户。完成资料后，如需管理权限，将该账号的稳定用户 UID 写入服务器的 `PLATFORM_ADMIN_UIDS` 或 `HOLIDAY_ADMIN_UIDS`，不要使用 `local-admin` 或 `local-member`。

微信网站应用相关变量可以留空，直到将来确实取得网站应用：

```dotenv
WECHAT_WEB_APPID=
WECHAT_WEB_APPSECRET=
WECHAT_WEB_REDIRECT_URI=
```

## 正式入口核验

执行 `bash infra/scripts/ecs-verify.sh`，并人工确认：

- `https://hosp.schedule.eylinhome.top/` 返回项目首页；
- `https://hosp.schedule.eylinhome.top/api/health` 返回 200；
- 未知 Host 不返回项目页面、不代理 API、不发生跳转；
- 生产构建只显示账号密码登录，不显示微信扫码、本地管理员或本地成员按钮；
- 8080、3000、3001、3306、3307 没有公网监听；
- 没有 `compose.prod.icp-test.yml`、`AUTH_DEV_MODE=true`、`WECHAT_MOCK_MODE=true` 或开发初始化账号；
- 账号注册后可以完成资料补全，重复账号被拒绝，错误密码不会建立会话；
- 401 会清理会话并回到正式登录页。

部署只重建本项目的 `mysql`、`api`、`web` 服务；未来其他域名应使用独立的 Nginx server block 和内部 upstream，不复制本项目的默认 Host 配置。
