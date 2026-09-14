# Skyline 3.17.2 UI 兼容体验版 134 交付

## 交付结论

- 体验版：`0.1.0-p10.20260914.134`
- 应用 SHA：`5c023931290d1ec938bf9e990263bd69f99e4b6e`
- 上传描述：`Skyline 3.17.2 UI compatibility 5c02393`
- 构建档位：`production/clean`
- 上传 Manifest：`1669cf3993a23fb90b0dd739f5c7fa36323b05ae4bb8f063e25e63c8f460bf55`
- 远端轻量 tag、allocation、Manifest 和 receipt 均绑定上述同一版本与 SHA。

本轮只上传小程序并通过可信控制追加允许版本；未提交审核、未正式发布、未退役旧版本，也未部署 API/Web、执行数据库备份、迁移或业务数据写入。

## 发布门禁

第一次正式上传预检在调用微信平台前安全停止：工作台 TypeScript blob 已因精确运行时判定而改变，旧的 `5285dd1` 等价血缘证明不再成立，因此没有占用体验版版本。逐行确认该文件只新增版本判定 import、data 类型及初始字段，受保护的导航、Swiper、定位、滚动、日历和图标动效方法未变；随后更新精确 blob 证明，血缘检查及上传专项 30 项全部通过。

最终候选为干净、detached、production/clean 的 `5c023931`。版本绑定 dry-run、上传前后工作树安全检查、远端 tag 和 ignored `runtime/audit/miniprogram-trials/` 内的 allocation/Manifest/receipt 一致性均通过。未调用或自动化微信开发者工具。

## 放行与公网验证

在两家独立 DoH 一致、解析结果与已固定 SSH 主机密钥条目一致，并通过直连 TLS 健康检查与严格 SSH 校验后，执行受信任的 `schedule-client-version-allowlist ensure`，只追加 `.134`。随后：

- allowlist verifier：通过；
- 完整 `/usr/local/lib/schedule/ecs-verify.sh`：通过；
- 公网新版本 `.134`：HTTP 200；
- 公网保留版本 `.133`：HTTP 200；
- 动态生成的未知版本：HTTP 426；
- 服务器应用 release 仍为 `44034fcc342b7ac9994b8222022c64118d276df9`。

可信 ensure 按既有控制重建 API/Web 容器以装载允许列表；没有部署新的应用制品，产物哈希、容器、迁移与正式域名健康检查均由完整 verifier 复核通过。

## 验收边界

上传、放行和自动验证不等于真机视觉验收。唯一下一任务是在同一小米 14 上确认两个微信实例都显示 `.134@5c02393`：基础库 3.17.2 实例应恢复双列布局与圆形加载圈；基础库 3.17.3 实例应与 `.133` 原外观一致。需保留两份首屏诊断、登录页和工作台截图后再写原生验收结论。
