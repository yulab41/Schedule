# Project Status

本文档保存当前可接续状态；历史事实以 Git、docs/audit/ 和精确 debug 记录为准。

## 当前批次（2026-09-05）

- 当前活动批次：MINI-UI-ALIGN-009；RUN_ID `mini-ui-20260905001548`。
  用户已确认九项 UI 需求及四路并行、自动集成 main、普通推送、动态版本分配和体验上传。
- 起始及最近成功 fetch：`origin/main@32792fe47b1c3769bebe14a0632e3de9279e7b32`。
  该 main 尚未包含已完成图标分支 `codex/icon-parity-current-20260904@297ad3d2`；
  最终集成将保留这条前序同源资产与正式 trial allocator 血缘。本轮不新增 Web 行为修改。
- 集成槽位：`runtime/wt/icon-parity-1`，分支 `codex/mini-ui-20260905001548-integration`。
  A/B/C 使用 general-1/2/3，D 原 general-4 执行面无响应、未产生修改，已请求关闭，
  替补在 general-5 独占开发。所有真实任务路径、租约与状态见 ignored
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
- 四路正收敛定向回归和本地提交；未将单测或浏览器代理结果宣称为微信原生验收。
- 集成前 production 基线：`297ad3d2`，构建 19.117s，315 文件；总包 5,182,395 bytes，
  主包 1,745,801 bytes，仅既有 1.5M 内部 warning，无硬限制错误。记录在
  `runtime/codex/logs/mini-ui-20260905001548/integration-baseline-*.log`。
- trial-lineage 基线有三项本地 Git fixture 超时，正按原阈值在重型测试空档复测；
  未降低门禁或将失败记为通过。
- 最终聚合：等待 A→B→C→D 集成后执行一次 `pnpm verify`、只读复核，以及其未覆盖的
  `pnpm miniprogram:verify`、CI dry-run、fresh lineage、allowlist 与完整 production verifier。

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

- 唯一下一动作：收敛四路本地提交，基于再次 fetch 的最新 main 语义集成，完成九行验收矩阵和正式门禁。
- 停止条件：九项代码/自动验证通过、普通推送进入 origin/main、动态版本成功上传、
  manifest/source/tag/receipt 一致、可信 allowlist 与完整 verifier 通过，释放可安全释放的本轮租约。
