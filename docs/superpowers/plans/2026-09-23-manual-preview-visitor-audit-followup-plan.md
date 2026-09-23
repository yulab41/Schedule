# 手动排班预览与访客审计去重实施计划

## 目标

在不增加预览图例、不改变模板/草稿/发布边界和普通日历视觉的前提下，修复模板删除、草稿已有排班
对照、紧凑月历重叠和访客重复审计，并完成生产部署、体验版上传与只追加放行。

## 步骤 1：建立红灯回归

- client-core 增加模板 DELETE 传输测试，证明旧实现没有 `{}` 请求体。
- Mini 手排控制器/模板测试锁定草稿预览的现有日历懒加载、同岗位合并、迟到请求隔离和无图例。
- 日历组件测试锁定 compact 专属节假日尺寸、嫩灰 existing tone 和非 compact 不变。
- contracts、Mini 访客页和 API MySQL 集成覆盖可选 `visitId`、同页面复用、并发幂等与旧客户端兼容。
- 在未改生产代码前分别运行目标测试并记录预期失败。

## 步骤 2：修复删除并实现草稿对照

- 模板删除请求显式发送 `{}`，不改服务端路由和响应。
- 草稿预览建立独立的草稿身份和月份缓存；初次与切月只补读可见三月窗口。
- 复用现有合并算法，只叠加同岗位已有排班；本次草稿彩色，已有排班使用预览专属嫩灰 tone。
- 所有异步回写校验加载序号和草稿身份；读取失败显示可重试错误并保留草稿内容。

## 步骤 3：收紧 compact 月历布局

- 只在 `.calendar-cell.is-compact` 下缩小节假日胶囊、调整日期/排班间距。
- 保持普通工作台、补录页和非 compact 日历的字号、颜色和布局不变。
- 390px、320px、大字号、五/六行月和多排班场景不增加图例、不产生重叠或横向滚动。

## 步骤 4：实现页面会话访客审计

- 严格请求契约增加可选 UUID `visitId`，重新生成 client-core 解码器且保持响应形状不变。
- 访客页在 `onLoad` 创建会话 UUID，所有月份读取复用，`onUnload` 清理。
- API 以 `groupId + visitId` 派生稳定 UUID 主键并使用原子忽略重复；无 `visitId` 保留旧随机 ID 逻辑。
- 首次当前月请求保存现有 IP、OpenID、请求 ID 和客户端上下文，后续同会话请求不覆盖。

## 步骤 5：分层验证与 checkpoint

- 目标测试转绿后运行 contracts、生成器、client-core、真实 API MySQL 集成、Mini 定向/全量及根测试。
- 运行 typecheck、format/lint/build、package/source/determinism、`pnpm smoke:browser` 和
  `pnpm smoke:check-core`，逐行审查调用次数、异步/错误、空值和副作用语义。
- 使用开发者工具验证删除、草稿切月对照、嫩灰/彩色、无图例、compact 节假日布局及 Console/Network。
- 更新项目/审计记录，提交并推送干净 checkpoint。

## 步骤 6：生产、上传与放行

- 动态重新发现 live release、最新累计体验版和版本号，确认候选血缘及回滚候选。
- 生产部署前生成并核验加密备份；部署服务端 checkpoint，运行完整 ECS verifier 和旧客户端兼容探针。
- 在同一独占 warm slot 冻结最终干净 SHA，运行 upload 前后安全检查并上传不可变体验版。
- 使用可信 `schedule-client-version-allowlist ensure` 只追加新版，保留旧版；验证新版/上一版 200、未知版
  426、Manifest/receipt/SHA 一致。未获授权的提审和正式发布不执行。
