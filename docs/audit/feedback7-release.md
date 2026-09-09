# Feedback7 体验版98交付记录

## 上传

- 用户2026-09-09明确要求上传此前确认的检查点；应用提交 `507443024bb883a35cbea2b27f20ba933cbdc9a3` 已推送main。
- 体验版 `0.1.0-p10.20260909.98`；说明“feedback7 群组弹窗与手排月历交互整改 5074430”；production、clean，官方PS候选检查在构建前及版本绑定后均通过。
- 构建时间 `2026-09-09T14:24:38.760Z`；微信成功上传 `2026-09-09T14:27:16.213Z`（香港时间9月9日22:27:16）。
- Manifest `43504bfecf273cfa95bbf1fa544bb054b51de30af198f58784e8cc0b3bdc2e36`；340文件的冻结副本逐项大小/SHA256验证通过，receipt与远端不可变版本tag均绑定同一提交及Manifest。
- 版本由正式锁内分配器分配，实际上传一次成功；沿用现有Node CI wrapper，保留全部版本、血缘、租约、候选及Manifest门禁。
- 候选复用实现轮981通过/15跳过和build/type/lint/format/确定性证据；本轮上传专项30项通过。
- 最终版本绑定主包1753208、总包5135578字节；保留既有1.5M主包内部警告。微信Summer Worklet编译完成；本地静态构建不代表原生验收。
- 独占general-1顺序Acquire/ReuseOnly/mini Bootstrap与上传用途冻结，无依赖安装；上传租约已正式释放，文档收口重新取得独占租约。

## 服务端追加放行

- 用户在上传成功后通过弹窗另行明确授权：只追加`.98`并验证，保留旧版。
- 变更前实时读取服务器live `36fae3d145982d793c1dee243a6eb12867962fb6`；已安装allowlist/ecs-verify脚本SHA256与仓库文件完全一致，正常受信SSH路由可用。
- 执行已安装可信 `schedule-client-version-allowlist ensure 0.1.0-p10.20260909.98`，追加1个版本；未调用replace，已有支持版本与legacy标识由官方控制保留。
- 重建期间短暂502，内置健康等待后恢复；完整生产verifier及allowlist verify均通过。
- 独立HTTPS检查：`.98`为200，旧版`.97`为200，动态未知版本为426；只记录状态码，未保存API响应正文。
- 服务器应用live保持 `36fae3d145982d793c1dee243a6eb12867962fb6`；本轮仅版本允许列表操作，不部署应用代码或迁移数据库，无数据库备份任务。

## 交接

- ignored证据：`runtime/wt/general-1/runtime/audit/feedback7-upload/`；canonical回执在`runtime/audit/miniprogram-trials/`。截图、日志、上传私钥及环境信息不提交Git。
- 文档检查点：`docs(release): record feedback7 trial 98 delivery`；不因文档提交再上传、部署、备份或同步服务器release标识。
- 唯一下一任务：用户在小米14重新进入体验版，确认`.98 / 5074430`后复核群组管理、手排模板/预览/草稿/发布、补录及岗位成员。原生光标、滚轮、弹窗和月历交互待用户复核；未提审或正式发布。
