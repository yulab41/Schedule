# Feedback11：二维码保存、导出空白与通知已读

## 范围与状态

- 基线 `72ea0ab0`；用户确认导出页跳转后空白，截图体验版号未知，不能当作当前 SHA 的原生验收。
- QR-11、NOTIFY-11 已完成代码与自动化验证、待用户原生复核；EXPORT-11 本地未复现，继续待定位。本轮不声称三项均修复。
- 独占 `runtime/wt/general-4`，Acquire 返回 READY_REUSE，mini bootstrap 三个生产者全部复用；无依赖安装。
- 没有连接生产、部署、备份、迁移、上传体验版或发送真实通知。用户批准的计划要求上传在最终检查点另行明确授权。

## 发现与行为变化

| 编号 | 级别 / 状态 | 原因、位置与影响 | 修复与验证 |
| --- | --- | --- | --- |
| QR-11 | P2 / 已实现 | `platform/visitor-qr-image.ts` 只接受 PNG；邀请控制器把全部响应写成 PNG MIME。JPEG 能进入显示流程，却在保存前被判为无效。 | 校验 Base64 并读取文件签名字节，统一 PNG/JPEG 显示 MIME 和临时文件扩展名，原字节不转码；异常格式在读取时明确提示。新增 JPEG/错误 MIME/无效响应测试，保留权限、取消、代次与清理测试。高置信的格式兼容缺陷；截图原图真实格式未取得。 |
| NOTIFY-11 | P2 / 已实现 | `packages/client-core/src/p9-insights-actions-client.ts` 单条已读没有正文。JSON Content-Type 与空正文组合在 Fastify 解析阶段返回 400，错误处理器生成截图同文案。 | 仅该端点补 `{}`；真实 Mini transport、真实 API 路由和错误处理器联测，模拟 wx JSON 序列化。无 DB、无真实通知；业务服务使用 fixture。高置信请求缺陷；鉴权、UUID 校验、失败不重试和业务状态逻辑不变。 |
| EXPORT-11 | P2 / 待定位 | 真实用户报告空白；当前直接 Page 已有固定高度，打包 JS 可注册、加载和执行 show/hide/unload。未证实源码根因。 | 新增真实控制器 Page 冷进入/重复进入/加载失败重试测试，以及真实 WXML 七状态 simulate 测试。未修改导出业务代码或布局；需版本一致的安全诊断和原生现象证据。 |

### 引入点和语义审计

- `git log -S 'iVBORw0KGgo'` 与 `git blame HEAD -L 29,38`：PNG-only 保存来自 `9bae5beb`；固定 PNG MIME 来自 `ddd5c107`。
- `git log -S 'markNotificationRead:'` 与调用点 blame：无正文单条已读来自 `a60b57fc`；`890efd8b` 仅调整声明形式。
- 导出 `git log -S 'pageLifetimes'` 与 blame：show/hide 接入来自 `9bae5beb`；直接 Page 和页面高度来自 `49b6841e` 等历史修复，当前存在，不重复修复。
- 本轮是行为修复，不称等价重构：新增 JPEG 支持、提前拒绝无效图片、已读发送空 JSON 对象。成员方法仍绑定原接收者；异步 catch、清理 finally、切群/卸载代次保护和调用次数保持不变。没有网络层重构、数据结构或权限变更。

## 验证记录

证据目录：独占槽内 ignored `runtime/audit/feedback11/`。所有 Node 检查均不是微信原生验收。

- 基线：`pnpm icon:parity` 通过；QR 与直接 Page 原有 34 项通过。一个不存在的附加测试过滤项未被发现，不计入结果。
- 基线 `pnpm --filter @schedule/miniprogram verify` 通过，约 7.2 秒；Worklet 2/2，主包 1679405、总包 4501599 字节，保留主包和矩阵节点已有内部警告。基线最大文件列表未单独留存，不补造比较。
- RED：`feedback10-qr` 与 `feedback11-notification-request` 共 4 失败、38 通过；失败为两个 JPEG 保存场景、JPEG MIME、真实请求链已读 400；日志 `red.log`。
- 初始 GREEN：同两文件 42 通过；追加无效响应后，QR/请求/真实模板及相邻邀请联合 10 文件 99 项通过，日志 `qr-combination.log`。
- 导出真实 Page、通知控制器、P9 运行时和页面壳 4 文件 60 项通过，日志 `adjacent.log`；导出模板七状态全部通过。
- 新模板测试初次因 jsdom 的 URL 环境与文件读取方式不兼容而未收集；改为按 Mini cwd 读取后通过。这是测试基础设施错误，不作为产品 RED。
- 完整验证按组成门禁顺序执行：`pnpm format:check`、`pnpm lint`、`pnpm build`、`pnpm typecheck`、`pnpm miniprogram:test`、`pnpm test`，全部退出0；icon:parity已先行通过，不重复执行。Mini 1122通过/15跳过；根Vitest 1240通过/421跳过，依赖保护Node测试81通过。数据库集成按环境条件跳过，不冒充真实MySQL验证。
- 最终 `pnpm --filter @schedule/miniprogram verify` 通过（约8秒，含打包入口检查）；production、Worklet 2/2、确定性manifest `b8c6752672d98ae05853196ad3914e2ad2fb669df3ae516b616847f17edec347`。主包1679971、总包4502798字节；最大文件`pages/workbench/index.js`189414字节，完整包体与最大20文件见`final-package.json`。基线/修复产物身份不同，不声称性能提升。
- `node runtime/audit/feedback11/check-built-export.mjs` 在Node VM执行最终打包页面，通过注册、加载错误数据态及show/hide/unload；API/native环境为fixture，结果`built-export.json`，不等于原生渲染通过。
- `pnpm smoke:check-core`、`git diff --check`通过；未触及规定Web核心链路，未运行`pnpm smoke:browser`。未修改导出布局，未制作新的视觉验收结论。

## 工具与原生边界

- 已读取 schedule-project-guardrails、systematic-debugging、miniprogram-development；frontend-design 仅作现有布局诊断参考，没有视觉改版。
- 已使用 PowerShell、Git、项目 Node/Vitest、Fastify inject、miniprogram-simulate；未控制微信开发者工具 GUI/CLI。
- 官方网页检索没有获得可引用的官方正文，不以第三方结果替代规则或验证依据。
- 微信 Console/Network、相册实际写入与扫码、导出原生空白、真机性能：当前工具无法测量，暂未验证。

## 唯一下一任务与停止条件

两项有复现证据的独立检查点消息：`fix: accept JPEG QR images and send valid notification reads`。`UPLOAD_REQUIRED`，尚无具体检查点上传批准，不预留版本。EXPORT-11保持待定位：请用户在复现空白后返回“更多 → 测试工具”，复制给Codex的简化报告，并说明是否能看到页面标题/返回箭头；先核对版本，再判断页面启动或内容渲染边界。未取得同版本真机结果，不标记原生通过。
