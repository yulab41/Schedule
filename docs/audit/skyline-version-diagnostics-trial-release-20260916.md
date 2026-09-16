# 测试工具真实读取 Skyline 版本：体验版 146 已上传并放行

2026-09-16 用户授权上传体验版并 add-only 放行。本轮只交付“更多 → 测试工具”的 Skyline 支持与版本真实读取，
未部署应用代码、未改数据库、未提审或正式发布。

- 源码检查点`d526252bdd205b03e8260457c391a2f6aac6d85f`，已推送分支
  `codex/miniprogram-skyline-version-cumulative-20260916`。它是原检查点`c7a96a0b`按体验版累计血缘要求整合到当时最新
  体验版 tag `145@6e31eed8` 后的结果；未改动、未覆盖并行线（137–145）的任何更新，文档冲突以并行线版本为准。
- 实现：`wx.getSkylineInfo`（基础库 2.26.2 起）的 `isSupported` 映射官方五种原因文案，未识别原因写“不支持（原因未识别）”，
  `version` 显示真实 Skyline 版本号；缺少 API、`fail` 回调或 500ms 超时统一失败关闭为“当前微信版本不支持读取”，
  与网络类型并行读取、不阻塞页面。未改 WXML/WXSS、页面配置、渲染器契约或业务语义，未新增依赖。
- 候选证据：定向22/22通过；Mini 完整174文件1213项通过/16跳过；typecheck通过。两处继承门禁失败与本次改动无关并在本记录标注归属：
  `pnpm icon:parity:check` 的 `ui-loading-primary/muted.svg` 未进入 `packages/ui-icons` canonical manifest（并行线`70c51353`引入，
  在并行线 tip `09e63980` 与本候选均复现）；`pnpm miniprogram:verify` 报手排矩阵`1507>1506` no-growth 上限。本轮不改动并行线的
  图标系统与手排预算，按用户指示继续交付。
- 上传：`0.1.0-p10.20260916.146`，说明“测试工具真实读取 Skyline 版本 d526252”，production/clean，2026-09-16T07:17:21.125Z
  上传成功；独占分配器在锁内选取 146（未覆盖 145），远端不可变 tag `miniprogram-trial/0.1.0-p10.20260916.146` 与
  receipt 均绑定`d526252b`，Manifest `903dfccf4ffdf3d37c250548a2e5620efef925738038156cb463e540f0e395a9`。
- 放行：生产路由预检（DoH 两家一致、TLS 健康 200、SSH 主机身份与 BatchMode 身份验证通过）后，可信控制面
  `schedule-client-version-allowlist ensure 0.1.0-p10.20260916.146` 仅追加成功；重建 API/Web 期间出现预期的短暂 502，
  控制面等待健康并完成策略验证。随后独立 `verify` 通过、完整 `ecs-verify.sh` 通过。
- 公网探针：`0.1.0-p10.20260916.146`=200（七维能力全 true）、旧版 `0.1.0-p10.20260916.145`=200、动态未知版本=426。
  未执行 replace、版本退役或正式发布；本轮未部署应用制品，因此不声明服务器 live release 身份。
- 独占general-3，REUSE_ONLY且无安装；未启动或控制微信开发者工具。上传日志、候选证据位于ignored
  `runtime/codex/skyline-version-cumulative-20260916`。

唯一下一任务：用户在小米14打开体验版 `0.1.0-p10.20260916.146`，进入“更多 → 测试工具 → 手机与微信环境”，复核新增的
“Skyline 支持”“Skyline 版本”两行取值，并确认其余九项页面显示检查不受影响。自动化与生产验证不代替该原生复核；
不重复上传或放行。
