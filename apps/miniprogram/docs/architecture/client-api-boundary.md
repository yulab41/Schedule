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
- 订阅授权只能由明确的用户点击触发 `wx.requestSubscribeMessage`；只把 `accept/reject/ban/filter` 归一化到内存结果，不写本地存储，不携带 Bearer/token 到微信授权桥。
- 401 只触发一次会话清理和 `wx.login` 静默重登，必须防止并发请求形成登录风暴。

## 身份和缓存

- 30 天 Bearer 独立持久化；退出、解绑或最终 401 时删除。
- 24 小时排班只读缓存与会话分开；完整手机号、访客 key/token、导出文件和请求正文不得写入缓存。
- 匿名访客 token、电话和日历只驻留内存。
- 业务日期在边界层使用 `YYYY-MM-DD` 与中国标准时间，不允许 `Date` 的隐式 UTC 换日参与业务键。

## 服务端是最终权限边界

客户端 capability 和 UI 隐藏只是体验层。API 必须独立校验身份、群成员关系、角色、能力开关、输入、版本、幂等和事务。小程序目录不得复制后端实现或数据库 schema。

具体公共契约、登录/解绑、手排限制、原子补录、访客、订阅和导出决策见[总计划](../plans/2026-08-17-wechat-miniprogram-migration-plan.md#7-公共接口和后端改造)。

## P9 外部消息边界

`notification-preferences-client.ts` 只委托既有 `/groups/:groupId/notification-preferences/mine` 读写契约，runtime 工厂将其 capability 固定为 `externalMessages`；当生产能力关闭时，transport 在发出 `wx.request` 前失败关闭。`dutyReminderHours` 的 `null | integer[]` 联合由 client-core 手写严格 decoder 处理，不扩大生成 compact-schema 语言。

`wechat-subscription.ts` 只负责显式授权桥接和结果归一化，不保存模板 ID、grant、token 或业务正文。后续页面必须先取得用户点击，再传入已获批准的模板 ID；授权结果的审计/偏好写入由独立 API 调用负责，模板资格和生产能力开关不由客户端自行推断或开启。

## 当前 P2 月历垂直切片

首个 `@schedule/client-core` 切片固定为三个既有只读端点：鉴权月历、鉴权节假日和公开节假日。共享包提供 endpoint ID、auth 模式、GET 方法、编码路径、紧凑 decoder、service 和 transport 接口；不包含 base URL、fetch、`wx`、会话、缓存、重试或 UI。

Web 的三个既有公开方法先委托共享 service，transport 仍使用原 `requestWithOnline` 管线，因此保留 `fetch.call(globalThis)` 接收者、Bearer/public header、离线 GET、HTTP/API 错误、无效 2xx 响应和调用次数。缓存、最新请求、节假日 fallback 与页面错误状态仍由原 Web 调用点拥有。

decoder 描述由 contracts 的 Zod schema 通过公开 `toJSONSchema` 确定性生成，生成器只接受已审关键字并对未知结构失败关闭；生成文件纳入 freshness 与 Zod 深等价测试。生产 decoder 返回原响应对象，不克隆或转换。月历颜色正则以等价的显式 ASCII 大小写集合表达，避免 JSON Schema 丢失 RegExp `i` flag 后收窄合法值。

Mini 的 `src/platform/client-core-calendar.ts` 现同时提供注入式 `wx.request` JSON transport 和 runtime calendar client 工厂。transport 按 endpoint auth 模式决定是否读取一次 Bearer，公开请求不读取 token；显式检查 2xx `statusCode`、共享 decoder、known API error、无效成功响应和网络/bridge 失败。runtime 包装以成员调用 `wx.request(requestOptions)` 保留宿主接收者，导入模块不会发请求。

共享错误码由 contracts 同源生成；known code 保留 message/requestId/latestData/status，未知错误体沿用 Web 的 401/403/409/通用中文 fallback。当前没有重试、写队列、token 持久化、401 清理或静默登录；这些状态协调不得藏进 transport。Mini 仍没有业务页面、缓存或启动时网络调用。

## P2 收口与后续边界

2026-08-22 完成审计确认 P2 只关闭上述月历 JSON 垂直切片。它已经提供真实 Web 调用点、Mini `wx.request` adapter、黄金响应、Zod/紧凑 decoder 等价和无平台依赖 bundle 证据，足以建立后续端点的受控模式。

身份 token、401 单飞重登和会话清理由 P3/P4 的身份状态机拥有；幂等写入与退避只在 P5–P7 迁移对应 Web 写调用点时增加；Blob、`wx.downloadFile` 和 FileSystem 在 P9 导出切片中由 Web 先行接入。以上能力不得提前塞进 transport，也不得在没有 Web 回归调用点时扩张公共 API。
