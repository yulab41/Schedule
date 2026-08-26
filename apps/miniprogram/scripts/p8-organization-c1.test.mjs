import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(path.join(appRoot, relativePath), 'utf8');
}

describe('P8-C-1 native organization management', () => {
  it('extends the existing organization subpackage entry instead of creating a second page', () => {
    const app = JSON.parse(read('src/app.json'));
    const groupSettingsPage = read('src/subpackages/organization/pages/group-settings/index.ts');
    const panel = read('src/subpackages/organization/components/group-settings-panel/index.wxml');

    expect(app.subpackages).toContainEqual({
      root: 'subpackages/organization',
      pages: [
        'pages/group-settings/index',
        'pages/scheduling-config/index',
        'pages/invite-visitor/index',
        'pages/platform-accounts/index',
        'pages/directory/index',
      ],
    });
    expect(groupSettingsPage).toContain('groupId');
    expect(panel).toContain('成员与预设');
    expect(panel).toContain('认领请求');
    expect(panel).toContain('联系方式');
    expect(panel).toContain('添加预设成员');
  });

  it('uses the shared organization write boundary and organization capability', () => {
    const runtime = read('src/platform/client-core-calendar.ts');
    const controller = read(
      'src/subpackages/organization/components/group-settings-panel/controller.ts',
    );

    expect(runtime).toContain('createRuntimeOrganizationWriteClient');
    expect(runtime).toContain('createOrganizationWriteClient');
    expect(controller).toContain('createRuntimeOrganizationReadClient');
    expect(controller).toContain('createRuntimeOrganizationWriteClient');
    expect(controller).toContain("requireClientCapability('organization')");
    expect(controller).toContain('operationId');
    expect(controller).toContain('expectedVersion');
  });

  it('keeps phone, token, and operation payloads in memory only', () => {
    const controller = read(
      'src/subpackages/organization/components/group-settings-panel/controller.ts',
    );

    expect(controller).not.toMatch(
      /wx\.(setStorageSync|getStorageSync)\([^)]*(phone|token|operation)/iu,
    );
    expect(controller).not.toMatch(/visitorKey\s*:/u);
    expect(controller).not.toMatch(/rawTicket\s*:/u);
    expect(controller).toContain('memberCards');
    expect(controller).not.toContain('wx.setStorageSync');
  });

  it('reflows group settings for system large text without clipping member actions', () => {
    const controller = read(
      'src/subpackages/organization/components/group-settings-panel/controller.ts',
    );
    const panel = read('src/subpackages/organization/components/group-settings-panel/index.wxml');
    const styles = read('src/subpackages/organization/components/group-settings-panel/index.wxss');

    expect(controller).toContain('largeText');
    expect(controller).toContain('fontSizeSetting');
    expect(panel).toContain("largeText ? 'is-large-text' : ''");
    expect(styles).toContain('.group-settings-page.is-large-text .group-name');
    expect(styles).toContain('.group-settings-page.is-large-text .member-row-name');
    expect(styles).toContain('white-space: normal');
  });
});
