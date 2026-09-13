# Feedback22 访客二维码与导出改进

## 结论与引入点

- 访客二维码“服务返回无效资料”不是图片内容损坏。API 契约已允许 `trialImageBase64`，但 `packages/client-core/src/generated/calendar-schemas.ts` 的严格生成解码器仍只允许 `imageBase64`，双二维码响应因此被客户端拒绝。本轮重新生成 schema，并增加同时携带正式/体验图片的回归。
- 导出页首屏仍保留 Feedback14 白屏排障期加入的页面注册、ready、选项加载与轮询诊断。引入提交可由 `git log -S recordExportRenderStage` 定位到 `6b8a9e9c`、`b6db1567`、`960e11c1`。本轮仅从导出生产路径删除该诊断链；其他页面和共享诊断组件不变。
- 导出页原先等待权限、岗位和成员全部返回后才退出整页 loading。现在表单立即呈现，岗位/成员后台读取，10秒后只降级筛选器并允许重试，不再阻塞整个页面。
- 本地真实 MySQL 集成中，含建表重置的单次月排班导出用例约 1.7—2.2 秒；代码生成本身未复现接近一分钟。此前一分钟量级更符合旧分钟任务兜底/网络等待，而非 CSV 字符串拼接。创建接口仍立即处理指定任务，分钟 job 只作遗留 pending 兜底。

## 行为变化

- 修复双二维码响应解码，保留正式版、体验版以及带群名合成图片的既有展示和长按行为。
- 导出格式默认 Excel，可在右上角 Excel/CSV 两个同组选项中切换。Excel 为标准 OOXML `.xlsx`，CSV 保留 UTF-8 BOM。
- 岗位和成员改用手动排班同源 `ui-selector`，支持多选；“全部岗位/全部成员”用空数组表示，与具体选项互斥。
- API、契约和 schema 58 增加格式及多选筛选列；旧单选字段和未传格式的 CSV 请求继续兼容。
- XLSX 复用锁文件中已有的 `archiver@5.3.1`，未引入另一套表格依赖；依赖维护使用项目稳定 store，下载数为0。

## 验证

- RED/回归：旧生成解码器拒绝 `trialImageBase64`；旧导出运行/布局测试要求已退休诊断和 CSV 单标签。修复后相关 Mini 定向 68 项、client/API 构建器 12 项通过。
- `pnpm verify`：格式、lint、构建、typecheck、icon parity通过；Mini 1161通过/16跳过；Node/Vitest 1338通过/440跳过。
- 使用隔离测试库：迁移28项、导出API集成6项通过；真实 XLSX 下载具有 ZIP/OOXML 头、正确 MIME，并验证多岗位/成员数组持久化。
- Mini production verify通过：主包1714300字节、总包4555475字节、Worklet 2/2；确定性和包体检查通过，保留既有主包1.5M内部预警。
- 运行/浏览器验证：`pnpm smoke:browser` 已运行，因 warm 槽未启动 `localhost:5173` 而 `ERR_CONNECTION_REFUSED`，未取得浏览器运行证据；`pnpm smoke:check-core` 在记录本结果后复核。
- 微信开发者工具受仓库政策禁用；上述静态、Node 和 MySQL 自动化不等同于小米14原生验收。

## 交付边界

- 用户已授权推送、API部署、schema58迁移、体验版上传及追加放行；部署前必须以即时生产 live 为回滚候选并创建验证备份。
- 不提交审核、不正式发布、不退役旧体验版本。最终体验版及生产验证另在交付记录追加。

## 交付结果

- 应用检查点：`4cdfdbbd`（锁内归档运行时）与 `f0c46078`（功能、迁移和验证）均快进推送到 `origin/main`。
- 生产即时前驱/回滚候选为 `ea0db36c`。部署前备份 `cb765202-9d82-4199-aa62-d83b44e6bf2c`，54表、107939924字节、SHA-256 `0d8c20f1f01234f96f3d3b300207a3e1cea412a1adb20a749d7f6cdd8e6153c3`。
- `f0c46078` 与 schema58 部署成功，API健康在重建后恢复；更新器、完整 `ecs-verify.sh` 均通过。正式打包复用128包、下载0。
- 体验版 `0.1.0-p10.20260913.124` / `f0c46078` 上传成功，Manifest `e28a01c53feb848fe07369c3f62b9555594c67c5df30548623ad6748854b2d3a`，receipt与远端不可变tag一致。
- 可信放行仅追加124并保留旧版；allowlist verifier、再次ecs verifier和公网124/123=200、动态未知=426通过。未提审、未正式发布、未退役旧版。
