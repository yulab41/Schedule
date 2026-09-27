# 日历姓名左对齐微调（2026-09-27）

## 范围与引入点

用户澄清：三字＋标识只用于统一倍率的宽度基准，所有实际组合仍左对齐；二字、三字无标识等不要求左右等距。沿用本会话“修改后直接上传并放行”的授权，交付范围为新体验版及 add-only allowlist，不涉及新的 API/Web 应用部署、数据库备份/迁移或正式发布。

最新基线 `d22cf2c9`，上一体验版 `.206@151c9753`。独占 `runtime/wt/general-6`，按 Acquire → ReuseOnly → Bootstrap → Targeted test 执行，依赖指纹 `53681b41817f58032e808840921c1b7b3d108929781e602f330b04534006e2d6`，未安装依赖。`git log -S 'is-centered'` 和 `git blame` 确认居中规则由 `17598dc8` 引入。

`MINI-CALENDAR-LEFT-007`：P2、高置信、显示规则偏差。共用月历单元格的两个姓名行带 `is-centered`，使短组合偏离左边缘。修复仅删除两个居中类、共用姓名行显式使用 `justify-content: flex-start`。风险低，可通过几何断言复核。

## 行为变化与覆盖

- 首页、访客月历通过 calendar-month 复用 calendar-cell；手排生成/草稿/发布预览通过 schedule-calendar-preview 复用相同月历；补录月历同样复用。普通与紧凑分支均已检查。
- 姓名和随行标识统一从左侧安全边距开始，只有三字＋标识基准组合填满可用宽度时才自然达到左右等距；保留字体上限。无标识、二字等组合不再整体居中或独立放大。
- App 全局屏宽/布局缓存、容器各自倍率、标识视觉中心、长姓名 3em 省略、人数汇总、预览新增/移除/已有状态不变。周历仍姓名一行、标识下一行，列表继续左对齐。未修改 TypeScript、事件、业务数据或计算调用次数。
- 现有分段动效与切换优化保持原样；没有引入 selector query、逐格测量、额外 setData 或依赖。

## 验证记录

证据位于 ignored `runtime/audit/calendar-left-align-20260927/`。使用匿名姓名，不写生产排班数据。

- 基线定向 11/11；`pnpm --filter @schedule/miniprogram verify` 7.92 秒、通过，主包 1,624,907 B、总包 4,334,457 B，Manifest `c7d001a4ca5f9e6a3d883684cc4d8914eb45e91f7f865cb06840cb9d7e01d2d8`。这是构建耗时，不是真机切换耗时。
- 测试先行：修正测试正则语法后，旧实现 2 失败/7 通过；320px 月格“短名＋标识”左偏移 4.34375px，违反左对齐断言。代码修正后定向 63/63 通过（calendar-name-fit/layout/geometry、calendar-simulate、workbench、guest-runtime）。
- 几何测试直接读取真实模板行类名和 CSS，覆盖 320/360/390/393px、首页/预览/补录/紧凑月历、两套周历、列表、二/三字有无标识、长中文/英文、N/NP、多标识与人数汇总。断言所有组合左起点一致，仅三字＋标识要求左右等距；真实容器宽度另覆盖 768px 上限。393px 未核实为小米14实际逻辑宽度。
- 根 lint/typecheck、任务测试文件格式、图标与 smoke:check-core 通过。全仓 format:check 仍仅五个未改文件的既有失败（预览 model、补录 index.ts、contracts/past-schedules、presentation-core/past-schedule-backfill 及其测试），不处理无关格式、不宣称根 verify 通过。无 Web 核心改动，不触发 smoke:browser。
- `SCHEDULE_CALENDAR_FIT_GEOMETRY=1 pnpm --filter @schedule/miniprogram test`：188文件通过/2跳过，1,288通过/18跳过；154.73秒。最终 Mini verify（类型/源码/构建/确定性/包体）、CI dry-run、血缘审计通过，主包1,624,850 B、总包4,334,400 B，Manifest `fef3523ff41fb4f5851162f407f34839666b392ed7ee8d344e5724f39b8469c2`。原有主包1.5MB内部预警与手排矩阵1510节点提示保留。
- Agent操作开发者工具：清编译缓存后打开首页与手排，注入匿名二/三字有无标识及预览状态，首页月历、紧凑预览弹窗截图已查看；短姓名从左边缘开始，标识随姓名排列。两次导航后首次自动化连接均超时，各一次重连成功，无业务写入。截图尺寸较小，仅辅助观察，精确边距由上述真实CSS几何断言验证。访客有效链接与真实排班未操作，小米14体验版效果暂未验证。

## 检查点与停止条件

应用检查点消息：`fix(miniprogram): left-align calendar names at shared scale`。最终验证和交付身份在完成后补记。当前唯一下一任务：完成本轮验证、上传和只增放行，随后等待同版本/SHA小米14复核；不得把自动化或开发者工具证据记为真机验收。
