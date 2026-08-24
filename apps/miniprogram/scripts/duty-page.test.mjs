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
  'workflow-duty-panel',
);

function readPage(extension) {
  return readFileSync(path.join(pageRoot, `index.${extension}`), 'utf8');
}

describe('P7 native duty-adjustment workflow page', () => {
  it('registers duty and capability-gates all three real workflow entries', () => {
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
    const swapTemplate = readFileSync(
      path.join(
        sourceRoot,
        'subpackages',
        'workflows',
        'components',
        'workflow-swap-panel',
        'index.wxml',
      ),
      'utf8',
    );

    expect(workflowPackage.pages).toEqual([
      'pages/leave/index',
      'pages/swap/index',
      'pages/duty/index',
    ]);
    expect(workbench).toContain('bindtap="handleDutyNav"');
    expect(workbench).toContain('data-label="加扣班"');
    expect(workbench.match(/\{\{workflowsEnabled \? '' : 'is-disabled'\}\}/gu)).toHaveLength(3);
    expect(workbenchController).toContain("openWorkflowWorkspace(this, 'duty')");
    expect(leaveTemplate).toContain('bindtap="handleDutyNav"');
    expect(swapTemplate).toContain('bindtap="handleDutyNav"');
  });

  it('mirrors every frozen Web duty section, form, direct form, and page state', () => {
    const template = readPage('wxml');
    for (const copy of [
      '加扣班管理',
      '发起加扣班',
      '管理员代值',
      '加扣班需要管理员审批',
      '自动接受换班/加扣班',
      '待我接受',
      '待管理员审批',
      '已受理记录',
      '已生效待撤销',
      '我的加扣班记录',
      '生成预览',
      '提交加扣班',
      '管理员直接代值',
      '直接执行代值',
      '暂无加扣班记录',
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

  it('keeps displayed previews, serial guards, operation snapshots, and no write queue', () => {
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
      'handleMonthChange',
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
    expect(controller).not.toMatch(/writeQueue|offlineQueue|setStorageSync\([^)]*(duty|request)/iu);
  });

  it('uses Skyline-safe native 390/320 geometry without CSS grid', () => {
    const pageJson = JSON.parse(
      readFileSync(
        path.join(sourceRoot, 'subpackages', 'workflows', 'pages', 'duty', 'index.json'),
        'utf8',
      ),
    );
    const styles = readPage('wxss');

    expect(pageJson).toMatchObject({ disableScroll: true, renderer: 'skyline' });
    expect(JSON.parse(readPage('json')).usingComponents).toHaveProperty('workflow-picker');
    expect(styles).toContain('.duty-page.is-compact');
    expect(styles).toMatch(/\.web-button\s*\{[^}]*min-height:\s*44px;/su);
    expect(styles).toMatch(/\.bottom-nav-item\s*\{[^}]*min-height:\s*44px;/su);
    expect(styles).toContain('padding-bottom: calc(64px + env(safe-area-inset-bottom))');
    expect(styles).not.toMatch(/display:\s*grid|@media|clamp\(/u);
  });
});
