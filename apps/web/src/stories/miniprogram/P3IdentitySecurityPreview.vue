<script setup lang="ts">
import { computed, ref, watch } from 'vue';

export type P3IdentityScreen =
  | 'web-login'
  | 'platform-admin'
  | 'mini-login'
  | 'mini-link'
  | 'mini-register'
  | 'mini-admin-preview'
  | 'mini-admin-confirm'
  | 'mini-unbind';

const props = withDefaults(
  defineProps<{
    readonly dialogOpen?: boolean;
    readonly screen?: P3IdentityScreen;
  }>(),
  { dialogOpen: false, screen: 'mini-login' },
);

const screen = ref<P3IdentityScreen>(props.screen);
const dialogOpen = ref(props.dialogOpen);
const feedback = ref('');

watch(
  () => props.screen,
  (value) => {
    screen.value = value;
    feedback.value = '';
  },
);

watch(
  () => props.dialogOpen,
  (value) => {
    dialogOpen.value = value;
  },
);

const isMiniScreen = computed(() => screen.value.startsWith('mini-'));
const miniTitle = computed(() => {
  if (screen.value === 'mini-link') return '找到你的排班账号';
  if (screen.value === 'mini-register') return '补全你的微信档案';
  if (screen.value === 'mini-admin-preview') return '确认这条绑定';
  if (screen.value === 'mini-admin-confirm') return '绑定已准备好';
  if (screen.value === 'mini-unbind') return '解除当前微信绑定';
  return '进入你的排班台';
});
const miniDescription = computed(() => {
  if (screen.value === 'mini-link') return '使用平台管理员分配的账号完成一次绑定。';
  if (screen.value === 'mini-register') return '只需填写真实姓名，之后可由管理员完成入组。';
  if (screen.value === 'mini-admin-preview') return '请核对脱敏信息，确认是管理员为你准备的账号。';
  if (screen.value === 'mini-admin-confirm') return '当前微信身份将绑定到以下排班账号。';
  if (screen.value === 'mini-unbind') return '只移除当前小程序身份，不删除 Web 账号或排班资料。';
  return '使用账号密码登录后台，或用微信快速进入已绑定的成员账号。';
});
const miniStep = computed(() => {
  if (
    screen.value === 'mini-admin-preview' ||
    screen.value === 'mini-admin-confirm' ||
    screen.value === 'mini-unbind'
  )
    return 2;
  if (screen.value === 'mini-link' || screen.value === 'mini-register') return 2;
  return 1;
});

const accounts = [
  { name: '林恩宇', role: '成员 · 头颈外科', status: '正常', username: 'd0796', hasPassword: true },
  { name: '陈跃', role: '管理员 · 急诊一组', status: '正常', username: 'c1024', hasPassword: true },
  {
    name: '周清和',
    role: '成员 · 影像科',
    status: '待设密码',
    username: 'g0003',
    hasPassword: false,
  },
] as const;

function showFeedback(message: string): void {
  feedback.value = message;
}

function openAdminAssignment(): void {
  dialogOpen.value = true;
  feedback.value = '';
}

function closeAdminAssignment(): void {
  dialogOpen.value = false;
  feedback.value = '';
}

function advanceMiniFlow(): void {
  if (screen.value === 'mini-login') screen.value = 'mini-link';
  else if (screen.value === 'mini-link') screen.value = 'mini-admin-preview';
  else if (screen.value === 'mini-admin-preview') screen.value = 'mini-admin-confirm';
  else showFeedback('预览状态：已准备进入排班台');
}
</script>

