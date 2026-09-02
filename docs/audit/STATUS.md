# 微信小程序审计状态

- 当前阶段：`MINI-G1-003：P2，逻辑层性能问题已确认并修复；真机可见卡顿未直接确认。`
- 起始主线：`origin/main@a4f50c0207ccb67f5ccdc78dd3912ba248fec9af`
- 修复分支/worktree：`codex/fix-mini-g1-003-scheduling-input` /
  `runtime/external-project-worktrees/mini-g1-003-scheduling-input-20260902`
- checkpoint 识别信息：`fix(miniprogram): localize scheduling rotation input updates`
- 范围：只改 scheduling-config 轮转标量输入的局部更新、现有 controller 永久测试和四份连续性文档；
  `MINI-G1-001/002` 既有结论保留，`MINI-G1-004`、XMB、test-tools、班种输入、API、数据库、权限、
  路由、视觉和排班规则未改
- 外部状态：未调用微信开发者工具 GUI/CLI，未上传体验版、未提审/发布，未部署 production 或创建
  生产备份，未修改或清理用户主工作区和其他 worktree

## 根因、依赖与永久红灯

- 两个数字 `bindinput`（每天需要人数、当前位置）及起始日期 `bindchange` 进入
  `handleRotationInput`。数字字段只影响 `_rotationDrafts`、目标卡片显示和最终
  `updateRotationRule` payload；不影响成员归属、岗位/成员排序、卡片数量或 picker 成员列表。
- 成员选择和上移/下移确实改变成员状态/顺序，继续走 `createRoleCards`；默认班种/起始成员 picker 和
  班种文本输入不在本轮每字符岗位×成员问题范围。
- `git log -S`/blame 定位引入点为 `38233039`：P8 初始实现让标量输入复用 `createRoleCards`，因而每次
  遍历全部岗位、复制/排序每岗全部群组成员并完整 `setData({ roleCards })`。
- 永久合同扩展
  `apps/miniprogram/scripts/p8-organization-c2-controller.test.mjs`。夹具名称修正后、未改业务源码时纯净
  3 项红；既有读取、角色创建和“成员选择需要重建”3 项保持绿，环境/夹具错误不计红灯。

| 同一单字符输入 | 4 岗位×2 人 | 4 岗位×100 人 | 增长关系 |
| -------------- | ----------: | ------------: | -------- |
| setData 次数   |           1 |             1 | 0        |
| patch 键       | `roleCards` |   `roleCards` | 完整数组 |
| payload        |      2,476B |       53,364B | +50,888B |
| 排序次数       |           4 |             4 | 每岗一次 |
| role card 重建 |           4 |             4 | 全部岗位 |
| 成员视图复制   |           8 |           400 | +392     |

历史临时探针的 56,171B 来自另一 fixture，只保留为量级参考；永久合同固定行为和增长关系，不绑定该历史
字节数。桌面逻辑耗时与真机 bridge/渲染不是同一指标。

## 最小修复与正确性

- 输入仍先用原 `toPositiveInt` 更新逻辑层 `_rotationDrafts`，随后按事件的稳定 `roleId` 查当前数组索引，
  只发送 `roleCards[index].requiredMembersPerDay/currentPosition/startDate`。岗位缺失或未知字段保留旧全量
  回退；没有 debounce、延迟显示、全局缓存或数据模型改造。
- 修复后 4×2 与 4×100 都是 1 次 `setData`、41B 精确路径 patch；排序、role card 重建、成员数组复制、
  member view 重建及规模增长均为 0。成员关系变化仍完整重建并正确更新选择。
- 连续输入立即以最后值显示；空串/非法值仍立即归一为 1，前导零仍按 `parseInt`；没有新增失焦提交；
  原校验提示不被输入清除；保存使用最后草稿。测试先重排卡片再按 `role-3` 输入，证明按稳定 ID 更新，
  其他岗位和成员数据不变。
- receiver、Promise/catch、空值、权限/capability、版本/幂等、API、路由、视觉和业务写次数均不变。

## 最终候选验证

| 层级                          | 结果                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------- |
| 永久性能/正确性合同           | controller 6/6 通过；原实现纯净目标合同 3 项红                                  |
| scheduling-config 相关        | 16 files / 75 tests 通过                                                        |
| 标准 Mini 全量                | 113 files / 612 tests / 0 failure；标准命令自动发现扩展测试                     |
| TypeScript / production build | 通过；276 files                                                                 |
| `miniprogram:verify`          | 通过；main 1,677,998B、total 5,121,615B、Worklet 2/2、matrix 1445/1506          |
| 包体前后                      | total +179B、organization +180B；main -1B 为元数据噪声；无依赖或新 warning 类别 |
| 收口门禁                      | 任务文件 Prettier/ESLint、diff、状态策略 3/3、`smoke:check-core` 全部通过       |

verify 只有既有主包 1.5MiB 与 matrix 1445/1506 三项 warning。自动化能证明冗余计算和数据传输消失；
微信原生 bridge、帧率与小米 14 可见卡顿当前工具无法测量，暂未验证，不据此要求用户复现或新增 test-tools。

## 主线整合与停止条件

在最终文档 tip 完成用户指定全量门禁后再次 fetch：若 `origin/main` 漂移，语义整合并重跑受影响测试、
Mini 全量、verify、状态策略和 core smoke。修复分支可先普通推送；main 只做一次最终普通 fast-forward，
不 force push。核对远端分支/main SHA、工作树 clean、无未推送提交后停止。

唯一下一候选可记录为 `MINI-G1-004`，本轮不执行；不上传体验版，不部署 production。
