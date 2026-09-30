# Warm 槽位恢复（2026-09-30）

## 范围与授权

用户明确要求恢复全部 warm 槽位，进入独立本地依赖维护通道；固定锁文件、离线、不升级依赖、不共享可写 node_modules。业务源码、API、数据库和小程序版本未修改；不操作生产或微信平台。

基线为实时获取的 origin/main `d888d54a`。原 canonical 未跟踪文件保留。详细逐槽证据位于 ignored `runtime/codex/recovery/warm-restore-20260930/`。

## 原因与恢复

- 初始注册池共7槽，可用0槽：Windows版本指纹从 `win32-10.0.26200` 变为 `win32-10.0.26300`，另外存在旧源码基线、一个旧租约及一个脏工作树。
- 通过官方 `dependency-maintenance.ps1` 执行固定锁文件离线协调，并分别复验 ReuseOnly、root bootstrap。已有环境继续复用，本地缓存不删除。
- general-4 原进程与子进程已退出，分支提交已进入 origin/main；按保存的租约信息通过官方 Release 收口，保留该分支。
- general-3 原工作树有开发者工具配置修改，已用 Git worktree move 完整保留在 `runtime/external-project-worktrees/warm-restore-general-3-20260930/`；旧 SHA 和配置文件 SHA256 前后一致。由官方 provision 维护通道补回通用槽位，原工作树未 reset、clean 或删除。

## MAINTENANCE-OUTPUT-001：非JSON维护输出缺失

原 `installDependencies()` 在非JSON模式使用 `stdio: inherit`，安装输出显示在终端但不返回给下载计数校验；成功的离线安装被记录成 `zero-downloads-not-proven`，随后即使健康检查通过仍阻止重用。

`git log -S 'stdio: json'` 与 blame 将引入点定位到 `fa10d5ba`，`60bcf976` 后继续沿用。general-3 本次首次安装成功、健康通过、源码状态未变化，但输出证据为空，完整记录保留在 per-slot reconciliation ledger。

行为变化：

1. 非JSON维护同样捕获 stdout，结束后仍显示可读安装输出，下载计数校验获得实际输出；不修改安装参数、授权或安装次数限制。
2. 仅经维护授权，允许收口此前成功完成但丢失输出的固定锁文件离线安装。必须同时匹配完整指纹、锁文件、固定命令与命令哈希、工作树哈希，并重新通过当前健康检查。明确记录 `successful-frozen-offline-command` 作为零下载依据，不伪装成解析到了进度输出。
3. 收口不再次运行 pnpm；其他失败、未完成、发生下载、健康失效或输入变化仍拒绝恢复。ReuseOnly 不获得安装或修复权限。

## 验证

- 新增2项回归先失败后通过，覆盖成功收口以及失败、在线、跨槽、变更指纹/锁文件/源码、真实下载等拒绝场景；定向16项通过。
- `node --test scripts/codex/*.test.mjs`：83/83通过；`node --check` 与 `git diff --check` 通过。
- 实际使用非JSON维护入口恢复 icon-parity-1：输出 `Already up to date`，成功生成新指纹并通过 ReuseOnly。
- `pnpm smoke:check-core`：未涉及应用核心链路，无需浏览器冒烟；没有声称执行小程序或实体设备验收。
- 已完成槽位的实际 Acquire、root bootstrap、5项 pool policy 测试、Release 日志逐槽保存；最终全池收口状态将在提交并释放本轮代码槽位后补记，不把仍由本轮占用的 general-6 写成已空闲。

## 检查点与下一步

检查点消息：`fix(codex): preserve offline maintenance evidence and finalize completed installs`。提交后正常快进推送主线并释放本轮租约，复验全池。恢复完成后，唯一业务下一批次仍为已批准的“平台账号活跃详情、访客30天留存、小程序全量审查与最小修复”，本维护批次不代表这些业务需求已实现。
