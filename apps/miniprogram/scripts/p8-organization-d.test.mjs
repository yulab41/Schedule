import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(path.join(appRoot, relativePath), 'utf8');
}

describe('P8-D native invite and visitor access', () => {
  it('registers an organization invite/visitor page and More entry', () => {
    const app = JSON.parse(read('src/app.json'));
    const panel = read('src/subpackages/organization/components/invite-visitor-panel/index.wxml');
    const workbench = read('src/pages/workbench/index.wxml');

    expect(app.subpackages).toContainEqual({
      root: 'subpackages/organization',
      pages: [
        'pages/group-settings/index',
        'pages/scheduling-config/index',
        'pages/invite-visitor/index',
      ],
    });
    expect(panel).toContain('生成邀请');
    expect(panel).toContain('访客码');
    expect(panel).toContain('群组二维码');
    expect(workbench).toContain('handleOpenInviteVisitor');
  });

  it('uses shared invite writes, group QR reads, and both capabilities', () => {
    const runtime = read('src/platform/client-core-calendar.ts');
    const controller = read(
      'src/subpackages/organization/components/invite-visitor-panel/controller.ts',
    );

    expect(runtime).toContain('createRuntimeInviteVisitorWriteClient');
    expect(runtime).toContain('createInviteVisitorWriteClient');
    expect(controller).toContain('getGroupQr');
    expect(controller).toContain("requireClientCapability('guest')");
    expect(controller).toContain("requireClientCapability('organization')");
    expect(controller).toContain('operationId');
    expect(controller).toContain('expectedTargetVersion');
    expect(controller).toContain('expectedVersion');
  });

  it('keeps invite tokens, visitor keys, and QR bytes in memory only', () => {
    const controller = read(
      'src/subpackages/organization/components/invite-visitor-panel/controller.ts',
    );

    expect(controller).not.toContain('wx.setStorageSync');
    expect(controller).not.toContain('wx.getStorageSync');
    expect(controller).not.toContain('visitorKey:');
    expect(controller).not.toContain('rawTicket:');
    expect(controller).toContain('qrImageSrc');
    expect(controller).toContain('inviteToken');
  });
});
