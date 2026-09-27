# 号码行与联系方式弹窗修复（2026-09-27）

## 范围与原因

用户批准的交互为：打开“我的 → 账户设置”手机号/短号弹窗时先完整显示号码框，点击输入框后再弹系统键盘。实现范围仅 Mini 和本轮记录；上传后用户另行明确授权“放行”，授权范围仅追加本次体验版允许版本，不部署应用、不备份/迁移数据库、不提审或正式发布。

基线 `7f6d4f40`，独占 `runtime/wt/general-6`；正式 Acquire 已执行 ReuseOnly 与 mini bootstrap，依赖/三个共享产物全部复用，未安装依赖。根目录既有未跟踪内容未改动。

`git log -S` / `git blame` 已核对：`5fabb855` 引入号码行的负 margin、额外内边距和圆角；`83eb80c3` 引入 setData 回调自动聚焦；`531d7c39` 增加 keepAlive 预热；共享弹窗动画/transform 起于 `304d742f`，`5947982a` 的重置继续无条件写 translateY(0)。源码能确认显示、聚焦、键盘避让叠加；原生输入层的逐帧时序不能由 Node 测试证明。

## 行为变化与等价边界

- 两行共用普通资料行的横线和左右边界，取消圆角/外扩、移除箭头，号码及空态右对齐；保留 56px 可点击行高与按压反馈。
- 打开时一次 setData 填入号码、标题、显隐状态；取消自动聚焦、focus 绑定和专属 generation，contactInputFocused 只记录真实 focus/blur 事件。
- 联系方式不再启用 keepAlive。ui-sheet 新增默认 true 的 enterAnimation，仅该弹窗传 false；关闭入场动画，且未启用拖动时 WXS reset 写 transform:none。
- 其他 sheet 默认动画、拖动距离/速度/取消/关闭事件不变。WXS 新参数仅 reset 传入；触摸路径未传入时保留原 translateY 行为。
- 保留实测键盘高度、blur 兜底及监听器释放；关闭后的迟到高度事件直接忽略。保存成功/取消继续归零。
- 接收者绑定、保存 Promise/catch 范围、空值转 null、手机号/短号校验、幂等键、版本冲突刷新、接口调用次数和跨群同步均保持。

## 验证证据

证据目录：该槽位 ignored `runtime/audit/contact-sheet-20260927/`。样例号码均为虚构夹具，无生产业务写入。

| 层级             | 命令/场景                                                                                      | 结果                                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Node 基线        | Mini 定向四文件                                                                                | 44/44，命令耗时 6.31 秒，Vitest 3.38 秒                                                                    |
| 红绿回归         | profile-panel-controller、p10-profile-native、ui-sheet、mini-ui-directory-sheet                | 旧实现 6 失败/41 通过；新实现 47/47                                                                        |
| Mini 全量        | `pnpm miniprogram:test`                                                                        | 188 文件通过/3 跳过，1291 用例通过/21 跳过，169.68 秒                                                      |
| 构建             | `pnpm --filter @schedule/miniprogram verify`                                                   | 基线/修改后均通过，含类型、源码、包体、确定性门禁；verify 总耗时未单独采集                                 |
| 静态             | `pnpm lint`、`pnpm typecheck`、任务文件 Prettier、`git diff --check`、`pnpm icon:parity:check` | 通过                                                                                                       |
| 核心链路         | `pnpm smoke:check-core`                                                                        | 通过；无 Web 核心文件变更，无需浏览器业务冒烟                                                              |
| 发布前           | `pnpm miniprogram:trial-lineage`、`pnpm miniprogram:ci:dry-run`                                | 通过，dry-run 不代表上传                                                                                   |
| 浏览器几何代理   | 当前实际 WXSS，390/320px × 普通/大字号；键盘高度 0/326px                                       | 4 种行布局、8 种弹窗状态通过；横线端点/号码右沿相同，零圆角，按钮和输入框可见，animation/transform 均 none |
| Agent 开发者工具 | wechatide 0.3.11，登录有效、versionRelation=equal；共享 sheet/profile-workspace WXML/WXSS      | 编译通过；Console 的 error 过滤为空。匿名工作台的 profile 节点未能被自动化取得，未将其计作交互通过         |
| 小米 14          | 同构建冷启动、首次打开两种号码、点击编辑及收起键盘                                             | 待用户复核；未声称原生同步已验收                                                                           |

