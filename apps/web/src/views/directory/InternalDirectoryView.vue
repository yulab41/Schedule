<script setup lang="ts">
import type {
  DirectoryEntry,
  DirectoryFacetOption,
  DirectoryFacetSnapshot,
  DirectoryPage,
  DirectoryQuery,
  GroupSummary,
} from '@schedule/contracts';
import { directoryEntryKindLabels } from '@schedule/contracts';
import { CallIcon, CloseIcon, FilterIcon, LocationIcon, SearchIcon } from 'tdesign-icons-vue-next';
import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { createApiClient } from '../../api/client.js';
import { localAuth } from '../../auth/local-auth.js';
import ResponsiveSheet from '../../components/ResponsiveSheet.vue';
import {
  canDialDirectoryNumber,
  type DirectoryFilterKey,
  type DirectoryFilters,
  getDirectoryEntryLocation,
  getDirectoryEntryPath,
  getDirectoryEntryTitle,
  getDirectoryNumberLabel,
  getSafeInternalExtension,
  toDirectoryDialHref,
  toDirectoryQuery,
} from '../../features/directory/directory-presentation.js';
import { toUserMessage } from '../../utils/user-message.js';

export interface DirectoryDataSource {
  getDirectoryFacets(groupId: string): Promise<DirectoryFacetSnapshot>;
  searchDirectory(groupId: string, query: DirectoryQuery): Promise<DirectoryPage>;
}

interface FilterSection {
  readonly key: DirectoryFilterKey;
  readonly label: string;
  readonly options: readonly DirectoryFacetOption[];
}

const props = defineProps<{
  readonly dataSource?: DirectoryDataSource;
  readonly group: GroupSummary;
}>();

const api = createApiClient({ auth: localAuth });
const source = computed<DirectoryDataSource>(() => props.dataSource ?? api);
const searchDraft = ref('');
const filters = ref<DirectoryFilters>({});
const facets = ref<DirectoryFacetSnapshot>();
const entries = ref<readonly DirectoryEntry[]>([]);
const nextCursor = ref<string>();
const totalCount = ref(0);
const filterSheetVisible = ref(false);
const isLoading = ref(false);
const isLoadingMore = ref(false);
const errorMessage = ref<string>();
let searchTimer: number | undefined;
let requestSequence = 0;
let contextSequence = 0;

const filterSections = computed<readonly FilterSection[]>(() => {
  const snapshot = facets.value;
  if (snapshot === undefined) return [];
  return [
    { key: 'campusCode', label: '院区', options: snapshot.campuses },
    { key: 'section', label: '片区', options: snapshot.sections },
    { key: 'building', label: '楼宇', options: snapshot.buildings },
    { key: 'floor', label: '楼层', options: snapshot.floors },
    { key: 'department', label: '科室', options: snapshot.departments },
    { key: 'subunit', label: '单元', options: snapshot.subunits },
    { key: 'entryKind', label: '类型', options: snapshot.entryKinds },
  ];
});

const activeFilterCount = computed(
  () => Object.values(filters.value).filter((value) => value !== undefined).length,
);
const resultSummary = computed(() => {
  if (isLoading.value && entries.value.length === 0) return '正在查找院内号码';
  if (totalCount.value === 0) return '没有匹配的通讯录条目';
  return `找到 ${totalCount.value} 条通讯录记录`;
});

watch(
  () => props.group.id,
  () => void initializeDirectory(),
  { immediate: true },
);

onBeforeUnmount(() => {
  if (searchTimer !== undefined) window.clearTimeout(searchTimer);
  contextSequence += 1;
  requestSequence += 1;
});

async function initializeDirectory(): Promise<void> {
  if (searchTimer !== undefined) window.clearTimeout(searchTimer);
  searchDraft.value = '';
  filters.value = {};
  facets.value = undefined;
  entries.value = [];
  nextCursor.value = undefined;
  totalCount.value = 0;
  errorMessage.value = undefined;
  isLoading.value = true;
  isLoadingMore.value = false;
  const context = ++contextSequence;
  const entrySequence = ++requestSequence;
  const [facetResult, pageResult] = await Promise.allSettled([
    source.value.getDirectoryFacets(props.group.id),
    source.value.searchDirectory(props.group.id, toDirectoryQuery('', {})),
  ]);
  if (context !== contextSequence) return;

  if (facetResult.status === 'fulfilled') facets.value = facetResult.value;
  else {
    errorMessage.value = toUserMessage(
      facetResult.reason,
      '院内通讯录筛选项暂时无法加载，请稍后重试。',
    );
  }

  if (entrySequence === requestSequence) {
    if (pageResult.status === 'fulfilled') applyPage(pageResult.value, false);
    else {
      errorMessage.value = toUserMessage(pageResult.reason, '院内通讯录暂时无法加载，请稍后重试。');
    }
    isLoading.value = false;
  }
}

