# Project Status

## 当前批次：UX-CLEANUP-10 feedback4 已完成自动验证，待用户复核

- 基线 `596c20b2321a3592fc3841a82ae0764e69aeb4b0`，2026-09-07已用 `git ls-remote`核对远端main；根工作目录既有未跟踪内容未改动。
- 用户批准七项Mini微调均已实现：未绑定直接账号密码sheet及旧步骤退役；初始密码冷启动提醒与本机按账号永久关闭；密码按钮修正；统计左置；今日选中黄圈；通知复用两秒ui-toast；独立微信订阅入口与同步授权调用。
- `feedback4-20260907`，general-3先由root独占，c7f93d48提交并Release后由feedback4-notify正式Acquire。ReuseOnly/Bootstrap均PASS，INSTALL_INVOKED=false。无槽时POOL_BUSY，顺序交接，不共享可写依赖。
- 最终Mini全集889通过/14条件skip（142文件通过/1跳过，103.73s）；typecheck、变更ESLint/format、Mini verify、icon parity通过。前半轮布局代理16项及共享toast浏览器布局28组合通过；均非原生验收。
- notify阶段verify 6.25s：dirty主包1,693,648/总包5,062,990 bytes；clean基线1,689,058/5,051,234。净开销存在，不声称减包；最终clean测量待检查点后交接记录。主包1.5M与矩阵节点预算预警保留。
- c7f93d48收尾审查的401自动恢复漏提醒已补waitForSession及卸载代数校验，2项先红后绿；通知新增20项回归含同步原生调用、静默授权、重复/迟到响应、direct Page和设置错误入口。
- 本检查点message：`fix(miniprogram): clarify subscriptions and transient feedback`。暂未推送/上传/部署，无API、Web或schema修改。
- 唯一下一任务：root接回已验证检查点，记录clean包体并普通推送，停止于UPLOAD_REQUIRED；最终SHA体验上传须用户当次授权，随后小米14核对版本复核七项。
- 详细证据与回归引入点见 `docs/audit/ux-cleanup-10-feedback4.md`。前序feedback3、feedback2交付事实保留在各轮审计文件与Git，不推断当前生产/体验版身份。
