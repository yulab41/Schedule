import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const appRoot = process.cwd();
const sourceRoot = path.join(appRoot, 'src');
const pageRoot = path.join(
  sourceRoot,
  'subpackages',
  'workflows',
  'components',
  'workflow-swap-panel',
);

function readPage(extension) {
  return readFileSync(path.join(pageRoot, `index.${extension}`), 'utf8');
}

describe('P7 native swap workflow page', () => {
  it('registers swap beside leave and capability-gates both real workbench entries', () => {
    const appJson = JSON.parse(readFileSync(path.join(sourceRoot, 'app.json'), 'utf8'));
    const workflowPackage = appJson.subpackages.find(
      (candidate) => candidate.root === 'subpackages/workflows',
    );
    const workbench = readFileSync(
      path.join(sourceRoot, 'pages', 'workbench', 'index.wxml'),
      'utf8',
    );
    const workbenchController = readFileSync(
      path.join(sourceRoot, 'pages', 'workbench', 'index.ts'),
      'utf8',
    );
    const leaveTemplate = readFileSync(
      path.join(
        sourceRoot,
        'subpackages',
        'workflows',
        'components',
        'workflow-leave-panel',
        'index.wxml',
      ),
      'utf8',
    );
    const leaveController = readFileSync(
      path.join(
        sourceRoot,
        'subpackages',
        'workflows',
        'components',
        'workflow-leave-panel',
        'controller.ts',
      ),
      'utf8',
    );

    expect(workflowPackage.pages).toEqual([
      'pages/leave/index',
      'pages/swap/index',
      'pages/duty/index',
    ]);
    expect(workbench).toContain('bindtap="handleSwapNav"');
    expect(workbench.match(/\{\{workflowsEnabled \? '' : 'is-disabled'\}\}/gu)).toHaveLength(3);
    expect(workbenchController).toContain("openWorkflowWorkspace(this, 'swap')");
    expect(leaveTemplate).toContain('bindtap="handleSwapNav"');
    expect(leaveController).toContain('/subpackages/workflows/pages/swap/index?groupId=');
  });

  it('mirrors every frozen Web swap section, form, direct form, and page state', () => {
    const template = readPage('wxml');
    for (const copy of [
      '换班管理',
      '发起换班',
      '管理员换班',
      '换班需要管理员审批',
      '自动接受换班',
      '待我接受',
      '待管理员审批',
      '已受理记录',
      '已生效待撤销',
      '我的换班申请',
      '生成预览',
      '提交换班',
      '管理员直接换班',
      '直接执行换班',
      '暂无换班申请',
      '重新加载',
    ]) {
      expect(template).toContain(copy);
    }
    for (const state of ['loading', 'error', 'ready']) {
      expect(template).toContain(`state === '${state}'`);
    }
    for (const tone of ['is-warning', 'is-success', 'is-danger', 'is-neutral']) {
      expect(template).toContain(tone);
    }
    expect(template).not.toMatch(/<t-|tdesign|<button|<scroll-view[^>]*scroll-x/iu);
  });

  it('keeps cross-month candidates, displayed preview snapshots, serial guards, and no queue', () => {
    const controller = readFileSync(path.join(pageRoot, 'controller.ts'), 'utf8');
    for (const boundary of [
      'createRuntimeWorkflowClient',
      'createWorkbenchReadClient',
      'resolveWorkflowOperationAttempt',
      "requireClientCapability('workflows')",
      '_loadSerial',
      '_calendarSerial',
      '_operationAttempts',
      '_requestPreview',
      '_adminPreview',
      'handleMyMonthChange',
      'handleTargetMonthChange',
      'handleAccept',
      'handleApprove',
      'handleReject',
      'handleCancel',
      'handleRevoke',
      'handleGroupApprovalToggle',
      'handleAutoAcceptToggle',
      "error.code === 'CONFLICT'",
      '本次结果尚未确认，可直接重试',
    ]) {
      expect(controller).toContain(boundary);
    }
    expect(controller).not.toMatch(/writeQueue|offlineQueue|setStorageSync\([^)]*(swap|request)/iu);
  });

  it('uses Skyline-safe 390/320 native geometry without CSS grid', () => {
    const pageJson = JSON.parse(
      readFileSync(
        path.join(sourceRoot, 'subpackages', 'workflows', 'pages', 'swap', 'index.json'),
        'utf8',
      ),
    );
    const styles = readPage('wxss');

    expect(pageJson).toMatchObject({ disableScroll: true, renderer: 'skyline' });
    expect(JSON.parse(readPage('json')).usingComponents).toHaveProperty('workflow-picker');
    expect(styles).toContain('.swap-page.is-compact');
    expect(styles).toMatch(/\.web-button\s*\{[^}]*min-height:\s*44px;/su);
    expect(styles).toMatch(/\.bottom-nav-item\s*\{[^}]*min-height:\s*44px;/su);
    expect(styles).toContain('padding-bottom: calc(64px + env(safe-area-inset-bottom))');
    expect(styles).not.toMatch(/display:\s*grid|@media|clamp\(/u);
  });
});