async function loadEntries(append: boolean): Promise<void> {
  if (append && nextCursor.value === undefined) return;
  const context = contextSequence;
  const sequence = ++requestSequence;
  errorMessage.value = undefined;
  if (append) isLoadingMore.value = true;
  else isLoading.value = true;

  try {
    const page = await source.value.searchDirectory(
      props.group.id,
      toDirectoryQuery(searchDraft.value, filters.value, append ? nextCursor.value : undefined),
    );
    if (context !== contextSequence || sequence !== requestSequence) return;
    applyPage(page, append);
  } catch (error) {
    if (context !== contextSequence || sequence !== requestSequence) return;
    errorMessage.value = toUserMessage(error, '搜索没有完成，请检查网络后重试。');
  } finally {
    if (context === contextSequence && sequence === requestSequence) {
      isLoading.value = false;
      isLoadingMore.value = false;
    }
  }
}

function applyPage(page: DirectoryPage, append: boolean): void {
  entries.value = append ? [...entries.value, ...page.entries] : page.entries;
  nextCursor.value = page.nextCursor;
  totalCount.value = page.totalCount;
}

function scheduleSearch(): void {
  if (searchTimer !== undefined) window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => void loadEntries(false), 240);
}

function runSearchImmediately(): void {
  if (searchTimer !== undefined) window.clearTimeout(searchTimer);
  void loadEntries(false);
}

function clearSearch(): void {
  if (searchDraft.value.length === 0) return;
  searchDraft.value = '';
  runSearchImmediately();
}

function selectFilter(key: DirectoryFilterKey, value: string | undefined): void {
  if (filters.value[key] === value) return;
  const nextFilters = { ...filters.value };
  if (value === undefined) delete nextFilters[key];
  else Object.assign(nextFilters, { [key]: value });
  filters.value = nextFilters;
  void loadEntries(false);
}

function clearAllFilters(): void {
  if (activeFilterCount.value === 0) return;
  filters.value = {};
  void loadEntries(false);
}

function resetDirectorySearch(): void {
  if (searchTimer !== undefined) window.clearTimeout(searchTimer);
  searchDraft.value = '';
  filters.value = {};
  void loadEntries(false);
}

function selectedFilterLabel(section: FilterSection): string {
  const value = filters.value[section.key];
  if (value === undefined) return '全部';
  return section.options.find((option) => option.value === value)?.label ?? value;
}

function formatEffectiveDate(value: string): string {
  const [year, month, day] = value.split('-');
  return `${year}年${Number(month)}月${Number(day)}日`;
}
</script>

