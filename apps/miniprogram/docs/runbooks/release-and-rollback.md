# 发布与回滚手册

## 双发布轨道

1. Git/ECS：每个完整仓库 checkpoint 按根规则提交、推送、创建生产加密数据库备份、部署并执行 `ecs-verify.sh`，保证服务器 release 与 Git HEAD 一致。
2. 微信：预览/开发/体验上传独立进行；普通 Git/ECS checkpoint 不自动触发审核或正式发布。

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

## 回滚

- 首选立即关闭受影响的 server capability，使客户端隐藏入口且 API 拒绝写入。
- 保留上一已验收小程序版本和对应 API contract；需要平台回退时由用户在微信后台操作/批准。
- 数据库迁移必须向后兼容 Web 和上一 Mini 版本；发布前备份是恢复底线，但不能用本地数据库覆盖生产。
- 回滚后重跑正式域名只读核验、ECS verify 和受影响身份/权限/幂等测试，并记录实际版本。
