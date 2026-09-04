# Project Status

本文档只记录当前可安全接续的事实；详细历史以 docs/audit/ 和精确 debug 日志为准。每轮先读
docs/agent-context/pitfall-index.json，只加载匹配坑位详情。

## 当前仓库批次（2026-09-05）

- 当前活动批次：ICON-PARITY-CLOSE-001（Web/Mini 图标五层 parity、确定性门禁、版本血缘与工具链固化）。
  主工作树及其他 worktree 的用户改动均未接管。
- 本轮起始 origin/main@bb81e723；最新 fetch 为 origin/main@e050258c1a90c7fe210bec0ed80ee4071fabafb3。
  7f407038、fc79762d、969f740d、a505746a、7bf50bd0、e050258c 均为 bootstrap/test/status 文档或工具链变化，
  不覆盖 icons、Mini/Web runtime、lineage code 或 lockfile；最新主线已通过 merge parent 纳入。
- 当前 worktree：runtime/wt/icon-parity-1，分支 codex/icon-parity-current-20260904；机器台账在
  ignored runtime/codex/tasks/icon-parity-current.json。当前 source candidate 是上传前 exact
  5aff4449e0f2ef703b367c846b67a9e51bac04bf；发布后的文档-only 主线 merge 以 Git HEAD 为准。
- 历史关系：8e6a4a32 是旧日历基线；1ffab10c、5285dd17、71110712 的实现进入当前 canonical tree，
  但最终整合采用等价实现而非保留三者的祖先关系。三组 required canonical tree-file blob proofs 均已验证；
  旧观察版 .86@8caa5f20 不作为当前源码。
- 当前 tracked 变化只包含 canonical icon/catalog/context/motion、Mini 生成资产、Web gallery、parity/liveness
  gates、lineage/release helper、guardrail/reference 和状态文档；无生产数据库、凭据或 runtime 产物进入 Git。

## 图标与交付结论

- 快速 parity：55 canonical definitions；58 generated Mini SVG；138 production references / 58 unique assets；
  legacy web-* references 0、legacy files 0、unreferenced assets 0；production source files 116。
- 几何/语义/context：matrix 58 entries、13 contexts、14 stateful groups；Web/Mini context bindings 13/10；
  multi-part people assets 保留 primary/secondary，top user 与 bottom profile 显式区分 context。
- 状态/motion：active/inactive/pressed/disabled 矩阵完整；Web/Mini motion bindings 31/25，emitted bindings 56；
  Mini keyframes 32、orphan 0；active workspace 驱动 bottom loop，离开 active 状态停止，top action 为 one-shot。
- 构建血缘：generator 连跑 deterministic（60 generated outputs）；manifest、实际文件和生产引用双向闭合；
  页面私有图标仅保留 allowlisted SharedIcon.vue canonical root，未发现直接 TDesign 或旧 web-* 生产引用。
- 独立 gallery：apps/web/icon-parity.html 无需登录/API；Edge 加载 55 catalog、13 context、44 去重 binding cards；
  stop/start 将 loop/one-shot 从 2/1 变为 0/0 再回 2/1，无 404/console error。

## 血缘、版本与依赖

