export interface MiniProgramRuntimeInfo {
  readonly envVersion: string;
  readonly version: string;
}

export function getMiniProgramRuntimeInfo(
  getAccountInfoSync: (() => unknown) | undefined,
): MiniProgramRuntimeInfo {
  try {
    const accountInfo = getAccountInfoSync?.() as
      | { readonly miniProgram?: { readonly envVersion?: unknown; readonly version?: unknown } }
      | undefined;
    const miniProgram = accountInfo?.miniProgram;
    return {
      envVersion:
        typeof miniProgram?.envVersion === 'string' && miniProgram.envVersion.length > 0
          ? miniProgram.envVersion
          : '未知环境',
      version:
        typeof miniProgram?.version === 'string' && miniProgram.version.length > 0
          ? miniProgram.version
          : '未提供',
    };
  } catch {
    return { envVersion: '未知环境', version: '未提供' };
  }
}