<template>
  <main class="p3-identity-preview" :class="[`screen-${screen}`, { 'is-mini': isMiniScreen }]">
    <section v-if="screen === 'web-login'" class="web-auth-layout" aria-label="Web 登录黄金稿">
      <div class="web-auth-copy">
        <div class="identity-mark" aria-hidden="true"><span /><span /></div>
        <p class="eyebrow">P3 · 身份安全</p>
        <h1>先确认身份，再进入排班。</h1>
        <p class="lead-copy">账号由平台管理员预置。登录后，你只会看到自己有权限的群组和班次。</p>
        <div class="identity-promise" aria-label="登录保护说明">
          <span class="promise-line" aria-hidden="true" />
          <div>
            <strong>账号是进入排班的钥匙</strong>
            <p>不开放公开注册，也不会因为一次微信登录自动创建账号。</p>
          </div>
        </div>
      </div>

      <section class="web-auth-card" aria-labelledby="web-login-title">
        <header class="card-heading">
          <div>
            <span class="section-kicker">排班台</span>
            <h2 id="web-login-title">登录工作台</h2>
          </div>
          <span class="secure-chip"><i aria-hidden="true" />安全连接</span>
        </header>
        <form class="identity-form" @submit.prevent="showFeedback('预览状态：已提交登录')">
          <label>
            <span>账号</span>
            <input value="d0796" autocomplete="username" readonly />
          </label>
          <label>
            <span>密码</span>
            <input
              value="preview-password"
              type="password"
              autocomplete="current-password"
              readonly
            />
          </label>
          <button class="primary-action" type="submit">进入工作台</button>
        </form>
        <div class="card-divider"><span>需要查看公开排班？</span></div>
        <button class="quiet-action" type="button" @click="showFeedback('预览状态：打开访客查看')">
          访客查看排班 <span aria-hidden="true">→</span>
        </button>
        <p class="card-note">没有“注册”入口。账号或密码问题请联系平台管理员。</p>
        <p v-if="feedback" class="preview-feedback" role="status">{{ feedback }}</p>
      </section>
    </section>

    <section
      v-else-if="screen === 'platform-admin'"
      class="admin-screen"
      aria-label="平台账号后台黄金稿"
    >
      <aside class="admin-rail">
        <div class="rail-logo" aria-hidden="true">+</div>
        <span class="rail-name">排班台</span>
        <nav aria-label="平台后台导航">
          <button type="button" class="rail-nav-item"><span aria-hidden="true">▦</span>总览</button>
          <button type="button" class="rail-nav-item is-active">
            <span aria-hidden="true">◎</span>账号
          </button>
          <button type="button" class="rail-nav-item"><span aria-hidden="true">◇</span>审计</button>
        </nav>
        <div class="rail-footer"><i aria-hidden="true" />生产环境</div>
      </aside>

      <div class="admin-content">
        <header class="admin-topbar">
          <div>
            <p class="breadcrumb">平台管理 <span>/</span> 账号</p>
            <h1>账号与身份</h1>
          </div>
          <div class="admin-actor"><span class="actor-avatar">管</span><span>平台管理员</span></div>
        </header>

        <div class="admin-body">
          <div class="admin-intro">
            <div>
              <p class="eyebrow">仅平台管理员可见</p>
              <h2>预置登录账号</h2>
              <p>为已存在的业务用户分配 Web 用户名，再由用户在微信或 Web 完成密码证明。</p>
            </div>
            <button class="primary-action admin-add" type="button" @click="openAdminAssignment">
              <span aria-hidden="true">＋</span> 分配账号
            </button>
          </div>

          <div class="admin-metrics" aria-label="账号统计">
            <article><span>全部账号</span><strong>40</strong><small>当前业务用户</small></article>
            <article><span>已设密码</span><strong>24</strong><small>可进行密码证明</small></article>
            <article><span>待设密码</span><strong>16</strong><small>已有用户名</small></article>
          </div>

          <section class="account-table-card" aria-labelledby="account-list-title">
            <header class="table-heading">
              <div>
                <h3 id="account-list-title">用户账号</h3>
                <span>只显示必要状态，不显示密码或联系方式</span>
              </div>
              <button class="table-filter" type="button">
                全部状态 <span aria-hidden="true">⌄</span>
              </button>
            </header>
            <div class="account-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>用户</th>
                    <th>用户名</th>
                    <th>密码证明</th>
                    <th>状态</th>
                    <th><span class="visually-hidden">操作</span></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="account in accounts" :key="account.username">
                    <td>
                      <div class="account-person">
                        <span class="person-avatar">{{ account.name.slice(0, 1) }}</span
                        ><span
                          ><strong>{{ account.name }}</strong
                          ><small>{{ account.role }}</small></span
                        >
                      </div>
                    </td>
                    <td>
                      <code>{{ account.username }}</code>
                    </td>
                    <td>
                      <span class="password-state" :class="{ pending: !account.hasPassword }"
                        ><i aria-hidden="true" />{{
                          account.hasPassword ? '已设置' : '待设置'
                        }}</span
                      >
                    </td>
                    <td>
                      <span class="status-state"><i aria-hidden="true" />{{ account.status }}</span>
                    </td>
                    <td>
                      <button class="row-action" type="button" @click="openAdminAssignment">
                        管理
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      <div
        v-if="dialogOpen"
        class="admin-dialog-layer"
        role="presentation"
        @click.self="closeAdminAssignment"
      >
        <section
          class="admin-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="assign-title"
        >
          <button
            class="dialog-close"
            type="button"
            aria-label="关闭"
            @click="closeAdminAssignment"
          >
            ×
          </button>
          <p class="eyebrow">账号证明</p>
          <h2 id="assign-title">为林恩宇分配账号</h2>
          <p>用户名会用于 Web 登录，也会显示在管理员发送的绑定预览中。</p>
          <label class="dialog-field"><span>用户名</span><input value="d0796" readonly /></label>
          <div class="dialog-callout">
            <i aria-hidden="true">i</i
            ><span>这里只分配用户名，不设置或显示密码。用户稍后自行完成密码证明。</span>
          </div>
          <div class="dialog-actions">
            <button class="quiet-action" type="button" @click="closeAdminAssignment">取消</button
            ><button class="primary-action" type="button" @click="closeAdminAssignment">
              保存分配
            </button>
          </div>
        </section>
      </div>
    </section>

    <section v-else class="mini-shell" aria-label="小程序身份黄金稿">
      <header class="mini-header">
        <div class="mini-brand">
          <span class="mini-brand-mark" aria-hidden="true">+</span><span>排班台</span>
        </div>
        <span class="mini-version">P3 身份安全</span>
      </header>

      <div class="mini-progress" aria-label="身份流程进度">
        <div class="progress-track">
          <span :style="{ width: `${miniStep === 1 ? 34 : 72}%` }" />
        </div>
        <div class="progress-steps">
          <span :class="{ active: miniStep >= 1 }">微信身份</span
          ><span :class="{ active: miniStep >= 2 }">账号证明</span
          ><span :class="{ active: screen === 'mini-admin-confirm' }">进入排班</span>
        </div>
      </div>

      <div class="mini-heading">
        <p class="eyebrow">
          {{
            screen === 'mini-admin-preview' || screen === 'mini-admin-confirm'
              ? '管理员绑定'
              : screen === 'mini-unbind'
                ? '账号安全'
              : '账号登录'
          }}
        </p>
        <h1>{{ miniTitle }}</h1>
        <p>{{ miniDescription }}</p>
      </div>

      <section class="mini-card">
        <template v-if="screen === 'mini-login'">
          <div class="wechat-orb" aria-hidden="true"><span>排</span></div>
          <h2>账号密码登录</h2>
          <p class="mini-card-copy">账号由平台管理员预置，密码只用于建立当前登录会话。</p>
          <label class="mini-field"
            ><span>账号</span><input value="d0796" autocomplete="username" readonly
          /></label>
          <label class="mini-field"
            ><span>密码</span
            ><input
              value="preview-password"
              type="password"
              autocomplete="current-password"
              readonly
          /></label>
          <button class="mini-primary" type="button" @click="showFeedback('预览状态：账号密码登录')">
            账号密码登录
          </button>
          <div class="mini-divider" aria-hidden="true"><span /><b>或</b><span /></div>
          <button class="mini-secondary" type="button" @click="advanceMiniFlow">
            微信快捷登录
          </button>
          <button class="mini-secondary" type="button" @click="screen = 'mini-admin-preview'">
            我有管理员绑定链接
          </button>
          <p v-if="feedback" class="preview-feedback" role="status">{{ feedback }}</p>
        </template>

        <template v-else-if="screen === 'mini-link'">
          <div class="card-status">
            <span class="status-icon">✓</span><span>已找到可绑定的排班账号</span>
          </div>
          <div class="masked-account">
            <span class="person-avatar">林</span>
            <div><strong>林*</strong><small>请使用管理员分配的账号证明</small></div>
          </div>
          <label class="mini-field"
            ><span>账号</span><input value="d0796" autocomplete="username" readonly
          /></label>
          <label class="mini-field"
            ><span>密码</span
            ><input
              value="preview-password"
              type="password"
              autocomplete="current-password"
              readonly
          /></label>
          <button class="mini-primary" type="button" @click="advanceMiniFlow">
            绑定并进入排班
          </button>
          <p class="mini-footnote">密码只用于证明你拥有这个排班账号，不会显示给管理员。</p>
        </template>

        <template v-else-if="screen === 'mini-register'">
          <div class="card-status neutral">
            <span class="status-icon">i</span><span>这是你的首次微信登录</span>
          </div>
          <label class="mini-field"
            ><span>真实姓名</span><input value="林恩宇" autocomplete="name" readonly
          /></label>
          <div class="mini-callout">
            <i aria-hidden="true">!</i
            ><span>请填写证件或院内资料中的真实姓名，之后才能加入预设群组。</span>
          </div>
          <button
            class="mini-primary"
            type="button"
            @click="showFeedback('预览状态：已提交真实姓名')"
          >
            创建微信档案
          </button>
          <p v-if="feedback" class="preview-feedback" role="status">{{ feedback }}</p>
        </template>

        <template v-else-if="screen === 'mini-admin-preview'">
          <div class="card-status warning">
            <span class="status-icon">!</span><span>绑定链接 · 还剩约 10 分钟</span>
          </div>
          <div class="binding-target">
            <span class="target-label">绑定到</span><strong>林*</strong
            ><span class="target-account">账号 d0***</span>
          </div>
          <div class="binding-checklist">
            <span><i aria-hidden="true">✓</i>当前微信身份</span
            ><span><i aria-hidden="true">✓</i>目标账号已预置</span
            ><span><i aria-hidden="true">✓</i>绑定后旧会话会失效</span>
          </div>
          <button class="mini-primary" type="button" @click="advanceMiniFlow">确认并继续</button>
          <button
            class="mini-secondary"
            type="button"
            @click="showFeedback('预览状态：已取消绑定')"
          >
            暂不绑定
          </button>
        </template>

        <template v-else-if="screen === 'mini-unbind'">
          <div class="card-status warning">
            <span class="status-icon">!</span><span>解除当前小程序身份</span>
          </div>
          <div class="binding-target danger">
            <span class="target-label">将被解除</span><strong>当前微信身份</strong
            ><span class="target-account">仅限当前小程序 AppID</span>
          </div>
          <div class="binding-checklist">
            <span><i aria-hidden="true">✓</i>Web 账号保留</span
            ><span><i aria-hidden="true">✓</i>个人资料和排班保留</span
            ><span><i aria-hidden="true">✓</i>解绑后可重新绑定</span>
          </div>
          <button
            class="mini-primary danger"
            type="button"
            @click="showFeedback('预览状态：已提交解绑确认')"
          >
            解除当前身份
          </button>
          <button
            class="mini-secondary"
            type="button"
            @click="showFeedback('预览状态：已保留当前绑定')"
          >
            保留当前绑定
          </button>
          <p v-if="feedback" class="preview-feedback" role="status">{{ feedback }}</p>
        </template>

        <template v-else>
          <div class="success-orb" aria-hidden="true">✓</div>
          <h2>准备绑定到林*</h2>
          <p class="mini-card-copy">确认后，这个微信身份会成为该账号的当前小程序身份。</p>
          <div class="confirm-account"><span>目标账号</span><strong>d0***</strong></div>
          <button
            class="mini-primary"
            type="button"
            @click="showFeedback('预览状态：绑定确认已提交')"
          >
            确认绑定
          </button>
          <p v-if="feedback" class="preview-feedback" role="status">{{ feedback }}</p>
          <p class="mini-footnote">绑定只作用于当前小程序 AppID，不会删除 Web 账号或排班资料。</p>
        </template>
      </section>

      <p class="mini-privacy">
        <span aria-hidden="true">⌁</span> 你的身份信息只用于进入有权限的排班群组
      </p>
    </section>
  </main>
