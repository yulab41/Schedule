# miniprogram-ci 运行手册

## 目的

在不打开本地微信开发者工具的条件下完成构建、预览码和开发/体验上传。它不渲染原生页面，也不提供视觉验收。

## 凭证边界

- 上传私钥保存在仓库外，由环境变量或受控 CI secret 注入；启用微信后台 IP 白名单。
- 命令和日志不得打印私钥路径内容、AppID、token、二维码内容或本机 private config。
- staging/production profile 在构建时固定；同一个上传物内没有环境切换。

## 自动化权限

- 允许：本地编译、生成预览码、上传开发版/体验版。
- 禁止自动：提交审核、撤回审核、正式发布、修改公众平台配置。
- 审核或正式发布脚本即使存在，也必须在执行前取得用户本次明确批准。

## P1 必备命令形态

P1 在 app `package.json` 中建立稳定脚本，根 `package.json` 只做 workspace 委托：build、typecheck、simulate、package-audit、preview、upload-experience。脚本必须支持 dry-run、结构化脱敏日志和非零失败码。

当前锁定 Node 包 `miniprogram-ci@2.1.31`（2026-08-18 npm `latest`），不跟随 alpha/beta/gamma 标签。升级只能作为独立的 Skyline/构建批次，并重新执行用户人工原生验收。

凭证和上传元数据使用环境变量：

```text
WECHAT_CI_PRIVATE_KEY_PATH  仓库外的上传私钥绝对路径
WECHAT_CI_ROBOT             1–30，默认 1
WECHAT_CI_VERSION           upload-experience 必填的语义版本
WECHAT_CI_DESCRIPTION       upload-experience 必填，最多 80 字符
```

无凭证本地校验：

```powershell
pnpm --filter @schedule/miniprogram ci:dry-run
```

预览和体验上传会改变微信平台外部状态。虽然属于用户已批准的自动化范围，执行者仍须在轮次记录中写明 profile、Git 提交和结果；不得把审核或正式发布动作加入此脚本。二维码固定写入已忽略的 `.artifacts/preview/<profile>.png`，日志只输出相对路径，不输出二维码内容。

若本地 DevTools 正在运行或假死，自动流程仍不得唤醒、关闭、重启或控制它；直接使用 Node 版 `miniprogram-ci` 或报告外部阻塞。
