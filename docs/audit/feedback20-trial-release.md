# Feedback20 体验版122交付

- 累计代码检查点`66b18b26d1b844eb2ca9494c8cd8d2adf6eb67aa`已推送`origin/main`，同时包含最新体验版121的导出真实上传转换修复和本轮访客/二维码修改。
- `0.1.0-p10.20260913.122`以production/clean上传成功，说明“访客加载返回及二维码长按 66b18b2”，Manifest `fd736127e3cb3bf2803710039c4f3b7d259fd3319bd2dd4209b533207d8bece5`；build-profile、receipt与远端不可变tag均绑定同一SHA。
- 上传后候选检查通过，未出现`version=local`。官方上传使用仓库外私钥和Node版miniprogram-ci；未控制微信开发者工具、未提审或正式发布。
- 正式域名host key、两个独立DoH、TLS SNI和strict SSH通过。首次错误推断SSH账号在认证前被拒绝，没有执行远端命令；随后使用既有root账号及同一严格路线成功。
- 可信`schedule-client-version-allowlist ensure`仅追加122，保留121；容器重建预热一次TLS EOF和一次502后自动恢复。独立allowlist verify及完整`/usr/local/lib/schedule/ecs-verify.sh`通过；公网122/121=200、动态未知版本=426。
- 服务器应用release仍为`83d8a03bfa64817f1ada6afd7c801fc642000978`；未部署应用代码、未创建数据库备份或迁移、未退役旧版、未发送通知。
- 当前浏览器控制接口无可用浏览器并返回连接失败，且仓库禁止用微信开发者工具替代，因此未修改公众平台配置。管理员仍需将`https://hosp.schedule.eylinhome.top`加入downloadFile合法域名。
- 小米14原生待复核：确认122/66b18b2后测试CSV下载/发送、匿名访客页月周列表切换不频繁全页转圈、返回登录与筛选同排等高、二维码点击预览及长按保存/转发。
