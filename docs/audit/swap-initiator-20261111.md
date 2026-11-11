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
- 浏览器执行前确认本地Web/API原未运行，启动本轮构建及本地schedule_dev/MySQL后执行官方smoke脚本（等价`pnpm smoke:browser`）；微信mock，最终七阶段全流程无浏览器错误。临时合成local-admin标记在finally恢复并回读，自建API/Web停止，原已停止的本地dev MySQL也恢复停止。生产库从未连接。
- 只读评审复查了最终快照/外键/API映射，未发现剩余可操作问题。状态文件新增批次触及40KiB门禁后，仅压缩最旧已完成通知批次摘要并保留报告/验收事实，不放宽门禁。
- core检查在暂存前通过、全部暂存后因旧检查器只读未暂存/已提交diff而找不到新记录。仅将本轮debug记录退出暂存，原文运行检查通过后重新暂存提交；不修改门禁或验证事实。

黄金源四组390/320均无页面错误或横向溢出；首次截图定位器过严超时后修正为实际控件可访问名，重新截图成功。截图/构建清单/日志只在ignored runtime/audit/swap-initiator-20261111，不提交。

实际读取guardrail、brainstorming、frontend-design、miniprogram-development、wechatide、systematic-debugging及requesting-code-review；实际使用Git/PowerShell/Node/pnpm/Vitest/Edge与只读评审。wechatide状态检查版本equal但loginExpired=true，未进入业务工具；无本轮开发者工具Console/Network/运行性能或小米14证据，均暂未验证。

检查点消息：`feat(swaps): let administrators select the actual initiator`。当前不分配版本、不上传、不连接生产；必须先获本次生产备份/API与Web部署及体验版放行授权，避免新客户端调用尚未部署的接口。唯一下一任务为完成检查点后等待该上线授权；不提审或正式发布，不进入其它功能。
