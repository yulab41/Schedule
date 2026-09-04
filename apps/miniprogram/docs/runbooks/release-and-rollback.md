# 发布与回滚手册

## 双发布轨道

1. Git/ECS：每个完整仓库 checkpoint 按根规则提交、推送、创建生产加密数据库备份、部署并执行 `ecs-verify.sh`，保证服务器 release 与 Git HEAD 一致。
2. 微信：预览/开发/体验上传独立进行；普通 Git/ECS checkpoint 不自动触发审核或正式发布。

Git/ECS 打包允许复用 `runtime/release-cache/v1` 的哈希校验 build/dist/API-flat 产物。若新旧 manifest 的全部 artifact/control/schema 哈希一致，备份后可使用可信 `schedule-ecs-reuse-release` 无停机同步新的 Git release；任何哈希差异必须走完整部署。

## 正式发布前硬门槛

- 暴露过的 AppSecret 已轮换并验证旧值失效。
- 上传私钥和全部 secret 在仓库外。
- staging/production request/download 合法域名完成。
- 隐私指引、手机号单独同意和访客 IP 规则可审计。
- 生产不存在未处理的超限手排模板。
- 用户已在约定实体设备完成阶段人工原生验收；视觉和性能没有未关闭的阻断问题。
- 全局 capability kill switch、服务端模块开关和回滚演练通过。
- 用户明确批准提交审核；审核通过后再次明确批准正式发布。

## Skyline 全量

正式包保留 `disableABTest: true` 和 `sdkVersionBegin: 3.3.0`/`sdkVersionEnd: 15.255.255`，避免 Skyline/WebView AB 分流。体验版先验证实际 renderer、`worklet.scrollViewContext` 和客户端范围。

## 体验版本白名单

- 体验上传只能从 clean production 累积候选执行：候选必须后继 fresh `origin/main`，且远端最新
  `miniprogram-trial/<version>` 必须是候选祖先；若最新 tag 是 tracked 旧观察版本，则需通过 policy
  `equivalentProof` 的逐文件 canonical 等价证明和全部 required checkpoints 覆盖。版本说明必须含短 SHA。
- 上传封装会先把完整版本原子绑定到不可变轻量 tag。同 tag 同 SHA 仅允许最新候选幂等重试；不同 SHA 拒绝。
  上传失败或响应不确定也永久消耗该版本，禁止删除/force tag 或换代码后复用版本。
- 体验上传成功且 Git/ECS checkpoint 已部署后，只能通过 `sudo schedule-client-version-allowlist ensure <version>` 追加生产支持版本。
- 禁止 PowerShell 管道或临时远端脚本改写 `.env.production`；禁止依赖 JSON 字段顺序比较能力响应。
- `ensure` 必须验证目标版本、动态未知版本 426、配置 `root:root/0600` 和 API/Web 健康；随后再次运行 `sudo schedule-client-version-allowlist verify` 与完整 `ecs-verify.sh`。
- 该命令只增不删。版本退役、审核与正式发布仍需要用户明确批准。

## 回滚

- 首选立即关闭受影响的 server capability，使客户端隐藏入口且 API 拒绝写入。
- 保留上一已验收小程序版本和对应 API contract；需要平台回退时由用户在微信后台操作/批准。需要上传修复包时，
  在最新累积 tip 上创建显式 revert commit 并使用新的全局版本，不给旧 SHA 分配新版本。
- 数据库迁移必须向后兼容 Web 和上一 Mini 版本；发布前备份是恢复底线，但不能用本地数据库覆盖生产。
- 回滚后重跑正式域名只读核验、ECS verify 和受影响身份/权限/幂等测试，并记录实际版本。
