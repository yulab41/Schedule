# Project Status

## 当前批次：UX-CLEANUP-10 feedback4 实施中

- 基线 `596c20b2321a3592fc3841a82ae0764e69aeb4b0`，2026-09-07已用 `git ls-remote`核对远端main；根工作目录既有未跟踪内容未改动。
- 用户批准七项Mini微调；1–5已完成自动检查，待用户复核：微信未绑定直接账号密码sheet、退役自主建档与旧步骤；初始密码冷启动提醒、本机按账号永久关闭；密码按钮居中放大；统计左置；今日选中黄圈。
- `feedback4-20260907`，general-3独占。Acquire→ReuseOnly→Bootstrap均PASS，INSTALL_INVOKED=false。并行组返回POOL_BUSY，改为同槽顺序交接，不共享可写依赖。
- 已完成47项定向回归、类型/ESLint/构建与确定性/边界/包体检查、16项浏览器布局代理、icon parity。较早Mini全集862通过/1旧路径断言失败/14条件skip；旧断言迁到共享模板后定向通过，最终全集在6–7完成后重跑。
- 当前主包1,692,724/总包5,054,896 bytes；初始基线1,689,058/5,051,234。新增提醒及共享状态有净开销，未声称总包下降。新弹窗重复entry方案已移除；状态存App.globalData，覆盖独立CJS产物共享测试。
- 本检查点message：`fix(miniprogram): streamline identity and launch password reminder`。尚未上传/部署，无API、Web或schema修改。
- 唯一下一任务：复用释放后的general-3实现6–7通知胶囊与明确微信授权入口，然后整批验证、提交推送，停止于UPLOAD_REQUIRED。体验版上传需最终SHA的当次授权。
- 详细证据与回归引入点见 `docs/audit/ux-cleanup-10-feedback4.md`。前序feedback3、feedback2交付事实保留在各轮审计文件与Git，不推断当前生产/体验版身份。
