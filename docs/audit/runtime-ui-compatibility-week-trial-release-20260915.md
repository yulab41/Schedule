# Skyline 周视图兼容体验版 135 交付

## 交付结论

- 体验版：`0.1.0-p10.20260915.135`
- 应用 SHA：`c7025b932979aa7aaf3846671f6443f7741511e2`
- 上传描述：`Skyline week compatibility c7025b93`
- 构建档位：`production/clean`
- 上传 Manifest：`1aec459fa7a95d4131987960b262273b0a722b5540a767e92422aec2b45b3bf8`
- 远端轻量 tag、allocation、Manifest 和 receipt 均绑定上述同一版本与 SHA。

本轮只上传小程序并通过可信控制追加允许版本；未提交审核、未正式发布、未退役旧版本，
也未部署新的 API/Web 应用制品、执行数据库备份、迁移或业务数据写入。

## 发布门禁

最终候选为独占 warm 槽中的干净、detached、production/clean `c7025b93`。血缘检查、
上传 dry-run、上传后精确版本 worktree safety、远端 tag 与 ignored
`runtime/audit/miniprogram-trials/` 内的 allocation/Manifest/receipt 一致性均通过。
未调用或自动化微信开发者工具。

实现验证为运行时/分页/工作台联合 47 项通过，Mini 完整 174 文件、1197 项通过、16 项跳过；
TypeScript、production build、source/package/determinism、format、lint 和 `smoke:check-core`
均通过。主包 1,736,356 B、总包 4,604,267 B，较 `.134` 增加 3,770 B（约 0.08%），
且没有新增依赖。完整 Mini verify 仍只被本轮未修改的手排节点预算 `1507 > 1506` 阻断。

## 放行与公网验证

L4 inspector 在当前消息授权下为 `RESULT=PASS`。两家独立 DoH 返回一致，且与已固定 SSH
主机密钥候选一致；直连 TLS 健康、显式私钥与严格 SSH 身份检查通过。可信
`schedule-client-version-allowlist ensure` 只追加 `.135`，保留 `.134` 等旧版。

放行后结果：

- allowlist verifier：通过；
- 完整 `/usr/local/lib/schedule/ecs-verify.sh`：通过；
- 公网 `.135`：HTTP 200；
- 公网保留版本 `.134`：HTTP 200；
- 动态生成的未知版本：HTTP 426。

可信 ensure 按既有控制重建 API/Web 容器以装载允许列表，但没有部署新的应用制品；没有执行
数据库备份或迁移。首次严格 SSH 预检因未显式指定现有私钥而在修改前停止；补全显式身份参数后
才执行 ensure。首次后置公网探针仅有本地 PowerShell 返回值空格错误，服务器 verifier 已完成；
修正后重新完整执行 allowlist verifier、ECS verifier 与三个公网探针并全部通过。

## 验收边界

上传、放行和自动验证不等于真机视觉验收。唯一下一任务是在同一小米 14 上确认两个微信实例
都显示 `.135@c7025b93`：基础库 3.17.2 实例复核周选中蓝框、连续左右切周、群名/下拉菜单与
通知胶囊；基础库 3.17.3 实例复核原视觉和周视图 260ms 动画手感不变。
