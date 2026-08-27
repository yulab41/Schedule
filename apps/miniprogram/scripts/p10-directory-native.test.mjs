import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(path.join(appRoot, relativePath), 'utf8');
}

describe('P10 native directory parity', () => {
  it('registers the directory route and member-accessible workbench destination', () => {
    const app = JSON.parse(read('src/app.json'));
    const page = read('src/subpackages/organization/pages/directory/index.wxml');
    const panel = read('src/subpackages/organization/components/directory-panel/index.wxml');
    const workbench = read('src/pages/workbench/index.wxml');

    expect(app.subpackages).toContainEqual({
      root: 'subpackages/organization',
      pages: [
        'pages/group-settings/index',
        'pages/scheduling-config/index',
        'pages/invite-visitor/index',
        'pages/platform-accounts/index',
        'pages/directory/index',
      ],
    });
    expect(page.trim()).toBe('<include src="../../components/directory-panel/index.wxml" />');
    expect(panel).toContain('<text>科室</text>');
    expect(panel).toContain('<text>人员</text>');
    expect(panel).toContain('<text class="header-title-main">通讯录</text>');
    expect(panel).toContain('wx:if="{{!embedded}}"');
    expect(workbench).toContain('handleDirectoryNav');
    expect(workbench).toContain('<directory-panel');
    expect(workbench).not.toContain('院内通讯录');
  });

  it('uses the shared reader and stores only owner-scoped favorite/usage preferences', () => {
    const runtime = read('src/platform/client-core-calendar.ts');
    const controller = read(
      'src/subpackages/organization/components/directory-panel/controller.ts',
    );

    expect(runtime).toContain('createRuntimeDirectoryReadClient');
    expect(controller).toContain('getFacets');
    expect(controller).toContain('directoryClient.list');
    expect(controller).toContain("requireClientCapability('organization')");
    expect(controller).toContain('DIRECTORY_PREFERENCES_PREFIX');
    expect(controller).toContain('wx.setStorageSync(key, JSON.stringify(preferences))');
    expect(controller.match(/wx\.setStorageSync/gu)).toHaveLength(1);
    expect(controller).not.toContain('console.log');
    expect(controller).not.toContain('visitorKey');
  });

  it('covers loading, empty, error, disabled, search, seven filters and cursor loading', () => {
    const template = read('src/subpackages/organization/components/directory-panel/index.wxml');
    const card = read('src/subpackages/organization/components/directory-entry-card/index.wxml');
    const controller = read(
      'src/subpackages/organization/components/directory-panel/controller.ts',
    );

    for (const label of [
      '正在读取通讯录',
      '通讯录暂未开放',
      '没有找到匹配号码',
      '未能更新',
      '加载更多',
    ]) {
      expect(template).toContain(label);
    }
    for (const key of [
      'campusCode',
      'section',
      'building',
      'floor',
      'department',
      'subunit',
      'entryKind',
    ]) {
      expect(controller).toContain(`${key}:`);
    }
    expect(controller).toContain('nextCursor');
    expect(controller).toContain('directoryKind');
    expect(controller).toContain('detached(this: DirectoryPageInstance)');
    expect(controller).toContain('fontSizeSetting');
    expect(controller).toContain("campusCode: '组织根'");
    expect(controller).toContain("section: '一级组织'");
    expect(controller).toContain("subunit: '五级组织'");
    expect(controller).toContain('groupDirectoryEntriesByContact');
    expect(controller).toContain('getCompatibleDirectoryFacetOptionsByKey');
    expect(controller).toContain('updateDirectoryFilterSelection');
    expect(template).toContain('class="filter-sheet"');
    expect(template).toContain("largeText ? 'is-large-text' : ''");
    expect(card).toContain('class="entry-merge-count"');
    expect(card).toContain('class="number-kind"');
    expect(template).not.toContain('<picker');
  });

  it('binds the nested contact loop to the contact variable used by the phone rows', () => {
    const template = read(
      'src/subpackages/organization/components/directory-entry-card/index.wxml',
    );

    expect(template).toContain('wx:for-item="contact"');
    expect(template).toContain('wx:for-item="number"');
    expect(template).toContain('{{number.number}}');
    expect(template).toContain('data-number="{{number.dialNumber}}"');
  });

  it('keeps two native panes mounted and mirrors the Web result and filter presentation', () => {
    const template = read('src/subpackages/organization/components/directory-panel/index.wxml');
    const styles = read('src/subpackages/organization/components/directory-panel/index.wxss');
    const card = read('src/subpackages/organization/components/directory-entry-card/index.wxml');
    const cardStyles = read(
      'src/subpackages/organization/components/directory-entry-card/index.wxss',
    );

    expect(template).toContain('<swiper');
    expect(template.match(/<swiper-item/gu)).toHaveLength(2);
    expect(template).toContain('bindchange="handleModeSwiperChange"');
    expect(template).toContain('class="mode-icon department-icon');
    expect(template).toContain('class="mode-icon people-icon');
    expect(template).toContain('class="search-clear"');
    expect(template).toContain('class="sheet-reset-action');
    expect(template).toContain('class="filter-section-toggle');
    expect(template).not.toContain('<text class="search-icon">⌕</text>');

    expect(styles).toMatch(/\.wayfinding-ribbon\s*{[^}]*grid-template-columns:\s*repeat\(2,/s);
    expect(styles).toContain('line-height: var(--ui-line-height-normal)');
    expect(styles).not.toContain('--ui-line-height-body');
    expect(styles).toMatch(
      /\.mode-tab\s*{[^}]*font-size:\s*14px;[^}]*line-height:\s*var\(--ui-line-height-normal\)/s,
    );
    expect(styles).toMatch(
      /\.search-input\s*{[^}]*font-size:\s*16px;[^}]*line-height:\s*var\(--ui-line-height-normal\)/s,
    );
    expect(styles).toMatch(
      /\.result-summary\s*{[^}]*font-size:\s*var\(--ui-font-size-sm\);[^}]*line-height:\s*var\(--ui-line-height-normal\)/s,
    );
    expect(styles).toMatch(
      /\.sheet-title\s*{[^}]*font-size:\s*var\(--ui-font-size-xl\);[^}]*line-height:\s*var\(--ui-line-height-tight\)/s,
    );
    expect(template).toContain('show-divider="{{entryIndex > 0}}"');
    expect(card).toContain('showDivider');
    expect(template).toContain('large-text="{{largeText}}"');
    expect(card).toContain("largeText ? 'is-large-text' : ''");
    expect(card).toContain('web-directory-star');
    expect(cardStyles).toContain('.directory-entry.has-divider');
    expect(cardStyles).toContain('.directory-entry.is-large-text .contact-number-group');
    expect(cardStyles).toContain('line-height: var(--ui-line-height-normal)');
    expect(cardStyles).toMatch(
      /\.entry-title\s*{[^}]*font-size:\s*var\(--ui-font-size-md\);[^}]*line-height:\s*1\.25/s,
    );
    expect(cardStyles).toMatch(
      /\.contact-number\s*{[^}]*font-size:\s*var\(--ui-font-size-md\);[^}]*line-height:\s*var\(--ui-line-height-normal\)/s,
    );
    expect(cardStyles).not.toContain('--ui-line-height-body');
  });
});