</template>

<style scoped>
:global(body) {
  min-width: 0;
}

.p3-identity-preview {
  --p3-ink: var(--ui-color-text-primary);
  --p3-muted: var(--ui-color-text-secondary);
  --p3-faint: var(--ui-color-text-muted);
  --p3-line: var(--ui-color-border);
  --p3-blue: var(--ui-color-primary);
  --p3-blue-dark: var(--ui-color-primary-dark);
  --p3-blue-soft: var(--ui-color-primary-light);
  --p3-green: var(--ui-color-success);
  --p3-green-soft: var(--ui-color-success-light);
  --p3-amber: var(--ui-color-warning);
  --p3-amber-soft: var(--ui-color-warning-light);
  min-height: 100dvh;
  box-sizing: border-box;
  color: var(--p3-ink);
  background: var(--ui-color-background);
  font-family: var(--ui-font-family-system);
}

button,
input {
  font: inherit;
}

button {
  cursor: pointer;
}

.eyebrow,
.section-kicker {
  margin: 0;
  color: var(--p3-blue);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-strong);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.identity-mark {
  position: relative;
  width: 54px;
  height: 54px;
  margin-bottom: 28px;
  background: var(--p3-blue);
  border-radius: 18px;
  box-shadow: var(--ui-shadow-primary);
}

