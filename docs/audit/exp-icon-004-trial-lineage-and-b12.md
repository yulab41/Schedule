# EXP-ICON-004-B1.2 图标一致性与体验版 `.74–.85` 血缘审计

## 结论先行

`.84` 中看到的图标回退属实，而且原因已经定位：体验版版本号只是上传时填写的字符串，当前上传封装只检查
“是否像语义版本”，不检查该版本是否已被其他 worktree 使用、不检查候选是否包含上一体验版，也不把微信体验版
绑定到不可变 Git 身份。`0.1.0-p10.20260903.84` 实际来自
`8e6a4a320a69fee9f1ca0471d8f9b140e3d4dd39`，而图标修复位于其后的独立分支
`1ffab10c3f30987e31db47eb555f9e0aef0bf787` 和
`5285dd17a78793f2e62e1afcb0a7ef65f6ae57c1`。因此 `.84` 的数字比 `.83` 大，代码却不包含 `.83`。

这不是微信缓存造成的主因，也不是用户肉眼误判。`.84` 的 clean production `build-profile.json` 已直接证明
`buildCommit=8e6a4a3`。该源码仍有 25 个不同的 `web-*.svg` 名称、85 次生产引用，分布在 20 个生产源码文件；
图标分支则为 0 次 `web-*`、46 个不同的 generated `ui-*` 资产、127 次引用。

全面排查还发现两个层次的问题：

1. **P1 发布血缘回归**：`.75` 曾未包含 `.74` 的支线修复，直到 `.76` 才恢复；`.84` 又未包含 `.83` 的图标修复。
2. **P1/P2 视觉适配遗漏**：即使回到 `.83` 图标分支，底部通讯录/换班/我的/更多仍未完整对齐 Web 的
   active/inactive 色、active-only 循环、尺寸和按压反馈；顶部个人仍误用底部导航 profile 几何；部分尺寸/stroke
   和关键帧仍手写在平台 CSS 中，尚未真正由单一 motion specification 生成。

推荐修复不是把 `.83` 直接重新编号上传，而是先建立不可重复版本和累积血缘门禁，再把原图标提交合入执行时最新
`origin/main`，最后完成 B1.2 的剩余适配。旧 `.74` 不应直接 cherry-pick：当前主线已由 `.76` 更完整地恢复其
行为，且当前相关三个文件与 `.76` 的 blob 完全一致。

## 审计边界与证据等级

- 审计基线：`origin/main@a1bba5710cfd5c94b5fd5148898e4f17e45faab9`；图标运行时代码比较仍以其祖先
  `78d0424e` 为冻结点，后续三个主线提交只涉及 Skill、规则和审计文档。
- 设计 worktree：`runtime/external-project-worktrees/exp-icon-004-lineage-b12-20260903`，创建时 clean。
- `.84` 制品证据：`runtime/release-worktree`，detached clean，production，构建时间
  `2026-09-03T11:19:57.580Z`。
- 图标修复证据：`codex/exp-icon-004-full-20260903@45ecf755`；生产代码提交为 `1ffab10c`、`5285dd17`。
- 上传事件来源：Git 历史、仓库审计文档、保留的 build profile，以及 Codex App 中对应上传任务记录。微信后台
  不提供可由当前工具读取的“同一版本号历次 payload”不可变账本，因此同号事件按已有任务证据记录。
- 图片证据：用户提供的 `.84` 小米 14 体验版截图与 Web 截图；版本元数据尚未由用户从“更多 → 测试工具”回传，
  所以截图只用于说明观感，不单独承担 SHA 归因。
- 未调用微信开发者工具 GUI/CLI；未上传、未连接服务器、未改 allowlist、未部署 production。

## `.74–.85` 体验版本事件账本

“包含旧改动”分为两种：Git 祖先为严格包含；旧补丁被后续实现完整取代为语义包含。版本号相同但 SHA 不同即记为
碰撞，不能把后一次上传当成前一次的可追溯更新。

历史证据能确认 `.75/.76/.78/.80/.81/.82/.83/.84/.85` 的完整 date-bearing 版本；`.74/.77/.79` 只确认末尾
全局序号，因此 tracked 账本明确写为 `version: null` / `versionEvidence: sequence-only`，不猜造日期。其中 `.74`
结论是“末尾序号被不同 SHA 重用”；`.81/.82` 则有同一完整版本被不同 SHA 重传的直接证据。`.85@a1bba57`
由并行 G1-004 任务在 B1 实施期间通过旧流程上传并放行，因此作为执行时新事实追加，且没有追补真实 trial tag。

