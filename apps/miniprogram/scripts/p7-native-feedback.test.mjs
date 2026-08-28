import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const sourceRoot = fileURLToPath(new URL('../src', import.meta.url));

function read(relativePath) {
  return readFileSync(path.join(sourceRoot, relativePath), 'utf8');
}

describe('P7 physical-device feedback regressions', () => {
  it('keeps the workbench shell mounted while switching calendar, directory, swap, profile, and more', () => {
    const controller = read('pages/workbench/index.ts');
    const template = read('pages/workbench/index.wxml');
    const styles = read('pages/workbench/index.wxss');
    const pageJson = JSON.parse(read('pages/workbench/index.json'));

    expect(controller).toContain("activeWorkspace: 'calendar'");
    expect(controller).toContain("activeWorkspace: 'directory'");
    expect(controller).toContain("openWorkflowWorkspace(this, 'swap')");
    expect(controller).toContain("activeWorkspace: 'profile'");
    expect(controller).toContain("activeWorkspace: 'more'");
    expect(controller).toContain("'/subpackages/workflows/pages/leave/index'");
    expect(controller).not.toContain('/subpackages/workflows/pages/swap/index?groupId=');
    expect(controller).toContain("'/subpackages/workflows/pages/duty/index'");
    expect(template).toContain('<directory-panel');
    expect(template).toContain('<workflow-swap-panel');
    expect(template).toContain('<profile-panel');
    expect(template).toContain('hidden="{{activeWorkspace !== \'calendar\'}}"');
    expect(template).toContain('hidden="{{activeWorkspace !== \'directory\'}}"');
    expect(template).toContain('hidden="{{activeWorkspace !== \'swap\'}}"');
    expect(template).toContain('hidden="{{activeWorkspace !== \'profile\'}}"');
    expect(template).not.toContain('<workflow-leave-panel');
    expect(template).not.toContain('<workflow-duty-panel');
    expect(controller).not.toContain('directoryMounted');
    expect(controller).not.toContain('profileMounted');
    expect(controller).toContain('directoryPanelReady: false');
    expect(controller).toContain('profilePanelReady: false');
    expect(template).not.toContain('wx:if="{{directoryMounted}}"');
    expect(template).not.toContain('wx:if="{{profileMounted}}"');
    expect(template).toContain('bind:panelready="handleDirectoryPanelReady"');
    expect(template).toContain('bind:panelready="handleProfilePanelReady"');
    expect(controller).toContain('workflowPanelsMounted: false');
    expect(controller).toContain('workflowPanelsMounted: toolAccess.leave');
    expect(controller).toMatch(
      /handleCalendarNav[\s\S]*activeWorkspace !== 'calendar'[\s\S]*activeWorkspace: 'calendar'/u,
    );
    expect(template).toContain("activeWorkspace === 'more'");
    expect(styles).toMatch(/\.bottom-nav\s*\{[^}]*height:\s*calc\(/su);
    expect(styles).toMatch(/\.embedded-workspace\s*\{[^}]*overflow:\s*visible/su);
    expect(pageJson.usingComponents).toMatchObject({
      'directory-panel': '/subpackages/organization/components/directory-panel/index',
      'profile-panel': '/components/profile-panel/index',
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
    expect(template).toContain('wx:if="{{toolAccess.manualSchedule}}"');
    expect(template).toContain('wx:if="{{toolAccess.groupSettings}}"');
    expect(template).not.toContain('<group-settings-panel');
    expect(template).not.toContain('hidden="{{activeWorkspace !== \'group\'}}"');
    expect(controller).toContain("'/subpackages/organization/pages/group-settings/index'");
    expect(pageJson.usingComponents['group-settings-panel']).toBeUndefined();
    expect(controller).toContain('canManageScheduleTools: toolAccess.manualSchedule');
    expect(controller).toContain('currentGroupRole: formatRole(selectedGroup)');
  });

  it('invalidates the mounted calendar immediately after a workflow mutation succeeds', () => {
    const controller = read('pages/workbench/index.ts');
    const template = read('pages/workbench/index.wxml');

    expect(template.match(/bind:calendarchanged="handleWorkflowCalendarChanged"/gu)).toHaveLength(
      1,
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
    expect(pickerTemplate).toContain('workflow-picker-selector-popover');
    expect(pickerTemplate).toContain("open && mode !== 'selector'");
    expect(pickerTemplate).toContain('class="workflow-picker-summary"');
    expect(pickerTemplate).toContain('class="workflow-picker-date-navigation"');
    expect(pickerTemplate).toContain('class="workflow-picker-date-grid"');
    expect(pickerTemplate).not.toContain('<picker-view');
    expect(pickerTemplate).toContain('bindscroll="handleYearWheelScroll"');
    expect(pickerTemplate).toContain('bindscroll="handleMonthWheelScroll"');
    expect(pickerTemplate).toContain('class="workflow-picker-wheel-rails"');
    expect(pickerTemplate).toContain('class="workflow-picker-wheel-mask"');
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
      /\.workflow-picker-selector-popover\s*\{[^}]*position:\s*absolute;[^}]*max-height:\s*300px;/su,
    );
  });

  it('removes long blue press fills and pre-mounts the leave form without transient copy', () => {
    const pickerTemplate = read('subpackages/workflows/components/workflow-picker/index.wxml');
    const pickerStyles = read('subpackages/workflows/components/workflow-picker/index.wxss');
    const leaveTemplate = read('subpackages/workflows/components/workflow-leave-panel/index.wxml');
    const leaveStyles = read('subpackages/workflows/components/workflow-leave-panel/index.wxss');

    const pickerTrigger = pickerTemplate.match(
      /class="workflow-picker-trigger[^"]*"[\s\S]*?bindtap="handleOpen"/u,
    )?.[0];
    expect(pickerTrigger).not.toContain('hover-start-time="0"');
    expect(pickerTrigger).not.toContain('hover-stay-time="60"');
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

  it('coordinates dropdown dismissal, compact empty state, filter outside taps, and group warmup', () => {
    const pickerTemplate = read('subpackages/workflows/components/workflow-picker/index.wxml');
    const pickerStyles = read('subpackages/workflows/components/workflow-picker/index.wxss');
    const pickerController = read('subpackages/workflows/components/workflow-picker/index.ts');
    const host = read('subpackages/workflows/components/controller-host.ts');
    const workbenchTemplate = read('pages/workbench/index.wxml');
    const workbenchController = read('pages/workbench/index.ts');

    expect(pickerTemplate).toContain('catchtap="handleInternalTap"');
    expect(pickerController).toContain("triggerEvent('pickerrequestopen'");
    expect(pickerStyles).toMatch(/\.workflow-picker-empty\s*\{[^}]*min-height:\s*44px;/su);
    expect(host).toContain("selectAllComponents?.('workflow-picker')");
    for (const workflow of ['leave', 'swap', 'duty']) {
      const template = read(
        `subpackages/workflows/components/workflow-${workflow}-panel/index.wxml`,
      );
      expect(template).toContain('bindtap="handlePanelBackgroundTap"');
      expect(template).toContain('bind:pickerrequestopen="handlePickerRequestOpen"');
    }
    expect(workbenchTemplate).toContain('catchtap="handleFilterSheetBackgroundTap"');
    expect(workbenchTemplate).toContain('catchtap="handleFilterOptionToggle"');
    expect(workbenchController).toMatch(
      /handleFilterSheetBackgroundTap[\s\S]*filterOpenField:\s*''/u,
    );
    expect(workbenchController).toMatch(
      /state:\s*groupSnapshotOffline[\s\S]*completeCoreReadyProbe\(page\)/u,
    );
  });

  it('uses one larger single-line name scale in month and week cells', () => {
    const monthTemplate = read('components/calendar/calendar-cell/index.wxml');
    const monthStyles = read('components/calendar/calendar-cell/index.wxss');
    const workbenchTemplate = read('pages/workbench/index.wxml');
    const workbenchStyles = read('pages/workbench/index.wxss');

    expect(monthStyles).toMatch(
      /\.month-person\s*\{[^}]*font-size:\s*11px;[^}]*white-space:\s*nowrap;/su,
    );
    expect(workbenchStyles).toMatch(
      /\.week-duty-name\s*\{[^}]*font-size:\s*12px;[^}]*font-weight:\s*var\(--ui-font-weight-semibold\);[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/su,
    );
    expect(monthTemplate).not.toMatch(/person\.length|name-length/u);
    expect(workbenchTemplate).not.toMatch(/duty\.name\.length|name-length/u);
  });

  it('matches Web select geometry and keeps the open trigger blue until the dropdown closes', () => {
    const pickerTemplate = read('subpackages/workflows/components/workflow-picker/index.wxml');
    const pickerStyles = read('subpackages/workflows/components/workflow-picker/index.wxss');

    expect(pickerTemplate).not.toMatch(/class="workflow-picker-option[^>]*hover-/u);
    expect(pickerStyles).toMatch(
      /\.workflow-picker-root\.is-open \.workflow-picker-trigger\s*\{[^}]*border-color:\s*var\(--ui-color-primary\);[^}]*box-shadow:/su,
    );
    expect(pickerStyles).toMatch(
      /\.workflow-picker-selector-popover\s*\{[^}]*padding:\s*6px;[^}]*border-radius:\s*10px;[^}]*box-shadow:\s*0 3px 14px 2px/su,
    );
    expect(pickerStyles).toMatch(
      /\.workflow-picker-option\s*\{[^}]*height:\s*28px;[^}]*min-height:\s*28px;[^}]*padding:\s*0 8px;[^}]*border-radius:\s*3px;[^}]*font-size:\s*14px;[^}]*line-height:\s*22px;/su,
    );
    expect(pickerStyles).toMatch(
      /\.workflow-picker-option \+ \.workflow-picker-option\s*\{[^}]*margin-top:\s*2px;/su,
    );
    expect(pickerStyles).toMatch(
      /\.workflow-picker-option\.is-selected\s*\{[^}]*color:\s*var\(--ui-color-primary\);[^}]*background:\s*var\(--ui-color-primary-light\)/su,
    );
    expect(pickerTemplate).toContain('workflow-picker-selector-backdrop');
    expect(pickerTemplate).toContain('popoverPlacement');
    expect(pickerTemplate).toContain("popoverPlacementReady ? 'is-ready' : 'is-measuring'");
    expect(pickerTemplate).not.toContain("open ? '⌃' : '⌄'");
    expect(pickerStyles).toMatch(
      /\.workflow-picker-selector-popover\.is-up\s*\{[^}]*top:\s*auto;[^}]*bottom:\s*calc\(100% \+ 6px\);/su,
    );
    expect(pickerStyles).toMatch(
      /\.workflow-picker-chevron\.is-right\s*\{[^}]*transform:\s*rotate\(-45deg\);/su,
    );
    expect(pickerStyles).toMatch(
      /\.workflow-picker-selector-popover\.is-measuring\s*\{[^}]*visibility:\s*hidden;[^}]*opacity:\s*0;/su,
    );
    expect(pickerStyles).not.toMatch(/\.workflow-picker-wheel-item\.is-animating/u);
    expect(pickerTemplate).toContain("dateLocateAnimating ? 'is-animating' : ''");
    expect(pickerTemplate).toContain('hover-start-time="0"');
    expect(pickerTemplate).toContain('wx:key="key"');
  });

  it('matches the Web request Sheet, compact reason fields, buttons, and Done action', () => {
    const leaveTemplate = read('subpackages/workflows/components/workflow-leave-panel/index.wxml');
    const dutyTemplate = read('subpackages/workflows/components/workflow-duty-panel/index.wxml');
    const swapTemplate = read('subpackages/workflows/components/workflow-swap-panel/index.wxml');
    const sharedStyles = read('subpackages/workflows/components/workflow-leave-panel/index.wxss');

    for (const template of [leaveTemplate, dutyTemplate, swapTemplate]) {
      expect(template).toContain('native-sheet request-sheet');
      expect(template).toContain('class="sheet-finish"');
      expect(template).toMatch(/class="sheet-finish"[^>]*>完成</u);
    }
    expect(leaveTemplate).toContain('class="native-textarea leave-reason-field"');
    expect(dutyTemplate.match(/class="native-reason-input"/gu)).toHaveLength(2);
    expect(sharedStyles).toMatch(
      /\.sheet-scrim\s*\{[^}]*background:\s*rgba\(22, 32, 42, 0\.32\)/su,
    );
    expect(sharedStyles).toMatch(
      /\.request-sheet\s*\{[^}]*height:\s*auto;[^}]*max-height:\s*78vh;[^}]*background:\s*var\(--ui-color-surface\);[^}]*border-radius:\s*22px 22px 0 0;/su,
    );
    expect(sharedStyles).toMatch(
      /\.request-sheet \.sheet-heading\s*\{[^}]*min-height:\s*56px;[^}]*padding:\s*4px 16px;[^}]*border-bottom:\s*0;/su,
    );
    expect(sharedStyles).toMatch(
      /\.leave-reason-field\s*\{[^}]*height:\s*44px;[^}]*min-height:\s*44px;/su,
    );
    expect(sharedStyles).toMatch(/\.native-reason-input\s*\{[^}]*min-height:\s*44px;/su);
    expect(sharedStyles).toMatch(
      /\.request-sheet \.web-button\.is-primary\s*\{[^}]*box-shadow:\s*none;/su,
    );
    expect(sharedStyles).toMatch(
      /\.request-sheet \.sheet-heading > \.sheet-finish\s*\{[^}]*width:\s*44px;[^}]*flex:\s*0 0 44px;/su,
    );
    expect(sharedStyles).toMatch(
      /\.leave-page\.is-compact \.request-sheet \.sheet-body\s*\{[^}]*padding:\s*0 16px calc\(16px \+ env\(safe-area-inset-bottom\)\);/su,
    );
    expect(sharedStyles).toMatch(
      /\.duty-page\.is-compact \.request-sheet \.form-actions,[^}]*\.swap-page\.is-compact \.request-sheet \.form-actions\s*\{[^}]*flex-direction:\s*row;/su,
    );
    expect(leaveTemplate).toContain('leave-form-intro');
    expect(leaveTemplate).toContain('请假信息');
    expect(leaveTemplate).toContain('请假按整天计算；提交前会检查已发布的未来班次。');
    expect(leaveTemplate).toContain('class="day-count-hint"');
    expect(leaveTemplate).toContain('class="affected-hint"');
    expect(leaveTemplate).toContain('class="affected-status is-{{item.tone}}"');
    expect(leaveTemplate).toContain('class="affected-warning"');
    expect(leaveTemplate).toContain('请假期间没有已发布的未来班次。');
    expect(leaveTemplate).toContain('原因说明（选填）');
    expect(leaveTemplate).toContain('请填写请假原因');
    expect(leaveTemplate).toContain('提交请假');
    expect(sharedStyles).toMatch(/\.request-sheet \.date-fields\s*\{[^}]*flex-direction:\s*row;/su);
    expect(sharedStyles).toMatch(
      /\.leave-page\.is-compact \.date-fields\s*\{[^}]*flex-direction:\s*row;/su,
    );
    expect(sharedStyles).toMatch(
      /\.day-count-hint\s*\{[^}]*color:\s*var\(--ui-color-primary\);[^}]*background:\s*var\(--ui-color-primary-light\)/su,
    );
  });
});
