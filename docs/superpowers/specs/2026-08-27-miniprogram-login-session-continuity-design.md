# 小程序登录会话连续性与 Web 视觉对齐设计

- 日期：2026-08-27
- 状态：已完成会话内设计确认，等待书面规格复核
- 范围：小程序账号/微信登录、登录后导航、跨 bundle 会话运行时状态、P3 登录视觉黄金稿
- 不包含：扫码访客日历、管理员 URL Link 绑定交互、账号/权限/API contract、滚轮 Worklet

## 1. 目标与验收

本批同时完成三个相互关联的目标：

1. 用户从“我的”切换或退出账号后，不重启小程序即可登录另一个账号；普通成员（以
   D0468 为复现账号）和 `admin` 都能在“我的”读取刚建立的会话。
2. 普通登录、微信已绑定登录、密码绑定和首次微信建档成功后，直接进入
   `/pages/workbench/index`，不再显示“身份已确认”中间页。
3. 登录态初始页采用当前 Web 登录页的视觉结构，同时保留“或”分隔线下方的微信快捷登录。

用户确认访客必须通过扫码进入独立的仅日历页面。因此登录页不显示“访客查看排班”，本批也不
新增、改造或重定向访客入口。

## 2. 根因与引入点

### 2.1 生产证据

2026-08-27 只读核验显示：

- D0468 与 `admin` 的账号、密码身份、用户资料及有效群组成员关系均存在且有效。
- 22:14 与 22:20 附近的两轮 `/auth/password/login` 和随后 `/groups` 都返回 HTTP 200，
  因此故障不是密码校验、Bearer 验证、账号停用或群组权限导致的 401 清理。
- 用户确认复现步骤包含：先在“我的”执行切换/退出，不重启小程序，再登录 D0468。

核验未读取或记录密码、令牌、联系方式或业务排班正文。

### 2.2 代码根因

`apps/miniprogram/scripts/build-tools.mjs` 对每个 TypeScript 入口执行 `bundle: true`。因此身份页、
工作台与 `profile-panel` 各自包含一份 `platform/wechat-identity.ts` 运行时代码，而不是共享同一
ES module 实例。

现有 `sessionInvalidated`、`sessionGeneration` 与 `sessionRecoveryPromise` 是 bundle 内模块变量。
“我的”组件执行 `clearWechatSession(true)` 后，其本地副本将 `sessionInvalidated` 永久置为 `true`。
身份页所在的另一个 bundle 随后能够向微信存储写入新会话，却只能复位自身副本；“我的”副本的
`readStoredWechatSession` 会在读取存储前提前返回 `undefined`，于是显示“尚未登录”。

`git log -S 'getStoredWechatProfile'` 与 `git blame` 将当前可见回归入口定位到 `79a0ae90
feat(miniprogram): align workbench navigation with web`：该提交把个人页作为独立 bundled component
嵌入常驻工作台，使切换账号后的陈旧模块状态进入主导航链路。底层模块变量更早已经存在，但在该
提交前没有形成当前嵌入式复现路径。

## 3. 方案选择

采用 App 级共享运行时状态，不采用仅跳转规避或新增持久化 epoch：

- **采用：App 级 singleton。** 在 `App.globalData` 建立微信会话运行时对象，统一保存
  invalidation、generation 与 recovery promise。所有入口 bundle 通过 `getApp()` 取得同一对象；
  测试或 App 尚不可用时使用模块内安全回退。
- **不采用：只在登录后 `reLaunch`。** 它能清理 Page 栈，但 Mini 的 bundled module 缓存仍可能
  保留陈旧 invalidation，不能修复根因。
- **不采用：持久化 session epoch。** 它可以跨 bundle 协调，但会增加一个存储 schema、迁移和
  非原子双键写入；当前同一 App JS 运行域已有更直接的共享边界。
- **不采用：删除 fail-closed invalidation。** 这会破坏物理存储删除失败时仍拒绝旧令牌的既有安全
  保证。

## 4. 会话运行时设计

新增轻量的会话运行时状态定义与工厂，并由 `app.ts` 在 `globalData` 初始化。状态包含：

```ts
interface WechatSessionRuntimeState {
  recoveryPromise: Promise<string | undefined> | undefined;
  generation: number;
  invalidated: boolean;
}
```

`wechat-identity.ts` 不再直接读写三个模块变量，而是每次通过 accessor 取得 App 级对象。accessor
遵循以下规则：

1. `getApp().globalData.wechatSessionRuntimeState` 存在时直接复用。
2. App 全局对象存在但状态缺失时，原子地挂载一个新对象，供兼容测试壳或异常初始化路径使用。
3. `getApp` 不可用或抛错时使用当前 bundle 的模块内 fallback；该路径只服务测试和启动前的
   fail-closed 访问，不是正常页面生命周期。

语义保持不变：

- `clearWechatSession` 先标记 invalidated，再清会话及按需清私有业务缓存，并增加 generation。
- `persistSession` 校验过期时间、按 owner 清理缓存、增加 generation、写入会话，成功后复位
  invalidated。
- 密码会话遇到 401 仍不触发微信静默登录；微信会话恢复仍为单飞。
- 陈旧 token、陈旧 generation、存储删除失败、跨账号缓存清理和最终 401 均继续 fail closed。
- 不向 `globalData`、日志或遥测新增 token、profile、用户名或其他身份内容；共享对象只保存控制
  状态与进程内 Promise。

## 5. 登录成功与导航