| 显示版本/事件 | Git SHA | 平台动作 | 与前一有效候选关系 | 当前结论 |
| --- | --- | --- | --- | --- |
| `.74` 原始 | `d23a78a` | 已上传并有历史 Xiaomi 14 test-tools 反馈 | 独立诊断支线 | 后续 `.75` 未严格包含；行为由 `.76` 更完整恢复 |
| `.74` 日历重用 | `8e6a4a32` | 后续并行任务误用同号上传 | 与原 `.74` 为不同 SHA | **版本碰撞**；不得再作为身份 |
| `.75` | `24a847ff` | 已上传、曾放行 | **不包含** `.74@d23a78a` | P1 临时遗漏；随后由 `.76` 修复 |
| `.76` | `a2cdd065` | 已上传、曾放行 | 恢复 test-tools Skyline 不变量 | 当前主线三个关键 blob 与此提交一致 |
| `.77` | `a4f50c02` | 仅 dry-run/预留，未上传 | 包含 `.76` | 不属于体验版发布历史，但版本已在本地证据中出现，仍不复用 |
| `.78` | `07decdbb` | 已上传、曾放行 | 包含 `.76` 和 `.77` 基线 | 累积关系正常 |
| `.79` | `d1594d09` | 已上传、曾放行 | 包含 `.78` | 累积关系正常 |
| `.80` | `3897581e` | 已上传、曾放行 | 包含 `.79` | 累积关系正常 |
| `.81` UX | `48488019` | 已上传、曾放行 | 包含 `.80` | 当时的累积候选 |
| `.81` 日历 | `8e6a4a32` | 并行任务再次上传同号 | 包含 UX `.81`，但覆盖同号身份 | **版本碰撞** |
| `.81` 图标 | `1ffab10c` | 图标任务再次上传同号 | 包含日历基线 | **版本碰撞** |
| `.82` 日历 | `8e6a4a32` | 已上传、曾放行 | 与日历 `.81` 同 SHA | 新号码没有新代码；可追溯但无新增能力 |
| `.82` 图标 | `5285dd17` | 图标任务再次上传同号 | 包含 `1ffab10c` | **版本碰撞** |
| `.83` 图标 | `5285dd17` | 已上传、曾放行 | 包含 `.82` 日历及两次图标修复 | 图标线的最后有效候选 |
| `.84` 日历 | `8e6a4a32` | 已上传、曾放行 | **不包含** `.83@5285dd17` | **P1 实质回退；当前用户所见版本** |
| `.85` G1-004 | `a1bba571` | B1 实施期间由并行任务上传、放行 | 包含 `.84`，仍不包含 `.83` 图标分支 | 旧流程最后一个 bootstrap 事件；未来序号必须大于 85 |

### 严格祖先链

| 相邻有效候选 | 是否为 Git 祖先 | 判定 |
| --- | --- | --- |
| `.74@d23a78a → .75@24a847ff` | 否 | 旧支线未并入，曾遗漏 |
| `.75@24a847ff → .76@a2cdd065` | 是 | 正常 |
| `.76@a2cdd065 → .78@07decdbb` | 是 | `.77` 未上传，不影响链 |
| `.78 → .79 → .80 → .81(UX) → .82(日历)` | 是 | 主线累积正常 |
| `.82(日历)@8e6a4a32 → .83(图标)@5285dd17` | 是 | 正常 |
| `.83(图标)@5285dd17 → .84(日历)@8e6a4a32` | 否 | 明确回退 |
| `.84(日历)@8e6a4a32 → .85(G1)@a1bba571` | 是 | 主线前进，但仍缺 `.83` 图标提交 |

### 当前 `origin/main` 是否缺旧改动

- 当前主线包含 `.75`、`.76`、`.78`、`.79`、`.80`、UX `.81`、日历 `.82/.84` 以及后续 G1-004 调查提交。
- 当前主线不含 `1ffab10c`、`5285dd17`，因此缺失 `.83` 的全部图标同源迁移和日历/人员动效补丁。
- 当前主线不含原 `.74@d23a78a` 的 commit 身份，但不缺其最终行为：
  `test-tools.test.mjs`、test-tools WXML、WXSS 当前 blob 分别为 `6f8e0682`、`d292210e`、`1b43ac07`，与
  `.76@a2cdd065` 完全相同。`.76` 是对 `.74` 的重新调查和更完整恢复，故不合入旧支线提交。
