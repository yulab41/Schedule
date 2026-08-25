import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function read(relativePath) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('P10 native directory page boundary', () => {
  it('registers a native page and exposes the formal-member entry from More', () => {
    const app = JSON.parse(read('../src/app.json'));
    const workbench = read('../src/pages/workbench/index.ts');
    const template = read('../src/pages/workbench/index.wxml');

    expect(app.pages).toContain('pages/directory/index');
    expect(workbench).toContain('handleOpenDirectory');
    expect(workbench).toContain("canOpenDirectory: selectedGroup.role !== 'guest'");
    expect(template).toContain('通讯录');
    expect(template).toContain('bindtap="handleOpenDirectory"');
  });

  it('keeps page states, capability/read boundaries, and sensitive data in memory only', () => {
    const page = read('../src/pages/directory/index.ts');
    const template = read('../src/pages/directory/index.wxml');
    const runtime = read('../src/platform/client-core-calendar.ts');

    for (const state of ['loading', 'ready', 'error']) {
      expect(template).toContain(`state === '${state}'`);
    }
    for (const action of [
      'handleSearchSubmit',
      'handleModeSelect',
      'handleFilterApply',
      'handleLoadMore',
      'handleCall',
    ]) {
      expect(page).toContain(action);
    }
    expect(page).toContain('createDirectoryController');
    expect(runtime).toContain('createRuntimeDirectoryReadClient');
    expect(runtime).toContain("if (endpoint.id.startsWith('directory.')) return 'core';");
    expect(page).not.toMatch(/wx\.(setStorageSync|getStorageSync)\([^)]*directory/iu);
    expect(page).not.toMatch(/visitorKey\s*:/u);
    expect(page).not.toMatch(/rawTicket\s*:/u);
  });

  it('uses explicit visual and privacy boundaries for phone rows and filters', () => {
    const styles = read('../src/pages/directory/index.wxss');
    const template = read('../src/pages/directory/index.wxml');

    expect(styles).toContain('min-height: 44px');
    expect(styles).toContain('directory-sheet-mask');
    expect(styles).toContain('prefers-reduced-motion');
    expect(template).toContain('directory-contact-action');
    expect(template).toContain('directory-contact-static');
    expect(template).toContain('directory-filter-section');
    expect(template).toContain('{{activeFilterCount}}');
  });
});
