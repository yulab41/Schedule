# production 执行章节

## 进入条件

只有当前任务明确、直接授权 production 操作时进入 L4；代码批准、设计批准、测试通过、体验版
上传或 docs-only checkpoint 都不等于 production 授权。L0–L3 在本章前停止。

进入前读取 [ECS 手册](../../deployment/aliyun-ecs.md) 和 [运维手册](../../operations/runbook.md)，
实时核对当前 live release、schema、环境和回滚候选；不能用聊天记录、旧应用 checkpoint 或本地
猜测代替服务器事实。

## SSH 与远端控制

- 优先使用正式域名、仓库外指定身份文件、IdentitiesOnly=yes 和 StrictHostKeyChecking=yes。
  私钥路径、用户名、IP、本机端口只写入被忽略的 local-machine.md，不写公开文档。
- VPN/TUN 可能把正式域名解析到 198.18.x.x 的本机代理路径，不自行判定为错误服务器。
  直接用公网 IP 的 SSH 可能卡在 banner；banner 前超时先判断已知 VPN/TUN 瞬时问题，
  最多做一次低频重连，仍失败就 fail-closed。可用只读公网 health 检查区分服务故障和管理通道故障。
- 若远端脚本可能调用 docker compose run、数据库客户端、备份程序或其他读 stdin 的子进程，
  不把控制脚本通过 SSH stdin 传入；使用上传后的脚本文件或 base64 后由 bash -c 执行。

## 发布事务

1. 从 exact clean SHA 生成 release，验证工具链、shell LF/syntax、产物 SHA 和 manifest。
2. 只读 preflight 通过后，按仓库规则先创建 production 数据库备份，并记录备份标识与当前 release。
3. 只同步应用代码和已提交迁移；不复制本地数据库、凭据、session、demo 数据或生成状态。
4. 按制品哈希选择完整部署或可信 hash-identical reuse；不以 commit message 或 docs-only 声明绕过
   release 门禁。失败时保留上一份可用 release。
5. 发布后核对 release、schema、容器/manifest、健康检查、隐私/安全 verifier 和公开入口；所有
   结果必须来自真实远端输出。
6. 需要回滚时重新备份并检查 artifact/hash/path/schema 兼容性；回滚验证失败按既有手册前滚。