- 以 `8e6a4a32` 为共同基线，当前主线和图标分支的代码改动没有重叠；仅
  `docs/project-status.md`、`docs/audit/STATUS.md`、`docs/audit/wechat-miniprogram-audit.md` 重叠。实现时应合并
  原提交并人工重写这三份状态文档，不能用旧分支版本覆盖当前主线。

## 根因与防复发要求

| 编号 | 严重程度 | 原因 | 证据 | 修复要求 |
| --- | --- | --- | --- | --- |
| LINEAGE-001 | P1 | 多个独立 worktree 各自扫描局部分支/文档选择版本，缺少中央原子占用 | `.74/.81/.82` 均有同号多 SHA | 远端不可变 tag 原子占用；同号同 SHA 只允许幂等重试 |
| LINEAGE-002 | P1 | `resolveUploadMetadata` 只检查通用 semver 和 80 字说明 | 上传 helper 无 Git 祖先、clean、历史占用检查 | 所有 `upload-experience` 强制执行 lineage preflight |
| LINEAGE-003 | P1 | 版本号和 Git SHA、manifest、前序体验候选没有不可变绑定 | `.84` 数字前进、SHA 后退 | tag 绑定 exact SHA；说明必须含短 SHA；落 ignored receipt |
| LINEAGE-004 | P1 | allowlist 只识别版本字符串，无法发现微信后台同号 payload 被覆盖 | 同号重传后服务器仍只看到相同字符串 | 上传前阻断重复；allowlist 不能充当制品账本 |
| LINEAGE-005 | P2 | 当前流程允许从旧 detached SHA 直接赋新版本 | `.84@8e6a4a32` | 要求最新 `origin/main`、最后累积 trial 和 required checkpoints 均为 HEAD 祖先 |

推荐以远端 tag `miniprogram-trial/<完整版本>` 作为原子版本占用。第一次 push 成功即永久占用；上传失败也不回收，
下一次使用新版本。若 tag 已指向同一 SHA，可重试同一上传；若指向不同 SHA，必须失败关闭。纯 tracked JSON 无法解决
两个未合并分支同时选中同一号码的竞态，因此只能作为历史审计，不作为唯一锁。

紧急回滚也不得把旧 SHA 改成新版本上传；应在最新累积候选之上创建显式 revert commit，使 Git 血缘仍单调前进。

## B1 发布门禁实施结果（2026-09-04）

- 新增 `apps/miniprogram/release/trial-history.v1.json`：逐序号记录 `.74–.85`，完整版本不确定的历史事件保持
  `null`，并把 `.74/.81/.82` 标为 collision；新增 policy 以执行期间最新 `.85` 为 bootstrap floor，
  required checkpoint 固定为 `5285dd17a78793f2e62e1afcb0a7ef65f6ae57c1`。
- 新增纯 Node `trial-lineage.mjs`：fresh-fetch `origin/main`，读取远端 cumulative tags，检查 clean/
  production/description short SHA/required ancestors，逐字段核对 `build-profile.json`，并以非 force push 创建
  `refs/tags/miniprogram-trial/<完整版本>`。远端已绑定同 SHA 时只允许 latest trial 幂等重试，绑定不同 SHA
  时 fail closed；上传失败不删除 tag。
- `upload-experience` 现在按“inspect → exact-metadata production build → fresh confirm → tag reserve → 微信上传 →
  ignored receipt”执行。dry-run 在 build 后直接返回，不 fetch/push trial tag、不写 receipt、不调用上传。
- 失败先行证据：旧实现运行新增定向测试时因 `trial-lineage.mjs` 不存在而在收集阶段退出 1；实现后定向 lineage
  12/12、既有 miniprogram-ci helper 6/6 通过。临时 bare remote 的两个不同 SHA 并发占同一版本时仅一个成功；
  winner 同 SHA 重试通过，loser 被拒；并行分支推进 `main` 后旧候选也被 fresh-fetch 门禁拒绝。
- 完整 Mini 首轮有 118 files/652 tests 通过、2 个 suite 因 clean worktree 缺
  `@schedule/scheduling-domain` declarations 在收集阶段失败；按 workspace producer 关系只构建 `contracts`、
  `scheduling-domain` 和随后缺失的 `presentation-core`，同一命令复跑为 120/120 files、655/655 tests。Mini
  typecheck、source、production verify、package/performance/determinism、credential-free CI dry-run、全仓
  format/lint、agent-context 3/3、`git diff --check` 与 `smoke:check-core` 均通过。
