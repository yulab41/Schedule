<script setup lang="ts">
withDefaults(defineProps<{ readonly largeText?: boolean }>(), { largeText: false });

const versionRows = [
  ['正常', 'Git 短 SHA', 'abc1234', '代码身份证；不同 SHA 的截图不能用于本轮判断。'],
  ['正常', '构建时间', '2026-08-31T00:00:00.000Z', '帮助排除旧缓存或旧体验版。'],
  ['需留意', '脏工作树构建', '是', '需要额外核对构建来源。'],
];

const checks = [
  '顶部导航或胶囊遮挡',
  '底部安全区异常',
  '意外换行、截断或横向溢出',
  '返回状态丢失或切换卡顿',
];
</script>

<template>
  <main class="test-tools-golden" :class="{ 'is-large-text': largeText }">
    <header class="tool-header">
      <button aria-label="返回更多" type="button">‹</button>
      <div><span>安全诊断 · 只读</span><strong>测试工具</strong></div>
      <button type="button">刷新</button>
    </header>

    <section class="build-strip">
      <div class="build-meta"><i></i><span>体验版 trial</span><em>内存有界 · 已脱敏</em></div>
      <code>0.1.0-test@abc1234</code>
      <p>先截这一区域。它用来确认手机截图对应哪一版代码。</p>
    </section>

    <aside class="safety-note">
      本页不会显示或复制账号、姓名、手机号、群组成员、凭证、请求正文或原始堆栈。<br />
      微信开发者工具和视觉黄金只能辅助检查；最终以小米 14 体验版为准。
    </aside>

    <section class="tool-section">
      <div class="section-title"><span>01</span><strong>当前版本</strong></div>
      <p>是否正常：SHA、环境和构建时间应与本轮说明一致。</p>
      <div class="card">
        <article v-for="row in versionRows" :key="row[1]">
          <div>
            <b :class="row[0] === '正常' ? 'good' : 'notice'">{{ row[0] }}</b
            ><span>{{ row[1] }}</span>
          </div>
          <code>{{ row[2] }}</code>
          <p>可能影响：{{ row[3] }}</p>
          <small>应截图：截本卡片。</small>
        </article>
      </div>
    </section>

    <section class="tool-section">
      <div class="section-title"><span>02</span><strong>手机与微信环境</strong></div>
      <p>是否正常：能读取到的字段用于定位机型差异。</p>
      <div class="card environment-grid">
        <article>
          <div><b class="good">正常</b><span>设备</span></div>
          <code>Xiaomi / Xiaomi 14</code>
          <p>可能影响：用于判断问题是否只出现在某类手机。</p>
          <small>应截图：截整张卡片。</small>
        </article>
        <article>
          <div><b class="good">正常</b><span>屏幕 / 窗口</span></div>
          <code>390×844 / 390×820</code>
          <p>可能影响：决定长页和弹窗的可用空间。</p>
          <small>应截图：截本卡片。</small>
        </article>
        <article>
          <div><b class="good">正常</b><span>安全区域</span></div>
          <code>上 24 / 右 390 / 下 840 / 左 0</code>
          <p>可能影响：按钮可能被状态栏或手势区遮挡。</p>
          <small>应截图：截顶部和页面最底部。</small>
        </article>
      </div>
    </section>

    <section class="tool-section">
      <div class="section-title"><span>03</span><strong>页面显示检查</strong></div>
      <p>勾选代表发现异常；没有异常时点“全部正常”。</p>
      <div class="check-summary">尚未检查</div>
      <div class="card check-card">
        <label v-for="item in checks" :key="item"
          ><input type="checkbox" /><span>{{ item }}</span
          ><small>可能影响：对应页面可能无法完整阅读或操作。</small
          ><small>应截图：截异常区域和屏幕边缘。</small></label
        >
        <div class="actions">
          <button type="button">全部正常</button
          ><button class="danger" type="button">发现异常</button>
        </div>
      </div>
    </section>

    <section class="tool-section">
      <div class="section-title"><span>04</span><strong>关键测试场景</strong></div>
      <p>每项先按路径操作，再标记正常或异常；异常时按指定位置截图。</p>
      <div class="card scenario-preview">
        <article>
          <div><strong>首页与日历</strong><b class="pending">未测试</b></div>
          <p>点击路径：工作台 → 日历</p>
          <p>观察：首次显示、月/周/列表切换、日期详情和错误态。</p>
          <small>应截图：截完整日历和异常状态。</small>
        </article>
      </div>
    </section>

    <section class="tool-section">
      <div class="section-title"><span>05</span><strong>性能信息</strong></div>
      <p>这些是少量单次辅助值，不是手机端性能验收结论。</p>
      <div class="metric-lead"><span>测试工具首屏</span><strong>186 ms</strong></div>
    </section>

    <section class="tool-section">
      <div class="section-title"><span>06</span><strong>网络诊断</strong></div>
      <p>当前网络：wifi。只保留脱敏路径、耗时、状态和重试次数。</p>
      <div class="card request-card">
        <article>
          <div><b class="method">GET</b><code>/api/groups/:value/calendar</code></div>
          <p>成功 · HTTP 200 · 88 ms · 重试 1 · 重复 否</p>
          <small>是否正常：正常；请求已完成。</small
          ><small>应截图：截本条记录和发生问题的业务页面。</small>
        </article>
      </div>
    </section>

    <section class="report-card">
      <span>一次复制 · 稳定结构</span><strong>生成安全测试报告</strong>
      <p>报告不包含业务正文、身份信息或原始错误内容。</p>
      <button type="button">复制完整诊断报告</button
      ><button type="button">复制给 Codex 的简化报告</button>
    </section>
  </main>
