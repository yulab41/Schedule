# ECS 部署与正式上线

正式网页入口是 `https://hosp.schedule.eylinhome.top`。共享 Nginx 只按域名分流：本项目只响应这个域名，未知 Host 不返回项目首页，也不跳转到正式域名。API、MySQL 和其他站点服务不新增公网端口。

## 本地生成 release

服务器不负责安装依赖或编译。Windows 本地发布固定复用项目内 `runtime/release-worktree` 的隔离 detached worktree；普通 release 任务只允许复用已经健康的项目内依赖，依赖指纹不匹配时必须停止并转入明确的 DependencyMaintenance 通道，不能在 release helper 或新对话中自行安装。获授权的维护通道才可针对精确 lockfile 使用离线、项目内 store 的 `scripts/codex/dependency-maintenance.ps1`，并在成功后重新建立指纹；后续切换 commit 时保留该目录的 `node_modules`。项目相关 worktree、release、smoke、日志和临时打包目录禁止写到项目目录之外；凭据/私钥仍必须保留在仓库外受控目录：

```powershell
node scripts/prepare-release-worktree.mjs --commit HEAD
Set-Location .\runtime\release-worktree
```

直接使用 Node 入口可以避免开发工作区尚未提交的 pnpm 配置触发包管理器自身的依赖预检；`pnpm release:worktree -- --commit HEAD` 是工作区配置已经稳定时的等价别名。

脚本只接管 Git 已登记、detached、状态干净的专用 worktree。目标目录若含用户分支、未提交/未忽略文件，或只是同名普通目录，会失败关闭且绝不删除、清理或覆盖。依赖指纹保存在该 worktree 自己的 Git 元数据目录，不污染 release 源码状态。不要每轮删除这个目录，也不要在其中进行开发。

安装保持仓库 `allowBuilds` 白名单：已批准的 `esbuild` 脚本照常执行，未批准的转依赖脚本继续被阻止；发布 helper 只把 pnpm 的 `strictDepBuilds` 从“未审脚本即非零退出”调整为警告，不会放行这些脚本，也不会使用 `dangerouslyAllowAllBuilds`。
pnpm 11 会把未审包自动追加为 `set this to true or false` 占位值；helper 只在确认安装后的唯一差异正是这些占位行时恢复安装前原文，出现任何其他 workspace 变化都会失败关闭。

完成本地验证后，在上述发布 worktree 根目录执行：

```bash
RELEASE_COMMIT="$(git rev-parse HEAD)"
ROLLBACK_CANDIDATE="<已审计且已保留在服务器的40位release>"
NODE_ENV=production AUTH_DEV_MODE=false AUTH_PASSWORD_ENABLED=true \
ECS_RELEASE_EXPECTED_COMMIT="$RELEASE_COMMIT" \
ECS_ROLLBACK_CANDIDATE="$ROLLBACK_CANDIDATE" \
pnpm ecs:package
```

打包器会先重建工作区，并要求 Git tracked/untracked 均干净、commit 与显式变量一致、rollback candidate 是当前 commit 的祖先；六个发布 shell 必须为 LF 且逐文件通过 `bash -n`。将 `runtime/ecs-release/` 中的三个产物，以及同一 commit 的 `infra/scripts/ecs-update.sh`、`infra/scripts/ecs-verify.sh`，上传到服务器独立临时目录。不要复用来源不明的旧 `/tmp/ecs-*.sh`。

打包器在 `runtime/release-cache/v1` 使用内容哈希缓存 ECS build、dist archive 和 API flat archive。缓存键不含 Git commit，因此 docs/Mini-only checkpoint 可复用相同应用产物；命中前仍校验输入、payload SHA、构建树和干净 commit。缓存损坏只会失效并重建，不能作为带警告继续发布的依据。

当新 manifest 的全部应用、控制面、schema 与 retained archive 哈希都和当前生产一致时，可以只上传新 manifest，并在完成数据库备份后执行：

