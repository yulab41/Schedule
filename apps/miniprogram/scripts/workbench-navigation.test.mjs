import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const miniRoot = process.cwd();

function read(relativePath) {
  return readFileSync(path.join(miniRoot, relativePath), 'utf8');
}

function expectInOrder(source, labels) {
  let cursor = -1;
  for (const label of labels) {
    const next = source.indexOf(label, cursor + 1);
    expect(next, `missing or out-of-order label: ${label}`).toBeGreaterThan(cursor);
    cursor = next;
  }
}

describe('Mini workbench Web-parity navigation', () => {
  it('keeps exactly five primary destinations in the accepted order', () => {
    const template = read('src/pages/workbench/index.wxml');
    const nav = template.slice(template.indexOf('<view class="bottom-nav"'));

    expect(nav.match(/class="bottom-nav-item/gu)).toHaveLength(5);
    expectInOrder(nav, [
      '>日历</text>',
      '>通讯录</text>',
      '>换班</text>',
      '>我的</text>',
      '>更多</text>',
    ]);
    expect(nav).toContain('bindtap="handleDirectoryNav"');
    expect(nav).toContain('bindtap="handleProfileNav"');
    expect(nav).not.toContain('bindtap="handleLeaveNav"');
    expect(nav).not.toContain('bindtap="handleDutyNav"');
  });

  it('switches directory, swap, and profile inside the persistent workbench shell', () => {
    const template = read('src/pages/workbench/index.wxml');
    const source = read('src/pages/workbench/index.ts');
    const pageJson = JSON.parse(read('src/pages/workbench/index.json'));

    expect(source).toContain(
      "const PRIMARY_WORKSPACES = ['calendar', 'directory', 'swap', 'profile', 'more']",
    );
    expect(source).toContain('type ActiveWorkspace = (typeof PRIMARY_WORKSPACES)[number]');
    expect(source).toContain('handleDirectoryNav');
    expect(source).toContain("activatePrimaryWorkspace(this, 'directory'");
    expect(source).toContain('handleProfileNav');
    expect(source).toContain("activatePrimaryWorkspace(this, 'profile'");
    expect(source).toContain('workspaceMounted:');
    expect(source).toContain('workspaceReady:');
    expect(source).toContain('directoryPanelReady: false');
    expect(source).toContain('profilePanelReady: false');
    expect(source).toContain('handleDirectoryPanelReady');
    expect(source).toContain('handleProfilePanelReady');
    expect(template).toContain('<directory-panel');
    expect(template).toContain('embedded="{{true}}"');
    expect(template).toContain('group-id="{{currentGroupId}}"');
    expect(template).toContain('<profile-workspace');
    expect(template).toContain('<workflow-swap-panel');
    expect(template).toContain('workspaceMounted.directory');
    expect(template).toContain('workspaceMounted.profile');
    expect(template).toContain('wx:elif="{{!workspaceReady.directory}}"');
    expect(template).toContain('wx:if="{{!workspaceReady.profile}}"');
    expect(template).toContain('bind:panelready="handleWorkspaceReady"');
    expect(template).toContain('bind:workspaceready="handleWorkspaceReady"');
    expect(template).toContain('class="embedded-workspace-loading"');
    expect(template).not.toContain('<group-settings-panel');
    expect(template).not.toContain('<workflow-leave-panel');
    expect(template).not.toContain('<workflow-duty-panel');
    expect(pageJson.usingComponents['directory-panel']).toBe(
      '/subpackages/organization/components/directory-panel/index',
    );
    expect(pageJson.usingComponents['profile-workspace']).toBe(
      '/components/profile-workspace/index',
    );
    expect(pageJson.usingComponents['ui-loading']).toBe('/components/ui/ui-loading/index');
    expect(pageJson.usingComponents['workflow-swap-panel']).toBe(
      '/subpackages/workflows/components/workflow-swap-panel/index',
    );
    expect(pageJson.usingComponents['group-settings-panel']).toBeUndefined();
    expect(pageJson.usingComponents['workflow-leave-panel']).toBeUndefined();
    expect(pageJson.usingComponents['workflow-duty-panel']).toBeUndefined();
  });

  it('groups secondary tools in Web order and opens displaced workflows as child pages', () => {
    const template = read('src/pages/workbench/index.wxml');
    const source = read('src/pages/workbench/index.ts');
    const more = template.slice(
      template.indexOf('class="more-workspace '),
      template.indexOf("activeWorkspace === 'calendar' && filterOpen"),
    );

    expectInOrder(more, [
      '群组与排班',
      '群组管理',
      '手动排班',
      '排班补录',
      '请假',
      '加扣班',
      '排班配置',
      '信息与通知',
      '事件与统计',
      '通知设置',
      '通知中心',
      '导出排班',
      '访问与平台',
      '邀请与访客',
      '访客访问',
      '平台账号',
      '测试与诊断',
      '测试中心',
    ]);
    expect(more).not.toContain('院内通讯录');
    expect(more).toContain('wx:if="{{testCenterEnabled}}"');
    expect(more).not.toContain('toolAccess.testCenter');
    expect(source).toContain("'/subpackages/organization/pages/group-settings/index'");
    expect(source).toContain("'/subpackages/workflows/pages/leave/index'");
    expect(source).toContain("'/subpackages/workflows/pages/duty/index'");
    expect(source).toContain("'/pages/gesture-probe/index'");
    expect(source).toContain('testCenterEnabled: buildInfo.testCenterEnabled');
  });

  it('shares directory and profile content between embedded and direct Page hosts', () => {
    const directoryTemplate = read(
      'src/subpackages/organization/components/directory-panel/index.wxml',
    );
    const directoryController = read(
      'src/subpackages/organization/components/directory-panel/controller.ts',
    );
    const profileComponentRoot = path.join(miniRoot, 'src', 'components', 'profile-panel');
    const profileWorkspaceRoot = path.join(miniRoot, 'src', 'components', 'profile-workspace');

    expect(directoryTemplate).toContain('wx:if="{{!embedded}}"');
    expect(directoryController).toContain('embedded: { type: Boolean, value: false }');
    expect(directoryController).toContain('shellContentStyle: embedded');
    expect(directoryController).toContain("? 'height:100%;'");
    expect(existsSync(path.join(profileComponentRoot, 'controller.ts'))).toBe(true);
    expect(existsSync(path.join(profileComponentRoot, 'index.ts'))).toBe(true);
    expect(existsSync(path.join(profileWorkspaceRoot, 'index.ts'))).toBe(true);
    expect(read('src/pages/profile/index.wxml').trim()).toBe(
      '<include src="../../components/profile-panel/index.wxml" />',
    );
    expect(read('src/pages/profile/index.wxss')).toContain(
      "@import '../../components/profile-panel/index.wxss';",
    );
    expect(read('src/components/profile-panel/index.wxml')).toContain('wx:if="{{!embedded}}"');
    expect(read('src/components/profile-panel/index.ts')).toContain("triggerEvent?.('panelready')");
    expect(read('src/components/profile-workspace/index.ts')).toContain(
      "triggerEvent?.('workspaceready')",
    );
    expect(directoryController).toContain("triggerEvent?.('panelready')");
  });

  it('emits only components still reachable from the workbench', () => {
    const buildTools = read('scripts/build-tools.mjs');

    expect(buildTools).not.toContain(
      "'subpackages/organization/components/directory-panel/index.ts'",
    );
    for (const modulePath of [
      'subpackages/organization/components/group-settings-panel/index.ts',
      'subpackages/workflows/components/workflow-leave-panel/index.ts',
      'subpackages/workflows/components/workflow-duty-panel/index.ts',
    ]) {
      expect(buildTools).toContain(`'${modulePath}'`);
    }
    expect(buildTools).not.toContain(
      "'subpackages/workflows/components/workflow-swap-panel/index.ts'",
    );
    expect(buildTools).toContain("'components/profile-panel/index.ts'");
  });
});
