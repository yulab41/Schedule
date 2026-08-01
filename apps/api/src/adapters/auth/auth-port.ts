export interface AuthenticatedIdentity {
  readonly cloudbaseUid: string;
}

export interface AuthenticateRequest {
  readonly authorization: string | undefined;
  /**
   * Per-request identity context supplied only by the CloudBase HTTP gateway.
   * Local and generic HTTP adapters must leave this unset.
   */
  readonly trustedCloudbaseContext?: string | undefined;
}

export interface AuthPort {
  authenticate(request: AuthenticateRequest): Promise<AuthenticatedIdentity | undefined>;
}
