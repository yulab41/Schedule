export interface FakeAuthIdentity {
  readonly cloudbaseUid: string;
}

export interface FakeAuthPort {
  authenticate(input: { authorization: string | undefined }): Promise<FakeAuthIdentity | undefined>;
}

export type FakeAuthTokenResolver = (token: string) => string | undefined;

export function createFakeAuthPort(resolveCloudbaseUid: FakeAuthTokenResolver): FakeAuthPort {
  return {
    authenticate: async ({ authorization }) => {
      const token = authorization?.replace(/^Bearer\s+/iu, '');
      const cloudbaseUid = token === undefined ? undefined : resolveCloudbaseUid(token);
      return cloudbaseUid === undefined ? undefined : { cloudbaseUid };
    },
  };
}