.identity-mark span {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 26px;
  height: 7px;
  background: var(--ui-color-white);
  border-radius: var(--ui-radius-pill);
  transform: translate(-50%, -50%);
}

.identity-mark span:last-child {
  transform: translate(-50%, -50%) rotate(90deg);
}

.web-auth-layout {
  display: grid;
  width: min(1120px, calc(100% - 64px));
  min-height: 100dvh;
  margin: auto;
  padding: 72px 0;
  box-sizing: border-box;
  grid-template-columns: minmax(0, 1fr) minmax(360px, 430px);
  align-items: center;
  gap: clamp(48px, 9vw, 140px);
}

.web-auth-copy h1 {
  max-width: 560px;
  margin: 10px 0 18px;
  font-size: clamp(36px, 5vw, 60px);
  line-height: 1.08;
  letter-spacing: -0.055em;
}

.lead-copy {
  max-width: 450px;
  margin: 0;
  color: var(--p3-muted);
  font-size: var(--ui-font-size-lg);
  line-height: var(--ui-line-height-normal);
}

.identity-promise {
  display: flex;
  max-width: 440px;
  margin-top: 56px;
  align-items: flex-start;
  gap: 16px;
}

.promise-line {
  width: 3px;
  min-height: 48px;
  flex: none;
  background: var(--p3-blue);
  border-radius: var(--ui-radius-pill);
}

