# Feedback16 体验版114上传与追加放行

## 交付结论

用户于 2026-09-12 明确授权“上传体验版并放行”。本轮已完成同一干净候选的体验版上传和服务器端 add-only 版本放行；未提审、未正式发布、未发送真实通知，也未执行生产应用代码部署或数据库操作。

- 候选提交：`f7b1709aa471562f15caab2b6c83db1c94383de1`
- 体验版：`0.1.0-p10.20260912.114`
- 说明：`Feedback16 export startup fix f7b1709`
- 构建档案：`production/clean`
- 上传时间：`2026-09-12T13:13:23.218Z`（以 ignored receipt 为准）。
- Manifest：`66ab569cacb1f1384cc38da6b1c4c586c23c3b0c8ecf35032760bce9a4917f9a`
- 证据：ignored `runtime/audit/miniprogram-trials/0.1.0-p10.20260912.114.json`、冻结构建清单和远端不可变 tag；三者绑定同一版本、SHA 与 Manifest。

## 上传过程

上传前使用独占 `runtime/wt/general-5` warm worktree，`DEPENDENCY_MODE=REUSE_ONLY`，依赖复用成功且未运行安装命令。候选检查、Mini verify、包体、Worklet、确定性、格式、lint、定向回归和 `pnpm smoke:check-core` 均已通过；390px/320px/大字号为合成布局检查，不能替代实体设备验收。

本次外部上传通过已验证的进程级代理 IPv4 路由完成；未改系统网络、微信平台配置或白名单。此前 `.113` 的 IPv6 `-10008 invalid ip` 失败记录保留，未复用其版本或冻结产物。

## 版本放行

服务器端执行可信安装的 `schedule-client-version-allowlist ensure 0.1.0-p10.20260912.114`，仅追加 `.114`，没有执行 `replace` 或退役旧版本；`.113`、`.112` 及更早版本继续保留。独立 `schedule-client-version-allowlist verify` 通过。

放行流程按既有脚本重建 API/Web 容器并等待健康检查；期间短暂出现 TLS/502，随后恢复。`ecs-verify.sh` 后台完成并返回退出码 `0`，生产应用 release 指针前后均为 `83d8a03bfa64817f1ada6afd7c801fc642000978`。因此本轮没有生产应用代码发布、数据库备份、迁移或业务数据写入；容器重建是版本策略脚本的既有同步副作用。

独立状态核对结果：

- API health：ready。
- `.114` 能返回完整 miniprogram capability 响应。
- `.114` 已在 `MINIPROGRAM_SUPPORTED_CLIENT_VERSIONS`，`.113` 与 `.112` 保留。
- 版本策略 verifier：PASS。
- ECS verifier：PASS，退出码 `0`。

## 待用户复核

自动化和服务器检查不等于微信原生验收。请在小米 14 Android 微信客户端打开同一体验版114，复核：

1. 医生群月历切换到无排班月份及切回相邻月份时，全天班徽标无首帧闪烁。
2. 周历切周时高度不再上下跳动。
3. 导出页面直接进入有标题、返回箭头和 loading/页面内容，不再白屏；如仍白屏，复制同口径诊断报告。
4. 二维码点击进入预览，长按可保存；轮换后新码自动显示，旧码失效。
5. 平台账号反馈为瞬时通知；管理弹窗在 390px、320px 和大字号下输入框、保存按钮及绑定按钮不碰撞、不截断。

当前状态：`WAITING_XIAOMI14_NATIVE_REVIEW`。本记录不代表小米14、微信原生运行时或所有 Android 设备已验收通过。