<template>
  <section class="internal-directory" aria-labelledby="directory-title">
    <header class="directory-heading">
      <div>
        <p class="directory-eyebrow">院内协作</p>
        <h2 id="directory-title">院内通讯录</h2>
        <p>按科室、地点或号码快速定位，筛选层级可独立选择。</p>
      </div>
      <div v-if="facets !== undefined" class="directory-snapshot" aria-label="通讯录数据版本">
        <strong>{{ facets.totalCount }}</strong>
        <span>条记录</span>
        <small>{{ formatEffectiveDate(facets.publishedEffectiveOn) }}版</small>
      </div>
    </header>

    <form class="directory-search" role="search" @submit.prevent="runSearchImmediately">
      <SearchIcon aria-hidden="true" />
      <label for="hospital-directory-search" class="visually-hidden">搜索院内通讯录</label>
      <input
        id="hospital-directory-search"
        v-model="searchDraft"
        type="search"
        inputmode="search"
        autocomplete="off"
        enterkeyhint="search"
        placeholder="搜索科室、姓名、拼音或号码"
        @input="scheduleSearch"
      />
      <button
        v-if="searchDraft.length > 0"
        type="button"
        class="search-clear"
        aria-label="清空搜索"
        @click="clearSearch"
      >
        <CloseIcon aria-hidden="true" />
      </button>
      <button type="submit" class="search-submit">搜索</button>
    </form>

    <section class="directory-wayfinding" aria-labelledby="wayfinding-title">
      <div class="wayfinding-header">
        <div>
          <p id="wayfinding-title">院区导览</p>
          <span>可直接选择任意一级，无需从院区开始</span>
        </div>
        <button
          type="button"
          class="filter-open-action"
          :aria-label="`打开筛选，已选 ${activeFilterCount} 项`"
          @click="filterSheetVisible = true"
        >
          <FilterIcon aria-hidden="true" />
          <span>全部筛选</span>
          <strong v-if="activeFilterCount > 0">{{ activeFilterCount }}</strong>
        </button>
      </div>
      <div class="wayfinding-ribbon" aria-label="通讯录筛选层级">
        <button
          v-for="(section, index) in filterSections"
          :key="section.key"
          type="button"
          class="wayfinding-stop"
          :class="{ 'is-selected': filters[section.key] !== undefined }"
          :aria-pressed="filters[section.key] !== undefined"
          @click="filterSheetVisible = true"
        >
          <span class="stop-index" aria-hidden="true">{{ index + 1 }}</span>
          <span class="stop-copy">
            <small>{{ section.label }}</small>
            <strong>{{ selectedFilterLabel(section) }}</strong>
          </span>
        </button>
      </div>
      <button
        v-if="activeFilterCount > 0"
        type="button"
        class="clear-filter-action"
        @click="clearAllFilters"
      >
        清除全部筛选
      </button>
    </section>

    <p class="result-status" role="status" aria-live="polite">
      {{ resultSummary }}
      <span v-if="isLoading && entries.length > 0"> · 正在更新</span>
    </p>

    <div v-if="errorMessage !== undefined" class="directory-error" role="alert">
      <div>
        <strong>通讯录未能更新</strong>
        <p>{{ errorMessage }}</p>
      </div>
      <button
        type="button"
        @click="facets === undefined ? initializeDirectory() : loadEntries(false)"
      >
        重新加载
      </button>
    </div>

    <div v-if="isLoading && entries.length === 0" class="directory-skeleton" aria-hidden="true">
      <span v-for="index in 4" :key="index" />
    </div>

    <div v-else-if="entries.length > 0" class="directory-results" :aria-busy="isLoading">
      <article v-for="entry in entries" :key="entry.id" class="directory-entry">
        <div class="entry-accent" aria-hidden="true" />
        <div class="entry-content">
          <header class="entry-heading">
            <div>
              <div class="entry-title-line">
                <h3>{{ getDirectoryEntryTitle(entry) }}</h3>
                <span class="entry-kind">{{ directoryEntryKindLabels[entry.entryKind] }}</span>
              </div>
              <p v-if="getDirectoryEntryPath(entry).length > 0" class="entry-path">
                <template v-for="(part, index) in getDirectoryEntryPath(entry)" :key="part">
                  <span v-if="index > 0" aria-hidden="true">›</span>
                  <span>{{ part }}</span>
                </template>
              </p>
            </div>
            <p v-if="getDirectoryEntryLocation(entry) !== undefined" class="entry-location">
              <LocationIcon aria-hidden="true" />
              <span>{{ getDirectoryEntryLocation(entry) }}</span>
            </p>
          </header>

          <div class="contact-methods">
            <div v-for="contact in entry.contacts" :key="contact.id" class="contact-method">
              <span v-if="contact.label !== undefined" class="contact-label">{{
                contact.label
              }}</span>
              <div v-if="contact.fullNumber !== undefined" class="number-row">
                <span>{{ getDirectoryNumberLabel(contact.type, 'full') }}</span>
                <a
                  v-if="canDialDirectoryNumber(contact.type, 'full')"
                  class="directory-dial-action"
                  :href="toDirectoryDialHref(contact.fullNumber)"
                  :aria-label="`拨打${getDirectoryEntryTitle(entry)}的${getDirectoryNumberLabel(contact.type, 'full')} ${contact.fullNumber}`"
                >
                  <strong>{{ contact.fullNumber }}</strong>
                  <CallIcon aria-hidden="true" />
                </a>
                <strong v-else class="directory-static-number">{{ contact.fullNumber }}</strong>
              </div>
              <div v-if="getSafeInternalExtension(contact) !== undefined" class="number-row">
                <span>{{ getDirectoryNumberLabel(contact.type, 'extension') }}</span>
                <a
                  v-if="canDialDirectoryNumber(contact.type, 'extension')"
                  class="directory-dial-action"
                  :href="toDirectoryDialHref(getSafeInternalExtension(contact)!)"
                  :aria-label="`拨打${getDirectoryEntryTitle(entry)}的${getDirectoryNumberLabel(contact.type, 'extension')} ${getSafeInternalExtension(contact)}`"
                >
                  <strong>{{ getSafeInternalExtension(contact) }}</strong>
                  <CallIcon aria-hidden="true" />
                </a>
                <strong v-else class="directory-static-number is-extension">
                  {{ getSafeInternalExtension(contact) }}
                </strong>
              </div>
            </div>
          </div>

          <p v-if="entry.notes !== undefined" class="entry-notes">{{ entry.notes }}</p>
        </div>
      </article>
    </div>

    <div v-else-if="!isLoading && errorMessage === undefined" class="directory-empty">
      <SearchIcon aria-hidden="true" />
      <strong>没有找到匹配号码</strong>
      <p>可缩短搜索词，或清除部分独立筛选后重试。</p>
      <button type="button" @click="resetDirectorySearch">查看全部通讯录</button>
    </div>

    <button
      v-if="nextCursor !== undefined"
      type="button"
      class="load-more-action"
      :disabled="isLoadingMore"
      @click="loadEntries(true)"
    >
      {{ isLoadingMore ? '正在加载' : '加载更多' }}
    </button>

    <p class="directory-privacy-note">院内联系方式仅供工作使用，请勿向院外转发。</p>

    <ResponsiveSheet v-model:visible="filterSheetVisible" title="筛选院内通讯录">
      <div class="filter-sheet-intro">
        <strong>任意层级都可单独选择</strong>
        <span>例如只选“楼层”或“科室”，无需先选择院区。</span>
      </div>
      <div class="directory-filter-grid">
        <section
          v-for="section in filterSections"
          :key="section.key"
          class="filter-section"
          :aria-labelledby="`directory-filter-${section.key}`"
        >
          <header>
            <h3 :id="`directory-filter-${section.key}`">{{ section.label }}</h3>
            <span>{{ section.options.length }} 项</span>
          </header>
          <div class="filter-options">
            <button
              type="button"
              :class="{ 'is-selected': filters[section.key] === undefined }"
              :aria-pressed="filters[section.key] === undefined"
              @click="selectFilter(section.key, undefined)"
            >
              <span>全部</span>
            </button>
            <button
              v-for="option in section.options"
              :key="option.value"
              type="button"
              :class="{ 'is-selected': filters[section.key] === option.value }"
              :aria-pressed="filters[section.key] === option.value"
              @click="selectFilter(section.key, option.value)"
            >
              <span>{{ option.label }}</span>
              <small>{{ option.count }}</small>
            </button>
          </div>
        </section>
      </div>
      <button
        v-if="activeFilterCount > 0"
        type="button"
        class="sheet-reset-action"
        @click="clearAllFilters"
      >
        清除全部筛选
      </button>
    </ResponsiveSheet>
  </section>
