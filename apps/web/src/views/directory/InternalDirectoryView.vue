<script setup lang="ts">
import type {
  DirectoryContactMethod,
  DirectoryEntry,
  DirectoryFacetOption,
  DirectoryFacetSnapshot,
  DirectoryKind,
  DirectoryPage,
  DirectoryQuery,
  GroupSummary,
} from '@schedule/contracts';
import {
  ChevronRightIcon,
  CloseIcon,
  FilterIcon,
  FilterClearIcon,
  SearchIcon,
  StarFilledIcon,
  StarIcon,
} from 'tdesign-icons-vue-next';
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue';

import { createApiClient } from '../../api/client.js';
import { localAuth } from '../../auth/local-auth.js';
import LucideMinimalActionIcon from '../../components/LucideMinimalActionIcon.vue';
import ResponsiveSheet from '../../components/ResponsiveSheet.vue';
import {
  getCompatibleDirectoryFacetOptions,
  getMeaningfulDirectoryFilterKeys,
  updateDirectoryFilterSelection,
} from '../../features/directory/directory-filter-hierarchy.js';
import {
  type DirectoryEntryDisplayGroup,
  getDirectoryGroupContexts,
  getDirectoryGroupEmployeeCodes,
  getDirectoryGroupJobTitles,
  getDirectoryGroupKindLabel,
  getDirectoryGroupNotes,
  getDirectoryGroupTitle,
  groupDirectoryEntriesByContact,
} from '../../features/directory/directory-entry-groups.js';
import {
  getDirectoryPreferenceEntryIds,
  getDirectoryPriorityGroups,
  isDirectoryGroupFavorite,
  parseDirectoryPreferences,
  recordDirectoryUse as recordDirectoryUsePreference,
  toggleDirectoryFavorite,
  type DirectoryPreferences,
} from '../../features/directory/directory-preferences.js';
import {
  canDialDirectoryNumber,
  type DirectoryFilterKey,
  type DirectoryFilters,
  getDirectoryNumberLabel,
  getSafeInternalExtension,
  hasActiveDirectoryCriteria,
  toDirectoryDialHref,
  toDirectoryQuery,
} from '../../features/directory/directory-presentation.js';
import { toUserMessage } from '../../utils/user-message.js';

export interface DirectoryDataSource {
  getDirectoryFacets(groupId: string): Promise<DirectoryFacetSnapshot>;
  lookupDirectoryEntries(groupId: string, entryIds: readonly string[]): Promise<DirectoryEntry[]>;
  searchDirectory(groupId: string, query: DirectoryQuery): Promise<DirectoryPage>;
}

interface FilterSection {
  readonly key: DirectoryFilterKey;
  readonly label: string;
  readonly options: readonly DirectoryFacetOption[];
}

const props = defineProps<{
  readonly dataSource?: DirectoryDataSource;
  readonly directoryKind?: DirectoryKind;
  readonly group: GroupSummary;
  readonly title?: string;
}>();

const api = createApiClient({ auth: localAuth });
const source = computed<DirectoryDataSource>(() => props.dataSource ?? api);
const directoryKind = computed(() => props.directoryKind ?? 'internal');
const directoryTitle = computed(() => props.title ?? '院内通讯录');
const filterLabels = computed<Readonly<Record<DirectoryFilterKey, string>>>(() =>
  directoryKind.value === 'employee'
    ? {
        building: '二级组织',
        campusCode: '组织根',
        department: '四级组织',
        entryKind: '类型',
        floor: '三级组织',
        section: '一级组织',
        subunit: '五级组织',
      }
    : {
        building: '楼宇',
        campusCode: '院区',
        department: '科室',
        entryKind: '类型',
        floor: '楼层',
        section: '片区',
        subunit: '单元',
      },
);
const searchDraft = ref('');
const filters = ref<DirectoryFilters>({});
const facets = ref<DirectoryFacetSnapshot>();
const entries = ref<readonly DirectoryEntry[]>([]);
const priorityEntries = ref<readonly DirectoryEntry[]>([]);
const preferences = ref<DirectoryPreferences>(parseDirectoryPreferences(undefined));
const nextCursor = ref<string>();
const totalCount = ref(0);
const filterSheetVisible = ref(false);
const phoneMotionKeys = reactive<Record<string, number>>({});
const collapsedFilterKeys = ref<ReadonlySet<DirectoryFilterKey>>(new Set());
const isLoading = ref(false);
const isLoadingMore = ref(false);
const errorMessage = ref<string>();
const filterAdjustmentMessage = ref<string>();
let searchTimer: number | undefined;
let requestSequence = 0;
let contextSequence = 0;
let filterFocusFrame: number | undefined;
let pendingFilterKey: DirectoryFilterKey | undefined;
const filterSectionElements = new Map<DirectoryFilterKey, HTMLElement>();

