export const offlineSubmitMessage = '当前处于离线状态，提交已暂停。恢复网络连接后，请重新提交。';

export function isMutationMethod(method: string): boolean {
  return method !== 'GET';
}

export function getOfflineSubmitError(isOnline: boolean, method: string): string | undefined {
  return isOnline || !isMutationMethod(method) ? undefined : offlineSubmitMessage;
}

export function isNavigatorOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}
