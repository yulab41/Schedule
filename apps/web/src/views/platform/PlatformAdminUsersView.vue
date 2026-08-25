<script setup lang="ts">
import type { PlatformAdminUserAccount } from '@schedule/contracts';
import {
  resolveWorkflowOperationAttempt,
  type WorkflowOperationAttempt,
} from '@schedule/presentation-core';
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';

import { ApiClientError, createApiClient } from '../../api/client.js';
import { localAuth } from '../../auth/local-auth.js';
import { toUserMessage } from '../../utils/user-message.js';

const api = createApiClient({ auth: localAuth });
const operationAttempts = new Map<
  string,
  WorkflowOperationAttempt<Readonly<Record<string, unknown>>>
>();
const accounts = ref<PlatformAdminUserAccount[]>([]);
const errorMessage = ref<string>();
const feedback = ref<string>();
const loading = ref(true);
const saving = ref(false);
const modalOpen = ref(false);
const selectedUser = ref<PlatformAdminUserAccount>();
const username = ref('');
const generatedUrl = ref<string>();
const generatedExpiry = ref<string>();

const configuredCount = computed(
  () => accounts.value.filter((account) => account.hasPassword).length,
);
const pendingCount = computed(
  () => accounts.value.filter((account) => !account.hasPassword).length,
);

function resolvePlatformIdentityAttempt<Payload extends Readonly<Record<string, unknown>>>(
  key: string,
  payload: Payload,
): Readonly<Payload & { readonly operationId: string }> {
  const resolved = resolveWorkflowOperationAttempt(
    operationAttempts.get(key) as WorkflowOperationAttempt<Payload> | undefined,
    payload,
    () => crypto.randomUUID(),
  );
  operationAttempts.set(
    key,
    resolved.attempt as WorkflowOperationAttempt<Readonly<Record<string, unknown>>>,
  );
  return resolved.snapshot;
}

function completePlatformIdentityAttempt(key: string): void {
  operationAttempts.delete(key);
}

onMounted(() => {
  void refresh();
});

async function refresh(): Promise<void> {
  loading.value = true;
  errorMessage.value = undefined;
  try {
    const nextAccounts = await api.listPlatformUserAccounts();
    accounts.value = nextAccounts;
    const selectedId = selectedUser.value?.id;
    if (selectedId !== undefined) {
      selectedUser.value = nextAccounts.find((account) => account.id === selectedId);
    }
  } catch (error) {
    errorMessage.value = toUserMessage(error, '平台账号暂时无法加载，请稍后重试。');
  } finally {
    loading.value = false;
  }
}