const filterSections = computed<readonly FilterSection[]>(() => {
  const snapshot = facets.value;
  if (snapshot === undefined) return [];
  const sections: readonly FilterSection[] = [
    {
      key: 'campusCode',
      label: filterLabels.value.campusCode,
      options: getCompatibleDirectoryFacetOptions(snapshot, filters.value, 'campusCode'),
    },
    {
      key: 'section',
      label: filterLabels.value.section,
      options: getCompatibleDirectoryFacetOptions(snapshot, filters.value, 'section'),
    },
    {
      key: 'building',
      label: filterLabels.value.building,
      options: getCompatibleDirectoryFacetOptions(snapshot, filters.value, 'building'),
    },
    {
      key: 'floor',
      label: filterLabels.value.floor,
      options: getCompatibleDirectoryFacetOptions(snapshot, filters.value, 'floor'),
    },
    {
      key: 'department',
      label: filterLabels.value.department,
      options: getCompatibleDirectoryFacetOptions(snapshot, filters.value, 'department'),
    },
    {
      key: 'subunit',
      label: filterLabels.value.subunit,
      options: getCompatibleDirectoryFacetOptions(snapshot, filters.value, 'subunit'),
    },
    {
      key: 'entryKind',
      label: filterLabels.value.entryKind,
      options: getCompatibleDirectoryFacetOptions(snapshot, filters.value, 'entryKind'),
    },
  ];
  const meaningfulKeys = new Set(getMeaningfulDirectoryFilterKeys(snapshot, filters.value));
  return sections.filter((section) => meaningfulKeys.has(section.key));
});

const activeFilterCount = computed(
  () => Object.values(filters.value).filter((value) => value !== undefined).length,
);
const hasDirectoryCriteria = computed(() =>
  hasActiveDirectoryCriteria(searchDraft.value, filters.value),
);
const displayGroups = computed(() => groupDirectoryEntriesByContact(entries.value));
const knownEntryGroups = computed(() => {
  const entriesById = new Map<string, DirectoryEntry>();
  for (const entry of [...priorityEntries.value, ...entries.value])
    entriesById.set(entry.id, entry);
  return groupDirectoryEntriesByContact([...entriesById.values()]);
});
const priorityGroups = computed(() =>
  getDirectoryPriorityGroups(preferences.value, knownEntryGroups.value),
);
const prioritySections = computed(() =>
  [
    { groups: priorityGroups.value.favorites, key: 'favorites', title: '收藏通讯录' },
    { groups: priorityGroups.value.frequent, key: 'frequent', title: '常用通讯录' },
  ].filter((section) => section.groups.length > 0),
);
const mergedGroupCount = computed(
  () => displayGroups.value.filter((group) => group.entries.length > 1).length,
);
const resultSummary = computed(() => {
  if (isLoading.value && entries.value.length === 0) return `正在查找${directoryTitle.value}号码`;
  if (totalCount.value === 0) return '没有匹配的通讯录条目';
  const mergedSummary =
    mergedGroupCount.value > 0 ? ` · 已合并 ${mergedGroupCount.value} 组同号条目` : '';
  return `找到 ${totalCount.value} 条通讯录记录${mergedSummary}`;
});

watch(
  () => props.group.id,
  () => void initializeDirectory(),
  { immediate: true },
);

onBeforeUnmount(() => {
  if (searchTimer !== undefined) window.clearTimeout(searchTimer);
  if (filterFocusFrame !== undefined) window.cancelAnimationFrame(filterFocusFrame);
  contextSequence += 1;
  requestSequence += 1;
});

