# 排班网页校对界面与交互

## 范围与状态

- 用户要求参照小程序其他页面，优化校对页、按钮、弹窗、字号、间距与操作反馈。状态：已完成自动化及浏览器运行验证，体验版.215已上传放行，待小米14复核。
- 基线 `5b9e42e5`；独占 warm `runtime/wt/general-6`，`DEPENDENCY_MODE=REUSE_ONLY`，未安装依赖。使用已有 Storybook、共享 tokens、`ui-button`、`ui-sheet`、`ui-alert`、`ui-loading`。
- 引入点：`git log -S 'wx.showModal'` 与 `git blame` 定位最初页面 `a5de1931`，建议入口后于 `06d420a1` 增加。旧版存在 10–11px 操作文字、原生按钮尺寸不统一、双滚动列表与长纯文本确认框。
- 本轮为 Mini 页面和开发期 Storybook；API、权限、扫描、换班/加扣班执行及撤回业务校验均沿用现有服务。未执行真实换班、加扣班、网页写入或通知作为测试。

## 行为变化清单

1. 沿用通知页蓝白配色和系统字体；正文15px、辅助13px、日期/姓名17px，按钮触控高度至少44px，页面常规留白16px。窄屏减少外边距，大字号将三方对照改成纵排。
2. “待处理 / 操作记录”切换共用单个滚动区域；取消底部巨大换行按钮。差异来源、处理状态、三方人员、建议及阻塞原因分别展示。
3. 写入网页、换班/加扣班、恢复基线均使用共享底部确认弹层。换班显示完整日期变化及执行顺序；服务端现有实现执行完整方案并逐步复核，文案明确中途失败后查看最新记录。
4. 点击同一方案的第二个日期也从方案第一步预览；确认保存预览时的指纹，取消不写入、重复点击被忙碌状态挡住、冲突禁用确认。
5. 增加加载、成功、读取错误及空态；检测失败/未首次检测不显示“已一致”。页面卸载后不再 setData，确认弹层打开时不因 onShow 自动替换快照。
6. 本轮属于有意的界面与交互变化，不宣称语义等价重构。方法仍以页面接收者调用，异步错误归入提示并在 finally 释放忙碌状态；确认写入仅调用既有接口一次。

## 证据

- 原实现运行新交互回归：4失败/1通过；修改后定向8/8，覆盖预览、第二天入口、取消/重复提交、冲突、指纹失效、恢复最新基线、加载错误及微信字号设置。
- `pnpm --filter @schedule/miniprogram test`：189文件通过/3跳过，1298通过/21跳过，159.16秒。其后增加字号用例并调整局部变量名，定向8/8和production verify再次通过。
- `pnpm --filter @schedule/miniprogram verify`：通过；worklet 0，总包4,390,489 B、主包1,641,485 B。主包内部1.5M警戒及手排矩阵1510节点是既有警告。基线同命令总包4,377,033 B、主包1,641,485 B；工作树状态不同，以上为两次测量，不作性能提升声称。
- `pnpm --filter @schedule/web typecheck`、任务文件 ESLint/Prettier、`pnpm icon:parity:check`、`pnpm smoke:check-core`、`git diff --check`：通过。本轮无 Web 核心链路改动。
- 全仓 `pnpm format:check` 仍失败：6个本轮未改文件（schedule-calendar-preview/model、backfill/index、contracts/past-schedules、presentation-core/past-schedule-backfill及其测试、infra/schedule-notifications.spec）；不声称全仓 verify 通过。
- 浏览器运行验证：已有 Storybook 服务 `6016`，页面使用合成人名 fixture，不依赖 API；Edge/Playwright 检查10组390/320及大字号、预览/冲突/恢复/空/错误状态，横溢0、低于44px按钮0、越界确认按钮0、页面错误0。实际点击记录切换、恢复预览、取消、换班预览及两日期展示通过。黄金页直接引用 Mini 页面及共享组件样式。
- 微信开发者工具：CLI就绪、登录身份存在、版本兼容；`compile_wxml`（codeLength113914）和`compile_wxss`（2文件）成功。这只是局部编译，不等于原生交互验收。
- 截图、几何结果和日志保存在 ignored `runtime/audit/external-duty-ui/`。未取得小米14同构建证据；设备性能、原生滚动和触控当前未验证。

## 交付与下一步

- 应用检查点 `1eb92e5b12452588cfb40919930f98025b48943b`，消息 `feat(miniprogram): polish external duty reconciliation interactions`，已推送 `codex/doctor-duty-reconcile`；干净production候选上传。测试页为“更多 → 排班网页校对”的待处理、操作记录及三个确认弹窗。
- 正式分配器在北京时间9月28日23:59分配 `0.1.0-p10.20260928.215`，9月29日00:01上传成功。说明“排班网页校对界面与确认弹窗优化 1eb92e5”；Manifest `b8608f27342aad56f0fe538d8e0830c7be6041265e737cff4eb5e925ccf5ce66`，ZIP2,430,869 B。版本/SHA/Manifest与远端tag、allocation、receipt及production-clean构建一致，前后候选检查、CI dry-run、血缘通过。
- Node miniprogram-ci上传；GitHub使用既有进程级代理，微信解析为真实IPv4、保持TLS检查，未改变系统网络。最终截图与几何摘要另存 canonical ignored `runtime/audit/external-duty-ui-20260928-1eb92e5/`；已停止本轮Storybook和开发者工具项目窗口。
- 本轮不触发服务器应用部署、数据库备份/迁移或正式发布。新体验版放行是与上传分开的生产操作，现有`.214`放行不自动扩展为新的版本。
- 上传交付记录 `617308c6`（`docs(audit): record external duty UI trial 215 delivery`）已推送，文档不重新部署、备份或重传。

## 2026-09-29 追加放行结果

- 用户明确回复“授权”。新独占warm租约、REUSE_ONLY、无安装；fresh-fetch仍为`origin/main=45bf7bec`，交付分支`617308c6`。上传receipt、Manifest及远端`.215`tag再次证明`1eb92e5b`与同一production构建。
- `pnpm exec vitest run infra/scripts/client-version-allowlist.spec.ts scripts/client-version-control.test.mjs`：20/20。生产操作前完整ECS verifier通过，实时release`bc59dfbf90b3fae8d9c5b835648a3a92dc9a35c3`。
- 可信`sudo schedule-client-version-allowlist ensure 0.1.0-p10.20260928.215`报告只追加1个版本；服务重建后首次健康探测遇短暂TLS EOF，由原控制的健康等待恢复成功。独立`verify`及操作后完整ECS verifier均通过，release前后相同。
- 保持域名/SNI和TLS校验的公网能力探测：`.215`、`.214`、`.213`均HTTP200，动态未知版本HTTP426。完整verifier的原始公网IP入口主动探测因未配置`ECS_PUBLIC_IP`跳过，不计为已验证；域名入口探测已通过。完成时间北京时间02:24。
- 本轮仅追加白名单并按原控制重建服务加载配置；没有部署新API/Web代码、同步release元数据、备份/迁移数据库、提审或正式发布。证据在ignored `runtime/audit/allowlist-215/`；记录消息`docs(release): record external duty trial 215 allowlist`，文档不再触发生产操作。
- 唯一下一任务：小米14退出重进`.215@1eb92e5`，复核“更多 → 排班网页校对”的字号、间距、列表切换和预览/取消；收集同构建真实证据后判定实体设备验收，发现回归先修复。
