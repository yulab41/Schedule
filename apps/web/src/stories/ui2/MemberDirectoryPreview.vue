<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import ResponsiveSheet from '../../components/ResponsiveSheet.vue';

type ViewerRole = 'member' | 'administrator' | 'developer';
type PreviewState = 'directory' | 'edit-self' | 'missing-number' | 'saved';

interface DirectoryMember {
  id: string;
  name: string;
  role: string;
  longNumber: string;
  shortNumber: string;
  isSelf?: boolean;
  pending?: boolean;
}

const props = withDefaults(
  defineProps<{
    layout?: 'mobile' | 'desktop';
    viewerRole?: ViewerRole;
    initialState?: PreviewState;
  }>(),
  {
    layout: 'mobile',
    viewerRole: 'member',
    initialState: 'directory',
  },
);

const baseMembers: readonly DirectoryMember[] = [
  {
    id: 'self',
    name: '林恩宇',
    role: '住院医师',
    longNumber: '138 0271 6628',
    shortNumber: '6128',
    isSelf: true,
  },
  {
    id: 'chen',
    name: '陈思敏',
    role: '群主 · 主治医师',
    longNumber: '136 9204 1765',
    shortNumber: '6012',
  },
  {
    id: 'huang',
    name: '黄嘉雯',
    role: '群管理员 · 护师',
    longNumber: '未填写',
    shortNumber: '6027',
  },
  {
    id: 'zhou',
    name: '周承泽',
    role: '成员 · 住院医师',
    longNumber: '137 1598 4036',
    shortNumber: '未填写',
  },
  {
    id: 'wu',
    name: '吴若宁',
    role: '待认领',
    longNumber: '未填写',
    shortNumber: '未填写',
    pending: true,
  },
];

const members = ref<DirectoryMember[]>(baseMembers.map((member) => ({ ...member })));
const sheetVisible = ref(false);
const editingMemberId = ref('self');
const longNumberDraft = ref('');
const shortNumberDraft = ref('');
const confirmedDraft = ref(true);
const showSavedFeedback = ref(props.initialState === 'saved');

const selfMember = computed(
  () => members.value.find((member) => member.isSelf) ?? members.value[0]!,
);
const otherMembers = computed(() => members.value.filter((member) => !member.isSelf));
const editingMember = computed(
  () => members.value.find((member) => member.id === editingMemberId.value) ?? selfMember.value,
);
const canEditAll = computed(
  () => props.viewerRole === 'administrator' || props.viewerRole === 'developer',
);
const roleLabel = computed(() => {
  if (props.viewerRole === 'developer') return '后台管理员视图';
  if (props.viewerRole === 'administrator') return '群管理员视图';
  return '普通成员视图';
});

function resetPreview(): void {
  members.value = baseMembers.map((member) => ({ ...member }));
  if (props.initialState === 'missing-number') {
    const member = members.value.find((candidate) => candidate.isSelf);
    if (member !== undefined) {
      member.longNumber = '未填写';
      member.shortNumber = '未填写';
    }
  }
  showSavedFeedback.value = props.initialState === 'saved';
  sheetVisible.value = false;
  if (props.initialState === 'edit-self') openEditor(selfMember.value);
}

function openEditor(member: DirectoryMember): void {
  if (!member.isSelf && !canEditAll.value) return;
  editingMemberId.value = member.id;
  longNumberDraft.value =
    member.longNumber === '未填写' ? '' : member.longNumber.replaceAll(' ', '');
  shortNumberDraft.value = member.shortNumber === '未填写' ? '' : member.shortNumber;
  confirmedDraft.value = true;
  sheetVisible.value = true;
}

function saveContact(): void {
  const member = members.value.find((candidate) => candidate.id === editingMemberId.value);
  if (member === undefined) return;
  member.longNumber = longNumberDraft.value.trim() || '未填写';
  member.shortNumber = shortNumberDraft.value.trim() || '未填写';
  sheetVisible.value = false;
  showSavedFeedback.value = true;
}

function initials(name: string): string {
  return name.slice(-2);
}

watch(() => props.initialState, resetPreview);
onMounted(resetPreview);
</script>

