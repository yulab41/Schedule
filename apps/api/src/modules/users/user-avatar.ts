import { createHash } from 'node:crypto';

import { ApiError } from '../../plugins/error-handler.js';

export const MAX_USER_PROFILE_AVATAR_BYTES = 1024 * 1024;

export type UserProfileAvatarContentType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface UserProfileAvatarInspection {
  readonly byteLength: number;
  readonly contentType: UserProfileAvatarContentType;
  readonly sha256: string;
}

export interface StoredUserProfileAvatar {
  readonly content: Buffer;
  readonly contentType: UserProfileAvatarContentType;
  readonly sha256: string;
  readonly version: number;
}

const signatures: Readonly<Record<UserProfileAvatarContentType, (content: Buffer) => boolean>> = {
  'image/jpeg': (content) => hasPrefix(content, [0xff, 0xd8, 0xff]),
  'image/png': (content) => hasPrefix(content, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'image/webp': (content) => hasAsciiAt(content, 0, 'RIFF') && hasAsciiAt(content, 8, 'WEBP'),
};

export function inspectUserProfileAvatar(
  content: Buffer,
  contentTypeInput: string,
): UserProfileAvatarInspection {
  const contentType = normalizeContentType(contentTypeInput);
  if (
    content.length < 1 ||
    content.length > MAX_USER_PROFILE_AVATAR_BYTES ||
    contentType === undefined ||
    !signatures[contentType](content)
  ) {
    throw invalidAvatarError();
  }
  return {
    byteLength: content.length,
    contentType,
    sha256: createHash('sha256').update(content).digest('hex'),
  };
}

function normalizeContentType(value: string): UserProfileAvatarContentType | undefined {
  const normalized = value.split(';', 1)[0]?.trim().toLowerCase();
  return normalized === 'image/jpeg' || normalized === 'image/png' || normalized === 'image/webp'
    ? normalized
    : undefined;
}

function hasPrefix(content: Buffer, expected: readonly number[]): boolean {
  return expected.every((value, index) => content[index] === value);
}

function hasAsciiAt(content: Buffer, offset: number, expected: string): boolean {
  return (
    content.length >= offset + expected.length &&
    content.toString('ascii', offset, offset + expected.length) === expected
  );
}

function invalidAvatarError(): ApiError {
  return new ApiError({
    code: 'VALIDATION_FAILED',
    statusCode: 400,
    userMessage: '头像必须是 1 MiB 以内的 JPEG、PNG 或 WebP 图片。',
  });
}
