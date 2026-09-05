# miniprogram-ci 运行手册

## 目的

在不打开本地微信开发者工具的条件下完成构建、预览码和开发/体验上传。它不渲染原生页面，也不提供视觉验收。

## 凭证边界

- 上传私钥保存在仓库外，由环境变量或受控 CI secret 注入；启用微信后台 IP 白名单。
- 命令和日志不得打印私钥路径内容、AppID、token、二维码内容或本机 private config。
- staging/production profile 在构建时固定；同一个上传物内没有环境切换。

## 自动化权限

- 允许：本地编译、生成预览码、上传开发版/体验版。
- 禁止自动：提交审核、撤回审核、正式发布、修改公众平台配置。
- 审核或正式发布脚本即使存在，也必须在执行前取得用户本次明确批准。
- 对当前消息已明确授权上传、且已经完成验证并推送 Git 的小程序修改 checkpoint，必须使用 Node 版 `miniprogram-ci` 上传开发版/体验版；这里的“一步”指可追溯、可回滚的 checkpoint，不是每次保存单个文件。未获上传授权时按下文记录 `UPLOAD_REQUIRED`，不得从“已验证”推导上传权限。
- `ci:dry-run` 只验证配置和构建边界，不能替代真实上传。缺少仓库外私钥时，必须把该提交记录为“微信上传阻塞”，向用户索取私钥绝对路径，并在开始下一实施步骤前补传同一提交；不得改用本地微信开发者工具 CLI。

## P1 必备命令形态

P1 在 app `package.json` 中建立稳定脚本，根 `package.json` 只做 workspace 委托：build、typecheck、simulate、package-audit、preview、upload-experience。脚本必须支持 dry-run、结构化脱敏日志和非零失败码。

当前锁定 Node 包 `miniprogram-ci@2.1.31`（2026-08-18 npm `latest`），不跟随 alpha/beta/gamma 标签。升级只能作为独立的 Skyline/构建批次，并重新执行用户人工原生验收。

仓库使用 pnpm 严格依赖布局，而 `miniprogram-ci@2.1.31` 的 Summer Worklet 编译器按 npm 扁平布局解析 Babel 插件，且其 Worklet 插件使用但未声明 `@babel/preset-typescript`。上传封装会先校验并暴露 `miniprogram-ci` 自带的依赖根，项目显式固定同代 `@babel/preset-typescript@7.21.4`；同时仅在 CI 编译进程设置该版本内部支持的 `__MINIPROGRAM_CI_TEST__=true`，让官方 worker task 在 Summer 子进程内执行并保留正确的模块解析路径。该开关不进入小程序产物、不改变业务运行时，也不允许改成复制依赖、修改 `node_modules` 或依赖本机全局包。

预览与上传都显式传入 `compileWorklet: true`，不只依赖开发者工具的本地私有设置，保证 `worklet:onscrollupdate` 和动画 updater 进入官方 Worklet 编译路径。

凭证和上传元数据使用环境变量：

```text
WECHAT_CI_PRIVATE_KEY_PATH  仓库外的上传私钥绝对路径
WECHAT_CI_ROBOT             1–30，默认 1
WECHAT_CI_VERSION           可省略；省略时由正式 helper 根据 tracked history 与远端 reservation 动态分配，显式值只用于已核验的幂等重试
WECHAT_CI_DESCRIPTION       upload-experience 必填，最多 80 字符且必须包含当前七位短 SHA
SCHEDULE_UPLOAD_RUN_ID      当前有效上传用途 lease 的 taskId
SCHEDULE_WORKTREE_LEASE_TOKEN  本任务正式 Acquire 返回的拥有者 token
SCHEDULE_UPLOAD_COMMIT      准备上传用途时冻结的完整 SHA
```

## 体验版版本分配与不可变身份

- Prompt、示例、计划或状态文档中的历史版本只是带来源和时间的证据，不得预先指定下一个版本号，也不得把历史值当作下一次上传默认值。
- 只有当前任务明确包含并授权该 checkpoint 的体验版上传时才分配版本。先冻结最终 clean SHA，完成所有不依赖待分配版本的源码和测试门禁，并确认凭据及可执行的独占上传/版本分配锁已经就绪。
- 在锁保护下，从微信平台或仓库认可的上传台账读取当时所有已占用/已保留版本，再按仓库版本规则分配下一个未使用版本。不得靠 Prompt、字符串排序、旧状态文档或人工猜测决定版本。
- 分配记录必须不可变地绑定“版本号 + 源码 SHA + 上传 Manifest”。构建或上传失败后该版本也不得重新分配给其他 SHA/Manifest；只有在平台状态和台账均已核清、三元组完全相同时，才允许 runbook 明确支持的幂等重试。状态不确定时停止，不覆盖、不复用。
- 执行时若当前 checkout 没有可执行的上传/版本分配锁 helper，或无法取得权威占用状态，返回 `UPLOAD_VERSION_ALLOCATION_BLOCKED` 并停止；不得退化为手工选号后上传。
- 任务需要体验版证据但未授权上传时，只能选择已有的最新合格体验版。合格候选必须有成功上传记录、clean 精确 SHA、production profile、Manifest，且没有已知失效；按权威上传记录的实际顺序选择，不按版本字符串猜测。没有合格候选时记录 `UPLOAD_REQUIRED`，不得自行分配版本或上传。普通任务若不需要体验版证据，则不选择体验版。

