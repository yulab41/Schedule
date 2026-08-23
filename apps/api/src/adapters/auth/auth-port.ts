import type { ClientPlatform, ClientVersion } from '@schedule/contracts';

export interface AuthenticatedIdentity {
  readonly clientPlatform?: ClientPlatform;
  readonly clientVersion?: ClientVersion;
  readonly cloudbaseUid: string;
}

export interface AuthenticateRequest {
  readonly authorization: string | undefined;
}

export interface AuthPort {
  authenticate(request: AuthenticateRequest): Promise<AuthenticatedIdentity | undefined>;
}
