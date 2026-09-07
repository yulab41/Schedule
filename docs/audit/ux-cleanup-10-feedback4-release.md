# Feedback4 .94 发布记录

## 最终交付

- 用户2026-09-07当次明确授权生产部署与体验版上传；最终source/release为 `bfd1fbbdcf2594d66fde39bba6ae4f18b22798e1`。
- 体验版 `0.1.0-p10.20260907.94`，description `feedback4-bfd1fbb`，production/clean，buildTime 2026-09-07T09:37:02.027Z，uploadedAt 2026-09-07T09:59:42.708Z。
- Manifest `818307b84752202fa63b204239cbf3ad7e84bcd00c42b28c2d4c061903ad1171`；332输入文件。官方远端轻量tag、allocation、bound manifest、成功receipt、上传后原输出与冻结归档交叉验证PASS。
- 官方ci.upload实际调用1次/成功1次；SDK压缩包2,451,508 bytes不是输入Manifest，也不是静态总包。编号由正式锁/分配器产生，.94冻结后所有恢复均复用原SHA/文件/Manifest，无重建、覆盖或重新分配。
- .94已通过可信add-only allowlist ensure/verify及完整生产verifier；未提审、未正式发布、未调用微信DevTools或发送真实业务通知。

## 生产备份与发布

- 初始fresh origin/main为1b493e6b，现场live596c20b2/schema54，最新成功体验版.93@596c20b2；三项身份分别读取，不相互替代。
- 第一阶段：备份69eaba96-9178-4c0c-b47e-1542da21ab71，98,494,816 bytes，SHA256 6db709f45ad763c099e5a64c1db52ebdca3890c03e6107b953aeaaeae0175420；服务器加密文件摘要核验通过。可信reuse-release切换596c20b2→1b493e6b，前后verifier PASS。
- 最终对齐：部署前重新读取live1b493e6b，作为bfd1fbbd的rollbackCandidate。备份47a14bb2-666c-4ed8-9d99-6d5d5737163e，98,531,100 bytes，SHA256 2a5b5773ecacedbb8ce103bb44c83dee97edcf8e8930cdd1037124e9f58cb7a4；服务器实际文件SHA核验通过，55表。备份任务按既有保留策略运行。
- 两阶段均为官方packager build/dist/api-flat三项cache hit，应用、schema与控制面哈希完全一致；可信hash-identical发布只对齐release/retained archives引用，schema54不变，无迁移、无本地DB/凭据复制。实际应用回退0。
- verifier/reuse-release/backup/allowlist四个服务器可信工具SHA与本地源码逐个一致；SSH保留StrictHostKeyChecking，HTTPS保留证书校验。服务器数据库始终是业务数据权威源。

## 验证与门禁修正

- 完整 `pnpm verify` PASS：Mini142文件通过/1条件跳过，889测试通过/14条件skip；root252文件通过/36条件跳过，1183测试通过/367条件skip；format/lint/build/type/icon包括在内。发布候选24项PASS。
- 初始1b493e6b上传预检被required checkpoint5285dd1拦截，未产生该次版本记录/tag/微信上传。旧workbench证明blob0c7ab72b不再匹配新增启动提醒后的bbc1aadcd90799d3b96f524abd581064f8ddc365。
- TypeScript AST核对保留62个原Page方法（onUnload仅前置账号安全dispose）及61个顶层函数；handleCalendarNav和directory导航不变，calendarNavAnimating未恢复。两个shared motion/contract证明blob保持原值；只更新整文件精确证明与证据，不移除required checkpoint或降低门禁。
- bfd1fbbd `fix(release): renew feedback4 workbench lineage proof` 已普通推送；应用源码与1b493e6b逐路径diff为空，复用完整应用验证。续新motion/lineage25项、icon parity、smoke:check-core PASS。
- 真实PS候选检查在版本绑定后PASS：owned warm、clean detached、SHA、RUN_ID、production及非local版本完全一致。

## 连接失败与证据边界

- GitHub TLS间歇失败发生在版本发现或候选确认阶段；此前没有ci.upload调用。实际命令和每次失败日志保留，不把候选入口调用次数当作真实上传次数。
- .94首次本地分配/冻结后，任务内PowerShell Git包装器对独立`--`参数的绑定错误误报忽略目录；本地命令恢复原生Git执行，网络命令交由任务内真实Git通道执行并返回原stdout/exit code。官方分配器、fresh refs、等价证明、锁、manifest、tag预约及receipt检查全部保留。
- 最终通道显式复用已配置代理并保留OpenSSL证书校验；最终通道内每条只读Git命令遇TLS失败至多一次有界重试，push不盲重试。没有修改全局代理、VPN、DNS、hosts、Git配置或TLS校验。
- 微信使用已验证的当前系统IPv4、原hostname/SNI、TLSv1.3证书验证；Git与微信使用各自通道。不复制历史固定IP，也不把手机端实际投递视为已验证。
- 日志、冻结包、发布产物及本地传输状态在general-3/runtime/audit/feedback4-release；成功receipt在canonical runtime/audit/miniprogram-trials；全部ignored，凭据始终在仓库外。

## 收口与手机验收

- 文档检查点message：`docs(release): record feedback4 trial 94 delivery`。本提交只记录已交付bfd1fbbd/.94，不机械重部署或重新上传；安装0、新建冷worktree0，顺序复用general-3并释放自己的租约。
- 唯一下一任务：用户从原体验版入口完全退出后重开，核对.94/bfd1fbb，按七项需求复核；提供同版本截图或问题描述。未取得小米14原生证据前不写验收通过。
