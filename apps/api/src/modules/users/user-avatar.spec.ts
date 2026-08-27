import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { ApiError } from '../../plugins/error-handler.js';
import { inspectUserProfileAvatar, MAX_USER_PROFILE_AVATAR_BYTES } from './user-avatar.js';

describe('user profile avatar validation', () => {
  it.each([
    ['image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00])],
    ['image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])],
    [
      'image/webp',
      Buffer.from([0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]),
    ],
  ] as const)('accepts a matching %s signature', (contentType, content) => {
    expect(inspectUserProfileAvatar(content, contentType)).toEqual({
      byteLength: content.length,
      contentType,
      sha256: createHash('sha256').update(content).digest('hex'),
    });
  });

  it('rejects empty, oversized, unsupported, and mismatched image bodies', () => {
    for (const [content, contentType] of [
      [Buffer.alloc(0), 'image/png'],
      [Buffer.alloc(MAX_USER_PROFILE_AVATAR_BYTES + 1, 0x89), 'image/png'],
      [Buffer.from('<svg/>'), 'image/svg+xml'],
      [Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'image/jpeg'],
    ] as const) {
      expect(() => inspectUserProfileAvatar(content, contentType)).toThrowError(ApiError);
      try {
        inspectUserProfileAvatar(content, contentType);
      } catch (error) {
        expect(error).toMatchObject({ code: 'VALIDATION_FAILED', statusCode: 400 });
      }
    }
  });
});
