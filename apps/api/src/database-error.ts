/**
 * 数据库驱动错误码读取：mysql2 错误带 `code`（如 ER_DUP_ENTRY），
 * drizzle 或业务包装可能把原错误放进 `cause`，统一沿 cause 链查找。
 */
export function getDatabaseErrorCode(error: unknown): unknown {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  if ('code' in error) {
    return error.code;
  }

  return 'cause' in error ? getDatabaseErrorCode(error.cause) : undefined;
}

export function isDuplicateKeyError(error: unknown): boolean {
  return getDatabaseErrorCode(error) === 'ER_DUP_ENTRY';
}