</template>

<style scoped>
.test-tools-golden {
  min-height: 100vh;
  padding: 0 16px 32px;
  box-sizing: border-box;
  background: #f4f7fb;
  color: #152734;
  font-family: Inter, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  overflow-x: hidden;
}
.tool-header {
  min-height: 72px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.tool-header button {
  min-width: 44px;
  min-height: 44px;
  border: 0;
  border-radius: 14px;
  background: #fff;
  color: #176a99;
  box-shadow: 0 4px 12px rgba(31, 74, 104, 0.08);
  font-weight: 700;
}
.tool-header button:first-child {
  font-size: 28px;
}
.tool-header div {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.tool-header span,
.report-card > span {
  color: #176a99;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
}
.tool-header strong {
  font-size: 23px;
}
.build-strip {
  position: relative;
  overflow: hidden;
  padding: 18px;
  border-radius: 18px;
  background: linear-gradient(135deg, #0f5b92, #1974ac 64%, #2c8fbd);
  color: #fff;
  box-shadow: 0 12px 26px rgba(15, 91, 146, 0.18);
}
.build-strip::after {
  position: absolute;
  right: -30px;
  bottom: -54px;
  width: 88px;
  height: 88px;
  border: 22px solid rgba(255, 255, 255, 0.08);
  border-radius: 50%;
  content: '';
}
.build-meta {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.build-meta i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #8ff0b0;
  box-shadow: 0 0 0 5px rgba(143, 240, 176, 0.13);
}
.build-meta em {
  margin-left: auto;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.15);
  font-style: normal;
  font-size: 11px;
}
.build-strip code {
  position: relative;
  z-index: 1;
  display: block;
  margin-top: 18px;
  font-size: 20px;
  font-weight: 700;
  overflow-wrap: anywhere;
}
.build-strip p {
  position: relative;
  z-index: 1;
  margin: 8px 0 0;
  color: rgba(255, 255, 255, 0.82);
  font-size: 12px;
  line-height: 1.55;
}
.safety-note {
  margin-top: 12px;
  padding: 14px 16px;
  border-left: 4px solid #56a7cf;
  border-radius: 4px 14px 14px 4px;
  background: #eaf5fb;
  color: #28566e;
  font-size: 12px;
  line-height: 1.65;
}
.tool-section {
  margin-top: 24px;
}
.section-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.section-title span {
  color: #6e9db7;
  font:
    700 12px ui-monospace,
    monospace;
}
.section-title strong {
  font-size: 18px;
}
.tool-section > p {
  margin: 4px 2px 10px;
  color: #647884;
  font-size: 12px;
  line-height: 1.55;
}
.card,
.report-card {
  overflow: hidden;
  border: 1px solid #dfe7ec;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 4px 12px rgba(31, 74, 104, 0.06);
}
.card article {
  padding: 15px 16px;
  border-bottom: 1px solid #e6edf1;
}
.card article:last-child {
  border-bottom: 0;
}
.card article div {
  display: flex;
  align-items: center;
  gap: 8px;
}
.card b {
  padding: 3px 7px;
  border-radius: 999px;
  font-size: 10px;
}
.card b.good {
  background: #e6f6ec;
  color: #247244;
}
.card b.notice {
  background: #fff0e8;
  color: #a54d28;
}
.card b.pending {
  margin-left: auto;
  background: #edf1f4;
  color: #667985;
}
.card article span {
  color: #647884;
  font-size: 12px;
}
.card code {
  display: block;
  margin-top: 8px;
  font:
    650 13px/1.5 ui-monospace,
    monospace;
  overflow-wrap: anywhere;
}
.card p,
.card small {
  display: block;
  margin: 6px 0 0;
  color: #647884;
  font-size: 12px;
  line-height: 1.55;
}
.card small {
  color: #426e86;
}
.check-summary {
  margin-bottom: 8px;
  padding: 10px 14px;
  border-radius: 12px;
  background: #edf1f4;
  color: #667985;
  font-size: 13px;
  font-weight: 700;
}
.check-card {
  padding: 6px 16px 16px;
}
.check-card label {
  display: grid;
  grid-template-columns: 24px 1fr;
  padding: 12px 0;
  border-bottom: 1px solid #e6edf1;
}
.check-card input {
  width: 20px;
  height: 20px;
  margin: 0;
  accent-color: #176a99;
}
.check-card label > span {
  color: #152734;
  font-size: 13px;
}
.check-card label > small {
  grid-column: 2;
}
.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 14px;
}
.actions button,
.report-card button {
  min-height: 44px;
  border: 0;
  border-radius: 12px;
  background: #eaf5fb;
  color: #176a99;
  font-weight: 700;
}
.actions button.danger {
  background: #fff0e8;
  color: #a54d28;
}
.card b.method {
  border-radius: 6px;
  background: #dceef8;
  color: #155d83;
  font-family: ui-monospace, monospace;
}
.request-card code {
  margin-top: 0;
  font-size: 12px;
}
.metric-lead {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 16px;
  border-radius: 16px;
  background: #0f5b92;
  color: #fff;
}
.metric-lead strong {
  font:
    700 22px ui-monospace,
    monospace;
}
.report-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 26px;
  padding: 20px;
  background: #f7fbfd;
}
.report-card strong {
  font-size: 20px;
}
.report-card p {
  margin: 0;
  color: #647884;
  font-size: 12px;
  line-height: 1.6;
}
.report-card button:first-of-type {
  background: #176a99;
  color: #fff;
}
.is-large-text {
  font-size: 118%;
}
@media (max-width: 340px) {
  .test-tools-golden {
    padding-right: 12px;
    padding-left: 12px;
  }
  .build-strip,
  .card article,
  .report-card {
    padding-right: 14px;
    padding-left: 14px;
  }
  .actions {
    grid-template-columns: 1fr;
  }
  .build-strip code {
    font-size: 17px;
  }
}
</style>
