export type MiniProgramEnvVersion = 'develop' | 'release' | 'trial' | 'unknown';

export interface MiniProgramRuntimeIdentity {
  readonly envVersion: MiniProgramEnvVersion;
  readonly version: string;
}

interface AccountInfoRuntime {
  readonly getAccountInfoSync?: () => {
    readonly miniProgram?: {
      readonly envVersion?: unknown;
      readonly version?: unknown;
    };
  };
}

const allowedEnvironmentVersions = new Set<MiniProgramEnvVersion>(['develop', 'release', 'trial']);

export function readMiniProgramRuntimeIdentity(
  runtime: AccountInfoRuntime = wx as unknown as AccountInfoRuntime,
): MiniProgramRuntimeIdentity {
  try {
    const miniProgram = runtime.getAccountInfoSync?.().miniProgram;
    const candidate = miniProgram?.envVersion;
    const envVersion =
      typeof candidate === 'string' &&
      allowedEnvironmentVersions.has(candidate as MiniProgramEnvVersion)
        ? (candidate as MiniProgramEnvVersion)
        : 'unknown';
    return {
      envVersion,
      version:
        typeof miniProgram?.version === 'string' && miniProgram.version.trim().length > 0
          ? miniProgram.version.trim().slice(0, 32)
          : '未提供',
    };
  } catch {
    return { envVersion: 'unknown', version: '未提供' };
  }
}

export function isTestToolsRuntimeEnabled(
  runtime: AccountInfoRuntime = wx as unknown as AccountInfoRuntime,
): boolean {
  const envVersion = readMiniProgramRuntimeIdentity(runtime).envVersion;
  return envVersion === 'develop' || envVersion === 'trial';
}

export function formatMiniProgramEnvironment(envVersion: MiniProgramEnvVersion): string {
  switch (envVersion) {
    case 'develop':
      return '开发版 develop';
    case 'trial':
      return '体验版 trial';
    case 'release':
      return '正式版 release';
    default:
      return '未知环境（已按正式版保护）';
  }
}
