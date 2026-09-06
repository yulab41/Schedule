import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const miniRoot = process.cwd();
const sourceRoot = path.join(miniRoot, 'src');
const pageRoot = path.join(sourceRoot, 'subpackages', 'organization', 'pages', 'group-settings');
const componentRoot = path.join(
  sourceRoot,
  'subpackages',
  'organization',
  'components',
  'group-settings-panel',
);

function readPageFile(extension) {
  const filePath = path.join(pageRoot, `index.${extension}`);
  expect(existsSync(filePath), `missing native P5 group settings page ${filePath}`).toBe(true);
  return readFileSync(filePath, 'utf8');
}

describe('native P5 group mobile-phone consent page', () => {
  it('keeps disclosure labels stable while saving and puts leave after disclosure', () => {
    const template = readFileSync(path.join(componentRoot, 'index.wxml'), 'utf8');
    const disclosureStart = template.indexOf('<view class="group-card contact-disclosure-card">');
    const leaveStart = template.indexOf(
      '<view wx:if="{{canLeaveGroup}}" class="group-leave-action">',
    );
    const disclosure = template.slice(disclosureStart, leaveStart);
    expect(disclosure).not.toContain('正在保存');
    expect(disclosure).toContain('loading="{{isSaving}}"');
    expect(disclosureStart).toBeGreaterThan(-1);
    expect(leaveStart).toBeGreaterThan(disclosureStart);
  });
  it('registers group settings in the organization subpackage only', () => {
    const appJson = JSON.parse(readFileSync(path.join(sourceRoot, 'app.json'), 'utf8'));
    expect(appJson.subpackages).toContainEqual({
      pages: [
        'pages/group-settings/index',
        'pages/scheduling-config/index',
        'pages/invite-visitor/index',
        'pages/platform-accounts/index',
        'pages/directory/index',
      ],
      root: 'subpackages/organization',
    });
    expect(
      appJson.subpackages.find((subpackage) => subpackage.root === 'subpackages/scheduling')?.pages,
    ).not.toContain('pages/group-settings/index');
  });

  it('keeps the group switcher focused and puts group administration under More', () => {
    const template = readFileSync(
      path.join(sourceRoot, 'pages', 'workbench', 'index.wxml'),
      'utf8',
    );
    const source = readFileSync(path.join(sourceRoot, 'pages', 'workbench', 'index.ts'), 'utf8');
    const groupMenu = template.slice(
      template.indexOf('class="group-menu"'),
      template.indexOf('<text class="shell-page-title">'),
    );

    expect(template).toContain('bindtap="handleOpenGroupSettings"');
    expect(groupMenu).not.toContain('群组设置');
    expect(template).toMatch(/activeWorkspace === 'more'[\s\S]*?群组管理/u);
    expect(template).toContain('手动排班');
    expect(template).toContain('排班补录');
    expect(source).toContain("'/subpackages/organization/pages/group-settings/index'");
    expect(template).not.toContain('<group-settings-panel');
    expect(template).not.toContain("activeWorkspace !== 'group'");
    expect(source).toContain('createWorkbenchToolAccess');
    expect(source).toContain('toolAccess.groupSettings');
    expect(template).toMatch(/data-label="更多"[\s\S]*?bindtap="handleMoreNav"/u);
  });

  it('keeps consent controls and essential states after redundant content removal', () => {
    const template = readFileSync(path.join(componentRoot, 'index.wxml'), 'utf8');
    for (const expected of [
      '返回排班台',
      '群组管理',
      '当前工作群组',
      '群内公开手机号',
      'contact-disclosure-card',
      '重试保存',
    ]) {
      expect(template).toContain(expected);
    }
    for (const retired of ['共享群组码', '协作身份', 'contact-member-row', 'privacy-boundary'])
      expect(template).not.toContain(retired);
    expect(template).toContain("state === 'loading'");
    expect(template).toContain("state === 'error'");
    expect(template).toContain("consentState === 'missing-phone'");

    expect(template).toContain('bind:change="handleConsentToggle"');
    expect(template).toContain('bindtap="handleSave"');
    expect(template).toContain('bindtap="handleRetry"');
  });

  it('reuses the group settings controller in a standalone direct Page', () => {
    const buildTools = readFileSync(path.join(miniRoot, 'scripts', 'build-tools.mjs'), 'utf8');
    const pageSource = readPageFile('ts');
    const workbenchJson = JSON.parse(
      readFileSync(path.join(sourceRoot, 'pages', 'workbench', 'index.json'), 'utf8'),
    );

    expect(readPageFile('wxml').trim()).toBe(
      '<include src="../../components/group-settings-panel/index.wxml" />',
    );
    expect(pageSource).toContain('createGroupSettingsPanelControllerDefinition(false)');
    expect(workbenchJson.usingComponents['group-settings-panel']).toBeUndefined();
    expect(buildTools).toContain(
      "'subpackages/organization/components/group-settings-panel/index.ts'",
    );
  });

  it('reuses the leaf capsule switch at the bottom and removes the old checkbox and wrapper', () => {
    const styles = readFileSync(path.join(componentRoot, 'index.wxss'), 'utf8');
    const template = readFileSync(path.join(componentRoot, 'index.wxml'), 'utf8');
    const pageJson = JSON.parse(readPageFile('json'));
    expect(pageJson.renderer).toBe('skyline');
    expect(pageJson.usingComponents['ui-switch']).toBe('/components/ui/ui-switch/index');
    expect(template).toContain('checked="{{desiredConsent}}"');
    expect(template).toContain('loading="{{isSaving}}"');
    expect(template.indexOf('contact-disclosure-card')).toBeGreaterThan(
      template.indexOf('member-management-card'),
    );
    expect(template).not.toContain('phone-consent-checkbox');
    expect(template).not.toContain('consent-save');
    expect(styles).not.toMatch(/display:\s*grid/u);
    expect(styles).not.toContain('grid-template');
    expect(styles).not.toContain('@media');
  });
  it('uses the shared runtime client without persisting phone, consent, payload, or a write queue', () => {
    const source = readFileSync(path.join(componentRoot, 'controller.ts'), 'utf8');
    const factory = readFileSync(
      path.join(sourceRoot, 'platform', 'client-core-calendar.ts'),
      'utf8',
    );

    expect(factory).toContain('createRuntimeGroupMobilePhoneConsentClient');
    expect(factory).toContain('createGroupMobilePhoneConsentClient');
    expect(source).toContain('createRuntimeGroupMobilePhoneConsentClient');
    expect(source).not.toContain('maskedMobilePhone');
    expect(source).not.toContain('fullMobilePhone');
    expect(source).not.toContain('rawMobilePhone');
    expect(source).not.toContain('setStorageSync');
    expect(source).not.toContain('writeWorkbenchCache');
    expect(source).not.toContain('offlineQueue');
    expect(source).not.toContain('requestBody');
  });
});
