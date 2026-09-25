# 共用周历体验版上传与放行记录：2026-09-25

## 上传前冻结

- 用户本轮明确要求“上传并放行”。目标应用代码检查点为 `e82867221e012b4688220e3c2c2e2e3f79e676e3`，已推送，Mini 与文档范围；不提交审核或正式发布。
- 独占健康 warm `general-6`，`DEPENDENCY_MODE=REUSE_ONLY`，无安装。候选包含 fresh `origin/main=f8010455` 和最新累计体验版 `.196@aef86299`。不从历史记录猜测下一个版本；由独占上传分配器选择。
- `5285dd1` 的 canonical proof 原绑定 `aef86299` 的首页文件。与本轮代码逐行比较，变更仅为周格 `select` 事件从组件 detail 读取业务日期，以及共用高度已包含原额外 20px 后移除重复相加。`selectBusinessDate`、环形分页、滑动队列、定位业务日期和滚动处理均未改变。发布 policy 更新精确 blob 与说明，不放宽检查。
- 应用证据来自同一代码树 `e8286722`：`pnpm verify` Mini 1274/17 跳过、根 1306/451 跳过；Mini production verify、源码/包体、开发者工具局部编译通过；总包 4,815,725 B。发布 policy 变更另经 trial lineage audit 与 16/16 定向测试通过。小米 14 尚无本构建证据。
- 上传计划：production profile，干净确切 SHA，说明包含短 SHA，测试页为首页周历、排班补录及手排生成/草稿/已发布预览。先做候选冻结和版本锁分配，再核对 Manifest、远端 tag 与成功 receipt；放行只使用可信 `ensure` 并保留旧版本。版本、Manifest、上传路由及放行验证在成功后追加。

## 上传与放行结果

- 干净候选 `ad6c09fea36edd962a72fc03b52768ca38b10d2e` 已推送；production 体验版 `0.1.0-p10.20260925.197` 上传成功，Manifest SHA-256 `30cc39f53a2e358333aefea3e8eed9cb873d0a5c2394a42e67d817544f0a40f7`，远端 tag、allocation、manifest、receipt 一致。239 个代码文件，ZIP 2,706,505 B；未提审或正式发布。
- 用户随后明确授权生产备份、发布标识同步与验证。实时生产基线为 `17c1c90f88b71af110f7c85add42bf6f8a6ecf3a`，加密备份 `c1e4ee1c-e729-4e98-a4de-1321930e9413` 完成。可信复用工具因 dist/API 归档哈希不同而拒绝且未变更线上；随后按完整部署流程将生产 release 更新为 `ad6c09fea36edd962a72fc03b52768ca38b10d2e`。完整 `ecs-verify.sh` 通过。
- 可信 allowlist `ensure` 只追加 `.197`，独立 `verify` 与再次完整 ECS verifier 通过。正式域名 `.197/.196` 均 HTTP 200，动态未知版本 HTTP 426；旧体验版保留。小米 14 同构建原生动画、320px 和实际排班视觉尚无证据，不能记为通过。
