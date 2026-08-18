# Staging 环境手册

## 固定地址

```text
https://staging-hosp.schedule.eylinhome.top/api
```

staging 与 production 使用独立编译 profile、合法域名、证书、服务器密钥、微信配置和测试数据。应用内不得提供切换入口。

## 上线前检查

- request/download 合法域名已在公众平台配置且证书链有效。
- `/client-capabilities` 默认拒绝未知版本/未知能力；未迁模块关闭且无入口。
- Mini 登录配置启动强校验；生产/准生产禁止 mock。
- AppSecret 和 session secret 只在服务器；上传私钥只在 CI/操作者环境。
- 测试账号、访客码和手机号同意数据与 production 隔离。

## 数据规则

人工原生测试和体验版只能使用批准的 staging fixtures 或专用测试身份。不得复制生产数据库、真实电话、长期 visitorKey 或真实会话到 staging。任何需要真实平台资格的订阅模板验证单独记录，不能静默更改正式用户偏好。