</template>

<style scoped>
.internal-directory {
  display: grid;
  width: 100%;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  color: var(--ui-color-text-primary);
}

.directory-heading {
  display: flex;
  min-height: 112px;
  padding: 20px 22px;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-large);
  box-shadow: var(--ui-shadow-card);
}

.directory-eyebrow {
  margin: 0 0 4px;
  color: var(--ui-color-primary);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-semibold);
  letter-spacing: 0.08em;
}

.directory-heading h2 {
  margin: 0;
  font-size: clamp(24px, 3vw, 32px);
  line-height: 1.15;
  letter-spacing: -0.5px;
}

.directory-heading p:last-child {
  margin: 8px 0 0;
  color: var(--ui-color-text-secondary);
}

.directory-snapshot {
  display: grid;
  min-width: 108px;
  padding-left: 18px;
  border-left: 1px solid var(--ui-color-border);
  text-align: right;
}

.directory-snapshot strong {
  color: var(--ui-color-primary);
  font-size: 30px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.directory-snapshot span,
.directory-snapshot small {
  margin-top: 4px;
  color: var(--ui-color-text-secondary);
}

.directory-search {
  display: grid;
  min-height: 54px;
  grid-template-columns: 24px minmax(0, 1fr) auto auto;
  padding: 4px 5px 4px 16px;
  align-items: center;
  gap: 8px;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border-strong);
  border-radius: 16px;
  box-shadow: 0 8px 24px rgb(22 32 42 / 7%);
}

