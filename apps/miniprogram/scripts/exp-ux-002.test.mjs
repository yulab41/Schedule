import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const miniRoot = process.cwd();
const sharedSheetPath = '/components/ui/ui-sheet/index';

function read(relativePath) {
  return readFileSync(path.join(miniRoot, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function readWorkflowPanel(workflow) {
  return read(`src/subpackages/workflows/components/workflow-${workflow}-panel/index.wxml`);
}

function readWorkflowStyles(workflow) {
  return read(`src/subpackages/workflows/components/workflow-${workflow}-panel/index.wxss`);
}

function sheetSection(template, title) {
  const titleIndex = template.indexOf(`title="${title}"`);
  const start = template.lastIndexOf('<ui-sheet', titleIndex);
  const end = template.indexOf('</ui-sheet>', start);
  expect(start, `missing shared sheet ${title}`).toBeGreaterThanOrEqual(0);
  expect(end, `unterminated shared sheet ${title}`).toBeGreaterThan(start);
  return template.slice(start, end);
}

describe('EXP-UX-002 workflow sheet contracts', () => {
  it('uses the shared fixed sheet for every leave and duty modal', () => {
    const contracts = [
      {
        workflow: 'leave',
        sheets: [
          { busy: 'formBusy', title: '新建请假' },
          { busy: 'approvalBusy', title: '预览并审批' },
        ],
      },
      {
        workflow: 'duty',
        sheets: [
          { busy: 'requestBusy', title: '发起加扣班' },
          { busy: 'adminBusy', title: '管理员直接代值' },
          { busy: 'revokeBusy', title: '撤销加扣班' },
        ],
      },
    ];

    for (const { workflow, sheets } of contracts) {
      const template = readWorkflowPanel(workflow);
      const config = readJson(
        `src/subpackages/workflows/components/workflow-${workflow}-panel/index.json`,
      );

      expect(config.usingComponents['ui-sheet']).toBe(sharedSheetPath);
      expect(template.match(/<ui-sheet\b/gu)).toHaveLength(sheets.length);
      expect(template).not.toContain('class="sheet-layer"');
      expect(template).not.toContain('class="native-sheet');

      for (const { busy, title } of sheets) {
        const sheet = sheetSection(template, title);
        expect(sheet).toContain('visible="{{');
        expect(sheet).toContain(`swipe-dismiss="{{!${busy}}}"`);
        expect(sheet).toContain('bind:close=');
      }
    }
  });

  it('keeps every workflow direct Page manifest aligned with included shared sheets', () => {
    for (const workflow of ['leave', 'swap', 'duty']) {
      const pageConfig = readJson(`src/subpackages/workflows/pages/${workflow}/index.json`);
      expect(pageConfig.usingComponents).toMatchObject({
        'ui-sheet': sharedSheetPath,
        'workflow-picker': '/subpackages/workflows/components/workflow-picker/index',
      });
    }
  });

  it('separates scrollable workflow form content from persistent actions', () => {
    const forms = [
      ['leave', '新建请假'],
      ['leave', '预览并审批'],
      ['duty', '发起加扣班'],
      ['duty', '管理员直接代值'],
      ['duty', '撤销加扣班'],
    ];

    for (const [workflow, title] of forms) {
      const sheet = sheetSection(readWorkflowPanel(workflow), title);
      const footerIndex = sheet.indexOf('class="workflow-sheet-footer"');
      expect(footerIndex, `${workflow}/${title} has no persistent footer`).toBeGreaterThan(-1);
      if (title !== '撤销加扣班') {
        expect(
          sheet.indexOf('</scroll-view>'),
          `${workflow}/${title} has no scroll body`,
        ).toBeLessThan(footerIndex);
      }
    }
  });

  it('keeps the shared layout contract in the common workflow style chain', () => {
    const leaveStyles = readWorkflowStyles('leave');
    const dutyStyles = readWorkflowStyles('duty');
    const sharedTemplate = read('src/components/ui/ui-sheet/index.wxml');
    const sharedStyles = read('src/components/ui/ui-sheet/index.wxss');
    const sharedGesture = read('src/components/ui/ui-sheet/drag-dismiss.wxs');

    expect(leaveStyles).toMatch(
      /\.workflow-sheet-scroll\s*\{[^}]*min-height:\s*0;[^}]*flex:\s*1;/su,
    );
    expect(leaveStyles).toMatch(/\.workflow-sheet-footer\s*\{[^}]*flex:\s*none;[^}]*border-top:/su);
    expect(leaveStyles).toContain('.workflow-sheet-footer > .approval-actions');
    expect(dutyStyles).toContain("@import '../workflow-swap-panel/index.wxss';");
    expect(sharedStyles).toMatch(
      /\.ui-sheet__layer\s*\{[^}]*position:\s*fixed;[^}]*z-index:\s*400;/su,
    );
    expect(sharedStyles).toMatch(
      /\.ui-sheet__panel\s*\{[^}]*height:\s*78vh;[^}]*max-height:\s*660px;/su,
    );
    expect(sharedStyles).toContain('env(safe-area-inset-bottom)');
    expect(sharedTemplate).toContain('class="ui-sheet__drag-region"');
    expect(sharedTemplate).not.toMatch(/class="ui-sheet__content"[^>]*bindtouch/iu);
    expect(sharedGesture).toContain('var DISMISS_DISTANCE = 96;');
    expect(sharedGesture).toContain('var FLICK_DISTANCE = 28;');
    expect(sharedGesture).toContain('var FLICK_VELOCITY = 0.65;');
    expect(sharedGesture).not.toContain('setData');
  });
});
