<script setup lang="ts">
import { computed } from 'vue';

import type { P8OrganizationRole, P8OrganizationSurface } from './p8-organization-parity-fixtures';

const props = defineProps<{
  role: P8OrganizationRole;
  surface: P8OrganizationSurface;
}>();

const canManage = computed(() => props.role === 'owner' || props.role === 'administrator');
const isBusy = computed(() => props.surface === 'loading' || props.surface === 'confirm');
</script>

<template>
  <section class="p8-qr-visitor" aria-labelledby="p8-qr-visitor-title">
    <header>
      <p>扫码入口</p>
      <h2 id="p8-qr-visitor-title">二维码与访客</h2>
      <span>成员绑定和访客查看均只生成当前小程序环境对应的一张二维码。</span>
    </header>

    <div v-if="surface === 'loading'" class="state-card">正在读取二维码状态…</div>
    <div v-else-if="surface === 'error'" class="state-card error">
      二维码暂时无法读取，请稍后重试。
    </div>
    <div v-else-if="surface === 'disabled' || !canManage" class="state-card">
      当前账号没有管理二维码的权限。
    </div>
    <div v-else class="card-grid">
      <article>
        <div class="card-heading">
          <div><span class="card-index">A</span><strong>成员绑定二维码</strong></div>
          <span class="status">一次性</span>
        </div>
        <p>选择成员后生成微信绑定二维码，扫码确认后立即失效。</p>
        <dl class="qr-summary">
          <div>
            <dt>群组名：</dt>
            <dd>头颈外科医生</dd>
          </div>
          <div>
            <dt>姓名：</dt>
            <dd>冯钦</dd>
          </div>
          <div>
            <dt>工号：</dt>
            <dd>d0659</dd>
          </div>
          <div>
            <dt>有效期：</dt>
            <dd>2026-09-21 14:35</dd>
          </div>
        </dl>
        <button type="button" :disabled="isBusy">生成成员绑定二维码</button>
      </article>

      <article>
        <div class="card-heading">
          <div><span class="card-index">B</span><strong>访客二维码</strong></div>
          <span class="status">长期入口</span>
        </div>
        <p>访客扫码后只能查看已发布排班；刷新密钥会让旧二维码立即失效。</p>
        <div class="qr-placeholder" aria-label="访客二维码预览">班</div>
        <button type="button" :disabled="role !== 'owner' || isBusy">刷新访客二维码</button>
      </article>
    </div>
  </section>
</template>

<style scoped>
.p8-qr-visitor {
  display: grid;
  gap: 18px;
  padding: 20px;
  color: #18212e;
}
header {
  display: grid;
  gap: 6px;
}
header p {
  margin: 0;
  color: #0b70d9;
  font-size: 13px;
  font-weight: 700;
}
header h2 {
  margin: 0;
  font-size: 26px;
  letter-spacing: -0.02em;
}
header span,
article p {
  color: #657184;
  line-height: 1.55;
}
.card-grid {
  display: grid;
  gap: 14px;
}
article,
.state-card {
  padding: 18px;
  border: 1px solid #dce4ef;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 10px 30px rgb(27 58 93 / 7%);
}
.card-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.card-heading > div {
  display: flex;
  align-items: center;
  gap: 9px;
}
.card-index {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 9px;
  background: #eaf4ff;
  color: #086fd5;
  font-weight: 750;
}
.status {
  color: #0b70d9;
  font-size: 12px;
  font-weight: 700;
}
.qr-summary {
  display: grid;
  gap: 9px;
  margin: 16px 0;
  padding: 16px;
  border-radius: 14px;
  background: #f3f8ff;
  text-align: center;
}
.qr-summary div {
  display: flex;
  justify-content: center;
  gap: 4px;
  font-size: 16px;
}
.qr-summary dt,
.qr-summary dd {
  margin: 0;
}
.qr-placeholder {
  display: grid;
  width: 116px;
  height: 116px;
  margin: 16px auto;
  place-items: center;
  border: 10px solid #162132;
  border-radius: 18px;
  color: #0f9f91;
  font-size: 38px;
  font-weight: 800;
}
button {
  width: 100%;
  min-height: 46px;
  border: 0;
  border-radius: 14px;
  background: #0875dc;
  color: #fff;
  font: inherit;
  font-weight: 700;
}
button:disabled {
  background: #bdc7d3;
}
.state-card.error {
  color: #bb2d24;
}
</style>
