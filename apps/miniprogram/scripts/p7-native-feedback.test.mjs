import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const sourceRoot = fileURLToPath(new URL('../src', import.meta.url));

function read(relativePath) {
  return readFileSync(path.join(sourceRoot, relativePath), 'utf8');
}

describe('P7 physical-device feedback regressions', () => {
  it('keeps the workbench shell mounted while switching calendar, leave, swap, duty, and more', () => {
    const controller = read('pages/workbench/index.ts');
    const template = read('pages/workbench/index.wxml');
    const styles = read('pages/workbench/index.wxss');
    const pageJson = JSON.parse(read('pages/workbench/index.json'));

    expect(controller).toContain("activeWorkspace: 'calendar'");
    expect(controller).toContain("openWorkflowWorkspace(this, 'leave')");
    expect(controller).toContain("openWorkflowWorkspace(this, 'swap')");
    expect(controller).toContain("openWorkflowWorkspace(this, 'duty')");
    expect(controller).toContain("activeWorkspace: 'more'");
    expect(controller).not.toContain('/subpackages/workflows/pages/leave/index?groupId=');
    expect(controller).not.toContain('/subpackages/workflows/pages/swap/index?groupId=');
    expect(controller).not.toContain('/subpackages/workflows/pages/duty/index?groupId=');
    expect(template).toContain('<workflow-leave-panel');
    expect(template).toContain('<workflow-swap-panel');
    expect(template).toContain('<workflow-duty-panel');
    expect(template).toContain('hidden="{{activeWorkspace !== \'calendar\'}}"');
    expect(template).toContain('wx:if="{{workflowPanelsMounted}}"');
    expect(template).toContain('hidden="{{activeWorkspace !== \'leave\'}}"');
    expect(template).toContain('hidden="{{activeWorkspace !== \'swap\'}}"');
    expect(template).toContain('hidden="{{activeWorkspace !== \'duty\'}}"');
    expect(template).not.toContain('wx:elif="{{activeWorkspace === \'leave\'}}"');
    expect(controller).toContain('workflowPanelsMounted: false');
    expect(controller).toContain('workflowPanelsMounted: shouldMountWorkflowPanels');
    expect(controller).toMatch(
      /handleCalendarNav[\s\S]*activeWorkspace !== 'calendar'[\s\S]*activeWorkspace: 'calendar'/u,
    );
    expect(template).toContain("activeWorkspace === 'more'");
    expect(styles).toMatch(/\.bottom-nav\s*\{[^}]*height:\s*calc\(/su);
    expect(styles).toMatch(/\.embedded-workspace\s*\{[^}]*overflow:\s*visible/su);
    expect(pageJson.usingComponents).toMatchObject({
      'workflow-duty-panel': '/subpackages/workflows/components/workflow-duty-panel/index',
      'workflow-leave-panel': '/subpackages/workflows/components/workflow-leave-panel/index',
      'workflow-swap-panel': '/subpackages/workflows/components/workflow-swap-panel/index',
    });
  });

  it('keeps the top-left group control switch-only and moves management entries into More', () => {
    const controller = read('pages/workbench/index.ts');
    const template = read('pages/workbench/index.wxml');
    const pageJson = JSON.parse(read('pages/workbench/index.json'));
    const groupMenuStart = template.indexOf('class="group-menu"');
    const groupMenuEnd = template.indexOf('</view>\n      </view>', groupMenuStart);
    const groupMenu = template.slice(groupMenuStart, groupMenuEnd);

    expect(groupMenu).not.toContain('群组设置');
    expect(template).toContain('class="more-workspace"');
    expect(template).toContain('群组管理');
    expect(template).toContain('手动排班');
    expect(template).toContain('排班补录');
    expect(template).toContain('bindtap="handleOpenGroupSettings"');
    expect(template).toContain('bindtap="handleOpenManualSchedule"');
    expect(template).toContain('bindtap="handleOpenBackfill"');
    expect(template).toContain("more-item {{canManageScheduleTools ? '' : 'is-disabled'}}");
    expect(template).toContain('<group-settings-panel');
    expect(template).toContain('hidden="{{activeWorkspace !== \'group\'}}"');
    expect(controller).toContain("activeWorkspace: 'group'");
    expect(controller).not.toContain(
      '/subpackages/organization/pages/group-settings/index?groupId=',
    );
    expect(pageJson.usingComponents).toMatchObject({
      'group-settings-panel': '/subpackages/organization/components/group-settings-panel/index',
    });
    expect(controller).toMatch(
      /canManageScheduleTools:\s*selectedGroup\.role === 'owner' \|\| selectedGroup\.role === 'administrator'/u,
    );
  });

  it('invalidates the mounted calendar immediately after a workflow mutation succeeds', () => {
    const controller = read('pages/workbench/index.ts');
    const template = read('pages/workbench/index.wxml');

    expect(template.match(/bind:calendarchanged="handleWorkflowCalendarChanged"/gu)).toHaveLength(
      3,
    );
    expect(controller).toMatch(
      /handleWorkflowCalendarChanged[\s\S]*monthResources\.clear\(\)[\s\S]*forceRefresh:\s*true/u,
    );
    for (const workflow of ['leave', 'swap', 'duty']) {
      const workflowController = read(
        `subpackages/workflows/components/workflow-${workflow}-panel/controller.ts`,
      );
      expect(workflowController).toContain("triggerEvent?.('calendarchanged'");
    }
  });

  it('replaces every workflow system picker with the self-drawn Web-style picker', () => {
    const pageJsonPaths = [
      'subpackages/workflows/components/workflow-leave-panel/index.json',
      'subpackages/workflows/components/workflow-swap-panel/index.json',
      'subpackages/workflows/components/workflow-duty-panel/index.json',
    ];
    for (const workflow of ['leave', 'swap', 'duty']) {
      const template = read(
        `subpackages/workflows/components/workflow-${workflow}-panel/index.wxml`,
      );
      expect(template).not.toMatch(/<picker(?:\s|>)/u);
      expect(template).toContain('<workflow-picker');
    }
    for (const jsonPath of pageJsonPaths) {
      const componentJson = JSON.parse(read(jsonPath));
      expect(componentJson.styleIsolation).toBe('apply-shared');
      expect(componentJson.usingComponents).toMatchObject({
        'workflow-picker': '/subpackages/workflows/components/workflow-picker/index',
      });
    }
    expect(
      JSON.parse(read('subpackages/workflows/components/workflow-picker/index.json'))
        .styleIsolation,
    ).toBe('apply-shared');
    const pickerTemplate = read('subpackages/workflows/components/workflow-picker/index.wxml');
    const pickerStyles = read('subpackages/workflows/components/workflow-picker/index.wxss');
    expect(pickerTemplate).toContain('class="workflow-picker-sheet"');
    expect(pickerTemplate).toContain('class="workflow-picker-selector-popover"');
    expect(pickerTemplate).toContain("open && mode !== 'selector'");
    expect(pickerTemplate).toContain('class="workflow-picker-summary"');
    expect(pickerTemplate).toContain('class="workflow-picker-date-navigation"');
    expect(pickerTemplate).toContain('class="workflow-picker-date-grid"');
    expect(pickerTemplate).toContain('<picker-view');
    expect(pickerTemplate).toContain("item.isWeekend ? 'is-weekend' : ''");
    expect(pickerTemplate).toContain('取消');
    expect(pickerTemplate).toContain('完成');
    expect(pickerStyles).toContain('.workflow-picker-option.is-weekend');
    expect(pickerStyles).toContain('.workflow-picker-option-weekend');
    expect(pickerStyles).toMatch(
      /\.workflow-picker-option-weekend\s*\{[^}]*color:\s*var\(--ui-color-danger\)/su,
    );
    expect(pickerStyles).not.toMatch(/\.workflow-picker-option\.is-weekend\s*\{[^}]*color:/su);
    expect(pickerStyles).toMatch(
      /\.workflow-picker-sheet\s*\{[^}]*right:\s*12px;[^}]*bottom:\s*max\(12px,/su,
    );
    expect(pickerStyles).toMatch(
      /\.workflow-picker-selector-popover\s*\{[^}]*position:\s*absolute;[^}]*max-height:\s*240px;/su,
    );
  });

  it('removes long blue press fills and pre-mounts the leave form without transient copy', () => {
    const pickerTemplate = read('subpackages/workflows/components/workflow-picker/index.wxml');
    const pickerStyles = read('subpackages/workflows/components/workflow-picker/index.wxss');
    const leaveTemplate = read('subpackages/workflows/components/workflow-leave-panel/index.wxml');
    const leaveStyles = read('subpackages/workflows/components/workflow-leave-panel/index.wxss');

    expect(pickerTemplate).toContain('hover-start-time="0"');
    expect(pickerTemplate).toContain('hover-stay-time="60"');
    expect(pickerStyles).not.toMatch(
      /\.workflow-picker-trigger\.is-pressed\s*\{[^}]*background:\s*var\(--ui-color-primary-light\)/su,
    );
    expect(pickerTemplate).toContain("index === draftIndices[0] ? 'is-selected' : ''");
    expect(pickerTemplate).toContain("index === draftIndices[1] ? 'is-selected' : ''");
    expect(pickerStyles).toMatch(
      /\.workflow-picker-wheel-item\s*\{[^}]*font-size:\s*19px;[^}]*opacity:\s*0\.58/su,
    );
    expect(pickerStyles).toMatch(
      /\.workflow-picker-wheel-item\.is-selected\s*\{[^}]*font-size:\s*24px;[^}]*opacity:\s*1/su,
    );
    expect(pickerStyles).toMatch(
      /\.workflow-picker-scrim\s*\{[^}]*background:\s*rgba\(22, 32, 42, 0\.18\)/su,
    );
    expect(pickerStyles).toMatch(
      /\.workflow-picker-sheet\s*\{[^}]*box-shadow:\s*0 16px 36px rgba\(22, 32, 42, 0\.14\)/su,
    );
    expect(leaveTemplate).toContain('hidden="{{!formVisible}}"');
    expect(leaveTemplate).not.toContain('wx:if="{{affectedShiftsLoading}}">读取中');
    expect(leaveStyles).toMatch(
      /\.native-sheet\s*>\s*\.sheet-heading\s*>\s*\.sheet-close\s*\{[^}]*margin-left:\s*auto;[^}]*flex:\s*0 0 44px/su,
    );
  });
});
