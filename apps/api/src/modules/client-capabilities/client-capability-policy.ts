import {
  CLIENT_CAPABILITY_NAMES,
  clientVersionSchema,
  type ClientCapabilityName,
  type ClientCapabilityResponse,
  type ClientPlatform,
  type ClientVersion,
} from '@schedule/contracts';

export type ClientCapabilityFlags = Readonly<Record<ClientCapabilityName, boolean>>;

export interface ClientCapabilityPolicyOptions {
  readonly capabilities: ClientCapabilityFlags;
  readonly legacyVersion?: ClientVersion | undefined;
  readonly supportedVersions: readonly ClientVersion[];
}

/**
 * Process-local capability state. Versions are compared as opaque exact
 * strings; there is intentionally no range or "latest" fallback.
 */
export class ClientCapabilityPolicy {
  private readonly capabilities: ClientCapabilityFlags;
  private readonly legacyVersion: ClientVersion | undefined;
  private readonly supportedVersions: ReadonlySet<ClientVersion>;

  public constructor(options: ClientCapabilityPolicyOptions) {
    const versions = options.supportedVersions.map((version) => clientVersionSchema.parse(version));
    if (new Set(versions).size !== versions.length) {
      throw new Error('Supported client versions must be unique exact values.');
    }
    if (
      options.legacyVersion !== undefined &&
      !versions.includes(clientVersionSchema.parse(options.legacyVersion))
    ) {
      throw new Error('The legacy client version must be present in supported client versions.');
    }

    this.capabilities = Object.freeze({ ...options.capabilities });
    this.legacyVersion = options.legacyVersion;
    this.supportedVersions = new Set(versions);
  }

  public static disabled(): ClientCapabilityPolicy {
    return new ClientCapabilityPolicy({
      capabilities: Object.fromEntries(
        CLIENT_CAPABILITY_NAMES.map((name) => [name, false]),
      ) as unknown as ClientCapabilityFlags,
      supportedVersions: [],
    });
  }

  public resolve(
    platform: ClientPlatform,
    version: ClientVersion,
  ): ClientCapabilityResponse | undefined {
    if (platform !== 'miniprogram' || !this.supportedVersions.has(version)) {
      return undefined;
    }
    const global = this.capabilities.global;
    return {
      core: global && this.capabilities.core,
      externalMessages: global && this.capabilities.externalMessages,
      global,
      guest: global && this.capabilities.guest,
      insights: global && this.capabilities.insights,
      organization: global && this.capabilities.organization,
      platform,
      version,
      workflows: global && this.capabilities.workflows,
    };
  }

  public resolveLegacyMini(): ClientCapabilityResponse | undefined {
    return this.legacyVersion === undefined
      ? undefined
      : this.resolve('miniprogram', this.legacyVersion);
  }
}
