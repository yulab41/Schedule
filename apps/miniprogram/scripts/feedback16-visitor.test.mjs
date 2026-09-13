import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('feedback16 visitor controls and QR long press', () => {
  it('keeps return-login inside the guest-only view controls', () => {
    const template = readFileSync('src/pages/guest/guest.wxml', 'utf8');
    const controls =
      /<view id="workbench-content-top" class="view-controls"[\s\S]*?<\/view>\s*<\/view>/.exec(
        template,
      )?.[0];
    expect(controls).toContain('class="guest-return-login"');
    expect(controls).toContain('bindtap="handleReturn"');
    expect(controls).toContain('/assets/icons/ui-chevron-left.svg');
    expect(controls).toContain('返回登录');
    expect(template.slice(0, template.indexOf('class="view-controls"'))).not.toContain(
      'bindtap="handleReturn"',
    );
  });

  it('uses the native long-press image menu and contains no album-save controls', () => {
    const template = readFileSync(
      'src/subpackages/organization/components/invite-visitor-panel/index.wxml',
      'utf8',
    );
    const controller = readFileSync(
      'src/subpackages/organization/components/invite-visitor-panel/controller.ts',
      'utf8',
    );
    const adapter = readFileSync('src/platform/visitor-qr-image.ts', 'utf8');
    expect(template).toContain('show-menu-by-longpress="{{true}}"');
    expect(template).toContain('长按二维码保存或转发');
    expect(template).not.toMatch(/保存到相册|相册设置|handleSaveQr|handleAlbumSettings/);
    expect(controller).not.toMatch(
      /saveVisitorQrImage|qrSaving|albumPermissionDenied|handleSaveQr/,
    );
    expect(adapter).not.toMatch(/saveImageToPhotosAlbum|writeFile|VisitorQrSaveResult/);
  });
});
