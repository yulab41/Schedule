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
- 生产环境使用 `NODE_ENV=production`、独立数据库和最小权限账号；开发认证不得上线。
- 备案前 IP 直连只用于开发验证；备案后验证 DNS、证书续期、HTTP→HTTPS、Web 和 API。

## 上线前清单

- 完成 ICP 备案、域名和证书配置。
- 完成正式账号认证，关闭开发认证。
- 完成备份恢复演练、迁移升级测试、安全检查和浏览器 smoke。
- 明确回滚版本、负责人、监控阈值和验收窗口。

## 更新命令

本地构建完成后，使用 `pnpm ecs:package` 生成 `runtime/ecs-release/`，然后将三个文件上传到 ECS：

```bash
bash infra/scripts/ecs-update.sh \
  /tmp/schedule-dist.tar.gz \
  /tmp/api-flat.tar.zst \
  /tmp/deploy-manifest.json
bash infra/scripts/ecs-verify.sh
```

当前生产入口由 Nginx 暴露 80/443，API 健康检查使用 `/api/health`；8080 仅作为本地 SSH 隧道端口，不是 ECS 容器入口端口。
