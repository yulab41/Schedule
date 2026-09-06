# Project Status

## 当前批次：UX-CLEANUP-10 截图反馈1已验证，待配套发布

- 基线3a7d2553；同RUN_ID的feedback1，root general-3独占，C新general-1负责认领退役，D无热槽仅只读审计，安装0。
- 当前实施：群组成员卡/工号、认领全端退役、群组版本展示删除、个人页紧凑对齐、底部公开开关、筛选三图层定位。内部并发version和历史认领表/记录保留。
- 已完成定向API/客户端171项、目录工号8项、UI34项，真实浏览器 `pnpm smoke:browser` 全流程PASS。完整verify2次启动/2次DAG/1次通过（Mini839、Node81、root1183通过；条件skip单列）。随后Mini文案/计数增量44项及production校验通过。
- 检查点message：`fix: refine member and profile layouts and retire claims`。唯一下一任务：配套API/Web部署及新体验版的发布授权；目前未部署/上传，不重新批准产品方向。详见 `docs/audit/ux-cleanup-10-feedback1.md`。

## 前序 .90 交付事实

- RUN_ID `ux-cleanup-10-20260906083903`。最终B授权十项代码、保留历史数据迁移、API/Web及一个体验版；额外仅批准PastScheduleView月份按钮44px局部修复。
- 手机号仍为**默认群内可见，明确关闭才隐藏**；严格显式同意实验未采用。
- Q1—Q10全部整合。需求/文件/提交/测试/删除与兼容矩阵见 `docs/audit/ux-cleanup-10-20260906083903.md`。
- 主应用6d0575d0、锁定依赖打包修正eb318961、0054兼容迁移40a189dd、经审计血缘证明94b761b5均已普通推送main；根目录既有用户内容保留。

## 实际验证与交付

- 完整verify启动4/进入DAG4/有效PASS1：Mini838通过/12条件skip，Node81通过，root1180通过/369条件skip。数据库另以真实MySQL55项及能力guard10项验证；5项合成shell回退测试不是生产恢复演练。
- 隔离浏览器smoke全流程PASS；profile13桌面几何、toast28绘制组合；后续lineage/motion20项及icon:parity:check通过。原生/小米14证据未取得。
- S eb318961 API/Web兼容过渡已验证；F40a189dda71b7038e545713a40d36728c0831a6e API/Web/schema54已验证。0054摘要9fa2592ec7fe0631770b9b53d6b8eaeb8a2505dbf9df6a64350566316b2aa2b7；历史非空码不变。两份真实备份及摘要见审计记录；实际回退0。
- **体验版0.1.0-p10.20260906.90已上传成功**（2026-09-06T05:01:54.278Z），source94b761b553266dca34b39d05ca71d0f900644a85，description `ux-cleanup-10-94b761b`，Manifest3ea2b40006a4a334fa85664f73f3cdeb3a2dae0adf978297a98144a7e69f3d6c。
- 回执/allocation/bound manifest/原冻结输出/归档/远端tag交叉核验PASS；334文件，主包1,716,791/总包5,143,555 bytes；.89旧回执保留。
- 前两次invalid ip后用户更新白名单；旧固定IPv4路径再遇ECONNRESET。当前系统真实IPv4解析与TLS1.3通过，进程IPv4优先+servicewechat NO_PROXY重试成功。未改全局VPN/TUN/DNS/hosts/TLS；未重建冻结包。CI执行4次，上传请求3次（2失败/1成功），另1次在getrandstr断开。
- .90精确allowlist及完整installed production verifier此前PASS；本次只重试CI，没有再次迁移/部署/备份。Mini source与生产F应用树一致。
- REUSE_ONLY；官方warm离线reconciliation2次，冷安装0/升级0；本次重试及文档收口安装0。

## 收口及唯一下一步

- 检查点message：`docs(release): record UX cleanup trial 90 delivery`。仅文档，保持.90的source/Manifest不变，不重部署生产或机械重上传。最终main和租约释放见Git及ignored任务登记。
- 原upload lease已释放；A/C/D副本因dirty被官方保护性隔离，未清理/重置；D实验不在main。文档lease收口后仅释放本轮自己的租约。
- 唯一下一步：用户在小米14打开.90@94b761b，验收日历/选择器/开关/我的/群组设置、真实微信绑定与目标admin入口。自动实施与发布已收口，不进入其他批次。
- 未提审/正式发布；未拨真人电话、修改真实隐私/自动接受设置或退出真实群组，不声称真机通过。
