# Feedback4 发布记录

## 授权与已验证事实

- 2026-09-07用户当次明确授权生产部署与体验版上传，目标为feedback4七项修改。未授权依赖安装或正式提审/发布。
- 初始目标1b493e6ba94752bf4e4f2914bcaa57c67a4294a6；fresh origin/main一致；最新成功体验版为.93@596c20b2，receipt/Manifest存在。
- L4 inspector显式CurrentMessageAuthorizesProduction后PASS；general-3正式Acquire/ReUseOnly/Bootstrap全复用，安装0。
- 完整 `pnpm verify` PASS：Mini889通过/14条件skip；root1183通过/367条件skip；发布候选24项通过，其他format/lint/build/type/icon gates包括在完整verify内。
- SSH使用既有仓库外密钥与canonical正式域名、StrictHostKeyChecking，生产live现场读取为596c20b2/schema54；既有verifier、reuse-release、backup和allowlist四工具SHA与源码一致。
- 当前系统微信域名IPv4不是TUN假地址，TLSv1.3证书验证通过；不改全局代理/DNS/hosts或证书策略。

## 已完成的第一阶段生产发布

- 备份69eaba96-9178-4c0c-b47e-1542da21ab71，98,494,816 bytes；SHA256 6db709f45ad763c099e5a64c1db52ebdca3890c03e6107b953aeaaeae0175420，服务器实际加密文件读取摘要已独立验证。55表；未复制本地数据库或凭据。
- 官方packager三项cache hit，除release元数据外全部manifest字段/应用/控制面哈希相同，调用可信schedule-ecs-reuse-release无停机切换到1b493e6b；前后完整verifier PASS。rollbackCandidate为部署前现场live596c20b2。

## 历史功能等价证明修正

- 真实上传入口在候选预检被required checkpoint 5285dd1拦截；未产生版本分配记录、远端tag或微信上传请求。首次目标尚未上传。
- 原证明工作台blob为0c7ab72b；feedback4的启动提醒使整文件blob变为bbc1aadcd90799d3b96f524abd581064f8ddc365。
- 对旧blob与现源码执行TypeScript AST比较：62个原Page方法保留（onUnload仅前置账号安全dispose），61个顶层函数逐个相同；新增onReady与账号安全data/methods接线，非图标逻辑。5285dd1原改动的handleCalendarNav保持不变，calendarNavAnimating未恢复。
- shared motion.ts与icon-motion-parity.test.mjs的两个既有证明blob完全保留。只更新工作台精确blob和证据说明，不删除required checkpoint、降低门禁或修改业务源码。
- 本检查点message：`fix(release): renew feedback4 workbench lineage proof`。受影响motion/lineage测试与icon parity通过后提交推送，再冻结新SHA；原完整应用验证按相同源码输入复用。
- 唯一下一任务：以修正证明后的干净提交完成生产release对齐及一次体验版上传；下一次生产rollback必须重新从当前live读取，不能继续用596c20b2。
- 日志与frozen身份材料在general-3/runtime/audit/feedback4-release，上传凭据始终在仓库外；微信原生/小米14仍待用户验收。
