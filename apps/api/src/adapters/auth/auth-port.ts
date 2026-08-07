export interface AuthenticatedIdentity {
  readonly cloudbaseUid: string;
}

export interface AuthenticateRequest {
  readonly authorization: string | undefined;
}

export interface AuthPort {
  authenticate(request: AuthenticateRequest): Promise<AuthenticatedIdentity | undefined>;
}
