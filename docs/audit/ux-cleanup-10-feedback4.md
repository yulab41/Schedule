# UX-CLEANUP-10 feedback4

## 授权与基线

- 用户批准七项Mini微调；不授权依赖安装、生产连接或体验版上传。规划基线与远端main均为596c20b2。
- 模式REUSE_ONLY；general-3租约用于feedback4-root。其他组POOL_BUSY，顺序交接同一健康槽，安装0、新建冷槽0。
- 读取Schedule guardrails、miniprogram-development、systematic-debugging、frontend-design及相关UI知识。成功使用shell/Git/Node/Edge布局代理；微信DevTools执行面因仓库政策禁用。
- 截图只作问题报告；短SHA/renderer/基础库/微信版本不齐，不能写当前小米14已验收。

## 发现与行为变化

| ID    | 级别 | 问题与原因                                                 | 修复、风险、验证                                                                                                                                                    |
| ----- | ---- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F4-01 | P2   | 未绑定登录进入choice/password/register旧步骤；e69cfb76引入 | 改直接账号密码sheet，删除自主建档和无引用样式；普通登录和admin-bind保留。需求变化，回归覆盖取消/过期/错密/网络/重复提交。                                           |
| F4-02 | P2   | be878a57将初始密码检查放在懒加载profile                    | 改工作台onReady轻量共享sheet，App冷启动按账号去重，存储失败明确提示；GET失败不猜测状态，改密proof/重登保持。中等生命周期风险，独立bundle共享App状态及迟到响应测试。 |
| F4-03 | P2   | a50b423b按钮缺显式flex居中、sm字号                         | 复用原表单并统一md字号、48px最小高度；390/320和大字号浏览器几何通过，实体机待复核。                                                                                 |
| F4-04 | P3   | ee6f9cb8旧tab顺序与用户要求不同                            | 统计左、事件右，保留statistics默认与数据口径；静态顺序/控制器回归。                                                                                                 |
| F4-05 | P3   | 4e5cb461为today+selected加入near-black圈                   | 仅改同色黄色token，周末/禁用语义不变；原日期状态合同及增量断言通过。                                                                                                |
| F4-06 | P2   | 通知保存使用常驻info alert                                 | 待实施共享ui-toast及两秒寿命；需覆盖direct Page生命周期。                                                                                                           |
| F4-07 | P2   | 偏好默认true不是授权；异步gate在微信调用之前；fail吞错误码 | 待实施明确订阅入口、同步能力快照校验、直接wx调用和错误分类；不改变API默认或建设回调服务器。                                                                         |

引入点使用git log -S与blame核实。状态机与UI改动按需求变化记录，不称纯重构。密码接收者绑定保留，新增卸载/账号变化的迟到响应保护；请求协议、proof和错误验证保持。

## 验证与体积

- `pnpm --filter @schedule/miniprogram verify`基线PASS，8.16s，主包1,689,058/总包5,051,234 bytes。主包1.5MB内部预警和两矩阵节点1445/1506警告已有，不是新增原生性能结论。
- 基线身份/profile定向24通过/12布局条件skip，ESLint通过。新增identity/security/UI回归均已记录red后green。
- 1–5检查点：47项定向PASS（identity、account-security、profile、workspace、build-tools、日期），ESLint/typecheck/verify/icon parity PASS。
- Edge布局代理16项PASS，390×844/320px、大字号、登录及按钮几何；输出canonical runtime/codex/feedback4/profile-layout。修正代理中motion import先于page override的顺序，产品筛选图标代码未改。
- 中途Mini全集：862通过、1旧共享模板路径断言失败、14条件skip；随后修正测试路径并定向通过。6–7完成后跑最终全集。
- 独立组件方案曾增20,241 bytes；改为工作台直接模板与共享控制器并排除无用途独立module输出后，当前主包1,692,724/总包5,054,896。净增3,662 bytes，不声称净减包。
- 命令、实际日志/包摘要位于general-3/runtime/audit/feedback4，均ignored。原生Console/Network/冷启动性能当前工具无法测量，暂未验证。

## 检查点与下一步

- 首检查点message：`fix(miniprogram): streamline identity and launch password reminder`。
- 唯一下一任务6–7通知实施，完成后整批验证并推送；无体验上传/生产部署。最终状态UPLOAD_REQUIRED，真机验收需新构建对应证据。
