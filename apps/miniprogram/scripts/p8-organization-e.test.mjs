import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(path.join(appRoot, relativePath), 'utf8');
}

describe('P8-E native platform account administration', () => {
  it('registers a native platform account page and More entry', () => {
    const app = JSON.parse(read('src/app.json'));
    const panel = read(
      'src/subpackages/organization/components/platform-accounts-panel/index.wxml',
    );
    const workbench = read('src/pages/workbench/index.wxml');

    expect(app.subpackages).toContainEqual({
      root: 'subpackages/organization',
      pages: [
        'pages/group-settings/index',
        'pages/scheduling-config/index',
        'pages/invite-visitor/index',
        'pages/platform-accounts/index',
      ],
    });
    expect(panel).toContain('平台账号');
    expect(panel).toContain('分配用户名');
    expect(panel).toContain('绑定链接');
    expect(workbench).toContain('handleOpenPlatformAccounts');
  });

  it('uses shared platform identity writes and organization capability without inferring group roles', () => {
    const runtime = read('src/platform/client-core-calendar.ts');
    const controller = read(
      'src/subpackages/organization/components/platform-accounts-panel/controller.ts',
    );

    expect(runtime).toContain('createRuntimePlatformIdentityWriteClient');
    expect(runtime).toContain('createPlatformIdentityWriteClient');
    expect(controller).toContain('listPlatformUserAccounts');
    expect(controller).toContain('createRuntimePlatformIdentityWriteClient');
    expect(controller).toContain("requireClientCapability('organization')");
    expect(controller).toContain('expectedAuthVersion');
    expect(controller).toContain('operationId');
    expect(controller).toContain('平台管理员');
  });

  it('does not persist names, passwords, binding URLs, tickets, or subjects', () => {
    const controller = read(
      'src/subpackages/organization/components/platform-accounts-panel/controller.ts',
    );

    expect(controller).not.toContain('wx.setStorageSync');
    expect(controller).not.toContain('wx.getStorageSync');
    expect(controller).not.toContain('password:');
    expect(controller).not.toContain('ticket:');
    expect(controller).not.toContain('subject:');
    expect(controller).toContain('bindingUrl');
  });
});