.directory-search:focus-within {
  border-color: var(--ui-color-primary);
  box-shadow: 0 0 0 3px var(--ui-color-primary-light);
}

.directory-search > svg {
  width: 22px;
  height: 22px;
  color: var(--ui-color-text-muted);
}

.directory-search input {
  min-width: 0;
  height: 44px;
  padding: 0;
  color: var(--ui-color-text-primary);
  background: transparent;
  border: 0;
  outline: 0;
  font-size: 16px;
}

.directory-search input::-webkit-search-cancel-button {
  display: none;
}

.search-clear,
.search-submit,
.filter-open-action,
.clear-filter-action,
.load-more-action,
.sheet-reset-action,
.directory-empty button,
.directory-error button {
  min-height: 44px;
  border-radius: var(--ui-radius-small);
  cursor: pointer;
  font: inherit;
  font-weight: var(--ui-font-weight-semibold);
}

.search-clear {
  display: grid;
  width: 44px;
  padding: 0;
  place-items: center;
  color: var(--ui-color-text-secondary);
  background: transparent;
  border: 0;
}

.search-clear svg {
  width: 18px;
  height: 18px;
}

.search-submit {
  padding: 0 18px;
  color: var(--ui-color-white);
  background: var(--ui-color-primary);
  border: 0;
}

.directory-wayfinding {
  position: relative;
  min-width: 0;
  padding: 14px;
  background: #eef6ff;
  border: 1px solid #cfe3fb;
  border-radius: var(--ui-radius-large);
}

.directory-wayfinding::before {
  position: absolute;
  top: 0;
  right: 14px;
  left: 14px;
  height: 4px;
  background: var(--ui-color-primary);
  border-radius: 0 0 4px 4px;
  content: '';
}

.wayfinding-header {
  display: flex;
  padding: 4px 2px 10px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.wayfinding-header p {
  margin: 0;
  font-weight: var(--ui-font-weight-semibold);
}

.wayfinding-header span {
  display: block;
  margin-top: 2px;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
}

.filter-open-action {
  display: inline-flex;
  padding: 0 12px;
  align-items: center;
  gap: 7px;
  color: var(--ui-color-primary);
  background: var(--ui-color-surface);
  border: 1px solid #bed8f5;
}

.filter-open-action svg {
  width: 18px;
  height: 18px;
}

.filter-open-action strong {
  display: grid;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  place-items: center;
  color: var(--ui-color-white);
  background: var(--ui-color-primary);
  border-radius: 10px;
  font-size: 11px;
}

.wayfinding-ribbon {
  display: grid;
  width: 100%;
  min-width: 0;
  grid-template-columns: repeat(7, minmax(92px, 1fr));
  overflow-x: auto;
  gap: 6px;
  scrollbar-width: thin;
}

.wayfinding-stop {
  display: grid;
  min-height: 64px;
  grid-template-columns: 24px minmax(0, 1fr);
  padding: 8px;
  align-items: center;
  gap: 6px;
  color: var(--ui-color-text-secondary);
  background: rgb(255 255 255 / 72%);
  border: 1px solid transparent;
  border-radius: 11px;
  cursor: pointer;
  text-align: left;
}

.wayfinding-stop:hover,
.wayfinding-stop.is-selected {
  color: var(--ui-color-primary);
  background: var(--ui-color-surface);
  border-color: #bed8f5;
}

.stop-index {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  color: var(--ui-color-white);
  background: var(--ui-color-primary);
  border-radius: 7px;
  font-size: 11px;
  font-weight: 700;
}

.wayfinding-stop:nth-child(2) .stop-index {
  background: #2a7ad9;
}

.wayfinding-stop:nth-child(3) .stop-index {
  background: #3b8fca;
}

.wayfinding-stop:nth-child(4) .stop-index {
  background: #3a9eaa;
}

.wayfinding-stop:nth-child(5) .stop-index {
  background: #4c9d7c;
}

.wayfinding-stop:nth-child(6) .stop-index {
  background: #758e5a;
}

.wayfinding-stop:nth-child(7) .stop-index {
  background: #8c7f64;
}

.stop-copy {
  min-width: 0;
}

.stop-copy small,
.stop-copy strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stop-copy small {
  font-size: 11px;
}

.stop-copy strong {
  margin-top: 2px;
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-sm);
}

