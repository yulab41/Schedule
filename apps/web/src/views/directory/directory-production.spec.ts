import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('production hospital directory integration', () => {
  it('mounts the real directory view from the workbench tab', () => {
    const home = source('../HomeView.vue');
    const navigation = source('../../features/layout/workbench-nav.ts');

    expect(navigation).toContain("id: 'directory'");
    expect(navigation).toContain("label: '院内通讯录'");
    expect(home).toContain(
      "import InternalDirectoryView from './directory/InternalDirectoryView.vue'",
    );
    expect(home).toContain("activeTab === 'directory'");
  });

  it('uses the authenticated API as the production data source', () => {
    const view = source('./InternalDirectoryView.vue');

    expect(view).toContain('createApiClient({ auth: localAuth })');
    expect(view).toContain('getDirectoryFacets');
    expect(view).toContain('searchDirectory');
  });

  it('keeps the directory in the full browser smoke journey', () => {
    const smoke = source('../../../../../scripts/smoke-browser.mjs');

    expect(smoke).toContain('async function assertHospitalDirectory');
    expect(smoke).toContain("hasText: '院内通讯录'");
    expect(smoke).toContain('aria-labelledby="directory-filter-floor"');
    expect(smoke).toContain('固定电话短号被错误渲染为拨号链接');
  });
});
