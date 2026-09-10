# 小程序访客系统修复

## 结论与验收边界

代码修复与自动化验证已完成，待用户批准上传并进行原生复核；尚未上传新体验版。用户截图没有与本轮构建绑定的 SHA、trial、基础库和微信版本，不能用于宣称本轮小米14验收通过。

- 基线 main/origin main `fe2aa722`；生产医护群关联仍保留，本轮没有生产操作、迁移、个人成员创建或通知发送。
- 用户批准的范围：登录访客切群、观察器递归与请求竞态、匿名扫码页、只读日历与隐私隔离。不迁移认证协议。
- 独占 `runtime/wt/general-1`，租约任务 `visitor-complete`；Acquire → ReuseOnly → Bootstrap → targeted test，无依赖安装。

## 证据、原因和行为变化

| 编号 | 问题与引入点 | 修复和验证 | 状态 |
|---|---|---|---|
| VIS-01 / P1 | 通讯录空群分支写回观察属性。`git log -S setMissingGroupError` 指向 `ef9ffeb0`，现有空分支和空groupId写回 blame为 `6b5b30fb` | 用真实 miniprogram-simulate 属性观察器复现，80次上限捕捉递归；输入groupId与内部loadedGroupId分离，空群/访客上下文一次清理，旧runtime与请求失效 | 自动化通过；闪退待真机复核 |
| VIS-02 / P1 | 工作台一直调用正式成员calendar接口，源于 `ad4cfb2c`；旧访客测试对所有URL返回成功 | 访客mock成员API明确403，仅guest-calendar返回服务端包装结构；登录访客只走专用接口，按当前账号/群/角色/月隔离读结果 | 自动化通过 |
| VIS-03 / P1 | 切群未同步提升日历请求序号；同群角色变化未清内存，旧数据和联系方式可能短暂保留 | 点击即失效旧请求，清空日历、筛选、弹层和联系方式，访客切回日历；同群角色变化重新授权；晚到200/403不改新群UI或缓存 | 自动化通过 |
| VIS-04 / P1 | 二维码目标pages/guest/guest未注册 | 新原生Page接收32位scene key，解析后读取匿名日历；公开请求不带登录令牌，不改账号/工作群，不自动加群。保留月/周/列表、日期详情及成员/岗位/班种筛选 | 自动化通过；扫码待真机复核 |
| VIS-05 / P1 | 持久化成员缓存不能用于访客；旧通知/工具权限可能沿用 | 访客日历不读写持久化缓存，降级清除该群成员日历缓存，隐藏全部联系方式/事件/变更筛选/写入口；guest即使带developer标记也无群管理工具；停止通知轮询和无权面板预加载 | 自动化通过 |
| VIS-06 / P2 | 本轮快速切群回归发现被放弃的相邻月份promise拒绝无人观察 | 创建promise时即观察拒绝，仍向活跃消费者保留原拒绝语义；过时上下文不会发起相邻读取或影响新群 | 先红后绿，无未处理拒绝 |
| VIS-07 / P2 | 新页面首次包体1,987,999字节超过1.8MiB内部限制；schema生成器顶层JSON.parse自 `591ccff6` 保留未用声明 | 对有效静态schema及无外部副作用的endpoint/decoder构造调用添加PURE标记，生成器重建产物；不放宽包限制、不删功能。18个既有客户端去注释AST与基线一致 | 包体通过 |

## 语义审计

- 通讯录保留methods接收者和生命周期`.call(this)`，仅将内部已加载群字段改名；输入properties不回写。实例ID、runtime对象、context/query序号校验保留。
- 共享客户端新增三个读取方法，现有方法路径、认证、请求体、解码、异常和调用次数不变；访客严格使用现有contracts生成schema，没有服务器协议或数据库变化。
- 18个既有客户端仅新增构建注释，TypeScript去注释AST逐文件一致。标注对象均为本仓库已生成且验证有效的静态schema/endpoint，原编译器、校验函数、接收者、空值语义和使用中的异常路径未改；生产构建只裁剪未使用的声明初始化。
- 工作台的切群清理、角色降级、访客接口和通知权限属于明确批准的行为修复，不称为语义等价重构。相邻读取的返回promise仍会拒绝；新增内部拒绝观察只处理已放弃的窗口。

## 验证记录

- 基线：`pnpm icon:parity`通过；目录/工作台76测试通过。`pnpm --filter @schedule/miniprogram verify`、build、check:package通过，串行9.19秒，主包1,764,092字节；保留原1.5MiB预警及矩阵节点1445/1504预警。
- 红测：真实观察器递归和严格访客接口各失败；同步切群清理/同群降级测试失败；扫码路由注册失败；新页包体超限。随后逐项转绿。
- 定向：目录57、工作台24、匿名页13、工具权限6；共享访客客户端3。覆盖快速往返、晚到200/403、同群身份变化、后台恢复、卸载、匿名/登录扫码隔离、跨年与三种视图、无排班、失效码、网络重试、能力关闭、WXML动作注册和联系方式隔离。
- `pnpm build`、`pnpm typecheck`、`pnpm format:check`、`pnpm lint`、`pnpm icon:parity:check`通过；`pnpm miniprogram:test`全量1014通过/15跳过。最终补充的非空排班筛选与隐藏生命周期检查后，匿名页13及工作台48项定向通过。
- `pnpm test`依赖保护81通过；root全量1225通过/418跳过，唯一失败为旧Web测试假定所有读取均GET。本轮解析沿用服务器POST协议，修正为仅resolveVisitor为POST、其他均GET后，相关共享客户端/Web46项复测通过；未修改服务器来迁就测试。
- 最终Mini verify通过：静态/确定性/页面注册/包体/Worklet2入2出。最终主包1,644,802字节、总包4,430,695字节，Manifest为6e342707e54fc350c61b5603b0b5d72dc0d5a7a964d7f46c57edc895ba0d8bc6，仍保留原1.5MiB和矩阵1445/1504预警。产物是local/dirty验证包，不能冒充已上传体验版。
- 运行/浏览器验证：`pnpm smoke:browser`通过登录、管理员、成员、匿名访客/vkey/访问记录流程，无浏览器错误；执行前确认本地Web/API未运行，再启动本轮构建，真实本地MySQL可用，服务端采用mock微信。仅合成local-admin测试标记短暂调整，finally查询确认恢复；生产医护群未操作。
- 运行输出位于ignored `runtime/audit/visitor-fix/`，浏览器截图位于`runtime/smoke/visitor-fix/`。未执行新一轮MySQL API集成套件；服务器和迁移源码未改。没有390/320新页面截图比较或小米14原生通过结论，沿用既有P4日历结构，待体验版复核。
- 读取Skills：schedule-project-guardrails、systematic-debugging、miniprogram-development及frontend-design；沿用批准的日历视觉。未调用微信开发者工具GUI/CLI。原生Console、Network、冷启动、内存和闪退栈：当前工具无法测量，暂未验证。

## 交付与唯一下一任务

检查点标识：`fix(miniprogram): complete guest calendars and isolate group switching`。已完成本地验证，按该消息提交推送；最终SHA由Git检查点给出。未获得本检查点上传同意前保持UPLOAD_REQUIRED，不分配下一版本。

上传同意后按既有流程生成同一SHA体验版；小米14记录版本、SHA、trial、Skyline、基础库、微信版本、构建时间后，反复医生群↔护士群切换，验证三视图/筛选/跨年、已登录和未登录扫码、后台往返及失效码。仍卡死或闪退则继续调查，不标记真机修复完成。
