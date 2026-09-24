import { beforeEach, describe, expect, it, vi } from 'vitest';

import { composeMemberBindingQrCard } from '../src/platform/member-binding-qr-card.ts';

describe('member binding QR card', () => {
  beforeEach(() => {
    globalThis.wx = {};
  });

  it('centers four large metadata fields and wraps a long group name without shrinking the QR', async () => {
    const fillText = vi.fn();
    const drawImage = vi.fn();
    const createOffscreenCanvas = vi.fn(() => ({
      createImage() {
        const image = {};
        Object.defineProperty(image, 'src', {
          set() {
            queueMicrotask(() => image.onload());
          },
        });
        return image;
      },
      getContext: () => ({ fillRect: vi.fn(), fillText, drawImage }),
      toDataURL: () => 'data:image/png;base64,card',
    }));
    globalThis.wx.createOffscreenCanvas = createOffscreenCanvas;

    await composeMemberBindingQrCard('data:image/png;base64,qr', {
      employeeCode: 'd0659',
      expiresAt: '2026-09-21T14:35:00.000+08:00',
      groupName: '头颈外科甲状腺肿瘤多学科医生协作组',
      realName: '冯钦',
    });

    expect(createOffscreenCanvas).toHaveBeenCalledWith({ type: '2d', width: 720, height: 1144 });
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 40, 30, 640, 640);
    expect(fillText.mock.calls.map(([text]) => text).join('|')).not.toContain('群组码');
    expect(fillText.mock.calls).toEqual(
      expect.arrayContaining([
        ['姓名：冯钦', 360, expect.any(Number), 640],
        ['工号：d0659', 360, expect.any(Number), 640],
      ]),
    );
  });
});
