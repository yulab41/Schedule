import type { ClientCapabilityName, ClientCapabilityResponse } from '@schedule/contracts';

const capabilityNames = [
  'global',
  'core',
  'workflows',
  'organization',
  'insights',
  'externalMessages',
  'guest',
] as const satisfies readonly ClientCapabilityName[];
const capabilityResponseKeys = [...capabilityNames, 'platform', 'version'].sort();

export type ClientCapabilityRequirement = ClientCapabilityName | 'bypass';

export class ClientCapabilityDisabledError extends Error {
  public readonly capability: string;
  public readonly code = 'CLIENT_CAPABILITY_DISABLED';

  public constructor(capability: string) {
    super('当前版本的这项功能已暂停，请稍后重试。');
    this.name = 'ClientCapabilityDisabledError';
    this.capability = capability;
  }
}

export interface ClientCapabilityStore {
  getSnapshot(): ClientCapabilityResponse;
  isEnabled(capability: string): boolean;
  refresh(options?: { readonly force?: boolean }): Promise<ClientCapabilityResponse>;
  require(capability: string): Promise<void>;
}

export function createClientCapabilityStore(input: {
  readonly platform: 'miniprogram';
  readonly read: () => Promise<unknown>;
  readonly version: string;
}): ClientCapabilityStore {
  let hasLoaded = false;
  let inFlight: Promise<ClientCapabilityResponse> | undefined;
  let snapshot = createDisabledSnapshot(input.version);

  const refresh = (
    options: { readonly force?: boolean } = {},
  ): Promise<ClientCapabilityResponse> => {
    if (inFlight !== undefined) return inFlight;
    if (hasLoaded && options.force !== true) return Promise.resolve(snapshot);

    const pending = Promise.resolve()
      .then(input.read)
      .then((value) => normalizeSnapshot(value, input.platform, input.version))
      .catch(() => createDisabledSnapshot(input.version))
      .then((value) => {
        snapshot = value;
        hasLoaded = true;
        return value;
      });
    inFlight = pending;
    void pending.finally(() => {
      if (inFlight === pending) inFlight = undefined;
    });
    return pending;
  };

  return {
    getSnapshot: () => snapshot,
    isEnabled(capability) {
      return isKnownCapability(capability) && snapshot.global && snapshot[capability];
    },
    refresh,
    async require(capability) {
      await refresh();
      if (!isKnownCapability(capability) || !snapshot.global || !snapshot[capability]) {
        throw new ClientCapabilityDisabledError(capability);
      }
    },
  };
}

let runtimeStore = createClientCapabilityStore({
  platform: 'miniprogram',
  read: () => Promise.reject(new ClientCapabilityDisabledError('global')),
  version: 'unknown',
});

export function configureRuntimeClientCapabilityReader(
  read: () => Promise<unknown>,
  version = readBuildVersion(),
): void {
  runtimeStore = createClientCapabilityStore({ platform: 'miniprogram', read, version });
}

export function refreshClientCapabilities(
  options: { readonly force?: boolean } = {},
): Promise<ClientCapabilityResponse> {
  return resolveRuntimeStore().refresh(options);
}

export function requireClientCapability(
  capability: ClientCapabilityRequirement | string,
): Promise<void> {
  if (capability === 'bypass') return Promise.resolve();
  return resolveRuntimeStore().require(capability);
}

export function getClientCapabilitySnapshot(): ClientCapabilityResponse {
  return resolveRuntimeStore().getSnapshot();
}

function resolveRuntimeStore(): ClientCapabilityStore {
  if (typeof getApp === 'function') {
    try {
      const app = getApp<{
        readonly globalData?: {
          readonly clientCapabilityStore?: ClientCapabilityStore;
        };
      }>();
      const appStore = app.globalData?.clientCapabilityStore;
      if (appStore !== undefined) return appStore;
    } catch {
      // The test/local fallback remains fail-closed until App registration completes.
    }
  }
  return runtimeStore;
}

function normalizeSnapshot(
  value: unknown,
  platform: 'miniprogram',
  version: string,
): ClientCapabilityResponse {
  if (!isRecord(value) || value['platform'] !== platform || value['version'] !== version) {
    return createDisabledSnapshot(version);
  }
  const keys = Object.keys(value).sort();
  if (
    keys.length !== capabilityResponseKeys.length ||
    keys.some((key, index) => key !== capabilityResponseKeys[index]) ||
    capabilityNames.some((name) => typeof value[name] !== 'boolean')
  ) {
    return createDisabledSnapshot(version);
  }
  if (value['global'] !== true) return createDisabledSnapshot(version);
  return Object.freeze({
    core: value['core'] as boolean,
    externalMessages: value['externalMessages'] as boolean,
    global: true,
    guest: value['guest'] as boolean,
    insights: value['insights'] as boolean,
    organization: value['organization'] as boolean,
    platform,
    version,
    workflows: value['workflows'] as boolean,
  });
}

function createDisabledSnapshot(version: string): ClientCapabilityResponse {
  return Object.freeze({
    core: false,
    externalMessages: false,
    global: false,
    guest: false,
    insights: false,
    organization: false,
    platform: 'miniprogram',
    version,
    workflows: false,
  });
}

function isKnownCapability(value: string): value is ClientCapabilityName {
  return (capabilityNames as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readBuildVersion(): string {
  return typeof __MINIPROGRAM_BUILD_VERSION__ === 'string'
    ? __MINIPROGRAM_BUILD_VERSION__
    : 'unknown';
}
