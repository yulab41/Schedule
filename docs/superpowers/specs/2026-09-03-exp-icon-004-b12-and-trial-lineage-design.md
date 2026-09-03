# EXP-ICON-004-B1.2 单一视觉来源与累积体验版设计

## 目标

本设计同时关闭两个会互相放大的风险：图标数据在 Web/Mini 间漂移，以及并行 worktree 把不含前序改动的旧 SHA
赋予更高体验版本号。最终候选必须既是同一视觉来源的兼容渲染，又是所有已接受能力的 Git 累积后继。

不变项：不重新绘制 Web 图标，不把 Vue/DOM/CSS runtime 粘进小程序，不改变业务 API、权限、路由、数据结构、
页面信息架构或原生交互所有权；不新增图标/动画运行时依赖。

## 方案比较

### 方案 A：远端不可变版本 tag + 累积祖先门禁 + 生成式视觉 adapter（推荐）

- 每个体验版本用 `miniprogram-trial/<version>` tag 原子绑定 exact SHA；禁止删除和 force。
- 候选必须同时后继最新 `origin/main`、最后累积 trial 和 policy 中的 required checkpoints。
- 图标 geometry/context/motion 均由共享包保存；构建时生成 Mini SVG 和两端 motion CSS，平台文件只声明 selector、
  transform-origin 和能力降级。

优点：跨 worktree、跨机器都能阻止同号竞态，也能阻止高版本旧代码；可以从 tag 直接还原 payload 身份。代价是上传
前需要网络和一个永久 tag，且任何失败版本都不能回收。

### 方案 B：只使用 tracked JSON 账本

优点是实现简单、review 直观。缺点是两个尚未合并的分支可以同时添加相同版本并上传，恰好不能解决本次并行竞态。
因此 JSON 只保留历史与 bootstrap policy，不承担唯一占用。

### 方案 C：只要求上传前合并 main 或人工递增版本

它可以降低普通遗漏，但不能证明候选包含最近的体验分支，也不能原子阻止重复号码；`.84` 正是“号码递增但 SHA 回退”
的反例，不采用。

## 视觉单一来源

```text
packages/ui-icons/
  src/catalog.ts          # 唯一 geometry、part、来源、许可证
  src/context.ts          # 使用场景 size/stroke/color role
  src/motion.ts           # 唯一 trigger/timing/keyframe/reduced-motion
  src/platform-bindings.ts# 只保存 selector/origin/capability 映射，不保存第二套数值
  scripts/generate-miniprogram-assets.mjs
  scripts/generate-motion-adapters.mjs
      ├─ apps/web/src/generated/ui-icon-motion.css
      └─ apps/miniprogram/src/styles/ui-icon-motion.wxss

apps/web/src/components/SharedIcon*.vue
  # SVG DOM renderer；业务组件只负责事件与 active state

apps/miniprogram/src/assets/icons/ui-*.svg
  # generated local assets；页面只选择状态 variant/叠放 actor
```

`context.ts` 至少冻结：mobile bottom 23px/2、desktop nav 20px/2、top profile 20px/2、top bell 21.6px/1.8、
directory mode 18px/1.8、directory favorite 21px、directory phone 17px、calendar filter 20px/1.8、calendar locate
16px、more row 20px。颜色角色来自 `@schedule/ui-tokens`，不得在页面 asset 中复制 hex。

生成器输出包含 source revision、nodes hash、context key 和 motion spec hash。测试重新生成到 ignored 临时目录并逐字
比较 tracked 输出；任何手改 generated 文件都会失败。静态图标继续直接使用 `<image>`，避免为每个 glyph 新增自定义
组件和首屏节点。

## B1.2 平台适配

### 底部导航

- 五项均由 `activeWorkspace` 直接决定 asset tone 和 loop class，删除 `navMotion` 这种点击后可滞留的平行状态。
- calendar 保留 base/check；directory 新增 base/contact-person；profile 新增 body/portrait；swap 和 more 使用已有 part。
- 所有 part 都从同一 catalog 节点生成 primary/secondary variant；inactive 不运行 keyframe。
- Mini 不支持外部 SVG path dash 时，calendar 只降级 opacity；其余 transform/opacity 按共享 spec 生成。
- 按压反馈使用共享 `navigation-press`，与 Web 一样作用于 nav item、scale 0.98；不保留 icon-only 0.88。

### 顶部与通讯录

- 顶部 profile 使用 TDesign `user` 几何和独立 one-shot 状态；底部继续使用 nav `profile` 几何和 active loop。
- bell/user 使用各自 context 尺寸/stroke，不复用 24px 默认值。
- 通讯录 department/people 保持 destination-only 500/520ms；重复点击当前模式不重播。
- filter 三 part 资产以 1.8 stroke 生成；locate 和 more row 使用 Web context size。

### 其他生产图标

