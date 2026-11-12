# 管理员换班实际发起人（2026-11-11）

## 范围与行为

用户已确认：发起人是实际提出换班的人，可以不是换班双方。Web/Mini管理员直接换班及网页校对换班方案新增独立选择；默认当前管理员。候选为当前群组有效值班成员、群组管理员、有效平台管理员及确实没有账号的旧待认领名单，不按当月是否有班次过滤。访客、停用/删除身份及其他群组普通成员不可选。用户另行确认390/320的两处字段位置。

- 新增管理员专用GET候选接口、可选initiatedById、严格输入解析及服务端提交校验。普通成员创建接口拒绝代选字段；旧客户端省略字段仍归属当前管理员。
- 候选范围统一使用应用传入的平台管理员配置集合与数据库标记。正式名单会同时创建账号/成员/待认领行；已有群组身份的名单不能借旧行重新出现，避免停用人员回流。
- 创建及完成事件的JSON保存所选发起用户、ID与姓名快照；确实无账号的旧名单仅保存ID/姓名，不虚构用户。第三人不写用户外键，事件列表/详情/关联事件共用映射恢复API顶层initiatedByUserId；当前操作者归属保留原外键。完成事件展示所选发起人。真实operator、approver、通知actor、校对操作actor及换班双方保持不变。
- 校对仅换班方案显示字段，整组步骤使用同一选择。操作编号绑定选择，保留计划指纹、逐步版本校验与并发占用。选人不改变换班冲突或审批规则。
- 归属是提交校验时的历史快照，不是操作权限。核验后并发停用不追改该快照，下一次提交将拒绝停用人员；不引入第三人用户锁或全局事务改造。
- Mini保留表单重载按ID保留仍有效的选择，新开表单恢复当前管理员。两处复用共享选择器；校对传入本地滚动边界。没有依赖、数据库迁移、renderer、导航或大范围视觉改动。

## 连续性与基线

- d2112e0e，canonical main/origin/main；跟踪文件干净，原未跟踪技能/用户src/Excel等保留。独占general-4，Acquire→ReuseOnly→root Bootstrap，依赖指纹893aa247…，安装0。
- 读完整project-status、pitfall索引、现行精简计划/设计及相关Mini/校对规范；匹配读取mini-test-discovery-clock和Windows fail-fast。变更范围扩展到共享客户端、选择器模板及smoke检查时重新核对边界；未读取完整历史debug日志。
- 原管理员发起人固定操作人来自6452fa928（git blame 998/1002），完成事件最近相关f65a57df；网页方向接入来自e03f256c（git log -S swap.createDirect）。这些是原行为来源，本轮为新增功能。
- 基线应用树由本轮tracked patch反向应用后测量，并通过官方Bootstrap重建对应contracts/client-core；随后finally恢复patch并再Bootstrap当前源，未混用跨源产物。基线仍有本轮未跟踪API helper/文档，明确不是干净发布候选。production静态构建274文件，独立构建972ms，总3906813B/主1131086B；基线verify、定向Mini15项、图标及相关lint通过。
- 初次并行基线尝试恰逢共享源码/schema切换导致导出缺失，失败保留；后续隔离还原/Bootstrap基线通过，不称初次全绿。首次类型检查纠正可选属性undefined与选择索引类型；一次超范围eslint包含非正式lint范围的Node/browser脚本，仅作为命令口径错误，后续使用官方lint。

## 回归、评审与保留失败