watch(filterSheetVisible, async (visible) => {
  if (!visible || pendingFilterKey === undefined) return;
  const key = pendingFilterKey;
  await nextTick();
  if (filterFocusFrame !== undefined) window.cancelAnimationFrame(filterFocusFrame);
  filterFocusFrame = window.requestAnimationFrame(() => {
    const section = filterSectionElements.get(key);
    if (section === undefined) return;
    section.scrollIntoView({
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
    section.focus({ preventScroll: true });
    pendingFilterKey = undefined;
    filterFocusFrame = undefined;
  });
});

async function initializeDirectory(): Promise<void> {
  if (searchTimer !== undefined) window.clearTimeout(searchTimer);
  searchDraft.value = '';
  filters.value = {};
  facets.value = undefined;
  entries.value = [];
  priorityEntries.value = [];
  nextCursor.value = undefined;
  totalCount.value = 0;
  errorMessage.value = undefined;
  filterAdjustmentMessage.value = undefined;
  isLoading.value = false;
  isLoadingMore.value = false;
  const context = ++contextSequence;
  requestSequence += 1;
  const groupId = props.group.id;
  const dataSource = source.value;
  preferences.value = readDirectoryPreferences(groupId);
  const [facetResult, priorityResult] = await Promise.allSettled([
    dataSource.getDirectoryFacets(groupId),
    lookupPreferredEntries(dataSource, groupId, getDirectoryPreferenceEntryIds(preferences.value)),
  ]);
  if (context !== contextSequence) return;

  if (facetResult.status === 'fulfilled') facets.value = facetResult.value;
  else {
    errorMessage.value = toUserMessage(
      facetResult.reason,
      `${directoryTitle.value}筛选项暂时无法加载，请稍后重试。`,
    );
  }

  if (priorityResult.status === 'fulfilled') priorityEntries.value = priorityResult.value;
}

async function loadEntries(append: boolean): Promise<void> {
  if (!hasDirectoryCriteria.value) {
    resetSearchResults();
    return;
  }
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
  if (!hasDirectoryCriteria.value) {
    resetSearchResults();
    return;
  }
  isLoading.value = true;
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
  const snapshot = facets.value;
  if (snapshot === undefined) return;
  const result = updateDirectoryFilterSelection(snapshot, filters.value, key, value);
  filters.value = result.filters;
  filterAdjustmentMessage.value =
    result.clearedKeys.length === 0
      ? undefined
      : `已自动清除不再适用的${result.clearedKeys.map((clearedKey) => filterLabels.value[clearedKey]).join('、')}筛选。`;
  void loadEntries(false);
}

function clearAllFilters(): void {
  if (activeFilterCount.value === 0) return;
  filters.value = {};
  filterAdjustmentMessage.value = undefined;
  void loadEntries(false);
}

function resetDirectorySearch(): void {
  if (searchTimer !== undefined) window.clearTimeout(searchTimer);
  searchDraft.value = '';
  filters.value = {};
  filterAdjustmentMessage.value = undefined;
  resetSearchResults();
}

function resetSearchResults(): void {
  requestSequence += 1;
  entries.value = [];
  nextCursor.value = undefined;
  totalCount.value = 0;
  isLoading.value = false;
  isLoadingMore.value = false;
  errorMessage.value = undefined;
}

function openFilterAt(key: DirectoryFilterKey): void {
  expandFilterSection(key);
  pendingFilterKey = key;
  filterSheetVisible.value = true;
}

function isFilterSectionExpanded(key: DirectoryFilterKey): boolean {
  return !collapsedFilterKeys.value.has(key);
}

function expandFilterSection(key: DirectoryFilterKey): void {
  if (!collapsedFilterKeys.value.has(key)) return;
  const nextKeys = new Set(collapsedFilterKeys.value);
  nextKeys.delete(key);
  collapsedFilterKeys.value = nextKeys;
}

function toggleFilterSection(key: DirectoryFilterKey): void {
  const nextKeys = new Set(collapsedFilterKeys.value);
  if (nextKeys.has(key)) nextKeys.delete(key);
  else nextKeys.add(key);
  collapsedFilterKeys.value = nextKeys;
}

function setFilterSectionElement(key: DirectoryFilterKey, value: unknown): void {
  if (value instanceof HTMLElement) filterSectionElements.set(key, value);
  else filterSectionElements.delete(key);
}

function toggleFavorite(group: DirectoryEntryDisplayGroup): void {
  rememberPriorityEntries(group);
  preferences.value = toggleDirectoryFavorite(preferences.value, group);
  persistDirectoryPreferences(props.group.id, preferences.value);
}

function recordDirectoryUse(group: DirectoryEntryDisplayGroup, motionId: string): void {
  playPhoneMotion(motionId);
  rememberPriorityEntries(group);
  preferences.value = recordDirectoryUsePreference(preferences.value, group);
  persistDirectoryPreferences(props.group.id, preferences.value);
}

function phoneMotionId(
  surface: string,
  groupId: string,
  contactId: string,
  channel: 'extension' | 'full',
): string {
  return `${surface}:${groupId}:${contactId}:${channel}`;
}

function phoneMotionKey(motionId: string): number {
  return phoneMotionKeys[motionId] ?? 0;
}

function playPhoneMotion(motionId: string): void {
  phoneMotionKeys[motionId] = phoneMotionKey(motionId) + 1;
}

function rememberPriorityEntries(group: DirectoryEntryDisplayGroup): void {
  const entriesById = new Map(priorityEntries.value.map((entry) => [entry.id, entry]));
  for (const entry of group.entries) entriesById.set(entry.id, entry);
  priorityEntries.value = [...entriesById.values()];
}

function getContactHeading(contact: DirectoryContactMethod, isMerged: boolean): string {
  return (isMerged ? undefined : contact.label) ?? getDirectoryNumberLabel(contact.type, 'full');
}

function shouldShowContactLabel(contact: DirectoryContactMethod, isMerged: boolean): boolean {
  if (directoryKind.value === 'internal') return false;
  const heading = getContactHeading(contact, isMerged);
  return !(
    directoryKind.value === 'employee' &&
    (contact.type === 'mobile' || heading.startsWith('移动电话'))
  );
}

function selectedFilterLabel(section: FilterSection): string {
  const value = filters.value[section.key];
  if (value === undefined) return '全部';
  return section.options.find((option) => option.value === value)?.label ?? value;
}

function directoryPreferenceStorageKey(groupId: string): string {
  return `schedule.directory.preferences.v1:${groupId}`;
}

function readDirectoryPreferences(groupId: string): DirectoryPreferences {
  if (typeof globalThis.localStorage === 'undefined') return parseDirectoryPreferences(undefined);
  try {
    return parseDirectoryPreferences(
      globalThis.localStorage.getItem(directoryPreferenceStorageKey(groupId)) ?? undefined,
    );
  } catch {
    return parseDirectoryPreferences(undefined);
  }
}

function persistDirectoryPreferences(groupId: string, value: DirectoryPreferences): void {
  if (typeof globalThis.localStorage === 'undefined') return;
  try {
    globalThis.localStorage.setItem(directoryPreferenceStorageKey(groupId), JSON.stringify(value));
  } catch {
    // 收藏仍在当前页面有效；浏览器拒绝存储时不阻断拨号和检索。
  }
}

async function lookupPreferredEntries(
  dataSource: DirectoryDataSource,
  groupId: string,
  entryIds: readonly string[],
): Promise<readonly DirectoryEntry[]> {
  const chunks = Array.from({ length: Math.ceil(entryIds.length / 100) }, (_, index) =>
    entryIds.slice(index * 100, index * 100 + 100),
  );
  const pages = await Promise.all(
    chunks.map((chunk) => dataSource.lookupDirectoryEntries(groupId, chunk)),
  );
  return pages.flat();
}
</script>

<template>
  <section class="internal-directory" aria-labelledby="directory-title">
    <h2 id="directory-title" class="visually-hidden">{{ directoryTitle }}</h2>

    <section class="directory-wayfinding" aria-labelledby="wayfinding-title">
      <div class="wayfinding-header">
        <div>
          <p id="wayfinding-title">院区导览</p>
        </div>
        <div class="wayfinding-actions">
          <button
            v-if="activeFilterCount > 0"
            type="button"
            class="clear-filter-action"
            aria-label="清除全部筛选"
            @click="clearAllFilters"
          >
            清除全部
          </button>
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
      </div>
      <div class="wayfinding-ribbon" :aria-label="`${directoryTitle}筛选层级`">
        <button
          v-for="(section, index) in filterSections"
          :key="section.key"
          type="button"
          class="wayfinding-stop"
          :data-filter-key="section.key"
          :class="{ 'is-selected': filters[section.key] !== undefined }"
          :aria-pressed="filters[section.key] !== undefined"
          @click="openFilterAt(section.key)"
        >
          <span class="stop-index" aria-hidden="true">{{ index + 1 }}</span>
          <span class="stop-copy">
            <small>{{ section.label }}</small>
            <strong>{{ selectedFilterLabel(section) }}</strong>
          </span>
        </button>
      </div>
    </section>

    <form class="directory-search" role="search" @submit.prevent="runSearchImmediately">
      <SearchIcon aria-hidden="true" />
      <label for="hospital-directory-search" class="visually-hidden"
        >搜索{{ directoryTitle }}</label
      >
      <input
        id="hospital-directory-search"
        v-model="searchDraft"
        type="search"
        inputmode="search"
        autocomplete="off"
        enterkeyhint="search"
        :placeholder="
          directoryKind === 'employee'
            ? '搜索姓名、级别、工号、拼音、首字母或号码'
            : '搜索科室、姓名、拼音或号码'
        "
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

    <div v-if="errorMessage !== undefined" class="directory-error" role="alert">
      <div>
        <strong>{{ directoryTitle }}未能更新</strong>
        <p>{{ errorMessage }}</p>
      </div>
      <button
        type="button"
        @click="facets === undefined ? initializeDirectory() : loadEntries(false)"
      >
        重新加载
      </button>
    </div>

    <section
      v-if="hasDirectoryCriteria"
      class="directory-search-results"
      :aria-label="`${directoryTitle}搜索结果`"
    >
      <p class="result-status" role="status" aria-live="polite">
        {{ resultSummary }}
        <span v-if="isLoading && entries.length > 0"> · 正在更新</span>
      </p>

      <div v-if="isLoading && entries.length === 0" class="directory-skeleton" aria-hidden="true">
        <span v-for="index in 4" :key="index" />
      </div>

      <div v-else-if="displayGroups.length > 0" class="directory-results" :aria-busy="isLoading">
        <article
          v-for="entryGroup in displayGroups"
          :key="entryGroup.id"
          class="directory-entry"
          :class="{ 'is-merged': entryGroup.entries.length > 1 }"
        >
          <div class="entry-accent" aria-hidden="true" />
          <div class="entry-content">
            <header class="entry-heading">
              <div class="entry-heading-copy">
                <div class="entry-title-line">
                  <h3>{{ getDirectoryGroupTitle(entryGroup) }}</h3>
                  <span class="entry-kind">{{ getDirectoryGroupKindLabel(entryGroup) }}</span>
                  <span
                    v-for="jobTitle in getDirectoryGroupJobTitles(entryGroup)"
                    :key="jobTitle"
                    class="entry-job-title"
                  >
                    {{ jobTitle }}
                  </span>
                  <span
                    v-if="getDirectoryGroupEmployeeCodes(entryGroup).length > 0"
                    class="entry-employee-code"
                  >
                    工号 {{ getDirectoryGroupEmployeeCodes(entryGroup).join(' / ') }}
                  </span>
                  <span v-if="entryGroup.entries.length > 1" class="entry-merge-count">
                    {{ entryGroup.entries.length }} 项同号
                  </span>
                </div>
                <div v-if="getDirectoryGroupContexts(entryGroup).length > 0" class="entry-contexts">
                  <p
                    v-for="context in getDirectoryGroupContexts(entryGroup)"
                    :key="context"
                    class="entry-meta"
                  >
                    {{ context }}
                  </p>
                </div>
              </div>
              <button
                type="button"
                class="favorite-action"
                :class="{ 'is-favorite': isDirectoryGroupFavorite(preferences, entryGroup) }"
                :aria-label="
                  isDirectoryGroupFavorite(preferences, entryGroup)
                    ? `取消收藏${getDirectoryGroupTitle(entryGroup)}`
                    : `收藏${getDirectoryGroupTitle(entryGroup)}`
                "
                :aria-pressed="isDirectoryGroupFavorite(preferences, entryGroup)"
                @click="toggleFavorite(entryGroup)"
              >
                <StarFilledIcon
                  v-if="isDirectoryGroupFavorite(preferences, entryGroup)"
                  aria-hidden="true"
                />
                <StarIcon v-else aria-hidden="true" />
              </button>
            </header>

            <div class="contact-methods">
              <div
                v-for="contact in entryGroup.contacts"
                :key="contact.id"
                class="contact-method"
                :class="{
                  'has-contact-label': shouldShowContactLabel(
                    contact,
                    entryGroup.entries.length > 1,
                  ),
                }"
              >
                <span
                  v-if="shouldShowContactLabel(contact, entryGroup.entries.length > 1)"
                  class="contact-label"
                >
                  {{ getContactHeading(contact, entryGroup.entries.length > 1) }}
                </span>
                <div class="contact-number-group">
                  <a
                    v-if="
                      contact.fullNumber !== undefined &&
                      canDialDirectoryNumber(contact.type, 'full')
                    "
                    class="directory-dial-action"
                    :href="toDirectoryDialHref(contact.fullNumber)"
                    :aria-label="`拨打${getDirectoryGroupTitle(entryGroup)}的${getDirectoryNumberLabel(contact.type, 'full')} ${contact.fullNumber}`"
                    @click="
                      recordDirectoryUse(
                        entryGroup,
                        phoneMotionId('results', entryGroup.id, contact.id, 'full'),
                      )
                    "
                  >
                    <small v-if="getSafeInternalExtension(contact) !== undefined">长号</small>
                    <strong>{{ contact.fullNumber }}</strong>
                    <LucideMinimalActionIcon
                      class="phone-motion-icon"
                      name="phone"
                      :motion-key="
                        phoneMotionKey(phoneMotionId('results', entryGroup.id, contact.id, 'full'))
                      "
                    />
                  </a>
                  <strong
                    v-else-if="contact.fullNumber !== undefined"
                    class="directory-static-number"
                  >
                    <small v-if="getSafeInternalExtension(contact) !== undefined">长号</small>
                    <span>{{ contact.fullNumber }}</span>
                  </strong>
                  <a
                    v-if="
                      getSafeInternalExtension(contact) !== undefined &&
                      canDialDirectoryNumber(contact.type, 'extension')
                    "
                    class="directory-dial-action"
                    :href="toDirectoryDialHref(getSafeInternalExtension(contact)!)"
                    :aria-label="`拨打${getDirectoryGroupTitle(entryGroup)}的${getDirectoryNumberLabel(contact.type, 'extension')} ${getSafeInternalExtension(contact)}`"
                    @click="
                      recordDirectoryUse(
                        entryGroup,
                        phoneMotionId('results', entryGroup.id, contact.id, 'extension'),
                      )
                    "
                  >
                    <small>短号</small>
                    <strong>{{ getSafeInternalExtension(contact) }}</strong>
                    <LucideMinimalActionIcon
                      class="phone-motion-icon"
                      name="phone"
                      :motion-key="
                        phoneMotionKey(
                          phoneMotionId('results', entryGroup.id, contact.id, 'extension'),
                        )
                      "
                    />
                  </a>
                  <strong
                    v-else-if="getSafeInternalExtension(contact) !== undefined"
                    class="directory-static-number is-extension"
                  >
                    <small>短号</small>
                    <span>{{ getSafeInternalExtension(contact) }}</span>
                  </strong>
                </div>
              </div>
            </div>

            <p v-if="getDirectoryGroupNotes(entryGroup) !== undefined" class="entry-notes">
              {{ getDirectoryGroupNotes(entryGroup) }}
            </p>
          </div>
        </article>
      </div>

      <div v-else-if="!isLoading && errorMessage === undefined" class="directory-empty">
        <SearchIcon aria-hidden="true" />
        <strong>没有找到匹配号码</strong>
        <p>可缩短搜索词，或清除部分层级筛选后重试。</p>
        <button type="button" @click="resetDirectorySearch">清空搜索和筛选</button>
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
    </section>

    <section
      v-if="prioritySections.length > 0"
      class="directory-priority"
      aria-label="收藏和常用通讯录"
    >
      <div v-for="section in prioritySections" :key="section.key" class="priority-section">
        <header class="priority-heading">
          <h3>{{ section.title }}</h3>
          <span>{{ section.groups.length }} 项</span>
        </header>
        <div class="priority-grid directory-results">
          <article
            v-for="entryGroup in section.groups"
            :key="entryGroup.id"
            class="directory-entry"
            :class="{ 'is-merged': entryGroup.entries.length > 1 }"
          >
            <div class="entry-accent" aria-hidden="true" />
            <div class="entry-content">
              <header class="entry-heading">
                <div class="entry-heading-copy">
                  <div class="entry-title-line">
                    <h3>{{ getDirectoryGroupTitle(entryGroup) }}</h3>
                    <span class="entry-kind">{{ getDirectoryGroupKindLabel(entryGroup) }}</span>
                    <span
                      v-for="jobTitle in getDirectoryGroupJobTitles(entryGroup)"
                      :key="jobTitle"
                      class="entry-job-title"
                    >
                      {{ jobTitle }}
                    </span>
                    <span
                      v-if="getDirectoryGroupEmployeeCodes(entryGroup).length > 0"
                      class="entry-employee-code"
                    >
                      工号 {{ getDirectoryGroupEmployeeCodes(entryGroup).join(' / ') }}
                    </span>
                    <span v-if="entryGroup.entries.length > 1" class="entry-merge-count">
                      {{ entryGroup.entries.length }} 项同号
                    </span>
                  </div>
                  <div
                    v-if="getDirectoryGroupContexts(entryGroup).length > 0"
                    class="entry-contexts"
                  >
                    <p
                      v-for="context in getDirectoryGroupContexts(entryGroup)"
                      :key="context"
                      class="entry-meta"
                    >
                      {{ context }}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  class="favorite-action"
                  :class="{ 'is-favorite': isDirectoryGroupFavorite(preferences, entryGroup) }"
                  :aria-label="
                    isDirectoryGroupFavorite(preferences, entryGroup)
                      ? `取消收藏${getDirectoryGroupTitle(entryGroup)}`
                      : `收藏${getDirectoryGroupTitle(entryGroup)}`
                  "
                  :aria-pressed="isDirectoryGroupFavorite(preferences, entryGroup)"
                  @click="toggleFavorite(entryGroup)"
                >
                  <StarFilledIcon
                    v-if="isDirectoryGroupFavorite(preferences, entryGroup)"
                    aria-hidden="true"
                  />
                  <StarIcon v-else aria-hidden="true" />
                </button>
              </header>

              <div class="contact-methods">
                <div
                  v-for="contact in entryGroup.contacts"
                  :key="contact.id"
                  class="contact-method"
                  :class="{
                    'has-contact-label': shouldShowContactLabel(
                      contact,
                      entryGroup.entries.length > 1,
                    ),
                  }"
                >
                  <span
                    v-if="shouldShowContactLabel(contact, entryGroup.entries.length > 1)"
                    class="contact-label"
                  >
                    {{ getContactHeading(contact, entryGroup.entries.length > 1) }}
                  </span>
                  <div class="contact-number-group">
                    <a
                      v-if="
                        contact.fullNumber !== undefined &&
                        canDialDirectoryNumber(contact.type, 'full')
                      "
                      class="directory-dial-action"
                      :href="toDirectoryDialHref(contact.fullNumber)"
                      :aria-label="`拨打${getDirectoryGroupTitle(entryGroup)}的${getDirectoryNumberLabel(contact.type, 'full')} ${contact.fullNumber}`"
                      @click="
                        recordDirectoryUse(
                          entryGroup,
                          phoneMotionId(section.key, entryGroup.id, contact.id, 'full'),
                        )
                      "
                    >
                      <small v-if="getSafeInternalExtension(contact) !== undefined">长号</small>
                      <strong>{{ contact.fullNumber }}</strong>
                      <LucideMinimalActionIcon
                        class="phone-motion-icon"
                        name="phone"
                        :motion-key="
                          phoneMotionKey(
                            phoneMotionId(section.key, entryGroup.id, contact.id, 'full'),
                          )
                        "
                      />
                    </a>
                    <strong
                      v-else-if="contact.fullNumber !== undefined"
                      class="directory-static-number"
                    >
                      <small v-if="getSafeInternalExtension(contact) !== undefined">长号</small>
                      <span>{{ contact.fullNumber }}</span>
                    </strong>
                    <a
                      v-if="
                        getSafeInternalExtension(contact) !== undefined &&
                        canDialDirectoryNumber(contact.type, 'extension')
                      "
                      class="directory-dial-action"
                      :href="toDirectoryDialHref(getSafeInternalExtension(contact)!)"
                      :aria-label="`拨打${getDirectoryGroupTitle(entryGroup)}的${getDirectoryNumberLabel(contact.type, 'extension')} ${getSafeInternalExtension(contact)}`"
                      @click="
                        recordDirectoryUse(
                          entryGroup,
                          phoneMotionId(section.key, entryGroup.id, contact.id, 'extension'),
                        )
                      "
                    >
                      <small>短号</small>
                      <strong>{{ getSafeInternalExtension(contact) }}</strong>
                      <LucideMinimalActionIcon
                        class="phone-motion-icon"
                        name="phone"
                        :motion-key="
                          phoneMotionKey(
                            phoneMotionId(section.key, entryGroup.id, contact.id, 'extension'),
                          )
                        "
                      />
                    </a>
                    <strong
                      v-else-if="getSafeInternalExtension(contact) !== undefined"
                      class="directory-static-number is-extension"
                    >
                      <small>短号</small>
                      <span>{{ getSafeInternalExtension(contact) }}</span>
                    </strong>
                  </div>
                </div>
              </div>

              <p v-if="getDirectoryGroupNotes(entryGroup) !== undefined" class="entry-notes">
                {{ getDirectoryGroupNotes(entryGroup) }}
              </p>
            </div>
          </article>
        </div>
      </div>
    </section>

    <p class="directory-privacy-note">
      {{
        directoryKind === 'employee' ? '员工联系方式' : '院内联系方式'
      }}仅供工作使用，请勿向院外转发。
    </p>

    <ResponsiveSheet
      v-model:visible="filterSheetVisible"
      class="directory-filter-sheet"
      :title="`筛选${directoryTitle}`"
    >
      <div class="filter-sheet-toolbar">
        <button
          type="button"
          class="sheet-reset-action"
          :disabled="activeFilterCount === 0"
          @click="clearAllFilters"
        >
          <FilterClearIcon aria-hidden="true" />
          <span>清除全部筛选</span>
          <small v-if="activeFilterCount > 0">已选 {{ activeFilterCount }} 项</small>
        </button>
        <span
          v-if="filterAdjustmentMessage !== undefined"
          class="filter-adjustment visually-hidden"
          role="status"
        >
          {{ filterAdjustmentMessage }}
        </span>
      </div>
      <div class="directory-filter-grid">
        <section
          v-for="section in filterSections"
          :key="section.key"
          :ref="(value) => setFilterSectionElement(section.key, value)"
          class="filter-section"
          data-filter-section
          :aria-labelledby="`directory-filter-${section.key}`"
          tabindex="-1"
        >
          <header>
            <h3 :id="`directory-filter-${section.key}`">
              <button
                type="button"
                class="filter-section-toggle"
                :aria-controls="`directory-filter-options-${section.key}`"
                :aria-expanded="isFilterSectionExpanded(section.key)"
                @click="toggleFilterSection(section.key)"
              >
                <span class="filter-section-copy">
                  <strong>{{ section.label }}</strong>
                  <small
                    >{{ selectedFilterLabel(section) }} · {{ section.options.length }} 项</small
                  >
                </span>
                <ChevronRightIcon
                  aria-hidden="true"
                  :class="{ 'is-expanded': isFilterSectionExpanded(section.key) }"
                />
              </button>
            </h3>
          </header>
          <div
            v-show="isFilterSectionExpanded(section.key)"
            :id="`directory-filter-options-${section.key}`"
            class="filter-options"
          >
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
            <p v-if="section.options.length === 0" class="filter-options-empty">
              当前上级下无可选项
            </p>
          </div>
        </section>
      </div>
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

