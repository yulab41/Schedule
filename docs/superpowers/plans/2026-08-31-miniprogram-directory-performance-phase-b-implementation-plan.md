# 通讯录性能诊断阶段 B 实施计划

## Task 1：固化测量证据

- 保存两批 `.72@5fff288` 脱敏记录和 production request ID 对照分析到 ignored `runtime/audit/`。
- 生成可复制的 HTML 报告，展示客户端阶段、API 总耗时、API 外差值、被替代请求比例和数据局限。
- 更新审计状态，明确本批只处理请求爆发和服务端分段诊断。

停止条件：17 条记录全部与生产日志对上，报告不含姓名、号码、工号、账号、群组、权限、筛选或游标。

## Task 2：测试先行

- Mini controller 新增连续输入防抖回归。
- Mini transport/diagnostics 新增受控诊断头、Server-Timing 白名单解析和复制报告回归。
- API 新增诊断门禁、固定 Header 格式与隐私回归。
- 先在旧实现上看到目标用例失败，再实施代码。

停止条件：红灯只对应本批预期行为，不改测试规避旧语义。

## Task 3：定向实现

- 自动搜索防抖调整为 500ms；显式搜索确认保持立即执行。
- API 为受控通讯录列表诊断增加路由、事务和查询分段计时，使用标准 Server-Timing 响应头。
- 客户端只在记录状态增加诊断头，只保留固定、脱敏的服务端阶段并加入最近 1/10 次复制文本。

停止条件：普通 API body/headers 行为、权限、搜索、分页、缓存与错误路径保持；无敏感字段进入诊断。

## Task 4：验证、checkpoint 与生产

- 运行 API/Mini 定向测试、Mini 全量、root 全量、全端 build/typecheck、Mini verify/source/package/performance/determinism/CI、任务 lint/format/diff 和 core smoke。
- 逐行复核 diff 与语义等价；显式暂存本批文件，提交并推送。
- 生产备份后部署，核对 release、API/Web、正式能力白名单和公网 verifier。
- 新体验版上传前给出版本、SHA、描述、脏树和测试页，等待用户本次明确同意。

停止条件：生产与推送 checkpoint 一致；未获上传批准前不上传 `.73`，不宣称性能已改善。