- production verify/package 均为 total `5,151,892 B`、main `1,715,718 B`，与 B1 前相同口径基线完全一致；
  仅保留既有主包和矩阵 best-effort warning。B1 release tooling 与 JSON 不进入业务包。
- 本实施只改变 release tooling、tracked 账本和文档，不改变 Mini 业务包、图标、页面、API、权限、路由或数据库。
  本轮没有对 `origin` 创建真实 trial tag，没有上传、allowlist、服务器连接或 production 部署。

## Web / 小程序完整图标对照

### 来源盘点

| 来源 | Web | `.84` Mini | 图标分支 | 结论 |
| --- | --- | --- | --- | --- |
| inline SVG/path | `WorkbenchNavIcon` 导航几何、action icon 几何 | 多个独立 `web-*.svg` | `packages/ui-icons/src/catalog.ts` | 几何应直接共享 |
| icon component | TDesign Vue + 页面 inline component | `<image>` 与页面私有 WXML | Web `SharedIcon`；Mini generated asset | 平台渲染需适配 |
| sprite | 未发现生产 `<use>` sprite | 未发现 | 不引入 | 无迁移项 |
| 字体图标 | 未发现生产 icon font | 未发现 | 不引入 | 无迁移项 |
| 图片资源 | PWA 192/512/maskable | 小程序 SVG 图片 | 页面 SVG 由 catalog 生成 | PWA 图不共享 |
| CSS/JS 动画 | Web 组件内 keyframes/状态触发 | 页面 WXSS + `setData` 触发 | motion catalog 已有一部分 | B1.2 需消除手写规格副本 |
| 第三方库 | `tdesign-icons-vue-next@0.4.7` 的已核对 path | 不应引入运行时库 | 只保存 path 与许可证元数据 | 可共享数据，不共享 Vue 组件 |

### 场景、规格、差异和迁移分类