.identity-promise strong {
  display: block;
  margin-bottom: 5px;
  font-size: var(--ui-font-size-md);
}

.identity-promise p {
  margin: 0;
  color: var(--p3-muted);
  font-size: var(--ui-font-size-sm);
  line-height: var(--ui-line-height-normal);
}

.web-auth-card {
  padding: 30px;
  background: var(--ui-color-surface);
  border: 1px solid var(--p3-line);
  border-radius: 24px;
  box-shadow: var(--ui-shadow-elevated);
}

.card-heading,
.admin-intro,
.table-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.card-heading h2,
.admin-intro h2,
.table-heading h3 {
  margin: 5px 0 0;
  font-size: var(--ui-font-size-xl);
  line-height: var(--ui-line-height-title);
}

.secure-chip {
  display: inline-flex;
  padding: 6px 9px;
  align-items: center;
  gap: 6px;
  color: var(--p3-green);
  background: var(--p3-green-soft);
  border-radius: var(--ui-radius-pill);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-semibold);
  white-space: nowrap;
}

.secure-chip i,
.status-state i,
.password-state i,
.rail-footer i {
  display: inline-block;
  width: 7px;
  height: 7px;
  background: currentColor;
  border-radius: 50%;
}

.identity-form {
  display: grid;
  margin-top: 28px;
  gap: 16px;
}

.identity-form label,
.dialog-field,
.mini-field {
  display: grid;
  gap: 7px;
  color: var(--p3-muted);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.identity-form input,
.dialog-field input,
.mini-field input {
  width: 100%;
  min-height: 50px;
  box-sizing: border-box;
  padding: 0 14px;
  color: var(--p3-ink);
  background: var(--ui-color-surface-muted);
  border: 1px solid var(--p3-line);
  border-radius: var(--ui-radius-medium);
  outline: none;
}

.identity-form input:focus,
.dialog-field input:focus,
.mini-field input:focus {
  border-color: var(--p3-blue);
  box-shadow: var(--ui-shadow-focus);
}

.primary-action,
.quiet-action,
.mini-primary,
.mini-secondary,
.admin-add,
.row-action,
.table-filter {
  min-height: var(--ui-touch-target-comfortable);
  box-sizing: border-box;
  border-radius: var(--ui-radius-medium);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.primary-action,
.mini-primary {
  color: var(--ui-color-white);
  background: var(--p3-blue);
  border: 1px solid var(--p3-blue);
  box-shadow: var(--ui-shadow-primary);
}

.primary-action:hover,
.mini-primary:hover {
  background: var(--p3-blue-dark);
}

.mini-primary.danger {
  background: var(--ui-color-danger);
  border-color: var(--ui-color-danger);
  box-shadow: none;
}

.quiet-action,
.mini-secondary {
  color: var(--p3-blue-dark);
  background: transparent;
  border: 1px solid var(--ui-color-primary-border);
}

.quiet-action {
  display: flex;
  width: 100%;
  padding: 0 14px;
  align-items: center;
  justify-content: space-between;
}

.card-divider {
  display: flex;
  margin: 22px 0 8px;
  align-items: center;
  gap: 10px;
  color: var(--p3-faint);
  font-size: var(--ui-font-size-xs);
}

.card-divider::before,
.card-divider::after {
  height: 1px;
  flex: 1;
  background: var(--p3-line);
  content: '';
}

.card-note,
.mini-footnote {
  margin: 16px 0 0;
  color: var(--p3-faint);
  font-size: var(--ui-font-size-xs);
  line-height: var(--ui-line-height-normal);
  text-align: center;
}

.preview-feedback {
  margin: 14px 0 0;
  color: var(--p3-green);
  font-size: var(--ui-font-size-sm);
  line-height: var(--ui-line-height-normal);
}

.admin-screen {
  display: flex;
  min-height: 100dvh;
  background: var(--ui-color-background);
}

.admin-rail {
  display: flex;
  width: 224px;
  padding: 28px 16px 20px;
  box-sizing: border-box;
  flex: none;
  flex-direction: column;
  background: #122238;
  color: #dfe9f5;
}

.rail-logo {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  color: var(--ui-color-white);
  background: var(--p3-blue);
  border-radius: 12px;
  font-size: 25px;
  font-weight: var(--ui-font-weight-regular);
}

.rail-name {
  margin: 10px 0 46px 3px;
  color: #fff;
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-strong);
}

.admin-rail nav {
  display: grid;
  gap: 6px;
}

.rail-nav-item {
  display: flex;
  min-height: 46px;
  padding: 0 12px;
  align-items: center;
  gap: 10px;
  color: #aebed1;
  background: transparent;
  border: 0;
  border-radius: var(--ui-radius-small);
  text-align: left;
}

.rail-nav-item span {
  width: 20px;
  color: #88a2bd;
  font-size: 17px;
  text-align: center;
}

.rail-nav-item.is-active {
  color: #fff;
  background: rgb(255 255 255 / 11%);
}

.rail-nav-item.is-active span {
  color: #65aeff;
}

.rail-footer {
  display: flex;
  margin-top: auto;
  padding: 12px;
  align-items: center;
  gap: 8px;
  color: #8fa4b9;
  font-size: var(--ui-font-size-xs);
}

.rail-footer i {
  color: #48c696;
}

.admin-content {
  min-width: 0;
  flex: 1;
}

.admin-topbar {
  display: flex;
  min-height: 96px;
  padding: 24px 48px;
  box-sizing: border-box;
  align-items: center;
  justify-content: space-between;
  background: var(--ui-color-surface);
  border-bottom: 1px solid var(--p3-line);
}

.breadcrumb {
  margin: 0 0 6px;
  color: var(--p3-faint);
  font-size: var(--ui-font-size-xs);
}

.breadcrumb span {
  padding: 0 6px;
  color: var(--p3-line);
}

.admin-topbar h1 {
  margin: 0;
  font-size: 25px;
  line-height: var(--ui-line-height-title);
}

.admin-actor {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--p3-muted);
  font-size: var(--ui-font-size-sm);
}

