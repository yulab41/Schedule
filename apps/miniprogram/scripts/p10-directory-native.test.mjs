import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(path.join(appRoot, relativePath), 'utf8');
}

describe('P10 native directory parity', () => {
  it('registers the directory route and member-accessible More entry', () => {
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
    expect(page).toContain('directory-panel');
    expect(panel).toContain('科室通讯录');
    expect(panel).toContain('人员通讯录');
    expect(workbench).toContain('handleOpenDirectory');
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
    expect(controller).toContain('wx.setStorageSync(key, JSON.stringify(page._preferences))');
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
      '通讯录暂时无法更新',
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
      expect(controller).toContain(`'${key}'`);
    }
    expect(controller).toContain('nextCursor');
    expect(controller).toContain('directoryKind');
    expect(controller).toContain('detached(this: DirectoryPageInstance)');
    expect(controller).toContain('fontSizeSetting');
    expect(controller).toContain("campusFilterLabel: '组织根'");
    expect(controller).toContain("sectionFilterLabel: '一级组织'");
    expect(controller).toContain("subunitFilterLabel: '五级组织'");
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
});
