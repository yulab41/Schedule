export interface PasswordReminderRuntime {
  checkedAccounts: Set<string>;
  activeEditors: Map<string, object>;
}
const fallback = createPasswordReminderRuntime();
export function createPasswordReminderRuntime(): PasswordReminderRuntime {
  return { checkedAccounts: new Set<string>(), activeEditors: new Map<string, object>() };
}
export function getPasswordReminderRuntime(): PasswordReminderRuntime {
  if (typeof getApp !== 'function') return fallback;
  try {
    const data = getApp<{ globalData?: { passwordReminderRuntime?: PasswordReminderRuntime } }>()
      .globalData;
    if (!data) return fallback;
    return (data.passwordReminderRuntime ??= createPasswordReminderRuntime());
  } catch {
    return fallback;
  }
}
export function resetPasswordReminderLaunch(): void {
  const runtime = getPasswordReminderRuntime();
  runtime.checkedAccounts.clear();
  runtime.activeEditors.clear();
}
