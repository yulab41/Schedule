# Project Status

## 当前批次：feedback4 已获部署与体验上传授权，发布中

- 基线 `596c20b2321a3592fc3841a82ae0764e69aeb4b0`，2026-09-07已用 `git ls-remote`核对远端main；根工作目录既有未跟踪内容未改动。
- 用户批准七项Mini微调均已实现：未绑定直接账号密码sheet及旧步骤退役；初始密码冷启动提醒与本机按账号永久关闭；密码按钮修正；统计左置；今日选中黄圈；通知复用两秒ui-toast；独立微信订阅入口与同步授权调用。
- `feedback4-20260907`，general-3先由root独占，c7f93d48提交并Release后由feedback4-notify正式Acquire。ReuseOnly/Bootstrap均PASS，INSTALL_INVOKED=false。无槽时POOL_BUSY，顺序交接，不共享可写依赖。
- 最终Mini全集889通过/14条件skip（142文件通过/1跳过，103.73s）；typecheck、变更ESLint/format、Mini verify、icon parity通过。前半轮布局代理16项及共享toast浏览器布局28组合通过；均非原生验收。
- c55906e5 clean verify PASS：主包1,693,649/总包5,062,991 bytes；相较clean基线1,689,058/5,051,234净增4,591/11,757。净开销存在，不声称减包；主包1.5M与矩阵节点预算预警保留。
- c7f93d48收尾审查的401自动恢复漏提醒已补waitForSession及卸载代数校验，2项先红后绿；通知新增20项回归含同步原生调用、静默授权、重复/迟到响应、direct Page和设置错误入口。
- 源码c7f93d48与c55906e5已普通推送GitHub main；首次push遇schannel TLS失败，普通重试一次成功，未改系统/证书/代理。无API、Web或schema修改；上轮实施结束时未上传/部署，本次发布进展见下。
- 本文档收口message：`docs(audit): record feedback4 validated checkpoint`。文档无应用输入变化，复用上述应用验证。
- 用户当次已授权部署与体验上传。已备份并通过可信无停机复用发布1b493e6b，前后verifier通过；上传前5285dd1整文件证明过期，已按AST证据更新精确blob，业务源码不变。
- 唯一下一任务：提交证明修正、冻结新SHA并对齐生产及上传；rollback取当时当前live。详见 `docs/audit/ux-cleanup-10-feedback4-release.md`。
- 详细证据与回归引入点见 `docs/audit/ux-cleanup-10-feedback4.md`。前序feedback3、feedback2交付事实保留在各轮审计文件与Git，不推断当前生产/体验版身份。
