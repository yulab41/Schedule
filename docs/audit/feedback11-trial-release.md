# Feedback11 体验版108交付

日期：2026-09-12。用户明确授权“上传并放行”，范围为已推送的两项修复体验版上传，以及服务器版本允许列表只增不删。

## 上传身份

- 版本：`0.1.0-p10.20260912.108`；源码：`c563afff942f8b25fb5d8c8825c200d2b9c255d5`。
- 描述：`二维码保存与通知已读修复 c563aff`。只包含已验证的QR-11、NOTIFY-11修复；EXPORT-11导出空白仍待定位，不宣称修复。
- production/clean；构建时间`2026-09-11T23:11:43.500Z`，成功上传时间`2026-09-11T23:13:46.988Z`（UTC）。
- 354文件冻结Manifest：`3fbff2efaf53d8b8de935e777cab456770b620b2b821a1b6c28e51799e3aed07`。逐文件长度/hash、receipt、不可变远端tag及版本/SHA/Manifest一致。
- 本次即时fetch的origin/main为c563afff；上一合格成功体验版为107/4b4af0a，receipt和远端tag已核验，项目身份配置无变化。版本108由正式锁内分配器动态选择，没有手工选号或复用失败号码。

## 检查与放行

- 复用[feedback11.md](feedback11.md)对应应用源码的完整验证；本轮上传专项24项、CI封装6项通过。Acquire/ReuseOnly/Bootstrap均复用依赖，无安装。
- 正式helper将独占general-4准备为upload用途，clean detached候选检查和版本绑定后的正式检查均PASS；源码、输出、包体检查通过，官方Summer Worklet编译完成。
- 主包1681039、总包4505008字节；保留既有主包1.5M内部预警，不把上传或Node检查算作小米14验收。
- 即时服务器live为`b618d93861d05ae0c597fa8dfe40ed478902be5c`。固定该live及已安装allowlist/verifier控制脚本hash后，只调用可信`ensure`追加108；旧允许列表保留。控制脚本重建既有容器时短暂502，内置健康等待恢复，最终追加1版并验证通过。
- 完整`ecs-verify.sh`与`schedule-client-version-allowlist verify`均退出0。独立公网HTTPS核验：108=200、107=200、动态未知版本=426；108的global/core/organization/insights/guest均启用。
- 未部署新应用代码、未同步服务器release标识、未创建生产备份或迁移、未主动发送真实通知、未提审或正式发布。文档检查点不触发再次上传、放行或服务器操作。

## 网络及操作锁

- 历史微信IPv4通路出现ECONNRESET，尚未分配版本。当前系统DNS为真实公网地址，与旧记录不同；按当前解析绑定进程内IPv4，保留TLS主机名/证书验证，nonce握手成功后上传。未改系统代理、DNS、hosts或微信后台配置。
- 发现trial107遗留操作锁，确认记录PID不存在、子进程0、活动上传Node进程0、锁内仅原owner文件。归档原owner后删除该文件与空操作锁目录；不删除任何allocation、manifest、receipt或远端预约tag。
- 凭据继续位于仓库外。脱敏日志、冻结包、回执核验、网络证明及生产验证记录归档于ignored `runtime/audit/feedback11-trial108/`。

## 唯一下一任务

小米14重新进入108/c563aff体验版，复核“邀请与访客 → 保存到相册”和“通知中心 → 点击通知”；若导出仍空白，返回“更多 → 测试工具”复制给Codex的简化报告，核对版本/renderer/基础库/微信版本后继续定位EXPORT-11。原生验收尚未通过，不扩大为所有安卓或iOS兼容结论。