全仓 `pnpm format:check` 仍为五个未改文件的既有失败：schedule-calendar-preview/model、backfill/index、contracts/past-schedules、presentation-core/past-schedule-backfill 及其测试。任务文件格式检查通过，未修改无关文件，未声称根 `pnpm verify` 通过。

同 production 命令/工具链：原始总包 4,337,454 → 4,336,979 B，主包 1,625,415 → 1,624,940 B，均减少 475 B。主包超过内部 1.5M 提示及手排 1510 节点提示仍存在。最大文件仍为 workbench/index.js（224,519 B），其次 manual/index.js（184,948 B）、client-core-calendar.js（167,806 B）。上传版本绑定产物须单独记录。

## 检查点与交付

应用检查点 `09b834e7a757327e719980902993e47b49626c22`（`fix(miniprogram): show contact editors without autofocus motion`）已正常快进 main 并推送 GitHub。状态文档新增记录触发40KB长度门禁，已把本主题旧联系方式记录压缩为摘要及原报告链接，门禁3/3通过，历史详细报告及Git历史保留。

体验版 `0.1.0-p10.20260927.210` 于北京时间2026-09-27 21:50:42上传成功；description=`contact editor manual focus 09b834e`，production/clean，构建时间 `2026-09-27T13:49:11.890Z`，Manifest `25cca22ee6916cdbc4d06d5f0b6d34e27e72f3568feef6d6d42e83f3839e3dca`，微信CI ZIP 2,371,434 B。远端版本tag、allocation、manifest绑定记录、receipt及dist/build-profile身份一致；实际候选检查器上传前后均PASS，VERSION_LOCAL=absent。

上传复用正式锁/分配/血缘/候选/Manifest/预约/CI流程；ignored包装只在官方Manifest绑定完成后、远端预约前额外写入脱敏preupload记录，不替换或跳过门禁。Git使用进程代理，WeChat使用进程级直连IPv4且TLS验证通过，未修改系统网络。

交付文档检查点 `c7bfe712`（`docs(audit): record contact editor trial 210 delivery`）已推送；应用证据复用，不再上传。

## 用户授权后的追加放行

2026-09-27 用户明确授权“放行”。本轮重新通过 L4 当前消息授权检查，独占 warm `general-6` 执行 Acquire → ReuseOnly → Bootstrap → Targeted test，依赖及共享产物复用、未安装。定向 `pnpm exec vitest run scripts/agent-context-policy.test.mjs` 为3/3通过。成功 fetch 后 `origin/main=c7bfe712`；远端 `.210` tag、成功上传回执、源码 `09b834e7`、production profile 与上述 Manifest 重新核对一致。

北京时间21:58实时读取生产 release 为 `4674c8bcd5b1052c54ca3e35bfead2aacef54c53`，冻结受信 allowlist/verifier 哈希；正式域名、两家独立 DNS、匹配的 known_hosts、TLS 健康和严格 SSH 主机密钥校验通过。操作前再次校验 release/控制脚本哈希一致，仅调用受信 `schedule-client-version-allowlist ensure 0.1.0-p10.20260927.210`，返回“已追加1个版本”，旧允许版本全部保留。容器配置刷新中一次短暂 TLS EOF 经工具健康等待自动恢复，最终返回成功。

放行前后完整 `ecs-verify.sh`、独立 `schedule-client-version-allowlist verify` 均退出0；公网能力接口 `.210/.209=200`、动态未知版本=426。最终实时 release 未变，仍为 `4674c8bc`。仅刷新允许版本配置及其运行容器，未部署应用制品、同步 release 元数据、备份/迁移数据库、提审或正式发布。脱敏证据保存在该槽位 ignored `runtime/audit/contact-sheet-210-allowlist-20260927/`，包含 baseline、ensure、前后 verifier、独立 verify、公网探针及最终结果。

本次四份记录的 Prettier、`git diff --check`、状态长度门禁3/3和 `pnpm smoke:check-core` 通过；只改交付文档，复用既有应用验证。放行记录检查点消息 `docs(release): record contact editor trial 210 allowlist`。唯一下一任务：小米14核对 `.210@09b834e7`、WebView、基础库、微信版本及构建时间，冷启动首次打开手机号/短号，确认框与文字同步，再点输入框编辑并收起键盘；取得同构建真机证据前保持“待用户复核”。