- 新API权限/归属测试在旧路由404失败后实现通过；Mini两个入口的默认选择/请求传递先失败后通过；保留表单选择生命周期0→1失败后修复。
- 首轮数据库42项40过/2失败：旧名单测试误用了会创建账号的正式新增入口，改为实际legacy pending夹具；停用后名单回流为真实候选缺陷，修复并补直接伪造名单ID拒绝。后续44项全过。
- 只读评审发现候选锁与既有授权/双方锁可能形成环；完整双连接复现ER_LOCK_DEADLOCK。去掉显式锁后，45项首轮44过/1失败进一步证实事件用户外键插入隐式锁也会等待第三人。最终按提交时历史归属改用JSON用户ID及API映射，不新增第三人外键/显式锁或授权前钩子，保留原业务锁序。独立连接验证并发停用不追改快照、下次提交400，以及第三人持用户锁时换班仍完成。中间锁测试因test client单连接排队及数据库错误包装失败也保留；没有取消并发断言。
- 首轮Mini全量1385通过/23原有跳过/1失败：新原生picker违反既有共享选择器门禁，已改用现有ui-date-picker，失败文件及受影响23项随后通过。最终全量结果见下。
- 首轮共享客户端定向330过/1跳过/1失败，因端点总数36→37；增加新端点认证/路径/解码/服务转发与代选输入断言，同时保留全部旧端点。
- 首次官方浏览器流程因补录月份以相邻月周六开头而误选淡色日期：旧smoke选择器来自11094e381，日期淡化来自7b230e4c。只修检查目标为本月周末、保留原颜色断言；静态回归先红后绿，应用日历代码/颜色未改。不能把该首次失败记为浏览器单次全绿。

## 最终验证与交付

验证跨至2026-11-12完成，基线仍d2112e0e。最终结果：

- 隔离schedule_test真实MySQL：`vitest run apps/api/src/modules/swaps/swaps.integration.test.ts` 45/45通过，包含事件API与存储归属、双方/操作者不变、权限/名单/停用/配置管理员/幂等、并发快照；无跳过。
- `pnpm miniprogram:test` 1386通过/23原有跳过；`pnpm --filter @schedule/miniprogram verify`及check:package通过，274文件，无Worklet/秘密/包边界错误。
- 共享client-core、网页校对、Web换班/事件/API客户端、smoke与连续性定向334通过/1数据库环境跳过。该跳过为独立external-duty-lock集成文件，不能算实库执行。
- API及Web正式build、API/Mini类型、官方`pnpm lint`、`pnpm format:check`、生成schema检查、图标检查及`git diff --check`通过。Web仍有既有>500kB chunk提示，Mini600格手排仍有1513节点提示，不因本功能调整预算。
- 同口径`node scripts/build.mjs --profile=production`独立构建972→908ms，仅一次本机测量，不宣称性能提升；总3906813→3918555B（+11742），主1131086→1132682B（+1596），workflows528322→531160B，insights965457→969972B。最大文件workbench/index.js238545→238944B；各包仍通过预算。两边均未绑定体验版本，不是干净发布候选。
- 浏览器执行前确认本地Web/API原未运行，启动本轮构建及本地schedule_dev/MySQL后执行官方smoke脚本（等价`pnpm smoke:browser`）；微信mock，最终七阶段全流程无浏览器错误。临时合成local-admin标记在finally恢复并回读，自建API/Web停止，原已停止的本地dev MySQL也恢复停止。本地实现阶段未连接生产。
- 只读评审复查了最终快照/外键/API映射，未发现剩余可操作问题。状态文件新增批次触及40KiB门禁后，仅压缩最旧已完成通知批次摘要并保留报告/验收事实，不放宽门禁。
- core检查在暂存前通过、全部暂存后因旧检查器只读未暂存/已提交diff而找不到新记录。仅将本轮debug记录退出暂存，原文运行检查通过后重新暂存提交；不修改门禁或验证事实。

黄金源四组390/320均无页面错误或横向溢出；首次截图定位器过严超时后修正为实际控件可访问名，重新截图成功。截图/构建清单/日志只在ignored runtime/audit/swap-initiator-20261111，不提交。

实际读取guardrail、brainstorming、frontend-design、miniprogram-development、wechatide、systematic-debugging及requesting-code-review；实际使用Git/PowerShell/Node/pnpm/Vitest/Edge与只读评审。wechatide状态检查版本equal但loginExpired=true，未进入业务工具；无本轮开发者工具Console/Network/运行性能或小米14证据，均暂未验证。

首个本地实现检查点：`feat(swaps): let administrators select the actual initiator`。当时未分配版本、上传或连接生产，先等待配套备份/API与Web部署及体验版放行授权，避免新客户端调用尚未部署的接口。后续授权与实际交付见下节；不提审或正式发布，不进入其它功能。

