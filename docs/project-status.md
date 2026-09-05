# Project Status

当前可接续状态；历史以Git、docs/audit/及精确debug记录为准。

## 当前批次（2026-09-05）

- `WARM-UPLOAD-GUARD-001`；RUN_ID `warm-upload-guard-20260905154545`。
  用户明确授权修复上传工具兼容、测试/文档/独立commit/普通push、新体验上传、add-only allowlist及完整production verifier；
  不安装依赖、不改业务/Web/API/DB/lockfile、不提审/正式发布、不部署ECS/数据库或迁移。
- 应用修复为`cdb759b9d8781dc01749f103d2d30d346689121d`，未改写/amend。
  最新已整合主线`57d11d70c242f36cdd5e3ef055e1e432829d22e2`，保留B0并行工具修复。
- 根因分类`LATENT_COMPATIBILITY_GAP_EXPOSED`：固定目录检查来自76a572a3，项目内warm池来自4602120b；
  .88源码84dc966e到cdb759b9的pool/checker/helper零diff。ef6885d0与d10db9fe未改布局/schema/checker。
- 当前独占`runtime/wt/icon-parity-1`；分支`codex/warm-upload-guard-20260905154545`。
  Acquire/ReuseOnly/Mini bootstrap通过，3 producer复用、安装0；未借用B0租约或依赖。
- 详细根因、行为清单、命令与证据：`docs/audit/warm-upload-guard-20260905154545.md`。
  实时租约/阶段/最终SHA：ignored `runtime/codex/tasks/warm-upload-guard-20260905154545.json`。

## 本轮实现与验证

- 旧PS检查器和发布助手共用候选核心；仅接受正式登记、当前任务拥有、有效有时限上传用途的真实warm子槽位。
  保留/加强路径与链接、Git身份、RUN_ID/token、过期、clean/detached/SHA、依赖健康和专属输出检查。
- 真实CI入口上传前后强制复核同一门禁；既有分配器增加原子操作锁、本地不可变占用及manifest绑定，
  失败版本不重新分给别的源码，不放宽原远端tag/血缘/profile/receipt检查。
- 先红后绿：原helper3红、真实CI门禁2红、路径/过期边界及Git旧版本分配器回归均已复现并转绿。
- Node工具81、root定向25（含allowlist5）、Mini上传工具30，共136项通过；新增真实文件篡改manifest拒绝用例。
  目标lint/JS与PS语法、官方format:check、smoke:check-core通过；未触及Web核心，无需Web浏览器冒烟。
- 仓库Skill validator通过（结构15、Markdown14/108链接、3个PS AST及YAML/ignore）。
  通用Python quick_validate缺PyYAML，未安装，采用仓库完整校验。
- 业务源码tree仍为`f505883d01359db826c7a181009e3b98e7ad22e4`，与cdb759b9完全一致；
  Web/packages/依赖输入也无diff，复用789通过/11条件skip的业务测试，不重复全量。
- 真实PS入口已验证拒绝脏owned warm候选。正向clean/detached/upload用途证明在独立checkpoint形成后执行；
  新版本production构建/source/package/performance/determinism/CI dry-run及上传回执尚待本轮下一阶段完成。

## 独立已完成事实

- B0工具链57d11d70：Acquire/reconciliation同一lease交接修复；general-1健康free，B0租约释放。
  详情`docs/debug/b0-acquire-reconciliation-handoff.md`；本轮不开展其后续B2。
- Skill-only d10db9fe/ef6885d0独立收口保留；本轮未覆盖其CI防护或依赖生命周期修改。
- 先前体验版`.88@84dc966e`成功上传，manifest为bad19c28…；其记录和产物不变，不含cdb759b9应用修复。
- 根工作区原有10组未跟踪内容保留，根目录不作为修改、构建或上传工作区。

## 唯一下一动作与停止条件

- 独立工具checkpoint message：`fix(release): align upload checker with leased worktree layout`。
  完成正常提交、真实正向候选验证与普通push，再在最终main取得新的upload lease；版本动态分配，不预设下一编号。
- 本轮上传授权已齐备，不再次询问。只完成新版本构建、原子占用、精确allowlist/full verifier、CI上传与身份核对，
  然后记录实际回执、普通push必要记录并释放本轮租约。
- SSH只读预检已通过，安装控制面hash与本地一致；观测live release为48488019171924701054354e8f707b08eb4d12fe，
  授权操作前再次实时读取。未执行allowlist修改、应用/数据库部署、备份或迁移；未宣称Xiaomi14真机验收通过。
