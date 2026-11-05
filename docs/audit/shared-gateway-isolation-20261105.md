# 共享网关纳管与AI工具隔离

- 用户明确要求继续至全部完成，保留AI工具并隔离其对排班的影响。设计与步骤见同日shared-gateway-isolation-design/plan。
- 基线main/origin/main5ce06f0c，独占general-3，Acquire→ReuseOnly→release Bootstrap八包复用，安装0。原有canonical用户文件保留。
- 生产动态实读live09b79ff1/schema72。AI入口独立server_name，外部include已运行而源文件缺失。现有下次部署会丢入口的回归先失败，登记已存在引用后通过。
- AI服务独立aitool用户，现占约12MiB内存、37MiB交换，CPU上限1核、内存600MiB、交换无限、任务256。2核/约1.6GiB主机尚有约672MiB可用内存，短采样CPU空闲93–98%，存在轻微内存/IO压力，不能证明当前排班尾延迟来自AI服务。
- 保留AI浏览器本机媒体/扫描方案、6次每分钟解析限流、安全头和已关闭的服务器媒体中转。优先修复发布接入和资源边界。
- 桥接采用与服务器现状相同的入口引用，建立后续隔离发布可用的回退前驱。定向24项/格式/差异检查通过，已完成缺引用先红后绿。应用源码未改，复用之前应用测试，生产检查另行记录。
- 真实nginx -t与AI引用root所有/不可组写检查通过，桥接源文件SHA256等于服务器现有文件364e8021…。排班健康及AI首页/local/scan/扫描worker五项200。独立代码审查无阻塞，ESLint及core smoke通过。
- 部署前先按实时live冻结前驱并创建有效生产备份。当前检查点消息fix(infra): register the existing shared AI gateway。
- 完整生产部署、后续隔离和最终同步证据在实施中补录。原始脱敏证据留在ignored runtime/audit/shared-gateway-20261105/。
