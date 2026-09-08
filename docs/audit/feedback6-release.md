# Feedback6 发布记录

## 发布前校验与证明修正

2026-09-09用户确认授权体验上传、生产备份、0055/0056迁移部署及新版可用后的旧版本停用。应用验证基线3aeaa4c8，全量verify及浏览器/MySQL证据见feedback6-upgrade.md；本轮不改变业务源码。

- fresh origin/main=3aeaa4c8；实际生产live=a6586326b8bccc91fe7cf4f46b89e6296108e869，schema54；最新合格receipt为0.1.0-p10.20260908.96。生产部署前verifier通过。
- 已生成生产加密备份8ed1f840-8a23-4eff-ae0b-43a1123c862f，100791644字节、55表、234970行；实际文件SHA256核验通过：2f99446eb1aeaf9c78d7e2f97a52bdd4062a07af93a8651e736e10bc39be0316。此时尚未迁移。
- 3aeaa4c8正式上传入口被required checkpoint5285dd1的旧整文件证明拒绝；未创建allocation、远端tag或调用微信上传。初始ECS包未部署，不得作为最终交付身份。
- git log -S与blame定位旧proof来自bfd1fbbd；workbench于528722f4/3aeaa4c8加入日期刷新及加载前登录迁移，证明未同步。旧blob bbc1aadcd90799d3b96f524abd581064f8ddc365到新32e0e95eb5c20f3ed3ffb4e440027a22e4143e8d为74行新增、0删除。
- 两人逐段diff核对：handleCalendarNav、handleDirectoryNav、activatePrimaryWorkspace、swiper/locate过渡及滚动队列未修改，calendarNavAnimating仍不存在。另8个proof blob完全相同。日期及认证行为本来改变，不宣称整个文件或定位日期语义等价；证明仅覆盖原图标/导航动效检查点。
- 仅更新policy中的该blob与证据，保留全部required checkpoint、精确哈希与真实上传门禁。应用源码/锁文件/构建工具不变，复用3aeaa4c8应用证据，版本绑定产物需重新构建。
- 发布保护35项真实Bash合成测试通过。首次误用node --test加载Vitest被拒绝，改用正式pnpm exec vitest run后35通过；没有更改测试来掩盖失败。motion/lineage/候选/锁专项28通过，icon parity、全部9个proof blob、trial账本及smoke:check-core通过。
- 顺序独占general-1，官方Release/Acquire及ReuseOnly/bootstrap，无依赖安装。初始Release误用-WorktreeRoot参数失败后改用正式-Path；未手改租约。原始日志与冻结材料在ignored runtime/audit/feedback6-release。

证明检查点36fae3d1已普通推送，随后按同次授权完成下述交付。

## 已完成交付

- 最终应用release：36fae3d145982d793c1dee243a6eb12867962fb6，包含3aeaa4c8全部业务修改；后续只补充血缘证明及文档，业务、迁移、控制面源码未改变。
- 体验版：0.1.0-p10.20260909.97；说明“日历08点交班、补录改版、账号管理与轮转退役 36fae3d”。production/clean，构建2026-09-08T23:33:50.960Z，上传成功2026-09-08T23:36:37.243Z（香港9月9日07:36:37）。
- Manifest：e66688529d6c2d9d68898955989c3537a5706c5c348fcdadb222c56603fe5540；335文件，SDK压缩包2581886字节。正式receipt、所有冻结文件hash/大小和远端miniprogram-trial标签一致，实际微信上传一次成功。
- 最终版本绑定包审总包5121308字节、主包1751101，保留既有1.5M内部警告；源/输出Worklet均2，静态审计无问题。版本描述/元数据与之前默认构建不同，不计算包体改善百分比。
- ECS包build/dist/api-flat三项缓存命中。dist归档hash=837ba2a4175f37291092f7382ffa58d09c527125eeff7f9b15e24ffe40e4ada6；API归档hash=ed1feb6d3f395c4e733b193b2096f8a56364c7bd81982a1e372e3624c76a2fd6；与3aeaa4c8候选完全相同，manifest绑定最终36fae3d1。
- 部署前再次核对实际live=a6586326及上述备份文件SHA；直接执行已核对哈希的新候选ecs-update，未调用旧安装版本。0055/0056迁移、容器重建及健康检查通过，schema56；新verifier/版本控制面已安装。
- 迁移前后总记录数一致：users40、shift_assignments3933、schedule_events138、schedule_periods120、manual_schedule_templates1。该口径含删除/历史行，与前轮非删除业务口径不可直接比较。手机号镜像差异0，退役轮转表0；未删除账号或补造历史事件。
- 已上传新版可用后，可信控制依次ensure .97、replace为仅.97；legacy标识保持原值。工具验证所有移除版本/legacy/未知版本426。最终完整ecs-verify含公网IP Host探测退出0，allowlist verify通过；外部正式HTTPS独立探针.97=200、.96=426、99.0.0=426。
- 重建期间有短暂502/连接EOF，内置健康等待后正常，最终API运行且restartCount=0。既有隐私保留任务deletedRows/telemetryDeletedRows均0。未上传本地DB、凭据或会话，未提审/正式发布或发送真实测试通知。
- 临时部署包装器首版正则替换错误被本地bash -n拒绝，未上传/执行；改为显式分组后语法通过，再按哈希校验的固定脚本部署。生产操作未通过stdin流式传递多步脚本。
- 正式上传候选在源码与版本绑定后均通过官方PS安全检查；槽位顺序独占，正式发布租约已释放。原始证据在general-1/runtime/audit/feedback6-release/final，receipt在canonical runtime/audit/miniprogram-trials，均ignored。

本次文档收口检查点为docs(release): record feedback6 trial 97 delivery。只记录已交付36fae3d1/.97，不再重复部署、备份、上传或同步服务器元数据。唯一下一任务：用户在小米14重开体验版，确认.97/36fae3d后复核日历08:00切换、补录/手动排班、账号编辑及通讯录首次搜索；原生结果与耗时仍未验证。
