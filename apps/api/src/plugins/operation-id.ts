import { z } from 'zod';

import { ApiError } from './error-handler.js';

const operationIdSchema = z.string().uuid();

export function resolveDangerousOperationId(
  rawHeader: string | readonly string[] | undefined,
  bodyOperationId?: string,
): string {
  const headerOperationId = rawHeader === undefined ? undefined : parseOperationId(rawHeader);
  const parsedBodyOperationId =
    bodyOperationId === undefined ? undefined : parseOperationId(bodyOperationId);

  if (
    headerOperationId !== undefined &&
    parsedBodyOperationId !== undefined &&
    headerOperationId !== parsedBodyOperationId
  ) {
    throw validationError('幂等键与请求中的操作编号不一致。');
  }
  if (headerOperationId === undefined && parsedBodyOperationId === undefined) {
    throw validationError('危险操作必须提供幂等键。');
  }

  return headerOperationId ?? parsedBodyOperationId ?? '';
}

function parseOperationId(value: string | readonly string[]): string {
  const result = operationIdSchema.safeParse(value);
  if (!result.success) {
    throw validationError('请求数据不符合要求。');
  }
  return result.data;
}

function validationError(userMessage: string): ApiError {
  return new ApiError({ code: 'VALIDATION_FAILED', statusCode: 400, userMessage });
}
