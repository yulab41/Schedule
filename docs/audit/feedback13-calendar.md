# Feedback13 日历四项回归修复

## 根因与行为变化

1. 配置简称不同步：API自528722f4起只用当前配置覆盖快照颜色，未覆盖简称；Mini自6ba2c72c起又将全天班硬编码为“全”。e94a54ca的分组/月历快照展示暴露混用。现用稳定班种ID覆盖只读日历响应的简称，删除配置时保留历史回退；去掉前端硬编码。医生/护士共用查询路径，不改任何历史排班行或班次时间。从配置页返回原onShow继续forceRefresh，无另加配置请求。
2. 月历隐藏全天班标识：按isAllDay识别，隐藏badge，不隐藏人员、剩余人数或变更标记；不按名称猜测，非全天的电脑/D班保持原标识。周历/详情/列表仍显示配置简称。
3. 周历底部圆角碰撞：原weekday上下padding仅4px，实测高度只加8px；最高列的班种框进入外框圆角。现下padding24px，实测加入上4+下24=28px，估算同步增加20px；七列仍按最高内容展开及页面纵向滚动。
4. 点击高度抖动：e94a54ca的createViewPatch每次选择都覆盖为估算值，再异步覆盖为实测值。现以周面板实际内容（班种标识、姓名、标记、节假日）为签名，内容未变保留实测高度；只在内容、页面/宽度变化时重新测量。空或零高度测量不折叠页面，迟到结果保留原序列/可见性检查。

## 验证

- API简称回归RED1失败/1通过，修复后全calendar隔离MySQL36通过；直接验证数据库快照与时间未变化、已删配置回退。Mini简称/月历RED4失败/1通过→定向53通过。
- 点击/底部回归RED失败，空测量再RED失败；修复后workbench-runtime/feedback12/calendar-period联合58通过，新测量断言通过。无微信原生测量工具使用。
- 390×844与320px生产CSS/ViewModel几何通过，最高列底边距24px、无横向溢出或周内容裁切；脚本apps/miniprogram/scripts/feedback13-layout.mjs。真实样张包含合成多人和长姓名；原截图仅作用户症状证据，不提交包含电话的截图。
- 运行/浏览器验证：pnpm smoke:browser（等价node入口，本地API3105/Web4175、canonical本地env内存适配）完整登录/管理员/成员/访客/访问记录通过；local-admin测试标记恢复，自建进程停止。
- 全量Mini1170通过/15跳过；其他联合验证结果见收口补充。源Worklet、包体与构建另做最终核验；以上均非小米14体验版验收。
- 工作台AST与前一blob核对，仅onResize/onShow/scheduleWeekMeasurement/createViewPatch/resetCalendarContext改变；保护的导航、swiper、定位、图标动效函数未变。更新精确blob证明，未删除required checkpoints。证据ignored runtime/audit/feedback13。

## 交付边界

基线3864b275，general-4/5独占复用，无安装、新依赖或迁移。代码检查点fix(calendar): sync abbreviations and stabilize week layout。实施阶段未连接生产。随后用户明确批准部署、上传及追加放行，已交付累计110/8f441d2d，含五类独立授权入口；证据见[feedback13-release.md](feedback13-release.md)。原二维码/导出真机待复核状态继续保留。

## 最终联合验证

pnpm verify完整通过：format/lint/build/typecheck/icon parity、Mini1170通过/15跳过、根1251通过/436跳过、依赖保护81通过。随后仅将高度回归参数化为普通周与2026-08-31跨月周，两例定向均通过，应用源码未变；最终Mini verify/Worklet2/2及包体通过。既有主包内部1.5M与matrix节点提示保留。完整本地浏览器及独立MySQL36的证据不替代真机。
