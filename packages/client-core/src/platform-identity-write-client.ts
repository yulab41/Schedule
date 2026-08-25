import type {
  CreateWechatAdminBindingLinkRequest,
  CreateWechatAdminBindingLinkResponse,
  PasswordIdentityAssignmentRequest,
  PasswordIdentityAssignmentResponse,
} from '@schedule/contracts';

import {
  createWechatAdminBindingLinkResponseJsonSchema,
  passwordIdentityAssignmentResponseJsonSchema,
} from './generated/calendar-schemas.js';
import { defineClientEndpoint, type ClientTransport } from './endpoint.js';
import { createCompactDecoder } from './json-decoder.js';

interface UserRequestInput<Request> {
  readonly request: Request;
  readonly userId: string;
}

export const passwordIdentityAssignmentResponseDecoder =
  createCompactDecoder<PasswordIdentityAssignmentResponse>(
    passwordIdentityAssignmentResponseJsonSchema,
  );
export const createWechatAdminBindingLinkResponseDecoder =
  createCompactDecoder<CreateWechatAdminBindingLinkResponse>(
    createWechatAdminBindingLinkResponseJsonSchema,
  );

const body = <Request>({ request }: UserRequestInput<Request>): Request => request;
const operationId = <Request extends { readonly operationId: string }>(
  input: UserRequestInput<Request>,
): string => input.request.operationId;

export const platformIdentityWriteEndpoints = {
  assignPasswordIdentity: defineClientEndpoint<
    UserRequestInput<PasswordIdentityAssignmentRequest>,
    PasswordIdentityAssignmentResponse
  >({
    auth: 'bearer',
    body,
    decoder: passwordIdentityAssignmentResponseDecoder,
    id: 'platform-identity-write.password-identity-assign',
    idempotencyKey: operationId,
    method: 'PUT',
    path: ({ userId }) => `${platformUserPath(userId)}/password-identity`,
  }),
  createWechatBindingLink: defineClientEndpoint<
    UserRequestInput<CreateWechatAdminBindingLinkRequest>,
    CreateWechatAdminBindingLinkResponse
  >({
    auth: 'bearer',
    body,
    decoder: createWechatAdminBindingLinkResponseDecoder,
    id: 'platform-identity-write.binding-link-create',
    idempotencyKey: operationId,
    method: 'POST',
    path: ({ userId }) => `${platformUserPath(userId)}/wechat-miniprogram-binding-links`,
  }),
} as const;

export interface PlatformIdentityWriteClient {
  assignPasswordIdentity(
    userId: string,
    request: PasswordIdentityAssignmentRequest,
  ): Promise<PasswordIdentityAssignmentResponse>;
  createWechatBindingLink(
    userId: string,
    request: CreateWechatAdminBindingLinkRequest,
  ): Promise<CreateWechatAdminBindingLinkResponse>;
}

export function createPlatformIdentityWriteClient(
  transport: ClientTransport,
): PlatformIdentityWriteClient {
  return {
    assignPasswordIdentity: (userId, request) =>
      transport.request(platformIdentityWriteEndpoints.assignPasswordIdentity, {
        request,
        userId,
      }),
    createWechatBindingLink: (userId, request) =>
      transport.request(platformIdentityWriteEndpoints.createWechatBindingLink, {
        request,
        userId,
      }),
  };
}

function platformUserPath(userId: string): string {
  return `/platform-admin/users/${encodeURIComponent(userId)}`;
}