.directory-search {
  display: grid;
  min-height: 50px;
  grid-template-columns: 24px minmax(0, 1fr) auto auto;
  padding: 4px 5px 4px 16px;
  align-items: center;
  gap: 8px;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border-strong);
  border-radius: 14px;
  box-shadow: none;
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
  min-width: 0;
  padding: 12px;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-large);
  box-shadow: 0 6px 18px rgb(22 32 42 / 5%);
}

.wayfinding-header {
  display: flex;
  padding: 0 2px 8px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.wayfinding-header p {
  margin: 0;
  font-weight: var(--ui-font-weight-semibold);
}

.wayfinding-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
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
  grid-template-columns: repeat(auto-fit, minmax(112px, 1fr));
  gap: 6px;
}

.wayfinding-stop {
  display: grid;
  min-height: 46px;
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
  padding: 0 10px;
  color: var(--ui-color-primary);
  background: transparent;
  border: 0;
}

.result-status {
  margin: 0 4px -6px;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
}

.directory-search-results {
  display: grid;
  min-width: 0;
  gap: 16px;
}

.directory-priority {
  display: grid;
  gap: 12px;
}

.priority-section {
  display: grid;
  gap: 6px;
}

.priority-heading {
  display: flex;
  padding: 0 2px;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.priority-heading h3 {
  margin: 0;
  font-size: var(--ui-font-size-sm);
}

.priority-heading span {
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-xs);
}

