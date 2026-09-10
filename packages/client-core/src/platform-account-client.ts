import type {
  PlatformAdminUserDetailsList,
  UpdatePlatformUserProfileRequest,
  UpdatePlatformUserProfileResponse,
  ResetPlatformUserPasswordRequest,
  ResetPlatformUserPasswordResponse,
} from '@schedule/contracts';
import {
  platformAdminUserDetailsListJsonSchema,
  updatePlatformUserProfileResponseJsonSchema,
  resetPlatformUserPasswordResponseJsonSchema,
} from './generated/calendar-schemas.js';
import { defineClientEndpoint, type ClientTransport } from './endpoint.js';
import { createCompactDecoder } from './json-decoder.js';

interface UserInput<Request> {
  readonly userId: string;
  readonly request: Request;
}
const userPath = (id: string): string => `/platform-admin/users/${encodeURIComponent(id)}`;
export const platformAccountEndpoints = {
  details: /* @__PURE__ */ defineClientEndpoint<
    Record<string, never>,
    PlatformAdminUserDetailsList
  >({
    id: 'platform-account.details',
    method: 'GET',
    auth: 'bearer',
    path: () => '/platform-admin/users/details',
    decoder: /* @__PURE__ */ createCompactDecoder<PlatformAdminUserDetailsList>(
      platformAdminUserDetailsListJsonSchema,
    ),
  }),
  profile: /* @__PURE__ */ defineClientEndpoint<
    UserInput<UpdatePlatformUserProfileRequest>,
    UpdatePlatformUserProfileResponse
  >({
    id: 'platform-account.profile',
    method: 'PUT',
    auth: 'bearer',
    path: ({ userId }) => `${userPath(userId)}/profile`,
    body: ({ request }) => request,
    idempotencyKey: ({ request }) => request.operationId,
    decoder: /* @__PURE__ */ createCompactDecoder<UpdatePlatformUserProfileResponse>(
      updatePlatformUserProfileResponseJsonSchema,
    ),
  }),
  password: /* @__PURE__ */ defineClientEndpoint<
    UserInput<ResetPlatformUserPasswordRequest>,
    ResetPlatformUserPasswordResponse
  >({
    id: 'platform-account.password',
    method: 'PUT',
    auth: 'bearer',
    path: ({ userId }) => `${userPath(userId)}/password`,
    body: ({ request }) => request,
    idempotencyKey: ({ request }) => request.operationId,
    decoder: /* @__PURE__ */ createCompactDecoder<ResetPlatformUserPasswordResponse>(
      resetPlatformUserPasswordResponseJsonSchema,
    ),
  }),
};
export function createPlatformAccountClient(transport: ClientTransport) {
  return {
    listDetails: () =>
      transport.request(platformAccountEndpoints.details, {}).then((result) => result.users),
    updateProfile: (userId: string, request: UpdatePlatformUserProfileRequest) =>
      transport.request(platformAccountEndpoints.profile, { userId, request }),
    resetPassword: (userId: string, request: ResetPlatformUserPasswordRequest) =>
      transport.request(platformAccountEndpoints.password, { userId, request }),
  };
}
export type PlatformAccountClient = ReturnType<typeof createPlatformAccountClient>;
