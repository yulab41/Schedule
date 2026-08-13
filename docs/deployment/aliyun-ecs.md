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
2. 准备 Web dist、API runtime、迁移、节假日和 Docker 所需文件。
3. 上传 ECS，执行 update 脚本。
4. 核对版本、文件 hash、容器状态、迁移、日志、Web 首页和 `/api/health`。
5. 运行生产浏览器 smoke；失败时保留上一可用版本。

## 部署铁律

- 2G 机器只运行一个入口和共享 MySQL；设置容器内存上限、日志轮转和磁盘清理。
- API runtime 依赖从 lockfile 生成，禁止服务器现场安装造成依赖漂移。
- 迁移前备份，迁移、重启、健康检查按固定顺序执行。
- 生产环境使用 `NODE_ENV=production`、独立数据库和最小权限账号；开发认证不得上线。
- 备案前 IP 直连只用于开发验证；备案后验证 DNS、证书续期、HTTP→HTTPS、Web 和 API。

## 上线前清单

- 完成 ICP 备案、域名和证书配置。
- 完成正式账号认证，关闭开发认证。
- 完成备份恢复演练、迁移升级测试、安全检查和浏览器 smoke。
- 明确回滚版本、负责人、监控阈值和验收窗口。