.actor-avatar,
.person-avatar {
  display: inline-grid;
  width: 36px;
  height: 36px;
  place-items: center;
  color: var(--p3-blue-dark);
  background: var(--p3-blue-soft);
  border-radius: 50%;
  font-weight: var(--ui-font-weight-strong);
}

.admin-body {
  width: min(1040px, calc(100% - 96px));
  margin: 0 auto;
  padding: 48px 0 72px;
}

.admin-intro h2 {
  font-size: 30px;
}

.admin-intro p:last-child {
  max-width: 610px;
  margin: 10px 0 0;
  color: var(--p3-muted);
  line-height: var(--ui-line-height-normal);
}

.admin-add {
  padding: 0 16px;
  white-space: nowrap;
}

.admin-metrics {
  display: grid;
  margin: 36px 0 20px;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.admin-metrics article {
  display: grid;
  min-height: 126px;
  padding: 18px 20px;
  box-sizing: border-box;
  background: var(--ui-color-surface);
  border: 1px solid var(--p3-line);
  border-radius: var(--ui-radius-medium);
}

.admin-metrics span,
.admin-metrics small {
  color: var(--p3-muted);
  font-size: var(--ui-font-size-xs);
}

.admin-metrics strong {
  margin-top: 6px;
  font-size: 32px;
  line-height: 1;
}

.admin-metrics small {
  align-self: end;
}

.account-table-card {
  overflow: hidden;
  background: var(--ui-color-surface);
  border: 1px solid var(--p3-line);
  border-radius: var(--ui-radius-medium);
  box-shadow: var(--ui-shadow-card);
}

.table-heading {
  padding: 20px 22px;
  align-items: center;
  border-bottom: 1px solid var(--p3-line);
}

.table-heading h3 {
  font-size: var(--ui-font-size-lg);
}

.table-heading span {
  display: block;
  margin-top: 5px;
  color: var(--p3-faint);
  font-size: var(--ui-font-size-xs);
}

.table-filter {
  min-height: 38px;
  padding: 0 12px;
  color: var(--p3-muted);
  background: var(--ui-color-surface-muted);
  border: 1px solid var(--p3-line);
  font-size: var(--ui-font-size-xs);
}

.account-table-wrap {
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
  padding: 15px 22px;
  border-bottom: 1px solid var(--p3-line);
  font-size: var(--ui-font-size-sm);
  white-space: nowrap;
}

th {
  color: var(--p3-faint);
  background: var(--ui-color-surface-muted);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-semibold);
}

tbody tr:last-child td {
  border-bottom: 0;
}

.account-person {
  display: flex;
  align-items: center;
  gap: 10px;
}

.account-person > span:last-child {
  display: grid;
  gap: 3px;
}

.account-person small {
  color: var(--p3-faint);
  font-size: var(--ui-font-size-xs);
}

code {
  padding: 4px 7px;
  color: var(--p3-blue-dark);
  background: var(--p3-blue-soft);
  border-radius: 6px;
  font:
    600 12px ui-monospace,
    SFMono-Regular,
    Consolas,
    monospace;
}

.password-state,
.status-state {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--p3-green);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-semibold);
}

.password-state.pending {
  color: var(--p3-amber);
}

.row-action {
  min-height: 36px;
  padding: 0 10px;
  color: var(--p3-blue-dark);
  background: transparent;
  border: 0;
  font-size: var(--ui-font-size-xs);
}

