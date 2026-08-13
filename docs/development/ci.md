# Continuous Integration

GitHub Actions 在 push 和 pull request 上执行 Verify：Node 24、冻结安装、格式检查、lint、类型检查、测试和构建。

集成测试使用隔离的 MySQL 8.4 服务和 `TEST_MYSQL_*` 环境变量，不读取开发或生产凭据；共享测试 schema 的文件保持串行。

本地复现：

```powershell
pnpm install --frozen-lockfile
pnpm verify
```