function shortUserId(id: string): string {
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

function openAssignment(account: PlatformAdminUserAccount): void {
  selectedUser.value = account;
  username.value = account.username ?? '';
  generatedUrl.value = undefined;
  generatedExpiry.value = undefined;
  feedback.value = undefined;
  modalOpen.value = true;
}

function closeAssignment(): void {
  if (saving.value) return;
  modalOpen.value = false;
  selectedUser.value = undefined;
}

async function saveAssignment(): Promise<void> {
  const account = selectedUser.value;
  if (account === undefined || username.value.trim().length === 0) return;
  saving.value = true;
  errorMessage.value = undefined;
  feedback.value = undefined;
  try {
    const attemptKey = `password-identity:${account.id}`;
    const input = resolvePlatformIdentityAttempt(attemptKey, {
      expectedAuthVersion: account.authVersion,
      username: username.value.trim(),
    });
    const result = await api.assignPlatformPasswordIdentity(account.id, input);
    completePlatformIdentityAttempt(attemptKey);
    selectedUser.value = {
      ...account,
      authVersion: result.authVersion,
      hasPassword: result.passwordConfigured,
      username: result.username,
    };
    feedback.value = '用户名已保存；用户可继续完成密码证明。';
    await refresh();
  } catch (error) {
    const message = toUserMessage(error, '用户名没有保存，请稍后重试。');
    if (error instanceof ApiClientError && error.code === 'CONFLICT') {
      completePlatformIdentityAttempt(`password-identity:${account.id}`);
      await refresh();
    }
    errorMessage.value = message;
  } finally {
    saving.value = false;
  }
}

async function generateBindingLink(): Promise<void> {
  const account = selectedUser.value;
  if (account === undefined) return;
  saving.value = true;
  errorMessage.value = undefined;
  feedback.value = undefined;
  try {
    const attemptKey = `wechat-binding-link:${account.id}`;
    const input = resolvePlatformIdentityAttempt(attemptKey, {
      expectedAuthVersion: account.authVersion,
    });
    const result = await api.createWechatAdminBindingLink(account.id, input);
    completePlatformIdentityAttempt(attemptKey);
    generatedUrl.value = result.urlLink;
    generatedExpiry.value = result.expiresAt;
    feedback.value = '绑定链接已生成；请通过受控渠道交给用户。';
  } catch (error) {
    const message = toUserMessage(error, '绑定链接没有生成，请稍后重试。');
    if (error instanceof ApiClientError && error.code === 'CONFLICT') {
      completePlatformIdentityAttempt(`wechat-binding-link:${account.id}`);
      await refresh();
    }
    errorMessage.value = message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <main class="platform-admin-users" aria-labelledby="platform-admin-title">
    <header class="platform-admin-header">
      <div>
        <p class="platform-breadcrumb">
          <RouterLink to="/">工作台</RouterLink><span>/</span>平台账号
        </p>
        <h1 id="platform-admin-title">账号与身份</h1>
      </div>
      <RouterLink class="return-link" to="/">返回工作台</RouterLink>
    </header>

    <div class="platform-admin-body">
      <section class="platform-admin-intro">
        <div>
          <p class="platform-eyebrow">仅平台管理员可见</p>
          <h2>预置登录账号</h2>
          <p>为已存在的业务用户分配 Web 用户名，再由用户完成密码证明或小程序身份绑定。</p>
        </div>
        <button
          v-if="accounts[0] !== undefined"
          class="platform-primary-button"
          type="button"
          @click="openAssignment(accounts.find((account) => !account.hasPassword) ?? accounts[0])"
        >
          <span aria-hidden="true">＋</span> 分配账号
        </button>
      </section>

      <p v-if="errorMessage" class="platform-error" role="alert">{{ errorMessage }}</p>
      <p v-if="feedback" class="platform-feedback" role="status">{{ feedback }}</p>

      <section class="platform-metrics" aria-label="账号统计">
        <article>
          <span>全部账号</span><strong>{{ accounts.length }}</strong
          ><small>当前业务用户</small>
        </article>
        <article>
          <span>已设密码</span><strong>{{ configuredCount }}</strong
          ><small>可进行密码证明</small>
        </article>
        <article>
          <span>待设密码</span><strong>{{ pendingCount }}</strong
          ><small>已有用户名或待分配</small>
        </article>
      </section>

      <section class="platform-table-card" aria-labelledby="platform-account-list-title">
        <header class="platform-table-heading">
          <div>
            <h2 id="platform-account-list-title">用户账号</h2>
            <span>只显示必要状态，不显示姓名、密码或联系方式</span>
          </div>
          <button class="platform-refresh" type="button" :disabled="loading" @click="refresh">
            重新加载
          </button>
        </header>
        <div v-if="loading" class="platform-table-state" aria-live="polite">正在加载账号状态…</div>
        <div v-else-if="accounts.length === 0" class="platform-table-state">暂无可管理账号。</div>
        <div v-else class="platform-table-wrap">
          <table>
            <thead>
              <tr>
                <th>用户标识</th>
                <th>用户名</th>
                <th>密码证明</th>
                <th>版本</th>
                <th><span class="visually-hidden">操作</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="account in accounts" :key="account.id">
                <td>
                  <code>{{ shortUserId(account.id) }}</code
                  ><small>{{ account.status === 'active' ? '账号正常' : '账号已暂停' }}</small>
                </td>
                <td>
                  <span v-if="account.username" class="username-chip">{{ account.username }}</span
                  ><span v-else class="muted-value">未分配</span>
                </td>
                <td>
                  <span class="password-state" :class="{ pending: !account.hasPassword }"
                    ><i aria-hidden="true" />{{ account.hasPassword ? '已设置' : '待设置' }}</span
                  >
                </td>
                <td>
                  <span class="version-value">v{{ account.authVersion }}</span>
                </td>
                <td>
                  <button
                    class="platform-row-action"
                    type="button"
                    @click="openAssignment(account)"
                  >
                    管理
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <div
      v-if="modalOpen && selectedUser"
      class="platform-modal-layer"
      role="presentation"
      @click.self="closeAssignment"
    >
      <section
        class="platform-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="platform-modal-title"
      >
        <button
          class="platform-modal-close"
          type="button"
          aria-label="关闭"
          @click="closeAssignment"
        >
          ×
        </button>
        <p class="platform-eyebrow">账号证明</p>
        <h2 id="platform-modal-title">管理用户账号</h2>
        <p class="platform-modal-copy">
          只修改用户名或生成一次性小程序绑定链接，不设置或显示密码。
        </p>
        <label class="platform-field"
          ><span>用户名</span
          ><input v-model="username" autocomplete="off" maxlength="64" placeholder="3-64 位账号"
        /></label>
        <div class="platform-modal-actions">
          <button
            class="platform-secondary-button"
            type="button"
            :disabled="saving"
            @click="closeAssignment"
          >
            取消</button
          ><button
            class="platform-primary-button"
            type="button"
            :disabled="saving || username.trim().length === 0"
            @click="saveAssignment"
          >
            保存用户名
          </button>
        </div>
        <div class="platform-link-divider"><span>小程序绑定</span></div>
        <button
          class="platform-secondary-button platform-link-button"
          type="button"
          :disabled="saving"
          @click="generateBindingLink"
        >
          生成 10 分钟绑定链接
        </button>
        <div v-if="generatedUrl" class="platform-link-result">
          <span>请通过受控渠道交给用户，链接不直接完成绑定。</span><code>{{ generatedUrl }}</code
          ><small>有效期：{{ generatedExpiry }}</small>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.platform-admin-users {
  min-height: 100%;
  padding: 32px clamp(16px, 5vw, 64px) 72px;
  color: var(--ui-color-text-primary);
  background: var(--ui-color-background);
  font-family: var(--ui-font-family-system);
}

.platform-admin-header,
.platform-admin-intro,
.platform-table-heading,
.platform-modal-actions {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.platform-admin-header {
  max-width: 1120px;
  margin: 0 auto;
  padding-bottom: 28px;
  border-bottom: 1px solid var(--ui-color-border);
}

.platform-breadcrumb {
  margin: 0 0 6px;
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-xs);
}

.platform-breadcrumb a {
  color: var(--ui-color-primary-dark);
  text-decoration: none;
}

.platform-breadcrumb span {
  padding: 0 7px;
  color: var(--ui-color-border-strong);
}

.platform-admin-header h1,
.platform-admin-intro h2,
.platform-table-heading h2,
.platform-modal h2 {
  margin: 0;
  line-height: var(--ui-line-height-title);
}

.platform-admin-header h1 {
  font-size: 28px;
}

.return-link {
  min-height: var(--ui-touch-target-minimum);
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  color: var(--ui-color-primary-dark);
  text-decoration: none;
}

.platform-admin-body {
  max-width: 1120px;
  margin: 0 auto;
  padding-top: 36px;
}

.platform-eyebrow {
  margin: 0;
  color: var(--ui-color-primary);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-strong);
  letter-spacing: 0.08em;
}

.platform-admin-intro h2 {
  margin-top: 6px;
  font-size: 30px;
}

.platform-admin-intro p:last-child {
  max-width: 640px;
  margin: 10px 0 0;
  color: var(--ui-color-text-secondary);
  line-height: var(--ui-line-height-normal);
}

.platform-primary-button,
.platform-secondary-button,
.platform-refresh,
.platform-row-action {
  min-height: var(--ui-touch-target-comfortable);
  padding: 0 14px;
  border-radius: var(--ui-radius-medium);
  font: inherit;
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.platform-primary-button {
  color: var(--ui-color-white);
  background: var(--ui-color-primary);
  border: 1px solid var(--ui-color-primary);
  box-shadow: var(--ui-shadow-primary);
  white-space: nowrap;
}

.platform-secondary-button,
.platform-refresh {
  color: var(--ui-color-primary-dark);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-primary-border);
}

.platform-refresh {
  min-height: 38px;
  font-size: var(--ui-font-size-xs);
}

.platform-error,
.platform-feedback {
  margin: 18px 0 0;
  padding: 12px 14px;
  border-left: 3px solid var(--ui-color-danger);
  border-radius: var(--ui-radius-small);
  background: var(--ui-color-danger-light);
  color: var(--ui-color-danger);
  font-size: var(--ui-font-size-sm);
}

.platform-feedback {
  border-left-color: var(--ui-color-success);
  background: var(--ui-color-success-light);
  color: var(--ui-color-success);
}

.platform-metrics {
  display: grid;
  margin: 34px 0 18px;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.platform-metrics article,
.platform-table-card {
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  box-shadow: var(--ui-shadow-card);
}

.platform-metrics article {
  display: grid;
  min-height: 120px;
  padding: 18px 20px;
  box-sizing: border-box;
}

.platform-metrics span,
.platform-metrics small,
.platform-table-heading span,
td small {
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-xs);
}

.platform-metrics strong {
  margin-top: 7px;
  font-size: 32px;
  line-height: 1;
}

.platform-metrics small {
  align-self: end;
}

.platform-table-card {
  overflow: hidden;
}

.platform-table-heading {
  padding: 20px 22px;
  align-items: center;
  border-bottom: 1px solid var(--ui-color-border);
}

.platform-table-heading h2 {
  font-size: var(--ui-font-size-lg);
}

.platform-table-heading span {
  display: block;
  margin-top: 5px;
}

.platform-table-state {
  padding: 42px 22px;
  color: var(--ui-color-text-secondary);
  text-align: center;
}

.platform-table-wrap {
  overflow-x: auto;
}

table {
  width: 100%;
  min-width: 720px;
  border-collapse: collapse;
  text-align: left;
}

th,
td {
  padding: 14px 22px;
  border-bottom: 1px solid var(--ui-color-border);
  font-size: var(--ui-font-size-sm);
  white-space: nowrap;
}

th {
  color: var(--ui-color-text-muted);
  background: var(--ui-color-surface-muted);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-semibold);
}

tbody tr:last-child td {
  border-bottom: 0;
}

td:first-child {
  display: grid;
  gap: 4px;
}

code,
.username-chip,
.version-value {
  padding: 4px 7px;
  color: var(--ui-color-primary-dark);
  background: var(--ui-color-primary-light);
  border-radius: 6px;
  font:
    600 12px ui-monospace,
    SFMono-Regular,
    Consolas,
    monospace;
}

td code {
  width: max-content;
}

.muted-value {
  color: var(--ui-color-text-muted);
}

.password-state {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--ui-color-success);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-semibold);
}

