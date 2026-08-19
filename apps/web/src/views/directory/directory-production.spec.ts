import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('production hospital directory integration', () => {
  it('mounts one unified directory view from one workbench entry', () => {
    const home = source('../HomeView.vue');
    const navigation = source('../../features/layout/workbench-nav.ts');

    expect(navigation).toContain("id: 'directory'");
    expect(navigation).toContain("label: '通讯录'");
    expect(navigation).not.toContain("id: 'employee-directory'");
    expect(home).toContain(
      "import UnifiedDirectoryView from './directory/UnifiedDirectoryView.vue'",
    );
    expect(home).toContain("activeTab === 'directory'");
    expect(home).not.toContain("activeTab === 'employee-directory'");
  });

  it('switches between the original authenticated datasets without duplicating their logic', () => {
    const unified = source('./UnifiedDirectoryView.vue');

    expect(unified).toContain('role="tablist"');
    expect(unified).toContain('科室');
    expect(unified).toContain('人员');
    expect(unified).toContain('<KeepAlive>');
    expect(unified).toContain('getDirectoryFacets');
    expect(unified).toContain('searchDirectory');
    expect(unified).toContain('getEmployeeDirectoryFacets');
    expect(unified).toContain('searchEmployeeDirectory');
    expect(unified).toContain("directoryKind: 'internal'");
    expect(unified).toContain("directoryKind: 'employee'");
    expect(unified).toContain('InternalDirectoryView');
  });

  it('keeps directory mode switching on explicit controls without page swipes', () => {
    const unified = source('./UnifiedDirectoryView.vue');

    expect(unified).toContain('directory-mode-indicator');
    expect(unified).not.toContain('@pointerdown="handleModePointerDown"');
    expect(unified).not.toContain('@pointerup="handleModePointerUp"');
    expect(unified).not.toContain('@pointercancel="handleModePointerCancel"');
    expect(unified).not.toContain('getDirectorySwipeTarget');
    expect(unified).toContain('mode-transition-forward');
    expect(unified).toContain('mode-transition-backward');
  });

  it('removes the confirmed decorative directory copy and blue guide strip', () => {
    const unified = source('./UnifiedDirectoryView.vue');
    const internal = source('./InternalDirectoryView.vue');

    expect(unified).not.toContain('院内协作');
    expect(unified).not.toContain('查科室分机，或按姓名找到人员。');
    expect(internal).not.toContain('可从任意一级开始，选定上级后只显示匹配下级');
    expect(internal).not.toContain('directory-wayfinding::before');
  });

  it('uses the authenticated API as the production data source', () => {
    const view = source('./InternalDirectoryView.vue');

    expect(view).toContain('createApiClient({ auth: localAuth })');
    expect(view).toContain('getDirectoryFacets');
    expect(view).toContain('searchDirectory');
    expect(view).toContain('updateDirectoryFilterSelection');
    expect(view).toContain('groupDirectoryEntriesByContact');
    expect(view).toContain('lookupDirectoryEntries');
  });

  it('keeps the wayfinding compact, removes empty levels, and locates the requested filter section', () => {
    const view = source('./InternalDirectoryView.vue');

    expect(view).toContain('getMeaningfulDirectoryFilterKeys');
    expect(view).toContain('@click="openFilterAt(section.key)"');
    expect(view).toContain('scrollIntoView');
    expect(view).toContain('data-filter-section');
    expect(view).toMatch(/\.wayfinding-ribbon\s*{[^}]*grid-template-columns:\s*repeat\(auto-fit,/s);
    expect(view).not.toMatch(/\.wayfinding-ribbon\s*{[^}]*overflow-x:\s*auto/s);
  });

  it('uses a taller filter sheet with a sticky flat reset and collapsible levels', () => {
    const view = source('./InternalDirectoryView.vue');

    expect(view).toContain('class="directory-filter-sheet"');
    expect(view).not.toContain('层级联动，避免无效组合');
    expect(view).not.toContain('可跳级开始；选定上级后只显示匹配下级。');
    expect(view).toContain('FilterClearIcon');
    expect(view).toContain(':aria-expanded="isFilterSectionExpanded(section.key)"');
    expect(view).toContain('ChevronRightIcon');
    expect(view).toContain('v-show="isFilterSectionExpanded(section.key)"');
    expect(view).toMatch(/\.sheet-reset-action\s*{[^}]*width:\s*100%/s);
    expect(view).toMatch(/:deep\(\.directory-filter-sheet\)\s*{[^}]*max-height:/s);
  });

  it('shows full favorite and frequent cards below active results, while idle mode does not load all entries', () => {
    const view = source('./InternalDirectoryView.vue');

    expect(view).toContain('StarFilledIcon');
    expect(view).toContain('toggleFavorite');
    expect(view).toContain('recordDirectoryUse');
    expect(view).toContain('hasActiveDirectoryCriteria');
    expect(view).toContain('收藏通讯录');
    expect(view).toContain('常用通讯录');
    expect(view).not.toContain("dataSource.searchDirectory(groupId, toDirectoryQuery('', {}))");
    expect(view).not.toContain('class="priority-card"');
    expect(view).not.toContain('getPriorityContact');
    expect(view.indexOf('class="directory-search-results"')).toBeLessThan(
      view.indexOf('class="directory-priority"'),
    );
    expect(view.match(/class="directory-entry"/gu)).toHaveLength(2);
    expect(view.match(/class="contact-methods"/gu)).toHaveLength(2);
    expect(view).toMatch(/\.favorite-action\s*{[^}]*min-width:\s*44px/s);
  });

  it('places wayfinding above search without the old collaboration capsule', () => {
    const view = source('./InternalDirectoryView.vue');

    expect(view).not.toContain('class="directory-heading"');
    expect(view).not.toContain('院内协作');
    expect(view.indexOf('class="directory-wayfinding"')).toBeLessThan(
      view.indexOf('class="directory-search"'),
    );
  });

  it('keeps touch dialing transparent without losing keyboard focus feedback', () => {
    const view = source('./InternalDirectoryView.vue');

    expect(view).toContain('-webkit-tap-highlight-color: transparent');
    expect(view).toMatch(/\.directory-dial-action:active\s*{[^}]*background:\s*transparent/s);
    expect(view).toContain('@media (hover: hover) and (pointer: fine)');
    expect(view).toMatch(/\.directory-dial-action:focus-visible\s*{[^}]*outline:/s);
  });

  it('gives employee phone rows full width without generic mobile labels or wrapped numbers', () => {
    const view = source('./InternalDirectoryView.vue');

    expect(view).toContain('function shouldShowContactLabel');
    expect(view).toContain("directoryKind.value === 'employee' &&");
    expect(view).toContain('v-if="shouldShowContactLabel(contact, entryGroup.entries.length > 1)"');
    expect(view).toMatch(/:class="\{[\s\S]*?has-contact-label[\s\S]*?shouldShowContactLabel\(/s);
    expect(view).toMatch(
      /\.contact-method\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);[^}]*}/s,
    );
    expect(view).toMatch(
      /\.contact-method\.has-contact-label\s*{[^}]*grid-template-columns:\s*minmax\(62px, auto\) minmax\(0, 1fr\);[^}]*}/s,
    );
    expect(view).toMatch(
      /\.directory-dial-action strong,\s*\.directory-static-number\s*{[^}]*white-space:\s*nowrap;[^}]*}/s,
    );
  });

  it('advertises employee-code search without exposing the removed T9 mode', () => {
    const view = source('./InternalDirectoryView.vue');

    expect(view).toContain("? '搜索姓名、级别、工号、拼音、首字母或号码'");
    expect(view).not.toContain('T9');
  });

  it('keeps the directory in the full browser smoke journey', () => {
    const smoke = source('../../../../../scripts/smoke-browser.mjs');

    expect(smoke).toContain('async function assertHospitalDirectory');
    expect(smoke).toContain("hasText: '通讯录'");
    expect(smoke).toContain("getByRole('tab', { name: '人员' })");
    expect(smoke).toContain('aria-labelledby="directory-filter-department"');
    expect(smoke).toContain('更改上级后未自动清除不匹配的下级筛选');
    expect(smoke).toContain('固定电话短号被错误渲染为拨号链接');
    expect(smoke).toContain('联系方式完全相同的条目未合并显示');
    expect(smoke).toContain('未搜索和未筛选时仍显示了全部通讯录');
    expect(smoke).toContain('收藏通讯录未使用与搜索结果一致的长短号分隔卡片');
    expect(smoke).toContain('拨打电话触控结束后仍遗留背景色方框');
  });
});