| 范围/图标 | Web 真值（状态、尺寸、stroke、动效） | `.84` / 图标分支差异 | 严重程度 | 结论 |
| --- | --- | --- | --- | --- |
| 底部日历 `calendar` | active primary / inactive secondary；23px/2；active check 1800ms ease-in-out infinite | `.84` 旧资产 + 420ms 私有点击弹跳；B1.1 已删弹跳并作 opacity 兼容 | P1 | 需适配；真实 dash 仍真机确认 |
| 底部通讯录 `directory` | 23px/2；active-only `contact-person` 1800ms cubic-bezier 循环 | `.84` 旧资产；图标分支固定 primary、没有 actor loop、24px | P1 | B1.2 分 base/person、双色、active-only |
| 底部换班 `swap` | 23px/2；左右箭头 active-only 1800ms 循环 | 图标分支固定 secondary；`navMotion` 点击后离开仍可能循环；24px | P1 | B1.2 双色并直接绑定 active state |
| 底部我的 `profile` | 23px/2；仅 portrait 1800ms active loop | 图标分支固定 primary；复用顶部 480ms one-shot 状态，且整图运动；24px | P1 | B1.2 分 body/portrait，独立状态 |
| 底部更多 `more` | 23px/2；active-only 1800ms，dot delay 0/100/200ms，只位移 | 图标分支固定 secondary；点击状态可在 inactive 时持续；Mini 多了 opacity；24px | P1 | B1.2 双色、active-only、删除私有 opacity |
| 底部按压反馈 | 整个 nav item scale 0.98，fast token | Mini 只把图标 scale 0.88，140ms | P2 | 共享 press spec，平台 hover adapter |
| 顶部通知 `bell` | 21.6px/1.8；打开时 620ms；独立 unread dot | 图标分支 24px/2；几何和关键帧数值已同源/等值 | P2 | 共享 context token + stroke override；真机看 origin |
| 顶部个人 `user` | TDesign User，20px/2；打开时 480ms | 图标分支误用底部 nav `profile` 几何且 24px，并与底部共用状态 | P1 | 改用 `ui-user`，分离 top/bottom adapter |
| 通讯录科室 `department` | 18px/1.8；inactive `#586678`；切入 internal 500ms/90° | `.84` 为手绘近似；B1.1 已同源且规格一致 | P1→已修待合入 | 需适配，destination-only |
| 通讯录人员 `people` | 18px/1.8；inactive `#586678`；切入 employee 520ms，46% 时 -0.75/+1px | `.84` 为 CSS 手绘单人；B1.1 已拆同源双 actor | P1→已修待合入 | 需适配，真机重点 |
| 通讯录筛选/搜索/关闭/清空 | funnel 18；search 22；close 20；均来自 TDesign/shared path | `.84` 含旧独立资产/字符；图标分支已迁移 | P1→已修待合入 | 可共享几何，静态适配 |
| 通讯录收藏/电话 | star 21；phone 17；电话 620ms 0/-8/7/-3/0° | 图标分支几何、尺寸、时序已对齐 | P1→已修待合入 | 可共享 + wrapper motion |
| 日历筛选 `filter` | 20px/1.8；三 bar 520ms，46% 位移 +2/-2/+1px | 图标分支 part 几何/时序正确，但生成资产仍为默认 stroke 2 | P2 | B1.2 增加 1.8 context override |
| 日历左右箭头 | 20px；切期 260ms，48% ±2px | 同源 path；Mini adapter 数值等值 | P2/低 | 需生成契约，真机确认触发次数 |
| 日历定位 `locate` | action glyph 16px；520ms 0→90° | Mini 工作台为 20px；几何/时序同源 | P2 | B1.2 使用 context size token |
| 班次电话/事件/展开 | phone 16或18、history 16、chevron 16；按上下文颜色 | 图标分支已使用同源资产；页面尺寸基本等值 | P1→已修待合入 | 可共享；电话 wrapper 适配 |
| 更多页：群组/手排/补录/请假/换班/加扣班/配置 | Web semantic nav path；mobile sheet glyph 20px，active 时对应 loop | `.84` 多个语义误配；图标分支 path 已修，但 Mini row 统一 24px、无 active row 生命周期 | P1/P2 | path 直接共享；B1.2 统一 20px；动效按路由差异保持静态 |
| 更多页：事件/通知设置/通知中心/导出 | `events`/`bell`/`notifications`/TDesign export | `.84` 有 calendar/history 等误配；图标分支已修 | P1→已修待合入 | 可直接共享几何 |
| 更多页：成员邀请/访客/平台账号/测试工具 | Web 无一一专用产品图形 | 图标分支复用 user/calendar-check/info，避免猜画 | P2 | 暂不新设计；真机确认语义即可 |
| 更多行 chevron | TDesign chevron-right，20px muted | `.84` 字符/旧资源混用；图标分支同源且 20px | P1→已修待合入 | 可直接共享 |
| 工作流 picker/日期/关闭 | TDesign chevrons/close；尺寸由现有 picker context | `.84` 字符、border triangle 与图片混用；图标分支已迁移 | P1→已修待合入 | 需平台触摸/方向适配 |
| 身份 user/lock | TDesign User/LockOn，页面 context size | `.84` profile/lock 私有资产；图标分支同源 | P1→已修待合入 | 可直接共享几何 |
| 各分包返回/弹层关闭 | TDesign chevron-left/close，20px 左右 | `.84` 仍有多来源；图标分支统一 | P1→已修待合入 | 可直接共享 |
| PWA/Logo/loading/time-line dot/内容字符 | 平台或内容语义，不是页面 icon contract | 无跨端一一对应 | P3 | 暂不迁移 |

### 同类问题的全面结论

- `.84` 回退覆盖 `1ffab10c` 的**全部**图标改动，不仅是用户截图中的底部和人员按钮；更多页、筛选、关闭、
  下拉、电话、事件、工作流和身份页也都回到了旧来源。
- 图标分支已解决“几何来源”主体，但没有完全解决“使用场景规格”和“motion 单一来源”。Web
  `WorkbenchNavIcon.vue` 仍保存 14 类导航 keyframe，`motion.ts` 只结构化了通用 navigation 和 more 等少数
  规格；Web action、Mini page/component WXSS 也各自复制数值。当前有些值相同，但未来仍可漂移。
- 因此 B1.2 必须同时增加 context token/manifest 和生成式 motion adapter 契约，不能只替换两张图片。

## 三类迁移结论

### 可直接共享

- 24×24 viewBox、path/circle/rect/group、fill-rule、pathLength、linecap/linejoin 和来源/许可证元数据。
- Web inline path 与已核对 TDesign path；第三方 Vue component 不进入 Mini。
- primary/secondary/muted/success/favorite 等颜色 token。
- duration、delay、easing、iteration、direction、fill、offset 和 transform/opacity/dash 关键帧数据。

### 需要平台适配

- Web 输出真实 SVG DOM；Mini 构建时生成 `ui-*.svg`，通过 `<image>` 加载。
- Mini 无法可靠选择外部 SVG 内部 group：calendar/directory/profile/swap/more 使用同源 part asset 叠放；
  只允许平台 selector、transform-origin 和能力降级不同，数值来自同一 spec。
