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

当前检查点：fix(release): renew feedback6 navigation lineage proof。唯一下一任务：推送证明修正后重新冻结候选，按同次授权继续真实上传、备份核验、迁移部署和版本切换；完成前不得写已交付。原生/小米14与首搜耗时仍待用户复核。