从 `IdentityMode` 删除 `authenticated`。删除 WXML 中“身份已确认”“准备进入排班台”“进入排班台”
及切换方式的成功块。

统一成功 helper 按以下顺序执行：

1. 根据认证方式调用 `persistPasswordSession` 或 `persistWechatSession`。
2. 清空密码和页面错误，保持按钮 loading，避免重复提交。
3. 调用 `wx.reLaunch({ url: '/pages/workbench/index' })` 清除旧身份页和工作台 Page 栈。
4. 若 `reLaunch` 失败，保留已建立会话，在原页显示“登录已完成，但主页未能打开，请重新打开小程序”
   并恢复可操作状态；不清会话、不自动重发登录请求。

该 helper 用于：

- 账号密码登录成功；
- 微信快捷登录直接返回 `authenticated`；
- 未绑定微信完成既有账号密码绑定；
- 首次微信建档完成。

微信返回 `link_required` 时仍进入现有 choice → password/register 状态机。管理员 URL Link 的
preview/confirm 页面是显式绑定流程，不属于普通登录确认页，本批保持不变。

身份首页 `onLoad` 若发现有效已有会话，也直接 `reLaunch` 到工作台，不再停在成功说明页。

## 6. 登录页视觉与交互

仅 `mode === 'login'` 使用 Web 对齐布局；choice、password、register 保留当前已确认的信息架构。
登录布局从上到下为：

1. 52px 蓝色圆角方形加号品牌标记；小程序系统胶囊由平台保留。
2. 标题“清楚掌握每一次值班”。不显示参考图中被红线划掉的“医护排班” eyebrow 和登录说明。
3. 白色卡片：
   - 可见“账号”标签、统一线性用户 SVG、账号输入框；
   - 可见“密码”标签、统一线性锁 SVG、密码输入框；
   - 蓝色主按钮“进入工作台”；
   - 中性“或”分隔线；
   - 描边按钮“微信快捷登录”。
4. 卡片外隐私说明：“账号只用于排班身份识别。联系信息仅对有权限的群组成员可见。”
5. 弱化后的构建版本标识，保留体验版问题定位能力。

不显示：

- “访客查看排班”；
- 被红线划掉的管理员预置/密码问题说明；
- Web 的 ICP 页脚；
- 旧 Mini 的“账号密码登录”卡片标题、蓝色“排”字标和身份用途尾注。

视觉使用现有语义 token、Web 同源蓝色、表面、边框、圆角和阴影；新增锁图标采用与现有
`web-profile.svg` 一致的线性 SVG，不使用 emoji 或位图。账号与密码输入高至少 48px，按钮触控区
至少 44px；标签不依赖 placeholder。两个登录按钮共用 loading/disabled 语义，错误继续显示在
卡片顶部并保留明确恢复路径。

390×844 为黄金尺寸，同时验证 320px、系统大字号、键盘弹出后的纵向滚动、无横向溢出与正文
对比度。动效只保留按压/焦点反馈，不增加登录页入场动画。

## 7. 测试先行与验证

### 7.1 必须先红的回归

在当前源码上先建立跨 bundle 测试：

1. 第一份 `wechat-identity` 模块持有 profile 组件视角并执行 `clearWechatSession(true)`。
2. 重置模块缓存，第二份模块模拟身份页并持久化 D0468 形态的普通成员密码会话。
3. 第一份模块再次读取 profile。

旧实现必须得到 `undefined`；修复后必须读到新 profile。测试同时证明：

- App 级 generation/invalidation 在两个模块实例间一致；
- 现有“物理删除失败仍拒绝旧会话”用例继续通过；
- 密码 401 不调用 `wx.login`；微信 401 单飞语义不变。

### 7.2 导航与页面状态

- 密码、微信 authenticated、绑定、建档四条成功路径各只调用一次 `reLaunch`。
- `link_required` 不跳转，仍保留 choice/password/register。
- 已有有效会话的 `onLoad` 直接跳转。
- `reLaunch` 失败保留会话并恢复页面错误状态。
- WXML 不再含普通登录 authenticated 成功块或“身份已确认”。

### 7.3 视觉与完整验证

- 更新 P3 Mini 登录 Storybook 黄金稿及静态断言，再实现 WXML/WXSS。
- 对 390px、320px 与大字号截图进行自评；不自动化微信开发者工具。
- 运行身份、会话、profile、工作台导航定向测试，随后运行 `pnpm miniprogram:test`、Mini typecheck、
  production verify、确定性/包边界检查、相关 Storybook/Web 静态测试及 `pnpm smoke:check-core`。
- 触及 Mini 身份核心链路，需要在调试记录中写明原生运行验证状态；自动验证完成后状态为
  “已实现待浏览器/实体复核”，体验版上传后由用户在实体 Android 复核切换账号、直接进入主页及
  320/390 登录布局。

## 8. 交付与发布边界

实现 checkpoint 只暂存本规格涉及的 Mini 身份/session/profile 测试、P3 登录视觉黄金稿、状态与
精确调试记录；不得夹带当前用户维护的 project config、群组成员 WXML/test、Web UI2 草稿、
`runtime/` 或根 `src/`。

验证通过后创建单一代码 checkpoint，推送 `main`，创建生产数据库备份并按 artifact hash 选择
完整 ECS 部署或 hash-identical reuse，执行完整 production verifier。随后从精确干净 worktree 用
仓库外私钥上传新的小程序体验版本并追加正式 allowlist；不提交审核、不正式发布。

滚轮 Worklet 设计仍保持独立待实施，不与本批代码或提交混合。
