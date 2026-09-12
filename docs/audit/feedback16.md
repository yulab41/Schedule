# Feedback16：小程序稳定性与交互修复

## 范围与边界

- 代码范围仅限 `apps/miniprogram/**` 及本轮测试、审计文档；未修改后端 API、数据库、排班接口或权限语义。
- 使用独占 `runtime/wt/general-5` warm worktree，`DEPENDENCY_MODE=REUSE_ONLY`；依赖复用成功，未运行安装命令。
- 设计检查点为 `516e2719`；A 实现检查点为 `42e644a4`；B/C 最终检查点为 `84ae20f8`（`fix(miniprogram): complete feedback16 stability fixes`）。本次发布策略证明补充提交的消息为 `chore(release): refresh Feedback16 trial lineage proof`。
- 未控制微信开发者工具 GUI/CLI；用户已在当前消息授权体验版上传和追加放行，仍不授权生产代码部署、数据库操作或真实通知。

## 引入点与实现

### A 日历

- `applyMonthWindow` 的跨月合并来自 `9e3a966c`；原逻辑只继承当前响应的 `shiftTypes`，导致当前月无排班而相邻月有全天班时，邻月单元格先绘制徽标，再在下一次响应中清除。
- `mergeCalendarShiftTypes` 保持当前月班种优先，并补齐已加载月份缺失的元数据；`createMonthCells` 在生成 ViewModel 时同时清空全天班的徽标文字和样式。
- `scheduleWeekMeasurement` 的二次测量来自 `9fdf659a`。本轮移除 `nextTick + createSelectorQuery` 高度回写，保留内容签名缓存，改为当前周 ViewModel 的一次估算并按签名缓存。

### B 导出与二维码

- 导出已有直接 Page、标题/返回、loading、生命周期和固定阶段诊断；新增血缘回归逐项检查 Page、include、panel/controller、WXML/WXSS 与 `usingComponents`。
- 血缘检查发现导出 panel 的 `index.wxml` 使用 `ui-toast`，但 panel `index.json` 缺少同源注册；已补齐 `/components/ui/ui-toast/index`。未重写导出任务和下载逻辑。
- 二维码图片增加点击 `wx.previewImage`，同时启用 `show-menu-by-longpress`；预览不可用时提示使用现有“保存到相册”快捷回退。
- 轮换成功后释放轮换锁，再以新的 QR generation 自动读取一次；旧码在轮换开始时立即清除，迟到读结果仍隔离。

### C 平台账号

- 平台账号操作统一通过现有 `info-message-lifetime` 计时器和根部 `ui-toast` 展示，成功、提示、失败均自动清理；页面初始加载错误仍使用可重试的错误状态。
- 管理弹窗保留滚动和大字号路径，增加字段之间、手机号与保存按钮之间、操作区与底部安全区的间距；不改变账号权限、版本保护、幂等键、密码或绑定接口。

## 验证

- RED→GREEN：A 的全天班/单次高度回归，B/C 的二维码预览、预览失败回退、轮换自动读取、平台账号瞬时反馈和布局契约均已覆盖。
- 定向结果：`feedback16-calendar.test.mjs` 2 项；`feedback16-export-startup.test.mjs` 1 项；`feedback16-qr-and-platform-accounts.test.mjs` 7 项；相关 Feedback10/14、组织账号、ui-toast、导出 Page 测试合计 71 项通过。全量 Mini 测试为 169 个文件通过、2 个跳过，1195 项通过、16 项跳过。
- A 联合复测：workbench 58 项通过、1 项跳过。
- `git diff --check` 已通过；390px/320px 与大字号已通过控制器布局标记和 CSS 约束的合成检查。该结果不是 Skyline 或小米14原生验收。
- `pnpm format:check`、`pnpm lint`、`pnpm --filter @schedule/miniprogram verify`、`check:package`、`check:determinism` 和 `pnpm smoke:check-core` 均通过。Mini verify 为 source/output Worklet 2/2、包体 4,550,584 字节；保留既有主包 1,708,504 字节内部预警及矩阵节点警告。

