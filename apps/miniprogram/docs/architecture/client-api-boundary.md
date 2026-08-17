# 跨端客户端与 API 边界

## 共享层

`@schedule/client-core` 只定义端点描述、请求/响应类型、错误语义、紧凑解码器和 transport 接口，不直接依赖 fetch、`wx`、Vue、DOM、Node 或数据库。

```text
endpoint descriptor + decoder
            │
      client-core service
       ┌────┴─────┐
Web fetch       Mini wx.request
Web Blob        Mini downloadFile/FileSystem
```

Web 与 Mini 使用相同 endpoint descriptor 和黄金响应。Web 的 Zod 解析结果必须与 Mini 的生成解码器深度相等；Zod 不进入小程序运行包。

## Transport 约束

- `wx.request` 必须显式检查 `statusCode` 和约定错误体，网络完成不等于业务成功。
- GET 可以有限次指数退避；非幂等写入不得自动重试。
- 带 `Idempotency-Key` 的写入可按既定退避重放；body `operationId` 兼容期间与 header 同时出现必须相等。
- 下载使用 `wx.downloadFile` 的 Bearer header，再通过 FileSystem 复制/打开/分享；凭证不进入 URL。
- 401 只触发一次会话清理和 `wx.login` 静默重登，必须防止并发请求形成登录风暴。

## 身份和缓存

- 30 天 Bearer 独立持久化；退出、解绑或最终 401 时删除。
- 24 小时排班只读缓存与会话分开；完整手机号、访客 key/token、导出文件和请求正文不得写入缓存。
- 匿名访客 token、电话和日历只驻留内存。
- 业务日期在边界层使用 `YYYY-MM-DD` 与中国标准时间，不允许 `Date` 的隐式 UTC 换日参与业务键。

## 服务端是最终权限边界

客户端 capability 和 UI 隐藏只是体验层。API 必须独立校验身份、群成员关系、角色、能力开关、输入、版本、幂等和事务。小程序目录不得复制后端实现或数据库 schema。

具体公共契约、登录/解绑、手排限制、原子补录、访客、订阅和导出决策见[总计划](../plans/2026-08-17-wechat-miniprogram-migration-plan.md#7-公共接口和后端改造)。
