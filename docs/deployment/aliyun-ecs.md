# 阿里云 ECS 部署

当前 Web 部署目标是阿里云 ECS + Docker Compose：Nginx、Fastify、MySQL 和定时任务。服务器不编译，Web/API 构建和依赖准备在本机完成后上传。

## 常用脚本

- `infra/scripts/ecs-bootstrap.sh`：新机初始化。
- `infra/scripts/ecs-update.sh`：上传构建产物、更新容器并执行迁移。
- `infra/scripts/ecs-verify.sh`：健康检查和部署后核验。
- `infra/scripts/enable-https.sh`：配置 HTTPS。

## 发布顺序

1. 本地运行 `pnpm verify` 和 `pnpm --filter @schedule/web build`。
2. 生成 API runtime、Web dist、迁移、节假日和 Docker 需要的文件。
3. 上传到 ECS，执行 update 脚本。
4. 检查健康接口、前端资源、迁移版本和容器日志。
5. 再执行生产浏览器 smoke；失败时保留上一可用版本。

## 环境边界

- 正式环境必须使用 `NODE_ENV=production`、独立数据库和最小权限账号。
- 开发认证只能用于开发环境，不能带入公网正式环境。
- 生产部署前先备份数据库；不在本地文档流程中执行生产迁移。
- 域名和 HTTPS 见 [`dns-and-https.md`](dns-and-https.md)，资源铁律见 [`ecs-deployment-pitfalls.md`](ecs-deployment-pitfalls.md)。