## 体验版交付与下一步

- 用户提供的 112/`83d8a03` 报告只出现 `exports · open-requested` 和运行时错误指纹，没有 `page-load`、`page-ready` 或页面标题；这支持“页面装载/缓存/原生边界”假设，但不能证明本轮修复后的体验版结果。
- 必须在同一干净 SHA 上传后，由用户在小米14 Android 微信客户端体验版复核：导出直接进入是否出现标题/返回/loading，二维码点击预览与长按保存，轮换后新码是否自动出现，平台账号弹窗在 390/320/大字号下是否碰撞。
- 候选提交 `905171cfa96b20e0158c39819a96795192d74108` 已以 production/clean 上传为体验版 `0.1.0-p10.20260912.113`；该版本作为修复前基线保留，receipt 与远端不可变 tag 一致。
- 首次上传命中微信 CI `-10008 invalid ip`（IPv6）；没有改变版本、源码或冻结产物，使用同一不可变元组和已验证代理 IPv4 路由重试成功。此网络路径为进程级路由事实，未改系统网络或平台配置。
- 服务器端此前仅执行 add-only `schedule-client-version-allowlist ensure` 追加 `.113` 并保留 `.112`；独立 allowlist verify 与完整 `ecs-verify.sh` 通过，线上应用 release 指针未改变。
- 当前状态：代码、自动化验证、体验版上传和版本放行完成；原生待用户复核。未提审、未正式发布、未发送真实通知。
- 修复提交 `f7b1709aa471562f15caab2b6c83db1c94383de1` 已以 production/clean 上传为体验版 `0.1.0-p10.20260912.114`；上传时间以 receipt 为准，说明为 `Feedback16 export startup fix f7b1709`，Manifest `66ab569cacb1f1384cc38da6b1c4c586c23c3b0c8ecf35032760bce9a4917f9a`，receipt 与远端不可变 tag 一致。
- 服务器端仅 add-only 追加 `.114`，`.113` 保留；allowlist verify 与完整 `ecs-verify.sh` 通过，线上应用 release 指针仍为 `83d8a03bfa64817f1ada6afd7c801fc642000978`。放行流程重建了 API/Web 容器，但不是本轮生产代码部署；健康检查已恢复，未做数据库备份/迁移。
- 当前状态：代码、自动化验证、体验版上传和版本放行完成；原生待用户复核。未提审、未正式发布、未发送真实通知。
- 必须在同一体验版114由用户在小米14 Android 微信客户端复核：导出直接进入的标题/返回/loading，二维码点击预览与长按保存，轮换后自动显示新码，平台账号弹窗在 390/320/大字号下不碰撞，以及月历全天班首帧和周历切周高度稳定。

## 后续导出白屏定位

用户反馈体验版导出入口仍显示空白。基于现有诊断报告，`exports · open-requested` 已记录但没有 `page-load/page-ready`；同时源码、`app.json`、构建产物和 `wx.navigateTo` 的 `/subpackages/insights/pages/exports/index?groupId=...` 完全一致，路径设置不是缺失项。

`git blame` 将直接 Page 复用组件控制器的 `this.properties` 写入定位到 `49b6841e`。新增失败优先回归后，在只读 Page 保留属性的宿主模型下稳定得到 `TypeError: Cannot assign to read only property 'properties'`，确认白屏根因是 Page 初始化宿主边界。

修复将直接 Page 的群组上下文写入 `data.groupId`，控制器以 `_directPage` 区分 Page 与 Component：Page 读取 `data.groupId`，组件继续读取 `properties.groupId`；无 query 冷入口显示“当前群组信息缺失，请返回工作台后重试。”不改变导出 API、请求参数、鉴权或任务语义。

修复验证：定向导出/页面/血缘回归39项通过；Mini 全量169文件通过、2文件跳过，1197项通过、16项跳过；Mini verify通过，Worklet 2/2、包体4,550,652字节。修复已上传为体验版114并完成 add-only 放行，状态为 `WAITING_XIAOMI14_NATIVE_REVIEW`。
