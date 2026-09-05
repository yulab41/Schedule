# Project Status

本文档保存当前可接续状态；历史事实以 Git、docs/audit/ 和精确 debug 记录为准。

- Skill-only 收口：APPLICATION_MAINLINE_CLOSED；依赖规范去重及预检/证据复用/cutoff 已完成，Skill validator、Node 守卫 8/8、format:check 通过；checkpoint `docs(agent): refine candidate evidence and dependency routing`；应用/发布无变化，无下一自动批次，停止条件为主线包含此提交且租约释放。

## 当前批次（2026-09-05）

- 当前活动批次：MINI-UI-ALIGN-009；RUN_ID `mini-ui-20260905001548`。九项实现、自动验证、main推送、
  动态体验上传及授权的allowlist/full verifier全部完成；原生设备层仍为待用户复核，不阻断本轮自动交付。
- 起始 main：`32792fe47b1c3769bebe14a0632e3de9279e7b32`；上传前及回执后fresh main均为
  `84dc966ea384e6f88c354bc5e5fb506ee5144d08`。
  起始 main 尚未包含已完成图标分支 `codex/icon-parity-current-20260904@297ad3d2`；
  集成已保留这条前序同源资产与正式 trial allocator 血缘。本轮相对297ad3d2无 Web/锁文件增量。
- 集成槽位：`runtime/wt/icon-parity-1`，分支 `codex/mini-ui-20260905001548-integration`。
  A/B/C/D四路已提交、按顺序集成且其开发租约已释放。原D无改动挂起后关闭，general-5替补完成。
  独立只读复核已完成且租约释放。集成租约释放后，同一健康warm槽位重新独占为上传任务，
  clean detached exact84dc966e完成上传；未创建冷worktree。上传后的记录分支为
  `codex/mini-ui-20260905001548-upload`，记录提交后安全释放。实时任务路径、租约与状态见 ignored
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
  单独checkpoint `45a8e0b3 fix(miniprogram): retain latest rapid color gesture`；详情见当前review审计记录。
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
- 上传后仅更新实际台账/测试/文档，新增receipt契约先红后绿；Mini lineage/CI共22项PASS。
  根配置首次排除了Mini测试，已用Mini配置执行实际断言失败；未把“No test files”算作红绿证据。
- 未将Node、浏览器代理或默认skip声称为微信原生验收；详细九项文件、接口、布局、命令与限制见
  `docs/audit/mini-ui-20260905001548.md` 及其A/B/C/D/review附录。

## 发布身份与边界

- 最终集成/上传源码：`84dc966ea384e6f88c354bc5e5fb506ee5144d08`，message
  `fix(miniprogram): complete nine UI alignment fixes`，已普通推送进入main。
- 动态分配且CI成功接受：`0.1.0-p10.20260905.88`；description
  `mini-ui9-directory-sheet-profile-color-toast-84dc966`；上传时间 `2026-09-05T02:48:58.237Z`。
  clean production build时间 `2026-09-05T02:46:57.199Z`；329文件，主包1,758,921/总包5,210,216 bytes。
  manifest `bad19c28d9844176ee42a94ade9425eecd0cc4c3ed978ebc73c87e3adffdc372`。
  remote immutable tag、官方回执、冻结清单、独立归档逐文件一致；CI协议不回传独立的服务端manifest hash。
- 精确版本add-only ensure、独立verify、完整已安装production verifier均PASS；live release前后均为
  `48488019171924701054354e8f707b08eb4d12fe`。仅可信白名单流程刷新API/Web容器配置，MySQL未重建。
  无ECS应用代码/数据库部署，无数据库备份/迁移/恢复，无服务器release元数据同步。
- 第一次main普通push出现remote commit_refs失败，ls-remote/fetch确认未接受后第二次成功，无force。
  本地上传编排路径检查曾在分配前早停，修正后动态.88预约/实际上传各一次，无版本竞争。
  WeChat沿用已验证的进程级IPv4路径，TLS1.3证书检查通过；未改系统代理/VPN/DNS或关闭TLS。
- 禁止调用微信开发者工具 GUI/CLI；不提审、不正式发布。
  未宣称 Xiaomi 14 真机验收通过，人工设备证据不作为本轮自动交付阻断条件。

## 唯一下一动作与停止条件

- 本轮业务与上传停止条件已满足。交付记录checkpoint message：
  `chore(miniprogram): record UI alignment trial 88 delivery`，只含Mini台账/测试和文档；该记录commit可在上传源码之后，
  不再次构建或上传.88，不触发ECS部署。最终记录HEAD以Git及本轮ignored task state为准。
- 上述checkpoint是本轮末次交付记录；推送与安全释放租约结果以Git和ignored task state为准。
  唯一下一自动批次：无，停止本轮，不自动开始新审计。原生真机尚未验证，不宣称Xiaomi 14验收通过。