.clear-filter-action {
  margin-top: 8px;
  padding: 0 8px;
  color: var(--ui-color-primary);
  background: transparent;
  border: 0;
}

.result-status {
  margin: 0 4px -6px;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
}

.directory-results {
  display: grid;
  min-width: 0;
  overflow: hidden;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-large);
  box-shadow: var(--ui-shadow-card);
}

.directory-entry {
  position: relative;
  display: grid;
  grid-template-columns: 5px minmax(0, 1fr);
}

.directory-entry + .directory-entry {
  border-top: 1px solid var(--ui-color-border);
}

.entry-accent {
  margin: 14px 0;
  background: var(--ui-color-primary);
  border-radius: 0 4px 4px 0;
  opacity: 0.76;
}

.entry-content {
  min-width: 0;
  padding: 18px 20px 16px;
}

.entry-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.entry-title-line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.entry-title-line h3 {
  margin: 0;
  font-size: var(--ui-font-size-lg);
  line-height: 1.3;
}

.entry-kind {
  padding: 3px 7px;
  color: var(--ui-color-primary);
  background: var(--ui-color-primary-light);
  border-radius: var(--ui-radius-pill);
  font-size: 11px;
  font-weight: var(--ui-font-weight-semibold);
}

.entry-path,
.entry-location {
  display: flex;
  margin: 5px 0 0;
  align-items: center;
  gap: 5px;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
}

.entry-location {
  max-width: 36%;
  justify-content: flex-end;
  text-align: right;
}

.entry-location svg {
  width: 17px;
  height: 17px;
  flex: 0 0 auto;
}

.contact-methods {
  display: grid;
  margin-top: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 20px;
}

.contact-method {
  min-width: 0;
  padding-top: 8px;
  border-top: 1px solid var(--ui-color-border);
}

.contact-label {
  display: block;
  margin-bottom: 2px;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-xs);
}

.number-row {
  display: grid;
  min-height: 44px;
  grid-template-columns: minmax(72px, auto) minmax(0, 1fr);
  align-items: center;
  gap: 10px;
}

.number-row > span {
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
}

.directory-dial-action {
  display: inline-flex;
  min-width: 0;
  min-height: 44px;
  padding: 0 4px;
  align-items: center;
  justify-content: flex-end;
  gap: 7px;
  color: var(--ui-color-primary);
  border-radius: var(--ui-radius-small);
  font-variant-numeric: tabular-nums;
  text-decoration: none;
}

.directory-dial-action:hover,
.directory-dial-action:active {
  background: var(--ui-color-primary-light);
}

.directory-dial-action svg {
  width: 19px;
  height: 19px;
  flex: 0 0 auto;
}

.directory-dial-action strong,
.directory-static-number {
  overflow-wrap: anywhere;
}

.directory-static-number {
  justify-self: end;
  color: var(--ui-color-text-primary);
  font-variant-numeric: tabular-nums;
}

.directory-static-number.is-extension {
  color: var(--ui-color-text-secondary);
}

.entry-notes {
  margin: 8px 0 0;
  padding: 8px 10px;
  color: var(--ui-color-text-secondary);
  background: var(--ui-color-surface-muted);
  border-radius: var(--ui-radius-small);
  font-size: var(--ui-font-size-sm);
}

.directory-skeleton {
  display: grid;
  gap: 1px;
  overflow: hidden;
  background: var(--ui-color-border);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-large);
}

.directory-skeleton span {
  height: 132px;
  background: var(--ui-color-surface-muted);
  animation: directory-loading 1.4s ease infinite;
}

.directory-error,
.directory-empty {
  padding: 24px;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-large);
}

