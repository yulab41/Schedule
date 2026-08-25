<script setup lang="ts">
import { computed } from 'vue';

import type {
  P8OrganizationRole,
  P8OrganizationSurface,
} from './p8-organization-parity-fixtures.js';

const props = defineProps<{
  readonly role: P8OrganizationRole;
  readonly surface: P8OrganizationSurface;
}>();

const canManageInvites = computed(() =>
  ['administrator', 'developer', 'owner'].includes(props.role),
);
const canRotateVisitorAccess = computed(() => ['developer', 'owner'].includes(props.role));
</script>

<template>
  <section class="p8-invite-visitor" aria-labelledby="p8-invite-visitor-title">
    <header class="p8-access-heading">
      <div>
        <p>受控分享</p>
        <h2 id="p8-invite-visitor-title">邀请与访客码</h2>
      </div>
      <div class="capability-strip" aria-label="能力边界">
        <span>organization capability</span><span>guest capability</span>
      </div>
    </header>

    <div v-if="surface === 'loading'" class="access-state" aria-busy="true">
      <span class="state-pulse" aria-hidden="true" />
      <strong>正在读取邀请与访客状态</strong>
      <small>不会读取或缓存链接正文。</small>
    </div>
    <div v-else-if="surface === 'error'" class="access-state is-error" role="alert">
      <strong>分享状态没有加载完成</strong>
      <span>请检查 organization 与 guest 能力后重新加载。</span>
      <button type="button">重新加载</button>
    </div>
    <div v-else-if="surface === 'disabled' || role === 'member'" class="access-state">
      <strong>当前身份不可管理分享入口</strong>
      <span>普通成员只能接受发给自己的邀请，不能生成或轮换分享凭证。</span>
    </div>
    <template v-else>
      <p v-if="surface === 'success'" class="access-feedback" role="status">
        新访客码已生成，旧访客入口立即失效。
      </p>
      <div class="access-grid">
        <article class="access-card">
          <header>
            <div><span class="card-index">A</span><strong>岗位化邀请</strong></div>
            <span class="scope-badge">群主 / 管理员</span>
          </header>
          <p>按预设姓名、群组身份和排班岗位生成一次性入口。</p>
          <dl class="invite-summary">
            <div>
              <dt>目标成员</dt>
              <dd>王医生 · 待认领</dd>
            </div>
            <div>
              <dt>群组身份</dt>
              <dd>成员</dd>
            </div>
            <div>
              <dt>排班岗位</dt>
              <dd>一线值班</dd>
            </div>
            <div>
              <dt>有效期</dt>
              <dd>7 天 · 单次使用</dd>
            </div>
          </dl>
          <p v-if="surface === 'empty'" class="empty-note">当前没有待使用邀请。</p>
          <button type="button" :disabled="!canManageInvites">生成一次性邀请</button>
          <small class="privacy-note">邀请链接只显示一次，不进入缓存、历史列表或截图夹具。</small>
        </article>

        <article class="access-card visitor-card">
          <header>
            <div><span class="card-index">V</span><strong>访客只读入口</strong></div>
            <span class="scope-badge is-owner">群主专属</span>
          </header>
          <p>访客只能查看已发布排班；轮换后旧码和既有访客会话立即失效。</p>
          <div class="qr-safe-placeholder" aria-label="受保护的小程序码占位">
            <span aria-hidden="true">仅短暂显示</span>
            <strong>小程序码</strong>
            <small>码内容不持久化</small>
          </div>
          <div class="visitor-actions">
            <button type="button" :disabled="!canRotateVisitorAccess">轮换访客码</button>
            <button type="button" class="secondary-action">查看只读效果</button>
          </div>
          <small v-if="!canRotateVisitorAccess" class="privacy-note">
            当前管理员可管理邀请，但访客码轮换仍为群主专属。
          </small>
        </article>
      </div>

      <aside v-if="surface === 'confirm'" class="rotation-confirm" role="dialog" aria-modal="true">
        <span>危险操作确认</span>
        <strong>确认轮换访客码？</strong>
        <p>旧小程序码和未过期访客会话将立即失效，排班数据不会改变。</p>
        <div>
          <button type="button" class="secondary-action">取消</button
          ><button type="button">确认轮换</button>
        </div>
      </aside>
    </template>
  </section>
</template>

<style scoped>
.p8-invite-visitor {
  display: grid;
  min-width: 0;
  gap: 16px;
}

.p8-access-heading,
.access-card header,
.access-card header > div,
.visitor-actions,
.rotation-confirm > div {
  display: flex;
  align-items: center;
}

.p8-access-heading {
  justify-content: space-between;
  gap: 16px;
}

.p8-access-heading p,
.p8-access-heading h2,
.access-card p,
.rotation-confirm p {
  margin: 0;
}

