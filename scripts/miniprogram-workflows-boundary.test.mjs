import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { listRegisteredPages } from './miniprogram-manifest.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const miniprogramRoot = path.join(root, 'apps', 'miniprogram');

function read(relativePath) {
  return readFileSync(path.join(miniprogramRoot, relativePath), 'utf8');
}

describe('workflows subpackage boundary', () => {
  it('adds one discoverable request-center subpackage without changing the four tab routes', () => {
    const appJson = JSON.parse(read('app.json'));
    expect(appJson.subPackages).toEqual([
      { root: 'subpackages/workflows', pages: ['pages/requests/index'] },
    ]);
    expect(listRegisteredPages(appJson)).toContain('subpackages/workflows/pages/requests/index');
    expect(appJson.tabBar.list.map(({ pagePath }) => pagePath)).toEqual([
      'pages/workbench/index',
      'pages/calendar/index',
      'pages/notifications/index',
      'pages/profile/index',
    ]);
  });

  it('keeps the request shell display-only until Task 9.2 and does not import workflow endpoints', () => {
    const source = read('subpackages/workflows/pages/requests/index.ts');
    expect(read('subpackages/workflows/pages/requests/index.wxml')).toContain('<page-shell');
    expect(source).not.toMatch(/api\/endpoints/u);
    expect(source).not.toMatch(/createLeaveRequest|createSwapRequest|createDutyAdjustmentRequest/u);
    expect(source).not.toMatch(/from\s+['"]@schedule\/contracts['"]/u);
  });
});
