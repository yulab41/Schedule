import { describe, expect, it } from 'vitest';

import { ApiClientError } from '../api/client.js';
import { toUserMessage } from './user-message.js';

describe('toUserMessage', () => {
  it('returns the API client error message', () => {
    const error = new ApiClientError('NETWORK_ERROR', '网络连接已断开。', undefined);

    expect(toUserMessage(error, '操作未完成，请稍后重试。')).toBe('网络连接已断开。');
  });

  it('returns a generic error message', () => {
    expect(toUserMessage(new Error('账号或密码不正确，请重试。'), '操作未完成，请稍后重试。')).toBe(
      '账号或密码不正确，请重试。',
    );
  });

  it('falls back when the error message is empty', () => {
    expect(toUserMessage(new Error(''), '操作未完成，请稍后重试。')).toBe(
      '操作未完成，请稍后重试。',
    );
  });

  it('falls back for non-error values', () => {
    expect(toUserMessage('unexpected payload', '操作未完成，请稍后重试。')).toBe(
      '操作未完成，请稍后重试。',
    );
    expect(toUserMessage(undefined, '操作未完成，请稍后重试。')).toBe('操作未完成，请稍后重试。');
  });
});
