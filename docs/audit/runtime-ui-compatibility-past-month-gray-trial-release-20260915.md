# 月视图已过日期灰底体验版 140 交付

## 交付结论

- 体验版：`0.1.0-p10.20260915.140`
- 应用 SHA：`c6cbb6a6009d353f2e754f7656f589ae2a7f9c3a`
- 实现检查点：`c6cbb6a fix(miniprogram): restore past-day gray in home and guest month views`
- 累积基线：`a9c3204f`（`.139` 访客周视图分页；本候选在其记录提交 `3c8ea88d` 之上线性叠加）
- 上传说明：`Skyline past-day month gray c6cbb6a`
- 构建档位：`production/clean`
- 上传 Manifest：`7ae7c6230e4423d05fd4e0ed0f9f68709146dc7b9ad2708b9c5314acbc9044db`
- 构建时间 `2026-09-15T14:53:38.332Z`、分配时间 `2026-09-15T14:53:52.740Z`、
  上传时间 `2026-09-15T14:54:42.368Z`；241 个代码文件，上传 ZIP 2,641,790 字节。

远端不可变 tag `miniprogram-trial/0.1.0-p10.20260915.140`、allocation、Manifest 与 receipt
均绑定同一版本、SHA、说明与 Manifest。本轮只上传小程序并通过可信控制追加允许版本；未提交审核、
未正式发布、未退役旧版本，也未部署新的 API/Web 应用制品、执行数据库备份、迁移或业务数据写入。

## 血缘与并发处理

实现检查点最初以 `.138` 记录 `d56ecba2` 为基线。上传前按动态发布身份重新读取：最新累积体验版为
`.139@a9c3204f`，其记录提交为 `3c8ea88d`。上载体在独占 warm 槽
`codex/runtime-3172-past-month-gray-upload-20260915` 中把同样的 5 个源码文件与 2 个测试文件
线性叠加到 `3c8ea88d` 之上：不改写并行会话分支、不创建合并提交、不触碰对方租约。
叠加后 7 个文件与实现检查点逐字节一致（`git diff 3a9ccca9 -- <paths>` 为空）。

## 变更范围与门禁

- 月视图唯一复用链路补齐一个状态与一条样式：`createMonthCells` 产出
  `isPast: !cell.isOutsideMonth && cell.businessDate < today`，`calendar-month` 转发
  `is-past`，`calendar-cell` 新增属性、`is-past` 类与 `.calendar-cell.is-past { background: #f3f4f6; }`。
- 灰底规则位于 `.is-pressed` 之前以保留按压反馈；`.is-holiday` 粉底、今天/未来、月外格、
  选中框与 setData 语义不变；访客页复用同一模型与组件，零额外改动。
- 门禁：`.139` 基线叠加后定向 49 项通过（workbench / calendar-simulate / guest-runtime），
  Mini 完整 174 文件 1210 项通过、16 项跳过，`determinism.mjs` 通过
  （Manifest `7ad20976…4dfb82c9`），typecheck、production build（366 文件）、source audit、
  package audit、format、lint、`smoke:check-core` 与 agent-context 文档预算通过。
  主包 1,741,761 B（`.139` 为 1,741,484 B，+277 B）。Mini verify 仍只被未修改的手排节点预算
  `1507 > 1506` 阻断，本轮未放宽该预算。
- 候选门禁：`prepare-release-worktree.mjs --purpose upload` 后，
  `check-worktree-safety.ps1 -RequireReady` 与
  `-ForMiniprogramUpload -MiniProgramVersion 0.1.0-p10.20260915.140` 均 `RESULT=PASS`
  （ready-clean-detached、production-clean、VERSION_LOCAL=absent）。

## 放行与公网验证

L4 预检：双 DoH 一致、TLS/SNI 直接健康探测、严格 SSH 主机密钥与显式身份通过。可信
`schedule-client-version-allowlist ensure 0.1.0-p10.20260915.140` 只追加 `.140`
（`已追加 1 个版本并通过健康与策略验证`），保留 `.136/.137/.138/.139`；allowlist verifier 与完整
`/usr/local/lib/schedule/ecs-verify.sh` 通过，实时读取的生产 live release 仍为
`44034fcc342b7ac9994b8222022c64118d276df9`。激活期间 API/Web 容器按控制面流程重建，出现短暂
502 后由健康等待恢复。公网探针：`.140/.139/.138/.137/.136 = 200`、动态未知版本 `= 426`。

## 验收边界

上传、放行和自动验证不等于真机验收。唯一下一任务：在小米 14 上用 3.17.2 与 3.17.3 两个实例复核
`.140@c6cbb6a`：首页日历与访客页面月视图的已过日期单元格是否为浅灰，今天/未来、假期粉底、
选中框与按压反馈是否不变；同时确认 `.139` 的访客周视图分页与 `.138` 的页头箭头/选择器无回归。
