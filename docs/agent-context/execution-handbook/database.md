# 数据库与数据操作执行章节

## 何时读取

涉及 schema、索引、迁移、查询计划、导入、备份/恢复、权限锁或生产数据时读取本章，并继续
读取 docs/directory-database.md、docs/operations/runbook.md、docs/deployment/aliyun-ecs.md
及当前任务的 API/数据库计划和设计。

## 本地验证

- 测试数据库必须是隔离的 MySQL/Compose 服务，使用 TEST_MYSQL_*；禁止连接开发库或生产库。
- 先区分业务代码问题、数据状态问题、数据库连接问题和网络/管理通道问题；记录实际命令、
  SHA、schema、fixture 和结果。
- 目录、排班、权限和并发查询的结构变化必须有可重复证据、定向红灯和明确回滚路径。性能
  没有同口径真实数据前，不新增索引、权限锁、查询结构或部署拓扑。
- 诊断、日志、导出和台账不得记录完整手机号、token、Cookie、Authorization、openid、session、
  原始请求/响应或生产数据。

## 迁移与 production

迁移文件、schema 和回滚脚本必须成对审阅；不能把本地数据库、demo 数据、生成状态或凭据复制
到 production。L1/L2/L3 不执行生产迁移、备份或 SSH。只有 L4 当前任务授权时，才按
[production 章节](production.md) 先做实时 preflight、读取当前 release、创建备份，再进入发布事务。
