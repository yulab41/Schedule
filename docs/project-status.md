# Project Status

本文档只记录当前可安全接续的事实；详细历史以 docs/audit/ 和精确 debug 日志为准。每轮先读
docs/agent-context/pitfall-index.json，只加载匹配坑位详情。

## 当前仓库批次（2026-09-05）

- 当前活动批次：ICON-PARITY-CLOSE-001（Web/Mini 图标五层 parity、确定性门禁、版本血缘与工具链固化）。
  主工作树及其他 worktree 的用户改动均未接管。
- 本轮起始 origin/main@bb81e723；最新 fetch 为 origin/main@32792fe47b1c3769bebe14a0632e3de9279e7b32。
  7f407038、fc79762d、969f740d、a505746a、7bf50bd0、e050258c、32792fe4 均为 bootstrap/test/status 文档或
  工具链变化，不覆盖 icons、Mini/Web runtime、lineage code 或 lockfile；最新主线已通过 merge parent 纳入。
- 当前 worktree：runtime/wt/icon-parity-1，分支 codex/icon-parity-current-20260904；机器台账在 ignored
  runtime/codex/tasks/icon-parity-current.json。上传前 exact source candidate 为
  5aff4449e0f2ef703b367c846b67a9e51bac04bf；发布后的文档-only 主线 merge 以 Git HEAD 为准。
- 历史关系：8e6a4a32 是旧日历基线；1ffab10c、5285dd17、71110712 的实现进入当前 canonical tree，但最终整合
  采用等价实现而非保留三者祖先关系。三组 required canonical tree-file blob proofs 均 matched=true；旧观察版
  .86@8caa5f20 不作为当前源码。

## 图标与交付结论

- 快速 parity：55 canonical definitions；58 generated Mini SVG；138 production references / 58 unique assets；
  legacy web-* references 0、legacy files 0、unreferenced assets 0；production source files 116。
- 语义/几何/context：matrix 58 entries、13 contexts、14 stateful groups；Web/Mini context bindings 13/10；
  multi-part people 保留 primary/secondary；top user 与 bottom profile 显式区分 context；没有页面私有未授权图标。
- 状态/motion：active/inactive/pressed/disabled 矩阵完整；Web/Mini motion bindings 31/25，emitted bindings 56；
  Mini keyframes 32、orphan 0；active workspace 驱动 bottom loop，离开 active 状态停止，top action 为 one-shot。
- 构建血缘：generator 连跑 deterministic（60 generated outputs）；manifest、实际文件和生产引用双向闭合；
  Web 与 Mini 均从 packages/ui-icons canonical catalog 产生，外部 SVG 的 currentColor/part 限制已由显式 variants/
  adapters 处理。
- 独立 gallery：apps/web/icon-parity.html 无需登录/API；Edge 加载 55 catalog、13 context、44 去重 binding cards；
  stop/start 将 loop/one-shot 从 2/1 变为 0/0 再回 2/1，无 404/console error。

## 血缘、版本、依赖与上传