.priority-grid {
  width: 100%;
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
  margin: 9px 0;
  background: var(--ui-color-primary);
  border-radius: 0 4px 4px 0;
  opacity: 0.76;
}

.entry-content {
  min-width: 0;
  padding: 10px 14px 9px;
}

.entry-heading {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 44px;
  align-items: start;
  gap: 2px;
}

.entry-heading-copy {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.favorite-action {
  display: grid;
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  place-items: center;
  color: var(--ui-color-text-muted);
  background: transparent;
  border: 0;
  border-radius: var(--ui-radius-small);
  cursor: pointer;
}

.favorite-action:hover,
.favorite-action:active {
  background: #fff6d8;
}

.favorite-action.is-favorite {
  color: #d49300;
}

.favorite-action svg {
  width: 21px;
  height: 21px;
}

.entry-title-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.entry-title-line h3 {
  margin: 0;
  font-size: var(--ui-font-size-md);
  line-height: 1.25;
}

.entry-kind {
  padding: 2px 6px;
  color: var(--ui-color-primary);
  background: var(--ui-color-primary-light);
  border-radius: var(--ui-radius-pill);
  font-size: 11px;
  font-weight: var(--ui-font-weight-semibold);
}

.entry-job-title {
  padding: 2px 7px;
  color: var(--ui-color-text-primary);
  background: var(--ui-color-surface-muted);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-pill);
  font-size: 11px;
  font-weight: var(--ui-font-weight-semibold);
}

