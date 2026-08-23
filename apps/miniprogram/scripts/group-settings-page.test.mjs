import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const miniRoot = process.cwd();
const sourceRoot = path.join(miniRoot, 'src');
const pageRoot = path.join(sourceRoot, 'subpackages', 'organization', 'pages', 'group-settings');

function readPageFile(extension) {
  const filePath = path.join(pageRoot, `index.${extension}`);
  expect(existsSync(filePath), `missing native P5 group settings page ${filePath}`).toBe(true);
  return readFileSync(filePath, 'utf8');
}

describe('native P5 group mobile-phone consent page', () => {
  it('registers group settings in the organization subpackage only', () => {
    const appJson = JSON.parse(readFileSync(path.join(sourceRoot, 'app.json'), 'utf8'));
    expect(appJson.subpackages).toContainEqual({
      pages: ['pages/group-settings/index'],
      root: 'subpackages/organization',
    });
    expect(
      appJson.subpackages.find((subpackage) => subpackage.root === 'subpackages/scheduling')?.pages,
    ).not.toContain('pages/group-settings/index');
  });

  it('puts the entry in the active group menu without repurposing More', () => {
    const template = readFileSync(
      path.join(sourceRoot, 'pages', 'workbench', 'index.wxml'),
      'utf8',
    );
    const source = readFileSync(path.join(sourceRoot, 'pages', 'workbench', 'index.ts'), 'utf8');
    const groupMenu = template.slice(
      template.indexOf('class="group-menu"'),
      template.indexOf('<text class="shell-page-title">'),
    );

    expect(template).toContain('wx:if="{{canOpenGroupSettings}}"');
    expect(template).toContain('class="group-settings-option"');
    expect(template).toContain('bindtap="handleOpenGroupSettings"');
    expect(groupMenu).toContain('群组设置');
    expect(source).toContain('/subpackages/organization/pages/group-settings/index?groupId=');
    expect(source).toContain("selectedGroup.role !== 'guest'");
    expect(template).toMatch(
      /data-label="更多"[\s\S]*?aria-disabled="true"[\s\S]*?bindtap="handleUnavailable"/u,
    );
  });

  it('mirrors the accepted PhoneConsent390 information hierarchy and all native states', () => {
    const template = readPageFile('wxml');
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
    expect(readPageFile('ts')).toContain("'撤回同意'");
  });

  it('uses Skyline-safe flex layout, the 22 by 22 golden checkbox, compact class, and 44px actions', () => {
    const styles = readPageFile('wxss');
    const template = readPageFile('wxml');
    const pageJson = JSON.parse(readPageFile('json'));

    expect(pageJson.renderer).toBe('skyline');
    expect(pageJson.usingComponents['ui-switch']).toBeUndefined();
    expect(template).toContain('class="group-settings-page {{viewportClass}}"');
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
    const source = readPageFile('ts');
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
