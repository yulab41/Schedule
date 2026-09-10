# 访客系统体验版交付记录

## 上传前证明补充

- 用户已明确同意上传并放行890efd8b修复检查点。本次上传/追加允许列表授权有效，不包含版本退役、提审、正式发布或重配群关联。
- fresh origin/main=890efd8b；最近合格receipt为0.1.0-p10.20260910.99/ca634116；生产实时live=4e0a0d1af9d1d3580ab6add1e83f857262852a9d。可信allowlist和ecs-verifier的SHA256与本地受控文件一致。
- 初次正式CI预检拒绝required checkpoint5285dd1的旧整文件证明；未分配版本、创建tag或上传。该历史分支采用canonical-tree-files证明；本轮工作台业务修复改变其整文件blob，不能继续沿用旧值。
- 对旧32e0e95eb5c20f3ed3ffb4e440027a22e4143e8d与当前111c05e295e78b4056af49e022d7a842b0411cf7执行TypeScript AST逐方法比对：15个日历/通讯录导航、month/week/list切换、定位及滚动队列方法完全一致；calendarNavAnimating仍不存在。其余8个proof blob完全一致。
- 只更新该blob与证据，保留全部required checkpoint和精确哈希验证。访客接口、身份/缓存/生命周期是已批准的业务修复，未宣称整个工作台等价。
- 此证明检查点不改变890efd8b业务源码、锁文件或构建工具；沿用visitor-system-fix.md应用验证，本次动效/lineage/候选/锁28项、CI封装6项及icon parity均通过，trial账本3个必需检查点有效。动态版本绑定包仍须在干净独占候选中重新构建。
- 证明提交消息：chore(release): refresh visitor workbench lineage proof。完成推送后按同次授权上传并追加放行，不另行部署API/Web或迁移数据库。

## 官方编译补充修复

- 17939041已推送并通过候选检查；正式锁内分配0.1.0-p10.20260910.100，Manifest e8c83b2a71655c3a3519a69815509eff8efd2a18908f84f3167da97faf8d6748，远端tag已预约。
- 官方miniprogram-ci拒绝guest.json的Skyline + navigationStyle=default组合。此错误来自890efd8b新增扫码页；本地verify此前未检查该组合，未把成功构建当作成功上传。没有成功receipt，也未放行.100；号码/tag/分配与失败证据永久保留。
- 同一批准任务继续修正为custom导航，按状态栏/胶囊测量头部安全区和剩余滚动高度；保留独立扫码页及原只读日历，无认证/业务/API变化。窗口resize重新计算布局，群名截断避免挤占返回按钮。
- 320/390导航配置和安全区回归先失败后通过；匿名页15、Page边界2通过，Mini verify/确定性/包体/Worklet及受影响ESLint通过。未使用开发者工具，最终原生效果仍需小米14。
- 导航修复检查点消息：fix(miniprogram): use Skyline-safe guest navigation。推送后重新由锁内分配器选择未占用版本，不复用.100。

## 已完成交付

- 最终源码检查点：f7bc3ccc5d967b5bbeca0493256a7bdce12b49bb，`fix(miniprogram): use Skyline-safe guest navigation`；包含890efd8b完整访客修复及17939041证明补充，均已普通推送main。
- 正式锁内分配体验版`0.1.0-p10.20260910.101`，说明“访客切群与扫码只读日历修复 f7bc3cc”。production/clean；构建2026-09-10T14:24:30.552Z，上传成功2026-09-10T14:26:33.204Z（香港时间22:26:33）。
- Manifest `e0e3431ae0c73c70bddf895231e084024a855835190e6cdf9bae79500efe156c`；353个冻结文件逐项大小/SHA256核验通过，receipt与版本、SHA、构建时间、Manifest及远端不可变tag完全一致。
- 官方Worklet编译通过；版本绑定主包1,646,685字节、总包4,433,783字节，保留已有主包1.5MiB预警。构建前和版本绑定后真实PowerShell候选检查均通过，来源为独占healthy warm槽，依赖复用、没有安装。
- 生产实时基线及完成后live均为4e0a0d1af9d1d3580ab6add1e83f857262852a9d；可信`ensure .101`追加1个版本，保留旧版本/legacy。API/Web重建期间短暂EOF/502，健康等待后恢复；完整ecs-verifier和allowlist verify通过。
- 独立正式HTTPS（保留TLS验证）：.101/.99/.98=200；失败的.100及动态未知版本=426。另确认.101的global/core/guest均true。
- 本轮没有部署新的API/Web应用源码、迁移数据库或新建数据库备份；只上传小程序及授权的允许列表变更。没有启停医护群关联、创建个人访客、发送真实通知、提审或正式发布。
- ignored证据：general-1/runtime/audit/visitor-upload（最初proof失败与AST证明）、visitor-upload-final（.100编译失败及冻结包）、visitor-upload-nav（.101回执/冻结353文件/生产验证）；canonical runtime/audit/miniprogram-trials保存不可变分配、Manifest和receipt。

## 交接

文档收口检查点：`docs(release): record visitor trial 101 delivery`。只记录已交付的f7bc3ccc/.101，不再上传、生产备份、部署或同步服务器release标识。

唯一下一任务：用户在小米14关闭并重开体验版，确认.101/f7bc3cc、trial、Skyline、基础库/微信版本和构建时间，反复医生群↔护士群切换、验证月/周/列表及筛选，再用现有访客码扫码并后台往返。自动化交付已完成，待用户原生复核；不能把上传成功当作卡死/闪退已消除。