## 2026-11-12 配套部署与上传放行

- 用户先要求上传并放行；只读核实当前live6c234fb961356eeac573c5e98d14482eebaf4218，新候选66f6da2b包含的initiators接口线上404。说明直接放行会使页面失败后，用户另行明确授权先备份生产数据库并部署配套API/Web，再上传及只增放行。
- fresh origin/main为66f6da2b，最新合格receipt/tag为231@6c234fb（production/clean，Manifest67cad99f…）。general-4独占REUSE_ONLY/release Bootstrap八producer复用，安装0。66上传用途候选已冻结并通过安全检查；发现仅测试修正需要新SHA后，先正常释放，再以新RUN_ID swap-trial-checks-20261112重新Acquire，不复用绑定不同SHA的用途。
- 四个现有部署/验证/版本名单/备份控制哈希与Git匹配。首次检查名单控制的旧安装路径未找到，改读实际/usr/local/bin路径后通过；未因该失败变更控制面。生产SSH沿既有双独立DNS/known_hosts匹配的严格TLS与主机密钥物理路线，没有系统hosts/VPN/DNS修改。
- 21:28（香港）先运行既有可信备份，archiveId e33cd8e5-9c43-4d18-884c-132e68b009b0；58表，107753514B，SHA256 eaa5e83d63f3cd740686c0d20802ff79e05aad9a5ef4ef0b823970eaf45e551e，独立文件大小/SHA通过。备份按既有策略淘汰1份旧归档，无业务数据删除。live保留包/manifest存在且已核哈希，冻结该实时live为回退前驱；MySQL容器身份先记录，部署后比较。
- 新增发布门禁证据：format/lint/build/typecheck/图标通过；完整Mini首轮1381过/28跳过且feedback19-export-runtime beforeAll超10秒，记录后按原配置隔离5项全过，合计1386执行通过/23原有跳过。根Codex83过；Vitest首轮1455过/501数据库环境跳过/1失败，仅responsive-sheet-popup旧夹具计数7而实际8。来源af37f5e4，新增字段来自66f6da2b；把期望同步到8并继续逐项要求responsiveSheetPopupProps，无业务/UI代码修改。检查点 `test(web): include initiator in sheet popup checks`，不称单次pnpm verify全绿。
- 上传网络当前系统返回公网IPv4，Google/Cloudflare A集合一致。首个直连地址连接重置，改用同一已核实集合另一IPv4后Node TLSv1.3证书授权通过；后续进程DNS绑定该地址、SDK清代理、Git独立保留代理。错误nonce路径返回404仅为探测路径错误，没有版本分配或真实上传。
- 门禁修正提交前尚未部署/分配/上传；完成定向检查、提交推送及新候选冻结后继续正式流程。所有发现/日志/备份元数据在ignored runtime/audit/swap-initiator-20261112；应用改动仍为66f6da2b，后续仅测试与交付文档，真机证据仍待实际新体验版。
- popup5项及连续性3项、定向格式/lint/diff检查与独立只读复评通过。现有122版本已实时记录，live保留包两类归档的计算SHA与当前/保留manifest逐项一致；不把仅存在文件作为回退核验。

## 2026-11-12 正式交付233

