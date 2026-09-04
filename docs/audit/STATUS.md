# 微信小程序审计状态

## 当前阶段

- 当前批次：用户已明确授权 dependency-guard 前置批次及 `EXP-ICON-004-B2`。tooling checkpoint
  `d62f780c` 已本地提交；`5285dd17`（包含 `1ffab10c`）的原始图标血缘已无生产冲突合入并完成验证，准备以
  `merge: restore EXP-ICON-004 shared icon lineage` 创建 merge checkpoint。
- 独立 worktree：`runtime/external-project-worktrees/exp-icon-004-lineage-b12-20260903`；分支
  `codex/exp-icon-004-lineage-b12-20260903`。执行时最新 `origin/main=75cc0d3b` 已是当前分支祖先。
- 三个 merge conflict 仅位于本状态文档、`docs/project-status.md` 和 debug 历史；解析原则是保留当前 B1/依赖守卫
  状态，并把 B1/B1.1 图标证据作为历史追加，禁止旧分支的“下一任务”覆盖当前批次。
- 两次普通 push 曾被 GitHub Schannel TLS 握手失败阻断；远端现已恢复。验证期间 `origin/main` 又前进至
  `fa10d5ba`，其中已有项目官方完整依赖守卫；B2 merge 后必须再合入该主线，以官方实现取代 `d62f780c` 的临时
  重复脚本，再统一普通推送。
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

- 旧 release marker 由 `0d971de1` 引入，只检查 source hash 和 `node_modules` 目录。新 checker 覆盖 dependency
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

## 保留的 MINI-G1-004 事实

- G1-004 结论仍为“证据不足，保留 P3”；`.85@a1bba57` 已上传并放行但不含图标分支，只用于既有人工补证。
- 其唯一待办仍是用户在匹配 `.85` 的 Xiaomi 14 上抄录测试工具环境，并完成 platform accounts/group settings
  的只读首屏与滚动反馈；不改变本轮 B2 停止条件。

## 唯一下一任务与停止条件

- 唯一下一任务：创建已验证 B2 merge checkpoint，随后合入最新 `origin/main@fa10d5ba`；冲突处保留官方
  dependency lifecycle，删除临时重复 checker，并用官方 `ReuseOnly` 健康检查复核，绝不再次安装。
- 主线整合与受影响工具测试通过后更新状态并普通推送。推送成功即停止；不进入 B3、L3 上传或 L4 服务器操作。