.admin-dialog-layer {
  position: fixed;
  z-index: var(--ui-z-index-dialog);
  inset: 0;
  display: grid;
  padding: 24px;
  place-items: center;
  background: rgb(22 32 42 / 42%);
}

.admin-dialog {
  position: relative;
  width: min(100%, 420px);
  padding: 30px;
  box-sizing: border-box;
  background: var(--ui-color-surface);
  border-radius: 20px;
  box-shadow: var(--ui-shadow-elevated);
}

.dialog-close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 44px;
  height: 44px;
  color: var(--p3-faint);
  background: transparent;
  border: 0;
  font-size: 24px;
}

.admin-dialog h2 {
  margin: 8px 0 10px;
  font-size: 24px;
}

.admin-dialog > p:not(.eyebrow) {
  margin: 0 0 22px;
  color: var(--p3-muted);
  font-size: var(--ui-font-size-sm);
  line-height: var(--ui-line-height-normal);
}

.dialog-callout,
.mini-callout {
  display: flex;
  margin-top: 14px;
  padding: 12px;
  align-items: flex-start;
  gap: 9px;
  color: var(--p3-blue-dark);
  background: var(--p3-blue-soft);
  border-radius: var(--ui-radius-small);
  font-size: var(--ui-font-size-xs);
  line-height: var(--ui-line-height-normal);
}

.dialog-callout i,
.mini-callout i {
  display: grid;
  width: 17px;
  height: 17px;
  flex: none;
  place-items: center;
  color: var(--ui-color-white);
  background: var(--p3-blue);
  border-radius: 50%;
  font-size: 11px;
  font-style: normal;
  font-weight: var(--ui-font-weight-strong);
}

.dialog-actions {
  display: flex;
  margin-top: 24px;
  justify-content: flex-end;
  gap: 10px;
}

.dialog-actions .quiet-action,
.dialog-actions .primary-action {
  width: auto;
  min-width: 92px;
  padding: 0 14px;
}

.mini-shell {
  width: min(100%, 390px);
  min-height: 844px;
  margin: 0 auto;
  padding: 24px 16px 34px;
  box-sizing: border-box;
  background: var(--ui-color-background);
}

.mini-header,
.mini-brand,
.progress-steps,
.card-status,
.masked-account,
.confirm-account {
  display: flex;
  align-items: center;
}

.mini-header {
  min-height: 36px;
  justify-content: space-between;
}

.mini-brand {
  gap: 8px;
  color: var(--p3-ink);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-strong);
}

.mini-brand-mark {
  display: grid;
  width: 27px;
  height: 27px;
  place-items: center;
  color: var(--ui-color-white);
  background: var(--p3-blue);
  border-radius: 9px;
  font-size: 19px;
  font-weight: var(--ui-font-weight-regular);
}

.mini-version {
  color: var(--p3-faint);
  font-size: 10px;
  letter-spacing: 0.04em;
}

.mini-progress {
  margin-top: 36px;
}

.progress-track {
  height: 3px;
  overflow: hidden;
  background: var(--p3-line);
  border-radius: var(--ui-radius-pill);
}

.progress-track span {
  display: block;
  height: 100%;
  background: var(--p3-blue);
  border-radius: inherit;
  transition: width var(--ui-duration-normal) ease;
}

.progress-steps {
  margin-top: 8px;
  justify-content: space-between;
  color: var(--p3-faint);
  font-size: 10px;
}

.progress-steps span.active {
  color: var(--p3-blue-dark);
  font-weight: var(--ui-font-weight-semibold);
}

.mini-heading {
  margin: 38px 4px 22px;
}

.mini-heading h1 {
  margin: 8px 0 9px;
  font-size: 30px;
  line-height: 1.12;
  letter-spacing: -0.045em;
}

.mini-heading > p:last-child {
  margin: 0;
  color: var(--p3-muted);
  font-size: var(--ui-font-size-sm);
  line-height: var(--ui-line-height-normal);
}

.mini-card {
  padding: 22px 18px 20px;
  background: var(--ui-color-surface);
  border: 1px solid var(--p3-line);
  border-radius: 20px;
  box-shadow: var(--ui-shadow-card);
}

.mini-card h2 {
  margin: 16px 0 8px;
  font-size: var(--ui-font-size-lg);
}

.mini-card-copy {
  margin: 0;
  color: var(--p3-muted);
  font-size: var(--ui-font-size-sm);
  line-height: var(--ui-line-height-normal);
}

.wechat-orb,
.success-orb {
  display: grid;
  width: 58px;
  height: 58px;
  place-items: center;
  color: var(--ui-color-white);
  background: var(--p3-blue);
  border-radius: 18px;
  box-shadow: var(--ui-shadow-primary);
}

