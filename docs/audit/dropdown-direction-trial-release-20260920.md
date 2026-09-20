# 下拉菜单滚动边界修复体验版交付

## 范围与候选

- 用户授权上传体验版并只增生产放行，保留旧版本；未授权也未执行提交审核、正式发布或版本退役。
- 原修复完成后 `origin/main` 已前进并交付 `.181`，因此没有上传旧分支候选，而是把设计与实现移植到最新累计 main，形成 clean 候选 `94beb25e92c3665442888e929ece9c7b86a6792f`。
- 共享 selector/date-picker 以工作流 `.workflow-sheet-scroll` 的可视边界决定向上/向下展开并限制菜单高度；换班、值班、请假面板统一传递和清理边界。

## 验证与上传

- 受影响 Vitest 39/39、Mini typecheck、根 ESLint/Prettier、production Mini verify 通过；主包 1716535 B、总包 4620288 B，只有既有内部主包预警和手排矩阵 best-effort 预警。
- 开发者工具模拟器已验证：靠底部向上展开并可选中，靠顶部仍向下展开；这不是小米 14 原生验收。
- 独占版本锁动态分配 `0.1.0-p10.20260920.182`，说明“下拉菜单滚动边界自适应 94beb25”。production/clean 上传成功，Manifest `20ca7a0c53f372b158eeeabe816d557e1475f08d542e0e1938850f11c8b0f7b6`；远端不可变 tag、allocation、Manifest、receipt 与 SHA 一致，上传前后 worktree safety 均为 PASS，`version=local` 不存在。

## 生产放行边界

- 写入前两家独立 DoH 与既有主机密钥唯一匹配，严格 TLS/SSH、allowlist verify 通过；`.181=200`、`.182=426`，现场 release 为 `bc5fc30784a35c37b11ecde63a9aa96f2be56e0a`。
- 可信 `schedule-client-version-allowlist ensure` 只追加 `.182`；按控制面设计重建 API/Web，首次健康等待出现一次短暂 SSL EOF，随后自动恢复并报告策略验证通过。
- 独立 allowlist verify、带公网路由的完整 `ecs-verify.sh` 及最终公网探针通过：`.182=200`、`.181=200`、动态未知版 `426`、health `200`；线上 release 保持 `bc5fc307`。
- 本轮没有生产应用部署、数据库备份/迁移、真实通知、提交审核、正式发布或旧版本退役。

## 下一步

小米 14 打开 `.182@94beb25`，分别在换班、值班、请假弹窗测试靠底部和靠顶部的下拉/日期选择器。只有同版本真机证据通过后，才能把原生交互状态改为“已完成”。
