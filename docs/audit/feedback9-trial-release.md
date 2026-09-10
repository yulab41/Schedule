# Feedback9 体验版102交付记录

## 授权与交付身份

- 用户针对已推送的反馈修复提交明确授权“上传并放行”。本轮执行一次体验版上传、生产允许列表追加及验证。
- 上传源码：`e40c4f9201bd7e79af151508e00e6667b6897a63`，消息 `fix(miniprogram): repair scheduling layouts and CSV file sharing`。
- 版本：`0.1.0-p10.20260910.102`；描述：`群组偏好、手排矩阵月历及CSV发送修复 e40c4f9`。
- production/clean；构建时间 `2026-09-10T15:27:59.878Z`；上传成功时间 `2026-09-10T15:29:46.262Z`（香港时间9月10日23:29:46）。
- Manifest：`dd8d1a1af574cde92458af24da4f1e3f85c480a1590b44c9d6479603d3b042b8`。353个冻结文件逐一核验大小及SHA256，重算Manifest；成功receipt及远端标签 `miniprogram-trial/0.1.0-p10.20260910.102` 均绑定上述源码。
- 通过既有Node miniprogram-ci及官方Worklet编译上传；未调用微信开发者工具GUI/CLI。独占general-4，上传和文档收口分别取得租约；全程复用依赖，无安装。

## 验证与生产放行

- 应用范围与回归证据见[feedback9.md](feedback9.md)：完整pnpm verify通过，Mini1057通过/15跳过、root1226通过/418跳过、依赖保护81通过；最终Mini verify、Worklet2/2和320/390桌面布局验证通过。上传时复用同一源码的应用证据。
- 上传专项30项通过；正式候选在构建前、版本绑定构建后及上传后检查通过。版本绑定主包1,646,789字节、总包4,441,027字节；原有内部1.5MiB主包预警仍保留。
- 操作前新读取生产live及可信allowlist/verifier脚本，并比对脚本SHA256。可信ensure仅追加.102；配置重建期间健康探测短暂EOF/502后恢复，最终完整生产verifier与allowlist验证均通过。
- 独立HTTPS保留正常TLS校验：.102、.101、.99、.98均200；失败上传的.100及动态未知版本均426。.102的global/core/organization/insights/guest能力均开启。
- 生产应用前后仍为 `4e0a0d1af9d1d3580ab6add1e83f857262852a9d` / schema57。此次未部署应用代码，未新建数据库备份、迁移或变更业务数据，未主动发送通知、提审或正式发布。
- 网络采用原正式域名路径。可选DoH预检未取得两个可用提供方，因此没有启用直连IP回退；实际域名解析为非Fake-IP，系统解析与已知主机记录一致，原域名SSH和HTTPS校验成功。私有地址、密钥路径与认证信息仅留在忽略目录，不写入本文。

## 证据位置

- 本轮忽略目录：`runtime/wt/general-4/runtime/audit/feedback9-upload/`。
- 上传：`upload-gates.log`、`upload.log`、`upload-ready.json`、`frozen.json`、`frozen-dist/`、`upload-result.json`、`upload-verified.json`、`package.log`。
- 生产：`production-baseline.json`、`allowlist-ensure.log`、`production-verify.log`、`external-version-probes.json`。路由私有证据不提交。
- 正式分配、Manifest和成功receipt：仓库根 `runtime/audit/miniprogram-trials/0.1.0-p10.20260910.102*`。

## 原生验收与停止条件

1. 小米14退出后重开体验版，确认 `.102/e40c4f9`，记录trial、renderer、基础库及微信版本。
2. 检查群组偏好分隔、手排班种选中状态、矩阵最后一列及人数变化高度；验证横向矩阵拖动与纵向页面滚动、开始日期占位。
3. 检查预览/草稿/发布弹窗及补录月历：正方形班种标识、节假日、五/六行月份、圆角及阴影。
4. 导出CSV，下载后点击“发送文件”，自行选择联系人或文件传输助手；检查取消发送、重试和页面离开。若失败，保留新版分类提示以继续定位。

上传成功和服务端200不构成小米14原生验收，也不证明真实CSV下载故障原因已查清。当前自动化交付完成，原生视觉、手势及文件发送待用户复核。

文档收口消息：`docs(release): record feedback9 trial 102 delivery`。该文档提交不另行上传、部署、放行或同步服务器release标识；保持体验版源码与生产应用各自身份。