```bash
sudo schedule-ecs-reuse-release /tmp/deploy-manifest.json
```

可信工具会先后运行 verifier，只更新 immutable release archives 的引用、manifest 和 `current-release`，不停止 API、不迁移、不重建容器；任一哈希不一致会拒绝并要求走完整 `ecs-update.sh`。不能根据 commit message 或人工声明 `docs-only` 绕过哈希门禁。

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
MINIPROGRAM_SUPPORTED_CLIENT_VERSIONS=0.1.0-p6.20260824.78,0.1.0-p6.20260824.79,0.1.0-p6.20260824.80,0.1.0-p6.20260824.81,0.1.0-p7.20260824.85,0.1.0-p7.20260824.86,0.1.0-p7.20260824.87,0.1.0-p7.20260824.88,0.1.0-p7.20260824.89,0.1.0-p7.20260824.90,0.1.0-p7.20260824.91,0.1.0-p7.20260824.92,0.1.0-p7.20260824.93,0.1.0-p7.20260824.94,0.1.0-p8.20260825.1,0.1.0-p8.20260825.2,0.1.0-p8.20260825.3,0.1.0-p8.20260825.4,0.1.0-p8.20260825.5,0.1.0-p9.20260825.1,0.1.0-p9.20260826.1,0.1.0-p9.20260826.2,0.1.0-p9.20260826.3,0.1.0-p9.20260826.4,0.1.0-p9.20260826.5,0.1.0-p9.20260826.6,0.1.0-p9.20260826.7,0.1.0-p9.20260826.8,0.1.0-p9.20260826.9,0.1.0-p9.20260826.10,0.1.0-p9.20260826.11,0.1.0-p9.20260826.12,0.1.0-p9.20260826.13,0.1.0-p9.20260826.14,0.1.0-p9.20260826.15
MINIPROGRAM_SUPPORTED_CLIENT_VERSIONS=0.1.0-p6.20260824.78,0.1.0-p6.20260824.79,0.1.0-p6.20260824.80,0.1.0-p6.20260824.81,0.1.0-p7.20260824.85,0.1.0-p7.20260824.86,0.1.0-p7.20260824.87,0.1.0-p7.20260824.88,0.1.0-p7.20260824.89,0.1.0-p7.20260824.90,0.1.0-p7.20260824.91,0.1.0-p7.20260824.92,0.1.0-p7.20260824.93,0.1.0-p7.20260824.94,0.1.0-p8.20260825.1,0.1.0-p8.20260825.2,0.1.0-p8.20260825.3,0.1.0-p8.20260825.4,0.1.0-p8.20260825.5,0.1.0-p9.20260825.1,0.1.0-p9.20260826.1,0.1.0-p9.20260826.2,0.1.0-p9.20260826.3,0.1.0-p9.20260826.4,0.1.0-p9.20260826.5,0.1.0-p9.20260826.6,0.1.0-p9.20260826.7,0.1.0-p9.20260826.8,0.1.0-p9.20260826.9,0.1.0-p9.20260826.10,0.1.0-p9.20260826.11,0.1.0-p9.20260826.12,0.1.0-p9.20260826.13,0.1.0-p9.20260826.14,0.1.0-p9.20260826.15,0.1.0-p9.20260826.16,0.1.0-p9.20260826.17,0.1.0-p9.20260826.18
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

小程序版本白名单禁止手工编辑 `.env.production`。可信控制面部署后使用：

```bash
sudo schedule-client-version-allowlist ensure 0.1.0-p9.20260827.46
sudo schedule-client-version-allowlist verify
```

`ensure` 只增不删；它在 release/capability 双锁下原子追加，重建 API+Web，并验证目标版本的七维响应及动态未知版本 HTTP 426。任一步失败或收到终止信号都会恢复旧列表并重新探测。版本退役必须另走明确审批流程。

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