- `stroke-dashoffset` 在 Mini 外部 SVG 中降级为相同 0.3→1→0.3 opacity，不能用 `scaleX` 假装描边。
- 页面路由离开后没有 Web active nav row 的场景保持静态，不创建无意义的后台循环。
- reduced-motion、hover-class、safe area、原生 picker/scroll/swiper 继续由平台层负责。

### 暂不建议迁移

- PWA 安装图、Logo、loading ring、时间线点、内容中的 `✓/→/↓`。
- 没有 Web 真实来源的 visitor/test 专用新图形；当前复用已存在语义，不凭截图重新临摹。
- Canvas、逐帧 `setData`、SMIL 或新增动画运行时库；没有足够真机收益证据且会增加启动/维护风险。

## 包体与启动预算

| 口径 | 总包 | 主包 | 说明 |
| --- | ---: | ---: | --- |
| `.84@8e6a4a3` exact clean production | 5,152,789 B | 1,716,235 B | 当前用户所见回退版本；主包有既有 1.5 MiB 内部 warning |
| `.83@5285dd1` exact clean production | 5,170,583 B | 1,732,195 B | 已含 B1/B1.1；不同版本元数据，作为独立测量，不宣称严格性能 delta |

B1.2 预算：

- 相对重新建立的同口径 parent baseline：总包增量不超过 64 KiB，B1.2 自身不超过 16 KiB。
- generated icon/motion 资产总增量不超过 32 KiB，B1.2 新增 variant/adapter 不超过 12 KiB。
- 不新增 npm runtime dependency，不引入 Base64 大图、Canvas、Lottie 或字体图标。
- 底部 layered adapter 最多比图标分支增加 2 个常驻 `<image>` actor 节点；本地 SVG 无网络请求。
- 若主包增量超过预算，优先删除未被生产引用的 variant 或把非首屏静态资产留在既有分包；不得复制页面私有版本。
- 冷启动、帧率、内存和 Skyline 合成开销当前工具无法测量，必须在匹配候选的 Xiaomi 14 体验版记录；不得用
  Node package audit 推导“无性能影响”。

## 按风险拆分的实施批次

| 批次 | 内容 | 风险 | 停止条件 |
| --- | --- | --- | --- |
| B0（本 checkpoint） | `.74–.84` 血缘、全图标差异、单一来源和批次设计 | 低，文档-only | 审计可复核、分支推送；不改生产图标/上传/服务器 |
| B1（已完成） | 体验版历史账本、不可变 tag 版本占用、clean/current-main/latest-trial/required-ancestor preflight | 中，发布工具 | `c027abcd` 已通过并成为候选硬门禁 |
| B2（已完成） | 在执行时最新 main 上合并 `5285dd17` 的原始提交血缘并解决三份文档冲突 | 中，跨分支 | `24ea709e` 保留原提交祖先身份，B2 文档 checkpoint 已推送 |
| B3（已实现） | 底部 5 项、顶部 2 项、通讯录模式、filter/locate/more context 的 B1.2；生成 Web/Mini motion adapters | 中，视觉运行时 | 红绿契约、完整 Mini/Web gate 和工作树包体通过，待 clean checkpoint 复测 |
| B4（进行中） | 全量静态对照、Mini/Web gates、同口径包体和浏览器/Node 证据，提交并推送调查分支 | 中 | relevant gate 失败不形成候选 |
| B5 | L3 exact-clean candidate、动态选择未占用版本、用户当次批准后 tag+上传；另获 L4 后 allowlist | 高，外部状态 | 未获精确批准、tag 冲突、SHA/版本/profile 不一致即停止 |

### B2 入口预检（2026-09-04）

用户批准 B2 后，执行时最新 `origin/main` 仍为 `75cc0d3b`，当前累计分支为 clean `eaac822c`。目标
`5285dd17` 会引入新的 `packages/ui-icons` workspace package、Web dependency 和 lockfile importer；当前
worktree 的 Web dependency links 不含 `@schedule/ui-icons`。与此同时，`879e98f6` 引入的 dependency
environment lifecycle 要求安装前必须由完整 helper 覆盖全部 tracked dependency inputs、Node/pnpm、OS/架构、
pnpm layout 和 store path，并验证 `node_modules` 健康；当前主线只有不完整的 release tracked-input marker。

