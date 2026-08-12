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
  it('keeps the Task 9.2 leave page in the workflows subpackage without changing the four tab routes', () => {
    const appJson = JSON.parse(read('app.json'));
    expect(appJson.subPackages).toContainEqual({
      root: 'subpackages/workflows',
      pages: ['pages/requests/index', 'pages/leave/index', 'pages/operations/index'],
    });
    expect(listRegisteredPages(appJson)).toContain('subpackages/workflows/pages/requests/index');
    expect(listRegisteredPages(appJson)).toContain('subpackages/workflows/pages/leave/index');
    expect(listRegisteredPages(appJson)).toContain('subpackages/workflows/pages/operations/index');
    expect(appJson.tabBar.list.map(({ pagePath }) => pagePath)).toEqual([
      'pages/workbench/index',
      'pages/calendar/index',
      'pages/notifications/index',
      'pages/profile/index',
    ]);
  });

  it('keeps the request center free of endpoint calls and routes the leave workflow to its own page', () => {
    const source = read('subpackages/workflows/pages/requests/index.ts');
    expect(read('subpackages/workflows/pages/requests/index.wxml')).toContain('<page-shell');
    expect(source).not.toMatch(/api\/endpoints/u);
    expect(source).not.toMatch(/createLeaveRequest|createSwapRequest|createDutyAdjustmentRequest/u);
    expect(source).not.toMatch(/from\s+['"]@schedule\/contracts['"]/u);
    expect(source).toContain('navigateToLeave');
    expect(source).toContain('navigateToOperations');
    expect(read('subpackages/workflows/pages/leave/index.wxml')).toContain('全天请假');
    expect(read('subpackages/workflows/pages/leave/index.ts')).toContain(
      'createLeaveWorkflowController',
    );
    const leaveWxml = read('subpackages/workflows/pages/leave/index.wxml');
    expect(leaveWxml).not.toMatch(/wx:else\s+wx:if/gu);
    expect(leaveWxml).toContain('wx:elif="{{workflow}}"');
    expect(leaveWxml).toContain('disabled="{{!workflow.canApproveApproval}}"');
    expect(leaveWxml).toContain('workflow.approvalBlockReason');
    expect(read('subpackages/workflows/pages/operations/index.ts')).toContain(
      'createSwapDutyWorkflowController',
    );
  });
});
