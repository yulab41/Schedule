# 列表末尾间距与通讯录首次搜索（2026-10-01）

## 范围、现场与基线

用户确认两张小米14截图来自`.225@f9457d5`，分别为护士成员首页和医生访客页；末卡紧贴底部导航。通讯录等待发生在输入拼音/数字后点击键盘搜索。当前手机renderer、基础库和微信版本未提供，截图只作为问题现场，不能作为修改后验收。

主线基线`61e5f18f`，独占warm general-1，Acquire → ReuseOnly → mini Bootstrap → 定向72项通过；依赖指纹893aa247…，无安装。canonical的既有用户文件保留。general-2另取得独占租约，在同一干净基线构建并记录最大20个文件，随后官方释放；不共用可写依赖。

| 基线检查                                         | 实际结果                            |
| ------------------------------------------------ | ----------------------------------- |
| Mini定向                                         | 4文件72项通过                       |
| `pnpm --filter @schedule/miniprogram typecheck`  | 通过，2664ms                        |
| Mini目录ESLint                                   | 通过，6491ms                        |
| production build                                 | 通过，1533ms                        |
| 主包/总包                                        | 1183467 / 3963716 B                 |
| scheduling / organization / workflows / insights | 432675 / 855817 / 532451 / 959306 B |

耗时为本机PowerShell墙钟，不能代表手机启动或页面速度。基线构建、日志、最大文件及脱敏汇总保存在ignored `runtime/audit/calendar-bottom-directory-20261001/`。

## CAL-FOOTER-001（P2，已实现待同构建手机复核）

- 原因：列表外层使用flex占满已扣除导航高度的工作区，并把外层底部padding置零；内部`.list-panel-content`也没有底部padding，滚动到底时末卡边框刚好贴着导航。访客通过`@import '../workbench/index.wxss'`共享此路径。
- 引入点：`git log -S 'list-panel-content'`和blame定位`9045dc02`，该提交把滚动容器的`padding: 8px 0 16px`迁到内部内容时漏掉底部16px；`9fdf659a`置零外层留白。不是本次原子切换提交引入。
- 最小修复：仅在共享内容加`padding-bottom: var(--ui-spacing-xs)`（8px），与`.list-day-slot`卡片间距一致。导航高度、安全区、外层高度、滚动容器、定位、列表数据和请求未改。
- 证据：使用真实成员/访客WXSS和共享token，合成无个人信息卡片；320/390宽 × 0/24px安全区 × 两页，共8个桌面Chromium场景。旧样式8场景全部间距0失败，补丁后全部间距8px通过，最后44px拨号按钮完整可见，无横向溢出。
- 回归命令：`node apps/miniprogram/scripts/calendar-list-footer-layout.mjs`。脚本只读取源码并写ignored几何/截图，浏览器是既有本机Edge/Chrome，不新增依赖、不改变常规Vitest运行所需环境。
- 风险/置信度：低/高。8px是视觉留白而非额外导航占位，避免重复扣安全区。原生滚动末端和小米14视觉仍需同构建复核。

## DIR-COLD-001（P2，当前服务端/手机分段待验证）

- 用户明确采用拼音/数字并点键盘搜索。`handleSearch`直接调用`search`并取消待执行timer；500ms仅用于含汉字的自动输入搜索，因此不能把它当成本次首次等待原因。
- 当前路径已有工作台串行面板预加载、双模式facets预加载、30条服务端分页、轻量解码、当前查询完成复用与进行中共享；没有整库下载、本地全库拼音索引或每次搜索等待facets。
- 新增两模式检查：筛选响应保持未完成，用拼音确认立即发出一页请求，在不推进假计时器、不返回facets的条件下已提交结果；facets晚完成后可见结果保持。两个用例通过，证明当前客户端没有依赖这段预加载完成的额外等待，不代表手机实际渲染耗时。
- 500ms保护源自`bb97145d`及阶段B实测265–450ms连续输入；本轮保留，避免重新制造旧关键词并发。API候选索引检查已在onReady执行，已缓存结果过期时后台复核；没有证据支持再增加一次客户端“准备”请求。
- 历史`.94/.75`曾出现主查询长尾，后续已有candidate和readiness改进；历史数据只用于选取诊断路径，不能当作`.225`或当前生产实测。
- 用户补充测试工具已移除。产物复核`testToolsRegistered=false`，`e6ef714b`从生产排除diagnostics目录；源文件仍存在供复用，不能据它给用户旧菜单操作步骤。已撤回该复测路径，不重新加入菜单。两项边界测试是Node控制器证据，不是当前手机诊断报告。
- 当前测量：用户明确批准生产只读诊断，已读取API/Web完成耗时、数据库元数据与只读EXPLAIN，结果见下节。没有执行实际生产搜索、EXPLAIN ANALYZE、清缓存或重启。能力/认证、DNS/连接/TLS/首字节/下载和渲染分段需可用的运行工具，当前工具无法测量，暂未验证；不以服务端总耗时推算全部手机阶段。
- 优化决策：若主查询/计数占主导，先做隔离环境结果/权限/排序/游标等价验证，再改SQL/索引；若传输或连接占主导，评估现有连接和响应体；若客户端卡片/提交占主导，再做最小渲染补丁。当前不新增全库预加载或无证据缓存，不宣称首搜已提速。

## 本轮验证与行为变化

业务变化只有滚动内容末尾增加8px留白。新增测试/诊断脚本不进入小程序产物；通讯录业务、API、数据库、共享契约、权限、搜索排序和请求次数未改变。

