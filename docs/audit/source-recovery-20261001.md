# 主目录文件恢复与继续开发验证（2026-10-01）

用户授权尽量恢复被删文件、确保后续开发。此前保留的删除现场仍在 ignored `runtime/audit/calendar-switch-20260930/`；本轮备份、路径清单、校验和日志位于 ignored `runtime/audit/source-recovery-20261001/`。没有证据确认删除由 CCleaner 引起。

## 恢复结果与范围

- 起点：canonical `main` 为 `dbe352886ff425401586da187054bdd7a488dfcc`，1344 个未暂存删除、10 个既有未跟踪目录/文件条目，无其它源码内容差异。正常 fetch 后最新主线为 `c460520fbc21b577558394e11becbac905ff370d`。
- 先备份 Git index、HEAD、refs、删除路径和原提交图缓存；181 个保留文件只记录本地哈希，不复制环境凭证，也不把用户文件纳入提交。
- 使用 NUL 路径清单和 `git restore --source=<原HEAD> --worktree --pathspec-from-file=... --pathspec-file-nul` 仅补缺失文件，再 `git merge --ff-only <已核实主线>`。恢复1344文件，1939个既有跟踪路径全部存在，181个保留文件哈希不变；近期账号/30天留存和日历优化均保留。
- 恢复后173个旧文件状态缓存仍保存历史CRLF长度。逐个证明原始内容哈希等于index且路径属于恢复清单后，仅对这些明确路径刷新index；暂存内容差异和跟踪内容差异均为0。没有 reset、强制 checkout、clean、历史改写或删除用户文件。
- Git 提交图是辅助查询缓存。原常规 `git fsck --full` 报缓存引用不可读取的历史对象 `ae74d8c4…`；关闭提交图读取时实际对象检查通过，可达历史对象缺失0。备份并移存旧缓存后用 `git commit-graph write --reachable` 重建，`git commit-graph verify` 和正常 `git fsck --full --no-dangling` 均通过。
- 无法从 Git 列举或保证恢复未知的未跟踪/未提交/被忽略文件。现有 `.env`、用户Excel、技能及本地用户文件保留；源码和构建输入完整。不把重新生成的缓存等同于原始个人配置恢复。

## 开发环境

独占注册 warm `general-1`，基线 `c460520f`，固定路线 Acquire → ReuseOnly → root Bootstrap → Targeted test。指纹 `893aa247…`，无依赖安装、下载、复制或冷槽位创建。Acquire按需构建3个共享producer，随后bootstrap复用8个producer；14项池/依赖定向测试通过。canonical仍为项目规定的路由入口，缺失的根目录node_modules不通过安装或拼接修补；后续构建/测试从正式warm租约环境运行。

## 验证中发现的既有测试问题

`RECOVERY-CLOCK-001`，P2，高置信，影响仅测试，修复风险低。首次 `pnpm verify` 的格式、lint、build、typecheck、图标通过，但小程序1326通过/23跳过、2失败。时间跨至北京时间10月1日凌晨：测试按自然月准备10月数据，首页值班日08:00前仍属9月，导致活动请求与离线缓存用例失败；不是恢复文件内容损坏。

`git log -S 'const activeMonth'`/blame定位原自然月夹具至 `9e3a966c`；业务08:00值班日口径由 `528722f4` 引入并被当前设计沿用。固定同一月初凌晨时间后，旧口径定向2失败/29跳过；修复测试取月复用既有 `getCurrentBusinessDate`，两个用例仅冻结Date并独立断言9月，保留真实异步计时、原请求次序和离线断言。定向31项通过，格式和ESLint通过。曾尝试全suite冻结Date，干扰护士用例自有完整假计时器，已撤回为两个用例局部冻结；不保留引入退化的方案。

行为变化清单：恢复当前已提交源码；刷新本地Git辅助缓存和状态；纠正测试月口径并固定两个边界夹具。没有业务函数、模板、样式、API、契约、数据库或依赖变化。

## 最终验证与交付

最终小程序192文件通过/4跳过、1328项通过/23跳过（146.90s）；根Vitest285文件通过/38跳过、1368项通过/476跳过（203.82s）；Codex Node83通过/0失败。根测试跳过的数据库等环境用例不视为已验证；本轮没有重复真实数据库或浏览器业务验收。构建、类型、lint、图标和格式通过的证据在首轮 `verify.log`，测试文件改变不影响应用构建输入，因此继续运行失败阶段和未运行的根测试，不重复已通过构建。不能把首轮失败的单次 `pnpm verify` 描述成一次性全绿。

`pnpm exec vitest run scripts/agent-context-policy.test.mjs scripts/project-local-artifacts.test.mjs scripts/test-discovery-policy.test.mjs` 9项通过，`git diff --check`、测试文件Prettier和ESLint通过。运行/浏览器验证：`pnpm smoke:check-core` 通过，变更仅Mini测试与文档，未涉及Web/契约核心，无需本轮 `pnpm smoke:browser`。

只提交Mini测试与恢复/状态/调试记录；检查点消息 `test(miniprogram): stabilize duty-month checks after source recovery`。提交/正常推送main、canonical快进、保留文件及租约释放最终结果以Git和本轮ignored交付回执为准；没有把现场备份、环境文件、用户文件、依赖或构建输出纳入提交。

成功读取本仓库guardrail、systematic-debugging和miniprogram-development；实际使用Git、PowerShell、Node、pnpm、Vitest及既有构建/校验工具。此轮不操作开发者工具/MCP，不测量手机性能；实际小米14仍暂未验证。此轮为本地恢复及测试/文档检查点，不需要上传新体验版，不连接或修改生产。唯一下一业务待办为小米14 `.224@c0c1463` 日历同构建验收；本轮Node恢复/验证不能替代实体设备验收。
