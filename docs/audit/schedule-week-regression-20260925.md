# 周视图回归修复记录：2026-09-25

## 根因

- `git log -S 'calendarWeekPanelHeight'` 与 `git blame` 定位到 `e8286722`：首页 `pages/workbench/index.wxml` 从内联周格切换为 `calendar-week-panel`，`workbench-model.ts` 复用新的高度和排序模型，`index.ts` 移除首页原有的 `+20` 布局补偿。
- 新组件的周格底部留白为 `padding-bottom:24px`，选中框使用 `box-shadow` 且没有继承底角圆弧；补录周格把所有 `date < today` 映射为 `is-past`，而补录月历实际使用未来/今天禁用灰底、过去日期白底的规则。

## 修复

- 首页页面、首页视图模型和首页事件处理恢复到 `aef86299`；首页没有继续使用新的共用周组件。
- 补录/预览共用周格保留班种分组和顺序，但将高度基线恢复为实际内容高度，390px 按三字估算、320px 及以下按两字估算；选中框继承首尾底角圆弧。
- 补录周格不再把过去日期标为灰色；未来和跨月不可补录日期使用 `is-future` 灰底，过去已读取日期保持白底。预览的已有排班仍由 comparison class 灰显，本次预览保留班种色。

## 验证

- 回归用例先失败后通过：相关 Mini 定向测试 `103 passed / 1 skipped`，新增浏览器几何测试覆盖 390px/320px、高度无溢出、底部留白和底角圆弧。
- Mini 全量：`1280 passed / 18 skipped`；根全量：`1306 passed / 451 skipped`。
- `pnpm verify`、`pnpm --filter @schedule/miniprogram verify` 均通过；生产包 `4,817,496 B`，manifest `a1deb7225864811c054ec55f06fde0b77c90816f4c9fe60d331b5a20c16003a8`。为通过候选 lint，仅在回归测试文件补充浏览器全局声明，未改变生产源码。
- 开发者工具 `compile_wxml`/`compile_wxss` 通过：首页 WXML、周格 WXML/WXSS。首页模拟器停在“正在读取排班”，没有真实排班数据，不能作为视觉通过证据；小米 14 未验证。

## 发布状态

### 上传与放行结果

- 首次上传尝试在动态版本分配前被 `trial-lineage` 门禁拒绝：发布策略的 `5285dd1` required checkpoint 仍记录共用组件版 `apps/miniprogram/src/pages/workbench/index.ts` 指纹 `0d80dfc3c01db0a6e1e39e59bc4b02da28754825`，而本轮按用户要求把首页恢复到 `aef86299` 后的指纹是 `e0f48e5b07add7c1cd4b61d64ca2860d6327196c`。该次尝试没有创建版本、tag、allocation、manifest 或 receipt，也没有产生任何微信平台上传副作用。
- 血缘收口：只把 `5285dd1` canonical proof 的该文件 blob 更新为恢复后的确切指纹，不放宽检查。`pnpm --filter @schedule/miniprogram check:trial-lineage` 通过，`trial-lineage` 与上传门禁定向 19/19 通过；提交 `a3eccb490c6f3a31645a6ab8528eea43ff492ff6`（`chore(release): refresh weekly calendar lineage proof`）已推送到 `codex/schedule-week-regression-trial-20260925`。
- 冻结候选：独占 warm 槽 `general-6`（`DEPENDENCY_MODE=REUSE_ONLY`，未安装依赖），`check-worktree-safety.ps1` 在构建前与产物绑定后均返回 `RESULT=PASS`、`ready-clean-detached`、`MINIPROGRAM_PROFILE=production-clean`、`VERSION_LOCAL=absent`。
- 上传：`0.1.0-p10.20260925.198`，description `weekly calendar parity a3eccb4`，production profile，239 个代码文件，ZIP 2,703,520 B，Manifest `a9064a4d781a76d7e4137e612f10d8048a569c019878259ed348ddea392d5014`；远端轻量 tag `miniprogram-trial/0.1.0-p10.20260925.198`、allocation、manifest 与 receipt（ignored `runtime/audit/miniprogram-trials/0.1.0-p10.20260925.198.json`）绑定同一 SHA。
- 放行：按受信物理路线（双 DoH 一致、正式域名主机密钥唯一、直连 TLS health、`StrictHostKeyChecking` + `HostKeyAlias` + `IdentitiesOnly`）执行 add-only `schedule-client-version-allowlist ensure`，只追加 `.198` 并保留全部旧版本；独立 `verify` 与完整 `ecs-verify.sh` 退出码 0，放行重建 API/Web 期间出现一次 TLS reset，既有健康等待后恢复。
- 放行边界：线上 release 仍为 `ad6c09fea36edd962a72fc03b52768ca38b10d2e`，未部署生产应用、未备份或迁移数据库、未提审、未正式发布、未退役旧版本。公网探针 `.198=200`、`.197=200`、动态未知版本 `.999999=426`。
- 未验证项：模拟器首页停在“正在读取排班”，没有真实排班数据；真实排班视觉、连续手势、320px 布局与小米 14 同构建复核仍待用户证据。唯一下一任务是用小米 14 打开 `.198@a3eccb49`，复核首页周视图是否完全复原（高度、底角圆弧、选中框）以及补录/预览周视图与首页是否 1:1 一致。
