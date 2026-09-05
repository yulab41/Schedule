# Project Status

本文档保存当前可接续状态；历史事实以 Git、docs/audit/ 和精确 debug 记录为准。

## 当前批次（2026-09-05）

- 当前活动批次：MINI-UI-ALIGN-009；RUN_ID `mini-ui-20260905001548`。
  用户已确认九项 UI 需求及四路并行、自动集成 main、普通推送、动态版本分配和体验上传。
- 起始及最近成功 fetch：`origin/main@32792fe47b1c3769bebe14a0632e3de9279e7b32`。
  该 main 尚未包含已完成图标分支 `codex/icon-parity-current-20260904@297ad3d2`；
  集成已保留这条前序同源资产与正式 trial allocator 血缘。本轮相对297ad3d2无 Web/锁文件增量。
- 集成槽位：`runtime/wt/icon-parity-1`，分支 `codex/mini-ui-20260905001548-integration`。
  A/B/C/D四路已提交、按顺序集成且其开发租约已释放。原D无改动挂起后关闭，general-5替补完成。
  独立只读复核也已完成。所有真实任务路径、租约与状态见 ignored
  `runtime/codex/tasks/mini-ui-20260905001548.json`。
- 根工作区原有未跟踪 skills、runtime、src 和本地表格保持原样；不暂存、提交或清理用户文件。
- 依赖策略：REUSE_ONLY。所有 Acquire/Bootstrap 复用通过，新增安装 0。
  集成保留最新 main 的稳定 storePath 计算，修正前序分支合并回旧派生路径产生的假 MISS；
  对应 Node 测试 9/9 通过，新增 L2 reconciliation 审计能力不丢失。

## 当前实现与验证

- A：通讯录短文案、绿色同源电话、末级路径压缩、共享 UiSheet 及 75% 筛选。
- B：个人资料横排和按钮居中、登录块级表单间距；实际 WXML/WXSS 浏览器代理几何验证。
- C：50% 事件 Sheet、唯一颜色选择器/转换工具、月/周统一黄色居中日期标记。
- D：全 Mini 瞬时成功反馈扫描、顶层胶囊通知，复用 controller-host 单计时器及失效保护。
- 四路原提交：A585caa33、B4be2bb58、C977e1289、D80e6ac72；集成5947982a/de5bc37b/121714b1/454ad56e。
- 独立复核发现连续色板点击等待测量的P2；已补5项回归并修复，独立复现确认最新选择胜出、旧响应丢弃。
  单独checkpoint message：`fix(miniprogram): retain latest rapid color gesture`；详情见当前review审计记录。
- 集成前 production 基线：`297ad3d2`，构建 19.117s，315 文件；总包 5,182,395 bytes，
  主包 1,745,801 bytes，仅既有 1.5M 内部 warning，无硬限制错误。记录在
  `runtime/codex/logs/mini-ui-20260905001548/integration-baseline-*.log`。
- 正式根 `pnpm verify` 一次PASS，327.833s：Mini758、Node22、root1173通过；既有条件skip如实保留。
  log SHA256：192fe6b9d23c32eee872a44358f8ab4b77fd9772de354d1eb018d197c0c58b3d。
- P2修复后Mini类型/lint/格式与全量复测PASS：763通过/11默认布局skip；这11项已独立启用布局验证。
  trial-lineage15/15，未改原30秒阈值；最新竞争case4.489s，无未解决测试失败。
- 集成实际布局：A15场景、B110状态、C全部320/390/414/横屏/大字及色板、D7场景PASS；P2后C再复测PASS。
- Mini production verify/source/package/performance/determinism与CI dry-run均PASS；P2后总包5,208,175、
  主包1,757,754 bytes，仅既有主包/600格矩阵warning。未复跑不受影响Web/API/root测试。
- 未将Node、浏览器代理或默认skip声称为微信原生验收。提交后还须fresh lineage、动态版本、精确构建、
  allowlist与完整production verifier，再上传并验证回执。

## 发布身份与边界

- 前序已上传体验版观察：`0.1.0-p10.20260905.87@5aff4449e0f2ef703b367c846b67a9e51bac04bf`，
  manifest `7b1acbe671d78fc8c10510407fb8a07107a8e738015fa6b0033a2b0a7b677a9a`；
  它是历史上传，不是本轮新版本。本轮版本尚未申请。
- 本轮授权只读实时预检得到 live release
  `48488019171924701054354e8f707b08eb4d12fe`，TLS 健康与可信 allowlist/verifier 入口正常。
  不部署 ECS、不改服务器 release、不做数据库备份/迁移/恢复；仅授权精确版本 add-only ensure/verify。
- Git 正常 HTTPS fetch 成功；WeChat 沿用记录的进程级 TLS/SNI 保留网络路径，不改系统代理/VPN/DNS。
- 禁止调用微信开发者工具 GUI/CLI；不提审、不正式发布。
  未宣称 Xiaomi 14 真机验收通过，人工设备证据不作为本轮自动交付阻断条件。

## 唯一下一动作与停止条件

- 唯一下一动作：提交已通过复核的连续选色修复，收口Mini电话资产/最终验收文档checkpoint，正常推送main，
  重新独占干净上传槽位并动态申请体验版；尚未分配本轮版本，不借用前序.87作为完成证据。
- 停止条件：九项代码/自动验证通过、普通推送进入 origin/main、动态版本成功上传、
  manifest/source/tag/receipt 一致、可信 allowlist 与完整 verifier 通过，释放可安全释放的本轮租约。
