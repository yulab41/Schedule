import { describe, expect, it } from 'vitest';

import { ApiClientError } from '../api/client.js';
import {
  getConflictLatestData,
  getConflictMessage,
  getVersionConflictSummary,
  isDataConflictError,
} from './conflict.js';

describe('miniprogram conflict handler', () => {
  it('recognizes API conflict errors and reads the latest summary', () => {
    const conflict = new ApiClientError(
      'CONFLICT',
      '模板已被其他管理员更新，请刷新后重试。',
      undefined,
      {
        id: 'template-1',
        objectType: 'manual_schedule_template',
        version: 2,
      },
      409,
    );

    expect(isDataConflictError(conflict)).toBe(true);
    expect(getConflictLatestData(conflict)).toEqual({
      id: 'template-1',
      objectType: 'manual_schedule_template',
      version: 2,
    });
    expect(getConflictMessage(conflict)).toBe('模板已被其他管理员更新，请刷新后重试。');
    expect(getVersionConflictSummary(getConflictLatestData(conflict))).toBe(
      'manual_schedule_template 已更新到版本 2',
    );
  });

  it('ignores non-conflict and non-API errors', () => {
    const forbidden = new ApiClientError('FORBIDDEN', '当前账户无权执行此操作。', undefined);

    expect(isDataConflictError(forbidden)).toBe(false);
    expect(getConflictLatestData(forbidden)).toBeUndefined();
    expect(getConflictMessage(forbidden)).toBe('排班已被其他操作更新，请刷新后重新确认。');
    expect(isDataConflictError(new Error('network'))).toBe(false);
  });

  it('summarizes only version conflict payloads', () => {
    expect(
      getVersionConflictSummary({
        id: 'period-1',
        objectType: 'schedule_period',
        version: 4,
      }),
    ).toBe('schedule_period 已更新到版本 4');
    expect(getVersionConflictSummary({ version: 4 })).toBeUndefined();
    expect(getVersionConflictSummary(undefined)).toBeUndefined();
  });
});
