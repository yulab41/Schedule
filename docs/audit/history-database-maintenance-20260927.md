# 历史列表数据库状态与凌晨归档（2026-09-27）

## 范围与基线

- 用户反馈近期列表修改后多个页面转圈数十秒，要求把展示状态保存在数据库，并在凌晨自动检查过期和归档过去月份。
- 基线 `origin/main=8197ff88`，生产 `e1de2a0e`，Mini 仍为 `.209@4d9cde15`。独占 `runtime/wt/general-6`、REUSE_ONLY，无依赖安装；本轮只改 API、数据库迁移和验证，不重新上传小程序。
- 引入点：`git log -S 'NOT EXISTS' -- apps/api/src/modules/past-schedules/mini-backfill-cleanup.ts` 与 blame 指向 `abab2fc3`；`e1de2a0e` 扩展到所有客户端。历史状态的读取映射与撤销月份守卫也来自 `abab2fc3`。
- P1 / 高置信：补录列表逐班次关联审计日志及 JSON 时间戳，生产 EXPLAIN 使用 group 索引，约每班次检查 1777 条审计项；列表事务持有既有用户/群组权限锁，拖慢同账号其他接口。主机负载低，API/MySQL 无重启或 OOM，不支持服务器资源耗尽假设。
- 实际 HTTP：大群组补录列表 19110 ms，小群组 77 ms。此前 30 分钟真实日志补录 p50=18234.7 ms，最大=54086.4 ms，群组/绑定/日历偏好也出现 35–51 秒等待。日历 change-stream 长连接不作为页面慢请求。

## 行为变化清单

1. schema 65 一次性把已确认的事件/补录隐藏审计标记转为存储字段及索引。保留事件、班次、工作流和原审计；不重复追加隐藏标记，不写死 9 月 24 日规则。
2. 事件列表直接读取 `timeline_hidden_at`。补录使用 STORED 生成列 `backfill_visible_at`，数据库只在写入时计算；之后再次补录、时间戳变化会自动恢复可见，不误伤未来补录。读取不再查审计表。
3. 六类工作流列表只查询 `list_hidden_at`。关闭且所属业务月份已过的记录由凌晨任务标记；待处理、日期缺失、跨月仍有效项保留。维护过程恢复已不满足隐藏条件的行，保留原业务 `updated_at` 和版本。
4. 复用服务器每 15 分钟的既有 privacy-retention 调度和主机 flock，在北京时间每日 03:00 后成功执行一次 history-maintenance；成功记录防重复，失败或错过后补跑，无新增常驻进程。一次短事务按既有群组锁顺序更新状态，任务结束释放锁。
5. 过去月份的 `published` 排班真正写成 `past`，版本增加一次；历史接口直接返回存储状态。当天月份不归档。写入端保留过去月份撤销/重发布保护，任务延迟也不能撤销；归档后撤销仍返回明确的中文锁定提示。
6. 这不是语义等价重构：原请求时判定改为每日维护后读取状态；新状态没有后台持续扫描。授权、业务记录、统计和原通知写入链路没有替换。

## 验证

- 真实 MySQL 红灯：2000 条隐藏补录读取产生 2,003,009 次 Handler_read，超过 80,000 阈值；脱离审计后仍隐藏与 schema 65 兼容回归另有 4 项先失败。
- 修复后同样 2000 条记录的真实存储读取为 **2007**，不再逐班次重复扫描整组审计。测试不使用机器性能敏感的毫秒阈值。
- 数据库迁移完整 29/29：空库、64→65、重复迁移、相邻毫秒、不同群组、原业务和审计内容保留，以及未来补录重新可见。
- 定时维护验证：02:59 不运行、03:00 归档、同日成功后跳过、失败日补跑、月末边界、待处理/跨月保留；归档前后实际撤销均拒绝。
- 单元/发布控制 46/46；API/database 类型、任务文件 ESLint/格式、API build 通过。`pnpm smoke:check-core` 通过，未修改 Web/contract 核心链路，不宣称浏览器或手机验收通过。
- 6 文件完整定向集成 105/105，换班历史范围追加 1/1（其他34项未选择）；迁移29/29单独串行运行，避免共享测试库相互覆盖。上一轮已复现的无关换班归档重发布断言未作修改，不宣称全仓测试通过。
- 命令：通过 `node --env-file=E:/AItools/Schedule/.env --input-type=module` 调用 `runApiIntegrationTests({testFiles})`，文件为 schedule-repository、past-schedules、events、event-routes、leaves、duty-adjustments 的 integration.test.ts；另跑 migrations.test.ts 和 swaps.integration.test.ts 的 `-t 'hides only closed swaps'`。单元使用 `pnpm exec vitest run scripts/ecs-schema-compatibility.test.mjs scripts/package-ecs-release.test.mjs apps/api/src/jobs/runner.spec.ts apps/api/src/jobs/privacy-retention.spec.ts infra/scripts/privacy-retention.spec.ts infra/scripts/release-controls.spec.ts`。
- `pnpm --filter @schedule/database typecheck`、`pnpm --filter @schedule/api typecheck` / `build`、`pnpm exec eslint <本轮TS/MJS> --max-warnings=0`、`pnpm exec prettier --check <本轮TS/MJS>`、`bash -n infra/scripts/ecs-verify.sh`、`git diff --check` 均通过。生产部署与接口复测将在交付后补记。
- 证据目录：ignored `runtime/audit/history-api-latency/`，只保存聚合计数、哈希、耗时及脱敏诊断，不存请求凭据或完整业务响应。

## 发布边界

- 检查点消息：`fix(api): persist history visibility and archive expired months nightly`。
- 生产加密备份 `970431c4-558e-498b-8997-e85d67b69713`，54表/322968行/135068312 B，容器实际文件大小和SHA-256与记录一致。
- 新版要求 schema 65；旧 manifest 只接受 64，因此迁移后不能直接用旧版自动回滚。保留生产备份和原发布产物，必要时前向修复，不绕过 schema 门禁。
- 当前为已实现待生产运行验证。唯一下一任务：完成提交/推送及授权部署，验证原业务哈希、凌晨任务、各列表一致性和并发耗时；通过后进入 `.209` 小米 14 复核。