<template>
  <main class="member-preview" :class="[`is-${layout}`, `viewer-${viewerRole}`]">
    <div class="member-page-shell">
      <header class="page-heading">
        <div>
          <p class="eyebrow">群组设置</p>
          <h1>成员</h1>
          <p class="page-summary">查看同组成员联系方式，快速找到需要联系的人。</p>
        </div>
        <span class="viewer-pill">{{ roleLabel }}</span>
      </header>

      <p v-if="showSavedFeedback" class="save-feedback" role="status">
        <span aria-hidden="true">✓</span>
        联系方式已保存，成员列表已刷新
      </p>

      <section class="directory-section self-section" aria-labelledby="self-heading">
        <div class="section-heading">
          <h2 id="self-heading">我的资料</h2>
          <span>仅在需要时编辑</span>
        </div>
        <article class="self-contact-card">
          <div class="member-identity">
            <span class="avatar avatar-self" aria-hidden="true">{{
              initials(selfMember.name)
            }}</span>
            <div class="identity-copy">
              <div class="name-line">
                <strong>{{ selfMember.name }}</strong>
                <span class="self-badge">我</span>
              </div>
              <span>{{ selfMember.role }}</span>
            </div>
          </div>
          <dl class="contact-numbers">
            <div>
              <dt>长号</dt>
              <dd :class="{ missing: selfMember.longNumber === '未填写' }">
                {{ selfMember.longNumber }}
              </dd>
            </div>
            <div>
              <dt>短号</dt>
              <dd :class="{ missing: selfMember.shortNumber === '未填写' }">
                {{ selfMember.shortNumber }}
              </dd>
            </div>
          </dl>
          <button class="edit-action" type="button" @click="openEditor(selfMember)">修改</button>
        </article>
      </section>

      <section class="directory-section" aria-labelledby="directory-heading">
        <div class="section-heading">
          <h2 id="directory-heading">科室通讯录</h2>
          <span>{{ members.length }} 位成员</span>
        </div>
        <div class="contact-list">
          <article v-for="member in otherMembers" :key="member.id" class="contact-row">
            <div class="member-identity">
              <span class="avatar" :class="{ pending: member.pending }" aria-hidden="true">
                {{ initials(member.name) }}
              </span>
              <div class="identity-copy">
                <div class="name-line">
                  <strong>{{ member.name }}</strong>
                  <span v-if="member.pending" class="pending-badge">待认领</span>
                </div>
                <span>{{ member.role }}</span>
              </div>
            </div>
            <dl class="contact-numbers compact">
              <div>
                <dt>长号</dt>
                <dd :class="{ missing: member.longNumber === '未填写' }">
                  {{ member.longNumber }}
                </dd>
              </div>
              <div>
                <dt>短号</dt>
                <dd :class="{ missing: member.shortNumber === '未填写' }">
                  {{ member.shortNumber }}
                </dd>
              </div>
            </dl>
            <div v-if="canEditAll && !member.pending" class="row-actions">
              <button class="edit-action" type="button" @click="openEditor(member)">修改</button>
              <button class="member-secondary-action" type="button">管理</button>
            </div>
          </article>
        </div>
      </section>

      <p class="privacy-note">联系方式仅向本群组有效成员显示，请勿转发到群组以外。</p>
    </div>

    <ResponsiveSheet v-model:visible="sheetVisible" :title="`修改${editingMember.name}的联系方式`">
      <form class="contact-editor" @submit.prevent="saveContact">
        <p class="editor-intro">修改后将立即更新成员列表中的联系方式。</p>
        <label>
          <span>长号</span>
          <input
            v-model="longNumberDraft"
            type="tel"
            name="long-number"
            inputmode="tel"
            autocomplete="tel"
            placeholder="请输入手机或座机号码"
          />
        </label>
        <label>
          <span>短号</span>
          <input
            v-model="shortNumberDraft"
            name="short-number"
            inputmode="numeric"
            placeholder="选填"
          />
        </label>
        <label v-if="canEditAll" class="confirmation-row">
          <input v-model="confirmedDraft" type="checkbox" />
          <span>
            <strong>标记为已确认</strong>
            <small>我已与该成员核对以上号码</small>
          </span>
        </label>
        <div class="editor-actions">
          <button type="button" class="cancel-action" @click="sheetVisible = false">取消</button>
          <button type="submit" class="save-action">保存</button>
        </div>
      </form>
    </ResponsiveSheet>
  </main>
</template>

<style scoped>
:global(body) {
  min-width: 0;
}

:global(html) {
  scrollbar-width: none;
}

:global(html::-webkit-scrollbar) {
  display: none;
}

.member-preview {
  --preview-blue: #0a66d5;
  --preview-blue-soft: #eaf3ff;
  --preview-canvas: #f4f7fb;
  --preview-surface: #ffffff;
  --preview-text: #16202a;
  --preview-muted: #637083;
  --preview-border: #dce3eb;
  min-height: 100vh;
  overflow-x: hidden;
  color: var(--preview-text);
  background:
    radial-gradient(circle at 88% 3%, rgb(10 102 213 / 7%), transparent 280px),
    var(--preview-canvas);
  font-family:
    -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Segoe UI', 'Microsoft YaHei',
    sans-serif;
}