.directory-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.directory-error p,
.directory-empty p {
  margin: 5px 0 0;
  color: var(--ui-color-text-secondary);
}

.directory-error button,
.directory-empty button,
.load-more-action,
.sheet-reset-action {
  padding: 0 16px;
  color: var(--ui-color-primary);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border-strong);
}

.directory-empty {
  display: grid;
  min-height: 240px;
  place-items: center;
  align-content: center;
  text-align: center;
}

.directory-empty > svg {
  width: 32px;
  height: 32px;
  margin-bottom: 10px;
  color: var(--ui-color-text-muted);
}

.directory-empty button {
  margin-top: 14px;
}

.load-more-action {
  width: min(260px, 100%);
  margin: 0 auto;
}

.load-more-action:disabled {
  cursor: wait;
  opacity: 0.64;
}

.directory-privacy-note {
  margin: 0;
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-xs);
  text-align: center;
}

.filter-sheet-intro {
  display: grid;
  padding: 12px;
  gap: 3px;
  color: var(--ui-color-primary);
  background: var(--ui-color-primary-light);
  border-radius: var(--ui-radius-small);
}

.filter-sheet-intro span {
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
}

.directory-filter-grid {
  display: grid;
  margin-top: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px 14px;
}

.filter-section header {
  display: flex;
  margin-bottom: 7px;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.filter-section h3 {
  margin: 0;
  font-size: var(--ui-font-size-md);
}

.filter-section header span {
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-xs);
}

.filter-options {
  display: grid;
  max-height: 210px;
  overflow-y: auto;
  gap: 3px;
}

.filter-options button {
  display: flex;
  min-height: 44px;
  padding: 7px 10px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--ui-color-text-secondary);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--ui-radius-small);
  cursor: pointer;
  text-align: left;
}

.filter-options button:hover,
.filter-options button.is-selected {
  color: var(--ui-color-primary);
  background: var(--ui-color-primary-light);
  border-color: #c9dff8;
}

.filter-options button.is-selected {
  font-weight: var(--ui-font-weight-semibold);
}

.filter-options small {
  color: var(--ui-color-text-muted);
  font-variant-numeric: tabular-nums;
}

.sheet-reset-action {
  width: 100%;
  margin-top: 18px;
}

.visually-hidden {
  position: absolute;
  overflow: hidden;
  width: 1px;
  height: 1px;
  clip-path: inset(50%);
  white-space: nowrap;
}

@keyframes directory-loading {
  50% {
    opacity: 0.52;
  }
}

@media (max-width: 760px) {
  .directory-heading {
    min-height: 0;
    padding: 17px 16px;
  }

  .directory-heading h2 {
    font-size: 25px;
  }

  .directory-heading p:last-child {
    font-size: var(--ui-font-size-sm);
  }

  .directory-snapshot {
    min-width: 76px;
    padding-left: 12px;
  }

  .directory-snapshot strong {
    font-size: 24px;
  }

  .directory-snapshot small {
    display: none;
  }

  .directory-search {
    grid-template-columns: 22px minmax(0, 1fr) auto;
    padding-right: 7px;
  }

  .search-submit {
    display: none;
  }

  .directory-wayfinding {
    margin-right: -12px;
    margin-left: -12px;
    padding-right: 12px;
    padding-left: 12px;
    border-right: 0;
    border-left: 0;
    border-radius: 0;
  }

  .wayfinding-header span {
    max-width: 190px;
  }

  .filter-open-action > span {
    display: none;
  }

  .wayfinding-ribbon {
    grid-template-columns: repeat(7, 118px);
    padding-bottom: 4px;
  }

  .entry-content {
    padding: 15px 14px 13px;
  }

  .entry-heading {
    display: block;
  }

  .entry-location {
    max-width: none;
    justify-content: flex-start;
    text-align: left;
  }

  .contact-methods {
    grid-template-columns: 1fr;
    gap: 3px;
  }

  .directory-filter-grid {
    grid-template-columns: 1fr;
    gap: 20px;
  }

  .filter-options {
    max-height: none;
  }

  .directory-error {
    display: grid;
  }
}

@media (max-width: 380px) {
  .directory-snapshot {
    display: none;
  }

  .number-row {
    grid-template-columns: 76px minmax(0, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .directory-skeleton span {
    animation: none;
  }
}
</style>
