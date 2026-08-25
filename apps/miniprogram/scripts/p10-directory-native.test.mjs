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
    expect(panel).toContain('院内通讯录');
    expect(panel).toContain('员工通讯录');
    expect(workbench).toContain('handleOpenDirectory');
  });

  it('uses the organization-gated shared reader and keeps all directory data in memory', () => {
    const runtime = read('src/platform/client-core-calendar.ts');
    const controller = read(
      'src/subpackages/organization/components/directory-panel/controller.ts',
    );

    expect(runtime).toContain('createRuntimeDirectoryReadClient');
    expect(controller).toContain('getFacets');
    expect(controller).toContain('directoryClient.list');
    expect(controller).toContain("requireClientCapability('organization')");
    expect(controller).not.toContain('wx.setStorageSync');
    expect(controller).not.toContain('console.log');
    expect(controller).not.toContain('visitorKey');
  });

  it('covers loading, empty, error, disabled, search, seven filters and cursor loading', () => {
    const template = read('src/subpackages/organization/components/directory-panel/index.wxml');
    const controller = read(
      'src/subpackages/organization/components/directory-panel/controller.ts',
    );

    for (const label of [
      '正在读取通讯录',
      '通讯录暂未开放',
      '暂无匹配条目',
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
  });
});