.wechat-orb span {
  font-size: 20px;
  font-weight: var(--ui-font-weight-strong);
}

.success-orb {
  color: var(--p3-green);
  background: var(--p3-green-soft);
  box-shadow: none;
  font-size: 27px;
  font-weight: var(--ui-font-weight-strong);
}

.mini-primary,
.mini-secondary {
  display: block;
  width: 100%;
  margin-top: 22px;
  padding: 0 14px;
}

.mini-divider {
  display: flex;
  margin-top: 18px;
  align-items: center;
  gap: 10px;
  color: var(--p3-faint);
  font-size: var(--ui-font-size-xs);
}

.mini-divider span {
  height: 1px;
  flex: 1;
  background: var(--p3-line);
}

.mini-divider b {
  font-weight: var(--ui-font-weight-regular);
}

.mini-secondary {
  margin-top: 9px;
}

.mini-field {
  margin-top: 16px;
}

.mini-field input {
  min-height: 48px;
}

.mini-footnote {
  margin-right: 3px;
  margin-left: 3px;
}

.card-status {
  min-height: 32px;
  gap: 8px;
  color: var(--p3-green);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-semibold);
}

.card-status.warning {
  color: var(--p3-amber);
}

.card-status.neutral {
  color: var(--p3-blue-dark);
}

.status-icon {
  display: grid;
  width: 20px;
  height: 20px;
  place-items: center;
  background: currentColor;
  border-radius: 50%;
  color: var(--ui-color-white);
  font-size: 12px;
  font-weight: var(--ui-font-weight-strong);
}

.masked-account {
  margin: 22px 0 18px;
  gap: 10px;
}

.masked-account > div {
  display: grid;
  gap: 3px;
}

.masked-account small {
  color: var(--p3-faint);
  font-size: var(--ui-font-size-xs);
}

.binding-target {
  display: grid;
  margin: 20px 0 18px;
  padding: 20px;
  background: var(--p3-amber-soft);
  border: 1px solid color-mix(in srgb, var(--p3-amber) 25%, transparent);
  border-radius: var(--ui-radius-medium);
}

.binding-target.danger {
  background: var(--ui-color-danger-light);
  border-color: color-mix(in srgb, var(--ui-color-danger) 25%, transparent);
}

.binding-target.danger .target-label {
  color: var(--ui-color-danger);
}

.target-label {
  color: var(--p3-amber);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-semibold);
}

.binding-target strong {
  margin: 7px 0 2px;
  font-size: 26px;
}

.target-account {
  color: var(--p3-muted);
  font:
    600 12px ui-monospace,
    SFMono-Regular,
    Consolas,
    monospace;
}

.binding-checklist {
  display: grid;
  padding: 0 2px;
  gap: 10px;
  color: var(--p3-muted);
  font-size: var(--ui-font-size-xs);
}

.binding-checklist span {
  display: flex;
  align-items: center;
  gap: 8px;
}

.binding-checklist i {
  display: grid;
  width: 17px;
  height: 17px;
  place-items: center;
  color: var(--p3-green);
  background: var(--p3-green-soft);
  border-radius: 50%;
  font-size: 10px;
  font-style: normal;
  font-weight: var(--ui-font-weight-strong);
}

.confirm-account {
  margin-top: 20px;
  padding: 14px;
  justify-content: space-between;
  color: var(--p3-muted);
  background: var(--ui-color-surface-muted);
  border-radius: var(--ui-radius-small);
  font-size: var(--ui-font-size-sm);
}

.confirm-account strong {
  color: var(--p3-blue-dark);
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
}

.mini-privacy {
  margin: 24px 8px 0;
  color: var(--p3-faint);
  font-size: 10px;
  line-height: var(--ui-line-height-normal);
  text-align: center;
}

.mini-privacy span {
  color: var(--p3-blue);
  font-size: 15px;
  vertical-align: -1px;
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

@media (max-width: 760px) {
  .web-auth-layout {
    width: min(100% - 32px, 500px);
    padding: 40px 0 48px;
    grid-template-columns: 1fr;
    gap: 36px;
  }

  .web-auth-copy h1 {
    font-size: 38px;
  }

  .identity-promise {
    margin-top: 30px;
  }

  .admin-rail {
    display: none;
  }

  .admin-topbar {
    padding: 20px 16px;
  }

  .admin-body {
    width: calc(100% - 32px);
    padding-top: 32px;
  }
}

@media (max-width: 360px) {
  .mini-shell {
    padding-right: 12px;
    padding-left: 12px;
  }

  .mini-heading h1 {
    font-size: 27px;
  }

  .mini-card {
    padding-right: 15px;
    padding-left: 15px;
  }

  .web-auth-card {
    padding: 22px 18px;
  }

  .web-auth-copy h1 {
    font-size: 34px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .progress-track span {
    transition: none;
  }
}
</style>
