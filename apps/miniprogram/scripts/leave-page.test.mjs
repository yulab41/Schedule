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
  'workflow-leave-panel',
);

function readPage(extension) {
  return readFileSync(path.join(pageRoot, `index.${extension}`), 'utf8');
}

describe('P7 native leave workflow page', () => {
  it('registers the workflows subpackage and keeps available entries capability-gated', () => {
    const appJson = JSON.parse(readFileSync(path.join(sourceRoot, 'app.json'), 'utf8'));
    const workbench = readFileSync(
      path.join(sourceRoot, 'pages', 'workbench', 'index.wxml'),
      'utf8',
    );
    const workbenchController = readFileSync(
      path.join(sourceRoot, 'pages', 'workbench', 'index.ts'),
      'utf8',
    );

    expect(appJson.subpackages).toContainEqual({
      pages: ['pages/leave/index', 'pages/swap/index', 'pages/duty/index'],
      root: 'subpackages/workflows',
    });
    expect(workbench).toContain('bindtap="handleOpenLeave"');
    expect(workbench).toContain("{{workflowPanelsMounted ? '' : 'is-disabled'}}");
    expect(workbench).toContain('aria-disabled="{{!workflowPanelsMounted}}"');
    expect(workbenchController).toContain("requireClientCapability('workflows')");
    expect(workbenchController).toContain("'/subpackages/workflows/pages/leave/index'");
    expect(workbenchController).toContain('navigateWorkflowTool');
  });

  it('mirrors the frozen Web leave list, form, approval, conflict, and empty/error/loading states', () => {
    const template = readPage('wxml');

    for (const copy of [
      '请假与审批',
      '我的请假',
      '待我审批',
      '新建请假',
      '群组默认重排策略',
      '预览并审批',
      '生成重排预览',
      '批准并重排',
      '我已知晓冲突和空缺',
      '暂无请假记录',
      '重新加载',
    ]) {
      expect(template).toContain(copy);
    }
    for (const state of ['loading', 'error', 'ready']) {
      expect(template).toContain(`state === '${state}'`);
    }
    for (const tone of ['is-warning', 'is-success', 'is-danger']) {
      expect(template).toContain(tone);
    }
    expect(template).not.toMatch(/<t-|tdesign|<button|<scroll-view[^>]*scroll-x/iu);
  });

  it('uses the shared workflow client, operation snapshots, serial guards, and no write queue', () => {
    const controller = readFileSync(path.join(pageRoot, 'controller.ts'), 'utf8');

    expect(controller).toContain('createRuntimeWorkflowClient');
    expect(controller).toContain('resolveWorkflowOperationAttempt');
    expect(controller).toContain("requireClientCapability('workflows')");
    expect(controller).toContain('onShow');
    expect(controller).toContain('_loadSerial');
    expect(controller).toContain('_operationAttempts');
    expect(controller).toContain('本次结果尚未确认，可直接重试');
    expect(controller).toContain("error.code === 'CONFLICT'");
    expect(controller).not.toMatch(
      /writeQueue|offlineQueue|setStorageSync\([^)]*(leave|request)/iu,
    );
  });

  it('keeps Skyline-safe 390/320 geometry and 44px native actions without CSS grid', () => {
    const pageJson = JSON.parse(
      readFileSync(
        path.join(sourceRoot, 'subpackages', 'workflows', 'pages', 'leave', 'index.json'),
        'utf8',
      ),
    );
    const styles = readPage('wxss');

    expect(pageJson).toMatchObject({ disableScroll: true, renderer: 'skyline' });
    expect(JSON.parse(readPage('json')).usingComponents).toHaveProperty('workflow-picker');
    expect(styles).toContain('.leave-page.is-compact');
    expect(styles).toMatch(/\.web-button\s*\{[^}]*min-height:\s*44px;/su);
    expect(styles).not.toMatch(/\.bottom-nav(?:-item)?\b/u);
    expect(styles).toContain('padding-bottom: calc(16px + env(safe-area-inset-bottom))');
    expect(styles).not.toMatch(/display:\s*grid|@media|clamp\(/u);
  });
});