无凭证本地校验：

```powershell
pnpm --filter @schedule/miniprogram ci:dry-run
```

真实上传前必须在轮次记录中绑定 Git 提交、构建 profile、版本号和说明；上传完成后记录微信平台返回结果。上传密钥只接受仓库外绝对路径，不接受把密钥内容粘贴进仓库、日志或聊天回显。

## 体验版血缘与版本占用

真实 CI 入口在读取/分配版本前及构建后均执行同一个正式候选检查器。必须先通过现有
`scripts/prepare-release-worktree.mjs --path <owned-slot> --commit <sha> --lease-token <token> --run-id <taskId> --purpose upload`
准备槽位；它只在原有效租约中追加有时限的上传用途，不创建第二套 lease registry。
`runtime/release-worktree` 旧固定路径不再作为候选；普通开发、失效、其他任务、脏树及混用输出均拒绝。

上传入口持有 canonical ignored `runtime/codex/locks/miniprogram-upload.lock`，覆盖版本选择、构建、tag预约和上传。
分配器同时读取 tracked floor、远端 tag 和同一 `runtime/audit/miniprogram-trials/` 下的不可变 `.allocation.json`；
构建失败但尚未创建远端 tag 的号码也不会再次分给其他源码。`.manifest.json` 在 tag 前绑定版本/SHA/Manifest；
有冲突或无法证明原Manifest的旧版本重试失败关闭。释放操作锁不会删除已占用号码或 `.88` 的记录。
`ci:dry-run` 仍然不读凭据、不创建tag、不写分配记录；版本锁/占用 dry-run 使用隔离测试fixture，不伪造平台成功。

`upload-experience` 自动执行 fail-closed 门禁，调用者不能跳过：

1. 校验 tracked `release/trial-history.v1.json` 和 `release/trial-lineage-policy.v1.json`，并 fresh-fetch
   `origin/main`。
2. 要求 worktree clean、profile 为 `production`，候选包含最新 `origin/main`，并满足远端最新 cumulative trial
   tag 的血缘要求。最新 tag 必须是候选祖先；若它是 tracked 的旧观察版本，则只有在候选逐文件匹配 policy
   `equivalentProof` 且全部 required checkpoints 均以祖先或等价实现覆盖时才可继续。policy 中全部 required
   checkpoints 都必须通过祖先或 canonical 等价证明。
3. 重新读取 `refs/tags/miniprogram-trial/*` 后校验全局序号。新号码必须大于 tracked policy floor 和远端最大序号；
   不按日期、任务或分支重置。计划和文档不得预先硬编码“下一个”号码；省略 `WECHAT_CI_VERSION` 时由
   `allocateNextTrialVersion` 选择，显式版本只接受严格 preflight/幂等重试。
4. 构建后再次检查同一 HEAD 与 ancestry，并要求 `dist/build-profile.json` 的 commit、version、description、
   dirty 和 production profile 与候选逐字段相等。
5. 在调用微信上传前，以非 force push 原子创建轻量 tag
   `refs/tags/miniprogram-trial/<完整版本>`。同版本同 SHA 只允许最新候选幂等重试；同版本不同 SHA 失败。
6. 上传成功后，只在主仓库已忽略的 `runtime/audit/miniprogram-trials/<完整版本>.json` 写白名单字段 receipt；
   receipt 不含 AppID、私钥、token 或平台响应正文。

版本 tag 一经创建永久占用，即使微信上传失败或响应不确定也不得删除、force 或改指向；代码需要变化时使用新提交和
新版本。`pnpm miniprogram:trial-lineage` 只校验 tracked 账本/policy 与 required commit 的本地存在性，不 fetch、
不 push。`pnpm miniprogram:ci:dry-run` 同样不读取上传凭证、不创建 tag、不写 receipt、不调用微信上传。

真实命令同时包含“永久占用远端 tag”和“上传体验版”两个外部动作。执行前必须披露 exact full SHA、动态选出的完整
版本、description、clean/profile 和测试页面，并取得用户对该 exact checkpoint 的当次明确批准。上传不会自动放行
服务器 allowlist；allowlist 仍是独立 L4 操作。

预览和体验上传会改变微信平台外部状态。虽然属于用户已批准的自动化范围，执行者仍须在轮次记录中写明 profile、Git 提交和结果；不得把审核或正式发布动作加入此脚本。二维码固定写入已忽略的 `.artifacts/preview/<profile>.png`，日志只输出相对路径，不输出二维码内容。

若本地 DevTools 正在运行或假死，自动流程仍不得唤醒、关闭、重启或控制它；直接使用 Node 版 `miniprogram-ci` 或报告外部阻塞。