.entry-employee-code {
  color: var(--ui-color-text-secondary);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.entry-merge-count {
  color: #39745d;
  font-size: 11px;
  font-weight: var(--ui-font-weight-semibold);
}

.directory-entry.is-merged .entry-accent {
  background: #3a9e7a;
}

.entry-contexts {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.entry-meta {
  overflow: hidden;
  margin: 0;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.contact-methods {
  display: grid;
  margin-top: 5px;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2px 14px;
}

.contact-method {
  display: grid;
  min-width: 0;
  min-height: 44px;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  border-top: 1px solid var(--ui-color-border);
}

.contact-method.has-contact-label {
  grid-template-columns: minmax(62px, auto) minmax(0, 1fr);
}

.contact-label {
  overflow: hidden;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.contact-number-group {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: nowrap;
}

.directory-dial-action {
  display: inline-flex;
  min-width: 0;
  min-height: 44px;
  padding: 0 5px;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  color: var(--ui-color-primary);
  border-radius: var(--ui-radius-small);
  font-variant-numeric: tabular-nums;
  text-decoration: none;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.directory-dial-action:active {
  background: transparent;
}

.directory-dial-action:focus-visible {
  outline: 2px solid var(--ui-color-primary);
  outline-offset: 2px;
}

.directory-dial-action .phone-motion-icon {
  --action-motion-icon-size: 17px;
  flex: 0 0 auto;
}

.directory-dial-action strong,
.directory-static-number {
  overflow-wrap: normal;
  white-space: nowrap;
}

.directory-dial-action small,
.directory-static-number small {
  color: var(--ui-color-text-muted);
  font-size: 10px;
  font-weight: var(--ui-font-weight-regular);
}

.directory-static-number {
  display: inline-flex;
  min-width: 0;
  min-height: 44px;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  color: var(--ui-color-text-primary);
  font-variant-numeric: tabular-nums;
}

.directory-static-number.is-extension {
  color: var(--ui-color-text-secondary);
}

.entry-notes {
  margin: 2px 0 0;
  padding: 3px 0 0;
  color: var(--ui-color-text-secondary);
  border-top: 1px dashed var(--ui-color-border);
  font-size: var(--ui-font-size-xs);
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
  height: 76px;
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

.filter-sheet-toolbar {
  position: sticky;
  z-index: 2;
  top: 0;
  padding: 4px 0 8px;
  background: var(--ui-color-surface);
}

:deep(.directory-filter-sheet) {
  height: min(840px, calc(100dvh - 24px));
  max-height: min(840px, calc(100dvh - 24px));
}

:deep(.directory-filter-sheet .responsive-sheet-panel) {
  height: 100%;
}

:deep(.directory-filter-sheet .responsive-sheet-content) {
  min-height: 0;
  flex: 1;
}

.directory-filter-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
}

.filter-section header {
  display: block;
}

.filter-section {
  padding-bottom: 8px;
  scroll-margin-top: 58px;
  border-bottom: 1px solid var(--ui-color-border);
  outline: 0;
}

.filter-section:focus-visible {
  box-shadow: 0 0 0 3px var(--ui-color-primary-light);
  border-radius: var(--ui-radius-small);
}

.filter-section h3 {
  margin: 0;
}

.filter-section-toggle {
  display: flex;
  width: 100%;
  min-height: 48px;
  padding: 4px 8px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--ui-color-text-primary);
  background: transparent;
  border: 0;
  border-radius: var(--ui-radius-small);
  cursor: pointer;
  text-align: left;
}

.filter-section-toggle:hover,
.filter-section-toggle:active {
  background: var(--ui-color-surface-muted);
}

.filter-section-copy {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.filter-section-copy strong {
  font-size: var(--ui-font-size-md);
}

.filter-section-copy small {
  overflow: hidden;
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-regular);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filter-section-toggle svg {
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
  color: var(--ui-color-text-muted);
  transition: transform var(--ui-duration-fast) ease;
}

.filter-section-toggle svg.is-expanded {
  transform: rotate(90deg);
}

.filter-options {
  display: grid;
  max-height: 280px;
  padding: 0 4px 4px;
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
  display: grid;
  width: 100%;
  min-width: 0;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  padding: 0 12px;
  align-items: center;
  gap: 8px;
  color: var(--ui-color-primary);
  background: var(--ui-color-primary-light);
  border: 0;
  white-space: nowrap;
}

.sheet-reset-action svg {
  width: 20px;
  height: 20px;
}

.sheet-reset-action span {
  text-align: left;
}

.sheet-reset-action small {
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-regular);
}

.sheet-reset-action:disabled {
  cursor: default;
  opacity: 0.45;
}

.filter-options-empty {
  margin: 0;
  padding: 10px;
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-sm);
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
  .directory-search {
    grid-template-columns: 22px minmax(0, 1fr) auto;
    padding-right: 7px;
  }

  .search-submit {
    display: none;
  }

  .directory-wayfinding {
    margin-right: 0;
    margin-left: 0;
    padding-right: 12px;
    padding-left: 12px;
    border-right: 1px solid var(--ui-color-border);
    border-left: 1px solid var(--ui-color-border);
    border-radius: var(--ui-radius-large);
  }

  .wayfinding-actions {
    gap: 0;
  }

  .clear-filter-action {
    padding: 0 7px;
    font-size: var(--ui-font-size-sm);
  }

  .filter-open-action > span {
    display: none;
  }

  .wayfinding-ribbon {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .wayfinding-stop {
    min-height: 48px;
    padding: 5px 7px;
  }

  .entry-content {
    padding: 9px 11px 8px;
  }

  .contact-methods {
    grid-template-columns: 1fr;
    gap: 1px;
  }

  :deep(.directory-filter-sheet) {
    height: min(92dvh, 840px);
    max-height: min(92dvh, 840px);
  }

  .filter-options {
    max-height: none;
  }

  .directory-error {
    display: grid;
  }
}

@media (max-width: 380px) {
  .contact-method.has-contact-label {
    grid-template-columns: minmax(58px, auto) minmax(0, 1fr);
    gap: 5px;
  }

  .contact-number-group {
    gap: 6px;
  }

  .directory-dial-action {
    padding-right: 3px;
    padding-left: 3px;
  }
}

@media (hover: hover) and (pointer: fine) {
  .directory-dial-action:hover {
    background: var(--ui-color-primary-light);
  }
}

@media (prefers-reduced-motion: reduce) {
  .directory-skeleton span,
  .filter-section-toggle svg {
    animation: none;
    transition: none;
  }
}
</style>
