import type { JsonObject } from '@schedule/contracts';

import { ApiError } from '../../plugins/error-handler.js';

export interface AssertExpectedVersionInput {
  readonly actualVersion: number;
  readonly expectedVersion: number;
  readonly id: string;
  readonly latestData?: JsonObject;
  readonly objectType: string;
  readonly userMessage?: string;
}

export function assertExpectedVersion(input: AssertExpectedVersionInput): void {
  if (input.actualVersion === input.expectedVersion) {
    return;
  }

  throw new ApiError({
    code: 'CONFLICT',
    latestData: {
      id: input.id,
      objectType: input.objectType,
      version: input.actualVersion,
      ...input.latestData,
    },
    statusCode: 409,
    userMessage: input.userMessage ?? '资料已被其他操作更新，请刷新后重新确认。',
  });
}
