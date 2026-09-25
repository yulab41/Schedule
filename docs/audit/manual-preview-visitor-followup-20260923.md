# 手动排班预览与访客审计去重交付记录

## 范围与结论

本批修复四项已确认问题：模板删除请求补发空 JSON；草稿预览按可见月份叠加同岗位已有排班；
紧凑月历缩小节假日标识并保留普通月历视觉；访客读取按页面实例去重。草稿中已有排班为嫩灰色，
本次草稿保留班种彩色，不增加图例。历史访客记录不清理，数据库 schema 不变。

## 引入点与根因

- `eacfd752` 新增模板 DELETE 客户端时未定义 body，小程序传输层省略 `data`，严格 JSON 路由返回
  `VALIDATION_FAILED`。
- `50744302` 建立草稿批次预览时只读取草稿 assignments；编辑预览已有的日历合并没有进入草稿弹窗。
- `e40c4f92` 的共享节假日胶囊按普通月历尺寸设计，compact 预览没有专属尺寸。
- `4b337490` 的访客审计按每个 calendar read 插入；后续五个月预取使一次页面进入产生多条记录。

这些修改都改变业务行为，不按等价重构处理；回归用例先在旧实现上失败，再随实现转绿。

## 实现边界

- DELETE 路由、权限、软删除和响应不变，只在共享客户端稳定发送 `{}`。
- 草稿弹窗建立独立月份缓存和身份令牌，初次读当前月前后各一月，切月只补缺失窗口；只合并同岗位。
  关闭、换草稿或页面失效后的迟到响应不写回。已有日历读取失败时保留草稿并显示错误。
- 灰色 tone 只由预览中的显式 `normal/removed` 对照状态触发；发布版普通 assignments 没有该状态，
  因而不受影响。compact CSS 只调整 `.calendar-cell.is-compact`。
- Mini `onLoad` 创建 UUIDv4 `visitId`，同一页面的预取、切月、恢复和重试复用，`onUnload` 清理。
  API 以 `groupId + visitId` 派生稳定 UUID 主键并做原子冲突 no-op；首次请求的月份、IP、OpenID、请求
  ID 和客户端上下文不被后续请求覆盖。旧客户端无 `visitId` 时仍按请求生成随机日志 ID。

## RED→GREEN 与自动化证据

- 定向：contracts/client-core 22/22；Mini 49/49；新增失败态和迟到响应后 `feedback9` 18/18。
- 真实 MySQL：手动排班 34/34；Task10 107/107；页面会话专项覆盖五个月并发只写一条、重新进入、
  旧客户端逐请求记录，以及同一 `visitId` 在不同群组各写一条。
- `pnpm verify`：format、lint、build、全端 typecheck、图标确定性均通过；Mini 1254 通过/16 跳过；
  根 Vitest 1302 通过/445 跳过；warm worktree 工具 81/81。
- Mini production：source audit、package audit、determinism、CI dry-run 与 verify 通过；0 Worklet；总包
  4,798,345 B、主包 1,821,922 B。保留既有主包 1.5M 内部预警和 600 格节点 best-effort 提示。
- 浏览器：默认 5173 未启动的首轮得到 `ERR_CONNECTION_REFUSED`，不计通过；随后以当前源码本地 API
  3105/Web 4175 和开发认证运行原 smoke，登录、管理员、成员、访客 vkey 与访问记录全流程通过，
  无浏览器错误；合成管理员标记由适配器 `finally` 恢复，两个临时服务已停止。

## 开发者工具与体验版证据

`wechatide` 0.3.11 与工具内置版本一致、登录有效。最终上传产物以
`0.1.0-p10.20260923.191@c6c4fcd2` 在 470×1014 模拟器打开手动排班页；能力请求为 200，
一次性 `POST /manual-schedules/preview` 为 200，页面进入预览态，Console 的 error/fail 过滤为空。
预览可见已有排班的嫩灰显示且没有“已有 / 本次草稿”图例；当前编辑快照没有班次，所以本次草稿彩色
仍以控制器/渲染测试为证，不把空草稿截图记作完整灰/彩对照。含生产人员姓名的临时预览截图在人工
核对后删除，只保留不含人员列表的编辑页截图于 ignored `runtime/audit/manual-preview-visitor-followup-20260923/`。
compact 节假日尺寸继续以 CSS/组件测试为证，本轮没有构造生产业务数据做视觉夹具。

## 发布与回滚

- 应用 checkpoint `c6c4fcd2a61c253a5de724783c1075c23e940997`（`fix(schedule): compare manual drafts
  and dedupe visitor reads`）已推送。部署前读取 live/回滚候选 `da5cd194913c799778e334f8ea25ce43919ca51c`，
  且确认其为候选祖先。
- 加密备份 `2432fa5e-bb1e-4b09-ad3e-40da590350b7` 已核对记录与物理文件：daily、54 表、
  299,370 行、124,849,620 B，SHA-256 `7c5b70d0254dff75a763000e407440a94478cfb5536dd1512a522d4d231fa8fd`。
- 生产已部署 `c6c4fcd2`，schema 63；部署前后完整 `ecs-verify.sh` 均通过，健康端点 200，精确远端
  上传临时目录已清理。
- 体验版 `0.1.0-p10.20260923.191` 已由锁内动态分配并上传：production、232 个代码文件、ZIP
  2,678,192 B、Manifest `0b7a8161c2b7378837ec24d06ff142b21ddf05a4d9197505ff77281b2dbb8c46`；
  receipt、allocation、manifest 与不可变远端 tag 都绑定 `c6c4fcd2`。
- 可信 allowlist `ensure` 只追加 `.191` 并保留 `.190`；独立 allowlist verify 和完整 ECS verifier
  通过。公网能力探针 `.191/.190=200`、动态未知版 `=426`，生产健康 200。未提审、未正式发布、未退役
  旧体验版，也没有为验证创建或删除真实业务草稿。

应用回滚到 `da5cd194` 时还需撤下依赖 `visitId` 的 `.191`；旧体验版继续可用。

小米 14 只有在用户提供与最终 trial/SHA 一致的原生证据后才能写验收通过。提交审核和正式发布均不在
本批授权内。
