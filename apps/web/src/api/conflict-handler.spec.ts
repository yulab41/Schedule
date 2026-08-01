import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';

import { ApiClientError } from './client.js';
import {
  getConflictLatestData,
  getConflictMessage,
  getVersionConflictSummary,
  isDataConflictError,
} from './conflict-handler.js';

vi.mock('@cloudbase/js-sdk', () => ({
  default: { init: vi.fn() },
}));

describe('Web conflict handler', () => {
  it('recognizes API conflict errors and reads the latest summary', () => {
    const conflict = new ApiClientError({
      code: 'CONFLICT',
      latestData: {
        id: 'template-1',
        objectType: 'manual_schedule_template',
        version: 2,
      },
      message: '模板已被其他管理员更新，请刷新后重试。',
      status: 409,
    });

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
    const forbidden = new ApiClientError({
      code: 'FORBIDDEN',
      message: '当前账户无权执行此操作。',
      status: 403,
    });

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
