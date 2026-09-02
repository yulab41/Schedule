# 微信小程序与通讯录审计状态

- 当前阶段：小程序输入请求收敛已进入主线；服务端查询正式化已完成，停在专用分支等待用户批准。
- 最新主线基线：a4f50c0207ccb67f5ccdc78dd3912ba248fec9af。
- 服务端分支：codex/directory-query-production-ready。
- API/flag/schema 兼容桥：5dcb2b5ae7034aea1ad34033a38a58c9683f4b9a。
- migration/语义/基准：1e1084f9f38e3ebdbe7105a95c60c865215f6caf。
- 详细证据：directory-query-production-readiness.md。
- 外部状态：未上传、未分配新体验版本、未部署或修改 production、未创建生产备份、未运行生产迁移/
  索引/EXPLAIN ANALYZE、未切换服务器 release。

## 小程序最终行为

- 不新增可见搜索按钮。
- input 保持 confirm-type=search 和 bindconfirm，同一 confirm handler 负责键盘搜索。
- 中文含单字停止输入 500ms 自动搜索。
- 纯 ASCII、纯数字及 ASCII/数字混合输入不在 bindinput 防抖中发请求，只在 confirm 后搜索。
- confirm 前清 timer、trim/规范化、空值不请求；复用同 in-flight/有效完成结果，连续确认不重复。
- 清空、模式/筛选变化和卸载清 timer；bindblur、页面点击、键盘收起和焦点变化不触发搜索。
- 旧请求继续由 context/query serial 隔离，不覆盖新结果。

clean 最新主线 production dry-run：

- 源码：a4f50c0207ccb67f5ccdc78dd3912ba248fec9af；
- 候选（未分配）：0.1.0-p10.20260902.77；
- 显示：0.1.0-p10.20260902.77@a4f50c0；
- 描述：p10-directory-confirm-a4f50c0；
- manifest：f193af947efc9339741f323db16374dcf31306ef2bb4617729108848e6a8c8ec；
- 包体：main 1,678,590B，total 5,122,464B；
- 状态：只完成 dry-run，没有上传或查询平台占用历史。

## 服务端正式化状态

- feature flag 默认 legacy；candidate 受 migration 53 和精确覆盖索引双门禁。
- 路由：长度至少 2、无有效七级筛选走 candidate；空查询、单字符、有效筛选走 legacy。
- 语义：93 组 API、69 组直接 rank、双向跨计划分页和权限零差异。
- 性能：首字母 examined -96.7%，main P95 -45.5%；并发吞吐/总 P95 改善，0 error/timeout/disk temp。
- migration/rollback、schema 52–53 兼容桥、导入写放大、在线 DDL 和阶段回滚计划已验证。
- production 只读 SSH 被 banner timeout 阻塞，实时资源、索引和 live rollback source 尚未核验。

## 验证层级

| 层级 | 结果 |
| --- | --- |
| 小程序 | 113 files / 608 tests；production verify/determinism/package/dry-run 通过 |
| 服务端定向 | plan/env/timing/release 75；migration 24；directory DB 11 |
| 全仓 | lint/typecheck/build、任务格式/shell/diff 通过 |
| 非任务基线 | root Vitest 2 个日期 fixture 失败；format 12 个基线文件；浏览器 smoke 被既有 Sheet 断言阻断 |
| 原生 | 本轮没有新体验版；不产生新的微信 DevTools 或小米 14 结论 |

## 唯一下一任务与停止条件

服务端正式化分支提交并普通推送后停止。下一次必须由用户明确选择并授权：

1. 上传小程序候选；或
2. 先部署 flag 仍为 legacy 的 API 兼容桥。

未取得当次授权前，不上传、不部署、不迁移、不建索引、不改 production 配置、不创建生产备份。任何
production 操作前先恢复实时只读预检，并从服务器 live release 读取 rollback candidate。
