# 微信换绑后端修复（2026-09-08）

状态：已实现，定向真实本地 MySQL 验证通过；等待整合网页微信登录移除后的全量门禁、浏览器与新体验版复核。没有连接或修改生产，没有发送真实消息。

## 原因与基线

- 基线 `1d73d54baea21a8d6c983d0062fa9fa2c07c6ee9`，独占 general-3 / `codex/wechat-rebind-backend`。Acquire → ReuseOnly → api bootstrap 全部复用；依赖指纹 `aef084f57bf1321a10e60130f912fe4ef35127421f368cd461c490b7ef7ec527`，没有安装。
- `git log -S 'detachment.userId !== userId'` 和 `git blame` 确认 `15ee912f` 引入“解绑标记只能绑回原账号”。`findUnionUser` 来源 `4416f79b`；旧孤立身份的 unionCount 限制来源 `7d454a55`。
- 普通登录曾按遗留 union 关联选择账号；显式目标绑定复用同一解析器，解绑历史与 union 记录都能造成跨账号冲突。
- 红灯：同一本地 MySQL 上，既有 token/unbind 11 项通过；新往返换绑两项（有/无历史 union）均在第一次绑定另一账号时返回 409 CONFLICT，合计 27.41 秒。完整应用构建/包体基线由主任务独占 general-1 统一记录，避免不同环境数字混算。

## 行为变化与并发边界

- 密码和管理员票据都走显式 `targetUserId` 绑定；目标用户锁内校验当前微信占用、目标其他微信占用、AppID、旧发送身份。普通登录不再读写 union 关联表；既有空旧身份的其他保护条件保留。
- 身份、发送目标、活动解绑抑制标记、证明失效和审计在同一事务中处理。清理当前 subject 或目标账号的活动抑制标记，保留不可变审计及原账号业务记录；不改 schema、不批量清理历史表。
- 成功绑定/解绑消费同 AppID/subject 所有待用密码绑定凭证，以及同 AppID/目标账号所有管理员票据（含旧非 p8 票据），避免解绑—绑定—再解绑后旧证明复活。
- 登录解析与凭证签发合并为同一事务。按既有绑定凭证身份索引锁定 subject 范围，再消费当前凭证并锁定目标，避免正在结束的旧登录在换绑后补发仍可用凭证。
- 仅 ER_LOCK_DEADLOCK 进行最多三次整事务尝试，不重试其他错误。管理员确认先只读预检票据，再交换一次微信 code，事务内重新锁定校验；本人解绑在幂等回调内懒加载并复用同一个 exchange promise，幂等重放和 DB 重试均不重复调用微信。
- 保留原有方法接收者、密码验证、空值和失败回滚语义；以上均是有意行为修复，不宣称等价重构。移除 union 解绑校验后，使用实际账号发送身份检查错误微信证明，保留原 409 拒绝行为。
- 新增稳定脱敏 409 错误码：`WECHAT_IDENTITY_IN_USE`、`WECHAT_ACCOUNT_ALREADY_BOUND`、`WECHAT_APP_ID_MISMATCH`，同步维护服务端错误映射。旧客户端仍可按未知错误降级。

## 验证

- 使用官方 `runApiIntegrationTests`、独占本地 `schedule_test`；连接参数从本地测试容器读取后仅放子进程内存，未打印密码、未改数据库权限。最初 canonical .env 已过期导致 1045，属于测试环境失败，未据此修改产品代码。
- 最终三份 MySQL 测试文件：`wechat-unbind.integration.test.ts` 18、`wechat-link-token-service.integration.test.ts` 4、`wechat-admin-binding.integration.test.ts` 7，**29 项全部通过，55.22 秒**。
- 覆盖有/无 union 的往返换绑、目标曾解绑另一微信、个人数据/发送身份保留与清理、管理员票据换绑、旧/重复/过期凭证、scope 与目标并发竞争、审计失败全回滚、有限死锁重试且 exchange 一次、无效管理员票据不触发 exchange、暂停旧登录与并发绑定不会留下可用旧证明。
- 相关文件 ESLint、Prettier、`git diff --check` 通过；contracts build 通过。此独立分支 API typecheck 剩余唯一错误为计划删除的 `wechat-web-auth-service.ts` 仍传入 `wechat_web`，完整 API typecheck 必须在主任务整合删除后运行，不将它记录为通过。
- 本地输出保存在 ignored `runtime/audit/wechat-rebind-backend/`；真实 MySQL 使用测试网关，没有发送微信消息。当前用户生产截图未能证明生产实际执行分支，本轮以源代码和复现测试确认修复。

提交标识：`fix(auth): support safe explicit WeChat account rebinding`。主任务继续网页移除、Mini 提示、合并门禁与交付；真机往返换绑及实际收信仍须使用最终版本验证。
