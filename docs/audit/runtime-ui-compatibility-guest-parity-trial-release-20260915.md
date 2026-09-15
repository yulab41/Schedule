# Skyline 3.17.2 访客按压反馈对齐体验版 137 交付

## 交付结论

- 体验版：`0.1.0-p10.20260915.137`
- 应用 SHA：`09e63980c39321db5025e9eb3853cdd86c782c5a`
- 实现检查点：`09e63980 fix(miniprogram): align Skyline 3.17.2 guest press feedback`
- 上传说明：`Skyline 3.17.2 guest press 09e6398`
- 构建档位：`production/clean`
- 上传 Manifest：`cede600ca4bf7f45904c61ae716b9d70e9c92ea06020364a8289182e336768c5`

远端轻量 tag、allocation、Manifest 和 receipt 均绑定同一版本、SHA、说明与 Manifest。本轮只上传
小程序并通过可信控制追加允许版本；未提交审核、未正式发布、未退役旧版本，也未部署新的 API/Web
应用制品、执行数据库备份、迁移或业务数据写入。

## 变更范围

访客页面 `pages/guest/guest.wxml` 只改两行：月历补
`runtime-pressed-feedback-compatibility="{{skyline3172UiCompatibility}}"`，周格 `hover-class`
改为与成员页面相同的 `{{skyline3172UiCompatibility ? 'none' : 'is-pressed'}}`。成员页面零差异；
3.17.3 与无法读取版本的取值和外观不变；未新增依赖或第二套机制。根因与语义审计见
`runtime-ui-compatibility-header-press-fix-20260915.md`。

## 发布门禁

独占 `runtime/wt/general-3`（依赖复用、无安装）把 `09e63980` 冻结为
clean/detached/production 候选；上传前与版本绑定后两次 worktree safety 均 `RESULT=PASS`。

RED 新增 1 项并在旧实现上准确失败；GREEN 定向 31 项、Mini 完整 174 文件 1200 项通过、16 项跳过，
根套件 270 文件 1273 项通过、444 项跳过；TypeScript、production build（366 文件）、source audit、
package audit、determinism、format、lint、`smoke:check-core` 通过。主包 1,737,064 B、
总包 4,604,718 B。Mini verify 仍只被未修改的手排节点预算 `1507 > 1506` 阻断。

## 放行与公网验证

L4 预检：双 DoH 一致、TLS/SNI、严格 SSH 主机密钥与显式身份通过；实时读取的生产 live release 为
`44034fcc342b7ac9994b8222022c64118d276df9`，本轮未改变它。可信
`schedule-client-version-allowlist ensure` 只追加 `.137`，保留 `.135/.136` 等旧版；allowlist
verifier 与完整 `/usr/local/lib/schedule/ecs-verify.sh` 通过。公网探针：`.137 = 200`、
`.136 = 200`、`.135 = 200`、动态未知版本 `= 426`。

## 验收边界

上传、放行和自动验证不等于真机验收。唯一下一任务：在小米 14 上重开 `.137@09e6398`，分别用
3.17.2 与 3.17.3 实例复核访客页面的周格按压不再灰闪、月格蓝色反馈及时消失，并确认成员页面与
3.17.3 原有外观和 260ms 切换动画保持不变。