因此 B2 在 Git merge 前失败关闭：没有运行 `pnpm install`，没有手工创建 junction/symlink，没有借用其他
worktree 的依赖或 dist，也没有修改/合并生产图标。入口基线的 Mini 5 files/55 tests、production verify/package
通过（total/main=`5,151,893/1,715,719 B`）；定向补齐当前已有 producer dist 后，Web baseline build 也以
4,242 modules 通过。恢复 B2 前需要用户另行批准仓库级 dependency checker 前置批次，不能把该扩展默认为图标
合并的一部分。

用户随后明确授权该前置批次及 `MISS` 后的一次 frozen install。旧弱 marker 的引入点为 `0d971de1`：它只比较
tracked source hash 和 `node_modules` 目录存在性。新实现将 source、Node/pnpm、OS/架构、layout 和 store path
合成完整 fingerprint，并独立验证 pnpm metadata、virtual store、direct dependency 和 workspace link；read-only
checker 与 explicit installer 分离，release-worktree 复用相同核心。新增测试先因实现模块不存在而失败，转绿后
两组定向测试 `18/18` 通过；真实入口结果为 `MISS / marker-missing / HEALTH=PASS`，没有提前安装或写 marker。

最终 B2 图只读检查进一步准确识别两个缺失 workspace link：`apps/web → @schedule/ui-icons` 与
`packages/ui-icons → @schedule/ui-tokens`。按用户单次授权执行一次 frozen install：15 个 workspace，lockfile
已是最新、0 新下载，pnpm 11.9.0 用时 1.6 秒；随后为 `MATCH/HEALTH=PASS`，没有 tracked 副作用。当前累计
Mini 为 302 files、total/main `5,169,730/1,731,703 B`；Mini 122 files/663 tests、Web/token 39 tests、
`pnpm verify`（根 1,178 passed/364 skipped）及全部相关构建门禁通过。浏览器 smoke 仅因本地 API 3000
未运行停在登录重定向，不能替代 Xiaomi 14。

验证期间 `origin/main` 先到 `fa10d5ba`（官方 `scripts/codex/worktree-deps-*`），再到
`765b5c09`（动态 release identity）。为避免两套 dependency source，主线 merge 已保留官方实现并删除本轮
临时 checker 最终树内容。官方健康采用和再次 ReuseOnly 均返回
`DEPENDENCIES_REUSED=true / INSTALL_INVOKED=false`；主线对 Mini/Web/icon runtime 的改动数为
0，因此复用前述应用门禁证据，只补跑官方 Node 13/13、Vitest 17/17、Skill/format/syntax/diff 检查。最终
`bce96ce8` 已确认 main、B1、B1.1 和 B1-lineage 四条祖先关系全部成立。

### B3/B4 单一视觉来源实施结果（2026-09-04）

- 引入点复核：Web 导航 keyframe 来自 `5b9542a2`，Web action keyframe 来自 `fea129bb`，Mini people
  keyframe 来自 `6b5b30fb`；Mini 底部 24px 来自 `3fc41610`，B1 `1ffab10c` 生成了合并版
  directory/profile 资产，B1.1 `5285dd17` 只补齐日历和人员差异。因此 B3 剩余问题不是单一截图或缓存，而是
  geometry 已共享后，context、part 生命周期与 timing 仍分散在平台文件。
- 失败先行：新增 B1.2 契约在旧实现上 5/5 失败，分别捕获缺 context/binding、底部未直接绑定 active state、
  未生成两端 motion adapter、缺同源 active/inactive part variant 和生成结果不可复核；实现后 5/5 通过。
- 单一来源边界：`catalog.ts` 继续保存唯一 path/part/source/license；新增 `context.ts` 保存 size/stroke/color
  role，`motion.ts` 保存 trigger/duration/delay/easing/iteration/direction/fill/reduced-motion，
  `platform-bindings.ts` 只保存 selector、transform-origin 与 `omit-stroke-dashoffset` 能力降级。两个生成器逐字
  校验 58 个 Mini SVG 及 Web/Mini motion 输出，页面不再维护共享关键帧数值。
- 视觉行为：底部 5 项统一 23px/2、active primary/inactive secondary 与 active-only 1800ms loop；日历仅做
  opacity 兼容，通讯录/我的/更多拆同源 actor，换班保留双向移动，更多 delay 为 0/100/200ms。顶部 bell 为
  21.6px/1.8，顶部 profile 改用 TDesign User 20px/2 并与底部状态分离；department/people、filter/locate、
  favorite/phone、more row 均由共享 context 输出。Mini 只用 `<image>` part/wrapper 适配，没有复制 DOM/CSS runtime。