- tracked trial history 覆盖 .74–.86；远端 .86@8caa5f20 是旧观察候选。动态 allocator 从 history 与
  miniprogram-trial/* immutable tags 取全局序号，实际选择 .87，没有硬编码下一版本。
- 上传候选：version 0.1.0-p10.20260905.87；sourceSha 5aff4449e0f2ef703b367c846b67a9e51bac04bf；
  description exp-icon-004-web-mini-parity-5aff444；profile production；manifestDigest
  7b1acbe671d78fc8c10510407fb8a07107a8e738015fa6b0033a2b0a7b677a9a；tag 已远端绑定同 SHA。
- build profile：buildCommit 5aff444、buildDirty=false、buildVersion .87、buildTime
  2026-09-04T18:20:58.65Z；receipt uploadedAt 2026-09-04T18:30:17.07Z，reservation 为 idempotent
  fallback retry。当前 candidate preflight 的最新 trial 已可为 .87 本身 ancestor；历史三项 required commit
  在 Git graph 中不是 ancestor，但每项 canonical proof 均 matched=true，未放宽到无证据旧源码。
- 官方依赖最终指纹 b392a5b881360c1aa0bac89bfdbd8f45c9e928c9d0a1ab17e6dedbaca0dbc48e；最终 ReuseOnly 为
  READY_REUSE、installInvoked=false。全轮五个 distinct fingerprints 各一次有效 frozen reconciliation，child
  invocation 9（含两次 pre-resolution tripwire、两次 lockfile rejection、五次有效 child），下载 0，tracked tree
  前后 hash 一致；没有升级依赖或手工 link。当前-message L2 审计与临时授权文件已清理。

## 验证、上传与边界

- 定向契约：Mini icon/workbench/calendar 5 files/45 tests；lineage/CI 2 files/19 tests；lineage equivalence
  15/15；guardrail Node 18/18；catalog/gallery 2/2；latest-main pool/bootstrap 7/7；skill validator RESULT=PASS；
  pnpm smoke:check-core 通过。
- 完整 pnpm verify 共执行 4 次：首轮在旧候选因状态文档 250 行门禁退出 1；两次成功证据随后因主线/文档合并
  失效；最终 exact source candidate 5aff4449 运行 1 次成功，format/lint/build/typecheck/icon parity、
  Mini 123 files/671 tests、Node 22/22、根 Vitest 248 files/37 skipped、1173 passed/364 skipped 全通过。
  最终日志 SHA-256 为 0a54379cc6c662fc4182c3b536f33746b799af69e5fac00b3ff4713c2de9beb4。
- Mini release gates：完整 verify 未覆盖的 package/source/determinism/CI dry-run/lineage 在 final tree 上仍需按
  台账执行一次；不重复 verify 已覆盖的 build、typecheck、Mini full suite、root tests、format 或 lint。
- Web 边界：pnpm smoke:browser 曾真实启动 Edge，但 API 127.0.0.1:3000 未运行，停在 /login?redirect=/；
  独立 gallery 通过，不因 API 未运行反复管理员 smoke。未调用微信开发者工具 GUI/CLI、模拟器、Console/Network。
- 上传：普通代理/TUN 路由返回 -10008 invalid ip；同版本/同 SHA 复用已有 dist，清除本进程代理并使用
  已 TLS 预检的 process-level IPv4 129.226.106.233 成功。官方 CI 成功写 receipt；无正式提审/发布。
- Allowlist：canonical hostname SSH、known_hosts matched、StrictHostKeyChecking=yes；可信 add-only
  ensure .87 exit 0（API/Web 重建，MySQL 未重建，短暂 TLS reset/502 后恢复），独立 verify exit 0；
  旧 legacy 与 unknown=426 由工具完整验证，新版本匹配 production capability policy。未做数据库备份/迁移。
- Xiaomi 14：当前工具无法测量，暂未验证；静态 SVG、Node/Vitest、Mini simulate 与 Web gallery 不能替代
  Xiaomi 14 原生视觉、Skyline、帧率、冷启动、内存或真机交互。生产业务部署不在本任务范围。

## 网络与下一步

- GitHub：configured HTTPS origin transport，fetch 与普通 push 成功，未使用 fallback。
- WeChat：系统 DNS 返回 Fake-IP 198.18.0.58；首次代理请求被 -10008 拒绝，process-level direct IPv4
  fallback 成功；保留 hostname/SNI/证书校验，未改系统 hosts/VPN/DNS。
- ECS：仅 canonical hostname SSH 用于本消息授权的 allowlist ensure/verify；未使用 direct-IP fallback，SSH
  StrictHostKeyChecking 保持开启。
- 当前唯一下一任务：完成 final Mini release gates，更新 ignored task state 与 receipt/allowlist/network hashes，
  核对 clean exact worktree 和推送状态；停止于体验版验证，不提审、不正式发布、不部署 production。
