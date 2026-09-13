import { beforeEach, describe, expect, it, vi } from 'vitest';

import { composeVisitorQrCard } from '../src/platform/visitor-qr-card.ts';

describe('visitor QR card', () => {
  beforeEach(() => {
    globalThis.wx = {};
  });

  it('draws the QR and group name into one PNG image', async () => {
    const fillText = vi.fn();
    const drawImage = vi.fn();
    globalThis.wx.createOffscreenCanvas = () => ({
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
    });

    await expect(composeVisitorQrCard('data:image/png;base64,qr', '医生群')).resolves.toBe(
      'data:image/png;base64,card',
    );
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(fillText).toHaveBeenCalledWith('医生群', 360, 755, 640);
  });
});
