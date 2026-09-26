import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(path.join(appRoot, relativePath), 'utf8');
}

describe('P8-D native QR and visitor access', () => {
  it('registers the QR/visitor page and removes invite acceptance routes', () => {
    const app = JSON.parse(read('src/app.json'));
    const panel = read('src/subpackages/organization/components/qr-visitor-panel/index.wxml');
    const styles = read('src/subpackages/organization/components/qr-visitor-panel/index.wxss');
    const workbench = read('src/pages/workbench/index.wxml');

    expect(app.subpackages).toContainEqual({
      root: 'subpackages/organization',
      pages: [
        'pages/group-settings/index',
        'pages/scheduling-config/index',
        'pages/qr-visitor/index',
        'pages/platform-accounts/index',
      ],
    });
    expect(app.pages).not.toContain('pages/invite/invite');
    expect(panel).not.toContain('生成邀请');
    expect(panel).not.toContain('群组二维码');
    expect(panel).toContain('成员微信绑定二维码');
    expect(panel).toContain('访客二维码');
    expect(panel).toContain("largeText ? 'is-large-text' : ''");
    expect(styles).toContain('.is-large-text');
    expect(workbench).toContain('handleOpenQrVisitor');
  });

  it('uses environment-specific QR reads and both capabilities', () => {
    const runtime = read('src/platform/client-core-calendar.ts');
    const controller = read(
      'src/subpackages/organization/components/qr-visitor-panel/controller.ts',
    );

    expect(runtime).toContain('createRuntimeQrVisitorWriteClient');
    expect(runtime).toContain('createQrVisitorWriteClient');
    expect(controller).toContain('getVisitorQr');
    expect(controller).toContain('createCurrentMemberWechatBindingQr');
    expect(controller).toContain("requireClientCapability('guest')");
    expect(controller).toContain("requireClientCapability('organization')");
    expect(controller).toContain('operationId');
    expect(controller).not.toContain('expectedTargetVersion');
    expect(controller).toContain('expectedVersion');
    expect(controller).toContain('fontSizeSetting');
  });

  it('keeps visitor keys and QR bytes out of persistent storage and invitation state absent', () => {
    const controller = read(
      'src/subpackages/organization/components/qr-visitor-panel/controller.ts',
    );

    expect(controller).not.toContain('wx.setStorageSync');
    expect(controller).not.toContain('wx.getStorageSync');
    expect(controller).not.toContain('visitorKey:');
    expect(controller).not.toContain('rawTicket:');
    expect(controller).toContain('qrImageSrc');
    expect(controller).not.toContain('inviteToken');
    expect(controller).not.toContain('inviteSharePath');
  });
});