- 动态 allocator 从 history 与 miniprogram-trial/* immutable tags 取全局序号，实际选择
  0.1.0-p10.20260905.87；没有硬编码下一版本。远端 tag 已绑定
  5aff4449e0f2ef703b367c846b67a9e51bac04bf。
- 上传候选：sourceSha 5aff4449e0f2ef703b367c846b67a9e51bac04bf；description
  exp-icon-004-web-mini-parity-5aff444；profile production；manifestDigest
  7b1acbe671d78fc8c10510407fb8a07107a8e738015fa6b0033a2b0a7b677a9a。
- build profile：buildCommit 5aff444、buildDirty=false、buildVersion .87、buildTime 2026-09-04T18:20:58.65Z；
  receipt uploadedAt 2026-09-04T18:30:17.07Z，reservation idempotent fallback retry；receipt 与远端 tag、候选 SHA
  一致。首尝试被微信 -10008 invalid ip 拒绝，未换版本；复用 exact dist 的 process-level IPv4 fallback 上传成功。
- lineage：最新 .87 tag 是 candidate ancestor；三项历史提交本身不是 ancestor，但 policy canonical tree-file proofs
  对每个 required checkpoint 全部 matched=true，tracked old .86 的等价实现例外 fail closed。trial history
  .74–.87 与 policy required checkpoints 校验通过。
- 官方依赖最终指纹 b392a5b881360c1aa0bac89bfdbd8f45c9e928c9d0a1ab17e6dedbaca0dbc48e；最终 ReuseOnly
  READY_REUSE、installInvoked=false。全轮五个 distinct fingerprints 各一次有效 frozen reconciliation，child
  invocation 9（两次 pre-resolution tripwire、两次 lockfile rejection、五次有效 child），下载 0，tracked tree
  前后 hash 一致；current-message L2 审计已留在 ignored runtime，临时授权文件已清理。
- allowlist：canonical hostname SSH、known_hosts matched、StrictHostKeyChecking=yes；trusted add-only ensure .87
  exit 0、独立 verify exit 0，API/Web 按可信工具重建，MySQL 未重建，短暂 TLS reset/502 后恢复；旧 legacy 与
  unknown=426 已由 trusted verifier 检查，新版本匹配 production capability policy。

## 验证与边界

- 定向契约：Mini icon/workbench/calendar 5 files/45 tests；lineage/CI 2 files/19 tests；lineage equivalence 15/15；
  guardrail Node 18/18；catalog/gallery 2/2；latest-main pool/bootstrap 7/7；skill validator RESULT=PASS；
  pnpm smoke:check-core 通过。
- 完整 pnpm verify 共执行 4 次：一次旧候选在状态文档门禁退出 1；两次成功证据随后因主线/文档合并失效；
  最终 exact source candidate 5aff4449 的 verify 成功 1 次，format/lint/build/typecheck/icon parity、Mini 123
  files/671 tests、Node 22/22、根 Vitest 248 files/37 skipped、1173 passed/364 skipped 全通过。最终日志
  SHA-256 0a54379cc6c662fc4182c3b536f33746b799af69e5fac00b3ff4713c2de9beb4。
- verify 未覆盖的 final Mini gates 均已通过：package total 5,183,732 bytes、main 1,746,568 bytes、
  scheduling 426,045、organization 1,052,545、workflows 833,892、insights 1,072,513、diagnostics 52,169；
  source worklet directives 2；determinism manifest 2a98d3ba8b3ef714439d17034b241d57a7a6a1a561d422d531ba08614bc8d6fa；
  CI dry-run manifest 1f3f8ec24164873a6f92b1b00a3f26454e328e64e714f276719544970f156585；lineage history valid。
  这些 release gates 位于 docs-only merge 后的同一应用树，未重复 verify 已覆盖的 build/typecheck/full suites/root
  tests/format/lint。
- Web 边界：pnpm smoke:browser 曾真实启动 Edge，但 API 127.0.0.1:3000 未运行，停在 /login?redirect=/；独立
  gallery 通过，不因 API 未运行反复管理员 smoke。未调用微信开发者工具 GUI/CLI、模拟器、Console/Network。
- Xiaomi 14：当前工具无法测量，暂未验证；静态 SVG、Node/Vitest、Mini simulate 与 Web gallery 不能替代原生视觉、
  Skyline、帧率、冷启动、内存或真机交互。未提审、未正式发布、未做数据库备份/迁移或无关 production 部署。

## 网络与完成状态

- GitHub：configured HTTPS origin transport，fetch 与普通 push 成功，未使用 fallback。
- WeChat：系统 DNS 返回 Fake-IP 198.18.0.58；普通代理请求被 -10008 拒绝，清除本进程代理并将 servicewechat.com
  绑定到已 TLS 预检的 129.226.106.233 后成功；保留 hostname/SNI/证书校验，未改系统 hosts/VPN/DNS。
- ECS：仅 canonical hostname SSH 用于本消息授权的 allowlist ensure/verify；known_hosts/StrictHostKeyChecking 保持开启，
  未使用 direct-IP fallback。
- 当前批次已完成：最终审计文档、ignored task state、release ledger、普通 push 与 warm lease 释放均已完成；最终
  分支无未推送提交。停止于体验版验证，不提审、不正式发布、不部署 production。