- 最终Mini全量：1344通过/23既有跳过，193文件通过/4文件跳过，147.83s；新增两项首搜边界检查与全suite一起通过。
- 根format/lint/build/typecheck通过；根Vitest1368通过/476按既有数据库环境规则跳过，285文件通过/38跳过，203.21s；同一`pnpm test`先执行Codex守护测试。未触及API/数据库，不把跳过的MySQL集成测试写成通过。
- production verify通过：source/build/package/performance/determinism全部通过；既有手排1513节点相对1000目标的best-effort警告仍存在，无新增警告。最终干净67d2fff的同口径本地production总包3963756B（+40B）、主包1183507B，其余分包不变；复测8123ms，最大20文件已记录，前三最大文件及大小不变。工作树阶段+39B源于dirty身份字段长度差异，不能混作最终干净对比。
- 新脚本格式通过；首次lint发现合成导航文案全角空格，已改普通空格，最终Mini ESLint通过。早期几何脚本误从warm检查canonical输出目录，已改用Git common-dir归属的canonical只读检查；正式8红→8绿不使用该工具错误作为回归证据。
- 上传干跑通过。运行/浏览器验证：`pnpm smoke:check-core`通过；本轮未触及Web/契约核心，不要求`pnpm smoke:browser`。桌面CSS几何检查是另一条辅助证据。
- Agent微信开发者工具CLI：门禁equal、已登录；成员/访客WXSS编译成功。当前local构建停在身份页，未取得真实业务页面Console/Network、手机帧时间或首搜分段，暂未验证。项目窗口已关闭，避免保留槽位监听进程。
- 成功读取Skill：schedule-project-guardrails、systematic-debugging、frontend-design、miniprogram-development、wechatide-skill及相关debugger/initializer/automator。实际使用Git/PowerShell、既有Node/pnpm/Vitest构建检查、Playwright读取CSS几何、wechatide状态/项目打开关闭/WXSS编译，以及当次批准的SSH只读诊断；未使用开发者工具MCP或把桌面浏览器结果写成原生验收。

## 交付与停止条件

业务检查点67d2fff0（`fix(miniprogram): restore calendar list footer spacing`）正常推送任务分支/main，canonical快进同步且保留原10项未跟踪用户内容。general-1正式提升为干净detached上传用途，通过准备/版本绑定两次检查；正式Node入口独占锁动态分配`0.1.0-p10.20261001.226`，描述`列表底部间距修复 67d2fff`，2026-10-01T02:50:40.687Z上传成功。Manifest3851c9c1396a96ccacf58ea033e07f7bd3b9fa1c61cb6426aa1b91983910e609；不可变tag及allocation/manifest/receipt在正式台账。测试页面为成员/访客日历列表末尾及两种通讯录确认搜索。

版本绑定产物总包3964832B、主包1183808B（包含完整版本/描述等身份），不与未绑定版本的本地基线混算。上传不证明生产放行；新版本只增放行已单独询问具体L4授权，尚待答复。旧版本保留。完成后general-1正式释放，文档收口重新Acquire general-2、ReuseOnly/mini Bootstrap复用，定向文档3项通过，无安装。Mini/文档范围不部署API/Web、备份/迁移数据库或同步服务器身份。

文档收口行为变化仅记录已完成上传和当前只读证据、纠正待授权旧状态；四份文档格式、agent-context-policy定向3项、`pnpm smoke:check-core`及`git diff --check`通过，逐行审查不含应用/凭据/原始数据。检查点消息`docs(audit): record footer trial and readonly directory diagnosis`，原始证据在ignored轮次目录。

## 当前生产只读证据（2026-10-01 10:47–10:59北京时间）

- 当次授权仅为只读诊断。按守护路由和受控本机记录验证物理路由、两家DNS、HTTPS、SSH严格主机密钥；live release实时读取为dbe352886ff425401586da187054bdd7a488dfcc。未打印凭据、主机/IP、关键词、请求/响应、联系人或行级业务数据；脱敏报告留在ignored轮次目录。
- API当前配置candidate，覆盖索引`entry_id,type,normalized_value`可见且定义完整，已有号码/别名索引存在。当前API容器启动于2026-10-01T01:25:24.206Z；其后窗口内没有搜索请求/plan-selected记录，不能从配置推定用户首搜实际用到的计划。两种facets各7次，API中位数49/32ms、最大104/131ms；Web中位数52/38ms、最大105/136ms，最大响应4669/7406B。API和Web均无搜索样本；已请用户退出重进后连续搜索两次并只提供完成时间。
- MySQL8.4.11、buffer pool128MiB，performance_schema关闭，当前没有可用查询摘要；保持原配置未启用。表容量仅信息结构估计，不把估计行数当作实际联系人总数。发布批次元数据为院内341条/员工1200条，未读取个人条目。
- 源码候选生成器+合成拼音/数字、两种当前发布批次、rows/count共8个`EXPLAIN FORMAT=JSON`成功；session5s及进程8s限制。无筛选/游标/工号别名补充条件，外层投影是辅助计划，不能冒充全部真实关键词、权限或运行耗时。号码和精确/前缀别名走现有索引；拼音包含分支按批次及覆盖索引检查别名，仍需候选聚合/排序。`ALL`包含候选临时结果和仅2行校区表，不等于全表扫所有员工；计划cost/估计行数不转换成毫秒。
- 结论：当前不能判定1–2秒的主要阶段，不能据此调整数据库参数、添加索引/缓存或下载整库。首搜分段暂未验证，保留已测试的权限、排名、分页和操作；待新请求证据再做最小优化。

唯一下一任务：取得当前首搜分段证据，按实际主导阶段选择低风险优化；同时用新体验版复核两页滚动末尾。无同构建手机证据不写无感/验收通过，不提审、不正式发布。