- B1 已迁移的更多页、电话、收藏、事件、通知、导出、身份、工作流、返回/关闭 geometry 原样保留。
- 若 Mini 页面没有 Web active row 的持久在线状态，保持静态，不在路由离开后模拟后台循环。
- 所有 action/nav keyframe 从 `motion.ts` 生成；页面代码可以选择“何时触发”，不能再写 duration/easing/offset/幅度。

## 体验版血缘与版本占用

实现边界固定为：

```text
apps/miniprogram/release/trial-history.v1.json
  # .74–.84 的 append-only 审计事实与碰撞标记
apps/miniprogram/release/trial-lineage-policy.v1.json
  # schema、lastSequence bootstrap、required checkpoints
apps/miniprogram/scripts/trial-lineage.mjs
apps/miniprogram/scripts/trial-lineage.test.mjs
  # 纯 Node 校验、远端 tag 占用和可注入测试边界
runtime/audit/miniprogram-trials/<version>.json
  # ignored、脱敏、上传后 receipt；不进入 Git 或制品
```

```text
candidate HEAD
   ├─ ancestor: freshly fetched origin/main
   ├─ ancestor: latest cumulative trial tag
   ├─ ancestor: every requiredCheckpoint (bootstrap includes 5285dd17)
   ├─ clean + production profile + explicit non-local version
   └─ description contains short HEAD
             │
             ▼
atomic push refs/tags/miniprogram-trial/<version>
   ├─ absent → reserve permanently
   ├─ same SHA → idempotent retry allowed
   └─ different SHA → fail closed
             │
             ▼
build metadata equality → miniprogram-ci upload → ignored receipt
```

历史账本记录 `.74–.84` 的碰撞事实；bootstrap `lastSequence=84`，但实际版本必须在 L3 当时重新读取远端 refs 后动态
提出，不能在计划中硬编码 `.85`。序号全局单调增加，不因日期或任务切换而回收。

首次启用 tag 机制时，候选必须包含 `5285dd17` 和执行时最新 main。之后 latest cumulative tag 成为下一候选的直接
祖先门禁。实验切片只允许 preview/dry-run，不进入 `upload-experience`、不创建 cumulative tag、不加入 production
allowlist。

上传失败或响应不确定时保留 tag，并只允许同 SHA/同版本幂等重试；若需要代码变化，创建新 commit 和新版本。回滚
通过最新 tip 上的 revert commit 实现，不复用旧制品。

## 测试与验收

### 永久自动门禁

- 历史账本 schema、版本唯一性、碰撞标记和 required checkpoint 存在性。
- 临时 Git remote 中两个候选并发占同一 tag：只允许一个成功；不同 SHA 重试失败，同 SHA 重试通过。
- stale HEAD、dirty tree、非 production、`version=local`、description 无短 SHA、缺 required ancestor 均失败。
- dry-run 不 fetch/push tag、不写 receipt、不调用上传；真实外部调用由注入 fake 覆盖，不在测试中上传。
- catalog/context/motion 到 Web/Mini generated 输出逐字确定性；旧 `web-*`、私有 path、私有 timing 和错误触发状态失败。
- 底部五项 active/inactive/active-only、顶部 profile 分离、人员 destination-only、reduced-motion 契约。

### 候选门禁

运行受影响包 typecheck/test、完整 Mini tests、production build、source/package/performance/determinism/verify、Web
相关 tests/build、format/lint、`git diff --check` 和 `smoke:check-core`。若实际修改触及 Web core 路径，再运行
`smoke:browser` 并记录真实结果。

包体以同一 clean parent/new、相同 Node/pnpm/profile/env/fingerprint 复测；总包 ≤+64 KiB、B1.2 ≤+16 KiB、
generated adapter ≤+12 KiB。超过即停止，不以“视觉一致性”豁免。

### 原生验收

自动化只证明静态来源、构建和状态契约。Xiaomi 14 必须使用 exact tag/SHA/version/build time 的 trial，核对 Skyline、
基础库、微信/Android 版本，再按审计清单录屏/截图。没有匹配证据时状态为“待用户复核”。

## Git 集成顺序

1. 实现并推送 lineage B1；不创建真实 tag、不上传。
2. 执行时重新 fetch main，在其上 merge `5285dd17` 以保留原提交祖先身份。
3. 对仅有的三份文档重叠人工合并：保留当前主线事实，再加入 EXP-ICON-004；禁止 `checkout theirs` 覆盖状态。
4. 对合并后的 B1.1 baseline 先写 B1.2 红灯，再实施视觉 adapter；逐调用点确认事件、`setData` 次数、timer、路由和
   reduced-motion 不产生业务变化。
5. 完整验证后提交并普通推送调查分支，停在 L3 上传批准之前。

## 授权边界

本设计 checkpoint 不创建 remote tag、不上传体验版、不操作服务器 allowlist、不提审、不正式发布、不部署
production。未来上传前须披露 exact SHA、动态版本、description、clean/profile、测试页面，并取得当次 L3 批准；
allowlist 是单独 L4 操作，只有当前消息明确授权该 exact version 时才执行。