- 6a1cf06b（`test(web): include initiator in sheet popup checks`）正常快进推送；应用代码与66f6da2b一致。新用途租约冻结clean 6a1cf06b/release profile，安全检查通过。ECS构建、dist/API-flat缓存本轮未命中，正式离线平铺131包、下载0、未安装/更新工作区依赖；随后缓存正常生成。三个上传归档/manifest及两脚本的服务器SHA、LF、bash语法检查通过。
- 21:54起按已授权流程从实时6c234fb9部署6a1cf06b，原MySQL容器未变，schema仍72，无新增迁移。初次SSL/502健康重试后ready成功；独立完整verifier（含公网IP入口与共享AI资源/其他工具）通过，新接口404→401。既有部署作业清理39条过期成功运维记录、失败0；未手动删除业务记录、执行真实换班/校对或通知。
- 第一次正式分配232@6a1cf06，Manifest eaaea97d…；SDK在项目序列化/getrandstr请求ECONNRESET，未取得成功receipt。其remote tag/分配/Manifest永久保留，未改向/删除或复用。SDK异常退出遗留的是本任务上传锁：核对RUN_ID、owner nonce、PID37664已不存在且无相关子进程/SDK进程，仅保存审计副本后移除该owner文件和空目录；没有清除其他租约或版本记录。紧随的锁占用失败没有新分配。
- 对当前系统DNS的两个公网IPv4执行真实getrandstr POST均HTTP200/errCode0；再用实际SDK确认nonce成功，随机串/身份未写日志。进程DNS绑定当前可用IPv4、SDK清代理、Git独立保留代理；没有更改系统网络或证书验证。源SHA未变，正式分配器选择新的未占用版本，不重用232。
- 22:05构建、22:06正式Node上传0.1.0-p10.20261112.233成功；完整SHA 6a1cf06b464ff3519ded03c651ab1d777d724799，production/clean，说明“管理员换班选择实际发起人 6a1cf06”。Manifest 715d6d3116a5dc94c4f5f38b010ba8403e229e67d659dca63b3d0dc7684b265b，receipt及原子tag一致；版本绑定候选检查上传前后通过。主包1133080B、总3919905B，四分包427193/857940/531328/970364B，包审计通过。
- **放行中断与恢复：** 首次可信ensure的SSH控制进程中断，API/Web停在created；确认无活动控制进程、发布/能力锁可取得且MySQL正常后，按同一已验证compose配置、两把锁及no-deps恢复API/Web启动。只关闭本任务已失联的本机SSH进程，未杀不明服务。随后独立旧策略verify通过。
- 为防SSH中断，第二次由已核SHA/LF/语法的任务包装文件脱离SSH调用原可信ensure，全部原门禁保留；健康刚恢复后一次策略连接拒绝使JSON输入为空，原控制自动回滚。第三次仅设进程级COMPOSE_PARALLEL_LIMIT=1串行执行同一可信ensure，健康重试后完整策略验证成功、退出0。未修改可信控制或手改环境文件，未放宽JSON/版本断言或绕过锁。Kernel所查窗口无OOM，最终API/Web restart=0/OOM false；根因未声称完全定位或永久根治，期间服务重建中断已如实记录。
- 最终只增233，支持122→123且原122逐项保留，失败232未加入。独立`allowlist verify`及完整生产verifier通过；严格TLS外部探测233/231/230均200、232及合法未知426，MySQL实例仍原ID，live6a1cf06b。所有失败/恢复/成功日志及包装文件在ignored runtime/audit/swap-initiator-20261112，不上传日志、key、会话或数据库到Git/服务器应用包。
- 收口前按实时live6a1cf06b创建备份8ee696b7-d72d-4fa4-ae9b-6c920c0a00e0（58表/107748089B，SHA963603422e1ed6dce04c114734192f955ad09347113e0fe375cde3e36e8525a7），独立文件大小/SHA通过；e33上线前备份也确认仍存在。既有策略本次淘汰1份旧归档。新的独占warm收口租约八producer复用、安装0，仅文档复用上述应用证据。
- 收口消息`docs(audit): deliver initiator trial 233`。按本轮明确授权，在该提交推送后以刚实读的live6a为回退前驱，核实全部应用/控制/schema/retained archive哈希相同后，通过可信reuse-release同步最终Git HEAD并核验；不重启应用、再迁移或重新上传233。最终身份及核验回执留在同一ignored目录，不能把本提交未生成的SHA写回自身。
- 唯一下一任务：小米14退出重进233@6a1cf06，复核“管理员换班”及“排班网页校对”的换班预览中发起人默认当前管理员、可选所有有效值班人员/管理员，并在真实业务发生后核对事件中的发起人和实际操作者。当前无本轮实体设备证据，不写手机验收通过、不提审或正式发布。
