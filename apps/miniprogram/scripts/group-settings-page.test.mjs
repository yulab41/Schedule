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

  it('mirrors the accepted PhoneConsent390 information hierarchy and all native states', () => {
    const template = readFileSync(path.join(componentRoot, 'index.wxml'), 'utf8');
    for (const expected of [
      '返回排班台',
      '群组管理',
      '协作身份',
      '当前工作群组',
      '共享群组码',
      '联系方式公开',
      '我的手机号公开设置',
      '仅自己',
      '说明版本',
      '允许本群组显示完整手机号',
      '管理员不能代替成员授权',
      '保存同意',
    ]) {
      expect(template).toContain(expected);
    }
    expect(template).toContain("state === 'loading'");
    expect(template).toContain("state === 'error'");
    expect(template).toContain("consentState === 'missing-phone'");
    expect(template).toContain("consentState === 'stale'");
    expect(template).toContain('bindtap="handleConsentToggle"');
    expect(template).toContain('bindtap="handleSave"');
    expect(template).toContain('bindtap="handleRetry"');
    expect(readFileSync(path.join(componentRoot, 'controller.ts'), 'utf8')).toContain("'撤回同意'");
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

  it('uses Skyline-safe flex layout, the 22 by 22 golden checkbox, compact class, and 44px actions', () => {
    const styles = readFileSync(path.join(componentRoot, 'index.wxss'), 'utf8');
    const template = readFileSync(path.join(componentRoot, 'index.wxml'), 'utf8');
    const pageJson = JSON.parse(readPageFile('json'));

    expect(pageJson.renderer).toBe('skyline');
    expect(pageJson.usingComponents['ui-switch']).toBeUndefined();
    expect(template).toContain('group-settings-page {{viewportClass}}');
    expect(template).toContain('aria-role="switch"');
    expect(template).toContain('aria-checked="{{desiredConsent}}"');
    expect(styles).toContain('.group-settings-page.is-compact');
    expect(styles).toContain('min-height: 44px');
    expect(styles).toMatch(
      /\.phone-consent-control\s*\{[^}]*min-height:\s*58px;[^}]*display:\s*flex;|\.phone-consent-control\s*\{[^}]*display:\s*flex;[^}]*min-height:\s*58px;/su,
    );
    expect(styles).toMatch(
      /\.phone-consent-checkbox\s*\{[^}]*width:\s*22px;[^}]*height:\s*22px;/su,
    );
    expect(styles).not.toMatch(/display:\s*grid/u);
    expect(styles).not.toContain('grid-template');
    expect(styles).not.toContain('clamp(');
    expect(styles).not.toContain('@media');
    expect(template).not.toContain('<ui-switch');
    expect(template).not.toContain('class="consent-state');
    expect(template).not.toContain('class="action-note"');
    expect(template).not.toContain('class="save-hint"');
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
    expect(source).toContain('maskedMobilePhone');
    expect(source).not.toContain('fullMobilePhone');
    expect(source).not.toContain('rawMobilePhone');
    expect(source).not.toContain('setStorageSync');
    expect(source).not.toContain('writeWorkbenchCache');
    expect(source).not.toContain('offlineQueue');
    expect(source).not.toContain('requestBody');
  });
});