.member-page-shell {
  width: min(100%, 980px);
  min-height: 100vh;
  margin: 0 auto;
  padding: 28px 20px 40px;
}

.page-heading {
  display: flex;
  margin-bottom: 24px;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
}

.eyebrow {
  margin: 0 0 5px;
  color: var(--preview-blue);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.page-heading h1 {
  margin: 0;
  font-family:
    -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'PingFang SC', 'Segoe UI', sans-serif;
  font-size: clamp(30px, 5vw, 40px);
  line-height: 1.08;
  letter-spacing: -0.025em;
}

.page-summary {
  margin: 8px 0 0;
  color: var(--preview-muted);
  font-size: 14px;
  line-height: 1.6;
}

.viewer-pill {
  flex: none;
  padding: 7px 11px;
  color: #3d4c5e;
  background: rgb(255 255 255 / 82%);
  border: 1px solid var(--preview-border);
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.save-feedback {
  display: flex;
  margin: 0 0 16px;
  padding: 12px 14px;
  align-items: center;
  gap: 9px;
  color: #146c43;
  background: #e9f8ef;
  border: 1px solid #bce8cc;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
}

.save-feedback span {
  display: grid;
  width: 21px;
  height: 21px;
  place-items: center;
  color: white;
  background: #21865a;
  border-radius: 50%;
  font-size: 12px;
}

.directory-section + .directory-section {
  margin-top: 24px;
}

.section-heading {
  display: flex;
  min-height: 35px;
  padding: 0 4px 8px;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.section-heading h2 {
  margin: 0;
  font-size: 14px;
  line-height: 1.3;
}

.section-heading span {
  color: var(--preview-muted);
  font-size: 12px;
}

.self-contact-card,
.contact-list {
  background: var(--preview-surface);
  border: 1px solid var(--preview-border);
  border-radius: 18px;
  box-shadow: 0 8px 28px rgb(39 58 82 / 6%);
}

.self-contact-card {
  display: grid;
  min-height: 108px;
  padding: 18px;
  grid-template-columns: minmax(210px, 1fr) minmax(280px, 1fr) auto;
  align-items: center;
  gap: 20px;
  background: linear-gradient(110deg, var(--preview-blue-soft), #f8fbff 76%);
  border-color: #bed8f7;
}

.member-identity {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.avatar {
  display: grid;
  width: 44px;
  height: 44px;
  flex: none;
  place-items: center;
  color: #435469;
  background: #edf1f6;
  border-radius: 50%;
  font-size: 13px;
  font-weight: 700;
}

.avatar-self {
  color: white;
  background: linear-gradient(145deg, #2782e7, #0757b7);
  box-shadow: 0 5px 14px rgb(10 102 213 / 22%);
}

.avatar.pending {
  color: #586574;
  background: #f1f3f6;
  border: 1px dashed #b9c2ce;
}

.identity-copy {
  min-width: 0;
}

.identity-copy > span {
  display: block;
  margin-top: 4px;
  overflow: hidden;
  color: var(--preview-muted);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.name-line {
  display: flex;
  align-items: center;
  gap: 7px;
}

.name-line strong {
  overflow: hidden;
  font-size: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.self-badge,
.pending-badge {
  flex: none;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}

.self-badge {
  color: var(--preview-blue);
  background: rgb(255 255 255 / 76%);
  border: 1px solid #b9d5f5;
}

.pending-badge {
  color: #596473;
  background: #f1f3f5;
}

.contact-numbers {
  display: grid;
  margin: 0;
  grid-template-columns: minmax(140px, 1fr) minmax(82px, 0.55fr);
  gap: 14px;
}

.contact-numbers div {
  min-width: 0;
}

.contact-numbers dt {
  margin-bottom: 4px;
  color: var(--preview-muted);
  font-size: 11px;
}

.contact-numbers dd {
  margin: 0;
  overflow: hidden;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  letter-spacing: 0.015em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.contact-numbers dd.missing {
  color: #667384;
  font-weight: 500;
}

.edit-action,
.member-secondary-action,
.cancel-action,
.save-action {
  min-width: 54px;
  min-height: 44px;
  padding: 0 14px;
  border-radius: 12px;
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  font-weight: 650;
  transition:
    background 160ms ease,
    border-color 160ms ease,
    transform 160ms ease;
}

.edit-action {
  color: var(--preview-blue);
  background: var(--preview-surface);
  border: 1px solid #b7d2f2;
}

.edit-action:hover {
  background: #f2f7fd;
  border-color: #8db9ea;
}

.contact-list {
  overflow: hidden;
}

.contact-row {
  display: grid;
  min-height: 86px;
  padding: 16px 18px;
  grid-template-columns: minmax(210px, 1fr) minmax(280px, 1fr) auto;
  align-items: center;
  gap: 20px;
}

.contact-row + .contact-row {
  border-top: 1px solid var(--preview-border);
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.member-secondary-action {
  min-width: 48px;
  padding: 0 7px;
  color: var(--preview-muted);
  background: transparent;
  border: 1px solid transparent;
}

.member-secondary-action:hover {
  color: #435164;
  background: #f2f4f7;
}

.privacy-note {
  margin: 18px 4px 0;
  color: #758192;
  font-size: 12px;
  line-height: 1.6;
}

.contact-editor {
  display: grid;
  gap: 16px;
}

.editor-intro {
  margin: 6px 0 2px;
  color: var(--preview-muted);
  font-size: 13px;
  line-height: 1.55;
}

.contact-editor > label:not(.confirmation-row) {
  display: grid;
  gap: 7px;
  font-size: 13px;
  font-weight: 650;
}

.contact-editor input[type='tel'],
.contact-editor input[type='text'],
.contact-editor input[inputmode='numeric'] {
  width: 100%;
  min-height: 48px;
  padding: 0 13px;
  color: var(--preview-text);
  background: #fbfcfe;
  border: 1px solid #cbd5e0;
  border-radius: 12px;
  font: inherit;
  font-variant-numeric: tabular-nums;
  box-sizing: border-box;
}

.confirmation-row {
  display: flex;
  min-height: 56px;
  padding: 10px 12px;
  align-items: center;
  gap: 10px;
  background: var(--preview-blue-soft);
  border-radius: 12px;
  cursor: pointer;
}

.confirmation-row input {
  width: 20px;
  height: 20px;
  accent-color: var(--preview-blue);
}

.confirmation-row span {
  display: grid;
  gap: 2px;
}

.confirmation-row strong {
  font-size: 13px;
}

.confirmation-row small {
  color: var(--preview-muted);
  font-size: 12px;
}

.editor-actions {
  display: grid;
  margin-top: 2px;
  grid-template-columns: 1fr 1.5fr;
  gap: 10px;
}

.cancel-action {
  color: #475569;
  background: white;
  border: 1px solid #cbd5e0;
}

.save-action {
  color: white;
  background: var(--preview-blue);
  border: 1px solid var(--preview-blue);
}

button:focus-visible,
input:focus-visible {
  outline: 3px solid rgb(10 102 213 / 32%);
  outline-offset: 2px;
}

button:active {
  transform: translateY(1px);
}

@media (max-width: 700px) {
  .member-page-shell {
    padding: 22px 14px 32px;
  }

  .page-heading {
    margin-bottom: 20px;
    align-items: flex-start;
  }

  .page-heading h1 {
    font-size: 32px;
  }

  .page-summary {
    max-width: 250px;
  }

  .viewer-pill {
    max-width: 100px;
    margin-top: 2px;
    text-align: center;
  }

  .self-contact-card,
  .contact-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
  }

  .self-contact-card {
    padding: 16px;
  }

  .self-contact-card .contact-numbers,
  .contact-row .contact-numbers {
    grid-column: 1 / -1;
  }

  .contact-list,
  .self-contact-card {
    border-radius: 16px;
  }

  .contact-row {
    min-height: 128px;
    padding: 15px 16px;
  }

  .contact-row .row-actions {
    grid-row: 1;
    grid-column: 2;
  }

  .contact-numbers {
    padding-left: 56px;
    grid-template-columns: minmax(126px, 1fr) minmax(72px, 0.55fr);
    gap: 10px;
  }

  .contact-numbers dd {
    font-size: 13px;
  }

  .privacy-note {
    padding: 0 2px;
  }
}

@media (max-width: 340px) {
  .member-page-shell {
    padding-inline: 10px;
  }

  .page-summary {
    max-width: 210px;
  }

  .viewer-pill {
    padding-inline: 8px;
  }

  .section-heading span {
    max-width: 110px;
    text-align: right;
  }

  .contact-numbers {
    padding-left: 0;
  }

  .row-actions {
    align-self: start;
  }

  .row-actions .member-secondary-action {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
</style>