- 范围完整性：B1 已迁移的更多页全部工具、筛选/搜索/关闭/清空、收藏/电话、事件 history、工作流 picker、身份
  user/lock、返回箭头继续保留同源几何；B3 没有把路由离开后的静态 more-row 强行改成后台循环，也未迁移
  Logo/PWA/loading/内容字符。旧 `web-*`、`ui-directory.svg`、`ui-profile.svg`、`navMotion` 与平台私有共享
  keyframe 均已清除。
- 自动门禁：Mini 123 files/668 tests；Web/token 定向 4 files/19 tests；Web/Mini/ui-icons typecheck；Web
  production build 4,251 modules；Mini source/package/performance/determinism/verify；format/lint、generated check、
  diff check、core smoke 均通过。仓库级验证另发现 `4602120b` 的 5 个 Node tests 被 Vitest 误收集；新增回归先
  2 项失败，修复 test runner 边界后 Node 17/17、根 Vitest 246 files/1,171 tests 及完整 `pnpm verify`
  通过，产品运行时不变。
- 工作树同口径包体：parent `5,169,731/1,731,704 B`，B3 production verify
  `5,181,999/1,745,405 B`，变化 `+12,268/+13,701 B`；58 个 SVG 27,257 B，Web/Mini adapter
  `12,240/9,490 B`，0 新 runtime dependency。当前结果低于设计预算，但最终上传仍必须以 exact clean SHA
  复测；冷启动、帧率、内存和 Skyline 合成开销只由匹配体验版 Xiaomi 14 证据确认。

## 第一实施批次的精确 Prompt

> 执行 `EXP-ICON-004-LINEAGE-B1`。先从执行时最新 `origin/main` 更新现有
> `codex/exp-icon-004-lineage-b12-20260903` clean worktree，不重跑阶段 0。仅实现体验版血缘门禁，不修改生产
> 图标、业务页面、API、权限、路由或数据库。新增 tracked `.74–.85` 历史账本和 trial lineage policy；新增纯
> Node helper 与 Vitest。先写在旧实现上失败的测试，覆盖：同一版本不同 SHA 必须拒绝、同一版本同一 SHA 只允许
> 幂等重试、候选必须 clean production、`origin/main`/最后累积 trial/required checkpoints 必须为 HEAD 祖先、
> description 必须包含短 SHA、dry-run 不创建 tag、不写 receipt、不改变外部状态。推荐以
> `refs/tags/miniprogram-trial/<完整版本>` 作远端原子占用；首次成功后永久占用，失败不删除，严禁 force。把门禁接入
> 现有 `upload-experience`，上传成功后只向已验证 ignored 的根 `runtime/audit/miniprogram-trials/` 写脱敏 receipt。
> 更新 miniprogram-ci/release runbook、审计状态和 debug 记录。运行定向红绿测试、Mini 测试发现策略、
> `pnpm miniprogram:test`、相关 typecheck/format/lint、`git diff --check`、`pnpm smoke:check-core`。只提交并普通
> 推送调查分支；不创建真实 tag、不上传体验版、不操作 allowlist、不连接或部署 production。若实现需要改变版本
> 语法或回滚策略，先停止并回到设计确认。

## 需要 Xiaomi 14 体验版确认的差异

最终候选必须先在“更多 → 测试工具”回传 `trial`、短 SHA、版本、build time、renderer、基础库、微信和 Android
版本；旧 `.81/.82/.83/.84/.85` 截图不能替代新候选。

1. 底部五项：23px、active/inactive 色、仅当前项循环；切走后动画立即停止；重复点当前项不重启动画。
2. 日历：check opacity 循环是否在 Skyline 可接受；无 420ms 弹跳、无横向压扁；reduced-motion 停止。
3. 通讯录：bottom directory actor 进入循环；科室/人员 18px、1.8 stroke、双色和 500/520ms destination-only。
4. 换班/我的/更多：左右箭头、portrait、dot 的方向、幅度、delay；更多不得出现 Mini 私有透明度闪烁。
5. 顶部 bell/user：尺寸、stroke、颜色、红点位置、一次性 620/480ms，且不驱动底部 profile。
6. 日历筛选/定位、通讯录筛选/搜索/收藏/电话、事件 history、更多页所有工具、工作流 picker、返回和关闭。
7. 390×844、320px、大字体与默认字体下的安全区、裁切和抖动；记录冷启动、首次切 tab、连续切 tab 是否有可感知回归。

未取得匹配证据前只能写“自动化候选通过，待 Xiaomi 14 复核”，不能写 iOS、所有 Android 或全平台通过。
