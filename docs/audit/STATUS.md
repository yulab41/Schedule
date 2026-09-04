# 微信小程序审计状态

## 当前阶段

- 当前批次：用户已明确授权 dependency-guard 前置批次及 `EXP-ICON-004-B2`。图标血缘 checkpoint 为
  `24ea709e`；最新主线 guardrail 整合 checkpoint 为 `bce96ce8`，正在形成最终状态文档 checkpoint。
- 独立 worktree：`runtime/external-project-worktrees/exp-icon-004-lineage-b12-20260903`；分支
  `codex/exp-icon-004-lineage-b12-20260903`。B2 起点已含当时最新 `75cc0d3b`；验证期间前进的
  `origin/main=765b5c09` 已作为 `bce96ce8` 第二父提交合入。
- 图标 merge 的三个冲突只在状态/debug 文档；最新主线 merge 的三个冲突只在 dependency reference、release
  helper 和项目状态。全部按“当前状态 + 原始历史 + 官方 guardrail 单一来源”解析，生产图标代码无冲突。
- 两次普通 push 曾被 GitHub Schannel TLS 握手失败阻断；远端现已恢复。验证期间前进的
  `origin/main@765b5c09` 已合入；主线只触及 guardrail/文档/工具，对图标运行时范围改动数为 0。
  官方实现已取代 `d62f780c` 的临时重复脚本，最终树只有一个 dependency source。
- 本轮不创建真实 trial tag、不上传体验版、不操作 allowlist、不提审、不正式发布、不连接或部署 production。

## EXP-ICON-004 已验证事实

- 用户所见 `.84@8e6a4a3` 不包含 `.83@5285dd1` 的 `1ffab10c`/`5285dd17` 图标提交；`.85@a1bba57`
  也沿主线前进但仍不含该图标分支。因此“版本号更新但旧改动缺失”是已确认的 Git 血缘回退，不是真机缓存猜测。
- B1 `c027abcd` 已增加 `.74–.85` 历史、fresh main/latest trial/required checkpoint ancestor、clean exact build、
  不可变远端 tag 和 receipt 门禁；未来候选必须动态选择大于 85 的未占用版本并包含 `5285dd17`。
- B2 恢复 `packages/ui-icons` 单一来源：Web 真实 path/TDesign 已核对 path、来源元数据、共享 motion specification；
  Web 使用 `SharedIcon`/`SharedIconPart`，Mini 由生成器输出 `ui-*.svg` 和 part 资产，颜色取自 `ui-tokens`。
- 原 B1 删除 26 个已确认无引用的 `web-*.svg`，并迁移底部/顶部/更多/通讯录/日历/工作流/身份等入口；原
  B1.1 又删除日历 Web 不存在的 420ms 点击弹跳，加入 secondary 资产，并把通讯录人员线宽/未选中色对齐为
  `1.8/#586678`。Mini 外链 SVG 无法直接控制内部 path，日历 draw 仍是 opacity 兼容层，需真机确认观感。
- `5285dd17` 不是最终 B1.2：底部 5 项的 23px/双色/active-only motion、顶部 user 几何与尺寸、filter stroke、
  locate/more context 及 motion codegen 等剩余差异仍留给 B3，不能把本次血缘恢复写成全量视觉验收通过。

## 依赖守卫与验证

- 旧 release marker 由 `0d971de1` 引入，只检查 source hash 和 `node_modules` 目录。主线抵达前的临时 checker 覆盖 dependency
  sources、Node/pnpm、OS/架构、pnpm layout、store path、pnpm metadata、direct dependency 和 workspace link；
  read-only `check` 与 explicit `install-if-needed` 分离，release-worktree 复用同一核心。
- checker 先因实现模块不存在红灯，随后 dependency/release-worktree `18/18`、Node syntax、ESLint、Prettier、
  项目 Skill validator 和 diff check 通过。真实入口为 `MISS / marker-missing / HEALTH=PASS`（exit 2），检查前后
  marker 均不存在，证明没有提前安装或写入。
- 通用 Skill `quick_validate.py` 因本机 Python 缺 `PyYAML` 无法启动；没有擅自安装额外依赖，仓库专用 validator
  已通过。
- B2 前基线：Mini 5 files/55 tests 与 production verify/package 通过，total/main=
  `5,151,893/1,715,719 B`；定向补齐现有 producer dist 后 Web build 以 4,242 modules、36,900ms 通过，只有
  既有 chunk warning。
- 最终依赖图先返回缺两个 workspace link 的 MISS；一次授权 frozen install 后 MATCH，0 新下载、1.6s、无 tracked
  副作用。当前 Mini 定向 63、Web/token 39、tooling 18、Mini 全量 663 tests 均通过；Web build 4,249 modules/
  17.42s，Mini 全门禁 302 files、total/main `5,169,730/1,731,703 B`。
- `pnpm verify` format/lint/build/typecheck 全绿，Mini 122/663、根 247 files passed/37 skipped、
  1,178 passed/364 skipped。`smoke:check-core` 通过；浏览器 smoke 因本地 API 3000 未运行停在登录页，不构成
  浏览器或 Xiaomi 14 验收。
- 官方 `ReuseOnly -AdoptHealthyExisting` 及再次 `ReuseOnly` 均为 READY_REUSE、依赖复用 true、安装 false；
  Node guard 13/13、Vitest 17/17、Skill validator、Node syntax、仓库 format 和 diff check 通过。一次错误的
  Vitest runner 调用和主线测试文件格式不匹配均已按正确 runner/机械格式修正，没有产品行为变化。

## 保留的 MINI-G1-004 事实

- G1-004 结论仍为“证据不足，保留 P3”；`.85@a1bba57` 已上传并放行但不含图标分支，只用于既有人工补证。
- 其唯一待办仍是用户在匹配 `.85` 的 Xiaomi 14 上抄录测试工具环境，并完成 platform accounts/group settings
  的只读首屏与滚动反馈；不改变本轮 B2 停止条件。

## 唯一下一任务与停止条件

- 唯一下一任务：创建 `docs(audit): record EXP-ICON-004 B2 integration` checkpoint 并普通推送调查分支；
  `bce96ce8` 已验证 main/B1/B1.1/B1-lineage ancestry 全部成立。
- 推送成功即停止；不进入 B3、L3 上传、Hook 审核/重启或 L4 服务器操作。