.password-state.pending {
  color: var(--ui-color-warning);
}

.password-state i {
  width: 7px;
  height: 7px;
  background: currentColor;
  border-radius: 50%;
}

.platform-row-action {
  min-height: 36px;
  color: var(--ui-color-primary-dark);
  background: transparent;
  border: 0;
  font-size: var(--ui-font-size-xs);
}

.platform-modal-layer {
  position: fixed;
  z-index: var(--ui-z-index-dialog);
  inset: 0;
  display: grid;
  padding: 24px;
  place-items: center;
  background: rgb(22 32 42 / 42%);
}

.platform-modal {
  position: relative;
  width: min(100%, 500px);
  padding: 30px;
  background: var(--ui-color-surface);
  border-radius: 20px;
  box-shadow: var(--ui-shadow-elevated);
}

.platform-modal-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 44px;
  height: 44px;
  color: var(--ui-color-text-muted);
  background: transparent;
  border: 0;
  font-size: 24px;
}

.platform-modal h2 {
  margin-top: 8px;
  font-size: 24px;
}

.platform-modal-copy {
  margin: 10px 0 22px;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
  line-height: var(--ui-line-height-normal);
}

.platform-field {
  display: grid;
  gap: 7px;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.platform-field input {
  min-height: 50px;
  padding: 0 14px;
  color: var(--ui-color-text-primary);
  background: var(--ui-color-surface-muted);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  outline: none;
}

.platform-modal-actions {
  margin-top: 24px;
  align-items: center;
  justify-content: flex-end;
}

.platform-link-divider {
  display: flex;
  margin: 26px 0 12px;
  align-items: center;
  gap: 10px;
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-xs);
}

.platform-link-divider::before,
.platform-link-divider::after {
  height: 1px;
  flex: 1;
  background: var(--ui-color-border);
  content: '';
}

.platform-link-button {
  width: 100%;
}

.platform-link-result {
  display: grid;
  margin-top: 14px;
  padding: 12px;
  gap: 7px;
  color: var(--ui-color-primary-dark);
  background: var(--ui-color-primary-light);
  border-radius: var(--ui-radius-small);
  font-size: var(--ui-font-size-xs);
  line-height: var(--ui-line-height-normal);
}

.platform-link-result code {
  overflow-wrap: anywhere;
}

.platform-link-result small {
  color: var(--ui-color-text-secondary);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 720px) {
  .platform-admin-users {
    padding: 24px 16px 48px;
  }

  .platform-admin-intro {
    display: grid;
  }

  .platform-metrics {
    grid-template-columns: 1fr;
  }

  .platform-modal {
    padding: 24px 18px;
  }
}
</style>