.p8-access-heading p {
  color: var(--ui-color-primary);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.p8-access-heading h2 {
  margin-top: 4px;
  font-size: var(--ui-font-size-xl);
}

.capability-strip {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.capability-strip span,
.scope-badge {
  padding: 5px 8px;
  color: var(--ui-color-primary-dark);
  background: var(--ui-color-primary-light);
  border: 1px solid var(--ui-color-primary-border);
  border-radius: 999px;
  font:
    600 11px ui-monospace,
    SFMono-Regular,
    Consolas,
    monospace;
}

.access-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.access-card,
.access-state,
.rotation-confirm {
  padding: 18px;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-large);
  box-shadow: var(--ui-shadow-card);
}

.access-card {
  display: grid;
  align-content: start;
  gap: 14px;
}

.access-card header {
  justify-content: space-between;
  gap: 10px;
}

.access-card header > div {
  gap: 8px;
}

.card-index {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  color: var(--ui-color-white);
  background: var(--ui-color-primary);
  border-radius: 8px;
  font:
    700 13px ui-monospace,
    SFMono-Regular,
    Consolas,
    monospace;
}

.scope-badge {
  color: var(--ui-color-text-secondary);
  background: var(--ui-color-surface-muted);
  border-color: var(--ui-color-border);
  font-family: var(--ui-font-family-system);
}

.scope-badge.is-owner {
  color: var(--ui-color-text-primary);
  background: var(--ui-color-warning-light);
  border-color: var(--ui-color-warning);
}

.access-card > p {
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
  line-height: var(--ui-line-height-normal);
}

.invite-summary {
  display: grid;
  margin: 0;
  gap: 1px;
  overflow: hidden;
  background: var(--ui-color-border);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-small);
}

.invite-summary div {
  display: grid;
  padding: 9px 10px;
  grid-template-columns: 86px minmax(0, 1fr);
  background: var(--ui-color-surface-muted);
  font-size: var(--ui-font-size-sm);
}

.invite-summary dt {
  color: var(--ui-color-text-secondary);
}

.invite-summary dd {
  margin: 0;
  font-weight: var(--ui-font-weight-semibold);
}

.p8-invite-visitor button {
  min-height: var(--ui-touch-target-minimum);
  padding: 0 14px;
  color: var(--ui-color-white);
  background: var(--ui-color-primary);
  border: 1px solid var(--ui-color-primary);
  border-radius: var(--ui-radius-medium);
  font: inherit;
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.p8-invite-visitor button:disabled {
  color: var(--ui-color-text-muted);
  background: var(--ui-color-surface-muted);
  border-color: var(--ui-color-border);
}

.p8-invite-visitor .secondary-action {
  color: var(--ui-color-primary-dark);
  background: var(--ui-color-surface);
  border-color: var(--ui-color-primary-border);
}

.privacy-note,
.empty-note {
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-xs);
  line-height: var(--ui-line-height-normal);
}

.qr-safe-placeholder {
  display: grid;
  min-height: 154px;
  padding: 18px;
  place-content: center;
  gap: 5px;
  color: var(--ui-color-primary-dark);
  background:
    linear-gradient(90deg, rgb(10 102 213 / 8%) 1px, transparent 1px) 0 0 / 16px 16px,
    linear-gradient(rgb(10 102 213 / 8%) 1px, transparent 1px) 0 0 / 16px 16px,
    var(--ui-color-primary-light);
  border: 1px dashed var(--ui-color-primary-border);
  border-radius: var(--ui-radius-medium);
  text-align: center;
}

.qr-safe-placeholder span,
.qr-safe-placeholder small {
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-xs);
}

.visitor-actions,
.rotation-confirm > div {
  gap: 8px;
}

.visitor-actions button,
.rotation-confirm button {
  flex: 1;
}

.access-feedback {
  padding: 11px 13px;
  color: var(--ui-color-text-primary);
  background: var(--ui-color-success-light);
  border-left: 3px solid var(--ui-color-success);
  border-radius: var(--ui-radius-small);
  font-size: var(--ui-font-size-sm);
}

.access-state {
  display: grid;
  min-height: 160px;
  place-content: center;
  gap: 8px;
  text-align: center;
}

.access-state span,
.access-state small {
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
}

.access-state button {
  justify-self: center;
}

.access-state.is-error {
  color: var(--ui-color-danger);
  border-color: var(--ui-color-danger);
}

.state-pulse {
  width: 32px;
  height: 5px;
  margin: 0 auto 4px;
  background: var(--ui-color-primary);
  border-radius: 999px;
}

.rotation-confirm {
  display: grid;
  gap: 10px;
  border-color: var(--ui-color-warning);
  box-shadow: var(--ui-shadow-elevated);
}

.rotation-confirm > span {
  color: var(--ui-color-warning);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-semibold);
}

.rotation-confirm p {
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
  line-height: var(--ui-line-height-normal);
}

@media (max-width: 640px) {
  .p8-access-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .capability-strip {
    justify-content: flex-start;
  }

  .access-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .access-card,
  .access-state,
  .rotation-confirm {
    padding: 15px;
  }

  .invite-summary div {
    grid-template-columns: 76px minmax(0, 1fr);
  }
}
</style>
