/**
 * 将任意错误转换为面向用户的文案：可读 Error 直接展示其 message，
 * 其余情况统一使用调用方提供的兜底文案，避免把技术性错误直接抛给用户。
 */
export function toUserMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}
