# Skyline 页头与按压反馈体验版 136 交付

## 交付结论

- 体验版：`0.1.0-p10.20260915.136`
- 应用 SHA：`efda88f993d4724f0f391b965ae5f55c8c3f4571`
- 实现检查点：`890c50a9 refactor(miniprogram): share Skyline group menu portal`
- 血缘证明检查点：`efda88f9 chore(release): refresh 3.17.2 header lineage proof`
- 上传说明：`Skyline 3.17.2 header press efda88f`
- 构建档位：`production/clean`
- 上传 Manifest：`27702a1c80315a741c72d2cd1e562d65b659c42be42335cb722af2b4f908a32b`

远端轻量 tag、allocation、Manifest 和 receipt 均绑定同一版本、SHA、说明和 Manifest。
本轮只上传小程序并通过可信控制追加允许版本；未提交审核、未正式发布、未退役旧版本，
也未部署新的 API/Web 应用制品、执行数据库备份、迁移或业务数据写入。

## 修复与 3.17.3 不变边界

所有 Skyline 版本共用一份 `root-portal` 群组菜单、一份选项模板和一个选择事件，避免两套菜单机制。
仅精确基础库 3.17.2 使用 220px 无父级上限的群名宽度、周格无灰色 hover 类和月格松手 0ms；
3.17.3 继续使用 216px 菜单、12px 左距、原颜色/圆角/阴影、原周格按压和月格 70ms。
月/周分页状态机、260ms 动画、日期提交和队列均未修改。

定向 30 项和完整 Mini 174 文件 1199 项通过、16 项跳过；TypeScript、production build、
source/package/determinism、format、lint 和 `smoke:check-core` 均通过。主包 1,736,932 B、
总包 4,604,586 B，较 `.135` 总包增加 319 B（约 0.007%），没有新增依赖。完整 Mini verify
仍只被未修改的手排节点预算 `1507 > 1506` 阻断。

## 发布门禁与放行

首次冻结 `890c50a9` 时，血缘检查器在版本分配和微信上传前拒绝过期的
`workbench/index.ts` canonical blob；该次失败未分配版本、未创建 tag、未调用微信上传。
精确 diff 证明 TypeScript 仅新增根层菜单定位字段、默认值和布局 patch 返回值，刷新 policy 后
lineage audit 与上传相关 34 项通过，随后冻结并上传 `efda88f9`。

L4 inspector、双 DoH 一致性、TLS/SNI、严格 SSH 主机密钥和显式身份预检通过。可信
`schedule-client-version-allowlist ensure` 只追加 `.136`，保留 `.135/.134` 等旧版本；随后
allowlist verifier 和完整 `/usr/local/lib/schedule/ecs-verify.sh` 通过。公网探针结果：

- `.136`：HTTP 200；
- 保留的 `.135`：HTTP 200；
- 动态未知版本：HTTP 426。

可信 ensure 按既有控制重建 API/Web 容器以装载允许列表，但生产 live release 仍为
`44034fcc342b7ac9994b8222022c64118d276df9`，没有部署新应用制品或修改数据库。

## 验收边界

上传、放行和自动验证不等于真机视觉验收。唯一下一任务是在同一小米 14 上确认两个微信实例
都显示 `.136@efda88f`：3.17.2 复核群名完整、菜单不被日历覆盖、周格无灰闪、月格蓝色反馈及时
消失；3.17.3 复核页头/菜单、通知胶囊、月周单元格反馈和 260ms 切换动画均保持原样。
