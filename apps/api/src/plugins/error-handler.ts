import type { ApiErrorCode, ApiErrorResponse, JsonObject } from '@schedule/contracts';
import type { FastifyInstance } from 'fastify';

const internalErrorMessage = '服务器暂时无法处理请求，请稍后重试。';
const notFoundErrorMessage = '请求的资源不存在。';
const rateLimitedErrorMessage = '请求过于频繁，请稍后重试。';
const unsupportedMediaTypeErrorMessage = '不支持的请求内容类型。';
const validationErrorMessage = '请求数据不符合要求。';

// 框架级 4xx 按状态码保留语义；未列入的状态码沿用 VALIDATION_FAILED 兜底。
const frameworkErrorMappings: Readonly<
  Record<number, { readonly code: ApiErrorCode; readonly message: string }>
> = {
  400: { code: 'VALIDATION_FAILED', message: validationErrorMessage },
  404: { code: 'NOT_FOUND', message: notFoundErrorMessage },
  415: { code: 'UNSUPPORTED_MEDIA_TYPE', message: unsupportedMediaTypeErrorMessage },
  429: { code: 'RATE_LIMITED', message: rateLimitedErrorMessage },
};

export class ApiError extends Error {
  public readonly code: ApiErrorCode;
  public readonly statusCode: number;
  public readonly userMessage: string;
  public readonly latestData?: JsonObject;

  public constructor(options: {
    code: ApiErrorCode;
    statusCode: number;
    userMessage: string;
    latestData?: JsonObject;
  }) {
    super(options.userMessage);
    this.name = 'ApiError';
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.userMessage = options.userMessage;

    if (options.latestData !== undefined) {
      this.latestData = options.latestData;
    }
  }
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send(
      createErrorResponse({
        code: 'NOT_FOUND',
        message: notFoundErrorMessage,
        requestId: request.id,
      }),
    );
  });

  app.setErrorHandler((error, request, reply) => {
    const apiError = toApiError(error);

    if (apiError.statusCode >= 500) {
      request.log.error(
        {
          code: apiError.code,
          err: error,
          requestId: request.id,
        },
        'Request failed unexpectedly',
      );
    }

    const response =
      apiError.latestData === undefined
        ? createErrorResponse({
            code: apiError.code,
            message: apiError.userMessage,
            requestId: request.id,
          })
        : createErrorResponse({
            code: apiError.code,
            message: apiError.userMessage,
            requestId: request.id,
            latestData: apiError.latestData,
          });

    reply.status(apiError.statusCode).send(response);
  });
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (isFastifyValidationError(error)) {
    return new ApiError({
      code: 'VALIDATION_FAILED',
      statusCode: 400,
      userMessage: validationErrorMessage,
    });
  }

  const clientErrorStatus = readFastifyClientErrorStatus(error);
  if (clientErrorStatus !== undefined) {
    const mapping = frameworkErrorMappings[clientErrorStatus];
    return new ApiError({
      code: mapping?.code ?? 'VALIDATION_FAILED',
      statusCode: clientErrorStatus,
      userMessage: mapping?.message ?? validationErrorMessage,
    });
  }

  return new ApiError({
    code: 'INTERNAL_ERROR',
    statusCode: 500,
    userMessage: internalErrorMessage,
  });
}

function isFastifyValidationError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'validation' in error;
}

function readFastifyClientErrorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof statusCode === 'number' &&
    Number.isInteger(statusCode) &&
    statusCode >= 400 &&
    statusCode < 500
    ? statusCode
    : undefined;
}

function createErrorResponse({
  code,
  message,
  requestId,
  latestData,
}: {
  code: ApiErrorCode;
  message: string;
  requestId: string;
  latestData?: JsonObject;
}): ApiErrorResponse {
  const error =
    latestData === undefined
      ? { code, message, requestId }
      : { code, message, requestId, latestData };

  return { error };
}
